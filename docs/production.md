# What I would change for production

1. **Operational readiness:** complete live acceptance checks, versioned service configuration, staged deployments, monitoring, alert delivery, backup/restore drills, and rollback instructions. Pin n8n’s image digest after verifying the deployment target, not only its version tag.
2. **Abuse protection:** apply rate limits and quotas to listing creation, requests, and signed HTTP endpoints; bound request bodies at the gateway before allocation; cap active requests per user.
3. **Identity:** use a managed administrative-role workflow with audit records and MFA; keep administrator grants out of client metadata. Review Clerk session policy and account deletion behavior.
4. **Notifications:** retain the durable outbox, use provider idempotency keys for real email, add delivery receipts, dead-letter handling, user notification preferences, and external alerts for exhausted retries. Use separate directional secrets/key IDs with rotation support.
5. **Data operations:** paginate public/authenticated queries and overdue scans; index compound filters. Add explicit audit events for listing moderation and trust changes. Set retention/deletion policies and handle deleted Clerk users.
6. **Hosting:** deploy standard Next.js, Convex, and n8n independently. Put n8n behind HTTPS with a private editor, managed secrets, durable storage, tested backups, and isolated trusted workflow editing. Replace external Google Fonts with locally hosted fonts for tighter privacy/CSP control.
7. **Verification:** add real Clerk session E2E tests, n8n import/execution tests in CI, accessibility auditing, load tests for approval contention, and transport fault injection. Introduce a tested Clerk-compatible CSP, HSTS on the HTTPS host, dependency scanning, and secret scanning.

These are production follow-ups, not claims that the current take-home has passed a production security review.
