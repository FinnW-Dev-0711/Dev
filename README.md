# AboScope (Website)

AboScope ist jetzt eine **reine Website** (HTML/CSS/JavaScript) und **keine Python-App** mehr.

## Features

- Abos + Preise eintragen
- Automatische Gruppierung in Themen (z. B. Filme & Serien, Musik, Gaming …)
- Web-Kontext pro Abo via Wikipedia-Suche
- Summen pro Gruppe + Gesamtpreis
- Modernes, schlichtes UI

## Lokal starten

Da es eine statische Website ist, reicht ein einfacher Static-Server.

Beispiel:

```bash
python -m http.server 8000
```

Dann öffnen:

- http://localhost:8000

## Dateien

- `index.html` – Seite
- `static/styles.css` – Styling
- `static/app.js` – Logik + Websuche + Gruppierung
