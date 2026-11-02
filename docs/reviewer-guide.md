# Reviewer walkthrough

## Suggested 5-minute demo

1. Open the anonymous board and inspect the public Convex response: name/category only.
2. Member A lists a drill; member B requests dates. Explain server-derived ownership.
3. A approves; show the private notification delivered through n8n, then A marks returned.
4. Show a forbidden approval and a conflicting booking being rejected server-side.
5. Show admin trusted-lender controls, archival, and failed-event retry.
6. Run the overdue workflow twice against a development overdue fixture. Show one loan/day notification and its reminder timestamp.

## Decisions to be ready to explain

- Why permission checks belong in Convex functions, independently of UI visibility.
- Why date intervals include both endpoints, and how concurrent approval is serialized.
- Why webhook events carry only opaque IDs and resolve recipients server-side.
- Why signing the exact payload string avoids canonicalization mismatches.
- How delivery works when an HTTP response is lost after the database commit.
- Why a mock notification plus status update can be atomic, while a real email requires provider-level idempotency.
- What the error workflow does, what it does not do, and what still needs live verification.

## Requirement mapping

| Requirement                          | Source                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Public board and Clerk sign-in       | `app/page.tsx`, `components/providers.tsx`                      |
| Public data minimization             | `convex/tools.ts: publicList`                                   |
| Authenticated listing CRUD           | `convex/tools.ts`, `components/dashboard.tsx`                   |
| Requests, approval, decline, returns | `convex/loans.ts`                                               |
| Admin and trusted lenders            | `convex/auth.ts`, `convex/users.ts`, dashboard                  |
| Convex-enforced authorization        | all public functions in `convex/`                               |
| Request automation                   | `convex/delivery.ts`, `n8n/workflows/request-notification.json` |
| Daily overdue workflow               | `n8n/workflows/overdue-reminders.json`                          |
| Signature verification               | `lib/signatures.ts`, `convex/http.ts`, n8n verification node    |
| Idempotent delivery                  | `convex/automation.ts`                                          |
| Errors and retries                   | delivery action, HTTP node retries, error-handler workflow      |
| Recent reminder activity             | loans query and dashboard                                       |
| Setup and production notes           | `README.md`, `docs/production.md`                               |

## Honesty about AI assistance

The posting permits LLM-assisted coding. Review every generated component and be able to explain the implementation, test evidence, and remaining limitations. Describe actual AI assistance truthfully if asked. Do not claim tests or service deployments that have not been completed.
