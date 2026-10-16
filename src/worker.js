// Wind Südtirol – Cloudflare Worker
// Serves the static page (./public) and two JSON endpoints built from the
// Open Data Hub South Tyrol (https://opendatahub.com):
//   GET /api/stations          active weather stations that measure wind
//   GET /api/wind?station=…    last 48 h, hourly: wind, gusts, direction,
//                              NO₂ / PM10 / PM2.5 / O₃ / SO₂ (for each the nearest
//                              APPA station within 30 km that measures it),
//                              pollen (CAMS model via Open-Meteo, ODH has none)

const ODH = 'https://mobility.api.opendatahub.com/v2/flat';
const POLLEN_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HOURS = 48;
const H = 3600 * 1000;
const POLLEN_TYPES = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
const AQ_TYPES = { no2: 'NO2 - Ossidi di azoto', pm10: 'PM10 - Polveri sottili', pm25: 'PM2.5 - Polveri sottili', o3: 'O3 - Ozono', so2: 'SO2 - Biossido di zolfo' };
const AQ_KEYS = Object.keys(AQ_TYPES);
const AQ_MAX_KM = 30;      // farther stations say little about the chosen place
const AQ_HOLD_H = 12;      // the APPA feed often lags by several hours: show the last value up to 12 h

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/stations') return await cached(request, ctx, 6 * 3600, () => stations());
      if (url.pathname === '/api/wind') {
        const code = url.searchParams.get('station') || '83200MS';
        if (!/^[0-9A-Z]{5,8}$/.test(code)) return json({ error: 'invalid station' }, 400);
        return await cached(request, ctx, 600, () => wind(code));
      }
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 502);
    }
    return env.ASSETS.fetch(request);
  }
};

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

