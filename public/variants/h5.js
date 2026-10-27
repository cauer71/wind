// Schleier (h5) – three translucent horizontal silk veils at different depths, drifting from left to
// right with parallax: the back veil is a slow, strongly defocused haze, the middle veil has soft
// glowing fold edges, the front veil carries a few sharp crests with fibre patches.  Variant for
// wind.auer.page, rendered in the language of waves.js ("Wellen"): thin crests with rational-bell
// profiles, one-sided sheet glows (the lit body of a fold), analytic depth of field, anti-aliased
// line widths, static dither, dark navy ground.  Exact seamless loop of PERIOD seconds.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var PERIOD = 30;

  // ---------------------------------------------------------------------------
  // Frame: p = (pixel - centre) / norm, y up; norm = canvas height in landscape (aspect >= 1.6), so
  // one unit = the stage height and the band spans the full width.  Squarer / portrait screens zoom
  // in continuously and spread the veils vertically (uV.y), see normOf / spreadOf.
  //
  // Every curve is   y(x, t) = S(x, t) + o + sum_m R_m . B_m(x, t)
  //   S      = the shared spine (slow standing swell of the whole band; the HUD rides on it),
  //   B_m    = (cos n ph cos kx, sin n ph cos kx, cos n ph sin kx, sin n ph sin kx) for the m-th wave
  //            number k_m of the curve's layer with integer harmonic n_m (ph = 2 pi t / PERIOD),
  //   R_m    = constant 4-vectors, so travelling waves cos(kx - n ph + phi) and standing waves
  //            cos(kx + phi) cos(n ph + psi) both cost one dot product.
  // Each layer drifts at its own speed v = 2 pi n / (k PERIOD) (back slowest), which gives the
  // parallax; its fold brightness, twist highlights and fibre patches travel with the same speed.
  // Layers: back veil (2 broad rims + a soft pleat, blur 0.034-0.05 units, ~9 px/s), middle veil
  // (2 glowing edges with twist highlights + a soft pleat, ~17 px/s), front veil (3 sharp crests, the
  // upper one with a companion thread and a fibre patch, ~28 px/s; speeds at 432 px height).  Each
  // veil has a faint translucent body between its outer edges that slightly veils what lies behind.
  // Line widths never drop below the pixel footprint, profiles are smooth rational bells, fibres
  // fade out before their spacing reaches the pixel grid, so nothing shimmers.
  // ---------------------------------------------------------------------------

  // spine: standing swells (k, n, amplitude, spatial phase, temporal phase)
  var SPINE = { K: [1.35, 2.45], st: [[0, 0.042, 0.3, 0.5], [1, 0.026, -0.9, 2.1]] };
  var SPN = [1, 1];                             // spine harmonics (preallocated for centerline)

  // layers: wave numbers K with harmonics N (k = 2 pi n / (v PERIOD)), defocus, fill
  var LAYERS = [
    { // back veil: slow haze (v ~ 0.022 units/s)
      K: [9.52, 2.05, 4.1], N: [1, 1, 2],
      fill: { top: 0, bot: 2, soft: 0.1, I: 0.014, ao: 0 }, foc: 0.0
    },
    { // middle veil (v ~ 0.04 units/s)
      K: [5.24, 9.97, 2.7], N: [1, 2, 1],
      fill: { top: 0, bot: 2, soft: 0.04, I: 0.018, ao: 0.3 }, foc: 1.5
    },
    { // front veil (v ~ 0.065 units/s)
      K: [3.22, 5.8, 9.1], N: [1, 2, 3],
      fill: { top: 0, bot: 2, soft: 0.02, I: 0.04, ao: 0.3 }, foc: 2.5
    }
  ];

  // strands: layer, offset, travelling terms [m, a, phi], standing terms [m, b, phi, psi],
  // along-brightness term [m, phi] with floor a0, blur, intensity, glow side sd (+1 up / -1 down / 0),
  // sheet glow width/energy, twist {kap, n, tw, hw, tb} (kap = 2 pi n / (v PERIOD)), fibres
  var STRANDS = [
    { L: 0, o: 0.18, tr: [[0, 0.022, 0.5]], st: [[1, 0.06, 0.2, 1.0], [2, 0.022, 1.3, 0.4]], al: [0, 0.0], a0: 0.7,
      blur: 0.034, I: 3.3, sd: -1, shw: 4, she: 4 },
    { L: 0, o: 0.012, tr: [[0, 0.022, 4.0]], st: [[1, 0.05, 1.2, 2.2], [2, 0.02, 2.2, 5.0]], al: [0, 4.2], a0: 0.4,
      blur: 0.05, I: 1.76, sd: 0, shw: 0, she: 0 },
    { L: 0, o: -0.175, tr: [[0, 0.03, 2.5]], st: [[1, 0.055, 2.4, 2.9], [2, 0.022, 0.1, 0.3]], al: [0, 2.6], a0: 0.7,
      blur: 0.04, I: 2.64, sd: 1, shw: 4, she: 4 },

    { L: 1, o: 0.105, tr: [[0, 0.05, 1.0], [1, 0.011, 2.0]], st: [[2, 0.025, 0.4, 0.9]], al: [0, 0.8], a0: 0.3,
      blur: 0.013, I: 2.88, sd: -1, shw: 5, she: 4, tw: { kap: 10.48, n: 2, tw: 0.4, hw: 0.012, tb: 0.4 },
      comp: { a: 0.014, k: 5.24, n: 1, phi: 1.0 } },
    { L: 1, o: 0.012, tr: [[0, 0.05, 2.2], [1, 0.011, 4.0]], st: [[2, 0.02, 1.4, 0.9]], al: [0, 4.3], a0: 0.15,
      blur: 0.022, I: 1.25, sd: 0, shw: 0, she: 0 },
    { L: 1, o: -0.095, tr: [[0, 0.045, 3.6], [1, 0.011, 5.1]], st: [[2, 0.025, 0.6, 1.2]], al: [0, 2.5], a0: 0.35,
      blur: 0.011, I: 2.6, sd: 1, shw: 5, she: 4, tw: { kap: 10.48, n: 2, tw: 2.5, hw: 0.01, tb: 0.4 } },

    { L: 2, o: 0.04, tr: [[0, 0.085, 0.3], [1, 0.026, 1.9], [2, 0.005, 0.6]], st: [[1, 0.016, 0.7, 2.0]], al: [0, 0.9], a0: 0.25,
      blur: 0.0022, I: 2.85, sd: -1, shw: 5, she: 4, tw: { kap: 6.44, n: 2, tw: 0.7, hw: 0.011, tb: 0.6 },
      comp: { a: 0.012, k: 3.22, n: 1, phi: 2.2 },
      fib: { m: 0, phi: 1.2, s: 0.7 } },
    { L: 2, o: -0.005, tr: [[0, 0.08, 1.5], [1, 0.024, -0.4], [2, 0.005, 2.6]], st: [[1, 0.016, 2.9, 3.4]], al: [0, 4.4], a0: 0.15,
      blur: 0.0035, I: 2.25, sd: 0, shw: 0, she: 0, tw: { kap: 6.44, n: 2, tw: 3.1, hw: 0.008, tb: 0.6 } },
    { L: 2, o: -0.06, tr: [[0, 0.075, 2.6], [1, 0.024, 0.8], [2, 0.005, 4.0]], st: [[1, 0.016, 4.6, 5.0]], al: [0, 2.7], a0: 0.3,
      blur: 0.007, I: 2.3, sd: 1, shw: 4, she: 3, tw: { kap: 6.44, n: 2, tw: 5.0, hw: 0.01, tb: 0.5 } }
  ];

  var LOOK = {
    glow: 0.0012, gain: 69.0, soft: 0.45,
    cdim: 0.45, crx: 0.34, cry: 0.24,          // calmer centre behind the HUD
    edim: 0.3, ed0: 0.72, ed1: 1.05,           // dimmer far left / right
    eblur0: 0.55, eblur1: 1.0                  // far left / right defocus
  };
  // colours (sRGB 0..1).  The image was tuned with per-layer tints back (0.5, 0.63, 1) and front
  // (0.56, 0.655, 1) (middle halfway) times the light; the default crest colour is the front tint at the
  // brightness of a bright crest core (CREST_REF), the default halo the back tint at HALO_REF, the
  // default ground the ground far from the band.  setColors() rescales by these references, so the
  // three colours set hue and overall level of the whole image; COLGAIN is a per-variant level trim.
  var CREST_REF = 0.72, HALO_REF = 0.375, COLGAIN = 1.0;
  var HMIX = [0.1, 1.2];                        // Tm range over which faint light turns from halo to layer colour
  var BG0 = [17.6 + 0.3 * 4.4, 19.0 + 0.3 * 5.2, 24.0 + 0.3 * 6.6];      // ground in 0..255 (base = 0.3)
  var BGLIFT = [4.4 / BG0[0], 5.2 / BG0[1], 6.6 / BG0[2]];              // lift along the band per unit base
  var DEFAULT_COLORS = {
    crest: [0.56 * CREST_REF, 0.655 * CREST_REF, 1.0 * CREST_REF],
    halo: [0.5 * HALO_REF, 0.63 * HALO_REF, 1.0 * HALO_REF],
    bg: [BG0[0] / 255, BG0[1] / 255, BG0[2] / 255]
  };
  var FH = 64;                                  // fibre hairs passing per period (sets the hair slant)
  // centerline: weighted mean of the strand curves, weight = CLA x the strand's drifting along-brightness
  // + a static share CLB (the back veil rims keep the trace in the middle of the haze), plus a small
  // offset CLO (units, y up).  Fitted to rendered stage frames (aspect 1.6-2.4) against five estimates
  // of the band's visual centre at once (luminance centroids with exponent 1 / 1.5 / 2, linear centroid
  // above the ground, midpoint of the visible envelope), so it does not favour one definition.
  var CLA = [0.142, 0.046, 0.104, 0.125, 0.009, 0.094, 0.078, 0.087, 0.066];
  var CLB = [0.118, 0.0, 0.065, 0.037, 0.0, 0.0, 0.028, 0.0, 0.0];
  var CLO = -0.0128;

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 && s.indexOf('e') < 0 ? s + '.0' : s; }

  // constant coefficient 4-vectors per strand and wave number
  function coeffs(s) {
    var R = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], i;
    for (i = 0; i < s.tr.length; i++) {
      var m = s.tr[i][0], a = s.tr[i][1], p = s.tr[i][2];
      // a cos(kx - n ph + p) = a (cos p, sin p, -sin p, cos p) . B
      R[m][0] += a * Math.cos(p); R[m][1] += a * Math.sin(p); R[m][2] -= a * Math.sin(p); R[m][3] += a * Math.cos(p);
    }
    for (i = 0; i < s.st.length; i++) {
      var m2 = s.st[i][0], b = s.st[i][1], fi = s.st[i][2], ps = s.st[i][3];
      // b cos(kx + fi) cos(n ph + ps)
      R[m2][0] += b * Math.cos(fi) * Math.cos(ps); R[m2][1] -= b * Math.cos(fi) * Math.sin(ps);
      R[m2][2] -= b * Math.sin(fi) * Math.cos(ps); R[m2][3] += b * Math.sin(fi) * Math.sin(ps);
    }
    return R;
  }
  function unitTrav(p) { return [Math.cos(p), Math.sin(p), -Math.sin(p), Math.cos(p)]; }
  function v4(a) { return 'vec4(' + a.map(f).join(', ') + ')'; }
  function hx(n) { return n === 1 ? 'uH.xy' : n === 2 ? 'uH.zw' : n === 3 ? 'uH3.xy' : 'uH3.zw'; }

  var COEF = STRANDS.map(coeffs);
  var SPC = (function () {
    var R = [[0, 0, 0, 0], [0, 0, 0, 0]];
    SPINE.st.forEach(function (q) {
      var m = q[0], b = q[1], fi = q[2], ps = q[3];
      R[m][0] += b * Math.cos(fi) * Math.cos(ps); R[m][1] -= b * Math.cos(fi) * Math.sin(ps);
      R[m][2] -= b * Math.sin(fi) * Math.cos(ps); R[m][3] += b * Math.sin(fi) * Math.sin(ps);
    });
    return R;
  })();

  function buildShader(forceMediump) {
    var L = LOOK, out = [];
    out.push(forceMediump ? 'precision mediump float;' : [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif'].join('\n'));
    out.push(
      'uniform vec2 uRes;',
      'uniform vec4 uG;',            // units per px, AA width, fibre gate, -
      'uniform vec4 uH;',            // cos ph, sin ph, cos 2ph, sin 2ph
      'uniform vec4 uH3;',           // cos 3ph, sin 3ph, cos 4ph, sin 4ph
      'uniform vec4 uV;',            // view: half width (units), vertical spread of the veils, -, -
      'uniform vec4 uS[' + STRANDS.length + '];',   // per strand: twist phase, fibre phase, -, -
      'uniform vec3 uCr;',           // crest colour, normalised to the default (x 1 / CREST_REF)
      'uniform vec3 uHa;',           // halo colour, normalised to the default (x 1 / HALO_REF)
      'uniform vec3 uBg;',           // ground colour in 0..255
      'const float GLOW = ' + f(L.glow) + ';',
      'const float SOFT = ' + f(L.soft) + ';',
      // fibre patches (as waves.js): offset beside the crest, along / across falloff, per-hair jitter
      'const float FPO = 0.014, FPC = 3200.0, FPA = 40.0, FPJ = 0.09, FPH = 800.0, FIB = 2.0;',
      '',
      // crest profile + sheet glow (waves.js strand shading): d = slope-corrected distance,
      // w = blur + pixel footprint, hws = twist half width, edge = edge-on factor, sd = glow side
      'float crest(float d, float w, float hws, float edge, float sd, float shw, float she) {',
      '  float ou = sd * d > 0.0 ? 1.0 : 0.0;',
      '  float ad = abs(d) * (1.0 - SOFT * ou);',
      '  float wc = 0.0015 + hws * (1.0 - edge) + w;',
      '  float y = ad / wc;',
      '  float prof = 1.0 / (1.0 + y * y);',
      '  prof *= prof;',
      '  float res = prof * 0.008 / (wc + 0.003);',
      '  float g = (0.007 + 1.6 * w) * (1.0 + shw * ou);',
      '  float gd = g + ad;',
      '  return res + GLOW * (1.0 + she * ou) * g / (gd * gd);',
      '}',
      '',
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x;',
      '  vec2 pv = gl_FragCoord.xy / uRes * 2.0 - 1.0;',
      '  float ex = smoothstep(' + f(L.eblur0) + ', ' + f(L.eblur1) + ', abs(pv.x));',   // far left / right
      // spine
      '  vec2 skx = vec2(' + f(SPINE.K[0]) + ', ' + f(SPINE.K[1]) + ') * p.x;',
      '  vec2 ss = sin(skx), sc = cos(skx);',
      '  vec4 SB0 = vec4(uH.x * sc.x, uH.y * sc.x, uH.x * ss.x, uH.y * ss.x);',
      '  vec4 SB1 = vec4(uH.x * sc.y, uH.y * sc.y, uH.x * ss.y, uH.y * ss.y);',
      '  float S = dot(' + v4(SPC[0]) + ', SB0) + dot(' + v4(SPC[1]) + ', SB1);',
      '  float Sd = ' + f(SPINE.K[0]) + ' * dot(' + v4(SPC[0]) + ', vec4(-SB0.z, -SB0.w, SB0.x, SB0.y))',
      '           + ' + f(SPINE.K[1]) + ' * dot(' + v4(SPC[1]) + ', vec4(-SB1.z, -SB1.w, SB1.x, SB1.y));',
      '  float yy = p.y - S;',
      '  float Lb = 0.0, Lm = 0.0, Lf = 0.0, cm = 0.0, cf = 0.0;'
    );
    var acc = ['Lb', 'Lm', 'Lf'];
    for (var li = 0; li < LAYERS.length; li++) {
      var Ly = LAYERS[li], K = Ly.K, N = Ly.N, P = 'l' + li;
      out.push('  // ---- layer ' + li);
      out.push('  {');
      out.push('    vec3 kx = vec3(' + K.map(f).join(', ') + ') * p.x;');
      out.push('    vec3 s = sin(kx), c = cos(kx);');
      for (var m = 0; m < 3; m++) {
        out.push('    vec4 B' + m + ' = vec4(' + hx(N[m]) + ' * c[' + m + '], ' + hx(N[m]) + ' * s[' + m + ']);');
        out.push('    vec4 D' + m + ' = ' + f(K[m]) + ' * vec4(-B' + m + '.zw, B' + m + '.xy);');
      }
      out.push('    float foc = 1.0 + ' + f(Ly.foc) + ' * ex;');
      var ids = [];
      STRANDS.forEach(function (s, j) { if (s.L === li) ids.push(j); });
      // positions first (the fill needs the veil edges)
      ids.forEach(function (j) {
        var R = COEF[j];
        out.push('    float dv' + j + ' = yy - ' + f(STRANDS[j].o) + ' * uV.y - dot(' + v4(R[0]) + ', B0) - dot(' + v4(R[1]) + ', B1) - dot(' + v4(R[2]) + ', B2);');
      });
      // translucent body between the outer edges
      var F = Ly.fill;
      var tj = ids[F.top], bj = ids[F.bot];
      out.push('    float cov = smoothstep(-1.0, 1.0, -dv' + tj + ' / ' + f(F.soft) + ') * smoothstep(-1.0, 1.0, dv' + bj + ' / ' + f(F.soft) + ');');
      out.push('    float La = ' + f(F.I) + ' * cov;');
      ids.forEach(function (j) {
        var s = STRANDS[j], R = COEF[j];
        var reach = 5 * (s.blur * (1 + Ly.foc) + 0.004) + 0.06 + (s.shw ? 0.08 : 0) + (s.tw ? 2 * s.tw.hw : 0) + (s.comp ? s.comp.a : 0);
        out.push('    {');
        out.push('      float dv = dv' + j + ';');
        out.push('      if (abs(dv) < ' + f(reach) + ') {');
        out.push('        float sl = Sd + dot(' + v4(R[0]) + ', D0) + dot(' + v4(R[1]) + ', D1) + dot(' + v4(R[2]) + ', D2);');
        out.push('        float d = dv * inversesqrt(1.0 + sl * sl);');
        out.push('        float wd = ' + f(s.blur) + ' * foc;');
        out.push('        float w = wd + uG.y;');
        if (s.tw) {
          out.push('        float ct = cos(' + f(s.tw.kap) + ' * p.x + uS[' + j + '].x);');
          out.push('        float edge = ct * ct;');
        } else out.push('        const float edge = 0.5;');
        out.push('        float res = crest(d, w, ' + f(s.tw ? s.tw.hw : 0) + ', edge, ' + f(s.sd) + ', ' + f(s.shw) + ', ' + f(s.she) + ');');
        if (s.comp) {
          // companion thread: a second crest of the same fold drifting to either side and crossing it
          out.push('        float dc = d - ' + f(s.comp.a) + ' * sin(' + f(s.comp.k) + ' * p.x + uS[' + j + '].z);');
          out.push('        float w2 = 0.0015 + w;');
          out.push('        float y2 = dc / w2;');
          out.push('        float p2 = 1.0 / (1.0 + y2 * y2);');
          out.push('        res += 0.4 * p2 * p2 * 0.008 / (w2 + 0.003);');
        }
        if (s.fib) {
          var Rf = unitTrav(s.fib.phi);
          out.push('#ifdef HP');
          out.push('        float fa = dot(' + v4(Rf) + ', B' + s.fib.m + ');');           // cos of the patch phase
          out.push('        float pa = dot(' + v4([-Rf[2], -Rf[3], Rf[0], Rf[1]]) + ', B' + s.fib.m + ') * ' + f(1 / K[s.fib.m]) + ';');  // ~ along distance
          out.push('        float pc = ' + f(s.sd) + ' * d - FPO;');
          out.push('        float env = exp2(-(1.0 - fa) * FPA - pc * pc * FPC);');
          out.push('        if (env > 0.003) {');
          // slanted hairs drifting with the layer; they lean against the crest (cross it at ~14 deg)
          out.push('          float e = d * 837.76 - ' + f(FH * K[s.fib.m] / N[s.fib.m]) + ' * p.x + uS[' + j + '].y;');
          out.push('          float id = floor(e * 0.1591549 + 0.5);');
          out.push('          float h = fract(sin(mod(id, ' + f(FH) + ') * 12.9898 + ' + f(j) + ') * 43758.5453);');
          out.push('          float pf = pa + (fract(h * 17.31) - 0.5) * FPJ;');
          // each hair its own brightness, along offset and length (mixed short / long hairs)
          out.push('          float ln = (0.5 + 0.5 * cos(e)) * h * h * exp2(-pf * pf * FPH * (0.45 + 1.3 * fract(h * 31.7)));');
          out.push('          res += ' + f(s.fib.s) + ' * env * ln * uG.z * (1.0 - smoothstep(0.002, 0.006, wd)) * FIB;');
          out.push('        }');
          out.push('#endif');
        }
        var Ra = unitTrav(s.al[1]);
        out.push('        float al = 0.5 + 0.5 * dot(' + v4(Ra) + ', B' + s.al[0] + ');');
        out.push('        float along = ' + f(s.a0) + ' + ' + f(1 - s.a0) + ' * al * al;');
        var tb = s.tw ? s.tw.tb : 0;
        out.push('        float win = clamp((1.0 - abs(dv) / ' + f(reach) + ') * 2.2, 0.0, 1.0);');
        out.push('        La += ' + f(s.I) + ' * along * (' + f(1 - tb) + ' + ' + f(tb) + ' * edge) * win * res;');
        out.push('      }');
        out.push('    }');
      });
      out.push('    ' + acc[li] + ' = La;');
      if (li === 1) out.push('    cm = cov;');
      if (li === 2) out.push('    cf = cov;');
      out.push('  }');
    }
    var fm = LAYERS[1].fill.ao, ff = LAYERS[2].fill.ao;
    out.push(
      // translucent layering: each veil dims what lies behind it a little
      '  float tf = 1.0 - ' + f(ff) + ' * cf;',
      '  Lb *= (1.0 - ' + f(fm) + ' * cm) * tf;',
      '  Lm *= tf;',
      '  float Lt = Lb + Lm + Lf;',
      // colour: back veil = halo, front veil = crest, middle veil halfway; faint light (glow tails,
      // veil bodies) leans further to the halo colour, bright crest cores keep their layer colour
      '  float u = (0.5 * Lm + Lf) / max(Lt, 1e-4);',
      // calm centre (HUD) and dimmer far edges
      '  vec2 cc = p * vec2(' + f(1 / L.crx) + ', ' + f(1 / L.cry) + ');',
      '  float gain = (1.0 - ' + f(L.cdim) + ' * exp2(-dot(cc, cc))) * (1.0 - ' + f(L.edim) + ' * smoothstep(' + f(L.ed0) + ', ' + f(L.ed1) + ', abs(pv.x)));',
      '  Lt *= gain;',
      '  float Tm = Lt / (1.0 + 0.2 * Lt);',
      '  vec3 tint = mix(uHa, uCr, ' + (HMIX[1] > HMIX[0] ? 'u * smoothstep(' + f(HMIX[0]) + ', ' + f(HMIX[1]) + ', Tm)' : 'u') + ');',
      // background: dark navy, slightly lifted along the band
      '  float base = 0.3 + 0.3 * exp2(-yy * yy * 9.0 / (uV.y * uV.y));',
      '  vec3 col = uBg * (1.0 + ' + v4(BGLIFT.concat([0])) + '.xyz * (base - 0.3)) + tint * (' + f(L.gain) + ' + 9.0 * Tm) * Tm;',
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}');
    return out.join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  // ---- JS mirror of the geometry (centerline) ----
  function basis(K, N, x, ph, out) {
    for (var m = 0; m < K.length; m++) {
      var c = Math.cos(K[m] * x), s = Math.sin(K[m] * x), cn = Math.cos(N[m] * ph), sn = Math.sin(N[m] * ph);
      out[m * 4] = cn * c; out[m * 4 + 1] = sn * c; out[m * 4 + 2] = cn * s; out[m * 4 + 3] = sn * s;
    }
  }
  var bS = new Float64Array(8), bL = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
  var ALW = STRANDS.map(function (st) { return unitTrav(st.al[1]); });
  var bandSpine = 0;                            // (tuning) last spine value of a debug call
  function bandY(x, ph, spread, dbg, dbgA) {        // visual centre of the band in units (y up)
    basis(SPINE.K, SPN, x, ph, bS);
    var S = 0, i, m, k;
    for (m = 0; m < 2; m++) for (k = 0; k < 4; k++) S += SPC[m][k] * bS[m * 4 + k];
    for (i = 0; i < 3; i++) basis(LAYERS[i].K, LAYERS[i].N, x, ph, bL[i]);
    var acc = 0, wsum = 0;
    for (i = 0; i < STRANDS.length; i++) {
      var st = STRANDS[i], R = COEF[i], b = bL[st.L], y = st.o * spread;
      for (m = 0; m < 3; m++) for (k = 0; k < 4; k++) y += R[m][k] * b[m * 4 + k];
      // weight: the strand's drifting brightness (as in the shader) times CLA, plus the static share CLB
      var ra = ALW[i], mb = st.al[0] * 4;
      var al = 0.5 + 0.5 * (ra[0] * b[mb] + ra[1] * b[mb + 1] + ra[2] * b[mb + 2] + ra[3] * b[mb + 3]);
      var w = CLA[i] * (st.a0 + (1 - st.a0) * al * al) + CLB[i];
      acc += w * y; wsum += w;
      if (dbg) { dbg[i] = S + y; dbgA[i] = st.a0 + (1 - st.a0) * al * al; bandSpine = S; }
    }
    return S + acc / Math.max(wsum, 1e-6) + CLO;
  }

  function create(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var fsSrc = buildShader(!!opts.forceMediump);
    var prog = null, buf = null, loc = null, lost = false, dead = false, lastT = null;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function init() {
      prog = gl.createProgram();
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
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
        res: gl.getUniformLocation(prog, 'uRes'), g: gl.getUniformLocation(prog, 'uG'),
        h: gl.getUniformLocation(prog, 'uH'), h3: gl.getUniformLocation(prog, 'uH3'),
        v: gl.getUniformLocation(prog, 'uV'), S: gl.getUniformLocation(prog, 'uS'),
        cr: gl.getUniformLocation(prog, 'uCr'), ha: gl.getUniformLocation(prog, 'uHa'),
        bg: gl.getUniformLocation(prog, 'uBg')
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
    // a previous instance on this canvas was destroyed with releaseContext: bring the context back
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

    var NS = STRANDS.length;
    var Sarr = new Float32Array(NS * 4);
    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1;
    var lastCss = null;
    // colour state (uploaded on every render, so it survives a context restore)
    var Col = new Float32Array(9);
    function setColors(c) {
      if (!c) return;
      var i, a;
      if ((a = c.crest)) for (i = 0; i < 3; i++) Col[i] = a[i] * (COLGAIN / CREST_REF);
      if ((a = c.halo)) for (i = 0; i < 3; i++) Col[3 + i] = a[i] * (COLGAIN / HALO_REF);
      if ((a = c.bg)) for (i = 0; i < 3; i++) Col[6 + i] = a[i] * 255;
    }
    setColors(DEFAULT_COLORS);
    if (opts.colors) setColors(opts.colors);
    if (!lost) init();

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
    function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

    // landscape: one unit = canvas height.  Squarer and portrait screens zoom in on a shorter piece
    // of the band (0.75 units across in portrait) and spread the veils vertically so the band still
    // fills a good part of the screen; both change continuously with the aspect ratio.
    function normOf(w, h) {
      var a = w / h;
      if (a >= 1.6) return h;
      if (a >= 0.9) return h * (1 + 0.2 * smooth(0, 1, (1.6 - a) / 0.7));
      return w / 0.75;
    }
    function spreadOf(w, h) { return 1 + 0.5 * smooth(0, 1, (1.3 - w / h) / 0.7); }

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
      var norm = normOf(W, H), pxu = 1 / norm;
      for (var i = 0; i < NS; i++) {
        var s = STRANDS[i], o = i * 4;
        Sarr[o] = s.tw ? (s.tw.tw - s.tw.n * ph) % TAU : 0;
        // hair phase: the slanted hairs drift with the layer, FH hair spacings per period; the hair
        // hash has period FH in the hair index, so the pattern returns exactly after one period
        Sarr[o + 1] = s.fib ? FH * ph : 0;
        Sarr[o + 2] = s.comp ? (s.comp.phi - s.comp.n * ph) % TAU : 0; Sarr[o + 3] = 0;
      }
      gl.uniform2f(loc.res, W, H);
      gl.uniform4f(loc.g, pxu, 0.6 * pxu, smooth(1.6, 3.0, 0.0075 / pxu), 0);
      gl.uniform4f(loc.h, Math.cos(ph), Math.sin(ph), Math.cos(2 * ph), Math.sin(2 * ph));
      gl.uniform4f(loc.h3, Math.cos(3 * ph), Math.sin(3 * ph), Math.cos(4 * ph), Math.sin(4 * ph));
      gl.uniform4f(loc.v, 0.5 * W * pxu, spreadOf(W, H), 0, 0);
      gl.uniform4fv(loc.S, Sarr);
      gl.uniform3f(loc.cr, Col[0], Col[1], Col[2]);
      gl.uniform3f(loc.ha, Col[3], Col[4], Col[5]);
      gl.uniform3f(loc.bg, Col[6], Col[7], Col[8]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // vertical position (0 = top, 1 = bottom) of the band's visual centre at xFrac (0..1), time t
    function centerline(xFrac, t) {
      var tm = t % PERIOD; if (tm < 0) tm += PERIOD;
      var norm = normOf(W, H);
      var x = (xFrac - 0.5) * W / norm;
      return 0.5 - bandY(x, TAU * tm / PERIOD, spreadOf(W, H)) * norm / H;
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
      defaultColors: { crest: DEFAULT_COLORS.crest.slice(), halo: DEFAULT_COLORS.halo.slice(), bg: DEFAULT_COLORS.bg.slice() },
      _strands: function (xFrac, t, wantAlong) {   // (tuning) per-strand curve positions as y fractions
        var tm = ((t % PERIOD) + PERIOD) % PERIOD, norm = normOf(W, H), a = new Array(STRANDS.length), b = new Array(STRANDS.length);
        bandY((xFrac - 0.5) * W / norm, TAU * tm / PERIOD, spreadOf(W, H), a, b);
        var ys = a.map(function (y) { return 0.5 - y * norm / H; });
        return wantAlong ? { y: ys, al: b, spine: 0.5 - bandSpine * norm / H } : ys;
      } };
  }

  window.WAVE_VARIANTS = window.WAVE_VARIANTS || {};
  window.WAVE_VARIANTS['h5'] = { title: 'Schleier', create: create };
})();
