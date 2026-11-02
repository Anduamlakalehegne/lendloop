import {
  internalQuery,
  internalMutation,
  query,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { admin } from "./auth";
export const getEvent = internalQuery({
  args: { eventId: v.id("events") },
  handler: (ctx, { eventId }) => ctx.db.get(eventId),
});
export const failed = internalMutation({
  args: { eventId: v.id("events"), error: v.optional(v.string()) },
  handler: async (ctx, { eventId, error }) => {
    const e = await ctx.db.get(eventId);
    if (!e || e.state === "delivered") return;
    const attempts = e.attempts + 1;
    await ctx.db.patch(eventId, {
      attempts,
      state: attempts >= 5 ? "failed" : "queued",
      lastError:
        error ??
        "Notification delivery failed. Check the n8n execution and configuration.",
    });
    if (attempts < 5)
      await ctx.scheduler.runAfter(
        Math.min(60000 * 2 ** (attempts - 1), 900000),
        internal.delivery.send,
        { eventId },
      );
  },
});
export const event = internalMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const e = await ctx.db.get(eventId);
    if (!e) throw new Error("Event not found.");
    if (e.state === "delivered") return { duplicate: true };
    const l = await ctx.db.get(e.loanId);
    if (!l) throw new Error("Loan not found.");
    await ctx.db.insert("notifications", {
      key: `event:${eventId}`,
      recipient: e.recipient,
      loanId: e.loanId,
      message: e.kind.replace("request.", "Borrow request: "),
      createdAt: Date.now(),
    });
    await ctx.db.patch(eventId, {
      state: "delivered",
      deliveredAt: Date.now(),
      lastError: undefined,
    });
    return { delivered: true };
  },
});
export const overdue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const day = new Date().toISOString().slice(0, 10);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const reminders = [];
    for (const l of loans.filter((l) => l.end < day)) {
      const key = `${l._id}:${day}`;
      const existing = await ctx.db
        .query("reminders")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing?.sentAt) continue;
      const id = existing
        ? existing._id
        : await ctx.db.insert("reminders", {
            key,
            loanId: l._id,
            recipient: l.borrower,
            day,
          });
      reminders.push({ reminderId: id });
    }
    return reminders;
  },
});
export const complete = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) throw new Error("Reminder not found.");
    if (r.sentAt) return { duplicate: true };
    const l = await ctx.db.get(r.loanId);
    if (
      !l ||
      l.status !== "approved" ||
      l.end >= new Date().toISOString().slice(0, 10)
    )
      return { skipped: true };
    await ctx.db.insert("notifications", {
      key: `reminder:${r.key}`,
      recipient: r.recipient,
      loanId: r.loanId,
      message: "Your borrowed tool is overdue. Please arrange its return.",
      createdAt: Date.now(),
    });
    await ctx.db.patch(reminderId, { sentAt: Date.now() });
    return { delivered: true };
  },
});
export const activity = query({
  args: {},
  handler: async (ctx) => {
    await admin(ctx);
    return ctx.db.query("events").order("desc").take(50);
  },
});
export const retry = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await admin(ctx);
    const e = await ctx.db.get(eventId);
    if (!e || e.state === "delivered")
      throw new Error("Delivered events cannot be retried.");
    await ctx.db.patch(eventId, {
      state: "queued",
      attempts: 0,
      lastError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.delivery.send, { eventId });
  },
});
