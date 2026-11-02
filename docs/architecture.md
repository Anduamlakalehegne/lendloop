# Architecture and security decisions

## Trust boundaries

Clerk authenticates users. Convex verifies the Clerk JWT issuer/application ID. Each authenticated Convex function checks `ctx.auth.getUserIdentity()`. Administrators are selected by a server-side subject allowlist; clients cannot promote themselves, supply an owner, or choose the recipient of an automation notification.

Public data is projected on the server to `{name, category}` only. No owner identifiers, descriptions, user profiles, or loan records enter that public response. Authenticated tool views contain owner IDs to support own-listing controls; notifications and loans remain restricted to their participants, except explicit admin access to all loans.

## Data model

`users` contains Clerk subjects, display names, and trusted status. `tools` holds a listing and owner subject. `loans` holds immutable lender/borrower identities and a date interval. `events` is the persistent notification outbox. `reminders` holds one loan/day reminder key. `notifications` is the private mock delivery sink.

No customer data, physical addresses, or emails are stored. Display names come from Clerk identity, not arbitrary role metadata. Avoid logging authenticated objects or request bodies.

## Booking model

Date-only intervals use UTC, include both boundary dates, and cannot start in the past. A request begins pending. Only its lender can approve/decline a pending request or confirm an approved loan’s return. A borrower can cancel only their own pending request. Return is lender-confirmed so the asset owner controls availability.

Approval queries all loans for a tool and verifies that no approved interval overlaps. Convex’s transactional conflict detection serializes conflicting approvals; a client-side availability badge is advisory. Overdue approved loans remain unavailable and block new requests/approvals until returned. Existing conflicting pending requests remain visible for the owner to decline; they are not silently deleted.

Normal users can remove their own listing only after resolving pending/approved loans. Admins can archive any listing: pending requests are cancelled and notified, approved loans remain recorded and returnable. History is retained for auditability. Editing a listing never changes loan ownership.

## Automation protocol

An envelope contains `payload` (a JSON string), `timestamp` (Unix milliseconds), and `signature` (hex HMAC-SHA256 of `timestamp.payload`). Signing the exact payload string avoids cross-runtime JSON canonicalization differences. Both receivers verify signatures and reject clocks outside a five-minute window. Webhook delivery from Convex enforces HTTPS for remote destinations (with loopback http://localhost and http://127.0.0.1 permitted for local Docker development). Keep clocks synchronized.

Replay within that short window is harmless to notification delivery: each event is consumed once; each reminder uses a stable loan/UTC-day key. Replay resistance beyond expiry uses these business idempotency keys, rather than an in-memory nonce cache. Secrets have a minimum length, remain outside exported workflows, and must be generated with a cryptographic source.

Convex atomically stores an event and schedules delivery when business state changes. The n8n webhook sees only the event ID. n8n signs a callback that invokes an internal Convex mutation through an authenticated HTTP action; that mutation resolves the recipient from trusted stored state and commits the private mock notification and delivery status together. The webhook returns success only afterwards. A lost response followed by a retry cannot duplicate the notification.

Daily reminders use the same pattern. A lookup creates or reuses a reminder row; repeated lookup returns the same pending ID. Completion rechecks the loan status immediately before committing, so a loan returned in the meantime receives no stale reminder. Retrying completion cannot create another notification. For real email, this transaction boundary must be supplemented by provider idempotency/outbox handling.

## Failures and limitations

Request webhooks retry with exponential backoff and become explicitly failed after five failed attempts. Admins can inspect/retry them. n8n HTTP nodes also retry, and an Error Trigger workflow records sanitized failure metadata. No real email provider is configured: delivery means insertion in the permitted mock notification sink.

The daily lookup scans approved loans, and tool lists are intentionally unpaginated for this small assignment. It should be paginated and indexed further before scale. A failed daily run remains visible in n8n, and pending reminders remain eligible on the next same-day rerun. Operator retry is required for final workflow failures; no claim is made about an external alerting service.

No attachment uploads, geolocation, payments, chat, AI features, or healthcare records are added to the take-home scope. See the production note for hardening and remaining acceptance work.