async function cached(request, ctx, ttl, build) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json(await build(), 200, ttl);
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function getJSON(url, timeoutMs = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

const odhTime = (s) => Date.parse(String(s).replace(' ', 'T').replace(/\+0000$/, 'Z'));
const iso = (t) => new Date(t).toISOString().slice(0, 19) + 'Z';
const round = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const q = (s) => encodeURIComponent(s);

function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------- stations ----------
async function stations() {
  const since = Date.now() - 24 * H;
  const d = await getJSON(`${ODH}/MeteoStation/wind-speed/latest?limit=-1&where=sactive.eq.true,mperiod.eq.600&select=scode,sname,mvalidtime,scoordinate,smetadata.name_de,smetadata.name_it,smetadata.altitude`);
  const list = d.data
    .filter((s) => odhTime(s.mvalidtime) > since && s.scoordinate)
    .map((s) => ({
      code: s.scode,
      de: s['smetadata.name_de'] || s.sname,
      it: s['smetadata.name_it'] || s.sname,
      alt: s['smetadata.altitude'] != null ? Number(s['smetadata.altitude']) : null,
      lat: s.scoordinate.y,
      lon: s.scoordinate.x
    }))
    .sort((a, b) => a.de.localeCompare(b.de, 'de'));
  return { source: 'Open Data Hub Südtirol · MeteoStation (SIAG)', stations: list };
}

async function stationInfo(code) {
  const d = await getJSON(`${ODH}/MeteoStation?limit=1&where=scode.eq.${q(`"${code}"`)}&select=scode,sname,scoordinate,smetadata.name_de,smetadata.name_it,smetadata.altitude`);
  const s = d.data && d.data[0];
  if (!s) throw new Error('unknown station');
  return {
    code: s.scode,
    de: s['smetadata.name_de'] || s.sname,
    it: s['smetadata.name_it'] || s.sname,
    alt: s['smetadata.altitude'] != null ? Number(s['smetadata.altitude']) : null,
    lat: s.scoordinate.y,
    lon: s.scoordinate.x
  };
}

// ---------- wind + air + pollen ----------
async function wind(code) {
  const now = Date.now();
  const from = iso(now - (HOURS + 2) * H), to = iso(now + H);
  const st = await stationInfo(code);

  const [windRes, airRes, pollenRes] = await Promise.allSettled([
    getJSON(`${ODH}/MeteoStation/wind-speed,wind-gust-speed,wind-direction/${from}/${to}?limit=-1&where=scode.eq.${q(`"${code}"`)},mperiod.eq.600&select=tname,mvalue,mvalidtime`),
    air(st, from, to),
    pollen(st)
  ]);
  if (windRes.status !== 'fulfilled') throw windRes.reason;

  // hourly buckets of the 10-minute values
  const buckets = new Map();
  let latest = 0;
  for (const m of windRes.value.data) {
    const t = odhTime(m.mvalidtime), v = Number(m.mvalue);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    latest = Math.max(latest, t);
    const h = Math.floor(t / H) * H;
    let b = buckets.get(h);
    if (!b) buckets.set(h, (b = { s: [], g: [], d: [] }));
    if (m.tname === 'wind-speed') b.s.push({ t, v });
    else if (m.tname === 'wind-gust-speed') b.g.push(v);
    else if (m.tname === 'wind-direction') b.d.push({ t, v });
  }
  if (!latest) throw new Error('no wind data for this station');
  const lastHour = Math.floor(latest / H) * H;

  const airData = airRes.status === 'fulfilled' ? airRes.value : null;
  const pol = pollenRes.status === 'fulfilled' ? pollenRes.value : null;

  const rows = [];
  // last measured air value per pollutant, carried forward with the hour it was measured
  const carry = Object.fromEntries(AQ_KEYS.map((k) => [k, { v: null, t: null }]));
  // walk the hours before the window too, so values can be carried into it
  for (let h = lastHour - (HOURS + AQ_HOLD_H) * H; h <= lastHour; h += H) {
    const a = airData && airData.byHour.get(h);
    for (const k of AQ_KEYS) if (a && a[k] != null) carry[k] = { v: a[k], t: h };
    if (h <= lastHour - HOURS * H) continue;
    const b = buckets.get(h);
    const speeds = b ? b.s.map((x) => x.v) : [];
    const ws = speeds.length ? speeds.reduce((x, y) => x + y, 0) / speeds.length : null;
    const gust = b && b.g.length ? Math.max(...b.g) : ws;
    let dir = null;
    if (b && b.d.length) {
      // vector mean, weighted by the speed measured at the same time
      let sx = 0, cy = 0;
      for (const d of b.d) {
        const sp = b.s.find((x) => x.t === d.t);
        const w = sp ? Math.max(sp.v, 0.1) : 1, r = d.v * Math.PI / 180;
        sx += Math.sin(r) * w; cy += Math.cos(r) * w;
      }
      dir = (Math.atan2(sx, cy) * 180 / Math.PI + 360) % 360;
    }
    const p = pol && pol.byHour.get(h);
    const fresh = (k) => carry[k].t != null && h - carry[k].t <= AQ_HOLD_H * H;
    const aq = (k) => (fresh(k) ? carry[k].v : null);
    // hour of the newest air value shown in this row (null: none)
    const aqTimes = AQ_KEYS.filter(fresh).map((k) => carry[k].t);
    rows.push({
      time: iso(h),
      wind_kmh: round(ws == null ? null : ws * 3.6),
      gust_kmh: round(gust == null ? null : gust * 3.6),
      dir_deg: dir == null ? null : Math.round(dir),
      no2_ugm3: round(aq('no2')),
      pm10_ugm3: round(aq('pm10')),
      pm25_ugm3: round(aq('pm25')),
      o3_ugm3: round(aq('o3')),
      so2_ugm3: round(aq('so2')),
      aq_time: aqTimes.length ? iso(Math.max(...aqTimes)) : null,
      pollen_m3: p ? round(p.total, 0) : null,
      pollen_top: p ? p.top : null
    });
  }

  return {
    station: st,
    latest: iso(latest),
    air: airData ? airData.stations : [],
    pollen: pol ? { source: 'CAMS Europe via Open-Meteo', model: true } : null,
    generated: iso(now),
    rows
  };
}

async function air(st, from, to) {
  const list = await getJSON(`${ODH}/EnvironmentStation?limit=-1&where=sactive.eq.true,sorigin.eq.APPABZ&select=scode,sname,scoordinate`);
  const cands = list.data
    .filter((s) => s.scoordinate && s.scoordinate.y > 40)
    .map((s) => ({ code: s.scode, name: s.sname, km: distKm(st, { lat: s.scoordinate.y, lon: s.scoordinate.x }) }))
    .filter((c) => c.km <= AQ_MAX_KM)
    .sort((a, b) => a.km - b.km);
  if (!cands.length) return null;
  const types = Object.values(AQ_TYPES).map(q).join(',');
  const d = await getJSON(`${ODH}/EnvironmentStation/${types}/${from}/${to}?limit=-1&where=scode.in.(${cands.map((c) => c.code).join(',')}),mperiod.eq.3600&select=scode,tname,mvalue,mvalidtime`);
  // per station and pollutant: hour → value
  const got = new Map();
  for (const m of d.data || []) {
    const k = AQ_KEYS.find((x) => AQ_TYPES[x] === m.tname), v = Number(m.mvalue);
    if (!k || !Number.isFinite(v)) continue;
    const key = `${m.scode}|${k}`;
    if (!got.has(key)) got.set(key, new Map());
    got.get(key).set(Math.floor(odhTime(m.mvalidtime) / H) * H, v);
  }
  // each pollutant from the nearest station that actually delivered it
  const byHour = new Map(), used = new Map();
  for (const k of AQ_KEYS) {
    const c = cands.find((x) => got.has(`${x.code}|${k}`));
    if (!c) continue;
    for (const [h, v] of got.get(`${c.code}|${k}`)) {
      if (!byHour.has(h)) byHour.set(h, {});
      byHour.get(h)[k] = v;
    }
    if (!used.has(c.code)) used.set(c.code, { code: c.code, name: c.name, km: round(c.km), values: [] });
    used.get(c.code).values.push(k);
  }
  if (!used.size) return null;
  return { stations: [...used.values()], byHour };
}

async function pollen(st) {
  const hourly = POLLEN_TYPES.map((t) => `${t}_pollen`).join(',');
  const d = await getJSON(`${POLLEN_API}?latitude=${st.lat}&longitude=${st.lon}&hourly=${hourly}&past_days=3&forecast_days=1&timezone=GMT`, 8000);
  const byHour = new Map();
  const T = d.hourly && d.hourly.time;
  if (!T) return null;
  T.forEach((t, i) => {
    let total = 0, top = null, topV = 0, any = false;
    for (const ty of POLLEN_TYPES) {
      const v = d.hourly[`${ty}_pollen`] && d.hourly[`${ty}_pollen`][i];
      if (v == null) continue;
      any = true; total += v;
      if (v > topV) { topV = v; top = ty; }
    }
    if (any) byHour.set(Date.parse(t + ':00Z'), { total, top: topV >= 1 ? top : null });
  });
  return { byHour };
}
