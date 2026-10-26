// Worker data sources, with fetch mocked: provincial services first, Open Data Hub as fallback.
// Run: node --test tests/worker.node.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const { default: worker } = await import('../src/worker.js');

const now = Date.now(), H = 3600e3;
const cet = (t) => new Date(t + H).toISOString().slice(0, 19) + 'CET';
const tenMin = (v) => Array.from({ length: 300 }, (_, i) => ({ DATE: cet(now - i * 600e3), VALUE: v }));
const airHours = (code) => Array.from({ length: 60 }, (_, i) => [
  { DATE: new Date(now - (i + 1) * H).toISOString(), SCODE: code, MCODE: 'NO2', VALUE: 30, TYPE: '1' },
  { DATE: new Date(now - (i + 1) * H).toISOString(), SCODE: code, MCODE: 'PM10', VALUE: -1, TYPE: '1' }
]).flat();

function mock(routes) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    for (const [part, body] of routes) {
      if (u.includes(part)) {
        if (body === 500) return new Response('down', { status: 500 });
        return new Response(JSON.stringify(typeof body === 'function' ? body(u) : body), { status: 200 });
      }
    }
    return new Response('not mocked', { status: 404 });
  };
}
const call = async (path) => (await worker.fetch(new Request('https://x' + path), {}, { waitUntil() {} })).json();

const meteoStations = { features: [{ properties: { SCODE: '83200MS', NAME_D: 'BOZEN', NAME_I: 'BOLZANO', ALT: 254, LAT: 46.4977, LONG: 11.3128 } }] };

test('wind and air come from the provincial services', async () => {
  mock([
    ['meteo/v1/stations', meteoStations],
    ['meteo/v1/timeseries', (u) => tenMin(u.includes('WR') ? 270 : u.includes('BOE') ? 5 : 2)],
    ['airquality/stations', { features: [{ properties: { SCODE: 'BZ5', NAME_D: 'Bozen 5', LAT: 46.4955, LONG: 11.34 } }] }],
    ['airquality/timeseries', airHours('BZ5')],
    ['open-meteo', 500]
  ]);
  const j = await call('/api/wind?station=83200MS');
  assert.equal(j.station.de, 'Bozen');
  assert.equal(j.station.alt, 254);
  assert.deepEqual(j.sources, { wind: 'Wetterdienst Land Südtirol', air: 'Landesagentur für Umwelt (APPA)' });
  const last = j.rows.at(-1);
  assert.equal(last.wind_kmh, 7.2);     // 2 m/s
  assert.equal(last.gust_kmh, 18);      // 5 m/s
  assert.equal(last.dir_deg, 270);
  assert.equal(last.no2_ugm3, 30);
  assert.equal(last.pm10_ugm3, null);   // -1 means no value
});

test('the Open Data Hub steps in when the provincial services fail', async () => {
  const odhT = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19) + '.000+0000';
  mock([
    ['buergernetz', 500],
    ['retecivica', 500],
    ['MeteoStation?limit=1', { data: [{ scode: '83200MS', sname: 'Bolzano', scoordinate: { x: 11.3128, y: 46.4977 }, 'smetadata.name_de': 'Bozen', 'smetadata.name_it': 'Bolzano' }] }],
    ['MeteoStation/wind-speed', { data: Array.from({ length: 30 }, (_, i) => ({ tname: 'wind-speed', mvalue: 1, mvalidtime: odhT(now - i * 600e3) })) }],
    ['EnvironmentStation?', { data: [] }],
    ['open-meteo', 500]
  ]);
  const j = await call('/api/wind?station=83200MS');
  assert.equal(j.sources.wind, 'Open Data Hub Südtirol');
  assert.equal(j.rows.at(-1).wind_kmh, 3.6);
});
