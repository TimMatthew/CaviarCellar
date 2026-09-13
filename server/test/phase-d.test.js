import test from "node:test";
import assert from "node:assert/strict";

import {
  assertDeliveryTransition,
  DELIVERY_STATUSES,
} from "../src/domain/deliveryStateMachine.js";
import { mapNovaPoshtaStatus } from "../src/integrations/novaPoshta/statusMap.js";
import { toDeliveryDto } from "../src/http/dto/delivery-dto.js";
import {
  createDegustationSchema,
  degustationAvailabilitySchema,
  listDegustationSchema,
} from "../src/http/validators/degustation-schema.js";
import { isDegustationSlot } from "../src/domain/degustationSchedule.js";
import { registerAdminSchema } from "../src/http/validators/auth-schema.js";
import { validate } from "../src/http/middleware/validate.js";
import { deliveryDestinationSchema } from "../src/http/validators/delivery-schema.js";
import { buildCodOptions } from "../src/integrations/novaPoshta/novaPoshta-client.js";
import { deliveryRepo } from "../src/reps/delivery-repo.js";
// ==============================================================================
// FONDY USD TEST CONVERSION
import {
  calculateFondyPaymentTerms,
  fondyCallbackIssues,
} from "../src/integrations/fondy/fondy-payment-terms.js";
// ==============================================================================

test("delivery state machine accepts progress and suppresses unchanged status", () => {
  assert.equal(assertDeliveryTransition("pending", "processing"), true);
  assert.equal(assertDeliveryTransition("in_transit", "in_transit"), false);
  assert.deepEqual(DELIVERY_STATUSES, [
    "pending",
    "processing",
    "shipped",
    "in_transit",
    "delivered",
    "returned",
    "cancelled",
  ]);
});

test("delivery state machine rejects terminal and backward transitions", () => {
  assert.throws(() => assertDeliveryTransition("delivered", "in_transit"), {
    name: "ConflictError",
  });
  assert.throws(() => assertDeliveryTransition("unknown", "shipped"), {
    name: "ValidationError",
  });
});

test("Nova Poshta status codes normalize to application states", () => {
  assert.equal(mapNovaPoshtaStatus("1"), "processing");
  assert.equal(mapNovaPoshtaStatus(4), "shipped");
  assert.equal(mapNovaPoshtaStatus("7"), "in_transit");
  assert.equal(mapNovaPoshtaStatus("9"), "delivered");
  assert.equal(mapNovaPoshtaStatus("103"), "returned");
  assert.equal(mapNovaPoshtaStatus("unrecognized"), "processing");
});

test("delivery DTO hides database column names and maps events", () => {
  const dto = toDeliveryDto(
    {
      delivery_id: "8",
      order_id: "4",
      carrier: "nova_poshta",
      ttn: "20450000000000",
      status: "in_transit",
      recipient_name: "Test Customer",
      recipient_phone: "380501234567",
      recipient_city_ref: "city-ref",
      recipient_warehouse_ref: "warehouse-ref",
      cod_amount: 1200,
      estimated_at: null,
      shipped_at: null,
      delivered_at: null,
      created_at: "created",
      updated_at: "updated",
    },
    [
      {
        event_id: "9",
        status: "in_transit",
        np_status_code: "7",
        description: "At branch",
        location_t: "Kyiv",
        created_at: "event-created",
      },
    ]
  );
  assert.equal(dto.id, 8);
  assert.equal(dto.orderId, 4);
  assert.equal(dto.recipient.phone, "380501234567");
  assert.equal(dto.events[0].carrierStatusCode, "7");
  assert.equal(Object.hasOwn(dto, "delivery_id"), false);
});

test("degustation validation requires a future date and normalized phone", () => {
  const valid = createDegustationSchema.safeParse({
    customer: {
      name: "Customer",
      phone: "380501234567",
      email: "customer@example.com",
    },
    date: new Date(Date.now() + 60_000).toISOString(),
    guestsAmount: 2,
  });
  assert.equal(valid.success, true);

  const invalid = createDegustationSchema.safeParse({
    customer: { name: "Customer", phone: "0501234567" },
    date: new Date(Date.now() - 60_000).toISOString(),
    guestsAmount: 0,
  });
  assert.equal(invalid.success, false);
});

test("degustation availability accepts a bounded valid date range", () => {
  assert.equal(
    degustationAvailabilitySchema.safeParse({
      from: "2026-08-01",
      to: "2026-08-31",
    }).success,
    true
  );
  assert.equal(
    degustationAvailabilitySchema.safeParse({
      from: "2026-08-31",
      to: "2026-08-01",
    }).success,
    false
  );
  assert.equal(
    degustationAvailabilitySchema.safeParse({
      from: "2026-02-30",
      to: "2026-03-01",
    }).success,
    false
  );
});

