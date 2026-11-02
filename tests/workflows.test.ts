import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { verify, sign } from "../lib/signatures";
const require = createRequire(import.meta.url);
const env = {
  AUTOMATION_SECRET: "x".repeat(64),
  CONVEX_SITE_URL: "https://example.convex.site",
};
type Node = { name: string; type: string; parameters: Record<string, unknown> };
function flow(file: string) {
  return JSON.parse(
    readFileSync(
      new URL(`../n8n/workflows/${file}.json`, import.meta.url),
      "utf8",
    ),
  ) as {
    nodes: Node[];
    connections: Record<string, { main: { node: string }[][] }>;
  };
}
function execute(node: Node, json: unknown) {
  return new Function(
    "require",
    "$env",
    "$json",
    "$input",
    String(node.parameters.jsCode),
  )(require, env, json, { all: () => [{ json }] });
}
it("exports valid connected workflows without embedded secrets", () => {
  for (const name of [
    "request-notification",
    "overdue-reminders",
    "error-handler",
  ]) {
    const f = flow(name);
    for (const outputs of Object.values(f.connections))
      for (const lane of outputs.main)
        for (const edge of lane)
          expect(f.nodes.some((n) => n.name === edge.node)).toBe(true);
    expect(JSON.stringify(f)).not.toContain(env.AUTOMATION_SECRET);
  }
});
it("executes the exported n8n request verification and callback signer", async () => {
  const f = flow("request-notification");
  const input = await sign({ eventId: "event-one" }, env.AUTOMATION_SECRET);
  const result = execute(
    f.nodes.find((n) => n.name === "Verify signed event")!,
    { body: input },
  );
  expect(result[0].json).toEqual({ eventId: "event-one" });
  const callback = execute(
    f.nodes.find((n) => n.name === "Sign notification writeback")!,
    result[0].json,
  );
  expect(await verify(callback[0].json, env.AUTOMATION_SECRET)).toEqual({
    eventId: "event-one",
  });
  expect(() =>
    execute(
      f.nodes.find((n) => n.name === "Verify signed event")!,
      { body: { ...input, payload: "{}" } },
    ),
  ).toThrow("signature");
});
it("expands overdue batches and signs each reminder in the exported workflow", async () => {
  const f = flow("overdue-reminders");
  const expand = f.nodes.find((n) => n.name === "Expand reminder batch")!;
  expect(execute(expand, { reminders: [] })).toEqual([]);
  const batch = execute(expand, {
    reminders: [{ reminderId: "a" }, { reminderId: "b" }],
  });
  expect(batch).toHaveLength(2);
  for (const item of batch) {
    const signed = execute(
      f.nodes.find((n) => n.name === "Sign reminder writeback")!,
      item.json,
    );
    expect(await verify(signed.json, env.AUTOMATION_SECRET)).toEqual(item.json);
  }
});
