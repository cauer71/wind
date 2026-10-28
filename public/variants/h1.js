// Seidenband (h1) – one broad translucent silk ribbon flowing across the full width, a slow twist
// travelling along it, rendered in the language of waves.js (thin glowing crests with soft halos,
// analytic depth of field, faint veil, dark navy ground).  Seamless loop.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var PERIOD = 16;   // crest speeds ~5-30 px/s (median ~10 px/s for the hems) on a 768 x 346 stage

  // ---------------------------------------------------------------------------
  // Geometry (screen-height units, origin at the canvas centre, y up):
  //   every along-band field F(x, t) = sum_i A_i sin(k_i x - m_i ph + phi_i), ph = 2 pi t / PERIOD,
  //   with integer harmonics m_i, written as time-dependent coefficients on sin/cos(k x) for 8 fixed
  //   wave numbers (computed in JS per frame, so the shader only evaluates 8 sin + 8 cos per pixel).
  //   yc  centreline, th  twist angle of the ribbon around its own axis, wd  half-width,
  //   zc  depth (towards the camera > 0) -> perspective scale and depth-of-field blur,
  //   cu  cross-section cup (the sheet bows out of plane between the hems).
  //   Ribbon lines (2 hems + 6 interior fold crests, vectorised 4 per vec4), per line j:
  //     offset_j = sc * (wd cos(th) * v_j(x,t) + sin(th) * n_j(x,t)),
  //     v_j = in-plane position across the band (-1..1, interior crests drift slowly),
  //     n_j = out-of-plane pleat + wd cu (v_j^2 - 1)  (the hems' midpoint stays on yc).
  //   Each line is drawn with the waves.js strand profile (rational bell crest + heavy-tailed halo,
  //   energy-conserving blur, AA from the pixel footprint); its blur comes from its own depth relative
  //   to a focal plane slightly in front (so the near hem is crisp while the far one goes soft) plus a
  //   screen-space defocus towards the left/right ends.  The hems carry a one-sided sheet glow into
  //   the band and, at large enough sizes, waves.js-style fibre patches.  Between the hems a faint veil
  //   (blurred box, denser where the sheet is inclined).  Silk sheen: brightness follows the local
  //   surface angle.  Behind it a strongly defocused ghost ribbon gives the dark ground some depth.
  //   Only travelling terms with k >= 4.6 (<= ~30 px/s) and standing waves move the picture, so
  //   the motion stays slow and statistically even over the loop.
  // ---------------------------------------------------------------------------
  var K = [1.35, 2.3, 4.6, 5.8, 1.9, 2.9, 5.2, 6.6];
  // [amplitude, wave-number index, harmonic m (>0 travels right), phase phi]  or, standing,
  // [amplitude, wave-number index, 0, phi, n, psi] = A cos(n ph + psi) sin(k x + phi).
  // Travelling terms use k >= 4.6 so that no pattern moves faster than ~30 px/s (768 x 346 stage).
  var FIELDS = {
    yc: [[0.07, 0, 0, 0.4, 1, 0.3], [0.03, 5, 0, 1.9, 1, 2.0], [0.012, 2, 1, 2.6], [0.008, 4, 0, 0.7, 2, 4.1]],
    th: [[0.9, 2, 1, 0.3], [0.35, 3, 1, 2.2], [0.3, 4, 0, 4.0, 1, 1.0]],
    wd: [[0.02, 1, 0, 1.1, 1, 0.6], [0.015, 6, 1, 3.0]],
    zc: [[0.4, 0, 0, 2.5, 1, 4.4], [0.22, 2, 1, 0.4]],
    cu: [[0.3, 4, 0, 1.3, 1, 2.6], [0.2, 6, 1, 5.0]]
  };
  var C0 = { th: 1.0, wd: 0.2, cu: 0.3 };
  var PZ = 0.15;
  // motion blur: each crisp line is widened by its own normal speed times MB seconds (~1.5 frames at 60 fps; analytic time
  // derivative of the line position), so fast stretches stay smooth at 60 fps instead of stepping
  var MB = 1 / 40, OMEGA = TAU / PERIOD;
  // centerline(): correction of the visual band centre against the hems' midpoint (see centerline()),
  // fitted to three centre estimates of rendered columns (squared / linear luminance centroid, midpoint of
  // the bright extent) over 12 landscape sizes (aspect 1.6-2.4) and the whole loop
  var CL = { c: -0.0011, cup: -0.3138, be: 0.0090, beCup: -0.3743, hem: 0.0310, beHem: 0.0330, yc: -0.0848, edge: 0.0383, pk: 0.0289 };
  // lines: v0 (across), dv (in-plane drift), np (out-of-plane pleat), k (along), m (harmonic), phi,
  //        I (intensity), core (half-width), hw (extra width when face-on), b0 (base blur), tl (pleat tilt),
  //        os (one-sided sheet glow towards the band's inside)
  var LINES = [
    { v0: 1.0, dv: 0.0, np: 0.012, k: 7.0, m: 1, phi: 0.0, I: 1.8, core: 0.001, hw: 0.0015, b0: 0.0003, tl: 0.15, os: 1.0 },
    { v0: -1.0, dv: 0.0, np: 0.016, k: 5.6, m: 1, phi: 1.7, I: 1.55, core: 0.001, hw: 0.0015, b0: 0.0003, tl: 0.15, os: 1.0 },
    { v0: 0.45, dv: 0.15, np: 0.03, k: 4.8, m: 1, phi: 2.1, I: 0.9, core: 0.0012, hw: 0.004, b0: 0.001, tl: 0.6, os: 0.3 },
    { v0: -0.35, dv: 0.18, np: 0.03, k: 5.3, m: 1, phi: 4.4, I: 0.8, core: 0.0012, hw: 0.004, b0: 0.003, tl: 0.6, os: 0.3 },
    { v0: 0.7, dv: 0.15, np: 0.03, k: 5.9, m: -1, phi: 3.3, I: 0.95, core: 0.004, hw: 0.01, b0: 0.018, tl: 0.5, os: 0.0 },
    { v0: -0.65, dv: 0.15, np: 0.03, k: 5.0, m: 1, phi: 5.2, I: 0.95, core: 0.004, hw: 0.01, b0: 0.024, tl: 0.5, os: 0.0 },
    { v0: 0.05, dv: 0.3, np: 0.04, k: 4.7, m: -1, phi: 1.2, I: 1.05, core: 0.005, hw: 0.012, b0: 0.035, tl: 0.8, os: 0.0 },
    { v0: 0.2, dv: 0.35, np: 0.05, k: 6.1, m: 1, phi: 0.4, I: 0.7, core: 0.0015, hw: 0.005, b0: 0.008, tl: 0.7, os: 0.0 }
  ];
  // ghost: a second, strongly defocused ribbon further back (centre GA * yc + GB, twist GQ * th + GR,
  // half-width GW * wd): broad soft glows that give the dark ground depth
  var GHOST = { GA: 0.6, GB: 0.0, GQ: 0.6, GR: 1.4, GW: 1.9,
    lines: [
      { v0: 1.0, dv: 0.0, np: 0.02, k: 4.6, m: 1, phi: 0.7, I: 1.0, b0: 0.03 },
      { v0: -1.0, dv: 0.0, np: 0.02, k: 5.4, m: 1, phi: 2.9, I: 0.9, b0: 0.045 },
      { v0: 0.35, dv: 0.25, np: 0.04, k: 4.9, m: -1, phi: 4.0, I: 0.8, b0: 0.05 },
      { v0: -0.4, dv: 0.25, np: 0.04, k: 6.0, m: 1, phi: 5.5, I: 0.8, b0: 0.06 }
    ] };
  // colours (sRGB 0..1, see api.setColors): crest = thin crest lines at full brightness, halo = their soft
  // glow, the ghost ribbon's defocused glows and the veil, bg = the ground.  In the shader the line light Tm
  // is coloured with mix(halo * HK, crest * CK, smoothstep(0.4, 2.0, Tm)) * (gain + 9 Tm) * Tm, so faint light
  // (glows, veils) takes the halo hue and the bright crests the crest hue; the soft vertical ground glow is
  // bg * BGR.  The defaults reproduce the original constants exactly: tint (0.53, 0.645, 1.0) -> + (0.07, 0, 0),
  // ground (17.6, 19.0, 24.0) / 255 + (4.4, 5.2, 6.6) / 255 * base.
  var DEFAULT_COLORS = { crest: [0.60 * 0.82, 0.645 * 0.82, 0.82], halo: [0.265, 0.3225, 0.5], bg: [17.6 / 255, 19.0 / 255, 24.0 / 255] };
  var HK = 2.0, CK = 1 / 0.82, BGR = [4.4 / 17.6, 5.2 / 19.0, 6.6 / 24.0];
  var LOOK = { glow: 0.0012, bz: 0.08, zf: 0.12, be: 0.03, veil: 0.105, thl: 0.6, amb: 0.2, gain: 69.0, soft: 0.45, shw: 4.0 };
  var ALL = LINES.concat(GHOST.lines);
  // fibre patches beside the two hems: strength, envelope wave number (both hems share it), harmonic, phase
  var FIB = { I: [4.0, 3.4], k: [4.6], m: [1, 1], phi: [0.5, 3.6] };

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 ? s + '.0' : s; }
  function v4(a) { return 'vec4(' + a.map(f).join(', ') + ')'; }
  function col(key, g) { return ALL.slice(g * 4, g * 4 + 4).map(function (l) { return l[key]; }); }
  function colK(key, g) { var kl = col('k', g); return col(key, g).map(function (v, i) { return v * kl[i]; }); }
  function colW(key, g) { var ml = col('m', g); return col(key, g).map(function (v, i) { return -v * ml[i] * OMEGA; }); }

  var FOFF = { yc: 0, th: 4, wd: 8, zc: 12, cu: 16 };    // uF offsets (4 vec4 per field)
  var FTOFF = { yc: 0, th: 4, cu: 8 };                    // uFt offsets: time derivatives (per second)
  function fieldDtExpr(name) {
    var o = FTOFF[name];
    return 'dot(uFt[' + o + '], S0) + dot(uFt[' + (o + 1) + '], C0) + dot(uFt[' + (o + 2) + '], S1) + dot(uFt[' + (o + 3) + '], C1)';
  }
  function fieldExpr(name, deriv) {
    var o = FOFF[name];
    if (!deriv) return (C0[name] ? f(C0[name]) + ' + ' : '') + 'dot(uF[' + o + '], S0) + dot(uF[' + (o + 1) + '], C0) + dot(uF[' + (o + 2) + '], S1) + dot(uF[' + (o + 3) + '], C1)';
    return 'dot(uF[' + o + '], K0C) - dot(uF[' + (o + 1) + '], K0S) + dot(uF[' + (o + 2) + '], K1C) - dot(uF[' + (o + 3) + '], K1S)';
  }

  // one group of 4 lines.  Inputs: dy (pixel - centre), c/s (twist), wc0 = wd c, ws = wd s, thd, ycd, cu
  function groupCode(g, ghost) {
    var L = [
      '  {',
      '    vec4 arg = ' + v4(col('k', g)) + ' * x - uL[' + g + '];',
      '    vec4 sn = sin(arg), cn = cos(arg);',
      '    vec4 vv = ' + v4(col('v0', g)) + ' + ' + v4(col('dv', g)) + ' * sn;',
      '    vec4 nn = ' + v4(col('np', g)) + ' * sn' + (ghost ? ';' : ' + cuw * (vv * vv - 1.0);'),
      '    vec4 d = dy - sc * (wc0 * vv + s * nn);',
      '    vec4 sl = ycd + sc * (-ws * thd * vv + wc0 * ' + v4(colK('dv', g)) + ' * cn + c * thd * nn + s * ' + v4(colK('np', g)) + ' * cn);',
      '    vec4 isl = inversesqrt(1.0 + sl * sl);',
      '    d *= isl;'
    ];
    if (ghost) {
      L.push(
        '    vec4 w = ' + v4(col('b0', g)) + ' + bEnd + uG.y + uP.w;',
        '    vec4 lt = 0.5 + 0.5 * cos(th - THL + 0.5 * cn);',
        '    lt = AMB + (1.0 - AMB) * lt * lt;',
        '    vec4 ad = abs(d);',
        '    vec4 wcr = 0.004 + w;',
        '    vec4 y = ad / wcr;',
        '    vec4 pr = 1.0 / (1.0 + y * y);',
        '    vec4 res = pr * pr * 0.008 / (wcr + 0.003);',
        '    vec4 gg = 0.007 + 1.6 * w;',
        '    vec4 gd = gg + ad;',
        '    res += GLOW * gg / (gd * gd);',
        '    L += uP.z * dot(' + v4(col('I', g)) + ' * lt, res);',
        '  }', '');
      return L.join('\n');
    }
    L.push(
      g === 0 ? '    e0 = d.x; e1 = d.y;' : '',
      // normal speed of the line (units / s): time derivative of its offset, divided by the slope factor
      '    vec4 vvt = ' + v4(colW('dv', g)) + ' * cn;',
      '    vec4 nnt = ' + v4(colW('np', g)) + ' * cn + cuwt * (vv * vv - 1.0) + 2.0 * cuw * vv * vvt;',
      '    vec4 yt = yct + sc * (wc0 * vvt - ws * tht * vv + c * tht * nn + s * nnt);',
      '    vec4 zf = zc + ws * vv - c * nn - ZF;',
      '    vec4 w = ' + v4(col('b0', g)) + ' + BZ * zf * zf + bEnd + uG.y + MB * abs(yt) * isl;',
      '    vec4 lt = 0.5 + 0.5 * cos(th - THL + ' + v4(col('tl', g)) + ' * cn);',
      '    lt = AMB + (1.0 - AMB) * lt * lt * lt;',
      g === 0 ? '    hb = w.xy - uG.y; hl = lt.xy; hv = abs(yt.xy) * isl.xy;' : '',
      // one-sided: the hem glows into the sheet (inner side), fading out as the band turns edge-on
      '    vec4 ou = max(vec4(0.0), -sign(d) * clamp(4.0 * c * vv, -1.0, 1.0)) * ' + v4(col('os', g)) + ';',
      '    vec4 ad = abs(d) * (1.0 - SOFT * ou);',
      '    vec4 wcr = ' + v4(col('core', g)) + ' + ' + v4(col('hw', g)) + ' * (c * c) + w;',
      '    vec4 y = ad / wcr;',
      '    vec4 pr = 1.0 / (1.0 + y * y);',
      '    vec4 res = pr * pr * 0.008 / (wcr + 0.003);',
      '    vec4 gg = (0.007 + 1.6 * w) * (1.0 + SHW * ou);',
      '    vec4 gd = gg + ad;',
      '    res += GLOW * (1.0 + SHW * ou) * gg / (gd * gd);',
      '    L += dot(' + v4(col('I', g)) + ' * lt, res);',
      '  }', '');
    return L.join('\n');
  }

  function buildShader() {
    var G = GHOST;
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform vec4 uG;',        // units per px, AA width, fibre gate, loop phase
      'uniform vec4 uM;',        // half screen width (units), portrait boost of the band geometry, start of the end defocus, ghost width
      'uniform vec4 uF[20];',    // fields yc, th, wd, zc, cu: coefficients on (S0, C0, S1, C1)
      'uniform vec4 uL[3];',     // line phases
      'uniform vec4 uFt[12];',   // time derivatives (per second) of the fields yc, th, cu
      'const vec4 K0 = ' + v4(K.slice(0, 4)) + ';',
      'const vec4 K1 = ' + v4(K.slice(4, 8)) + ';',
      'const float GLOW = ' + f(LOOK.glow) + ', BZ = ' + f(LOOK.bz) + ', ZF = ' + f(LOOK.zf) + ', THL = ' + f(LOOK.thl) + ', AMB = ' + f(LOOK.amb) + ';',
      'const float SOFT = ' + f(LOOK.soft) + ', SHW = ' + f(LOOK.shw) + ', MB = ' + f(MB) + ';',
      // fibre patches: offset beside the hem, along / across falloff, slant, per-hair extent jitter and
      // falloff, strength per hem, envelope wave numbers (patch spacing along the band)
      'const float FPO = 0.02, FPA = 160.0, FPC = 2200.0, FSL = -0.2, FPJ = 0.09, FPH = 900.0;',
      // hairs per unit across the hem (698.13 / 2 pi): hairs passing a pixel per second = speed * FHZ
      'const float FHZ = 111.11;',
      'const vec2 FIBI = vec2(' + f(FIB.I[0]) + ', ' + f(FIB.I[1]) + '), FPK = vec2(' + f(FIB.k[0]) + ', ' + f(FIB.k[0]) + ');',
      'uniform vec4 uP;',
      'uniform vec3 uCh, uCc, uCb, uCg;',   // halo, crest tints (x HK, CK), ground, ground glow (x 255)
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x;',
      '  float x = p.x;',
      '  vec4 S0 = sin(K0 * x), C0 = cos(K0 * x), S1 = sin(K1 * x), C1 = cos(K1 * x);',
      '  vec4 K0S = K0 * S0, K0C = K0 * C0, K1S = K1 * S1, K1C = K1 * C1;',
      '  float yc = uM.y * (' + fieldExpr('yc') + ');',
      '  float ycd = uM.y * (' + fieldExpr('yc', true) + ');',
      '  float th = ' + fieldExpr('th') + ';',
      '  float thd = ' + fieldExpr('th', true) + ';',
      '  float wd = uM.y * (' + fieldExpr('wd') + ');',
      '  float zc = ' + fieldExpr('zc') + ';',
      '  float cuw = wd * (' + fieldExpr('cu') + ');',
      '  float yct = uM.y * (' + fieldDtExpr('yc') + ');',
      '  float tht = ' + fieldDtExpr('th') + ';',
      '  float cuwt = wd * (' + fieldDtExpr('cu') + ');',
      '  float sc = 1.0 / (1.0 - ' + f(PZ) + ' * zc);',
      '  float xn = abs(x) / uM.x;',
      '  float be = smoothstep(uM.z, uM.z + 0.7, xn);',
      '  float bEnd = ' + f(LOOK.be) + ' * be * be;',
      '  float L = 0.0, e0 = 0.0, e1 = 0.0;',
      '  vec2 hb = vec2(0.0), hl = vec2(0.0), hv = vec2(0.0);',
      '  float c = cos(th), s = sin(th);',
      '  float wc0 = wd * c, ws = wd * s;',
      '  float dy = p.y - yc * sc;',
      groupCode(0, false),
      groupCode(1, false),
      // fibres: short loose hairs beside the in-focus hems (inner side), in patches that travel along
      // with the flow (periodic envelope, so the loop stays exact).  Hair lines run parallel to the hem
      // with a slight slant; each hair gets its brightness and extent from a hash of its index, whose
      // boundaries sit at the profile minima, so nothing pops.  Faded where blurred, where the hairs
      // would get closer than ~2 px, near the pinch (where the inner side flips), and where the hem moves
      // so fast that more than ~4-9 hairs per second would sweep over a pixel (no comb flicker).
      '#ifdef HP',
      '  {',
      '    vec2 hd = vec2(e0, e1);',
      '    vec2 inn = -hd * sign(c) * vec2(1.0, -1.0);',
      '    vec2 pc = inn - FPO;',
      '    vec2 ang = FPK * x - uP.xy;',
      '    vec2 pa = (ang - 6.2831853 * floor(ang * 0.1591549 + 0.5)) * (1.0 / FPK.x);',
      '    vec2 env = exp2(-pa * pa * FPA - pc * pc * FPC) * (1.0 - smoothstep(0.002, 0.006, hb)) * smoothstep(0.15, 0.35, abs(c)) *',
      '      (1.0 - smoothstep(4.0, 9.0, hv * FHZ));',
      '    if (env.x + env.y > 0.003) {',
      '      vec2 e = (inn - FSL * x) * 698.13 + vec2(0.7, 2.3);',
      '      vec2 id = floor(e * 0.1591549 + 0.5);',
      '      vec2 h = fract(sin(id * 12.9898 + vec2(1.3, 4.1)) * 43758.5453);',
      '      vec2 pf = pa + (fract(h * 17.31) - 0.5) * FPJ;',
      '      vec2 ln = (0.5 + 0.5 * cos(e)) * h * h * exp2(-pf * pf * FPH);',
      '      L += dot(env * ln * hl, FIBI) * uG.z;',
      '    }',
      '  }',
      '#endif',
      // veil between the hems: blurred box, denser where the sheet is inclined
      '  float bv = 0.006 + BZ * (zc - ZF) * (zc - ZF) + bEnd + uG.y;',
      '  float a0 = e0 / bv, a1 = e1 / bv;',
      '  float fill = 0.5 * abs(a0 * inversesqrt(1.0 + a0 * a0) - a1 * inversesqrt(1.0 + a1 * a1));',
      '  float vl = 0.5 + 0.5 * cos(th - THL);',
      '  L += ' + f(LOOK.veil) + ' * fill * (AMB + (1.0 - AMB) * vl * vl * vl) * inversesqrt(c * c + 0.12);',
      '  float hz = dy / 0.5;',
      '  float base = 1.2 / (1.0 + hz * hz) - 0.2;',
      // ghost ribbon (reuses the line code with its own centre, twist and width)
      '  th = ' + f(G.GQ) + ' * th + ' + f(G.GR) + '; thd *= ' + f(G.GQ) + ';',
      '  c = cos(th); s = sin(th);',
      '  wd *= ' + f(G.GW) + ' * uM.w; wc0 = wd * c; ws = wd * s;',   // (portrait: spread wider, see ghostOf)
      '  dy = p.y - (' + f(G.GA) + ' * yc + ' + f(G.GB) + ') * sc; ycd *= ' + f(G.GA) + ';',
      groupCode(2, true),
      // a little calmer right behind the HUD (broad, so it never reads as a spot)
      '  L *= 1.0 - 0.15 * exp2(-dot(p, p) * 5.0);',
      '  float Tm = L / (1.0 + 0.2 * L);',
      '  vec3 tint = mix(uCh, uCc, smoothstep(0.4, 2.0, Tm));',
      '  vec3 col = uCb + uCg * base + tint * (' + f(LOOK.gain) + ' + 9.0 * Tm) * Tm;',
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}'
    ].join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  // coefficient arrays of a field at loop phase ph:
  //   travelling  A sin(kx - m ph + phi) = A cos(a) sin(kx) - A sin(a) cos(kx), a = m ph - phi
  //   standing    A cos(n ph + psi) sin(kx + phi)  (term [A, ki, 0, phi, n, psi])
  var AB = [0, 0];                // scratch (no per-frame allocation)
  function termAmp(T, ph) {
    if (T[2] !== 0) { var a = T[2] * ph - T[3]; AB[0] = T[0] * Math.cos(a); AB[1] = -T[0] * Math.sin(a); return; }
    var A = T[0] * Math.cos(T[4] * ph + T[5]);
    AB[0] = A * Math.cos(T[3]); AB[1] = A * Math.sin(T[3]);
  }
  function fieldCoef(terms, ph, out, o) {
    for (var i = 0; i < 16; i++) out[o + i] = 0;
    for (var j = 0; j < terms.length; j++) {
      var T = terms[j], ki = T[1], grp = ki < 4 ? 0 : 8, lane = ki % 4;
      termAmp(T, ph);
      out[o + grp + lane] += AB[0];       // on sin(kx)
      out[o + grp + 4 + lane] += AB[1];   // on cos(kx)
    }
  }
  // time derivatives (per second) of the coefficients
  function termAmpDt(T, ph) {
    if (T[2] !== 0) { var a = T[2] * ph - T[3], r = T[2] * OMEGA; AB[0] = -T[0] * Math.sin(a) * r; AB[1] = -T[0] * Math.cos(a) * r; return; }
    var Ad = -T[0] * T[4] * OMEGA * Math.sin(T[4] * ph + T[5]);
    AB[0] = Ad * Math.cos(T[3]); AB[1] = Ad * Math.sin(T[3]);
  }
  function fieldCoefDt(terms, ph, out, o) {
    for (var i = 0; i < 16; i++) out[o + i] = 0;
    for (var j = 0; j < terms.length; j++) {
      var T = terms[j], ki = T[1], grp = ki < 4 ? 0 : 8, lane = ki % 4;
      termAmpDt(T, ph);
      out[o + grp + lane] += AB[0];
      out[o + grp + 4 + lane] += AB[1];
    }
  }
  function fieldAt(terms, x, ph) {
    var v = 0;
    for (var j = 0; j < terms.length; j++) { var T = terms[j], k = K[T[1]]; termAmp(T, ph); v += AB[0] * Math.sin(k * x) + AB[1] * Math.cos(k * x); }
    return v;
  }
  // screen layout: px per unit (landscape: the screen height; narrower screens zoom out a little) and
  // a vertical boost of the band's geometry on portrait screens, so that it still fills the picture
  function normOf(w, h) { var a = w / h; return a >= 1.6 ? h : a >= 1 ? h * Math.pow(a / 1.6, 0.6) : w * Math.pow(1 / 1.6, 0.6); }
  var PB = 1.8, PG = 3.0, PI = 2.5, PW = 0.05;   // portrait: band boost, ghost spread, ghost intensity, ghost blur
  function boostOf(w, h) { var a = w / h; return a >= 1 ? 1 : 1 + PB * (1 - a); }
  // ghost ribbon width relative to the (boosted) band: 1 on landscape screens; on portrait screens it
  // spreads further out, so that its broad soft glows fill more of the tall picture
  function ghostOf(w, h) { var a = w / h; return a >= 1 ? 1 : (1 + PG * (1 - a)) / (0.4 + 0.6 * boostOf(w, h)); }
  function loopTime(t) { var tm = t % PERIOD; if (tm < 0) tm += PERIOD; return tm; }

  function create(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var fsSrc = buildShader();
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
      loc = { res: gl.getUniformLocation(prog, 'uRes'), g: gl.getUniformLocation(prog, 'uG'), m: gl.getUniformLocation(prog, 'uM'),
        F: gl.getUniformLocation(prog, 'uF'), Ft: gl.getUniformLocation(prog, 'uFt'), L: gl.getUniformLocation(prog, 'uL'), P: gl.getUniformLocation(prog, 'uP'),
        ch: gl.getUniformLocation(prog, 'uCh'), cc: gl.getUniformLocation(prog, 'uCc'), cb: gl.getUniformLocation(prog, 'uCb'), cg: gl.getUniformLocation(prog, 'uCg') };
      gl.viewport(0, 0, W, H);
    }
    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() { if (dead) return; lost = false; init(); if (lastT !== null) render(lastT); }
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

    var Farr = new Float32Array(80), Ftarr = new Float32Array(48), Larr = new Float32Array(12);
    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1, lastCss = [0, 0, 1], hasCss = false;
    // current colours (stored by setColors, uploaded by render; kept in JS so they survive a context restore)
    var colCrest = DEFAULT_COLORS.crest.slice(), colHalo = DEFAULT_COLORS.halo.slice(), colBg = DEFAULT_COLORS.bg.slice();
    function copy3(dst, src) { if (src && src.length >= 3) { dst[0] = +src[0]; dst[1] = +src[1]; dst[2] = +src[2]; } }
    function setColors(c) {
      if (!c) return;
      copy3(colCrest, c.crest); copy3(colHalo, c.halo); copy3(colBg, c.bg);
    }
    if (!lost) init();

    function resize(cssW, cssH, dpr) {
      if (dead) return;
      dpr = dpr || 1;
      lastCss[0] = cssW; lastCss[1] = cssH; lastCss[2] = dpr; hasCss = true;
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
      if (hasCss) resize(lastCss[0], lastCss[1], lastCss[2]);
    }
    function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

    function render(t) {
      if (dead) return;
      var tm = loopTime(t), ph = TAU * tm / PERIOD;
      lastT = tm;
      if (lost || gl.isContextLost()) return;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var norm = normOf(W, H), pxu = 1 / norm;
      fieldCoef(FIELDS.yc, ph, Farr, 0);
      fieldCoef(FIELDS.th, ph, Farr, 16);
      fieldCoef(FIELDS.wd, ph, Farr, 32);
      fieldCoef(FIELDS.zc, ph, Farr, 48);
      fieldCoef(FIELDS.cu, ph, Farr, 64);
      fieldCoefDt(FIELDS.yc, ph, Ftarr, 0);
      fieldCoefDt(FIELDS.th, ph, Ftarr, 16);
      fieldCoefDt(FIELDS.cu, ph, Ftarr, 32);
      for (var j = 0; j < 12; j++) Larr[j] = ALL[j].m * ph - ALL[j].phi;
      gl.uniform2f(loc.res, W, H);
      // fibre gate on the internal hair spacing (like waves.js): off where the hairs would come closer than
      // ~2-3.6 device px (dpr-1 phone stages), on for hi-dpi phones (dpr >= 2: ~4.7 px at a 390 x 175 stage)
      gl.uniform4f(loc.g, pxu, 0.6 * pxu, smooth(2.0, 3.6, 0.009 / pxu), ph);
      var bst = boostOf(W, H);
      gl.uniform4f(loc.m, 0.5 * W * pxu, bst, 0.35 + 0.3 * (bst - 1), ghostOf(W, H));
      gl.uniform4fv(loc.F, Farr);
      gl.uniform4fv(loc.Ft, Ftarr);
      gl.uniform4fv(loc.L, Larr);
      var pq = Math.max(0, 1 - W / H);
      gl.uniform4f(loc.P, FIB.m[0] * ph - FIB.phi[0], FIB.m[1] * ph - FIB.phi[1], 1 + PI * pq, PW * pq);
      gl.uniform3f(loc.ch, colHalo[0] * HK, colHalo[1] * HK, colHalo[2] * HK);
      gl.uniform3f(loc.cc, colCrest[0] * CK, colCrest[1] * CK, colCrest[2] * CK);
      gl.uniform3f(loc.cb, colBg[0] * 255, colBg[1] * 255, colBg[2] * 255);
      gl.uniform3f(loc.cg, colBg[0] * 255 * BGR[0], colBg[1] * 255 * BGR[1], colBg[2] * 255 * BGR[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // vertical position (0 top .. 1 bottom) of the band's visual centre at horizontal fraction xFrac:
    // the hems' midpoint (the shader's centreline yc, perspective-scaled) plus small smooth corrections:
    // the cup's bow (pulls the visible mass of the interior folds to one side when the band leans; more so
    // towards the defocused ends), the brighter first hem, the band's lean, the ghost ribbon's pull towards
    // the screen centre, and the centroid of the ribbon lines weighted by their squared peak brightness
    // (mirrors the shader's line geometry, lighting and blur; no allocation)
    function centerline(xFrac, t) {
      var ph = TAU * loopTime(t) / PERIOD;
      var cw = hasCss ? lastCss[0] : W, ch = hasCss ? lastCss[1] : H;
      var norm = normOf(cw, ch), bst = boostOf(cw, ch), hw = 0.5 * cw / norm;
      var x = (xFrac - 0.5) * cw / norm;
      var yc = bst * fieldAt(FIELDS.yc, x, ph), zc = fieldAt(FIELDS.zc, x, ph);
      var th = C0.th + fieldAt(FIELDS.th, x, ph), wd = bst * (C0.wd + fieldAt(FIELDS.wd, x, ph)), cu = C0.cu + fieldAt(FIELDS.cu, x, ph);
      var sc = 1 / (1 - PZ * zc), c = Math.cos(th), s = Math.sin(th), cuw = wd * cu, ws = wd * s;
      var be = smooth(0.35 + 0.3 * (bst - 1), 1.05 + 0.3 * (bst - 1), Math.abs(x) / hw), bEnd = LOOK.be * be * be;
      var pw = 0, py = 0;
      for (var j = 0; j < LINES.length; j++) {
        var L = LINES[j], a = L.k * x - (L.m * ph - L.phi), sn = Math.sin(a);
        var vv = L.v0 + L.dv * sn, nn = L.np * sn + cuw * (vv * vv - 1);
        var zf = zc + ws * vv - c * nn - LOOK.zf, w = L.b0 + LOOK.bz * zf * zf + bEnd;
        var lt = 0.5 + 0.5 * Math.cos(th - LOOK.thl + L.tl * Math.cos(a)); lt = LOOK.amb + (1 - LOOK.amb) * lt * lt * lt;
        var pk = L.I * lt * (0.008 / (L.core + L.hw * c * c + w + 0.003) + LOOK.glow / (0.007 + 1.6 * w));
        pw += pk * pk; py += pk * pk * sc * (wd * c * vv + s * nn);
      }
      var cup = sc * cuw * s;
      var y = sc * yc + CL.c + CL.cup * cup + CL.be * be + CL.beCup * be * cup + (CL.hem + CL.beHem * be) * sc * wd * c +
        CL.yc * yc + CL.edge * sc * ws + CL.pk * py / pw;
      return 0.5 - y * norm / ch;
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
      setColors: setColors, defaultColors: { crest: DEFAULT_COLORS.crest.slice(), halo: DEFAULT_COLORS.halo.slice(), bg: DEFAULT_COLORS.bg.slice() } };
  }

  window.WAVE_VARIANTS = window.WAVE_VARIANTS || {};
  window.WAVE_VARIANTS['h1'] = { title: 'Seidenband', create: create };
})();
