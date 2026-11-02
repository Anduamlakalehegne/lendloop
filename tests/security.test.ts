import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { sign, verify } from "../lib/signatures";
import { dateRange, overlaps } from "../lib/rules";
import { validateWebhookUrl } from "../convex/delivery";
const modules = import.meta.glob("../convex/**/*.ts");
const listing = {
  name: "Drill",
  category: "Power tools",
  condition: "Good",
  description: "Cordless drill with charger.",
};
const owner = {
  subject: "owner",
  issuer: "https://example.clerk.accounts.dev",
  name: "Owner",
};
const borrower = {
  subject: "borrower",
  issuer: owner.issuer,
  name: "Borrower",
};
const other = { subject: "other", issuer: owner.issuer, name: "Other" };
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
beforeEach(() => {
  vi.stubEnv("ADMIN_SUBJECTS", "administrator");
});
describe("Convex authorization and lending rules", () => {
  it("rejects anonymous reads and writes to authenticated resources", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.tools.list, {})).rejects.toThrow("Sign in");
    await expect(t.mutation(api.tools.save, listing)).rejects.toThrow(
      "Sign in",
    );
    await expect(t.query(api.loans.list, {})).rejects.toThrow("Sign in");
  });
  it("returns exactly name and category to anonymous visitors", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(owner).mutation(api.tools.save, listing);
    const rows = await t.query(api.tools.publicList, {});
    expect(rows).toEqual([{ name: "Drill", category: "Power tools" }]);
  });
  it("prevents another user editing or deleting a listing", async () => {
    const t = convexTest(schema, modules);
    const id = await t.withIdentity(owner).mutation(api.tools.save, listing);
    await expect(
      t.withIdentity(other).mutation(api.tools.save, { ...listing, id }),
    ).rejects.toThrow("own");
    await expect(
      t.withIdentity(other).mutation(api.tools.remove, { id }),
    ).rejects.toThrow("Not allowed");
  });
  it("blocks self-borrowing and invalid dates", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    await expect(
      t
        .withIdentity(owner)
        .mutation(api.loans.request, { toolId, start: today, end: tomorrow }),
    ).rejects.toThrow("own tool");
    await expect(
      t.withIdentity(borrower).mutation(api.loans.request, {
        toolId,
        start: "2020-02-30",
        end: tomorrow,
      }),
    ).rejects.toThrow("valid date");
  });
  it("isolates requests and denies borrower approval", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    const id = await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    expect(await t.withIdentity(other).query(api.loans.list, {})).toEqual([]);
    await expect(
      t
        .withIdentity(borrower)
        .mutation(api.loans.transition, { id, next: "approved" }),
    ).rejects.toThrow("lender");
  });
  it("prevents two overlapping approvals and supports return", async () => {
    const t = convexTest(schema, modules);
    const o = t.withIdentity(owner);
    const toolId = await o.mutation(api.tools.save, listing);
    const one = await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const two = await t
      .withIdentity(other)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    await o.mutation(api.loans.transition, { id: one, next: "approved" });
    await expect(
      o.mutation(api.loans.transition, { id: two, next: "approved" }),
    ).rejects.toThrow("overlaps");
    expect(await t.query(api.tools.publicList, {})).toEqual([]);
    await o.mutation(api.loans.transition, { id: one, next: "returned" });
    expect((await t.query(api.tools.publicList, {})).length).toBe(1);
    await expect(
      o.mutation(api.loans.transition, { id: one, next: "approved" }),
    ).rejects.toThrow("pending");
  });
  it("resolves simultaneous approval attempts transactionally", async () => {
    const t = convexTest(schema, modules);
    const o = t.withIdentity(owner);
    const toolId = await o.mutation(api.tools.save, listing);
    const a = await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const b = await t
      .withIdentity(other)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const results = await Promise.allSettled([
      o.mutation(api.loans.transition, { id: a, next: "approved" }),
      o.mutation(api.loans.transition, { id: b, next: "approved" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("prevents removal while loans are unresolved", async () => {
    const t = convexTest(schema, modules);
    const o = t.withIdentity(owner);
    const toolId = await o.mutation(api.tools.save, listing);
    const id = await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    await expect(o.mutation(api.tools.remove, { id: toolId })).rejects.toThrow(
      "Resolve",
    );
    await o.mutation(api.loans.transition, { id, next: "declined" });
    await o.mutation(api.tools.remove, { id: toolId });
    expect(await t.query(api.tools.publicList, {})).toEqual([]);
  });
  it("derives administrator permission from a server-controlled subject list", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    await expect(
      t.withIdentity(other).query(api.users.list, {}),
    ).rejects.toThrow("Administrator");
    await t
      .withIdentity({ ...other, subject: "administrator" })
      .mutation(api.tools.remove, { id: toolId });
    expect(await t.query(api.tools.publicList, {})).toEqual([]);
  });
  it("keeps notifications private", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const e = await t.run((ctx) => ctx.db.query("events").first());
    await t.mutation(internal.automation.event, { eventId: e!._id });
    expect(
      await t.withIdentity(borrower).query(api.loans.notifications, {}),
    ).toEqual([]);
    expect(
      await t.withIdentity(owner).query(api.loans.notifications, {}),
    ).toHaveLength(1);
  });
});
describe("Automation reliability", () => {
  it("commits a mock notification once when webhook delivery is retried", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const e = await t.run((ctx) => ctx.db.query("events").first());
    await t.mutation(internal.automation.event, { eventId: e!._id });
    await t.mutation(internal.automation.event, { eventId: e!._id });
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(1);
  });
  it("deduplicates reminder creation and writebacks", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const toolId = await ctx.db.insert("tools", {
        ...listing,
        owner: "owner",
        archived: false,
      });
      await ctx.db.insert("loans", {
        toolId,
        borrower: "borrower",
        lender: "owner",
        start: "2020-01-01",
        end: "2020-01-02",
        status: "approved",
        updatedAt: Date.now(),
      });
    });
    const first = await t.mutation(internal.automation.overdue, {});
    const second = await t.mutation(internal.automation.overdue, {});
    expect(second[0].reminderId).toBe(first[0].reminderId);
    await t.mutation(internal.automation.complete, first[0]);
    await t.mutation(internal.automation.complete, first[0]);
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(1);
    expect(await t.mutation(internal.automation.overdue, {})).toEqual([]);
  });
  it("skips a reminder when a tool was returned before delivery", async () => {
    const t = convexTest(schema, modules);
    const loanId = await t.run(async (ctx) => {
      const toolId = await ctx.db.insert("tools", {
        ...listing,
        owner: "owner",
        archived: false,
      });
      return ctx.db.insert("loans", {
        toolId,
        borrower: "borrower",
        lender: "owner",
        start: "2020-01-01",
        end: "2020-01-02",
        status: "approved",
        updatedAt: Date.now(),
      });
    });
    const [r] = await t.mutation(internal.automation.overdue, {});
    await t.run((ctx) => ctx.db.patch(loanId, { status: "returned" }));
    expect(await t.mutation(internal.automation.complete, r)).toEqual({
      skipped: true,
    });
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
  });
  it("makes exhausted delivery attempts visible", async () => {
    const t = convexTest(schema, modules);
    const toolId = await t
      .withIdentity(owner)
      .mutation(api.tools.save, listing);
    await t
      .withIdentity(borrower)
      .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
    const e = await t.run((ctx) => ctx.db.query("events").first());
    for (let i = 0; i < 5; i++)
      await t.mutation(internal.automation.failed, { eventId: e!._id });
    expect(
      (await t.query(internal.automation.getEvent, { eventId: e!._id }))?.state,
    ).toBe("failed");
  });
});
describe("Signed envelope", () => {
  const secret = "s".repeat(64);
  it("accepts a valid signed payload", async () => {
    const e = await sign({ eventId: "one" }, secret);
    expect(await verify(e, secret)).toEqual({ eventId: "one" });
  });
  it("rejects tampering, wrong secret, stale and future timestamps", async () => {
    const now = Date.now(),
      e = await sign({ eventId: "one" }, secret, now);
    await expect(
      verify({ ...e, payload: "{}" }, secret, now),
    ).rejects.toThrow();
    await expect(verify(e, "b".repeat(64), now)).rejects.toThrow();
    await expect(verify(e, secret, now + 300001)).rejects.toThrow();
    await expect(verify(e, secret, now - 300001)).rejects.toThrow();
  });
  it("rejects malformed signatures and missing secrets", async () => {
    const e = await sign({}, secret);
    await expect(verify({ ...e, signature: "xyz" }, secret)).rejects.toThrow();
    await expect(verify(e, "")).rejects.toThrow();
  });
  it("protects the actual Convex HTTP endpoint", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("AUTOMATION_SECRET", secret);
    const bad = await t.fetch("/automation/overdue", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(bad.status).toBe(401);
    const good = await t.fetch("/automation/overdue", {
      method: "POST",
      body: JSON.stringify(await sign({}, secret)),
    });
    expect(good.status).toBe(200);
  });
});
it("uses inclusive date ranges and rejects impossible dates", () => {
  expect(
    overlaps(
      { start: "2026-12-01", end: "2026-12-03" },
      { start: "2026-12-03", end: "2026-12-04" },
    ),
  ).toBe(true);
  expect(() => dateRange("2027-02-30", "2027-03-02", "2027-01-01")).toThrow();
});

