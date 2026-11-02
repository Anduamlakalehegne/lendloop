import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { identity, isAdmin } from "./auth";
import { dateRange, overlaps } from "../lib/rules";
import { internal } from "./_generated/api";
async function event(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  recipient: string,
  kind: string,
) {
  const eventId = await ctx.db.insert("events", {
    loanId,
    recipient,
    kind,
    state: "queued",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.delivery.send, { eventId });
}
export const request = mutation({
  args: { toolId: v.id("tools"), start: v.string(), end: v.string() },
  handler: async (ctx, args) => {
    const u = await identity(ctx);
    dateRange(args.start, args.end);
    const t = await ctx.db.get(args.toolId);
    if (!t || t.archived) throw new Error("Listing is unavailable.");
    if (t.owner === u.subject)
      throw new Error("You cannot borrow your own tool.");
    const existing = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .collect();
    if (
      existing.some(
        (l) =>
          (l.status === "approved" &&
            (overlaps(l, args) ||
              l.end < new Date().toISOString().slice(0, 10))) ||
          (overlaps(l, args) &&
            l.borrower === u.subject &&
            l.status === "pending"),
      )
    )
      throw new Error(
        "These dates conflict with an existing booking or your pending request.",
      );
    const id = await ctx.db.insert("loans", {
      ...args,
      borrower: u.subject,
      lender: t.owner,
      status: "pending",
      updatedAt: Date.now(),
    });
    await event(ctx, id, t.owner, "request.created");
    return id;
  },
});
export const transition = mutation({
  args: {
    id: v.id("loans"),
    next: v.union(
      v.literal("approved"),
      v.literal("declined"),
      v.literal("returned"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, { id, next }) => {
    const u = await identity(ctx);
    const l = await ctx.db.get(id);
    if (!l) throw new Error("Loan not found.");
    const lender = l.lender === u.subject;
    const borrower = l.borrower === u.subject;
    if (next === "cancelled") {
      if (!borrower || l.status !== "pending")
        throw new Error("Only your pending requests can be cancelled.");
    } else if (next === "returned") {
      if (!lender || l.status !== "approved")
        throw new Error(
          "Only the lender can confirm an approved loan was returned.",
        );
    } else {
      if (!lender || l.status !== "pending")
        throw new Error(
          "Only the lender can approve or decline a pending request.",
        );
    }
    if (next === "approved") {
      const t = await ctx.db.get(l.toolId);
      if (!t || t.archived) throw new Error("Listing is unavailable.");
      if (l.end < new Date().toISOString().slice(0, 10))
        throw new Error("This request has expired.");
      const bookings = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", l.toolId))
        .collect();
      if (
        bookings.some(
          (b) =>
            b._id !== id &&
            b.status === "approved" &&
            (overlaps(l, b) || b.end < new Date().toISOString().slice(0, 10)),
        )
      )
        throw new Error("Another approved loan overlaps these dates.");
    }
    await ctx.db.patch(id, { status: next, updatedAt: Date.now() });
    await event(
      ctx,
      id,
      next === "cancelled" ? l.lender : l.borrower,
      `request.${next}`,
    );
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const u = await identity(ctx);
    const all = isAdmin(u.subject)
      ? await ctx.db.query("loans").collect()
      : [
          ...(await ctx.db
            .query("loans")
            .withIndex("by_borrower", (q) => q.eq("borrower", u.subject))
            .collect()),
          ...(await ctx.db
            .query("loans")
            .withIndex("by_lender", (q) => q.eq("lender", u.subject))
            .collect()),
        ];
    return Promise.all(
      all
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (l) => {
          const t = await ctx.db.get(l.toolId);
          const reminders = await ctx.db
            .query("reminders")
            .withIndex("by_loan", (q) => q.eq("loanId", l._id))
            .collect();
          return {
            ...l,
            toolName: t?.name ?? "Removed tool",
            lastReminderAt: Math.max(0, ...reminders.map((r) => r.sentAt ?? 0)),
          };
        }),
    );
  },
});
export const notifications = query({
  args: {},
  handler: async (ctx) => {
    const u = await identity(ctx);
    return ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipient", u.subject))
      .order("desc")
      .take(30);
  },
});
