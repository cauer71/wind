// "Tiefe" – a horizontal silk sheet seen in perspective (variant h4 for wind.auer.page).
// Same rendering language as waves.js (thin glowing crests, soft halos, analytic depth of field,
// anti-aliased rational profiles, fibre patches); exact seamless loop of PERIOD seconds.
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  // ---------------------------------------------------------------------------
  // Geometry (screen-height units, y up, origin = screen centre):
  //   The sheet recedes towards a soft horizon at yh(x, t) (a slow, long heave travelling to the
  //   right lifts the whole sheet a little).  Below it, s = yh - y is the screen distance to the
  //   horizon; depth and lateral sheet coordinates are
  //       zeta = -ln(s / SREF)      (log depth: fold spacing on screen grows linearly with s near
  //                                  the horizon; the extra -KAP2 s term below lets the spacing -
  //                                  and with it the roll speed - grow more slowly towards the
  //                                  bottom, so the nearest folds stay calm)
  //       X    = x / (s + XS0)      (perspective lateral coordinate, softened near the horizon)
  //   The folds are the iso-lines phi = 2 pi n of
  //       phi = KAP * zeta - KAP2 * s + roll(t) + sum_i A_i sin(K_i X + L_i zeta + w_i t + c_i)
  //   - roll(t) = M * 2 pi t / PERIOD: the folds roll slowly towards the viewer (M folds per loop;
  //     only roll mod 2 pi enters the phase, the whole folds go into the fold index),
  //   - the swell terms bend the folds; their screen amplitude and wavelength both scale with s,
  //     so near folds swing wider and travel faster across (parallax), far ones are miniatures.
  //   Every pixel shades its three nearest folds analytically: distance = (phase difference) /
  //   |grad phi| (exact gradient, no derivatives extension), crest width = pixel footprint +
  //   intrinsic width (proportional to the local fold spacing, varying along the fold like a
  //   twisting ribbon) + depth-of-field blur (grows linearly towards the near, bottom folds; the
  //   focal plane sits just below the screen centre).  Each fold: thin bright rim, a broad
  //   one-sided glow on its near face (the lit body of the fold), per-fold brightness that
  //   depends on the fold index (mod M, so the loop closes) and on X.  Fine fibre striations
  //   run along the in-focus folds in drifting patches (highp only).
  //   The near folds and the sheet body fade towards the bottom edge, so the glowing crests read
  //   as one horizontal band with dark space above and below it (the HUD rides on its centre).
  //   Far folds fade out before their spacing reaches the pixel grid: nothing shimmers.
  //   mediump: every expression avoids squaring tiny screen lengths (fp16 flushes < 2^-14).
  // All time dependence is built from integer harmonics of ph = 2 pi (t mod PERIOD) / PERIOD.
  // ---------------------------------------------------------------------------
  var PERIOD = 20;
  var DEF = {
    YH: 0.17,          // horizon height (units above the centre)
    heave: [[0.030, 2.2, -1, 0.7], [0.012, 4.3, 2, 2.1]],      // [amp, k, harmonic (-: travels right), phase]
    SREF: 0.25, KAP: 14.0, KAP2: 12.0, M: 7,   // depth phase -KAP ln(s) - KAP2 s; M folds roll in per loop (fold identity is M-periodic)
    BQ: 3, TQ: 5,                    // fold-index steps of the brightness / twist pattern (x 2 pi / M)
    swell: [[1.6, 1.5, 0.0, -1, 0.3], [0.6, 3.3, 1.0, 2, 1.9], [0.15, 7.0, -0.8, -3, 4.0]],  // [A, K, L, harmonic, phase]
    SMIN: 0.02, S1: 0.10,          // far fade-in (s)
    SF: 0.20, DB: 0.16, DBF: 0.02,  // focus (s), blur per unit s towards near / far
    HW: 0.09,                       // intrinsic half-width as a fraction of the spacing
    TB: 0.6, KT: 2.2,               // twist contrast, twist wave number along X
    BRK: 0.8, BRN: -1,              // brightness pattern: X wave number, harmonic (drift)
    TWN: 1,                         // twist pattern drift harmonic
    GLOW: 0.0024, SOFT: 0.45, SHW: 4.0, SHE: 3.0, GMAX: 0.35,
    NEAR: 0.75, NS0: 0.22, NS1: 0.62, // dimming of the near folds (fraction, s range): the crest band reads as a band
    BF: 1.0, BS0: 0.28, BS1: 0.65,    // falloff of the sheet body towards the bottom edge (fraction, s range)
    SWL: 0.35,                      // swell lighting (crests on the swell's lit flank brighter)
    gain: 69.0, I: 1.6, TMK: 0.28,   // crest gain, intensity, tone-map shoulder
    SC: 0.13,                       // band centre (s below the horizon) for centerline(): median / centroid of the sharp-crest energy
    XS0: 0.15,                      // soft perspective: X = x / (s + XS0) keeps the far edges calm
    FG: 0.36, FGW: 0.16,            // scale-free glow on the near face of each fold: peak, width (x spacing)
    RC: 0.22, RCI: 0.35,            // ribbon second edge: max offset (x spacing), strength
    HZ: 0.08, HZW: 0.09,            // horizon haze: strength, width (units)
    FGN: 0.5,                       // extra near-face glow on the nearest folds
    NF: 9.0, FSL: 0.9, KF: 1.7, FPA: 6.0, FPH: 12.0, FPJ: 1.0, FIB: 1.2, FDN: 1   // fibres: hairs per spacing, slant, patch wave number, patch / hair falloff, jitter, strength, drift harmonic
  };

  // Colours (sRGB 0..1).  The defaults reproduce the original look: crest / halo are the original
  // light tint (0.53, 0.645, 1) at fixed levels, so the shader tint is colour / level.
  var CREST_L = 0.8, HALO_L = 0.4;
  var DEF_COLORS = {
    crest: [0.53 * CREST_L, 0.645 * CREST_L, 1.0 * CREST_L],
    halo: [0.53 * HALO_L, 0.645 * HALO_L, 1.0 * HALO_L],
    bg: [17.6 / 255, 19.0 / 255, 24.0 / 255]
  };
  // sheet body = BDG * ground + BDH * halo tint (least-squares fit of the original (4.4, 5.2, 6.6))
  var BDG = 0.2068, BDH = 1.6856;
  // crest tint gain: half-way (sqrt) luminance normalisation towards the default crest, so a hot
  // palette (e.g. gold) does not glare and a dim one does not vanish; exactly 1 for the defaults
  function luma(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  var CREST_Y = luma(DEF_COLORS.crest);

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 ? s + '.0' : s; }

  function buildShader(P) {
    var sw = P.swell, hv = P.heave;
    var db = TAU * P.BQ / P.M, dt = TAU * P.TQ / P.M;
    var c4 = Math.cos(db), s4 = Math.sin(db), c6 = Math.cos(dt), s6 = Math.sin(dt);
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform vec4 uG;',     // units per px, AA width, -, fibre patch drift phase
      'uniform vec4 uC;',     // composition offset x, y, folds rolled in (integer, mod M), -
      'uniform vec4 uH;',     // heave phases (2), brightness phase, twist phase
      'uniform vec4 uP;',     // swell phases (3), roll phase (mod 2 pi)
      'uniform vec3 uBg, uBd, uHK, uCK;',   // ground, sheet body (0..255), light tint of the glows / of the bright crests
      'const float TAU = 6.2831853;',
      'const float GLOW = ' + f(P.GLOW) + ', SOFT = ' + f(P.SOFT) + ', SHW = ' + f(P.SHW) + ', SHE = ' + f(P.SHE) + ', GMAX = ' + f(P.GMAX) + ';',
      'const float TB = ' + f(P.TB) + ', FG = ' + f(P.FG) + ', FGW = ' + f(P.FGW) + ', RC = ' + f(P.RC) + ', RCI = ' + f(P.RCI) + ';',
      'float gFG;',            // near-face glow strength at this pixel (grows towards the near folds)
      // one fold: signed phase distance du (+: pixel above the crest), spacing sp, blur w,
      // intrinsic half-width hw, twist edge (1 = edge-on, thin and bright), brightness br
      'float crest(float du, float sp, float w, float hw, float edge, float br, float sn) {',
      '  float d = du * sp;',
      '  float wc = 0.0012 + hw * (1.0 - edge) + w;',
      // side weight: 1 on the near (lower) face, 0 above; blended over the core width so that
      // nothing steps even where the core is blurred and dim
      // (normalised before squaring: d and wc are tiny, their squares would flush to zero in fp16;
      //  the clamp keeps r * r finite there too - at |r| = 64 the side weight is already 0 / 1)
      '  float r = clamp(d / wc, -64.0, 64.0);',
      '  float ou = 0.5 - 0.5 * r * inversesqrt(1.0 + r * r);',
      '  float ad = abs(d) * (1.0 - SOFT * ou);',
      '  float y = ad / wc;',
      '  float prof = 1.0 / (1.0 + y * y);',
      '  prof *= prof;',
      '  float res = prof * 0.008 / (wc + 0.003);',
      // second edge of the twisting ribbon: apart where the fold shows its face, meeting the
      // crest where it turns edge-on
      '  float dc = d + RC * sp * sn;',
      '  float w2 = 0.0012 + 0.25 * hw + w;',
      '  float y2 = dc / w2;',
      '  float p2 = 1.0 / (1.0 + y2 * y2);',
      '  res += RCI * p2 * p2 * 0.008 / (w2 + 0.003);',
      '  float g = min((0.007 + 1.6 * w) * (1.0 + SHW * ou), GMAX * sp);',
      '  float gd = g + ad;',
      '  float gr = g / gd;',
      '  res += GLOW * (1.0 + SHE * ou) * gr * gr / g;',   // = g / gd^2 without squaring tiny numbers
      // lit near face of the fold: same shape at every depth (broad for the near folds)
      '  float gf = FGW * sp + w;',
      '  float yf = gf / (gf + ad);',
      '  res += gFG * ou * yf * yf;',
      '  float win = clamp((1.5 - abs(du)) * 3.0, 0.0, 1.0);',   // exactly zero where the fold leaves the 3-set
      '  return br * (1.0 - TB + TB * edge) * win * res;',
      '}',
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x + uC.xy;',
      '  float x = p.x;',
      '  float h1 = ' + f(hv[0][1]) + ' * x + uH.x, h2 = ' + f(hv[1][1]) + ' * x + uH.y;',
      '  float yh = ' + f(P.YH) + ' + ' + f(hv[0][0]) + ' * sin(h1) + ' + f(hv[1][0]) + ' * sin(h2);',
      '  float dyh = ' + f(hv[0][0] * hv[0][1]) + ' * cos(h1) + ' + f(hv[1][0] * hv[1][1]) + ' * cos(h2);',
      '  float s = yh - p.y;',
      '  float L = 0.0;',
      '  if (s > ' + f(P.SMIN) + ') {',
      '    float ls = log(s * ' + f(1 / P.SREF) + ');',
      '    float ix = 1.0 / (s + ' + f(P.XS0) + ');',
      '    float X = x * ix;',
      // gradients are carried pre-multiplied by s (|grad phi| ~ KAP / s would overflow a
      // mediump dot product near the horizon)
      '    vec2 dX = vec2(ix - x * dyh * ix * ix, x * ix * ix) * s;',
      '    vec2 dl = vec2(dyh, -1.0);',
      '    float b1 = ' + f(sw[0][1]) + ' * X - ' + f(sw[0][2]) + ' * ls + uP.x;',
      '    float b2 = ' + f(sw[1][1]) + ' * X - ' + f(sw[1][2]) + ' * ls + uP.y;',
      '    float b3 = ' + f(sw[2][1]) + ' * X - ' + f(sw[2][2]) + ' * ls + uP.z;',
      '    float sb1 = sin(b1), cb1 = cos(b1), cb2 = cos(b2), cb3 = cos(b3);',
      '    float kk = ' + f(-P.KAP) + ' - ' + f(P.KAP2) + ' * s;',   // s * d(depth phase)/ds
      '    float phi = ' + f(-P.KAP) + ' * ls - ' + f(P.KAP2) + ' * s + uP.w + ' + f(sw[0][0]) + ' * sb1 + ' + f(sw[1][0]) + ' * sin(b2) + ' + f(sw[2][0]) + ' * sin(b3);',
      '    vec2 g = kk * dl + ' + f(sw[0][0]) + ' * cb1 * (' + f(sw[0][1]) + ' * dX - ' + f(sw[0][2]) + ' * dl)',
      '           + ' + f(sw[1][0]) + ' * cb2 * (' + f(sw[1][1]) + ' * dX - ' + f(sw[1][2]) + ' * dl)',
      '           + ' + f(sw[2][0]) + ' * cb3 * (' + f(sw[2][1]) + ' * dX - ' + f(sw[2][2]) + ' * dl);',
      '    float sp = TAU * s * inversesqrt(dot(g, g));',  // local fold spacing (units)
      '    float spx = sp / uG.x;',                        // ... in pixels
      '    float fade = smoothstep(' + f(P.SMIN) + ', ' + f(P.S1) + ', s) * smoothstep(3.0, 7.0, spx);',
      '    if (fade > 0.0) {',
      '      float u = phi * ' + f(1 / TAU) + ';',
      '      float n0 = floor(u + 0.5);',
      '      float fu = u - n0;',
      // fold index mod M (+ whole folds rolled in so far, which keeps uP.w < 2 pi); rounding-safe for integers
      '      float nn = n0 + uC.z;',
      '      float nm = nn - ' + f(P.M) + ' * floor((nn + 0.5) * ' + f(1 / P.M) + ');',
      // per-fold brightness (fold index mod M, along X, drifting) and twist; neighbours by rotation
      '      float a = ' + f(db) + ' * nm + ' + f(P.BRK) + ' * X + uH.z;',
      '      vec2 A0 = vec2(sin(a), cos(a));',
      '      vec2 Am = vec2(A0.x * ' + f(c4) + ' - A0.y * ' + f(s4) + ', A0.y * ' + f(c4) + ' + A0.x * ' + f(s4) + ');',  // a - db (fold n0 - 1)
      '      vec2 Ap = vec2(A0.x * ' + f(c4) + ' + A0.y * ' + f(s4) + ', A0.y * ' + f(c4) + ' - A0.x * ' + f(s4) + ');',  // a + db (fold n0 + 1)
      '      vec3 bv = 0.5 + 0.5 * vec3(Am.x, A0.x, Ap.x);',
      '      bv = 0.15 + 0.85 * bv * bv * bv;',
      // defocused near folds lose contrast: their brightness evens out
      '      bv = mix(bv, 0.3 + 0.5 * bv, smoothstep(0.3, 0.7, s));',
      '      float c = ' + f(dt) + ' * nm + ' + f(P.KT) + ' * X + uH.w;',
      '      vec2 C0 = vec2(cos(c), sin(c));',
      '      vec3 cc = vec3(C0.x * ' + f(c6) + ' + C0.y * ' + f(s6) + ', C0.x, C0.x * ' + f(c6) + ' - C0.y * ' + f(s6) + ');',  // cos(c -+ dt)
      '      vec3 cs = vec3(C0.y * ' + f(c6) + ' - C0.x * ' + f(s6) + ', C0.y, C0.y * ' + f(c6) + ' + C0.x * ' + f(s6) + ');',  // sin(c -+ dt)
      '      vec3 ed = cc * cc;',
      '      float wd = ' + f(P.DB) + ' * max(s - ' + f(P.SF) + ', 0.0) + ' + f(P.DBF) + ' * max(' + f(P.SF) + ' - s, 0.0);',
      '      float w = wd + uG.y;',
      '      float hw = ' + f(P.HW) + ' * sp;',
      '      gFG = FG * (1.0 + ' + f(P.FGN) + ' * smoothstep(0.25, 0.7, s));',
      '      float Lc = crest(fu + 1.0, sp, w, hw, ed.x, bv.x, cs.x)',
      '               + crest(fu, sp, w, hw, ed.y, bv.y, cs.y)',
      '               + crest(fu - 1.0, sp, w, hw, ed.z, bv.z, cs.z);',
      '      float en = 1.0 - ' + f(P.NEAR) + ' * smoothstep(' + f(P.NS0) + ', ' + f(P.NS1) + ', s);',
      '      float lt = 1.0 + ' + f(P.SWL) + ' * sb1;',
      '#ifdef HP',
      // fibre patches on the near face of the in-focus folds: fine, slightly slanted hairs that
      // follow the fold; each hair has its own brightness and extent (hash of its index, whose
      // boundaries sit at the profile minima); patches drift along the folds
      '      float fgt = smoothstep(2.0, 3.2, spx * ' + f(1 / P.NF) + ') * (1.0 - smoothstep(0.003, 0.008, wd));',
      '      float bq = (fu + 0.25) * 4.0;',
      '      float bump = max(0.0, 1.0 - bq * bq);',
      '      if (fgt * bump > 0.0) {',
      '        float pq = ' + f(P.KF) + ' * X + 2.39996 * nm + uG.w;',
      '        float env = bump * bump * exp2(' + f(-P.FPA) + ' * (1.0 - cos(pq)));',
      '        if (env > 0.003) {',
      '          float e = ' + f(P.NF) + ' * fu + ' + f(P.FSL) + ' * X;',
      '          float id = floor(e + 0.5);',
      '          float h = fract(sin(id * 12.9898 + nm * 7.31) * 43758.5453);',
      '          float ln = (0.5 + 0.5 * cos(TAU * e)) * h * h * exp2(' + f(-P.FPH) + ' * (1.0 - cos(pq + (fract(h * 17.31) - 0.5) * ' + f(P.FPJ) + ')));',
      '          Lc += ' + f(P.FIB) + ' * fgt * env * ln * bv.y;',
      '        }',
      '      }',
      '#endif',
      '      L = ' + f(P.I) + ' * fade * en * lt * Lc;',
      '    }',
      '  }',
      // background: dark void above, faint navy sheet body below the horizon, fading out again
      // towards the bottom edge
      '  vec2 pv = gl_FragCoord.xy / uRes * 2.0 - 1.0;',
      '  float base = smoothstep(-0.05, 0.25, s) * (1.0 - ' + f(P.BF) + ' * smoothstep(' + f(P.BS0) + ', ' + f(P.BS1) + ', s));',
        // faint luminous haze where the far folds merge (aerial perspective), fading upwards
      '  float hz = s + 0.03;',
      '  L += ' + f(P.HZ) + ' * exp2(-hz * hz * ' + f(1 / (P.HZW * P.HZW)) + ');',
      '  L *= 1.0 - 0.4 * smoothstep(0.9, 1.5, length(pv));',
      '  float Tm = L / (1.0 + ' + f(P.TMK) + ' * L);',
      // light tint: halo colour for the faint glows / haze / veils, crest colour for the bright crest cores
      '  vec3 col = uBg + uBd * base + mix(uHK, uCK, smoothstep(0.1, 1.0, Tm)) * ((' + f(P.gain) + ' + 9.0 * Tm) * Tm);',
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}'
    ].join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  function create(canvas, opts) {
    opts = opts || {};
    var P = {}, k;
    for (k in DEF) P[k] = DEF[k];
    if (opts.params) for (k in opts.params) P[k] = opts.params[k];
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var fsSrc = buildShader(P);
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
      loc = { res: gl.getUniformLocation(prog, 'uRes'), g: gl.getUniformLocation(prog, 'uG'), c: gl.getUniformLocation(prog, 'uC'),
        h: gl.getUniformLocation(prog, 'uH'), p: gl.getUniformLocation(prog, 'uP'),
        bg: gl.getUniformLocation(prog, 'uBg'), bd: gl.getUniformLocation(prog, 'uBd'),
        hk: gl.getUniformLocation(prog, 'uHK'), ck: gl.getUniformLocation(prog, 'uCK') };
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

    // current colours (stored only; uploaded in render, so they survive a context restore)
    var colCrest = DEF_COLORS.crest.slice(), colHalo = DEF_COLORS.halo.slice(), colBg = DEF_COLORS.bg.slice();
    function copy3(dst, src) {
      if (!src) return;
      for (var i = 0; i < 3; i++) { var v = +src[i]; if (v === v) dst[i] = v < 0 ? 0 : v; }
    }
    function setColors(c) {
      if (!c) return;
      copy3(colCrest, c.crest); copy3(colHalo, c.halo); copy3(colBg, c.bg);
    }
    if (opts.colors) setColors(opts.colors);

    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1, lastCss = null;
    var comp = { norm: H, cx: 0, cy: 0 };
    if (!lost) init();

    function layout() {
      // landscape: 1 unit = screen height; narrower screens zoom out a little so the folds keep
      // their width, portrait screens see a taller slice of the sheet (continuous in the aspect)
      var aspect = W / H;
      comp.cx = 0; comp.cy = 0;
      if (aspect >= 1.6) comp.norm = H;
      else if (aspect >= 0.9) comp.norm = H * Math.sqrt(aspect / 1.6);
      else comp.norm = H * 0.75 * Math.pow(aspect / 0.9, 0.35);
    }
    layout();

    function resize(cssW, cssH, dpr) {
      if (dead) return;
      dpr = dpr || 1;
      lastCss = [cssW, cssH, dpr];
      var phone = Math.min(cssW, cssH) < 600 && dpr >= 1.5;
      var maxPixels = opts.maxPixels || (phone ? 0.6e6 : 1.5e6);
      var s = Math.min(dpr, Math.sqrt(maxPixels / Math.max(1, cssW * cssH))) * quality;
      var nw = Math.max(1, Math.round(cssW * s)), nh = Math.max(1, Math.round(cssH * s));
      if (canvas.width === nw && canvas.height === nh && W === nw && H === nh) return;
      W = nw; H = nh;
      canvas.width = W; canvas.height = H;
      layout();
      if (!lost && !gl.isContextLost()) gl.viewport(0, 0, W, H);
      if (lastT !== null) render(lastT);
    }
    function setQuality(q) {
      if (dead) return;
      q = Math.max(0.3, Math.min(1, q));
      if (q === quality) return;
      quality = q;
      if (lastCss) resize(lastCss[0], lastCss[1], lastCss[2]);
    }
    function wrap(a) { a = a % TAU; return a < 0 ? a + TAU : a; }
    function loopTime(t) { var tm = t % PERIOD; return tm < 0 ? tm + PERIOD : tm; }   // t mod PERIOD

    // horizon height (units, y up) at screen x (units) for loop phase ph
    function horizon(x, ph) {
      var hv = P.heave;
      return P.YH + hv[0][0] * Math.sin(hv[0][1] * x + hv[0][2] * ph + hv[0][3]) + hv[1][0] * Math.sin(hv[1][1] * x + hv[1][2] * ph + hv[1][3]);
    }

    function render(t) {
      if (dead) return;
      var tm = loopTime(t), ph = TAU * tm / PERIOD;
      lastT = tm;
      if (lost || gl.isContextLost()) return;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var pxu = 1 / comp.norm, hv = P.heave, sw = P.swell;
      gl.uniform2f(loc.res, W, H);
      gl.uniform4f(loc.g, pxu, 0.6 * pxu, 0, wrap(P.FDN * ph));
      // roll: M folds per loop.  Only the fractional fold (roll mod 2 pi) goes into the phase - a
      // small number keeps the fold positions precise on mediump - the whole folds rolled in so far
      // go into the fold index (all fold-index dependence is M-periodic)
      var rk = Math.floor(P.M * ph / TAU), roll = P.M * ph - rk * TAU;
      gl.uniform4f(loc.c, comp.cx, comp.cy, rk % P.M, 0);
      gl.uniform4f(loc.h, wrap(hv[0][2] * ph + hv[0][3]), wrap(hv[1][2] * ph + hv[1][3]), wrap(P.BRN * ph), wrap(P.TWN * ph));
      gl.uniform4f(loc.p, wrap(sw[0][3] * ph + sw[0][4]), wrap(sw[1][3] * ph + sw[1][4]), wrap(sw[2][3] * ph + sw[2][4]), roll);
      var hk0 = colHalo[0] / HALO_L, hk1 = colHalo[1] / HALO_L, hk2 = colHalo[2] / HALO_L;
      gl.uniform3f(loc.bg, 255 * colBg[0], 255 * colBg[1], 255 * colBg[2]);
      gl.uniform3f(loc.bd, BDG * 255 * colBg[0] + BDH * hk0, BDG * 255 * colBg[1] + BDH * hk1, BDG * 255 * colBg[2] + BDH * hk2);
      gl.uniform3f(loc.hk, hk0, hk1, hk2);
      var cg = Math.min(1.25, Math.max(0.8, Math.sqrt(CREST_Y / Math.max(1e-4, luma(colCrest))))) / CREST_L;
      gl.uniform3f(loc.ck, colCrest[0] * cg, colCrest[1] * cg, colCrest[2] * cg);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // vertical position (0 = top, 1 = bottom) of the band's visual centre at xFrac, time t
    function centerline(xFrac, t) {
      var ph = TAU * loopTime(t) / PERIOD;
      var x = (xFrac - 0.5) * W / comp.norm + comp.cx;
      // on small canvases the farthest folds (narrower than ~5 px) fade out, so the band's centre of
      // mass sits a little lower: s at which the fold spacing is ~5 px, beyond the always-faded range
      var sLost = 5 * P.KAP / (TAU * comp.norm);
      var y = horizon(x, ph) - P.SC - Math.max(0, sLost - 0.031);
      return 0.5 - (y - comp.cy) * comp.norm / H;
    }

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
      getQuality: function () { return quality; }, period: PERIOD, centerline: centerline,
      setColors: setColors,
      defaultColors: { crest: DEF_COLORS.crest.slice(), halo: DEF_COLORS.halo.slice(), bg: DEF_COLORS.bg.slice() } };
  }

  window.WAVE_VARIANTS = window.WAVE_VARIANTS || {};
  window.WAVE_VARIANTS['h4'] = { title: 'Tiefe', create: create };
})();
