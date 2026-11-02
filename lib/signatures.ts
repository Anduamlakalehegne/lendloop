// Versioned envelope avoids relying on JSON key order across platforms.
export type Envelope = {
  payload: string;
  timestamp: string;
  signature: string;
};
export async function sign(
  payload: unknown,
  secret: string,
  now = Date.now(),
): Promise<Envelope> {
  if (secret.length < 32)
    throw new Error("Automation secret must contain at least 32 characters.");
  const body = JSON.stringify(payload),
    timestamp = String(now);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${body}`),
    ),
  );
  return {
    payload: body,
    timestamp,
    signature: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}
export async function verify(
  input: unknown,
  secret: string,
  now = Date.now(),
): Promise<unknown> {
  if (!input || typeof input !== "object") throw new Error("Invalid envelope.");
  const e = input as Partial<Envelope>;
  if (
    typeof e.payload !== "string" ||
    e.payload.length > 65536 ||
    typeof e.timestamp !== "string" ||
    typeof e.signature !== "string" ||
    !/^\d{13}$/.test(e.timestamp) ||
    !/^[a-f0-9]{64}$/.test(e.signature) ||
    Math.abs(now - Number(e.timestamp)) > 300000 ||
    secret.length < 32
  )
    throw new Error("Invalid or expired signature.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(e.signature.match(/../g)!, (x) =>
    parseInt(x, 16),
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      bytes,
      new TextEncoder().encode(`${e.timestamp}.${e.payload}`),
    ))
  )
    throw new Error("Invalid signature.");
  return JSON.parse(e.payload);
}
