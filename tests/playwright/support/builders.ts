import type { WebhookEventType } from "../../../src/types.js";
import { CUSTOMER_ID, PAYMENT_METHOD_ID, PLAN_AMOUNTS } from "./constants.js";

export class SubscriptionBuilder {
  private body: Record<string, unknown> = {
    customer_id: CUSTOMER_ID,
    plan: "basic",
    payment_method_id: PAYMENT_METHOD_ID,
  };

  forPlan(plan: "basic" | "pro"): this {
    this.body.plan = plan;
    return this;
  }

  forCustomer(customerId: string): this {
    this.body.customer_id = customerId;
    return this;
  }

  withPaymentMethod(paymentMethodId: string): this {
    this.body.payment_method_id = paymentMethodId;
    return this;
  }

  build(): Record<string, unknown> {
    return { ...this.body };
  }
}

export class WebhookBuilder {
  private payload: Record<string, unknown> = {
    event_id: "evt_test_001",
    type: "payment.succeeded" as WebhookEventType,
    subscription_id: "sub_unknown",
    invoice_id: "inv_test_001",
    amount: PLAN_AMOUNTS.basic,
    currency: "USD",
  };

  withEventId(eventId: string): this { this.payload.event_id = eventId; return this; }
  forSubscription(subscriptionId: string): this { this.payload.subscription_id = subscriptionId; return this; }
  forInvoice(invoiceId: string): this { this.payload.invoice_id = invoiceId; return this; }
  ofType(type: WebhookEventType): this { this.payload.type = type; return this; }
  withAmount(amount: number): this { this.payload.amount = amount; return this; }
  build(): Record<string, unknown> { return { ...this.payload }; }
}
