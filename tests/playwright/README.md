# Playwright acceptance suite

This directory contains the browser-tooling-independent Playwright API suite for the subscription and billing fixture. Playwright's `APIRequestContext` drives the real Express HTTP server; no Supertest calls are used by these scenarios.

## Structure

- `support/billing-fixture.ts`: starts an isolated server on an ephemeral port and injects the mock provider, frozen clock, notifier, and repositories.
- `support/billing-api-client.ts`: typed API client used by scenarios.
- `support/webhook-simulator.ts`: signs valid payloads and sends forged or malformed requests.
- `support/builders.ts`: builders for readable subscription and webhook data.
- `support/assertions.ts`: persistence and provider interaction assertions.
- `specs/`: API, lifecycle, webhook, provider, persistence, and end-to-end behavior.

## Commands

```bash
npm run test:e2e
npm run test:e2e:ui
npm run allure:generate
npm run allure:open
npm run build
```

Playwright writes Allure result files to `allure-results`. Generate the report after a test run, then open it with the Allure CLI.

The suite covers every valid lifecycle transition, terminal cancellation behavior, invalid transitions, validation errors, duplicate and out-of-order webhooks, signature handling, provider success/decline/timeout, provider call arguments, and persistence invariants.
