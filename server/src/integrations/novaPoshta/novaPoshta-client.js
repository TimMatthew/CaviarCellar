import { config } from "../../config/index.js";
import { IntegrationError } from "../../domain/errors.js";
import { mapNovaPoshtaStatus } from "./statusMap.js";

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

function ensureConfigured() {
  const required = [
    "apiKey",
    "senderRef",
    "contactSenderRef",
    "senderCityRef",
    "senderAddressRef",
    "senderPhone",
  ];
  const missing = required.filter((key) => !config.novaPoshta[key]);
  if (missing.length) {
    throw new IntegrationError(`Nova Poshta is not configured: ${missing.join(", ")}`);
  }
}

async function call(modelName, calledMethod, methodProperties) {
  if (!config.novaPoshta.apiKey) {
    throw new IntegrationError("Nova Poshta is not configured: apiKey");
  }
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: config.novaPoshta.apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });
  } catch (error) {
    throw new IntegrationError("Nova Poshta request failed", { cause: error.message });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new IntegrationError("Nova Poshta returned invalid JSON", { status: response.status });
  }
  if (!response.ok || !body.success) {
    throw new IntegrationError("Nova Poshta rejected the request", {
      status: response.status,
      errors: body.errors,
      warnings: body.warnings,
    });
  }
  return body.data ?? [];
}

function splitName(fullName) {
  const [lastName = "", firstName = "", ...middle] = fullName.trim().split(/\s+/);
  return { lastName, firstName: firstName || lastName, middleName: middle.join(" ") };
}

function normalizeTracking(item) {
  return {
    ttn: item.Number,
    status: mapNovaPoshtaStatus(item.StatusCode),
    statusCode: item.StatusCode != null ? String(item.StatusCode) : null,
    description: item.Status || null,
    location: item.CityRecipient || item.WarehouseRecipient || null,
    estimatedAt: item.ScheduledDeliveryDate || null,
  };
}

export function buildCodOptions(codAmount) {
  if (codAmount == null) return {};
  return {
    BackwardDeliveryData: [
      {
        PayerType: "Recipient",
        CargoType: "Money",
        RedeliveryString: String(codAmount),
      },
    ],
  };
}

export const novaPoshta = {
  async createShipment({ order, delivery }) {
    ensureConfigured();
    const name = splitName(delivery.recipient_name);
    const counterparties = await call("Counterparty", "save", {
      CounterpartyProperty: "Recipient",
      CounterpartyType: "PrivatePerson",
      FirstName: name.firstName,
      MiddleName: name.middleName,
      LastName: name.lastName,
      Phone: delivery.recipient_phone,
    });
    const recipient = counterparties[0];
    const recipientRef = recipient?.Ref;
    const contactRecipientRef = recipient?.ContactPerson?.data?.[0]?.Ref;
    if (!recipientRef || !contactRecipientRef) {
      throw new IntegrationError("Nova Poshta did not return recipient references");
    }

    const properties = {
      PayerType: "Recipient",
      PaymentMethod: "Cash",
      DateTime: new Date().toLocaleDateString("uk-UA"),
      CargoType: config.novaPoshta.cargoType,
      Weight: String(Math.max(0.1, config.novaPoshta.defaultWeightKg)),
      ServiceType: config.novaPoshta.serviceType,
      SeatsAmount: "1",
      Description: `Caviar Cellar order ${order.order_id}`,
      Cost: String(order.total_price),
      CitySender: config.novaPoshta.senderCityRef,
      Sender: config.novaPoshta.senderRef,
      SenderAddress: config.novaPoshta.senderAddressRef,
      ContactSender: config.novaPoshta.contactSenderRef,
      SendersPhone: config.novaPoshta.senderPhone,
      CityRecipient: delivery.recipient_city_ref,
      Recipient: recipientRef,
      RecipientAddress: delivery.recipient_warehouse_ref,
      ContactRecipient: contactRecipientRef,
      RecipientsPhone: delivery.recipient_phone,
    };
    // Nova Poshta COD is a backward money delivery. Do not combine this with
    // AfterpaymentOnGoodsCost: this project's policy uses RedeliveryString in UAH.
    Object.assign(properties, buildCodOptions(delivery.cod_amount));

    const data = await call("InternetDocument", "save", properties);
    const shipment = data[0];
    if (!shipment?.IntDocNumber) {
      throw new IntegrationError("Nova Poshta did not return a tracking number");
    }
    return {
      ttn: String(shipment.IntDocNumber),
      estimatedAt: shipment.EstimatedDeliveryDate || null,
    };
  },

  async track(ttn, phone) {
    const [result] = await this.trackMany([{ ttn, phone }]);
    return result ?? null;
  },

  async trackMany(documents) {
    if (!documents.length) return [];
    const data = await call("TrackingDocument", "getStatusDocuments", {
      Documents: documents.map(({ ttn, phone }) => ({ DocumentNumber: ttn, Phone: phone })),
    });
    return data.map(normalizeTracking);
  },

  labelUrl(ttn) {
    if (!config.novaPoshta.apiKey) throw new IntegrationError("Nova Poshta is not configured: apiKey");
    return `https://my.novaposhta.ua/orders/printDocument/orders[]/${encodeURIComponent(ttn)}/type/pdf/apiKey/${encodeURIComponent(config.novaPoshta.apiKey)}`;
  },
};
