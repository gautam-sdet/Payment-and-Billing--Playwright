import { createHmac } from "node:crypto";
import { BillingAssertions, CUSTOMER_ID, PAYMENT_METHOD_ID, SubscriptionBuilder, test, expect } from "../support/index.js";

test.describe("API contract and request validation", () => {
  test("creates and retrieves a pro subscription with the persisted response shape", async ({ api, billing }) => {
    const response = await api.createSubscription(new SubscriptionBuilder().forPlan("pro").build());
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ customer_id: CUSTOMER_ID, plan: "pro", status: "active", amount: 4900, currency: "USD" });

    const retrieved = await api.getSubscription(body.id);
    expect(retrieved.status()).toBe(200);
    expect(await retrieved.json()).toEqual(body);
    new BillingAssertions(billing.repos, billing.provider).apiMatchesPersistence(body.id, body);
  });

  for (const scenario of [
    { name: "unknown plan", body: new SubscriptionBuilder().forPlan("gold" as "basic").build(), error: "unknown_plan" },
    { name: "unknown customer", body: new SubscriptionBuilder().forCustomer("cust_missing").build(), error: "unknown_customer" },
    { name: "invalid payment method", body: new SubscriptionBuilder().withPaymentMethod("card_4242").build(), error: "invalid_payment_method" },
  ]) {
    test(`rejects ${scenario.name} without provider calls`, async ({ api, billing }) => {
      const response = await api.createSubscription(scenario.body);
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe(scenario.error);
      expect(billing.repos.subscriptions.list()).toHaveLength(0);
      expect(billing.provider.calls).toHaveLength(0);
    });
  }

  test("rejects a second cancellation", async ({ api }) => {
    const created = await api.createSubscription(new SubscriptionBuilder().build());
    const id = (await created.json()).id;
    expect((await api.cancelSubscription(id)).status()).toBe(200);
    const second = await api.cancelSubscription(id);
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toBe("already_canceled");
  });

  test("separates forged signatures from malformed signed webhook bodies", async ({ api }) => {
    const forged = await api.webhooks.post({ event_id: "evt_forged", type: "payment.succeeded", subscription_id: "sub_missing", invoice_id: "inv_forged", amount: 900, currency: "USD" }, { signature: "forged" });
    expect(forged.status()).toBe(401);

    const raw = "{not-json";
    const signature = createHmac("sha256", "whsec_test_assignment").update(raw).digest("hex");
    const malformed = await api.webhooks.postRaw(raw, signature);
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).error).toBe("malformed_json");
  });

  test("rejects a webhook with a valid signature but invalid payload", async ({ api }) => {
    const response = await api.webhooks.post({ event_id: "evt_invalid", type: "payment.succeeded" });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("malformed_payload");
  });
});
