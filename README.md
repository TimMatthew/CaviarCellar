# Caviar store — payment & delivery policy

The definitive rules for how money and parcels move through the shop. This is
the source of truth; the server code and database schema implement what's
described here. Caviar is a food product, so the model is deliberately simpler
than a general store: **no returns**, which removes return shipments and most
refund handling.

## Delivery

- **Domestic:** Nova Poshta. Every order ships branch-to-branch on Nova Poshta.
- **International:** Nova Poshta Global / NovaPost (or Ukrposhta) for the
  cross-border leg. The payment side is unchanged — a foreign customer pays by
  card through the same Fondy checkout; only the delivery carrier differs.
- **Who pays for delivery:** the **recipient**, in *every* case — prepaid and
  COD alike. On the Nova Poshta waybill this is `PayerType: "Recipient"`. The
  shop never absorbs shipping, and the delivery fee never touches the shop's
  books or database. The customer pays it to Nova Poshta at pickup.

## Payment — two methods, customer's choice

### 1. Prepayment (card, via Fondy)

The customer pays for the goods online before the parcel ships.

- The customer enters card details **on Fondy's hosted checkout page**, never on
  our site. Card number, expiry and CVV never reach our server and are never
  stored anywhere in our system. Our server only creates the payment and
  redirects the customer to Fondy's URL.
- Funds settle to the **shop's business account** (the registered ФОП/ТОВ behind
  the Fondy merchant account) — not to any personal card.
- Payment is proven only by Fondy's **signed server callback**, never by the
  browser redirect. On an `approved` callback the order becomes `paid` and the
  Nova Poshta shipment is created.
- The customer still pays Nova Poshta's delivery fee at the branch on pickup
  (recipient pays delivery).

> **PCI note.** Because all card entry happens on Fondy's PCI-compliant page, the
> shop stays out of PCI-DSS card-handling scope. Never add card-number / CVV
> columns to the database. Never log card data. This is non-negotiable.

### 2. Postpayment (cash-on-delivery, via Nova Poshta)

The customer pays nothing online and settles at the branch.

- At checkout the customer selects an **available Nova Poshta branch** (the UI
  lists real offices via NP's `getCities` / `getWarehouses`; the chosen ref is
  stored on the order's delivery record).
- The shipment goes out as COD: the goods value is attached as Nova Poshta
  post-payment (`BackwardDeliveryData` → `RedeliveryString`).
- **Collection is Nova Poshta's responsibility.** At pickup the customer pays the
  goods value **plus** NP's delivery fee. Nova Poshta collects both, keeps the
  delivery fee, and remits the goods value to the shop (via NovaPay) minus its
  COD commission.
- There is no payment webhook for COD. The "paid" signal is the tracking status
  flipping to *delivered* — the poller detects it and marks the order paid.

## No returns (food / hygiene)

Caviar cannot be returned once shipped, for hygiene and sanitary reasons. There
are therefore **no return shipments and no refund-after-receipt**. The only
money-back situation that can still occur is a parcel the customer never
collects, handled below.

## Refunds — one path only

| Scenario | What happens |
|---|---|
| **Prepaid, not collected** | Parcel auto-returns to the shop. The customer paid the goods value online, so the shop owes a **full Fondy reversal** (`/api/reverse/`). Recorded in the `refund` table. |
| **COD, not collected** | The customer never paid (money is collected only at pickup). **No refund** — the order is simply set to `cancelled`. |
| **Any order, after delivery** | Not possible — food, no returns. |

So refunds only ever apply to **prepaid orders that weren't collected**, they are
always **full** (no partials), and the mechanism is always a **Fondy reversal**.
COD never produces a refund row.

> **ПРРО note.** A refund needs a fiscal return receipt. Fondy auto-creates the
> return receipt when the reversal is done through its portal or API, so the one
> refund path stays tax-compliant without extra work.

## Money units

The database stores money as `int` **UAH** (hryvnias), matching `price_uah` and
`total_price`. Convert only at the integration boundaries:

- **Fondy** expects the amount in **kopiykas** → multiply by 100 when building
  the checkout / reversal request.
- **Nova Poshta** `RedeliveryString` (COD) expects **UAH** → use the value as-is.

## Order & delivery status vocabulary

- `order_t.status`: `pending` → `paid` → (`cancelled` | `refunded`). `paid` is
  set by the Fondy callback (prepaid) or by delivery (COD).
- `delivery.status`: `pending` → `processing` → `shipped` → `in_transit` →
  `delivered`, with `returned` (uncollected parcel bounced back to sender) and
  `cancelled` as exits. Note: in this shop `returned` means *uncollected*, not a
  customer return.

## Security checklist

- All secrets (Fondy key, NP API key, SMTP, admin key) live server-side in
  `.env`, never in frontend JS. Add `.env` and the DB file to `.gitignore`.
- Verify the Fondy callback signature before trusting any payment.
- Prices are computed server-side from the catalogue at checkout — the client
  never dictates the charged amount.
- No card data is ever accepted, logged, or stored by the shop.
