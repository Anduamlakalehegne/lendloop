import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { identity, admin, isAdmin } from "./auth";
export const me = query({
  args: {},
  handler: async (ctx) => {
    const u = await identity(ctx);
    return {
      subject: u.subject,
      name: u.name ?? "Neighbor",
      isAdmin: isAdmin(u.subject),
    };
  },
});
export const sync = mutation({
  args: {},
  handler: async (ctx) => {
    const u = await identity(ctx);
    const found = await ctx.db
      .query("users")
      .withIndex("by_subject", (q) => q.eq("subject", u.subject))
      .unique();
    if (!found)
      await ctx.db.insert("users", {
        subject: u.subject,
        name: u.name ?? "Neighbor",
        trusted: false,
      });
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await admin(ctx);
    return ctx.db.query("users").collect();
  },
});
export const trust = mutation({
  args: { id: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, args) => {
    await admin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("User not found.");
    await ctx.db.patch(args.id, { trusted: args.trusted });
  },
});
