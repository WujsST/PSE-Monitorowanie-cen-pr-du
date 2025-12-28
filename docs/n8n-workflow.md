# n8n Workflow - PSE Energy Data Collector

Dokumentacja workflow w n8n do zbierania danych o cenach energii PSE i zapisywania ich do PostgreSQL Neon.

## Architektura

```
PSE API → n8n Workflow (co 15 min) → PostgreSQL Neon → Dashboard
```

## Konfiguracja Workflow

### 1. Trigger Node: Schedule Trigger

**Ustawienia:**
- **Trigger Interval:** Every 15 minutes (lub co 30 minut)
- **Mode:** Every X minutes
- **Minutes:** 15

### 2. HTTP Request Node: Pobierz dane z PSE

**Ustawienia:**
- **Method:** GET
- **URL:** `https://api.pse.pl/...` (URL do PSE API - musisz dostarczyć)
- **Authentication:** None (lub jak wymaga PSE)
- **Response Format:** JSON

**Oczekiwana odpowiedź:**
```json
{
  "timestamp": "2025-12-27T19:00:00Z",
  "cen": 450.50,
  "csdac": 420.30,
  "cor": 380.20,
  "ceb_pp": 430.40
}
```

### 3. Code Node: Transform Data (opcjonalne)

Jeśli struktura danych z PSE wymaga transformacji:

```javascript
// Format timestamp
const timestamp = new Date($json.timestamp).toISOString();

// Map fields to database schema
return {
  timestamp: timestamp,
  cen_cost: parseFloat($json.cen),
  csdac_pln: parseFloat($json.csdac),
  cor_cost: parseFloat($json.cor),
  ceb_pp_cost: parseFloat($json.ceb_pp)
};
```

### 4. PostgreSQL Node: Zapisz do bazy

**Ustawienia:**
- **Credentials:** PostgreSQL Neon Connection
- **Operation:** Insert
- **Schema:** public
- **Table:** pse_prices

**Columns to Match:**
- `timestamp` → `{{ $json.timestamp }}`
- `cen_cost` → `{{ $json.cen_cost }}`
- `csdac_pln` → `{{ $json.csdac_pln }}`
- `cor_cost` → `{{ $json.cor_cost }}`
- `ceb_pp_cost` → `{{ $json.ceb_pp_cost }}`

**Options:**
- **On Conflict:** Do Update (UPSERT)
- **Conflict Columns:** timestamp

## Konfiguracja PostgreSQL Credentials w n8n

1. W n8n, idź do **Credentials** → **New**
2. Wybierz **PostgreSQL**
3. Wypełnij dane:
   - **Name:** PostgreSQL Neon
   - **Host:** `your-project.neon.tech`
   - **Database:** `neondb`
   - **User:** `your-username`
   - **Password:** `your-password`
   - **Port:** `5432`
   - **SSL:** Enabled

Connection string z Neon wygląda tak:
```
postgresql://user:password@hostname.neon.tech/dbname?sslmode=require
```

## Testowanie Workflow

### Test 1: Manual Execution
1. Kliknij **Execute Workflow** w n8n
2. Sprawdź czy wszystkie nodes wykonały się poprawnie (zielone)
3. Sprawdź output PostgreSQL node - powinien pokazać inserted row

### Test 2: Sprawdź bazę danych
```sql
SELECT * FROM pse_prices ORDER BY timestamp DESC LIMIT 10;
```

### Test 3: Sprawdź czy cron działa
1. Aktywuj workflow (toggle Active)
2. Poczekaj 15 minut
3. Sprawdź executions w n8n
4. Sprawdź czy nowe rekordy pojawiły się w bazie

## Obsługa Błędów

### Error Node (opcjonalny)

Dodaj **Error Trigger** node do obsługi błędów:
- Wyślij powiadomienie email lub Slack gdy workflow się nie powiedzie
- Zapisz logi błędów do osobnej tabeli

### Retry Logic

W HTTP Request node:
- **Retry On Fail:** Yes
- **Max Retries:** 3
- **Wait Between Retries:** 1000ms

## Przykładowy Export Workflow (JSON)

Jeśli chcesz, mogę wygenerować gotowy JSON workflow do zaimportowania w n8n.

## FAQ

**Q: Jak często powinien być uruchamiany workflow?**
A: PSE aktualizuje dane co 15-30 minut. Zalecam co 15 minut.

**Q: Co jeśli PSE API jest niedostępne?**
A: n8n automatycznie retry 3 razy. Jeśli nadal fail, workflow zakończy się błędem, ale nie zatrzyma się - następna próba będzie za 15 minut.

**Q: Jak sprawdzić czy workflow działa?**
A: Sprawdź executions w n8n lub query bazę danych: `SELECT COUNT(*) FROM pse_prices WHERE timestamp > NOW() - INTERVAL '1 hour'`

## Następne Kroki

Po skonfigurowaniu workflow:
1. ✅ Upewnij się że baza danych ma schema (uruchom `npm run db:setup`)
2. ✅ Aktywuj workflow w n8n
3. ✅ Poczekaj 15 minut na pierwsze dane
4. ✅ Uruchom dashboard backend: `npm run server`
5. ✅ Otwórz dashboard: http://localhost:3000
