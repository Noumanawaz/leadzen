# WhatsApp Business Platform Integration

This project integrates the official **Meta WhatsApp Cloud API** with **Embedded Signup** so each tenant connects their own WhatsApp Business Account (WABA) and phone number.

## Architecture

- Tenant credentials live in `connected_accounts` (`provider = meta_whatsapp`)
- Access tokens are encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256-GCM)
- Outbound messages go through the backend only — the browser never receives tenant tokens
- Inbound messages and delivery statuses arrive at `POST /api/webhooks/whatsapp`
- Tenants connect via **Connect WhatsApp** in Settings → Integrations (Meta Embedded Signup only)

## 1. Create a Meta app

1. Go to [Meta for Developers](https://developers.facebook.com/) and create an app.
2. Add the **WhatsApp** product.
3. Configure **Facebook Login for Business** → **Embedded Signup** and note the **Configuration ID**.
4. Add required permissions for production (App Review):
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`

## 2. Environment variables

### Backend (`backend/.env`) — our Meta app only

```env
# OUR META APP (server-only — never tenant-scoped)
META_APP_ID=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_CONFIG_ID=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v22.0

# TENANT WhatsApp tokens → connected_accounts.encrypted_credentials only
TOKEN_ENCRYPTION_KEY=
```

Tenant-specific access tokens are stored encrypted per organization in the database. Never put tenant tokens in environment variables.

## 3. Webhook setup

**Callback URL:** `https://YOUR_API_HOST/api/webhooks/whatsapp`

**Verify token:** same value as `META_WEBHOOK_VERIFY_TOKEN`

Subscribe to:

- `messages`

### Local development

Use a tunnel (ngrok, Cloudflare Tunnel, etc.) pointing to port `4000`:

```bash
ngrok http 4000
```

Register the HTTPS URL in the Meta app webhook settings.

## 4. Tenant connect flow

1. User opens **Settings → Integrations**
2. Clicks **Connect WhatsApp**
3. Completes Meta Embedded Signup (official Meta dialog)
4. Frontend sends OAuth `code` + verified asset IDs to `POST /api/v1/integrations/whatsapp/connect/complete`
5. Backend exchanges the code, verifies WABA/phone with Meta Graph API, encrypts the token, and stores the integration

Manual token entry is **not available** in the tenant UI. Legacy manual connections (if any) continue until expired, then require Embedded Signup reconnect.

## 5. Sending messages

Agents send from the lead **Contact** sheet or via **Sequences** (WhatsApp channel).

- Text messages use the Cloud API messages endpoint
- HTTP success means accepted by Meta — final delivery comes via webhook (`sent`, `delivered`, `read`, `failed`)
- Outside the 24-hour customer care window, use approved templates

## 6. Incoming messages

Meta webhooks are verified with `X-Hub-Signature-256`. Events are deduplicated in `whatsapp_webhook_events`, then processed (inline or via BullMQ when Redis is available).

Inbound messages:

- Resolve tenant by `phone_number_id` → `connected_accounts.external_account_id`
- Match lead by phone within that organization
- Create inbound `messages` row + `whatsapp_received` activity

## 7. Connection health

- `GET /api/v1/integrations/whatsapp/connection` — safe connection summary (no tokens)
- `POST /api/v1/integrations/whatsapp/test-connection` — verifies credentials with Meta
- If Meta returns auth errors, connection status becomes `requires_reconnect`

## 8. Disconnect / reconnect

- **Disconnect:** `POST /api/v1/integrations/whatsapp/disconnect` — disables connection, preserves message history
- **Reconnect:** run Embedded Signup again; existing workspace row is updated

## 9. Security notes

- Never expose `META_APP_SECRET`, webhook verify token, or tenant access tokens to the frontend
- All integration APIs require auth + `X-Organization-Id`
- Webhook tenant resolution uses `phone_number_id` only — never trust client-supplied tenant IDs on webhooks
- Backend verifies WABA owns phone number via Graph API before storing credentials

## 10. API reference (tenant)

| Method | Path |
|--------|------|
| GET | `/api/v1/integrations/whatsapp` |
| GET | `/api/v1/integrations/whatsapp/connection` |
| GET | `/api/v1/integrations/whatsapp/status` |
| GET | `/api/v1/integrations/whatsapp/config` |
| POST | `/api/v1/integrations/whatsapp/connect/start` |
| POST | `/api/v1/integrations/whatsapp/connect/complete` |
| POST | `/api/v1/integrations/whatsapp/disconnect` |
| POST | `/api/v1/integrations/whatsapp/test` |
| POST | `/api/v1/integrations/whatsapp/test-connection` |
| POST | `/api/v1/integrations/whatsapp/send` |
| GET | `/api/v1/integrations/whatsapp/templates` |
| GET/POST | `/api/webhooks/whatsapp` |

## 11. Troubleshooting

| Symptom | Check |
|--------|--------|
| Connect button shows admin message | `META_APP_ID` + `META_EMBEDDED_SIGNUP_CONFIG_ID` on backend |
| "Connection requires attention" | Reconnect via Embedded Signup |
| Webhook verify fails | `META_WEBHOOK_VERIFY_TOKEN` matches Meta dashboard |
| Inbound messages missing | Webhook subscribed to `messages`; tunnel reachable in dev |
| Template required error | Use approved template outside 24h window |
