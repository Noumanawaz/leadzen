# WhatsApp Business Platform Integration

This project integrates the official **Meta WhatsApp Cloud API** with **Embedded Signup** so each tenant connects their own WhatsApp Business Account (WABA) and phone number.

## Architecture

- Tenant credentials live in `connected_accounts` (`provider = meta_whatsapp`)
- Access tokens are encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256-GCM)
- Outbound messages go through the backend only — the browser never receives tenant tokens
- Inbound messages and delivery statuses arrive at `POST /api/webhooks/whatsapp`

## 1. Create a Meta app

1. Go to [Meta for Developers](https://developers.facebook.com/) and create an app.
2. Add the **WhatsApp** product.
3. Configure **Facebook Login for Business** / **Embedded Signup** and note the **Configuration ID**.
4. Add required permissions for production (App Review):
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`

## 2. Environment variables

### Backend (`backend/.env`)

```env
META_APP_ID=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_CONFIG_ID=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v22.0
TOKEN_ENCRYPTION_KEY=
```

### Frontend (`frontend/.env.local`) — optional

```env
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID=
```

The integrations UI can also load public config from `GET /api/v1/integrations/whatsapp/config`.

## 3. Webhook setup

**Callback URL:** `https://YOUR_API_HOST/api/webhooks/whatsapp`

**Verify token:** same value as `META_WEBHOOK_VERIFY_TOKEN`

Subscribe to:

- `messages`
- `message_template_status_update` (optional, for template sync)

### Local development

Use a tunnel (ngrok, Cloudflare Tunnel, etc.) pointing to port `4000`:

```bash
ngrok http 4000
```

Register the HTTPS URL in the Meta app webhook settings.

## 4. Tenant connect flow

1. User opens **Settings → Integrations**
2. Clicks **Connect WhatsApp**
3. Completes Meta Embedded Signup
4. Frontend calls `POST /api/v1/integrations/whatsapp/connect/complete` with the OAuth code and `phone_number_id`
5. Backend exchanges the code, encrypts the token, and stores the integration

## 5. Sending messages

Agents send from the lead **Contact** sheet or via **Sequences** (WhatsApp channel).

- Text messages use the Cloud API messages endpoint
- Template messages are supported via `WhatsAppTemplate` sync and `sendTemplateMessage`
- Outside the 24-hour customer care window, use approved templates

## 6. Incoming messages

Meta webhooks are verified with `X-Hub-Signature-256`. Events are stored in `whatsapp_webhook_events` for idempotency, then processed (inline or via BullMQ when Redis is available).

Inbound messages:

- Resolve tenant by `phone_number_id` → `connected_accounts.external_account_id`
- Match lead by phone within that organization
- Create inbound `messages` row + `whatsapp_received` activity

## 7. Disconnect / reconnect

- **Disconnect:** `POST /api/v1/integrations/whatsapp/disconnect` or disconnect from the accounts table
- **Reconnect:** run Embedded Signup again; existing workspace row is updated

## 8. Security notes

- Never expose `META_APP_SECRET`, webhook verify token, or tenant access tokens to the frontend
- All integration APIs require auth + `X-Organization-Id`
- Webhook tenant resolution uses `phone_number_id` only — never trust client-supplied tenant IDs on webhooks

## 9. Troubleshooting

| Symptom | Check |
|--------|--------|
| Connect button disabled | `META_*` env vars on backend |
| "Connection expired" | Reconnect WhatsApp in Integrations |
| Webhook verify fails | `META_WEBHOOK_VERIFY_TOKEN` matches Meta dashboard |
| Inbound messages missing | Webhook subscribed to `messages`; tunnel reachable in dev |
| Template required error | Use approved template outside 24h window |

## 10. API reference (tenant)

| Method | Path |
|--------|------|
| GET | `/api/v1/integrations/whatsapp` |
| GET | `/api/v1/integrations/whatsapp/status` |
| GET | `/api/v1/integrations/whatsapp/config` |
| POST | `/api/v1/integrations/whatsapp/connect/start` |
| POST | `/api/v1/integrations/whatsapp/connect/complete` |
| POST | `/api/v1/integrations/whatsapp/disconnect` |
| POST | `/api/v1/integrations/whatsapp/test` |
| POST | `/api/v1/integrations/whatsapp/send` |
| GET | `/api/v1/integrations/whatsapp/templates` |
| GET/POST | `/api/webhooks/whatsapp` |
