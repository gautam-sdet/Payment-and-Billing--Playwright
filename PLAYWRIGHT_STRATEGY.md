# Playwright Test Strategy

## System under test

This is the assignment's hybrid fixture approach. The Express HTTP app, in-memory repositories, lifecycle state machine, and application services are real. The payment provider is a configurable injected test double. Webhooks are simulated by Playwright API requests with HMAC signatures.

## Coverage

The suite validates API contracts, state transitions, database entities (`subscriptions`, `invoices`, `webhook_events`, and audit entries), provider calls, duplicate delivery, stale/out-of-order delivery, forged signatures, malformed payloads, and end-to-end side effects.

## Design patterns

- State machine: `src/domain/subscription-state-machine.ts` centralizes legal transitions.
- Builders: `tests/playwright/support/builders.ts` keeps test intent separate from payload construction.
- Strategy/dependency injection: `PaymentProvider` accepts the configurable mock without a real network dependency.
- Repository: persistence assertions query repositories instead of treating HTTP responses as the database.
- Fixture/facade: the Playwright fixture owns setup and teardown; `BillingApiClient` keeps transport details out of specs.

## Tradeoffs

The database is intentionally in-memory and the suite uses API-level concurrency tooling rather than a browser UI because the assignment is backend-focused. A production deployment would add a real database test profile and a race/concurrency suite.
