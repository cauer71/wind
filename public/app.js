// Wind Südtirol – silk ribbon driven by live data from /api/wind (open data of the Province of Bolzano)
(function () {
  const TAU = Math.PI * 2, CAMZ = 3.0;
  // every page runs once in each language: 3 × 5 s
  const STEP_ROW = 8000, LANG_MS = 5000, LANGS = ['de', 'it', 'en'], PAGE_MS = [15000, 15000, 15000, 15000, 15000], NPAGE = PAGE_MS.length;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v) => { const n = v == null ? NaN : Number(v); return Number.isFinite(n) ? n : 0; };
  const has = (v) => v != null && v !== '' && Number.isFinite(Number(v));

  // ---------- language ----------
  const I18N = {
    de: { avgLong: 'Mittel 48 h', windTitle: 'Windgeschwindigkeit', airTitle: 'Luftqualität', polTitle: 'Pollen und Sporen', now: 'Jetzt', gust: 'Böen', avg: 'Ø 48 h', avgPm: 'Ø 48 h PM10', avgPol: 'Ø 48 h Pollen', pm10: 'Feinstaub PM10', pollen: 'Pollen', spores: 'Sporen', sub: 'Wind, Luft und Pollen über Bozen', sample: 'Beispieldaten', pause: 'Pause', play: 'Abspielen', live: 'Live', replay: 'Verlauf', back: 'Zurück zu Live', play: 'Verlauf abspielen', polTitle: 'Pollen und Feinstaub', subT: 'Wind, Luft und Pollen über {p}', none: 'kaum Pollen', alder: 'Erle', birch: 'Birke', grass: 'Gräser', mugwort: 'Beifuß', olive: 'Olive', ragweed: 'Ambrosia', pollenU: 'Pollen', no2Title: 'Stickstoffdioxid', no2Lab: 'NO₂', avgMax: 'Mittel · Max 48 h', o3so2: 'Ozon · Schwefeldioxid', o3: 'Ozon', so2: 'Schwefeldioxid', polTitle: 'Pollen', eaqi: ['gut', 'mittelmäßig', 'mäßig', 'schlecht', 'sehr schlecht', 'extrem schlecht'] },
    it: { avgLong: 'Media 48 h', windTitle: 'Velocità del vento', airTitle: "Qualità dell'aria", polTitle: 'Pollini e spore', now: 'Ora', gust: 'Raffiche', avg: 'Ø 48 h', avgPm: 'Ø 48 h PM10', avgPol: 'Ø 48 h pollini', pm10: 'Polveri sottili PM10', pollen: 'Pollini', spores: 'Spore', sub: 'Vento, aria e pollini sopra Bolzano', sample: 'Dati di esempio', pause: 'Pausa', play: 'Avvia', live: 'Live', replay: 'Storico', back: 'Torna al live', play: 'Riproduci storico', polTitle: 'Pollini e polveri', subT: 'Vento, aria e pollini sopra {p}', none: 'pochi pollini', alder: 'Ontano', birch: 'Betulla', grass: 'Graminacee', mugwort: 'Artemisia', olive: 'Olivo', ragweed: 'Ambrosia', pollenU: 'Pollini', no2Title: 'Biossido di azoto', no2Lab: 'NO₂', avgMax: 'Media · max 48 h', o3so2: 'Ozono · biossido di zolfo', o3: 'Ozono', so2: 'Biossido di zolfo', polTitle: 'Pollini', eaqi: ['buona', 'discreta', 'moderata', 'scadente', 'molto scadente', 'estremamente scadente'] },
    en: { avgLong: '48 h average', windTitle: 'Wind speed', airTitle: 'Air quality', polTitle: 'Pollen and spores', now: 'Now', gust: 'Gusts', avg: '48 h avg', avgPm: '48 h avg PM10', avgPol: '48 h avg pollen count', pm10: 'Particulates PM10', pollen: 'Pollen count', spores: 'Spores', sub: 'Wind, air and pollen above Bolzano', sample: 'Sample data', pause: 'Pause', play: 'Play', live: 'Live', replay: 'History', back: 'Back to live', play: 'Play history', polTitle: 'Pollen and particulates', subT: 'Wind, air and pollen over {p}', none: 'low pollen', alder: 'Alder', birch: 'Birch', grass: 'Grass', mugwort: 'Mugwort', olive: 'Olive', ragweed: 'Ragweed', pollenU: 'Pollen', no2Title: 'Nitrogen dioxide', no2Lab: 'NO₂', avgMax: '48 h average · max', o3so2: 'Ozone · sulphur dioxide', o3: 'Ozone', so2: 'Sulphur dioxide', polTitle: 'Pollen', eaqi: ['good', 'fair', 'moderate', 'poor', 'very poor', 'extremely poor'] }
  };
  const COMPASS = {
    de: ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'],
    it: ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'],
    en: ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  };
  const LOC = { de: 'de-DE', it: 'it-IT', en: 'en-GB' };
  let lang = 'de', nf1, nf0;
  const TF = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Rome' });
  function makeFmt() {
    nf1 = new Intl.NumberFormat(LOC[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    nf0 = new Intl.NumberFormat(LOC[lang], { maximumFractionDigits: 0 });
  }
  makeFmt();
  const FMT = {
    time: (v) => {
      // same in all three languages: day.month. hour:minute (Bozen time)
      const p = Object.fromEntries(TF.formatToParts(new Date(v)).map((x) => [x.type, x.value]));
      return `${p.day}.${p.month}. ${p.hour}:${p.minute}`;
    },
    wind_kmh: (v) => nf1.format(v), gust_kmh: (v) => nf1.format(v),
    dir_deg: (v) => nf0.format(v), pm10_ugm3: (v) => nf0.format(v), no2_ugm3: (v) => nf0.format(v),
    pollen_m3: (v) => nf0.format(v), pm25_ugm3: (v) => nf0.format(v), o3_ugm3: (v) => nf0.format(v), so2_ugm3: (v) => nf1.format(v)
  };
  const AVG_FMT = (v, f) => (v == null ? '—' : f === 'dir_deg' ? nf0.format(v) : nf1.format(v));

  // ---------- elements ----------
  const box = document.getElementById('wv-canvas-box');
  let canvas = document.getElementById('wv-canvas');
  const stage = document.getElementById('wind-stage');
  const hud = document.getElementById('wind-hud');
  const titleCard = document.getElementById('wv-titlecard');
  const pageEls = Array.from(hud.querySelectorAll('.wv-page'));
  const hudBody = hud.querySelector('.wv-hud-body');
  const titleSub = titleCard.querySelector('.wv-t-sub');
  const playBtn = document.getElementById('wv-play');
  const compassEl = document.getElementById('wv-compass');
  const compassAvgEl = document.getElementById('wv-compass-avg');
  const pgBtn = document.getElementById('wv-pg');
  const dirMark = document.getElementById('wv-dirmark');
  const gaugeG = document.getElementById('wv-gaugeg');
  const gaugeTrack = document.getElementById('wv-gauge-track');
  const gaugeVal = document.getElementById('wv-gauge-val');
  const rowMarks = Array.from(stage.querySelectorAll('[data-f]'));
  const avgMarks = Array.from(stage.querySelectorAll('[data-avg]'));
  const maxMarks = Array.from(stage.querySelectorAll('[data-max]'));
  const needEls = Array.from(stage.querySelectorAll('[data-need]'));
  const langBtns = Array.from(hud.querySelectorAll('.wv-lang'));
  // the spinning arc slides from one language dot to the next instead of jumping
  const langInd = hud.querySelector('.wv-lang-ind');
  function updateLangInd() {
    const b = langBtns.find((x) => x.dataset.lang === lang);
    if (b) langInd.style.transform = `translateX(${b.offsetLeft}px)`;
  }

  // ---------- state ----------
  const S = { wind: 3, gust: 5, dirX: 0.4, dirY: 0, flowSign: 1, aqN: 0.25, aqP: 0.25, pollen: 0, spores: 0, gauge: 0, dirA: 0 };
  const T = Object.assign({}, S);
  const G = { windN: 0, turb: 0, amp: 0.3, wid: 1 };
  let rows = [], idx = 0, page = 0, playing = false;   // playing = replay of the last 48 h, otherwise live
  let lastRow = performance.now(), lastPage = performance.now(), lastLang = performance.now();
  let W = 0, H = 0, aspect = 2, dpr = 1, phase = 0, time = 0, hudScale = 1;
  const hudPos = { x: 0, y: 0, init: false };

  function setTargets(r) {
    T.wind = num(r.wind_kmh);
    T.gust = num(r.gust_kmh);
    const deg = num(r.dir_deg), a = deg * Math.PI / 180;   // direction the wind comes from
    T.dirX = -Math.sin(a);
    T.dirY = Math.cos(a);
    T.flowSign = T.dirX >= -0.05 ? 1 : -1;
    // 1 = upper end of 'moderate' in the European Air Quality Index (NO₂ 120, PM10 50, PM2.5 25 µg/m³)
    T.aqN = clamp(num(r.no2_ugm3) / 120, 0, 1.2);
    T.aqP = clamp(Math.max(num(r.pm10_ugm3) / 50, num(r.pm25_ugm3) / 25), 0, 1.2);
    T.pollen = num(r.pollen_m3);
    T.spores = num(r.pm25_ugm3);   // fine dust drifts as light-blue specks
    // shortest way round for the direction marker
    let d = deg - (((T.dirA % 360) + 360) % 360);
    if (d > 180) d -= 360; if (d < -180) d += 360;
    T.dirA = T.dirA + d;
  }

  // ---------- palettes (per page) ----------
  // front/back: the two sides of the silk, deep: folds in shadow, rim: glow on folds and edges
  const PAL = {
    wind:   { front: [0.93, 0.93, 1.0],  back: [0.62, 0.64, 0.95], deep: [0.36, 0.37, 0.74], rim: [1.0, 1.0, 1.0],    rimAmt: 0.22, bg: [0.050, 0.053, 0.072], irid: 0.45, part: 0.28, op: 1.0 },
    good:   { front: [0.87, 0.99, 0.97], back: [0.48, 0.80, 0.88], deep: [0.16, 0.38, 0.48], rim: [0.90, 1.0, 0.98],  rimAmt: 0.25, bg: [0.040, 0.055, 0.065], irid: 0.40, part: 0.28, op: 1.0 },
    mid:    { front: [1.0, 0.95, 0.84],  back: [0.91, 0.73, 0.58], deep: [0.50, 0.33, 0.36], rim: [1.0, 0.96, 0.85],  rimAmt: 0.25, bg: [0.060, 0.048, 0.050], irid: 0.40, part: 0.28, op: 1.0 },
    bad:    { front: [1.0, 0.86, 0.92],  back: [0.88, 0.48, 0.66], deep: [0.48, 0.16, 0.34], rim: [1.0, 0.88, 0.95],  rimAmt: 0.25, bg: [0.062, 0.035, 0.048], irid: 0.40, part: 0.28, op: 1.0 },
    pollen: { front: [0.26, 0.56, 1.0],  back: [0.13, 0.30, 0.92], deep: [0.03, 0.08, 0.40], rim: [0.42, 1.0, 0.86],  rimAmt: 0.70, bg: [0.012, 0.022, 0.060], irid: 0.30, part: 0.95, op: 0.93 }
  };
  const lerpA = (a, b, f) => a.map((x, i) => x + (b[i] - x) * f);
  const lerpN = (a, b, f) => a + (b - a) * f;
  function mixPal(a, b, f) {
    return { front: lerpA(a.front, b.front, f), back: lerpA(a.back, b.back, f), deep: lerpA(a.deep, b.deep, f), rim: lerpA(a.rim, b.rim, f), bg: lerpA(a.bg, b.bg, f),
      rimAmt: lerpN(a.rimAmt, b.rimAmt, f), irid: lerpN(a.irid, b.irid, f), part: lerpN(a.part, b.part, f), op: lerpN(a.op, b.op, f) };
  }
  function palTarget() {
    const aqPal = (q) => (q < 0.5 ? mixPal(PAL.good, PAL.mid, q / 0.5) : mixPal(PAL.mid, PAL.bad, clamp((q - 0.5) / 0.5, 0, 1)));
    if (page === 2) return aqPal(S.aqN);
    if (page === 3) return aqPal(S.aqP);
    if (page === 4) return PAL.pollen;
    return PAL.wind;
  }
  let PC = mixPal(PAL.wind, PAL.wind, 0);

  // ---------- ribbon geometry (mirrors the vertex shader) ----------
  // alpha: how much of the cloth shows. GHOST draws every layer faintly (so folds behind shine through),
  // NEAR then lays the front-most layer on top – together a single layer covers about 70 %.
  const SHEETS = [
    { seed: 2.7, yoff: -0.28, zoff: -0.7, ascale: 0.8, wscale: 0.7, alpha: 0.9 },
    { seed: 0.0, yoff: 0.05,  zoff: 0.0,  ascale: 1.0, wscale: 1.0, alpha: 1.0 }
  ];
  const GHOST = 0.34, NEAR = 0.56;
  const MAIN = SHEETS[1];
  function P(u, v, sh) {
    const ph = phase + sh.seed, t = time, amp = G.amp * sh.ascale, wid = G.wid * sh.wscale, turb = G.turb;
    const x = (u * 2.6 - 1.3) * aspect;
    const y = sh.yoff + amp * (0.55 * Math.sin(u * 5.3 - ph * 0.9 + 0.3) + 0.30 * Math.sin(u * 11.1 - ph * 1.37 + 1.9) + turb * 0.16 * Math.sin(u * 23.0 - ph * 2.3 + t * 1.1)) + S.dirY * (u - 0.5) * 0.4;
    const z = sh.zoff + 0.35 * Math.sin(u * 4.1 - ph * 0.7 + 2.0) + 0.2 * Math.sin(u * 8.7 - ph * 1.1 + sh.seed);
    const th = 0.6 + 1.15 * Math.sin(u * 3.7 - ph * 0.6 + t * 0.07) + 0.6 * Math.sin(u * 7.9 - ph * 0.95 + 1.0);
    const w = wid * (0.78 + 0.22 * Math.sin(u * 4.9 - ph * 0.5 + 0.7));
    const ct = Math.cos(th), st = Math.sin(th);
    const fl = ((0.025 + 0.05 * turb) * Math.sin(u * 38.0 - ph * 3.1 + v * 5.0) + 0.035 * Math.sin(u * 17.0 - ph * 1.7 + v * 3.0 + t * 0.4)) * (0.4 + 2.4 * v * v);
    const cup = 0.35 * v * v * w * Math.sin(u * 3.0 - ph * 0.45 + 0.5);
    const pleat = 0.07 * w * Math.sin(v * 9.0 + 1.6 * Math.sin(u * 4.0 - ph * 0.55) + u * 2.0);
    const wr = 0.011 * Math.sin(v * 31.0 + 2.0 * Math.sin(u * 9.0 - ph * 0.8) + u * 5.0);
    const n = fl + cup + pleat + wr;
    return [x, y + ct * v * w - st * n, z + st * v * w + ct * n];
  }
  function proj(p) {
    const w = CAMZ - p[2];
    return [(p[0] * CAMZ / aspect / w * 0.5 + 0.5) * W, (0.5 - p[1] * CAMZ / w * 0.5) * H];
  }

  // ---------- particles ----------
  const POOL_P = 220, POOL_S = 320, POOL = POOL_P + POOL_S;
  const parts = [];
  const pData = new Float32Array(POOL * 4);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let k = 0; k < POOL; k++) {
    const pol = k < POOL_P;
    parts.push({ x: rnd(-1, 1), y: rnd(-1.05, 1.05), z: rnd(-1.2, 0.9), sp: rnd(0.6, 1.5), size: pol ? rnd(2.2, 4.2) : rnd(1.1, 2.2), ph: rnd(0, TAU), f: rnd(0.3, 1.1) });
  }

  // ---------- WebGL ----------
  const VS = [
    'attribute vec2 a_uv;',
    'uniform float u_t, u_ph, u_amp, u_turb, u_tilt, u_wid, u_aspect, u_seed, u_yoff, u_zoff;',
    'varying vec3 v_p; varying vec3 v_n; varying vec3 v_t; varying vec2 v_uv;',
    'const float CAMZ = 3.0;',
    'vec3 P(float u, float v) {',
    '  float ph = u_ph + u_seed;',
    '  float x = (u * 2.6 - 1.3) * u_aspect;',
    '  float y = u_yoff + u_amp * (0.55 * sin(u * 5.3 - ph * 0.9 + 0.3) + 0.30 * sin(u * 11.1 - ph * 1.37 + 1.9) + u_turb * 0.16 * sin(u * 23.0 - ph * 2.3 + u_t * 1.1)) + u_tilt * (u - 0.5) * 0.4;',
    '  float z = u_zoff + 0.35 * sin(u * 4.1 - ph * 0.7 + 2.0) + 0.2 * sin(u * 8.7 - ph * 1.1 + u_seed);',
    '  float th = 0.6 + 1.15 * sin(u * 3.7 - ph * 0.6 + u_t * 0.07) + 0.6 * sin(u * 7.9 - ph * 0.95 + 1.0);',
    '  float w = u_wid * (0.78 + 0.22 * sin(u * 4.9 - ph * 0.5 + 0.7));',
    '  float ct = cos(th); float st = sin(th);',
    '  float fl = ((0.025 + 0.05 * u_turb) * sin(u * 38.0 - ph * 3.1 + v * 5.0) + 0.035 * sin(u * 17.0 - ph * 1.7 + v * 3.0 + u_t * 0.4)) * (0.4 + 2.4 * v * v);',
    '  float cup = 0.35 * v * v * w * sin(u * 3.0 - ph * 0.45 + 0.5);',
    '  float pleat = 0.07 * w * sin(v * 9.0 + 1.6 * sin(u * 4.0 - ph * 0.55) + u * 2.0);',
    '  float wr = 0.011 * sin(v * 31.0 + 2.0 * sin(u * 9.0 - ph * 0.8) + u * 5.0);',
    '  float n = fl + cup + pleat + wr;',
    '  return vec3(x, y + ct * v * w - st * n, z + st * v * w + ct * n);',
    '}',
    'void main() {',
    '  float u = a_uv.x; float v = a_uv.y;',
    '  vec3 p = P(u, v);',
    '  vec3 e1 = P(u + 0.002, v) - P(u - 0.002, v);',
    '  vec3 e2 = P(u, v + 0.015) - P(u, v - 0.015);',
    '  v_n = normalize(cross(e1, e2));',
    '  v_t = normalize(e1);',
    '  v_p = p; v_uv = a_uv;',
    '  float w = CAMZ - p.z;',
    '  float zn = clamp((w - 3.0) / 2.5, -0.99, 0.99);',
    '  gl_Position = vec4(p.x * CAMZ / u_aspect, p.y * CAMZ, zn * w, w);',
    '}'
  ].join('\n');
  const FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec3 u_front, u_back, u_deep, u_rim;',
    'uniform float u_irid, u_alpha, u_rimAmt, u_t, u_ph;',
    'varying vec3 v_p; varying vec3 v_n; varying vec3 v_t; varying vec2 v_uv;',
    'const float CAMZ = 3.0;',
    'void main() {',
    '  vec3 V = normalize(vec3(0.0, 0.0, CAMZ) - v_p);',
    '  vec3 N = normalize(v_n);',
    '  float side = dot(N, V) >= 0.0 ? 1.0 : 0.0;',
    '  if (side < 0.5) N = -N;',
    '  vec3 T = normalize(v_t);',
    '  vec3 B = normalize(cross(N, T));',
    // fine silk threads running along the length, only visible in the sheen
    '  float th1 = sin(v_uv.y * 230.0 + sin(v_uv.x * 26.0 - u_ph * 1.3) * 2.5);',
    '  float th2 = sin(v_uv.y * 77.0 + v_uv.x * 7.0 - u_ph * 0.5);',
    '  vec3 Np = normalize(N + B * (0.07 * th1 + 0.05 * th2));',
    '  vec3 L = normalize(vec3(-0.35, 0.8, 0.55));',
    '  vec3 L2 = normalize(vec3(0.6, -0.2, 0.75));',
    '  vec3 Hh = normalize(L + V);',
    '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
    '  float fres = pow(1.0 - ndv, 3.0);',
    '  float wrap = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);',
    '  float fill = clamp(dot(N, L2) * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 face = mix(u_back, u_front, side);',
    '  vec3 col = mix(u_deep, face, smoothstep(0.0, 1.0, wrap));',
    '  col += face * 0.12 * fill;',
    '  float nh = max(dot(Np, Hh), 0.0);',
    '  col += vec3(1.0) * (pow(nh, 22.0) * 0.26 + pow(nh, 140.0) * 0.55);',
    '  float edge = smoothstep(0.455, 0.5, abs(v_uv.y));',
    '  col = mix(col, u_rim, clamp(fres * 0.9 + edge * 0.7, 0.0, 1.0) * u_rimAmt);',
    '  float hue = ndv * 2.6 + v_uv.x * 1.7 + v_uv.y * 1.1 + u_t * 0.025;',
    '  vec3 irid = 0.5 + 0.5 * cos(6.2832 * (hue + vec3(0.0, 0.33, 0.67)));',
    '  col = mix(col, col * 0.7 + irid * 0.45, u_irid * clamp(fres * 0.9 + edge * 0.4, 0.0, 1.0));',
    // thin bright creases running along the cloth, like satin catching the light
    '  float cr = pow(abs(sin(v_uv.y * 23.0 + sin(v_uv.x * 7.0 - u_ph * 0.7) * 1.5)), 30.0);',
    '  col += face * cr * 0.12;',
    '  col *= 0.96 + 0.04 * th1;',
    '  float a = clamp(u_alpha + fres * 0.08, 0.0, 1.0);',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * a, a);',
    '}'
  ].join('\n');
  const PVS = [
    'attribute vec4 a_q;',
    'uniform float u_aspect, u_dpr;',
    'const float CAMZ = 3.0;',
    'void main() {',
    '  float w = CAMZ - a_q.z;',
    '  float zn = clamp((w - 3.0) / 2.5, -0.99, 0.99);',
    '  gl_Position = vec4(a_q.x * CAMZ / u_aspect, a_q.y * CAMZ, zn * w, w);',
    '  gl_PointSize = a_q.w * u_dpr * CAMZ / w;',
    '}'
  ].join('\n');
  const PFS = [
    'precision mediump float;',
    'uniform vec4 u_col;',
    'void main() {',
    '  float d = length(gl_PointCoord - vec2(0.5));',
    '  float a = (1.0 - smoothstep(0.05, 0.5, d)) * u_col.a;',
    '  gl_FragColor = vec4(u_col.rgb * a, a);',
    '}'
  ].join('\n');

  let gl = null, ctx2d = null, prog, pprog, L = {}, PL = {}, uvBuf, idxBuf, idxCount = 0, pBuf;
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    return p;
  }
  function initGL() {
    prog = link(VS, FS);
    L.a_uv = gl.getAttribLocation(prog, 'a_uv');
    ['u_t','u_ph','u_amp','u_turb','u_tilt','u_wid','u_aspect','u_seed','u_yoff','u_zoff','u_front','u_back','u_deep','u_rim','u_rimAmt','u_irid','u_alpha'].forEach((n) => { L[n] = gl.getUniformLocation(prog, n); });
    const NU = 300, NV = 48;
    const uv = new Float32Array((NU + 1) * (NV + 1) * 2);
    let o = 0;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { uv[o++] = i / NU; uv[o++] = j / NV - 0.5; }
    const idx = new Uint16Array(NU * NV * 6);
    o = 0;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx[o++] = a; idx[o++] = b; idx[o++] = a + 1; idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1;
    }
    idxCount = idx.length;
    uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    pprog = link(PVS, PFS);
    PL.a_q = gl.getAttribLocation(pprog, 'a_q');
    ['u_aspect','u_dpr','u_col'].forEach((n) => { PL[n] = gl.getUniformLocation(pprog, n); });
    pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pData, gl.DYNAMIC_DRAW);
  }
  try {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl');
    if (gl) initGL();
  } catch (e) { gl = null; }
  if (!gl) {
    const c2 = document.createElement('canvas');
    c2.className = 'wv-canvas'; c2.setAttribute('aria-label', 'Animiertes Windband');
    canvas.replaceWith(c2); canvas = c2;
    ctx2d = canvas.getContext('2d');
  }

  // ---------- sizing ----------
  function resize() {
    const w = box.clientWidth;
    if (!w) return;
    // in fullscreen the ribbon fills the whole screen, otherwise a wide band
    const h = isFull() ? Math.max(300, Math.round(window.innerHeight)) : Math.round(clamp(w * 0.45, 300, 600));
    if (w === W && h === H) return;
    W = w; H = h; aspect = W / H;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    box.style.height = H + 'px';
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    stage.style.setProperty('--wv-k', String(W / 1000));
    hudScale = isFull() ? clamp(Math.min(W / 1050, H / 520), 0.6, 1.6) : clamp(W / 1050, 0.6, 1.15);
    hudPos.init = false;
    if (waves) waves.resize(W, H, dpr);
    wavesDirty = true;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box);
  window.addEventListener('resize', resize);

  // ---------- second animation: soft silk waves ----------
  // The wind ribbon ('silk') or a calm loop of silk waves ('waves', waves.js) fills the stage; the switch
  // cross-fades the two canvases, and both are drawn only while one is visible or fading.
  const wavesCanvas = document.getElementById('wv-waves');
  const animBtn = document.getElementById('wv-anim');
  const FADE_MS = 1300;
  let waves = null, wavesDirty = true, animMode = 'silk', fadeUntil = 0;
  try { waves = typeof window.createWaves === 'function' ? window.createWaves(wavesCanvas, {}) : null; } catch (e) { waves = null; }
  if (!waves) { animBtn.hidden = true; wavesCanvas.remove(); }
  function setAnim(mode, instant) {
    if (!waves) mode = 'silk';
    if (mode === animMode && !instant) return;
    animMode = mode;
    fadeUntil = instant ? 0 : performance.now() + FADE_MS;
    stage.classList.toggle('is-waves', mode === 'waves');
    animBtn.setAttribute('aria-pressed', String(mode === 'waves'));
    animBtn.title = mode === 'waves' ? 'Animation wechseln: Windband (A)' : 'Animation wechseln: Wellen (A)';
    try { localStorage.setItem('wind-anim', mode); } catch (e) { /* private mode */ }
    hudPos.init = false; wavesDirty = true; dirty = true;
  }
  animBtn.addEventListener('click', () => setAnim(animMode === 'waves' ? 'silk' : 'waves'));

  // ---------- fullscreen ----------
  // native fullscreen where the browser has it (desktop, Android, iPad); on iPhone the stage
  // covers the viewport instead
  const fsBtn = document.getElementById('wv-fs');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const canNativeFs = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
  function isFull() { return fsEl() === stage || stage.classList.contains('wv-fs'); }
  function setFull(on) {
    if (on === isFull()) return;
    if (canNativeFs) {
      if (on) {
        const r = (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
        if (r && r.catch) r.catch(() => { stage.classList.add('wv-fs'); onFullChange(); });
      } else if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { stage.classList.remove('wv-fs'); onFullChange(); }
    } else {
      stage.classList.toggle('wv-fs', on);
      document.documentElement.classList.toggle('wv-noscroll', on);
      onFullChange();
    }
  }
  function onFullChange() {
    const on = isFull();
    stage.classList.toggle('is-full', on);
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.title = on ? 'Vollbild beenden (F / Esc)' : 'Vollbild (F)';
    W = 0; resize();
  }
  document.addEventListener('fullscreenchange', onFullChange);
  document.addEventListener('webkitfullscreenchange', onFullChange);
  const toggleFull = () => { const on = !isFull(); setFull(on); if (on && window.wvSound) window.wvSound.gesture(); };
  fsBtn.addEventListener('click', toggleFull);
  stage.addEventListener('dblclick', (ev) => { if (!ev.target.closest('button, select, a')) toggleFull(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
    if ((ev.key === 'f' || ev.key === 'F') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) toggleFull();
    else if ((ev.key === 'a' || ev.key === 'A') && !ev.metaKey && !ev.ctrlKey && !ev.altKey && waves) setAnim(animMode === 'waves' ? 'silk' : 'waves');
    else if (ev.key === 'Escape' && stage.classList.contains('wv-fs')) setFull(false);
  });

  // ---------- rendering ----------
  const POL_COL = [1.0, 0.86, 0.45], SPO_COL = [0.72, 0.93, 1.0];
  function particleCounts() {
    return [Math.round(clamp(S.pollen / 80, 0, 1) * POOL_P), Math.round(clamp(S.spores / 25, 0, 1) * POOL_S)];
  }
  function stepParticles(dt) {
    const vx = S.flowSign * (0.04 + 0.5 * G.windN) * (0.55 + 0.45 * Math.abs(S.dirX));
    const vy = -S.dirY * (0.015 + 0.12 * G.windN);
    const lim = aspect * 1.35;
    for (let k = 0; k < POOL; k++) {
      const p = parts[k];
      p.x += vx * p.sp * dt; p.y += vy * p.sp * dt;
      if (p.x > lim) p.x -= 2 * lim; else if (p.x < -lim) p.x += 2 * lim;
      if (p.y > 1.15) p.y -= 2.3; else if (p.y < -1.15) p.y += 2.3;
      pData[k * 4] = p.x;
      pData[k * 4 + 1] = p.y + Math.sin(time * p.f + p.ph) * 0.025;
      pData[k * 4 + 2] = p.z;
      pData[k * 4 + 3] = p.size;
    }
  }
  function renderGL() {
    const pal = PC;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(pal.bg[0], pal.bg[1], pal.bg[2], 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(L.a_uv);
    gl.vertexAttribPointer(L.a_uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.uniform1f(L.u_t, time); gl.uniform1f(L.u_ph, phase); gl.uniform1f(L.u_turb, G.turb);
    gl.uniform1f(L.u_tilt, S.dirY); gl.uniform1f(L.u_aspect, aspect);
    gl.uniform3fv(L.u_front, pal.front); gl.uniform3fv(L.u_back, pal.back); gl.uniform3fv(L.u_deep, pal.deep);
    gl.uniform3fv(L.u_rim, pal.rim); gl.uniform1f(L.u_rimAmt, pal.rimAmt);
    gl.uniform1f(L.u_irid, pal.irid);
    const drawSheets = (alpha) => {
      for (const sh of SHEETS) {
        gl.uniform1f(L.u_seed, sh.seed); gl.uniform1f(L.u_yoff, sh.yoff); gl.uniform1f(L.u_zoff, sh.zoff);
        gl.uniform1f(L.u_amp, G.amp * sh.ascale); gl.uniform1f(L.u_wid, G.wid * sh.wscale); gl.uniform1f(L.u_alpha, alpha * sh.alpha * pal.op);
        gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
      }
    };
    // 1) every layer, faintly, no depth test: hidden folds shine through
    gl.disable(gl.DEPTH_TEST);
    drawSheets(GHOST);
    // 2) depth only: find the front-most layer
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    drawSheets(1);
    // 3) the front-most layer on top
    gl.colorMask(true, true, true, true);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    drawSheets(NEAR);
    gl.disableVertexAttribArray(L.a_uv);
    // particles
    const [nP, nS] = particleCounts();
    gl.useProgram(pprog);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pData);
    gl.enableVertexAttribArray(PL.a_q);
    gl.vertexAttribPointer(PL.a_q, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1f(PL.u_aspect, aspect); gl.uniform1f(PL.u_dpr, dpr);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (nP) { gl.uniform4f(PL.u_col, POL_COL[0], POL_COL[1], POL_COL[2], 0.9 * pal.part); gl.drawArrays(gl.POINTS, 0, nP); }
    if (nS) { gl.uniform4f(PL.u_col, SPO_COL[0], SPO_COL[1], SPO_COL[2], 0.65 * pal.part); gl.drawArrays(gl.POINTS, POOL_P, nS); }
    gl.disableVertexAttribArray(PL.a_q);
    gl.depthMask(true);
  }
  const rgbS = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  function render2d() {
    const c = ctx2d, pal = PC;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = rgbS(pal.bg, 1); c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = 1;
    const N = W < 520 ? 26 : 44;
    for (const sh of SHEETS) {
      for (let s = 0; s < N; s++) {
        const v = s / (N - 1) - 0.5;
        c.strokeStyle = rgbS(lerpA(pal.back, pal.front, s / (N - 1)), 0.2 * sh.alpha + 0.03);
        c.beginPath();
        for (let i = 0; i <= 120; i++) {
          const q = proj(P(0.08 + 0.84 * i / 120, v, sh));
          if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
        }
        c.stroke();
      }
    }
    const [nP, nS] = particleCounts();
    for (let k = 0; k < POOL; k++) {
      if (k < POOL_P ? k >= nP : k - POOL_P >= nS) continue;
      const q = proj([pData[k * 4], pData[k * 4 + 1], pData[k * 4 + 2]]);
      c.fillStyle = rgbS(k < POOL_P ? POL_COL : SPO_COL, (k < POOL_P ? 0.9 : 0.6) * pal.part);
      c.beginPath(); c.arc(q[0], q[1], pData[k * 4 + 3] * 0.5, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---------- HUD ----------
  const arcGen = d3.arc().innerRadius(104).outerRadius(110).cornerRadius(3);
  const A0 = -150 * Math.PI / 180, SWEEP = Math.PI;
  gaugeTrack.setAttribute('d', arcGen({ startAngle: A0, endAngle: A0 + SWEEP }));
  function gaugeTarget() {
    if (page === 2) return clamp(T.aqN, 0.02, 1);
    if (page === 3) return clamp(T.aqP, 0.02, 1);
    if (page === 4) return clamp(T.pollen / 80, 0.02, 1);
    return 0;
  }
  // The ring rides on the cloth's centre line at position hudU (0…1 along the cloth) and slowly
  // wanders with the wind: east wind to the left, west wind to the right; one crossing takes about
  // 80 s in calm air and 30 s in strong wind. Near the edges it fades out, jumps to the other side
  // while invisible, and fades back in.
  let hudU = 0.5;
  const hudIn = document.createElement('div');
  hudIn.className = 'wv-hud-in';
  while (hud.firstChild) hudIn.appendChild(hud.firstChild);
  hud.appendChild(hudIn);
  const uAtFrac = (f) => (f - 0.5) / 1.3 + 0.5;   // screen fraction → position on the cloth (inverse of x = (2.6u − 1.3)·aspect)
  function updateHud(dt) {
    if (!W) return;
    const r = 120 * hudScale;
    const uMin = uAtFrac((r * 0.9) / W), uMax = uAtFrac(1 - (r * 0.9) / W);
    let edge = 1;
    if (!reduce && uMax - uMin > 0.2) {
      const across = 80 - 50 * Math.min(G.windN, 1);
      hudU += dt * S.flowSign * (uMax - uMin) / across;
      if (hudU > uMax) { hudU = uMin; hudPos.init = false; }
      else if (hudU < uMin) { hudU = uMax; hudPos.init = false; }
      const fz = Math.min(0.1, (uMax - uMin) / 4);
      edge = clamp((hudU - uMin) / fz, 0, 1) * clamp((uMax - hudU) / fz, 0, 1);
      edge = edge * edge * (3 - 2 * edge);
    } else {
      hudU = 0.5;
    }
    if (animMode === 'waves') edge = 1;
    hudIn.style.opacity = edge.toFixed(3);
    const p = animMode === 'waves' ? [W * 0.5, H * 0.5] : proj(P(hudU, 0, MAIN));   // waves: in the dark eye at the centre
    const loY = r + 34, hiY = H - r - 40;
    const tx = p[0];
    const ty = loY > hiY ? H / 2 : clamp(p[1], loY, hiY);
    if (!hudPos.init || reduce) { hudPos.x = tx; hudPos.y = ty; hudPos.init = true; }
    else { const k = 1 - Math.exp(-dt / 0.45); hudPos.x += (tx - hudPos.x) * k; hudPos.y += (ty - hudPos.y) * k; }
    hud.style.transform = `translate(${hudPos.x.toFixed(1)}px, ${hudPos.y.toFixed(1)}px) scale(${hudScale.toFixed(3)})`;
    dirMark.setAttribute('transform', `rotate(${S.dirA.toFixed(2)})`);
    dirMark.style.opacity = page === 1 ? 1 : 0;
    gaugeG.style.opacity = page >= 2 ? 1 : 0;
    gaugeVal.setAttribute('d', arcGen({ startAngle: A0, endAngle: A0 + SWEEP * clamp(S.gauge, 0.001, 1) }));
  }

  function setPage(i) {
    page = i;
    lastPage = performance.now();
    updateLangInd();
    titleCard.classList.toggle('is-on', page === 0);
    hud.classList.toggle('is-on', page !== 0);
    pageEls.forEach((el) => el.classList.toggle('is-on', Number(el.dataset.page) === page));
    pgBtn.textContent = `${page + 1}/${NPAGE}`;
    T.gauge = gaugeTarget();
    lastLang = lastPage;
    if (page === 0) {
      // every time the title appears, the next language is the big word; the other two stay small
      titleLang = LANGS[titleTurn++ % LANGS.length];
      if (lang !== titleLang) setLang(titleLang, false);
      renderTitle();
    } else if (lang !== LANGS[0]) setLang(LANGS[0], false);
    dirty = true;
  }
    // pages whose values the data sources do not have for this place are skipped
  const PAGE_FIELDS = { 1: ['wind_kmh'], 2: ['no2_ugm3'], 3: ['pm10_ugm3', 'pm25_ugm3', 'o3_ugm3', 'so2_ugm3'], 4: ['pollen_m3'] };
  // judged by the hour on show: an empty page is skipped, e.g. when the APPA feed has stopped
  function pageHasData(p) {
    const f = PAGE_FIELDS[p], r = rows[idx];
    return !f || (!!r && f.some((k) => has(r[k])));
  }
  function nextPage() {
    for (let k = 1; k <= NPAGE; k++) { const p = (page + k) % NPAGE; if (pageHasData(p)) return p; }
    return 0;
  }
  pgBtn.addEventListener('click', () => setPage(nextPage()));

  // ---------- numbers ----------
  const tweens = new Map();
  function setText(el, v, fmt, tween) {
    if (!tween || reduce || !Number.isFinite(el._v)) { el._v = v; el.textContent = fmt(v); tweens.delete(el); return; }
    if (el._v === v) { el.textContent = fmt(v); return; }
    tweens.set(el, { from: el._v, to: v, t0: performance.now(), fmt });
    el._v = v;
  }
  function stepTweens(now) {
    for (const [el, tw] of tweens) {
      const f = Math.min(1, (now - tw.t0) / 1200), e = 1 - Math.pow(1 - f, 3);
      el.textContent = tw.fmt(f < 1 ? tw.from + (tw.to - tw.from) * e : tw.to);
      if (f >= 1) tweens.delete(el);
    }
  }

  // ---------- place ----------
  let place = { code: '83200MS', de: 'Bozen', it: 'Bolzano' };
  const placeName = () => (lang === 'de' ? place.de : place.it);   // English uses the Italian name (Bolzano, Merano …)
  const nowLabEl = hud.querySelector('.wv-nowlab');
  const polTopEl = document.getElementById('wv-poltop');
  const hf = () => new Intl.DateTimeFormat(LOC[lang], { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  function fmtField(f, v) {
    if (!has(v)) return '—';
    return (FMT[f] || ((x) => String(x)))(Number(v));
  }
  function nowLabel() {
    if (!rows.length) return I18N[lang].now;
    return idx === rows.length - 1 ? I18N[lang].now : hf().format(new Date(rows[idx].time));
  }
  function polTop(r) {
    if (!r || !has(r.pollen_m3)) return '—';
    return r.pollen_top ? I18N[lang][r.pollen_top] || r.pollen_top : I18N[lang].none;
  }
  function paintRow(r, tween) {
    for (const el of rowMarks) {
      const f = el.getAttribute('data-f');
      if (f === 'time') { el.textContent = FMT.time(r.time); continue; }
      if (!has(r[f])) { el.textContent = '—'; el._v = undefined; tweens.delete(el); continue; }
      if (tween === null) { if (!tweens.has(el)) { el.textContent = fmtField(f, r[f]); el._v = Number(r[f]); } continue; }
      setText(el, Number(r[f]), FMT[f] || ((v) => String(v)), tween && el.classList.contains('wv-tw'));
    }
    compassEl.textContent = has(r.dir_deg) ? COMPASS[lang][Math.round(Number(r.dir_deg) / 22.5) % 16] : '—';
    nowLabEl.textContent = nowLabel();
    polTopEl.textContent = polTop(r);
    eaqiEl.textContent = has(r.no2_ugm3) ? I18N[lang].eaqi[eaqiNo2(Number(r.no2_ugm3))] : '';
    // air values may be older than the hour shown (the APPA feed lags): then the measurement time
    const old = r.aq_time && r.aq_time !== r.time;
    aqTimeEls.forEach((el) => { el.textContent = old ? ` · ${hf().format(new Date(r.aq_time))}` : ''; });
    o3LabEl.textContent = has(r.o3_ugm3) && has(r.so2_ugm3) ? I18N[lang].o3so2 : has(r.so2_ugm3) ? I18N[lang].so2 : I18N[lang].o3;
    updateNeeds(r);
    paintValues(r);
  }
  // ---------- all values on the main page ----------
  const valsEl = document.getElementById('wv-vals'), valsTimeEl = document.getElementById('wv-vals-time');
  const dfVal = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  const nfV1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }), nfV0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const POL_DE = { alder: 'Erle', birch: 'Birke', grass: 'Gräser', mugwort: 'Beifuß', olive: 'Olive', ragweed: 'Ambrosia' };
  const EAQI_DE = ['gut', 'mittelmäßig', 'mäßig', 'schlecht', 'sehr schlecht', 'extrem schlecht'];
  function paintValues(r) {
    const air = r.aq_time && r.aq_time !== r.time ? `Messung ${dfVal.format(new Date(r.aq_time))}` : '';
    const items = [
      ['Wind', r.wind_kmh, 'km/h', nfV1],
      ['Böen', r.gust_kmh, 'km/h', nfV1],
      ['Windrichtung', r.dir_deg, '°', nfV0, has(r.dir_deg) ? COMPASS.de[Math.round(Number(r.dir_deg) / 22.5) % 16] : ''],
      ['Stickstoffdioxid NO₂', r.no2_ugm3, 'µg/m³', nfV0, [has(r.no2_ugm3) ? EAQI_DE[eaqiNo2(Number(r.no2_ugm3))] : '', air].filter(Boolean).join(' · ')],
      ['Feinstaub PM10', r.pm10_ugm3, 'µg/m³', nfV0, air],
      ['Feinstaub PM2.5', r.pm25_ugm3, 'µg/m³', nfV0, air],
      ['Ozon O₃', r.o3_ugm3, 'µg/m³', nfV0, air],
      ['Schwefeldioxid SO₂', r.so2_ugm3, 'µg/m³', nfV1, air],
      ['Pollen', r.pollen_m3, '/m³', nfV0, has(r.pollen_m3) ? (r.pollen_top ? POL_DE[r.pollen_top] : 'kaum Pollen') : '']
    ];
    valsEl.textContent = '';
    for (const [label, v, unit, nf, sub] of items) {
      const box = document.createElement('div'); box.className = 'wv-val';
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd');
      if (has(v)) {
        dd.textContent = nf.format(Number(v));
        const u = document.createElement('small'); u.textContent = unit; dd.appendChild(u);
        if (sub) { const sb = document.createElement('span'); sb.className = 'wv-val-sub'; sb.textContent = sub; dd.appendChild(sb); }
      } else {
        // no data from the sources: no number, no unit
        box.classList.add('is-empty'); dd.textContent = 'keine Daten';
      }
      box.appendChild(dt); box.appendChild(dd); valsEl.appendChild(box);
    }
    valsTimeEl.textContent = rows.length && idx === rows.length - 1 ? `jetzt · ${dfVal.format(new Date(r.time))}` : dfVal.format(new Date(r.time));
  }
  // European Air Quality Index bands for hourly NO₂ (µg/m³)
  const eaqiNo2 = (v) => [40, 90, 120, 230, 340].findIndex((b) => v <= b) === -1 ? 5 : [40, 90, 120, 230, 340].findIndex((b) => v <= b);
  const eaqiEl = document.getElementById('wv-eaqi');
  const aqTimeEls = Array.from(hud.querySelectorAll('.wv-aqtime'));
  const o3LabEl = hud.querySelector('[data-i18n="o3so2"]');
  o3LabEl.removeAttribute('data-i18n');
  // a value the sources have no data for shows no unit or label either:
  // data-need="a b" shows the element if a or b exists, "a&b" only if both do; "avg.x" / "max.x" read the 48 h figures
  function valueOf(key, r) {
    const [src, f] = key.includes('.') ? key.split('.') : ['row', key];
    const o = src === 'avg' ? avgRow : src === 'max' ? maxRow : r;
    return o ? o[f] : null;
  }
  function updateNeeds(r) {
    for (const el of needEls) {
      const ok = el.dataset.need.split(' ').some((alt) => alt.split('&').every((k) => has(valueOf(k, r))));
      el.hidden = !ok;
    }
  }

  function showRow(i) {
    if (!rows.length) return;
    idx = i;
    lastRow = performance.now();
    const r = rows[idx];
    setTargets(r);
    paintRow(r, true);
    T.gauge = gaugeTarget();
    dirty = true;
    updateCursor();
    if (!pageHasData(page)) setPage(nextPage());
  }
  function clearRowMarks() {
    for (const el of rowMarks) { el.textContent = '—'; el._v = undefined; tweens.delete(el); }
    compassEl.textContent = '—';
    polTopEl.textContent = '—';
    eaqiEl.textContent = '';
    updateNeeds({});
  }
  let avgRow = null, maxRow = null;
  function computeMax(rs) {
    const mx = (k) => { const v = rs.filter((r) => has(r[k])).map((r) => Number(r[k])); return v.length ? Math.max(...v) : null; };
    return { no2_ugm3: mx('no2_ugm3'), pollen_m3: mx('pollen_m3') };
  }
  function computeAvg(rs) {
    // mean of every hour that has a value (one decimal); wind direction as a vector mean in whole degrees
    const avg = (k) => {
      const v = rs.filter((r) => has(r[k])).map((r) => Number(r[k]));
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const rad = rs.filter((r) => has(r.dir_deg)).map((r) => Number(r.dir_deg) * Math.PI / 180);
    const sx = rad.reduce((a, b) => a + Math.sin(b), 0), cx = rad.reduce((a, b) => a + Math.cos(b), 0);
    const dir = rad.length ? Math.round((Math.atan2(sx, cx) * 180 / Math.PI + 360) % 360) : null;
    return { wind_kmh: avg('wind_kmh'), dir_deg: dir, no2_ugm3: avg('no2_ugm3'), pm10_ugm3: avg('pm10_ugm3'), pm25_ugm3: avg('pm25_ugm3'), o3_ugm3: avg('o3_ugm3'), so2_ugm3: avg('so2_ugm3'), pollen_m3: avg('pollen_m3') };
  }
  function showAvg() {
    for (const el of avgMarks) {
      const f = el.getAttribute('data-avg');
      el.textContent = avgRow ? AVG_FMT(avgRow[f], f) : '—';
    }
    for (const el of maxMarks) {
      const f = el.getAttribute('data-max');
      el.textContent = maxRow && has(maxRow[f]) ? fmtField(f, maxRow[f]) : '—';
    }
  }

  // crossfade: a frozen copy of the old text fades out while the real element, already in the
  // new language, fades in on the same spot.
  const XFADE_MS = 1000;
  function crossfade(el) {
    el.parentNode.querySelectorAll(':scope > .wv-ghost').forEach((g) => g.remove());
    const ghost = el.cloneNode(true);
    const strip = (n) => ['id', 'data-f', 'data-avg', 'data-i18n'].forEach((a) => n.removeAttribute(a));
    strip(ghost);
    ghost.querySelectorAll('*').forEach(strip);
    ghost.classList.add('wv-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    el.after(ghost);
    el.style.transition = 'none';
    el.style.opacity = '0';
    void el.offsetWidth;
    el.style.transition = `opacity ${XFADE_MS}ms ease`;
    el.style.opacity = '';
    ghost.style.transition = `opacity ${XFADE_MS}ms ease`;
    requestAnimationFrame(() => { ghost.style.opacity = '0'; });
    setTimeout(() => { ghost.remove(); el.style.transition = ''; }, XFADE_MS + 80);
  }
  function setLang(l, fade) {
    if (fade && !reduce) { crossfade(hudBody); crossfade(titleSub); }
    applyLang(l);
  }
  function applyModeLabels() {
    playBtn.textContent = playing ? I18N[lang].back : I18N[lang].play;
    modeEl.textContent = playing ? I18N[lang].replay : I18N[lang].live;
    modeEl.classList.toggle('is-replay', playing);
  }
  function applyLang(l) {
    lang = l; makeFmt();
    stage.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = I18N[lang][el.dataset.i18n] || el.textContent; });
    titleSub.textContent = I18N[lang].subT.replace('{p}', placeName());
    langBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.lang === lang));
    updateLangInd();
    applyModeLabels();
    if (rows.length) paintRow(rows[idx], null);   // a running count-up keeps going in the new language
    showAvg();
  }
  langBtns.forEach((b) => b.addEventListener('click', () => { lastLang = performance.now(); setLang(b.dataset.lang, true); }));

  const modeEl = document.getElementById('wv-mode');
  function setPlaying(p) {
    playing = p;
    lastRow = lastPage = lastLang = performance.now();
    applyModeLabels();
    if (rows.length) showRow(playing ? 0 : rows.length - 1);
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));

  // ---------- loop ----------
  let last = performance.now(), dirty = true, flagPh = 0;
  let flagLetters = Array.from(document.querySelectorAll('#wv-flag span'));
  function waveFlag(dt) {
    // a very light flag wave through the letters; speed and direction follow the wind
    if (reduce || page !== 0) return;
    const wn = Math.min(G.windN, 1);
    flagPh += dt * (1.1 + 2.2 * wn);
    const amp = 0.018 + 0.018 * wn;
    flagLetters.forEach((el, i) => {
      const a = flagPh - i * 0.85 * S.flowSign;
      el.style.transform = `translateY(${(Math.sin(a) * amp).toFixed(4)}em) skewY(${(Math.cos(a) * (1.0 + 0.8 * wn)).toFixed(2)}deg) rotate(${(Math.sin(a + 0.8) * 0.5).toFixed(2)}deg)`;
    });
  }
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    // replay walks through the hours, then returns to live; pages and languages always rotate
    if (playing && rows.length > 1 && now - lastRow > STEP_ROW) {
      if (idx + 1 >= rows.length) setPlaying(false); else showRow(idx + 1);
    }
    if (now - lastPage > PAGE_MS[page]) setPage(nextPage());
    else if (page !== 0 && now - lastLang > LANG_MS) { lastLang = now; setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length], true); }

    const k = reduce ? 1 : 1 - Math.exp(-dt / 1.6);
    for (const key of ['wind', 'gust', 'dirX', 'dirY', 'aqN', 'aqP', 'pollen', 'spores', 'dirA']) S[key] += (T[key] - S[key]) * k;
    S.flowSign += (T.flowSign - S.flowSign) * (reduce ? 1 : 1 - Math.exp(-dt / 2.4));
    S.gauge += (T.gauge - S.gauge) * (reduce ? 1 : 1 - Math.exp(-dt / 0.7));
    PC = mixPal(PC, palTarget(), reduce ? 1 : 1 - Math.exp(-dt / 1.3));

    G.windN = clamp(S.wind / 30, 0, 1.3);
    G.turb = clamp((S.gust - S.wind) / 18, 0, 1.4) + 0.25 * Math.min(G.windN, 1);
    G.amp = 0.24 + 0.30 * Math.min(G.windN, 1);
    G.wid = 1.25 + 0.2 * Math.min(G.windN, 1);
    if (!reduce) {
      const flow = (0.16 + 1.25 * G.windN) * (0.55 + 0.45 * Math.abs(S.dirX));
      phase += dt * S.flowSign * flow;
      time += dt;
      stepParticles(dt);
      dirty = true;
    } else if (dirty) {
      stepParticles(0);
    }
    const fading = now < fadeUntil;
    if (W && dirty && (animMode === 'silk' || fading)) {
      if (gl) renderGL(); else if (ctx2d) render2d();
      if (reduce) dirty = false;
    }
    if (W && waves && (animMode === 'waves' || fading) && (!reduce || wavesDirty)) {
      // the loop is exactly 10 s long; the time is reduced here so the shader never sees large numbers
      waves.render(reduce ? 0 : (now / 1000) % 10);
      wavesDirty = false;
    }
    updateHud(dt);
    waveFlag(dt);
    stepTweens(now);
    requestAnimationFrame(frame);
  }

  // ---------- timeline chart ----------
  const chartBox = document.getElementById('wv-chart');
  const tfDe = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  const dfDe = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
  const hhRome = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', hour12: false, timeZone: 'Europe/Rome' });
  const nf1De = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf0De = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  let updateCursor = () => {};
  let chartState = 'loading', chartW = 0;

  function drawTimeline() {
    chartBox.textContent = '';
    updateCursor = () => {};
    chartW = chartBox.clientWidth;
    if (chartState !== 'ok') {
      const f = document.createElement('div'); f.className = 'wv-fail';
      f.textContent = chartState === 'error' ? 'Daten konnten nicht geladen werden' : 'Lädt …';
      if (chartState !== 'error') f.style.setProperty('--color-bad', 'var(--color-fg-muted)');
      chartBox.appendChild(f);
      return;
    }
    const pts = rows.map((r, i) => ({ i, t: new Date(r.time), w: has(r.wind_kmh) ? Number(r.wind_kmh) : null, g: has(r.gust_kmh) ? Number(r.gust_kmh) : null }))
      .map((p) => Object.assign(p, { hh: hhRome.format(p.t).padStart(2, '0') }));
    if (!pts.length) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#5b5fd6';
    const w = chartBox.clientWidth || 600, h = 150;
    const svg = d3.select(chartBox).append('svg').attr('width', '100%').attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);
    const y = d3.scaleLinear([0, d3.max(pts, (p) => Math.max(p.g || 0, p.w || 0)) || 1], [h - 24, 8]).nice();
    const yTicks = y.ticks(4);
    const meas = svg.append('g').style('font-size', 'var(--cds-font-size-caption)');
    let ml = 0;
    for (const t of yTicks) { const tx = meas.append('text').text(nf0De.format(t)); ml = Math.max(ml, tx.node().getComputedTextLength()); }
    meas.remove();
    ml = Math.ceil(ml) + 10;
    const x = d3.scaleUtc([pts[0].t, pts[pts.length - 1].t], [ml, w - 10]);
    const g = svg.append('g').style('font-size', 'var(--cds-font-size-caption)');
    g.selectAll('line.grid').data(yTicks).join('line').attr('class', 'grid')
      .attr('x1', ml).attr('x2', w - 10).attr('y1', (v) => y(v)).attr('y2', (v) => y(v))
      .style('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    g.selectAll('text.yl').data(yTicks).join('text').attr('class', 'yl')
      .attr('x', ml - 8).attr('y', (v) => y(v)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .style('fill', 'var(--color-fg-muted)').text((v) => nf0De.format(v));
    const wantHours = w < 520 ? ['00'] : ['00', '12'];
    const xt = pts.filter((p) => wantHours.includes(p.hh));
    g.selectAll('text.xl').data(xt).join('text').attr('class', 'xl')
      .attr('x', (p) => x(p.t)).attr('y', h - 6).attr('text-anchor', 'middle')
      .style('fill', 'var(--color-fg-muted)')
      .text((p) => (p.hh === '00' ? dfDe.format(p.t) : '12:00'));
    g.selectAll('line.xt').data(xt).join('line').attr('class', 'xt')
      .attr('x1', (p) => x(p.t)).attr('x2', (p) => x(p.t)).attr('y1', h - 24).attr('y2', h - 20)
      .style('stroke', 'var(--cds-chart-axis)');
    const line = (key) => d3.line().defined((p) => p[key] != null).x((p) => x(p.t)).y((p) => y(p[key]));
    g.append('path').datum(pts).attr('d', line('g')).attr('fill', 'none')
      .style('stroke', 'var(--cds-chart-muted)').attr('stroke-width', 1.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    g.append('path').datum(pts).attr('d', line('w')).attr('fill', 'none')
      .style('stroke', accent).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    const cur = g.append('g');
    const curLine = cur.append('line').attr('y1', 8).attr('y2', h - 24).style('stroke', 'var(--color-fg)').attr('stroke-width', 1).attr('opacity', 0.5);
    const curDot = cur.append('circle').attr('r', 4).style('fill', accent).style('stroke', 'var(--color-panel)').attr('stroke-width', 2);
    updateCursor = () => {
      const p = pts[idx]; if (!p) return;
      curLine.attr('x1', x(p.t)).attr('x2', x(p.t));
      curDot.attr('cx', x(p.t)).attr('cy', y(p.w || 0)).attr('opacity', p.w == null ? 0 : 1);
    };
    updateCursor();
    const tip = document.createElement('div'); tip.className = 'wv-tip'; chartBox.appendChild(tip);
    const bis = d3.bisector((p) => p.t).center;
    const nearest = (ev) => { const [mx] = d3.pointer(ev, svg.node()); return pts[bis(pts, x.invert(mx))]; };
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', Math.max(0, w - 10 - ml)).attr('height', h - 20).attr('fill', 'transparent').style('cursor', 'pointer')
      .on('pointermove', (ev) => {
        const p = nearest(ev); if (!p) return;
        tip.textContent = '';
        const hd = document.createElement('div'); hd.className = 'wv-tip-h'; hd.textContent = tfDe.format(p.t); tip.appendChild(hd);
        for (const [lab, val, c] of [['Wind', p.w, accent], ['Böen', p.g, 'var(--cds-chart-muted)']]) {
          const row = document.createElement('div'); row.className = 'wv-tip-row';
          const sw = document.createElement('span'); sw.className = 'wv-sw'; sw.style.background = c;
          const tx = document.createElement('span'); tx.textContent = `${lab} ${val == null ? '—' : nf1De.format(val)} km/h`;
          row.appendChild(sw); row.appendChild(tx); tip.appendChild(row);
        }
        tip.style.display = 'block';
        const scale = chartBox.clientWidth / w;
        const px = x(p.t) * scale, tw = tip.offsetWidth;
        tip.style.left = clamp(px - tw / 2, 0, Math.max(0, chartBox.clientWidth - tw)) + 'px';
        tip.style.top = '-6px';
      })
      .on('pointerleave', () => { tip.style.display = 'none'; })
      .on('click', (ev) => {
        const p = nearest(ev); if (!p) return;
        if (!playing) { playing = true; applyModeLabels(); }
        lastRow = performance.now();
        showRow(p.i);
      });
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (chartBox.clientWidth !== chartW) drawTimeline(); }).observe(chartBox);

  // ---------- header & meta ----------
  const root = document.getElementById('wv-root');
  const titleEl = document.getElementById('wv-title');
  const kickerEl = document.getElementById('wv-kicker');
  const errEl = document.getElementById('wv-err');
  const mWind = document.getElementById('wv-m-wind'), mAir = document.getElementById('wv-m-air'), mTime = document.getElementById('wv-m-time');
  const stamp = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  // ---------- title card ----------
  const WORD = { de: 'Wind', it: 'Vento', en: 'Wind' };
  const flagEl = document.getElementById('wv-flag');
  const langsEl = titleCard.querySelector('.wv-t-langs');
  let titleLang = 'de', titleTurn = 0;
  function renderTitle() {
    const l = titleLang;
    const big = WORD[l].toUpperCase();
    flagEl.textContent = '';
    flagEl.setAttribute('aria-label', big);
    flagEl.setAttribute('lang', l);
    for (const ch of big) { const sp = document.createElement('span'); sp.textContent = ch; flagEl.appendChild(sp); }
    flagLetters = Array.from(flagEl.children);
    langsEl.textContent = '';
    // the other languages, small – a word that equals the big one (or another small one) is left out
    const seen = new Set([WORD[l]]);
    LANGS.filter((x) => x !== l && !seen.has(WORD[x]) && seen.add(WORD[x])).forEach((x, i) => {
      if (i) langsEl.appendChild(document.createElement('i'));
      const sp = document.createElement('span'); sp.setAttribute('lang', x); sp.textContent = WORD[x];
      langsEl.appendChild(sp);
    });
    const first = l === 'de' ? place.de : place.it, second = l === 'de' ? place.it : place.de;
    kickerEl.textContent = first === second ? first : `${first} · ${second}`;
    titleSub.textContent = I18N[lang].subT.replace('{p}', placeName());
  }
  function showPlace(p) {
    place = p;
    titleEl.textContent = `Wind ${p.de}`;
    document.title = `Wind ${p.de} · Südtirol`;
    renderTitle();
  }

  // ---------- data ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  let loadSeq = 0, refreshTimer = 0;
  async function load(code, keepPosition) {
    const seq = ++loadSeq;
    root.classList.add('wv-is-loading');
    errEl.textContent = '';
    if (!rows.length) { chartState = 'loading'; drawTimeline(); }
    try {
      const res = await fetch(`/api/wind?station=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || res.status);
      if (seq !== loadSeq) return;
      showPlace(j.station);
      rows = j.rows || [];
      avgRow = rows.length ? computeAvg(rows) : null;
      maxRow = rows.length ? computeMax(rows) : null;
      if (!pageHasData(page)) setPage(nextPage());
      showAvg();
      mWind.textContent = `${j.station.de}${j.station.alt ? ` (${j.station.alt} m)` : ''}`;
      if (j.sources && j.sources.wind) mWind.title = `Quelle: ${j.sources.wind}`;
      if (j.sources && j.sources.air) mAir.title = `Quelle: ${j.sources.air}`;
      const AQN = { no2: 'NO₂', pm10: 'PM10', pm25: 'PM2.5', o3: 'O₃', so2: 'SO₂' };
      mAir.textContent = j.air && j.air.length
        ? j.air.map((a) => `${a.name} · ${String(a.km).replace('.', ',')} km (${a.values.map((v) => AQN[v]).join(', ')})`).join(' / ')
        : 'keine Messstelle im Umkreis von 30 km';
      const newest = rows[rows.length - 1];
      if (j.air_latest && newest && !['no2_ugm3', 'pm10_ugm3', 'pm25_ugm3', 'o3_ugm3', 'so2_ugm3'].some((k) => has(newest[k]))) {
        mAir.textContent += ` – keine aktuellen Messdaten, letzte Messung ${stamp.format(new Date(j.air_latest))}`;
      }
      mTime.textContent = stamp.format(new Date(j.latest));
      chartState = 'ok';
      drawTimeline();
      if (rows.length) showRow(keepPosition && playing ? Math.min(idx, rows.length - 1) : rows.length - 1); else clearRowMarks();
      if (!keepPosition && playing) { playing = false; applyModeLabels(); }
    } catch (e) {
      if (seq !== loadSeq) return;
      errEl.textContent = `Die Daten für diese Station konnten nicht geladen werden (${e.message || e}).`;
      if (!rows.length) { chartState = 'error'; drawTimeline(); clearRowMarks(); }
    } finally {
      if (seq === loadSeq) root.classList.remove('wv-is-loading');
    }
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => load(place.code, true), 10 * 60 * 1000);
  }

  // ---------- stations ----------
  const sel = document.getElementById('wv-station');
  const nearBtn = document.getElementById('wv-near');
  // well-known places first, then every station that measures wind
  const FEATURED = ['83200MS', '23200MS', '39100MS', '59700MS', '37100MS', '09700MS', '41000MS', '89190MS', '88820MS', '61300MS', '73500MS', '74200MS', '82200MS', '79300MS', '91510MS'];
  let stationList = [];
  function pickStation(code, push) {
    if (sel.value !== code) sel.value = code;
    store.set('wind-station', code);
    if (push) {
      const u = new URL(location.href); u.searchParams.set('station', code);
      history.replaceState(null, '', u);
    }
    load(code, false);
  }
  async function loadStations(initial) {
    try {
      const res = await fetch('/api/stations');
      const j = await res.json();
      stationList = j.stations || [];
    } catch (e) { stationList = []; }
    if (!stationList.length) return;
    sel.textContent = '';
    const byCode = new Map(stationList.map((s) => [s.code, s]));
    const label = (s) => `${s.de}${s.it && s.it !== s.de ? ` / ${s.it}` : ''}${s.alt ? ` · ${s.alt} m` : ''}`;
    const g1 = document.createElement('optgroup'); g1.label = 'Orte';
    for (const c of FEATURED) { const s = byCode.get(c); if (!s) continue; const o = document.createElement('option'); o.value = c; o.textContent = label(s); g1.appendChild(o); }
    const g2 = document.createElement('optgroup'); g2.label = 'Alle Wetterstationen mit Wind';
    for (const s of stationList) { if (FEATURED.includes(s.code)) continue; const o = document.createElement('option'); o.value = s.code; o.textContent = label(s); g2.appendChild(o); }
    sel.appendChild(g1); sel.appendChild(g2);
    if (!byCode.has(initial)) initial = '83200MS';
    sel.value = initial;
  }
  sel.addEventListener('change', () => pickStation(sel.value, true));
  if (!('geolocation' in navigator)) nearBtn.hidden = true;
  nearBtn.addEventListener('click', () => {
    nearBtn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      nearBtn.disabled = false;
      const me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      // village stations (code …MS) are more telling than summit or snow stations (…WS, …SF)
      let best = null, bestD = Infinity;
      for (const s of stationList) {
        const d = Math.hypot((s.lat - me.lat) * 111, (s.lon - me.lon) * 76) + (/MS$/.test(s.code) ? 0 : 8);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best) pickStation(best.code, true);
    }, () => {
      nearBtn.disabled = false;
      errEl.textContent = 'Der Standort ist nicht verfügbar – bitte einen Ort aus der Liste wählen.';
    }, { maximumAge: 600000, timeout: 10000 });
  });

  // ---------- start ----------
  const urlCode = new URL(location.href).searchParams.get('station');
  const startCode = (urlCode && /^[0-9A-Z]{5,8}$/.test(urlCode) ? urlCode : null) || store.get('wind-station') || '83200MS';
  applyModeLabels();
  const urlAnim = new URL(location.href).searchParams.get('anim');
  let storedAnim = null;
  try { storedAnim = localStorage.getItem('wind-anim'); } catch (e) { /* private mode */ }
  setAnim(urlAnim === 'wellen' || urlAnim === 'waves' ? 'waves' : urlAnim === 'band' || urlAnim === 'silk' ? 'silk' : storedAnim === 'waves' ? 'waves' : 'silk', true);
  setPage(0);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  load(startCode, false);
  loadStations(startCode);
})();
