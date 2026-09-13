import { config } from "../../config/index.js";
import { fondySignature } from "./fondy-signature.js";
import {
  fondyCallbackIssues,
  fondyPaymentTermsForOrder,
} from "./fondy-payment-terms.js";
import { IntegrationError, PaymentError } from "../../domain/errors.js";

const CHECKOUT_URL = "https://pay.fondy.eu/api/checkout/url/";
const REVERSE_URL = "https://pay.fondy.eu/api/reverse/order_id/";

function ensureConfigured() {
  if (!config.fondy.merchantId || !config.fondy.secretKey) {
    throw new IntegrationError(
      "Fondy is not configured (set FONDY_MERCHANT_ID and FONDY_SECRET_KEY)"
    );
  }
}

export const fondy = {
  // Create a hosted checkout for an order; returns the pay URL and the order id
  // we sent Fondy (stored so a later reversal/reconciliation can find it).
  // Amount converts UAH -> kopiykas here (Fondy's unit) — the only place we do.
  async createCheckout(order) {
    ensureConfigured();

    // ============================================================================
    // FONDY USD TEST CONVERSION
    const paymentTerms = fondyPaymentTermsForOrder(order);
    // ============================================================================

    const request = {
      order_id: `order-${order.order_id}-${Date.now()}`,
      merchant_id: config.fondy.merchantId,
      order_desc: `Замовлення №${order.order_id}`,
      // ============================================================================
      // FONDY USD TEST CONVERSION
      amount: String(paymentTerms.amountMinor),
      currency: paymentTerms.currency,
      // ============================================================================
      server_callback_url: `${config.server.baseUrl}/api/payments/fondy/callback`,
      response_url: config.fondy.returnUrl || config.server.baseUrl,
    };
    request.signature = fondySignature(request, config.fondy.secretKey);

    let json;
    try {
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request }),
      });
      json = await res.json();
    } catch (err) {
      throw new IntegrationError("Fondy request failed", { cause: err.message });
    }

    const r = json.response;
    if (r?.response_status !== "success" || !r?.checkout_url) {
      throw new PaymentError("Fondy checkout creation failed", { error: r?.error_message });
    }
    // ============================================================================
    // FONDY USD TEST CONVERSION
    // Persist these exact terms; callbacks and refunds must never recalculate them
    // using a possibly changed test exchange rate.
    return {
      checkoutUrl: r.checkout_url,
      fondyOrderRef: request.order_id,
      fondyCurrency: paymentTerms.currency,
      fondyAmountMinor: paymentTerms.amountMinor,
    };
    // ============================================================================
  },

  // Verify a server callback. This — not the browser redirect — is the proof of
  // payment. Returns whether the signature is valid and the payment approved.
  verifyCallback(body) {
    ensureConfigured();
    const expected = fondySignature(body, config.fondy.secretKey);
    const valid = body.signature === expected;
    return {
      valid,
      approved: valid && body.order_status === "approved",
      fondyOrderRef: body.order_id,
      fondyPaymentId: body.payment_id != null ? String(body.payment_id) : null,
      // ============================================================================
      // FONDY USD TEST CONVERSION
      // Retain the signed provider terms so the controller can compare them with
      // the exact USD/UAH values stored when checkout was created.
      merchantId: body.merchant_id,
      responseStatus: body.response_status,
      transactionType: body.tran_type,
      currency: body.currency,
      amountMinor: body.amount,
      // ============================================================================
    };
  },

  // ==============================================================================
  // FONDY USD TEST CONVERSION
  callbackIssuesForOrder(callback, order) {
    return fondyCallbackIssues(callback, order, config.fondy.merchantId);
  },
  // ==============================================================================

  async reverse(order) {
    ensureConfigured();
    // ============================================================================
    // FONDY USD TEST CONVERSION
    const paymentTerms = fondyPaymentTermsForOrder(order);
    // ============================================================================
    const request = {
      order_id: order.fondy_order_ref,
      merchant_id: config.fondy.merchantId,
      // ============================================================================
      // FONDY USD TEST CONVERSION
      amount: String(paymentTerms.amountMinor),
      currency: paymentTerms.currency,
      // ============================================================================
    };
    request.signature = fondySignature(request, config.fondy.secretKey);
    let json;
    try {
      const response = await fetch(REVERSE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request }),
      });
      json = await response.json();
    } catch (error) {
      throw new IntegrationError("Fondy reversal request failed", { cause: error.message });
    }
    const result = json.response;
    if (result?.response_status !== "success") {
      throw new PaymentError("Fondy reversal failed", { error: result?.error_message });
    }
    return {
      reverseRef: String(result.reverse_id ?? result.payment_id ?? order.fondy_payment_id),
    };
  },
};
