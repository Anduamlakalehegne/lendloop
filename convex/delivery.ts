import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { sign } from "../lib/signatures";
export const send = internalAction({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const e = await ctx.runQuery(internal.automation.getEvent, { eventId });
    if (!e || e.state === "delivered") return;
    try {
      const url = process.env.N8N_REQUEST_WEBHOOK_URL,
        secret = process.env.AUTOMATION_SECRET;
      if (!url || !secret) throw new Error("Automation is not configured.");
      if (
        !url.startsWith("https://") &&
        !url.startsWith("http://localhost") &&
        !url.startsWith("http://127.0.0.1")
      )
        throw new Error("Use an HTTPS n8n webhook URL (or localhost for development).");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await sign({ eventId: e._id }, secret)),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(`Webhook returned HTTP ${response.status}`);
      // The receiver must commit /automation/event before acknowledging the webhook.
      const latest = await ctx.runQuery(internal.automation.getEvent, {
        eventId,
      });
      if (latest?.state !== "delivered")
        throw new Error("Workflow did not acknowledge the notification.");
    } catch {
      await ctx.runMutation(internal.automation.failed, { eventId });
    }
  },
});
