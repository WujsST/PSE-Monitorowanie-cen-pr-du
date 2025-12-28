# 🔧 Konfiguracja Manualnego Triggera n8n Workflow

Instrukcja konfiguracji przycisku "Odśwież" na dashboardzie do ręcznego wywoływania workflow n8n.

## Krok 1: Włącz MCP Access dla Workflow

W n8n:
1. Odwórz swój workflow PSE
2. Kliknij **menu (...)** w prawym górnym rogu
3. Wybierz **Settings**
4. Włącz **Available in MCP**
5. **Publish** workflow (jeśli jeszcze nie jest opublikowany)

## Krok 2: Wygeneruj MCP Token

1. W n8n, idź do **Settings** → **API**
2. Kliknij **Create API Token**
3. Nazwij token: `Dashboard Manual Trigger`
4. Skopiuj wygenerowany token

## Krok 3: Znajdź Workflow ID

Workflow ID to nazwa workflow widoczna w MCP. Możesz ją znaleźć:
- W **Settings → Instance-level MCP → Workflows tab**
- Lub w konfiguracji workflow (zazwyczaj to ID lub nazwa workflow)

## Krok 4: Dodaj do `.env.local`

```env
N8N_BASE_URL=https://twoja-instancja-n8n.railway.app
N8N_MCP_TOKEN=twoj_wygenerowany_token
N8N_WORKFLOW_ID=PSE-Data-Collector
```

**Uwaga:**
- `N8N_BASE_URL` - bez trailing slash
- `N8N_WORKFLOW_ID` - dokładna nazwa workflow z MCP

## Krok 5: Restart Backendu

```bash
# Zatrzym aktualny backend (Ctrl+C)
# Uruchom ponownie
npm run server
```

## Testowanie

### Test 1: Wywołaj endpoint bezpośrednio

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

### Test 2: Sprawdź w n8n

1. Otwórz n8n
2. Idź do **Executions**
3. Powinieneś zobaczyć nowe wykonanie workflow

### Test 3: Sprawdź w bazie danych

```sql
SELECT * FROM pse_prices ORDER BY timestamp DESC LIMIT 1;
```

## FAQ

**Q: Dostaję błąd "n8n not configured"**
A: Sprawdź czy wszystkie 3 zmienne środowiskowe są ustawione w `.env.local`

**Q: Workflow się nie wywołuje**
A: Sprawdź:
- Czy workflow ma włączone "Available in MCP"
- Czy workflow jest opublikowany
- Czy `N8N_WORKFLOW_ID` się zgadza z nazwą w n8n

**Q: Jak znaleźć dokładną nazwę workflow dla MCP?**
A: W n8n, idź do Settings → Instance-level MCP → Workflows - tam zobaczysz listę dostępnych workflow

## Integracja z Dashboardem (Następny Krok)

Gdy backend endpoint będzie działał, dodam przycisk na dashboardzie który:
1. Wywołuje `/api/trigger-refresh`
2. Pokazuje loading state
3. Automatycznie odświeża dane po 3 sekundach