it("keeps overdue loans unavailable until returned", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const toolId = await ctx.db.insert("tools", {
      ...listing,
      owner: "owner",
      archived: false,
    });
    await ctx.db.insert("loans", {
      toolId,
      borrower: "borrower",
      lender: "owner",
      start: "2020-01-01",
      end: "2020-01-02",
      status: "approved",
      updatedAt: Date.now(),
    });
  });
  expect(await t.query(api.tools.publicList, {})).toEqual([]);
  expect(
    (await t.withIdentity(borrower).query(api.tools.list, {}))[0].busy,
  ).toBe(true);
});
it("allows admin archival with active loans while preserving return and history", async () => {
  const t = convexTest(schema, modules);
  const o = t.withIdentity(owner);
  const toolId = await o.mutation(api.tools.save, listing);
  const active = await t
    .withIdentity(borrower)
    .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
  const pending = await t
    .withIdentity(other)
    .mutation(api.loans.request, { toolId, start: today, end: tomorrow });
  await o.mutation(api.loans.transition, { id: active, next: "approved" });
  await t
    .withIdentity({ ...other, subject: "administrator" })
    .mutation(api.tools.remove, { id: toolId });
  expect(await t.query(api.tools.publicList, {})).toEqual([]);
  expect(
    (await t.withIdentity(other).query(api.loans.list, {})).find(
      (l) => l._id === pending,
    )?.status,
  ).toBe("cancelled");
  await o.mutation(api.loans.transition, { id: active, next: "returned" });
  expect(
    (await o.query(api.loans.list, {})).find((l) => l._id === active)?.status,
  ).toBe("returned");
});