test("degustation schedule uses 20-minute Kyiv slots from 10:00 through 20:40", () => {
  assert.equal(isDegustationSlot("2026-08-10T07:00:00.000Z"), true);
  assert.equal(isDegustationSlot("2026-08-10T17:40:00.000Z"), true);
  assert.equal(isDegustationSlot("2026-08-10T07:10:00.000Z"), false);
  assert.equal(isDegustationSlot("2026-08-10T18:00:00.000Z"), false);
});

test("administrator registration enforces username and password rules", () => {
  assert.equal(
    registerAdminSchema.safeParse({
      name: "Store Administrator",
      username: "store.admin",
      password: "a-secure-password",
    }).success,
    true
  );
  assert.equal(
    registerAdminSchema.safeParse({
      name: "Admin",
      username: "bad username",
      password: "short",
    }).success,
    false
  );
});

test("query validation supports the getter-only req.query used by Express 5", () => {
  const prototype = {};
  Object.defineProperty(prototype, "query", {
    get: () => ({ limit: "25", offset: "2" }),
  });
  const req = Object.create(prototype);
  let error;
  validate(listDegustationSchema, "query")(req, {}, (value) => {
    error = value;
  });
  assert.equal(error, undefined);
  assert.deepEqual(req.query, { limit: 25, offset: 2 });
  assert.equal(Object.hasOwn(req, "query"), true);
});

test("delivery validation accepts Latin or Cyrillic names and rejects mixed scripts", () => {
  const destination = {
    recipientPhone: "380501234568",
    cityRef: "11111111-1111-4111-8111-111111111111",
    warehouseRef: "22222222-2222-4222-8222-222222222222",
  };
  assert.equal(
    deliveryDestinationSchema.safeParse({
      ...destination,
      recipientName: "Коваленко Олена",
    }).success,
    true
  );
  assert.equal(
    deliveryDestinationSchema.safeParse({
      ...destination,
      recipientName: "Kovalenko Olena",
    }).success,
    true
  );
  assert.equal(
    deliveryDestinationSchema.safeParse({
      ...destination,
      recipientName: "Коваленко О.",
    }).success,
    false
  );
  assert.equal(
    deliveryDestinationSchema.safeParse({
      ...destination,
      recipientName: "Коваленко Olena",
    }).success,
    false
  );
});

test("Nova Poshta COD uses backward money delivery, not afterpayment", () => {
  const options = buildCodOptions(1599);
  assert.equal(Object.hasOwn(options, "AfterpaymentOnGoodsCost"), false);
  assert.deepEqual(options.BackwardDeliveryData, [
    {
      PayerType: "Recipient",
      CargoType: "Money",
      RedeliveryString: "1599",
    },
  ]);
  assert.deepEqual(buildCodOptions(null), {});
});

test("failed fulfillment cleanup can remove only a delivery without a TTN", async () => {
  let statement;
  let values;
  const exec = {
    async query(sql, params) {
      statement = sql;
      values = params;
      return { rows: [] };
    },
  };

  await deliveryRepo.deleteUnfulfilled(14, exec);

  assert.match(statement, /DELETE FROM delivery/);
  assert.match(statement, /ttn IS NULL/);
  assert.deepEqual(values, [14]);
});

// ==============================================================================
// FONDY USD TEST CONVERSION
test("Fondy test payment converts 2599 UAH to 6498 USD cents at 40 UAH/USD", () => {
  assert.deepEqual(
    calculateFondyPaymentTerms(2599, {
      useUsdTestCurrency: true,
      uahPerUsd: 40,
    }),
    { currency: "USD", amountMinor: 6498 }
  );
});

test("Fondy payment keeps production/default UAH in kopiykas", () => {
  assert.deepEqual(calculateFondyPaymentTerms(2599), {
    currency: "UAH",
    amountMinor: 259900,
  });
});

test("Fondy callback must match the stored mock USD terms", () => {
  const callback = {
    merchantId: "1396424",
    responseStatus: "success",
    transactionType: "purchase",
    currency: "USD",
    amountMinor: "6498",
    fondyPaymentId: "805243692",
  };
  const order = { fondy_currency: "USD", fondy_amount_minor: 6498 };

  assert.deepEqual(fondyCallbackIssues(callback, order, "1396424"), []);
  assert.deepEqual(
    fondyCallbackIssues({ ...callback, amountMinor: "6497" }, order, "1396424"),
    ["amount"]
  );
});
// ==============================================================================
