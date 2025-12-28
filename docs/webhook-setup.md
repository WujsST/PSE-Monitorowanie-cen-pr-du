# n8n Webhook Setup - Header Authentication

## Konfiguracja Webhooka z Zabezpieczeniem

### Krok 1: Konfiguracja n8n Workflow

1. **Dodaj Webhook Node:**
   - Typ: Production URL
   - Method: POST
   - Path: `pse-trigger` (lub własny)

2. **Dodaj Header Auth:**
   - W Webhook node → Settings
   - Enable **Header Auth**
   - Header Name: `X-Auth-Token` (lub własny, np. `Authorization`)
   - Header Value: Wygeneruj strong token (np. `openssl rand -hex 32`)

3. **Skopiuj Webhook URL:**
   - Przykład: `https://n8n.railway.app/webhook/pse-trigger`

### Krok 2: Konfiguracja Backend

Edytuj `.env.local`:

```env
# Webhook URL (skopiuj z n8n)
N8N_WEBHOOK_URL=https://twoj-n8n.railway.app/webhook/pse-trigger

# Header Auth (musi być DOKŁADNIE taki sam jak w n8n!)
N8N_WEBHOOK_AUTH_HEADER=X-Auth-Token
N8N_WEBHOOK_AUTH_VALUE=twoj_secret_token_z_n8n
```

### Krok 3: Restart Backend

```bash
# Zatrzymaj (Ctrl+C) i restart
npm run server
```

### Krok 4: Test

```bash
curl -X POST http://localhost:3001/api/trigger-refresh
```

**Oczekiwana odpowiedź:**
```json
{
  "success": true,
  "message": "Data collection triggered. Refresh dashboard in a few seconds."
}
```

## Przykłady Konfiguracji

### Opcja 1: Custom Header (Recommended)
```env
N8N_WEBHOOK_AUTH_HEADER=X-Auth-Token
N8N_WEBHOOK_AUTH_VALUE=abc123xyz789secrettoken
```

### Opcja 2: Bearer Token
```env
N8N_WEBHOOK_AUTH_HEADER=Authorization
N8N_WEBHOOK_AUTH_VALUE=Bearer abc123xyz789secrettoken
```

### Opcja 3: Basic Auth
```env
N8N_WEBHOOK_AUTH_HEADER=Authorization
N8N_WEBHOOK_AUTH_VALUE=Basic dXNlcjpwYXNzd29yZA==
```

## Payload Wysyłany do Webhooka

Backend wysyła następujący JSON:

```json
{
  "trigger": "manual",
  "source": "dashboard",
  "timestamp": "2025-12-28T14:20:00.000Z"
}
```

Możesz użyć tych pól w n8n workflow (np. w Code node):
```javascript
const trigger = $input.item.json.trigger; // "manual"
const source = $input.item.json.source;   // "dashboard"
```

## Troubleshooting

### "n8n webhook not configured"
❌ Brak `N8N_WEBHOOK_URL` w `.env.local`

### 401 Unauthorized
❌ `N8N_WEBHOOK_AUTH_VALUE` nie zgadza się z tokenem w n8n

### 404 Not Found
❌ Nieprawidłowy `N8N_WEBHOOK_URL` lub webhook path

### Backend nie łączy się
✅ Sprawdź logi n8n executions
✅ Sprawdź czy webhook jest Production URL (nie Test)
✅ Upewnij się że workflow jest aktywny

## Generowanie Secure Token

```bash
# Linux/Mac
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Online
# https://www.random.org/strings/
```

## FAQ

**Q: Czy webhook musi być zabezpieczony?**
A: Nie, ale bardzo zalecane! Bez zabezpieczenia każdy może wywołać Twój workflow.

**Q: Jaką nazwę headera wybrać?**
A: `X-Auth-Token` jest dobry. Możesz użyć też `Authorization`, `X-API-Key` itp.

**Q: Czy mogę mieć wiele webhooków?**
A: Tak! Możesz mieć osobne webhooki dla różnych akcji.
