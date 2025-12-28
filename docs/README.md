# PSE Energy Monitor - Integration Guide

Przewodnik po uruchomieniu pełnej aplikacji z integracją PostgreSQL Neon i n8n.

## Architektura

```
PSE API ← n8n (zbiera co 15 min) → PostgreSQL Neon ← Backend API ← Frontend Dashboard
```

## Quick Start

### 1. Konfiguracja PostgreSQL Neon

1. Załóż konto na [Neon](https://neon.tech)
2. Utwórz nowy projekt
3. Skopiuj connection string (Format: `postgresql://user:password@host.neon.tech/db?sslmode=require`)

### 2. Konfiguracja Environment Variables

Skopiuj plik przykładowy i uzupełnij dane:

```bash
cp .env.local.example .env.local
```

Edytuj `.env.local`:
```env
DATABASE_URL=postgresql://user:password@hostname.neon.tech/dbname?sslmode=require
PORT=3001
CACHE_TTL=30
NODE_ENV=development
```

### 3. Inicjalizacja Bazy Danych

Uruchom skrypt setup (tworzy tabele + przykładowe dane):

```bash
npm run db:setup
```

**Output:**
```
🔧 Setting up PostgreSQL database schema...
✓ Table pse_prices created
✓ Index idx_pse_prices_timestamp created
✓ Inserted 48 sample records
✅ Database setup complete!
```

### 4. Konfiguracja n8n Workflow

Zobacz szczegółową dokumentację: [docs/n8n-workflow.md](./docs/n8n-workflow.md)

**Krótka instrukcja:**
1. W n8n utwórz PostgreSQL credentials (connection string z Neon)
2. Stwórz workflow:
   - Schedule Trigger (co 15 min)
   - HTTP Request (PSE API)
   - PostgreSQL Insert (tabela `pse_prices`)
3. Aktywuj workflow

### 5. Uruchomienie Aplikacji

#### Opcja A: Full Stack (Recommended)
```bash
npm run dev:full
```

To uruchomi jednocześnie:
- Backend API (port 3001)
- Frontend Dev Server (port 3000)

#### Opcja B: Osobno

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 6. Otwórz Dashboard

Przejdź do: http://localhost:3000

## Skrypty NPM

| Komenda | Opis |
|---------|------|
| `npm run dev` | Uruchom frontend dev server (Vite) |
| `npm run server` | Uruchom backend API server |
| `npm run dev:full` | Uruchom full stack (backend + frontend) |
| `npm run db:setup` | Inicjalizacja schematu bazy danych |
| `npm run build` | Build produkcyjny frontendu |
| `npm run preview` | Podgląd buildu produkcyjnego |

## API Endpoints

Backend dostępny na `http://localhost:3001`:

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/current` | GET | Najnowsze ceny energii |
| `/api/history?hours=24` | GET | Dane historyczne (domyślnie 24h) |
| `/api/stats` | GET | Statystyki (min/max/avg) |
| `/api/health` | GET | Health check + status połączenia z DB |
| `/api/cache/clear` | POST | Wyczyść cache serwera |

### Przykłady

```bash
# Pobierz aktualne ceny
curl http://localhost:3001/api/current

# Pobierz historię z ostatnich 48h
curl http://localhost:3001/api/history?hours=48

# Sprawdź health
curl http://localhost:3001/api/health

# Wyczyść cache
curl -X POST http://localhost:3001/api/cache/clear
```

## Troubleshooting

### Problem: Backend nie może połączyć się z PostgreSQL

**Rozwiązanie:**
- Sprawdź czy `DATABASE_URL` w `.env.local` jest poprawny
- Upewnij się, że connection string zawiera `?sslmode=require`
- Sprawdź czy Neon project jest aktywny

### Problem: Brak danych na dashboardzie

**Sprawdź:**
1. Czy n8n workflow jest aktywny i działa?
2. Czy w bazie są dane: `SELECT COUNT(*) FROM pse_prices;`
3. Czy backend server jest uruchomiony?
4. Sprawdź console w przeglądarce (F12)

### Problem: "No data available" w API

**Rozwiązanie:**
- Uruchom `npm run db:setup` aby dodać przykładowe dane
- Lub poczekaj aż n8n workflow zbierze pierwsze dane

### Problem: CORS errors

**Rozwiązanie:**
- Backend ma włączony CORS dla wszystkich origin
- Upewnij się że frontend i backend są uruchomione

## Deployment

### Frontend (Vercel/Netlify)

```bash
npm run build
# Upload dist/ folder
```

Zmień API URL w production (dodaj environment variable).

### Backend (Railway/Heroku/Render)

1. Push kod na Git
2. Ustaw environment variables w platformie
3. Komenda start: `node server.js`

## Struktura Projektu

```
.
├── server.js              # Backend Express server
├── api-client.js          # Frontend API client
├── index.html            # Frontend aplikacja (Alpine.js)
├── scripts/
│   └── setup-db.js       # Inicjalizacja DB
├── docs/
│   └── n8n-workflow.md   # Dokumentacja n8n
├── .env.local.example    # Template env variables
└── package.json          # Dependencies + scripts
```

## Database Schema

```sql
CREATE TABLE pse_prices (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL UNIQUE,
  cen_cost DECIMAL(10, 2),      -- Cena Niezbilansowania
  csdac_pln DECIMAL(10, 2),     -- Giełda (RDN)
  cor_cost DECIMAL(10, 2),      -- Rezerwa Operacyjna
  ceb_pp_cost DECIMAL(10, 2),   -- Energia Bilansująca
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Maintenance

### Czyszczenie starych danych

```sql
-- Usuń dane starsze niż 30 dni--- DELETE FROM pse_prices WHERE timestamp < NOW() - INTERVAL '30 days';
```

### Sprawdzenie rozmiaru bazy

```sql
SELECT
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('pse_prices')) as table_size
FROM pse_prices;
```

## Support

Problemy? Sprawdź:
1. [docs/n8n-workflow.md](./docs/n8n-workflow.md) - Konfiguracja n8n
2. [docs/api-integration.md](./docs/api-integration.md) - API details (TODO)
3. Logs backendu w terminalu
4. n8n executions w interfejsie n8n

---

**Status:** ✅ Ready for production
**Stack:** Vite + Alpine.js + Express + PostgreSQL Neon + n8n
