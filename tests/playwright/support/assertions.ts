import { expect } from "@playwright/test";
import type { Repositories } from "../../../src/persistence/repositories.js";
import type { ConfigurablePaymentProvider } from "../../../src/payments/configurable-payment-provider.js";
import type { SubscriptionStatus } from "../../../src/types.js";

export class BillingAssertions {
  constructor(private readonly repos: Repositories, private readonly provider: ConfigurablePaymentProvider) {}

  subscriptionStatus(id: string, status: SubscriptionStatus): void {
    expect(this.repos.subscriptions.get(id)?.status).toBe(status);
  }

  apiMatchesPersistence(id: string, body: { status: string; plan: string; amount: number }): void {
    const row = this.repos.subscriptions.get(id);
    expect(row).toBeDefined();
    expect(row?.status).toBe(body.status);
    expect(row?.planId).toBe(body.plan);
    expect(row?.amount).toBe(body.amount);
  }

  providerCalledTimes(count: number): void { expect(this.provider.calls).toHaveLength(count); }

  lastProviderCharge(expected: { amount: number; customerId: string; paymentMethodId: string }): void {
    const call = this.provider.calls.at(-1);
    expect(call).toMatchObject(expected);
    expect(call?.idempotencyKey).toBeTruthy();
  }

  invoiceCount(subscriptionId: string, count: number): void {
    expect(this.repos.invoices.findBySubscription(subscriptionId)).toHaveLength(count);
  }

  invoiceStatus(subscriptionId: string, status: string): void {
    const invoice = this.repos.invoices.findBySubscription(subscriptionId).at(-1);
    expect(invoice?.status).toBe(status);
  }

  webhookOutcome(eventId: string, outcome: string): void {
    expect(this.repos.webhookEvents.get(eventId)?.outcome).toBe(outcome);
  }
}
