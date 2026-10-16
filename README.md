# Wind Südtirol

Live-Nachbau des Artefakts „Wind Bozen“: ein animiertes Seidenband (WebGL) zeigt Wind,
Luftqualität und Pollen – jetzt mit Live-Daten und frei wählbarem Ort in Südtirol.

**Live:** https://wind.christian-auer-71.workers.dev
(Ort direkt verlinken: `?station=23200MS` für Meran usw.)

## Datenquellen

| Wert | Quelle |
| --- | --- |
| Wind, Böen, Richtung | Open Data Hub Südtirol – `MeteoStation` (Wetterstationen des Landes, 10-Minuten-Werte, zu Stundenwerten gemittelt) |
| PM10, NO₂, PM2.5 | Open Data Hub Südtirol – `EnvironmentStation`, Herkunft APPA Bozen; die nächstgelegene aktive Messstelle wird automatisch gewählt |
| Pollen | CAMS Europe über Open-Meteo (Modellwerte) – der Open Data Hub führt keine Pollendaten |

## Aufbau

- `src/worker.js` – Cloudflare Worker
  - `GET /api/stations` – alle aktiven Stationen mit Windmessung (6 h gecacht)
  - `GET /api/wind?station=<code>` – letzte 48 Stunden, stündlich (10 min gecacht)
- `public/` – statische Seite (`index.html`, `style.css`, `app.js`), d3 v7 von cdnjs

Die Ortsauswahl zeigt zuerst bekannte Orte (Bozen, Meran, Brixen, Bruneck, Sterzing, …)
und darunter alle Wetterstationen mit Windmessung. „In meiner Nähe“ nimmt die nächste
Station zum Standort des Browsers.

## Entwickeln und veröffentlichen

```sh
npm install
npx wrangler dev        # lokal
CLOUDFLARE_API_TOKEN=… npx wrangler deploy
```
