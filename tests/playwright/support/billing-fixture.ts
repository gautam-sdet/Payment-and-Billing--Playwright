import http from "node:http";
import type { AddressInfo } from "node:net";
import { test as base } from "@playwright/test";
import { composeBilling } from "../../../src/app/compose.js";
import { FrozenClock } from "../../../src/domain/clock.js";
import { RecordingNotifier } from "../../../src/notifications/notifier.js";
import { ConfigurablePaymentProvider } from "../../../src/payments/configurable-payment-provider.js";
import type { Repositories } from "../../../src/persistence/repositories.js";
import { InMemoryStore } from "../../../src/persistence/store.js";
import { seedFixtureCustomer } from "../../../src/persistence/seed.js";
import { BillingApiClient } from "./billing-api-client.js";
import { TEST_WEBHOOK_SECRET } from "./constants.js";

export class BillingFixture {
  readonly provider = new ConfigurablePaymentProvider();
  readonly notifier = new RecordingNotifier();
  readonly clock = new FrozenClock(new Date("2026-09-17T09:00:00.000Z"));
  readonly store = new InMemoryStore();
  readonly composition;
  readonly repos: Repositories;
  readonly server: http.Server;
  baseURL = "";

  private constructor() {
    this.composition = composeBilling({
      provider: this.provider,
      clock: this.clock,
      notifier: this.notifier,
      webhookSecret: TEST_WEBHOOK_SECRET,
      store: this.store,
    });
    this.repos = this.composition.repos;
    seedFixtureCustomer(this.repos.customers);
    this.server = http.createServer(this.composition.app);
  }

  static async start(): Promise<BillingFixture> {
    const fixture = new BillingFixture();
    await new Promise<void>((resolve, reject) => {
      fixture.server.once("error", reject);
      fixture.server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = fixture.server.address() as AddressInfo;
    fixture.baseURL = `http://127.0.0.1:${address.port}`;
    return fixture;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

type PlaywrightFixtures = {
  billing: BillingFixture;
  api: BillingApiClient;
};

export const test = base.extend<PlaywrightFixtures>({
  billing: async ({}, use) => {
    const fixture = await BillingFixture.start();
    await use(fixture);
    await fixture.stop();
  },
  api: async ({ playwright, billing }, use) => {
    const context = await playwright.request.newContext({ baseURL: billing.baseURL });
    await use(new BillingApiClient(context));
    await context.dispose();
  },
});

export { expect } from "@playwright/test";
