# AboScope

Moderne Web-App, um Abos mit Preis einzutragen und automatisch in Kategorien zu gruppieren (inkl. Gesamtpreis).

## Features

- Beliebig viele Abos erfassen
- KI-ähnliche Kategorisierung mit Web-Kontext (Wikipedia-Suche)
- Gruppierte Auswertung inkl. Summen pro Kategorie
- Gesamtpreis pro Monat

## Start

```bash
python app.py
```

Danach im Browser öffnen:

- http://localhost:8000

## API

`POST /api/analyze`

```json
{
  "subscriptions": [
    { "name": "Netflix", "price": 12.99 },
    { "name": "Spotify", "price": 10.99 }
  ]
}
```
