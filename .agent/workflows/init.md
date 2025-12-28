---
description: Initialize PSE Energy Monitor project
---

# PSE Energy Monitor - Workflow Inicjalizacyjny

Ten workflow inicjalizuje projekt monitorowania cen energii PSE i uruchamia aplikację lokalnie.

## Krok 1: Sprawdź Node.js
Upewnij się, że masz zainstalowany Node.js:
```bash
node --version
```

## Krok 2: Zainstaluj zależności
// turbo
```bash
npm install
```

Zainstaluje to wszystkie wymagane zależności projektu.

## Krok 3: Sprawdź konfigurację
Upewnij się, że plik `.env.local` istnieje i zawiera klucz API Gemini (jeśli jest wymagany):
```bash
cat .env.local 2>/dev/null || echo "Brak pliku .env.local - może być wymagany"
```

## Krok 4: Uruchom serwer deweloperski
// turbo
```bash
npm run dev
```

Aplikacja pojawi się pod adresem lokalnym (zazwyczaj http://localhost:5173).

## Krok 5: Otwórz w przeglądarce
Po uruchomieniu serwera deweloperskiego, otwórz aplikację w przeglądarce pod adresem wyświetlonym w terminalu.

## Struktura Projektu

### Główne komponenty:
- **index.html** - Główny plik aplikacji zawierający strukturę HTML, style i logikę Alpine.js
- **package.json** - Konfiguracja npm z zależnościami i skryptami
- **vite.config.ts** - Konfiguracja bundlera Vite
- **tsconfig.json** - Konfiguracja TypeScript

### Funkcjonalności:
- 📊 Dashboard z cenami energii w czasie rzeczywistym
- 📈 Wykresy trendów cenowych (Chart.js)
- 🌓 Tryb ciemny/jasny
- 📱 Responsywny design (TailwindCSS)
- ⚡ Interaktywność (Alpine.js)
- 💾 Export danych do CSV

### Główne metryki:
- **CEN** - Cena Energii Niezbilansowania
- **CSDAC** - Cena z Giełdy (Rynek Dnia Następnego)
- **COR** - Koszt Rezerw Operacyjnych
- **CEBpp** - Cena Energii Bilansującej w Polu Pracy
