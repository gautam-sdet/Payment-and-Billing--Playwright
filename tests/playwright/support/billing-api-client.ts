import type { APIRequestContext, APIResponse } from "@playwright/test";
import { WebhookSimulator } from "./webhook-simulator.js";

export class BillingApiClient {
  readonly webhooks: WebhookSimulator;

  constructor(private readonly request: APIRequestContext) {
    this.webhooks = new WebhookSimulator(request);
  }

  createSubscription(body: unknown): Promise<APIResponse> {
    return this.request.post("/subscriptions", { data: body });
  }

  getSubscription(id: string): Promise<APIResponse> {
    return this.request.get(`/subscriptions/${id}`);
  }

  cancelSubscription(id: string): Promise<APIResponse> {
    return this.request.post(`/subscriptions/${id}/cancel`);
  }

  runBillingCycle(id: string): Promise<APIResponse> {
    return this.request.post(`/subscriptions/${id}/billing-cycle`);
  }
}
