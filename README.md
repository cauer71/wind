# Wind Südtirol

Live-Nachbau des Artefakts „Wind Bozen“: ein animiertes Seidenband (WebGL) zeigt Wind,
Luftqualität und Pollen – jetzt mit Live-Daten und frei wählbarem Ort in Südtirol.

**Live:** https://wind.auer.page (auch https://wind.christian-auer-71.workers.dev)
(Ort direkt verlinken: `?station=23200MS` für Meran usw.)

## Bedienung

- **Vollbild:** Taste oben rechts im Band, Taste `F` oder Doppelklick aufs Band; `Esc` beendet.
  Auf dem iPhone (keine Fullscreen-API) füllt das Band den ganzen Bildschirm.
- **Musik:** startet mit dem ersten Klick oder Tipp aufs Band (Browser erlauben Ton erst nach einer
  Bedienung) und lässt sich mit dem Lautsprecher-Knopf aus- und einschalten. Der Autorenhinweis
  wird am Anfang und bei jedem Start der Musik eingeblendet und blendet nach ein paar Sekunden aus.

## Musik

'Ephemera' by Scott Buckley - released under CC-BY 4.0. [www.scottbuckley.com.au](https://www.scottbuckley.com.au)
(`public/audio/ephemera.mp3`, für das Web auf 160 kbit/s umkodiert)

## Datenquellen

| Wert | Quelle |
| --- | --- |
| Wind, Böen, Richtung | Wetterdienst des Landes Südtirol – `geoservices.buergernetz.bz.it/services/meteo/v1` (10-Minuten-Werte, zu Stundenwerten gemittelt) |
| NO₂, PM10, PM2.5, O₃, SO₂ | Landesagentur für Umwelt (APPA) – `dati.retecivica.bz.it/services/airquality`; je Wert die nächste Messstelle im Umkreis von 30 km |
| Ersatz | Fällt ein Landesdienst aus, kommen die Werte aus dem Open Data Hub Südtirol (`MeteoStation`, `EnvironmentStation`) |
| Pollen | CAMS Europe über Open-Meteo (Modellwerte) – dafür gibt es keine Messdaten |

## Aufbau

- `src/worker.js` – Cloudflare Worker
  - `GET /api/stations` – alle aktiven Stationen mit Windmessung (6 h gecacht)
  - `GET /api/wind?station=<code>` – letzte 48 Stunden, stündlich (10 min gecacht)
- `public/` – statische Seite (`index.html`, `style.css`, `app.js`, `sound.js`), d3 v7 von cdnjs
- `tests/` – Playwright-Tests mit festen Testdaten (`tests/fixtures`)

Die Ortsauswahl zeigt zuerst bekannte Orte (Bozen, Meran, Brixen, Bruneck, Sterzing, …)
und darunter alle Wetterstationen mit Windmessung. „In meiner Nähe“ nimmt die nächste
Station zum Standort des Browsers.

## Entwickeln und veröffentlichen

```sh
npm install
npx wrangler dev        # lokal
npm test                # Worker-Tests (Datenquellen) und Playwright-Tests, mit Testdaten, ohne Netz
CLOUDFLARE_API_TOKEN=… npx wrangler deploy
```
