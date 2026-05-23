# HaloPSA → 24SevenOffice integrations (n8n)

n8n workflows that sync billing data from **HaloPSA** to **24SevenOffice**
(Finago). Import the JSON files in this folder into your n8n instance
(*Workflows → Import from File*).

## Workflows

| File | What it does | Status |
| ---- | ------------ | ------ |
| `halopsa-to-24sevenoffice-invoice-sync.json` | On a Halo invoice webhook: fetch the invoice + client, upsert the customer in 24SO by org number, create a sales order with line items, then issue it as an invoice. | Built |
| Payment status 24SO → Halo | When an invoice is paid in 24SO, mark it paid in Halo. | Not built yet |
| Customer Halo → Finago (standalone) | When a client is created in Halo, create it in 24SO if the org number isn't already there. | Not built yet (the invoice flow already upserts the customer as part of its run) |

---

## Invoice sync — flow

```
Halo Invoice Webhook
  → Config                     (base URLs + tunables, no secrets)
  → Get Halo Invoice           GET  /api/Invoice/{id}
  → Get Halo Client            GET  /api/Client/{client_id}
  → Normalize Customer         (map Halo client → neutral shape)
  → Find 24SO Customer         GET  /customers?<orgNumberQueryParam>=<org>
  → Match Org Number           (filter result by org number in code)
  → Customer Exists?  ── yes ─→ Use Existing Customer
                      └─ no  ─→ Create 24SO Customer → Set New CustomerId
  → Create Sales Order         POST /salesOrders            (status Draft)
  → Build Lines                (map Halo lines → 24SO lines)
  → Add Order Lines            POST /salesOrders/{id}/lines
  → Issue Invoice              PATCH /salesOrders/{id}       (status Invoice)
  → Write Back 24SO Ref        POST /api/Invoice  [DISABLED by default]
  → Respond OK
```

The customer is upserted **by organization number**: we search 24SO, and only
create a new customer when no existing one matches. Matching is done in code
(`Match Org Number`) so a wrong/ignored search query parameter cannot produce a
false "no match".

---

## Setup

### 1. Credentials (no secrets live in the workflow JSON)

Create two **OAuth2 API** credentials in n8n (*Credentials → New →
OAuth2 API*), grant type **Client Credentials**. The nodes reference them by
the names below.

**HaloPSA OAuth2 (client credentials)**
- Grant Type: `Client Credentials`
- Access Token URL: `https://YOUR-TENANT.halopsa.com/auth/token`
  (self-hosted: append `?tenant=YOUR-TENANT`)
- Client ID / Client Secret: from Halo *Configuration → Integrations → API*
- Scope: `all` (or granular `read:customers edit:invoices …`)
- Auth: send credentials *in body*

**24SevenOffice OAuth2 (client credentials)**
- Grant Type: `Client Credentials`
- Access Token URL: `https://login.24sevenoffice.com/oauth/token`
- Client ID / Client Secret: from the 24SO Developer Admin Panel
- Scope: as defined for your app
- 24SO also needs `audience=https://api.24sevenoffice.com` and
  `login_organization=<your Organization ID>` on the token request. If your
  n8n OAuth2 credential UI has no field for extra body params, append them as
  query params to the Access Token URL:
  `https://login.24sevenoffice.com/oauth/token?audience=https://api.24sevenoffice.com&login_organization=<ORG_ID>`
  — **verify your server accepts them as query params**; if not, replace the
  generic credential with an explicit "Get token" HTTP Request node.

### 2. Config node

Edit the **Config** node (no secrets here, safe to commit):

- `haloApiBase` → `https://YOUR-TENANT.halopsa.com/api`
- `twentyFourApiBase` → `https://rest.api.24sevenoffice.com/v1`
- `orgNumberQueryParam` → the 24SO customer-search query param for org number
- `defaultTaxCode` → fallback MVA/VAT code (see `GET /taxes` in 24SO)
- `defaultCountry` → fallback country code

### 3. Halo webhook

In Halo: *Configuration → Integrations → Webhooks → New*.
- Payload URL: the Production URL of the **Halo Invoice Webhook** node
- Method: `POST`
- Event: invoice created/posted
- Payload must include the invoice id as `{ "id": <invoiceId> }` (the
  `Get Halo Invoice` node reads `body.id`).

> Native outbound webhooks on *invoice* creation could not be confirmed for all
> Halo versions. If your tenant can't fire one, replace the Webhook node with a
> **Schedule Trigger** that polls `GET /api/Invoice` for new/changed invoices.

---

## ⚠️ Field names you MUST verify before going live

These were **not** verifiable from public docs/libraries and are best-effort
guesses. Each is isolated in a Code node or the Config node so it's a one-line
change. Confirm against your own instances' Swagger and adjust:

| Where | Assumption to check |
| ----- | ------------------- |
| `Normalize Customer` | Halo client org/VAT field (`taxnumber` / `accountsid` / …) |
| `Find 24SO Customer` + `Match Org Number` | 24SO customer org-number field & search param (`corporateId`, …) |
| `Create 24SO Customer` | 24SO customer create body shape (`name`, `corporateId`, `invoiceAddress`, …) |
| `Create Sales Order` | 24SO order body (`customerId`, `currency`, `orderDate`, `dueDate`) and the id field in its response |
| `Build Lines` | Halo line fields (`unitprice`, `quantity`, `taxcode`, …) and 24SO line shape |
| `Add Order Lines` | Whether `POST /salesOrders/{id}/lines` accepts an **array** (current) or one line per request (then loop with a Split node) |
| `Issue Invoice` | That `PATCH /salesOrders/{id}` with `status: "Invoice"` issues it |
| `Write Back 24SO Ref to Halo` | The Halo field for storing the external order id (`thirdpartyid`?). **Disabled by default** so it can't corrupt Halo data — enable once confirmed |

## Notes & limits

- **Idempotency:** customers are deduped by org number. Invoices are not — if
  Halo fires the webhook twice you may create two sales orders. Enabling the
  write-back node + checking for an existing 24SO ref before creating is the
  way to harden this.
- **Payment status:** the original brief also asked for paid-status sync back to
  Halo and a standalone customer-creation sync. Those are listed as *not built
  yet* above and can be added as separate workflows.
- **Errors:** attach an Error Workflow in the workflow settings (the dashboard
  in this repo already exposes an error webhook at `/api/errors`).