describe("Webhook destination validation", () => {
  it("permits local loopback HTTP destinations for development", () => {
    expect(
      validateWebhookUrl("http://localhost:5678/webhook/lendloop-request").href,
    ).toBe("http://localhost:5678/webhook/lendloop-request");
    expect(
      validateWebhookUrl("http://127.0.0.1:5678/webhook/lendloop-request").href,
    ).toBe("http://127.0.0.1:5678/webhook/lendloop-request");
  });

  it("permits remote HTTPS destinations for production", () => {
    expect(
      validateWebhookUrl("https://n8n.example.com/webhook/lendloop-request")
        .href,
    ).toBe("https://n8n.example.com/webhook/lendloop-request");
  });

  it("rejects unencrypted remote HTTP destinations", () => {
    expect(() =>
      validateWebhookUrl("http://n8n.example.com/webhook/lendloop-request"),
    ).toThrow("Use an HTTPS n8n webhook URL");
  });

  it("rejects loopback hostname spoofing attempts", () => {
    expect(() =>
      validateWebhookUrl(
        "http://localhost.evil.com/webhook/lendloop-request",
      ),
    ).toThrow("Use an HTTPS n8n webhook URL");
    expect(() =>
      validateWebhookUrl(
        "http://127.0.0.1.attacker.com/webhook/lendloop-request",
      ),
    ).toThrow("Use an HTTPS n8n webhook URL");
  });

  it("rejects malformed URLs", () => {
    expect(() => validateWebhookUrl("not-a-valid-url")).toThrow(
      "Invalid N8N_REQUEST_WEBHOOK_URL",
    );
  });
});
