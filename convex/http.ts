import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verify } from "../lib/signatures";
import type { Id } from "./_generated/dataModel";
const router = httpRouter();
for (const path of [
  "/automation/event",
  "/automation/overdue",
  "/automation/complete",
] as const) {
  router.route({
    path,
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      let payload: unknown;
      try {
        const raw = await req.text();
        if (raw.length > 70000)
          return new Response("Too large", { status: 413 });
        payload = await verify(
          JSON.parse(raw),
          process.env.AUTOMATION_SECRET ?? "",
        );
      } catch {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        if (!payload || typeof payload !== "object" || Array.isArray(payload))
          return new Response("Invalid payload", { status: 400 });
        const p = payload as Record<string, unknown>;
        if (path === "/automation/event") {
          if (typeof p.eventId !== "string")
            return new Response("eventId required", { status: 400 });
          return Response.json(
            await ctx.runMutation(internal.automation.event, {
              eventId: p.eventId as Id<"events">,
            }),
          );
        }
        if (path === "/automation/complete") {
          if (typeof p.reminderId !== "string")
            return new Response("reminderId required", { status: 400 });
          return Response.json(
            await ctx.runMutation(internal.automation.complete, {
              reminderId: p.reminderId as Id<"reminders">,
            }),
          );
        }
        return Response.json({
          reminders: await ctx.runMutation(internal.automation.overdue, {}),
        });
      } catch {
        return new Response(
          "Automation operation failed; inspect Convex function logs.",
          { status: 400 },
        );
      }
    }),
  });
}
export default router;
