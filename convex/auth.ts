import type { QueryCtx, MutationCtx } from "./_generated/server";
export async function identity(ctx: QueryCtx | MutationCtx) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new Error("Sign in to continue.");
  return user;
}
export function isAdmin(subject: string) {
  return (process.env.ADMIN_SUBJECTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(subject);
}
export async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await identity(ctx);
  if (!isAdmin(user.subject)) throw new Error("Administrator access required.");
  return user;
}
