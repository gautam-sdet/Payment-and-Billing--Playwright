import { createHmac } from "node:crypto";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { TEST_WEBHOOK_SECRET } from "./constants.js";

export class WebhookSimulator {
  constructor(private readonly request: APIRequestContext) {}

  post(payload: Record<string, unknown>, options: { secret?: string; signature?: string } = {}): Promise<APIResponse> {
    const rawBody = JSON.stringify(payload);
    const signature = options.signature ?? createHmac("sha256", options.secret ?? TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return this.request.post("/webhooks/payment-provider", {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "X-Provider-Signature": signature,
      },
    });
  }

  postRaw(rawBody: string, signature?: string): Promise<APIResponse> {
    return this.request.post("/webhooks/payment-provider", {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        ...(signature ? { "X-Provider-Signature": signature } : {}),
      },
    });
  }
}
