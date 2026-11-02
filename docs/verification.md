# Verification record

## 1. Automated workspace checks

- Strict TypeScript (`npm run typecheck`): passed with 0 errors.
- Vitest (`npm test`): **29 tests passed** across two files (`tests/security.test.ts`, `tests/workflows.test.ts`).
- Next.js 16.4.3 production build (`npm run build`):
  - Passed in zero-credential preview mode (prerendering `/` statically with no Clerk or Convex keys).
  - Passed in full-credential mode with both Clerk and Convex active.
  - Verified partial configurations: Clerk without Convex, Convex without Clerk, and neither service.
- RBAC and deletion permissions:
  - Verified ordinary member listing removal requires resolving active loans and pending requests first.
  - Verified admin listing removal cancels pending borrow requests while preserving historical loan records.
  - Deletion modal copy and UI guards match server-side Convex rules.
- npm production dependency audit: zero known vulnerabilities reported.
- Build and test verification: Verified locally via `npm run typecheck`, `npm test` (29/29 tests passed), and `npm run build` across all configuration modes (zero credentials, partial configuration, and full credentials).

## 2. Live environment integration checks

- Authentication & RBAC:
  - Clerk user sessions verified with Convex identity synchronization.
  - Server-side role assignment via `ADMIN_SUBJECTS` verified; admin moderation tab and trusted-lender toggles tested.
- Workflow automation in n8n (Docker):
  - Local n8n container (`lendloop-n8n-1`) running on port 5678 with verified 68-character shared HMAC secret (`AUTOMATION_SECRET`).
  - Request notifications (`request-notification.json`), overdue reminders (`overdue-reminders.json`), and error handler (`error-handler.json`) imported and published.
  - Webhook URL parsing tightened via `new URL()`, enforcing HTTPS for remote destinations and exact loopback matching for `localhost` / `127.0.0.1`.
  - End-to-end delivery: Convex signs the event envelope; n8n verifies the signature, executes writeback to Convex HTTP endpoint (`/automation/event`), and Convex marks the event as `delivered`.
- UI & Partial Configuration:
  - In Convex-only mode (`hasConvex && !hasClerk`), live tools load from Convex, and the Sign-In button smoothly scrolls to an explanatory note clarifying that live authentication requires Clerk credentials.
