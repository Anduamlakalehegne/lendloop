# Verification record

Checks completed in the build workspace:

- Strict TypeScript (`npm run typecheck`): passed with 0 errors.
- Vitest (`npm test`): 24 tests passed across two files (`tests/security.test.ts`, `tests/workflows.test.ts`).
- Next.js 16.4.3 production build (`npm run build`):
  - Passed in zero-credential preview mode (prerendering `/` statically with no Clerk or Convex keys).
  - Passed in full-credential mode with both Clerk and Convex active.
  - Verified partial configurations: Clerk without Convex, Convex without Clerk, and neither service.
- Local n8n workflow automation:
  - Docker container running with verified HMAC secret (>= 32 characters).
  - Request notifications (`request-notification.json`), overdue reminders (`overdue-reminders.json`), and error handler (`error-handler.json`) imported and published.
  - Webhook URL validation parsed via `new URL()`, requiring HTTPS for all remote endpoints and permitting HTTP strictly on loopback (`localhost` / `127.0.0.1`).
- RBAC and deletion permissions:
  - Verified ordinary member listing removal requires resolving active loans and pending requests first.
  - Verified admin listing removal cancels pending borrow requests while preserving historical loan records.
  - Deletion modal copy and UI guards match server-side Convex rules.
- npm production dependency audit: zero known vulnerabilities reported.
