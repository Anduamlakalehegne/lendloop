import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export const status = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
  v.literal("cancelled"),
);
export default defineSchema({
  users: defineTable({
    subject: v.string(),
    name: v.string(),
    trusted: v.boolean(),
  }).index("by_subject", ["subject"]),
  tools: defineTable({
    owner: v.string(),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
    archived: v.boolean(),
  })
    .index("by_owner", ["owner"])
    .index("by_archived", ["archived"]),
  loans: defineTable({
    toolId: v.id("tools"),
    borrower: v.string(),
    lender: v.string(),
    start: v.string(),
    end: v.string(),
    status,
    updatedAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_borrower", ["borrower"])
    .index("by_lender", ["lender"])
    .index("by_status", ["status"]),
  events: defineTable({
    loanId: v.id("loans"),
    recipient: v.string(),
    kind: v.string(),
    state: v.union(
      v.literal("queued"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
  }).index("by_state", ["state"]),
  reminders: defineTable({
    key: v.string(),
    loanId: v.id("loans"),
    recipient: v.string(),
    day: v.string(),
    sentAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_loan", ["loanId"]),
  notifications: defineTable({
    key: v.string(),
    recipient: v.string(),
    loanId: v.id("loans"),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_recipient", ["recipient"]),
});
