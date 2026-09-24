import { BillingAssertions, SubscriptionBuilder, WebhookBuilder, test, expect } from "../support/index.js";

test.describe("signed webhook processing", () => {
  test("processes a duplicate event exactly once", async ({ api, billing }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await created.json()).id;
    const payload = new WebhookBuilder().forSubscription(id).forInvoice("inv_first").withEventId("evt_duplicate").build();

    const first = await api.webhooks.post(payload);
    const duplicate = await api.webhooks.post(payload);
    expect((await first.json()).outcome).toBe("applied");
    expect((await duplicate.json()).outcome).toBe("duplicate");
    const verify = new BillingAssertions(billing.repos, billing.provider);
    verify.subscriptionStatus(id, "active");
    verify.invoiceCount(id, 1);
    verify.webhookOutcome("evt_duplicate", "applied");
    expect(billing.repos.webhookEvents.count()).toBe(1);
    expect(billing.provider.calls).toHaveLength(0);
  });

  test("ignores a failed webhook that arrives after a successful payment for the same invoice", async ({ api, billing }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await created.json()).id;
    const succeeded = new WebhookBuilder().forSubscription(id).forInvoice("inv_ordered").withEventId("evt_success").build();
    await api.webhooks.post(succeeded);
    const failed = { ...succeeded, event_id: "evt_stale", type: "payment.failed" };
    const response = await api.webhooks.post(failed);

    expect((await response.json()).outcome).toBe("ignored_stale");
    new BillingAssertions(billing.repos, billing.provider).subscriptionStatus(id, "active");
    expect(billing.repos.invoices.findBySubscription(id)).toHaveLength(1);
  });

  test("does not reactivate a canceled subscription from a later webhook", async ({ api, billing }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await created.json()).id;
    await api.cancelSubscription(id);
    const response = await api.webhooks.post(new WebhookBuilder().forSubscription(id).forInvoice("inv_after_cancel").withEventId("evt_after_cancel").build());

    expect((await response.json()).outcome).toBe("ignored_canceled");
    new BillingAssertions(billing.repos, billing.provider).subscriptionStatus(id, "canceled");
    expect(billing.repos.invoices.findBySubscription(id)).toHaveLength(0);
  });

  test("records a refund without changing the subscription lifecycle", async ({ api, billing }) => {
    billing.provider.enqueue("succeeded");
    const created = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const id = (await created.json()).id;
    const invoiceId = billing.repos.invoices.findBySubscription(id)[0]!.id;
    const response = await api.webhooks.post(new WebhookBuilder().forSubscription(id).forInvoice(invoiceId).ofType("payment.refunded").withEventId("evt_refund").withAmount(4900).build());

    expect((await response.json()).outcome).toBe("applied");
    new BillingAssertions(billing.repos, billing.provider).subscriptionStatus(id, "active");
    new BillingAssertions(billing.repos, billing.provider).invoiceStatus(id, "refunded");
  });
});
