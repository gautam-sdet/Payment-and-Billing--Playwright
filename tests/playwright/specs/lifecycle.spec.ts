import { BillingAssertions, SubscriptionBuilder, test, expect } from "../support/index.js";

test.describe("subscription lifecycle", () => {
  test("moves trialing to active after the first successful charge", async ({ api, billing }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().forPlan("basic").build());
    const id = (await created.json()).id;
    expect((await api.getSubscription(id)).status()).toBe(200);
    billing.provider.enqueue("succeeded");

    const billed = await api.runBillingCycle(id);
    expect(billed.status()).toBe(200);
    expect((await billed.json()).status).toBe("active");
    const verify = new BillingAssertions(billing.repos, billing.provider);
    verify.subscriptionStatus(id, "active");
    verify.invoiceStatus(id, "paid");
    verify.providerCalledTimes(1);
  });

  test("moves trialing to past_due after a declined first charge", async ({ api, billing }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await created.json()).id;
    billing.provider.enqueue("declined");
    const billed = await api.runBillingCycle(id);

    expect((await billed.json()).status).toBe("past_due");
    const verify = new BillingAssertions(billing.repos, billing.provider);
    verify.subscriptionStatus(id, "past_due");
    verify.invoiceStatus(id, "failed");
    verify.providerCalledTimes(1);
  });

  test("moves active to past_due and back to active on retry success", async ({ api, billing }) => {
    billing.provider.enqueue("succeeded");
    const created = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const id = (await created.json()).id;
    billing.provider.enqueue("declined", "succeeded");

    expect((await (await api.runBillingCycle(id)).json()).status).toBe("past_due");
    expect((await (await api.runBillingCycle(id)).json()).status).toBe("active");
    new BillingAssertions(billing.repos, billing.provider).subscriptionStatus(id, "active");
    expect(billing.repos.subscriptions.get(id)?.failedAttempts).toBe(0);
  });

  test("cancels after three failed attempts and keeps canceled terminal", async ({ api, billing }) => {
    billing.provider.enqueue("succeeded");
    const created = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const id = (await created.json()).id;
    billing.provider.enqueue("declined", "declined", "declined");

    expect((await (await api.runBillingCycle(id)).json()).status).toBe("past_due");
    expect((await (await api.runBillingCycle(id)).json()).status).toBe("past_due");
    expect((await (await api.runBillingCycle(id)).json()).status).toBe("canceled");
    const afterCancel = await api.runBillingCycle(id);
    expect(afterCancel.status()).toBe(409);
    new BillingAssertions(billing.repos, billing.provider).subscriptionStatus(id, "canceled");
    expect(billing.repos.invoices.findBySubscription(id)).toHaveLength(4);
  });

  test("cancels trialing and active subscriptions through the API", async ({ api, billing }) => {
    const trial = await api.createSubscription(new SubscriptionBuilder().build());
    const trialId = (await trial.json()).id;
    expect((await api.cancelSubscription(trialId)).status()).toBe(200);
    expect((await api.getSubscription(trialId).then((response) => response.json())).status).toBe("canceled");

    billing.provider.enqueue("succeeded");
    const active = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    const activeId = (await active.json()).id;
    expect((await api.cancelSubscription(activeId)).status()).toBe(200);
    expect((await api.getSubscription(activeId).then((response) => response.json())).status).toBe("canceled");
  });
});
