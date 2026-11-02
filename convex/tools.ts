import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { identity, isAdmin } from "./auth";
import { internal } from "./_generated/api";
import { categories, conditions, clean } from "../lib/rules";
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const approved = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const today = new Date().toISOString().slice(0, 10);
    return tools
      .filter(
        (t) => !approved.some((l) => l.toolId === t._id && l.start <= today),
      )
      .map((t) => ({ name: t.name, category: t.category }));
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await identity(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const users = await ctx.db.query("users").collect();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const today = new Date().toISOString().slice(0, 10);
    return tools.map((t) => {
      const ownerUser = users.find((u) => u.subject === t.owner);
      return {
        ...t,
        ownerName: ownerUser?.name ?? "Neighbor",
        trusted: ownerUser?.trusted ?? false,
        busy: loans.some((l) => l.toolId === t._id && l.start <= today),
      };
    });
  },
});
const fields = {
  name: v.string(),
  category: v.string(),
  condition: v.string(),
  description: v.string(),
};
export const save = mutation({
  args: { id: v.optional(v.id("tools")), ...fields },
  handler: async (ctx, args) => {
    const u = await identity(ctx);
    if (
      !categories.includes(args.category as (typeof categories)[number]) ||
      !conditions.includes(args.condition as (typeof conditions)[number])
    )
      throw new Error("Select a valid category and condition.");
    const data = {
      name: clean(args.name, "Name", 80),
      category: args.category,
      condition: args.condition,
      description: clean(args.description, "Description", 500),
    };
    if (args.id) {
      const t = await ctx.db.get(args.id);
      if (!t || t.archived || t.owner !== u.subject)
        throw new Error("You can edit only your own active listings.");
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return ctx.db.insert("tools", {
      ...data,
      owner: u.subject,
      archived: false,
    });
  },
});
export const remove = mutation({
  args: { id: v.id("tools") },
  handler: async (ctx, { id }) => {
    const u = await identity(ctx);
    const t = await ctx.db.get(id);
    if (!t || (!isAdmin(u.subject) && t.owner !== u.subject))
      throw new Error("Not allowed.");
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", id))
      .collect();
    if (
      !isAdmin(u.subject) &&
      loans.some((l) => l.status === "approved" || l.status === "pending")
    )
      throw new Error(
        "Resolve pending requests and active loans before removing this listing.",
      );
    // Admin removal preserves active loan history and cancels pending requests.
    if (isAdmin(u.subject))
      for (const l of loans.filter((l) => l.status === "pending")) {
        await ctx.db.patch(l._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });
        const eventId = await ctx.db.insert("events", {
          loanId: l._id,
          recipient: l.borrower,
          kind: "request.cancelled-by-admin",
          state: "queued",
          attempts: 0,
        });
        await ctx.scheduler.runAfter(0, internal.delivery.send, { eventId });
      }
    await ctx.db.patch(id, { archived: true });
  },
});
