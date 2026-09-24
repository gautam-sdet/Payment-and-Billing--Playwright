import { BillingAssertions, SubscriptionBuilder, test, expect } from "../support/index.js";

test.describe("provider interaction and persistence invariants", () => {
  test("passes exact billing arguments to the provider and persists a coherent payment", async ({ api, billing }) => {
    const response = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const body = await response.json();
    const verify = new BillingAssertions(billing.repos, billing.provider);
    verify.providerCalledTimes(1);
    verify.lastProviderCharge({ amount: 4900, customerId: "cust_001", paymentMethodId: "pm_test_visa_4242" });
    verify.apiMatchesPersistence(body.id, body);
    verify.invoiceStatus(body.id, "paid");
    expect(billing.repos.audit.forSubscription(body.id).map((entry) => entry.action)).toContain("lifecycle.CHARGE_SUCCEEDED");
  });

  test("records timeout as a failed billing attempt without inventing a successful payment", async ({ api, billing }) => {
    billing.provider.enqueue("timeout");
    const response = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const body = await response.json();

    expect(body.status).toBe("past_due");
    const verify = new BillingAssertions(billing.repos, billing.provider);
    verify.providerCalledTimes(1);
    verify.invoiceStatus(body.id, "failed");
    expect(billing.repos.invoices.findBySubscription(body.id).some((invoice) => invoice.status === "paid")).toBe(false);
  });

  test("does not call the provider for a trial subscription or replayed webhook", async ({ api, billing }) => {
    const response = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await response.json()).id;
    expect(billing.provider.calls).toHaveLength(0);
    const payload = { event_id: "evt_replay", type: "payment.succeeded", subscription_id: id, invoice_id: "inv_replay", amount: 900, currency: "USD" };
    await api.webhooks.post(payload);
    await api.webhooks.post(payload);
    expect(billing.provider.calls).toHaveLength(0);
    expect(billing.repos.invoices.findBySubscription(id)).toHaveLength(1);
  });
});
