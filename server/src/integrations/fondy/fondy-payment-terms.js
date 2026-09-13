import { config } from "../../config/index.js";
import { PaymentError } from "../../domain/errors.js";

// ==============================================================================
// FONDY USD TEST CONVERSION
//
// Orders and catalogue prices always stay in UAH. In development/test only, this
// converts the UAH total to USD cents using a fixed mock rate for Fondy's public
// test merchant. Example: 2599 UAH / 40 * 100 = 6497.5 -> 6498 USD cents.
// ==============================================================================
export function calculateFondyPaymentTerms(
  totalUah,
  { useUsdTestCurrency = false, uahPerUsd = 40 } = {}
) {
  const normalizedTotal = Number(totalUah);
  const normalizedRate = Number(uahPerUsd);

  if (!Number.isInteger(normalizedTotal) || normalizedTotal <= 0) {
    throw new PaymentError("Fondy order total must be a positive whole UAH amount");
  }

  if (!useUsdTestCurrency) {
    return { currency: "UAH", amountMinor: normalizedTotal * 100 };
  }

  if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) {
    throw new PaymentError("FONDY_TEST_UAH_PER_USD must be a positive number");
  }

  // Multiply into minor units before division to avoid 6497.499999... floating
  // point drift for the documented 2599 / 40 example.
  const amountMinor = Math.round((normalizedTotal * 100) / normalizedRate);
  if (amountMinor <= 0) {
    throw new PaymentError("Converted Fondy test amount must be at least one cent");
  }

  return { currency: "USD", amountMinor };
}

export function fondyPaymentTermsForOrder(order) {
  if (order.fondy_currency && order.fondy_amount_minor != null) {
    return {
      currency: String(order.fondy_currency),
      amountMinor: Number(order.fondy_amount_minor),
    };
  }

  return calculateFondyPaymentTerms(order.total_price, {
    useUsdTestCurrency: config.fondy.useUsdTestCurrency,
    uahPerUsd: config.fondy.uahPerUsd,
  });
}

export function fondyCallbackIssues(callback, order, expectedMerchantId) {
  const issues = [];
  if (String(callback.merchantId) !== String(expectedMerchantId)) issues.push("merchant_id");
  if (callback.responseStatus !== "success") issues.push("response_status");
  if (callback.transactionType !== "purchase") issues.push("tran_type");
  if (callback.currency !== order.fondy_currency) issues.push("currency");
  if (Number(callback.amountMinor) !== Number(order.fondy_amount_minor)) issues.push("amount");
  if (!callback.fondyPaymentId) issues.push("payment_id");
  return issues;
}
// ==============================================================================
