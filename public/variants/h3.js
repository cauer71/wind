// Strömung – a laminar horizontal stream of fine glowing streamlines (variant h3 for wind.auer.page).
// Same rendering language as waves.js ("Wellen"): thin crests with soft halos, depth of field,
// fibre patches, dark navy ground, exact seamless loop.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var PERIOD = 24;
  var OM = TAU / PERIOD;

  // ---------------------------------------------------------------------------
  // The stream is described by one stream function psi(x, y, t); every strand is a level line
  // psi = c_k, so strands never cross, bunch where |grad psi| is large and spread where it is
  // small - like smoke lines in a wind tunnel.
  //   s0  = (y - Yc(x, t)) / h                         (band coordinate, Yc = slowly swaying centre)
  //   psi = s0 - E(s0, x, t),  E = sum_j (a_j + b_j s0 + c_j s0^2) sin(k_j x - m_j phi + p_j)
  // phi = 2 pi t / PERIOD; m_j > 0 travels left -> right.  The s0-dependence of E shears the
  // waves across the stream, so the strands gently bunch and fan out as the waves pass.
  // Distance to a strand = (psi - c_k) / |grad psi| (analytic gradient), so every line is
  // anti-aliased with a pixel-footprint width like the crests in waves.js.
  // Per strand: depth of field (sharp in the core, wide soft glow at the top/bottom edge),
  // light glints travelling along the strand (laminar profile: the core flows fastest), and in
  // the glints the crest narrows and brightens like a silk thread turning edge-on.
  // ---------------------------------------------------------------------------
  // modes: k (rad / unit), m (loop harmonic, >0 travels left -> right), p (phase),
  //        ya (centre sway, units), a, b, c (displacement polynomial in s0, band units)
  var MODES = [
    { k: 2.05, m: 1, p: 0.7, ya: 0.022 },             // (with the next one: a mostly standing sway)
    { k: 2.05, m: -1, p: 2.9, ya: 0.016 },
    { k: 1.10, m: -1, p: 2.1, ya: 0.022 },
    { k: 3.90, m: 1, p: 4.0, a: 0.00, b: 0.15, c: 0.00 },
    { k: 6.60, m: 1, p: 1.3, a: 0.12, b: 0.05, c: 0.02 },
    { k: 10.8, m: 2, p: 5.2, a: 0.03, b: -0.04, c: 0.0 },
    { k: 15.5, m: 3, p: 2.6, a: 0.015, b: 0.0, c: 0.0 }
  ];
  var BAND = { h: 0.21, cy: 0.0 };               // band half-height (units of the short side), centre
  var NS = 38;                                    // strands (19 mirrored pairs)
  // fibre patches (hair-fine silk fibres between the core strands, in two patches drifting with
  // the flow): centre level, travelling envelope (k, m, phase), hash seed
  var FIBRES = [{ c: -0.32, k: 3.74, m: 1, p: 0.6, seed: 1.7 }, { c: 0.36, k: 4.76, m: 1, p: 3.9, seed: 5.3 }];
  // fibre spacing (psi), slant, patch size across (psi) / along (units), per-hair extent jitter, hair length, gain
  var FIB = { df: 0.036, slant: 0.18, across: 0.14, along: 0.16, jit: 0.22, hair: 0.09, gain: 1.6 };
  var LOOK = {
    glow: 0.001, gain: 69.0, haze: 0.012, sheen: 2.5, comp: 0.6,
    xblur: 0.006,                                  // extra defocus towards the left/right edge
    // HUD region (follows setHud): the band dimmer behind the ring; default extent (units) and, when
    // the ring's radius is known, extent relative to it
    dim: 0.6, dimRx: 0.34, dimRy: 0.22, dimKx: 1.35, dimKy: 0.87
  };
  // colour (setColors): sRGB 0..1.  The light L is tone-mapped to Tm and coloured with a tint that
  // runs from the halo colour (faint glows, veils, haze) to the crest colour (bright cores) with Tm.
  // CK / HK: crest / halo colour that a unit tint stands for (so palettes of the app's usual
  // brightness keep the default's luminance); GB / GH: the soft ground glow around the band, a
  // little of the ground plus a touch of the halo colour.
  var TINT = [0.53, 0.645, 1.0];
  var COL = { CK: 0.83, HK: 0.44, GB: 0.20678, GH: 0.015023, lo: 0.05, hi: 1.3 };
  function defaultColors() {
    return {
      crest: TINT.map(function (v) { return v * COL.CK; }),
      halo: TINT.map(function (v) { return v * COL.HK; }),
      bg: [17.6 / 255, 19.0 / 255, 24.0 / 255]
    };
  }

  // deterministic strand table (seeded PRNG)
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  // strands come in mirrored pairs (+c / -c with the same focus and brightness, own glints), so
  // the band's light is balanced around its centre line - the HUD rides on that line
  function makeStrands() {
    var R = rng(7), out = [], span = 1.6, NP = NS >> 1, sp = span / NP;
    for (var i = 0; i < NP; i++) {
      var base = span * (i + 0.5) / NP + (R() - 0.5) * 0.5 * sp;
      var a = Math.abs(base);
      var r1 = R(), r2 = R(), r3 = R(), r6 = R(), r7 = R();
      var hero = a < 0.75 && r1 > 0.55;
      var outer = smooth(0.3, 1.55, a);
      // depth of field: sharp core, wide glow at the edges; some core strands sit a little in
      // front of / behind the focal plane (soft lines between the crisp ones)
      var blur = 0.0004 + 0.032 * Math.pow(outer, 1.5) + (!hero && r6 > 0.65 ? 0.004 + 0.008 * r7 : 0);
      var I = (0.42 + 0.5 * r2) * (hero ? 1.35 : 1.0) * (1 - 0.62 * outer);
      var hw = 0.003 + 0.007 * r3;
      var soft = smooth(0.004, 0.02, blur);                         // blurred strands: broad, gentle glints
      // the pair's glints travel together (loosely: own phase offset), so the light stays balanced
      var m = soft > 0.5 || R() < 0.5 ? 1 : 2, ph0 = R() * TAU;
      for (var sd = -1; sd <= 1; sd += 2) {
        var c = sd * (base + (R() - 0.5) * 0.25 * sp);
        var v = 0.068 * (1 - 0.45 * Math.min(1.2, base * base));     // glint speed (units / s): laminar profile
        out.push({ c: c, blur: blur, I: I, hw: hw, m: m, kb: m * OM / v, ph: ph0 + (R() - 0.5) * 0.7,
          tb: 0.22 + 0.55 * soft, te: 1.4 - 1.05 * soft, sh: 1 - soft,
          rank: i % 3 === 1 ? 2 : (i % 3 === 2 ? 1 : 0) });
      }
    }
    return out;
  }
  var STRANDS = makeStrands();

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 ? s + '.0' : s; }

  function buildShader(strands) {
    var i, j, md, code = [];
    // centre line and displacement terms (only non-zero ones are emitted)
    var cen = [], dis = [];
    for (j = 0; j < MODES.length; j++) {
      md = MODES[j];
      var th = 'uPh[' + (j >> 2) + '].' + 'xyzw'[j & 3];
      code.push('  float sn' + j + ' = sin(' + f(md.k) + ' * x + ' + th + '), cs' + j + ' = cos(' + f(md.k) + ' * x + ' + th + ');');
      if (md.ya) cen.push(j);
      if (md.a || md.b || md.c) dis.push(j);
    }
    code.push('  float Yc = ' + f(BAND.cy) + cen.map(function (j) { return ' + ' + f(MODES[j].ya) + ' * sn' + j; }).join('') + ';');
    code.push('  float Ycx = 0.0' + cen.map(function (j) { return ' + ' + f(MODES[j].ya * MODES[j].k) + ' * cs' + j; }).join('') + ';');
    code.push('  float s0 = (y - Yc) * uB.y;');
    code.push('  float s2 = s0 * s0;');
    var E = [], Es = [], Ex = [];
    dis.forEach(function (j) {
      var m = MODES[j], a = m.a || 0, b = m.b || 0, c = m.c || 0;
      var poly = '(' + f(a) + ' + ' + f(b) + ' * s0 + ' + f(c) + ' * s2)';
      E.push(poly + ' * sn' + j);
      Es.push('(' + f(b) + ' + ' + f(2 * c) + ' * s0) * sn' + j);
      Ex.push(poly + ' * ' + f(m.k) + ' * cs' + j);
    });
    code.push('  float E = ' + E.join(' + ') + ';');
    code.push('  float Es = ' + Es.join(' + ') + ';');
    code.push('  float Ex = ' + Ex.join(' + ') + ';');
    // slope of the band's centre streamline (shared by all strands at this x)
    code.push('  float slopeC = Ycx + uB.x * (' + dis.map(function (j) { return f((MODES[j].a || 0) * MODES[j].k) + ' * cs' + j; }).join(' + ') + ');');
    code.push('  float P = s0 - E;');
    code.push('  float Py = (1.0 - Es) * uB.y;');
    code.push('  float Px = -(1.0 - Es) * Ycx * uB.y - Ex;');
    code.push('  gIg = inversesqrt(Px * Px + Py * Py);');   // units per psi
    // sheen: where the stream rises it catches the light, where it falls it turns away (the
    // centre streamline's slope, so both halves of the band light up together); where the
    // strands bunch the light concentrates a little
    code.push('  float sheen = exp2(' + f(LOOK.sheen) + ' * clamp(slopeC, -0.6, 0.6)) * pow(uB.x / gIg, ' + f(LOOK.comp) + ');');

    var body = [];
    for (i = 0; i < strands.length; i++) {
      var s = strands[i];
      var reach = 3.2 * (s.blur + 0.004) + 2 * s.hw + 0.022;
      body.push('  L += st(P - ' + f(s.c) + ', vec4(' + [s.blur, s.I, s.hw, reach].map(f).join(', ') + ') * vec4(1.0, uLod[' + s.rank + '], 1.0, 1.0), ' +
        f(s.kb) + ' * x + ' + f(s.ph) + ' + uGp.' + 'xyz'[s.m - 1] + ', vec3(' + [s.tb, s.te, s.sh].map(f).join(', ') + '));');
    }

    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform vec4 uG;',            // units per px, AA width (units), HUD dim amount, half width in units
      'uniform vec4 uB;',            // band half-height h, 1/h, HUD centre y, HUD centre x (units)
      'uniform vec4 uPh[2];',        // mode phases (p_j - m_j phi) mod 2 pi
      'uniform vec3 uGp;',           // glint phases -phi, -2 phi, -3 phi (mod 2 pi)
      'uniform vec2 uFp;',           // fibre patch phases
      'uniform float uLod[3];',      // strand weights per rank (minor strands fade on small screens)
      'uniform vec2 uD;',            // 1 / HUD dim extent (x, y) in units
      'uniform vec3 uCg;',           // ground colour (0..255)
      'uniform vec3 uCb;',           // ground glow colour (0..255)
      'uniform vec3 uCc;',           // crest tint
      'uniform vec3 uCh;',           // halo tint
      'const float GLOW = ' + f(LOOK.glow) + ';',
      'float gIg;',                  // |grad psi|^-1
      'float gXb;',                  // extra screen-space defocus at this pixel
      '',
      'float st(float dp, vec4 A, float th, vec3 B) {',
      '  float ad = abs(dp) * gIg;',          // distance to the strand (units)
      '  float reach = A.w + 3.2 * gXb;',
      '  if (ad > reach) return 0.0;',
      '  float gc = 0.5 + 0.5 * cos(th);',
      '  float edge = gc * gc;',              // glint: the thread turns edge-on, thin and bright
      '  edge *= mix(1.0, edge, B.z);',
      '  float w = A.x + gXb + uG.y;',        // depth-of-field blur + pixel footprint
      '  float wc = 0.0012 + A.z * (1.0 - edge) + w;',
      '  float yy = ad / wc;',
      '  float prof = 1.0 / (1.0 + yy * yy);',
      '  prof *= prof;',
      '  float res = prof * 0.008 / (wc + 0.003);',
      // heavy-tailed halo (energy ~ constant, width grows with the blur)
      '  float g = 0.007 + 1.6 * w;',
      '  float gd = g + ad;',
      '  res += GLOW * g / (gd * gd);',
      // fade to exactly zero at the reach so the early-out never leaves a seam
      '  float win = clamp((1.0 - ad / reach) * 2.2, 0.0, 1.0);',
      '  return A.y * (B.x + B.y * edge) * win * res;',
      '}',
      '',
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x;',
      '  float x = p.x, y = p.y;',
      code.join('\n'),
      '  float ex = abs(x) / uG.w;',
      '  gXb = ' + f(LOOK.xblur) + ' * smoothstep(0.45, 1.0, ex);',
      '  float L = 0.0;',
      body.join('\n'),
      fibreCode(),
      '  L *= sheen;',
      // soft light scattered around the stream
      '  L += ' + f(LOOK.haze) + ' * exp2(-1.2 * P * P);',
      // HUD region: the band a little dimmer behind the ring (wherever it rides, see setHud)
      '  vec2 hd = vec2(x - uB.w, y - uB.z) * uD;',
      '  L *= 1.0 - uG.z * exp2(-dot(hd, hd));',
      '  L *= 1.0 - 0.3 * smoothstep(0.7, 1.15, ex);',          // slightly darker towards the left/right edge
      '  float base = 0.7 * exp2(-0.8 * P * P);',
      '  float Tm = L / (1.0 + 0.2 * L);',
      '  vec3 tint = mix(uCh, uCc, smoothstep(' + f(COL.lo) + ', ' + f(COL.hi) + ', Tm));',
      '  vec3 col = uCg + uCb * base + tint * ((' + f(LOOK.gain) + ' + 9.0 * Tm) * Tm);',
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}'
    ].join('\n');
  }

  function fibreCode() {
    var out = ['#ifdef HP',
      // fibre spacing on screen (px) decides whether the hairs can be resolved at all
      '  float fsp = ' + f(FIB.df) + ' * gIg / uG.x;',
      '  float fgate = smoothstep(1.8, 3.2, fsp) * (1.0 - smoothstep(0.0015, 0.004, gXb));',
      '  if (fgate > 0.0) {'];
    FIBRES.forEach(function (z, i) {
      out.push(
        '    {',
        // along: distance to the nearest patch centre (the patch drifts with the flow)
        '      float th = ' + f(z.k) + ' * x + uFp.' + 'xy'[i] + ';',
        '      float pa = (th - 6.2831853 * floor(th * 0.1591549 + 0.5)) * ' + f(1 / z.k) + ';',
        '      float pc = (P - ' + f(z.c) + ') * ' + f(1 / FIB.across) + ';',
        '      float env = exp2(-pa * pa * ' + f(1 / (FIB.along * FIB.along)) + ' - pc * pc);',
        '      if (env > 0.003) {',
        '        float e = (P - ' + f(FIB.slant) + ' * x) * ' + f(6.2831853 / FIB.df) + ';',
        '        float id = floor(e * 0.1591549 + 0.5);',
        '        float hh = fract(sin(id * 12.9898 + ' + f(z.seed) + ') * 43758.5453);',
        '        float pf = pa + (fract(hh * 17.31) - 0.5) * ' + f(FIB.jit) + ';',
        '        float ln = (0.5 + 0.5 * cos(e)) * hh * hh * exp2(-pf * pf * ' + f(1 / (FIB.hair * FIB.hair)) + ');',
        '        L += ' + f(FIB.gain) + ' * fgate * env * ln;',
        '      }',
        '    }');
    });
    out.push('  }', '#endif');
    return out.join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  // create(canvas, opts) -> { render(t), resize(cssW, cssH, dpr), destroy(), setQuality(q), getQuality(),
  //                           period, centerline(xFrac, t) -> yFrac, setHud(xFrac, amount, rFrac),
  //                           setColors({ crest, halo, bg }), defaultColors }
  // opts as in waves.js: maxPixels (default 0.6 MP on phones, 1.5 MP otherwise), quality (0.3..1),
  // preserveDrawingBuffer, powerPreference, releaseContext (destroy() also drops the WebGL context;
  // a later create() on the same canvas restores it).  resize() / setQuality() redraw the last frame.
  // setHud(xFrac, amount, rFrac): the band is dimmed behind the HUD ring, which rides along
  // centerline(); pass the ring's horizontal position (0..1 of the canvas width), its visibility
  // (0..1, e.g. its opacity - let it fade rather than jump when the ring wraps around) and,
  // optionally, its radius as a fraction of the canvas height, every frame.  Takes effect at the next
  // render().  Default: ring at the centre, fully visible, dim extent for a ~0.25 H ring.
  function create(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var fsSrc = buildShader(STRANDS);
    var prog = null, buf = null, loc = null, lost = false, dead = false, lastT = null;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function init() {
      prog = gl.createProgram();
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      var ok = gl.getProgramParameter(prog, gl.LINK_STATUS), info = ok ? '' : gl.getProgramInfoLog(prog);
      gl.detachShader(prog, vs); gl.detachShader(prog, fs);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!ok && !gl.isContextLost()) throw new Error(info);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      loc = {
        res: gl.getUniformLocation(prog, 'uRes'), g: gl.getUniformLocation(prog, 'uG'), b: gl.getUniformLocation(prog, 'uB'),
        ph: gl.getUniformLocation(prog, 'uPh'), fp: gl.getUniformLocation(prog, 'uFp'), gp: gl.getUniformLocation(prog, 'uGp'), lod: gl.getUniformLocation(prog, 'uLod'),
        d: gl.getUniformLocation(prog, 'uD'),
        cg: gl.getUniformLocation(prog, 'uCg'), cb: gl.getUniformLocation(prog, 'uCb'),
        cc: gl.getUniformLocation(prog, 'uCc'), ch: gl.getUniformLocation(prog, 'uCh')
      };
      gl.viewport(0, 0, W, H);
    }
    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() {
      if (dead) return;
      lost = false; init();
      if (lastT !== null) render(lastT);
    }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    if (gl.isContextLost()) {
      lost = true;
      var le = canvas.__wavesLoseCtx, tries = 0;
      var tryRestore = function () {
        if (dead || !gl.isContextLost() || !le) return;
        try { le.restoreContext(); } catch (err) { /* not restorable (yet) */ }
        if (++tries < 4) setTimeout(tryRestore, 30 * tries);
      };
      if (le) { canvas.__wavesLoseCtx = null; tryRestore(); }
    }

    var Ph = new Float32Array(8), Lod = new Float32Array(3);
    var hudX = 0.5, hudA = 1, hudR = 0;
    // colour uniforms (kept in JS, so they survive a context restore)
    var Cg = new Float32Array(3), Cb = new Float32Array(3), Cc = new Float32Array(3), Ch = new Float32Array(3);
    var DEF = defaultColors();
    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1;
    var lastCss = null;
    if (!lost) init();

    // layout: unit = short-side scale.  Landscape: the screen height; narrower screens keep about
    // 1.6 (portrait 1) units across so the stream still reads as a horizontal band.
    function unitPx(w, h) {
      var a = w / h;
      if (a >= 1.6) return h;
      if (a >= 1.0) return w / 1.6;
      return w;
    }

    function resize(cssW, cssH, dpr) {
      if (dead) return;
      dpr = dpr || 1;
      lastCss = [cssW, cssH, dpr];
      var phone = Math.min(cssW, cssH) < 600 && dpr >= 1.5;
      var maxPixels = opts.maxPixels || (phone ? 0.6e6 : 1.5e6);
      var s = Math.min(dpr, Math.sqrt(maxPixels / Math.max(1, cssW * cssH))) * quality;
      W = Math.max(1, Math.round(cssW * s)); H = Math.max(1, Math.round(cssH * s));
      if (canvas.width === W && canvas.height === H) return;
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      if (lastT !== null) render(lastT);
    }
    function setQuality(q) {
      if (dead) return;
      q = Math.max(0.3, Math.min(1, q));
      if (q === quality) return;
      quality = q;
      if (lastCss) resize(lastCss[0], lastCss[1], lastCss[2]);
    }

    function phases(ph, out) {
      for (var j = 0; j < 8; j++) {
        var md = MODES[j];
        var v = md ? (md.p - md.m * ph) % TAU : 0;
        out[j] = v < 0 ? v + TAU : v;
      }
    }

    function render(t) {
      var tm = t % PERIOD; if (tm < 0) tm += PERIOD;
      var ph = TAU * tm / PERIOD;
      if (dead) return;
      lastT = tm;
      if (lost || gl.isContextLost()) return;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var u = unitPx(W, H), pxu = 1 / u;
      phases(ph, Ph);
      // minor strands fade out when the band gets too small to resolve them
      var cssU = u / Math.max(1e-6, (lastCss ? W / lastCss[0] : 1));
      Lod[0] = 1; Lod[1] = 0.35 + 0.65 * smooth(120, 220, cssU); Lod[2] = smooth(150, 300, cssU);
      gl.uniform2f(loc.res, W, H);
      var xh = (hudX - 0.5) * W * pxu;                                // HUD centre (units); its y: the band centre there
      gl.uniform4f(loc.g, pxu, 0.6 * pxu, LOOK.dim * hudA, 0.5 * W * pxu);
      gl.uniform4f(loc.b, BAND.h, 1 / BAND.h, centreY(xh, ph), xh);
      var ru = hudR * H * pxu;                                         // ring radius (units), 0 = unknown
      ru = ru > 0 ? Math.max(0.12, Math.min(0.45, ru)) : 0;
      gl.uniform2f(loc.d, 1 / (ru ? LOOK.dimKx * ru : LOOK.dimRx), 1 / (ru ? LOOK.dimKy * ru : LOOK.dimRy));
      gl.uniform4fv(loc.ph, Ph);
      var g1 = (TAU - ph) % TAU, g2 = (2 * TAU - 2 * ph) % TAU, g3 = (3 * TAU - 3 * ph) % TAU;
      gl.uniform3f(loc.gp, g1, g2, g3);
      var f0 = (FIBRES[0].p - FIBRES[0].m * ph) % TAU, f1 = (FIBRES[1].p - FIBRES[1].m * ph) % TAU;
      gl.uniform2f(loc.fp, f0 < 0 ? f0 + TAU : f0, f1 < 0 ? f1 + TAU : f1);
      gl.uniform1fv(loc.lod, Lod);
      gl.uniform3fv(loc.cg, Cg); gl.uniform3fv(loc.cb, Cb); gl.uniform3fv(loc.cc, Cc); gl.uniform3fv(loc.ch, Ch);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // JS mirror of the stream function: y (units, up) of the level psi = 0 at x (units)
    // (Newton on psi(x, y) = 0; psi is strictly increasing in y, so this converges in a few steps)
    var PhC = new Float64Array(8), psiV = 0, psiY = 1;
    function psiAt(x, y, P) {
      var Yc = BAND.cy, j, md;
      for (j = 0; j < MODES.length; j++) { md = MODES[j]; if (md.ya) Yc += md.ya * Math.sin(md.k * x + P[j]); }
      var s0 = (y - Yc) / BAND.h, E = 0, Es = 0;
      for (j = 0; j < MODES.length; j++) {
        md = MODES[j];
        if (!(md.a || md.b || md.c)) continue;
        var sn = Math.sin(md.k * x + P[j]), a = md.a || 0, b = md.b || 0, c = md.c || 0;
        E += (a + b * s0 + c * s0 * s0) * sn; Es += (b + 2 * c * s0) * sn;
      }
      psiV = s0 - E; psiY = (1 - Es) / BAND.h;
    }
    function centreY(x, ph) {
      phases(ph, PhC);
      var y = BAND.cy;
      for (var j = 0; j < MODES.length; j++) if (MODES[j].ya) y += MODES[j].ya * Math.sin(MODES[j].k * x + PhC[j]);
      for (var it = 0; it < 5; it++) { psiAt(x, y, PhC); y -= psiV / psiY; }
      return y;
    }
    function centerline(xFrac, t) {
      var tm = t % PERIOD; if (tm < 0) tm += PERIOD;
      var u = unitPx(W, H);
      var x = (xFrac - 0.5) * W / u;
      return 0.5 - centreY(x, TAU * tm / PERIOD) * u / H;
    }

    function setHud(xFrac, amount, rFrac) {
      hudX = typeof xFrac === 'number' && isFinite(xFrac) ? Math.max(-0.5, Math.min(1.5, xFrac)) : 0.5;
      hudA = typeof amount === 'number' && isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 1;
      hudR = typeof rFrac === 'number' && isFinite(rFrac) && rFrac > 0 ? rFrac : 0;
    }

    // setColors({ crest, halo, bg }): sRGB 0..1 triples (any may be omitted); call it every frame for
    // transitions - it only stores the values (no allocation, no GL), the next render() uses them
    function okc(c) {
      return c && c.length >= 3 && isFinite(c[0]) && isFinite(c[1]) && isFinite(c[2]);
    }
    var bgS = [0, 0, 0], haloS = [0, 0, 0];
    function setColors(c) {
      if (!c) return;
      var k, v;
      if (okc(c.bg)) for (k = 0; k < 3; k++) bgS[k] = Math.max(0, Math.min(1, +c.bg[k]));
      if (okc(c.halo)) for (k = 0; k < 3; k++) haloS[k] = Math.max(0, Math.min(1, +c.halo[k]));
      if (okc(c.crest)) for (k = 0; k < 3; k++) { v = Math.max(0, Math.min(1, +c.crest[k])); Cc[k] = v / COL.CK; }
      for (k = 0; k < 3; k++) {
        Ch[k] = haloS[k] / COL.HK;
        Cg[k] = 255 * bgS[k];
        Cb[k] = 255 * (COL.GB * bgS[k] + COL.GH * haloS[k]);
      }
    }
    setColors(DEF);

    function destroy() {
      if (dead) return;
      dead = true;
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      if (!gl.isContextLost()) { gl.deleteBuffer(buf); gl.deleteProgram(prog); }
      prog = buf = loc = null;
      if (opts.releaseContext && !gl.isContextLost()) {
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          var keep = function (e) { e.preventDefault(); canvas.removeEventListener('webglcontextlost', keep, false); };
          canvas.addEventListener('webglcontextlost', keep, false);
          canvas.__wavesLoseCtx = ext;
          ext.loseContext();
        }
      }
    }
    return { render: render, resize: resize, destroy: destroy, setQuality: setQuality,
      getQuality: function () { return quality; }, period: PERIOD, centerline: centerline, setHud: setHud,
      setColors: setColors, defaultColors: defaultColors() };
  }

  window.WAVE_VARIANTS = window.WAVE_VARIANTS || {};
  window.WAVE_VARIANTS['h3'] = { title: 'Strömung', create: create };
})();
