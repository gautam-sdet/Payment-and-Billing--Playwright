# Kulu SDET Take-Home — Subscription & Billing

Automated TypeScript and Playwright validation for a **Subscription & Billing** service: API contracts, a structurally enforced lifecycle, queryable persistence, and a mocked payment provider.

This is **Option 3** from `SDET_ASSIGNMENT.md`: a small HTTP fixture plus an object-oriented test framework. There is no real Stripe (or other) network call.

## What is real vs mocked

| Piece | In this repo |
| --- | --- |
| HTTP API (`/subscriptions`, `/webhooks/payment-provider`) | Real Express app in-process via Supertest |
| Persistence | Real queryable in-memory store (not “assert on the response only”) |
| Lifecycle rules | Real `SubscriptionStateMachine` |
| Payment provider | **Mock** — `ConfigurablePaymentProvider` (success / decline / timeout) |
| Webhook delivery | **Simulated** — tests sign payloads with HMAC-SHA256 and POST them |
| Time | `FrozenClock` in tests |

`POST /subscriptions/{id}/billing-cycle` is a **test control plane** endpoint. It stands in for “trial ended” or “recurring bill is due” so we can drive charges without waiting for a calendar.

## Plans (fixture)

| Plan | Amount | Trial | Create behavior |
| --- | --- | --- | --- |
| `basic` | 900 USD cents | 14 days | Starts `trialing`, **no** provider call |
| `pro` | 4900 USD cents | 0 days | Charges immediately → `active` or `past_due` |

Seeded customer: `cust_001`. Payment methods must start with `pm_`.

## Lifecycle (from the assignment)

```text
trialing --(trial ends, first charge succeeds)--> active
trialing --(trial ends, first charge fails)------> past_due
active   --(recurring charge fails)---------------> past_due
past_due --(retry charge succeeds)----------------> active
past_due --(retries exhausted)--------------------> canceled
active   --(customer/API cancel)------------------> canceled
trialing --(customer/API cancel)------------------> canceled
```

Dunning: **3 consecutive failed charges** then `canceled`. Failed retries while already `past_due` do not invent extra statuses.

`CHARGE_SUCCEEDED` on `active` is a self-transition (recurring success). `canceled` is terminal: stray webhooks are stored as `ignored_canceled` and do not write invoices.

## Run

```bash
npm install
npm run build    # tsc --noEmit
npm test
npm run allure:generate
npm run allure:open
```

Persistence is **in-memory**. There is no database to migrate. Each test constructs a `TestWorld`, which seeds customer `cust_001` and a fresh store. Nothing is shared across tests.

Optional fixture server (not required for tests):

```bash
npm start        # http://127.0.0.1:43177
```

## Playwright layout

The Playwright suite lives under `tests`:

```text
playwright.config.ts
tests/playwright/
	support/
		billing-fixture.ts       # isolated real HTTP server per test
		billing-api-client.ts    # typed API facade
		webhook-simulator.ts     # signed, forged, and malformed webhooks
		builders.ts              # subscription and webhook builders
		assertions.ts            # persistence and provider assertions
	specs/
		api-contract.spec.ts
		lifecycle.spec.ts
		webhooks.spec.ts
		provider-and-persistence.spec.ts
```

See [PLAYWRIGHT_STRATEGY.md](./PLAYWRIGHT_STRATEGY.md) for scope, patterns, assumptions, and limitations.

Allure results are written to `allure-results` whenever the Playwright suite runs. Generate the static report with `npm run allure:generate`, then open it locally with `npm run allure:open`.

## Existing fixture layout

```text
src/http/           # schemas, errors, Express app
src/domain/         # state machine, plan table/strategy
src/app/            # subscription + webhook services, composeBilling
src/persistence/    # store, repositories, seed
tests/support/      # TestWorld framework (see tests/README.md)
tests/api|lifecycle|webhooks|provider|persistence|e2e|domain
```

How a spec reaches the fixture, mock, and database: **[tests/README.md](./tests/README.md)**.

## Submit

Kulu’s repo: https://github.com/Robustrade/sdet-assignments  

Fork it, branch `solution/<your-name>`, put this project under `submission/<your-name>/`, open a PR to `main`, and paste `PR_DESCRIPTION.md` as the description (that file follows `pull_request_template_sdet.md`). Use `APPROACH.md` if you need a documentation-first write-up before the full suite.

Read `TEST_STRATEGY.md` before changing tests.
