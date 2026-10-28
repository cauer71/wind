// Doppelband – two silk bundles braiding along the width (horizontal variant for wind.auer.page).
// Same rendering language as waves.js (thin glowing crests, soft sheet glows, analytic depth of
// field, fibre patches, anti-aliased rational profiles); seamless loop of PERIOD seconds.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var PERIOD = 20;   // one helix wavelength (two lenses) drifts by per loop: ~29 px/s along x, crest normal speeds ~12 px/s at 432 px height

  // ---------------------------------------------------------------------------
  // Geometry (screen-height units, y up, origin in the middle of the canvas):
  //   The two bundles wind around a slowly undulating centre line yc(x, t) like a double helix
  //   seen from the side, helix angle
  //        th(x, t) = KH x - phD + MU1 sin(KM1 x + q1) + MU2(t) sin(KM2 x + q2)
  //   phD drifts by one helix wavelength (two lenses) per loop.  The MU1 warp is fixed in screen
  //   space and the MU2 warp only breathes in place (standing in time), so the twist is tighter in
  //   some zones and looser in others: lenses shrink and slow down while they pass a tight zone and
  //   grow and speed up in a loose one, but the speed averaged over the width stays constant in
  //   time (no global tempo swing).  The radius follows the twist (tight zones are thinner, like a
  //   twisted rope): R = H0 env(x, t) (1 - KAP (th'/KH - 1)) (1 + rho_i + sub-braid swing);
  //        y_i = yc + R cos(th_i) + ripples,   depth z_i = R sin(th_i)
  //   Between two crossings the bundles open into a horizontal lens (the "eye" of the Wellen
  //   animation stretched into a chain of eyes of different sizes); at every crossing one bundle
  //   passes in front (sharp, bright) of the other (defocused: the blur grows with the distance
  //   from a focal plane that lies slightly in front of the helix axis).  The strands of a bundle
  //   have slightly different helix angles and radii, so they fan out and cross each other near
  //   the crossings (braid).
  //   Strand shading is the one of waves.js: depth-of-field crest width, ribbon twist (thin
  //   bright edge-on / wide dim face-on parts, attached to the helix), crisp inner edge with a
  //   one-sided sheet glow towards the outside of the lens, companion thread and fibre patches.
  //   Behind: two soft, broad folds above and below the band (the "tunnel wall") with defocused
  //   crests at their inner edges.  The strands are dimmed near the centre line (where the
  //   crossings are and the HUD rides), so the lens rims carry the light.
  // All time dependence: integer harmonics of ph = 2 pi (t mod PERIOD) / PERIOD.
  // ---------------------------------------------------------------------------
  var GEO = {
    H0: 0.165,                       // helix radius (half lens height)
    KH: TAU / 1.36, nD: 1,           // helix wave number (wavelength 1.36: a crossing every 0.68), drift harmonics per loop
    MU1: 0.48, KM1: 3.0, q1: 0.6,    // static phase warp (tight / loose zones, fixed on screen)
    MU2: 0.15, KM2: 4.2, q2: 1.1, n2: 1, p2: 0.7,   // breathing phase warp (standing wave in time)
    KAP: 0.55,                       // radius follows the twist: tight zones are thinner
    // radius envelope and centre line: standing waves (amplitude MA / A, wave number K, spatial
    // phase x, temporal harmonic n and phase p), so nothing travels faster than the braid itself
    MA: 0.16, KA: 1.6, xA: 0.8, nA: 1, pA: 1.7,
    A1: 0.05, K1: 1.4, x1: 0.3, n1: 1, p1: 0.4,
    A2: 0.022, K2: 2.7, x2: 1.9, n2c: 2, p2c: 2.2,
    ZF: 0.55,                        // focal plane (depth in units of H0)
    LC: 0.62, LS: 0.78,              // light direction in the helix plane (cos, sin): upper front
    KR: [8.6, 9.4], nR: 3,           // ripple wave numbers per bundle, ripple harmonic
    KV: 1.8                          // broad standing brightness modulation along x (per strand phase / harmonic)
  };
  // strands: side (+1 upper, -1 lower), ty (H hero with fibres, T thin, M blurred fold), di helix
  // angle offset, rho radius offset, rv/vp sub-braid (radius swing within the bundle, helix phase),
  // hw face-on half width, b0/b1 blur (in focus / per depth^2), I intensity, a0/ap visibility along
  // the helix (minimum, phase of the brightest part), vb/nv/vq broad brightness wave (depth,
  // harmonic, phase), m twist harmonic, tw twist phase, nt twist slide harmonic, tb twist contrast,
  // fib fibre strength, fp fibre patch helix angle, comp companion offset, ripple A1/p1/A1s/q1,
  // br/nb/bp breathing amplitude/harmonic/phase
  var STRANDS = [
    { side: 1, ty: 'H', di: 0, rho: 0, rv: 0.09, vp: 1.0, hw: 0.0192, b0: 0.0012, b1: 0.0055, I: 2.415, a0: 0.45, ap: 2.5, vb: 0.3, nv: 1, vq: 0.5, m: 2, tw: 0.5, nt: 1, tb: 0.6, fib: 0.85, fp: 0.55, comp: 0.018, A1: 0.009, p1: 0.8, A1s: 0.008, q1: 3.6, br: 0.12, nb: 1, bp: 0.3 },
    { side: 1, ty: 'T', di: 0.336, rho: 0.165, rv: 0.12, vp: 3.5, hw: 0.0064, b0: 0.0025, b1: 0.0065, I: 1.242, a0: 0.15, ap: 2.2, vb: 0.4, nv: 1, vq: 2.5, m: 3, tw: 2.1, nt: -1, tb: 0.6, fib: 0, comp: 0.014, A1: 0.011, p1: 5.1, A1s: 0.007, q1: 0.2, br: 0.15, nb: 2, bp: 1.1 },
    { side: 1, ty: 'T', di: -0.28, rho: -0.135, rv: 0.105, vp: 5.0, hw: 0.0208, b0: 0.0014, b1: 0.006, I: 2.13, a0: 0.3, ap: 5.6, vb: 0.35, nv: -1, vq: 4.1, m: 2, tw: 4.0, nt: 0, tb: 0.6, fib: 0, comp: 0.02, A1: 0.007, p1: 5.5, A1s: 0.007, q1: 2.6, br: 0.1, nb: 1, bp: 2.4 },
    { side: 1, ty: 'M', di: 0.098, rho: 0.45, rv: 0.075, vp: 2.0, hw: 0.0286, b0: 0.014, b1: 0.006, I: 1.208, a0: 0.4, ap: 0.3, vb: 0.3, nv: 1, vq: 1.0, m: 0, tw: 0, nt: 0, tb: 0.2, fib: 0, comp: 0, A1: 0.011, p1: 2.6, A1s: 0.01, q1: 1.9, br: 0.2, nb: 1, bp: 4.0 },
    { side: 1, ty: 'T', di: 0.588, rho: -0.33, rv: 0.15, vp: 0.2, hw: 0.008, b0: 0.003, b1: 0.007, I: 1.009, a0: 0.1, ap: 3.6, vb: 0.4, nv: -1, vq: 5.5, m: 3, tw: 1.3, nt: 1, tb: 0.6, fib: 0, comp: 0.012, A1: 0.012, p1: 3.0, A1s: 0.011, q1: 6.2, br: 0.18, nb: 2, bp: 5.2 },
    { side: -1, ty: 'H', di: 0.05, rho: 0.03, rv: 0.09, vp: 4.2, hw: 0.0144, b0: 0.0012, b1: 0.0055, I: 2.53, a0: 0.45, ap: 4.4, vb: 0.3, nv: 1, vq: 3.6, m: 2, tw: 0.8, nt: 0, tb: 0.6, fib: 0.8, fp: 3.6, comp: 0.014, A1: 0.0075, p1: 1.06, A1s: 0.005, q1: 5.9, br: 0.12, nb: 1, bp: 3.3 },
    { side: -1, ty: 'T', di: 0.31, rho: 0.18, rv: 0.12, vp: 0.4, hw: 0.00736, b0: 0.0038, b1: 0.0065, I: 1.242, a0: 0.15, ap: 1.5, vb: 0.4, nv: -1, vq: 0.8, m: 3, tw: 1.8, nt: 1, tb: 0.6, fib: 0, comp: 0.024, A1: 0.01, p1: 1.2, A1s: 0.0097, q1: 1.76, br: 0.15, nb: 2, bp: 0.4 },
    { side: -1, ty: 'T', di: -0.25, rho: -0.15, rv: 0.105, vp: 2.0, hw: 0.0144, b0: 0.0014, b1: 0.006, I: 2.185, a0: 0.3, ap: 3.0, vb: 0.35, nv: 1, vq: 5.0, m: 2, tw: 5.3, nt: 1, tb: 0.6, fib: 0, comp: 0.026, A1: 0.0098, p1: 0.03, A1s: 0.0053, q1: 0.19, br: 0.1, nb: 1, bp: 5.6 },
    { side: -1, ty: 'M', di: 0.12, rho: 0.42, rv: 0.075, vp: 5.2, hw: 0.0273, b0: 0.02, b1: 0.006, I: 1.288, a0: 0.4, ap: 4.0, vb: 0.3, nv: -1, vq: 2.9, m: 0, tw: 0, nt: 0, tb: 0.2, fib: 0, comp: 0, A1: 0.007, p1: 2.3, A1s: 0.0089, q1: 4.98, br: 0.2, nb: 1, bp: 1.0 },
    { side: -1, ty: 'T', di: 0.56, rho: -0.3, rv: 0.15, vp: 3.3, hw: 0.0088, b0: 0.003, b1: 0.007, I: 1.009, a0: 0.1, ap: 0.2, vb: 0.4, nv: 1, vq: 1.7, m: 3, tw: 5.9, nt: -1, tb: 0.6, fib: 0, comp: 0.019, A1: 0.0124, p1: 2.9, A1s: 0.0117, q1: 0.9, br: 0.18, nb: 2, bp: 2.0 }
  ];
  // screen-space depth of field / brightness balance
  var DOF = { w: 0.022, x0: 0.6, x1: 1.05, dimX: 0.25,
    // crossings lie on the centre line, where the HUD rides: dim the strands near it (depth axd, width axw)
    axd: 0.6, axw: 0.12,
    // two broad highlight zones the strands drift through (upper left brighter, lower right a little)
    h1x: -0.5, h1y: 0.14, h1rx: 0.5, h1ry: 0.22, h1g: 0.4, h2x: 0.55, h2y: -0.14, h2rx: 0.45, h2ry: 0.2, h2g: 0.2 };
  // tunnel wall: two broad soft folds above and below the band (offset y, wobble a/k/n, glow width w and
  // intensity I, brightness wave kb/nb, bulge where the lenses are widest); each fold has a soft,
  // defocused crest at its inner edge (width cw, intensity cI; cIp on portrait screens, where the
  // folds have to fill the upper and lower thirds)
  // colour: the host passes three sRGB colours (crest, halo, bg, 0..1).  The light term is
  //   (69 + 9 Tm) Tm * mix(halo * HALO_G, crest * CREST_G, Tm^2 / (Tm^2 + CW2))
  // (Tm = tone-mapped light sum): faint glows / veils / defocused folds take the halo hue, the thin
  // crests (Tm ~ 1..1.4) mostly the crest hue.  bg is the ground; the slightly lighter ground outside
  // the band is bg * BG_LIFT (per channel ratios of the original navy).  The gains are chosen so that
  // DEFAULT_COLORS (same hue for crest and halo) reproduce the original look exactly.
  var BASE_HUE = [0.53, 0.645, 1.0];
  var CREST_G = 1 / 0.85, HALO_G = 1 / 0.425, CW2 = 0.36;
  var DEFAULT_COLORS = {
    crest: [BASE_HUE[0] * 0.85, BASE_HUE[1] * 0.85, BASE_HUE[2] * 0.85],
    halo: [BASE_HUE[0] * 0.425, BASE_HUE[1] * 0.425, BASE_HUE[2] * 0.425],
    bg: [17.6 / 255, 19.0 / 255, 24.0 / 255]
  };
  var BG_LIFT = [3.0 / 17.6, 3.5 / 19.0, 4.5 / 24.0];
  var WALL = { y: 0.37, a: 0.03, k: Math.PI, n: 1, w: 0.1, I: 0.27, kb: Math.PI, nb: 1, bulge: 0.05, cw: 0.03, cI: 0.18, cIp: 0.32 };

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 ? s + '.0' : s; }
  function v4(a, b, c, d) { return 'vec4(' + [a, b, c, d].map(f).join(', ') + ')'; }

  function buildShader(strands) {
    var G = GEO, body = '';
    for (var i = 0; i < strands.length; i++) {
      var s = strands[i];
      var cp = Math.cos(s.p1), sp = Math.sin(s.p1), cq = Math.cos(s.q1), sq = Math.sin(s.q1), dir = 1;
      var rc = [s.A1 * cp + s.A1s * cq * cp, s.A1 * dir * sp - s.A1s * sq * cp,
                s.A1 * sp + s.A1s * cq * sp, -s.A1 * dir * cp - s.A1s * sq * sp];
      var fn = s.ty === 'M' ? 'strandM' : s.fib > 0 ? 'strandH' + s.m : 'strandT' + s.m;
      var fb = s.side > 0 ? 'gP0, gQ0' : 'gP1, gQ1';
      var fpa = s.fp || 0;
      // A: side, cos/sin of the helix offset, radius   B: face-on half width, blur, intensity
      // C: twist contrast, fibres, companion, visibility minimum   D: sub-braid swing (cos, sin), visibility phase (cos, sin)
      // E: fibre patch angle (cos, sin), broad brightness depth, -
      body += '  L += ' + fn + '(uS[' + i + '], vec4(' + rc.map(f).join(', ') + '), ' + fb + ',\n    ' +
        [v4(s.side, Math.cos(s.di), Math.sin(s.di), 1 + s.rho), v4(s.hw, s.b0, s.b1, s.I),
          v4(s.tb, s.fib, s.comp, s.a0), v4(s.rv * Math.cos(s.vp), s.rv * Math.sin(s.vp), Math.cos(s.ap), Math.sin(s.ap)),
          v4(Math.cos(fpa), Math.sin(fpa), s.vb, 1.7 * s.vq + 0.9)].join(', ') + ');\n';
    }
    var NS = strands.length;

    function twistCode(m) {
      // cos(m th + T) from (c, s) = (cos th, sin th) and S.yz = (cos T, sin T)
      if (m === 2) return '  float cm = c * c - s * s, sm = 2.0 * c * s;\n';
      if (m === 3) return '  float cm = c * (c * c - 3.0 * s * s), sm = s * (3.0 * c * c - s * s);\n';
      return '  float cm = c, sm = s;\n';
    }
    function strandFn(name, m, fib, twist) {
      return [
        'float ' + name + '(vec4 S, vec4 RC, vec4 P, vec4 Q, vec4 A, vec4 B, vec4 C, vec4 D, vec4 E) {',
        '  if (S.x < 0.002) return 0.0;',
        '  float c = A.x * (gC * A.y - gS * A.z);',      // cos / sin of this strand's helix angle
        '  float s = A.x * (gS * A.y + gC * A.z);',
        // radius: bundle offset + a small swing so the strands of a bundle cross each other (braid)
        '  float rr = A.w + D.x * c + D.y * s;',
        '  float R = gR * rr;',
        '  float dv = gY - (gYc + R * c + dot(RC, P));',
        // depth of field: distance of the strand from the focal plane (depth in units of H0)
        '  float dz = gZ * rr * s - ZF;',
        '  float wd = B.y + B.z * dz * dz + gBl;',
        '  float w = wd + uG.y;',                         // + pixel footprint (anti-aliasing)
        '  float reach = 5.0 * w + 2.0 * B.x + C.z + 0.04;',
        '  if (abs(dv) > reach) return 0.0;',
        '  float rp = D.y * c - D.x * s;',                // d rr / d th
        '  float sl = gYc1 + gR1 * rr * c + gR * (rp * c - rr * s) * gTh1 + dot(RC, Q);',
        '  float d = dv * inversesqrt(1.0 + sl * sl);',   // slope-corrected distance
        // outside of the lens (away from the centre line): softer fall-off + broad sheet glow;
        // the weight goes to zero where the strand crosses the centre line, so nothing jumps
        '  float ou = c * d > 0.0 ? min(1.0, 2.5 * abs(c)) : 0.0;',
        '  float ad = abs(d) * (1.0 - SOFT * ou);',
        twist ? twistCode(m) + '  float ct = cm * S.y - sm * S.z;\n  float edge = ct * ct;' : '  const float edge = 0.5;',
        '  float wc = 0.0015 + B.x * (1.0 - edge) + w;',
        '  float y = ad / wc;',
        '  float prof = 1.0 / (1.0 + y * y);',
        '  prof *= prof;',
        '  float res = prof * 0.008 / (wc + 0.003);',
        '  float g = (0.007 + 1.6 * w) * (1.0 + SHW * ou);',
        '  float gd = g + ad;',
        '  res += GLOW * (1.0 + SHE * ou) * g / (gd * gd);',
        twist ? [
          '  float dc = d - C.z * (cm * S.z + sm * S.y);',             // companion thread: crosses the crest twice per twist
          '  float w2 = 0.0015 + 0.35 * B.x + w;',
          '  float y2 = dc / w2;',
          '  float p2 = 1.0 / (1.0 + y2 * y2);',
          '  res += 0.45 * p2 * p2 * 0.008 / (w2 + 0.003);'].join('\n') : '',
        fib ? [
          '#ifdef HP',
          // fibre patch: rides on the strand at a fixed helix angle (so it drifts with the braid)
          '  float cD = c * E.x + s * E.y, sD = s * E.x - c * E.y;',
          '  float pa = sD * IKH;',                                   // along: distance to the patch centre
          '  float pc = (c > 0.0 ? d : -d) - FPO;',                    // across: beside the crest, outside
          '  float env = exp2(-(1.0 - cD) * FPA2 - pc * pc * FPC);',
          '  if (env > 0.003) {',
          '    float e = (d - FSL * pa) * 837.76 + E.x * 3.0;',
          '    float id = floor(e * 0.1591549 + 0.5);',
          '    float h = fract(sin(id * 12.9898 + E.y) * 43758.5453);',
          '    float pf = pa + (fract(h * 17.31) - 0.5) * FPJ;',
          '    float ln = (0.5 + 0.5 * cos(e)) * h * h * exp2(-pf * pf * FPH);',
          '    res += C.y * env * ln * uG.z * (1.0 - smoothstep(0.002, 0.006, wd)) * FIB;',
          '  }',
          '#endif'].join('\n') : '',
        // light from the upper front: the strands catch it while they rise over the lens
        '  float lq = 0.5 + 0.5 * (c * LC + s * LS);',
        '  float lit = 0.6 + 0.55 * lq * lq;',
        // visibility along the strand: brightest around one helix phase, plus a broad slow wave
        '  float vq = 0.5 + 0.5 * (c * D.z + s * D.w);',
        '  float vis = (C.w + (1.0 - C.w) * vq * vq) * (1.0 - E.z + E.z * (0.5 + 0.5 * S.w * cos(KV * gX + E.w)));',
        '  float win = clamp((1.0 - abs(dv) / reach) * 2.2, 0.0, 1.0);',
        '  return B.w * S.x * lit * vis * (1.0 - C.x + C.x * edge) * win * res * gGain;',
        '}', ''].join('\n');
    }

    var fns = '';
    var made = {};
    strands.forEach(function (s) {
      var name = s.ty === 'M' ? 'strandM' : s.fib > 0 ? 'strandH' + s.m : 'strandT' + s.m;
      if (made[name]) return; made[name] = 1;
      fns += strandFn(name, s.m, s.fib > 0, s.ty !== 'M');
    });

    var W = WALL;
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform vec4 uG;',             // units per px, AA width, fibre gate, 1 / width of the centre-line dimming
      'uniform vec4 uPh;',            // helix drift phase, breathing warp amplitude, envelope amplitude, wall phase
      'uniform vec4 uYc;',            // centre line amplitudes (2 standing waves), helix radius, wall offset
      'uniform vec4 uCS;',            // cos, sin of the ripple phase, wall glow phase, 1 / wall glow width
      'uniform vec4 uW;',             // wall crest intensity, -, -, -
      'uniform vec4 uS[' + NS + '];',
      'uniform vec3 uBg, uCh, uCc;',  // ground (0..255), halo and crest light colours (gains applied) // per strand: (weight, cos T, sin T, broad brightness amplitude)
      'const float GLOW = 0.0015, SOFT = 0.45, SHW = 5.0, SHE = 4.0;',
      'const float ZF = ' + f(G.ZF) + ', LC = ' + f(G.LC) + ', LS = ' + f(G.LS) + ';',
      'const float IKH = ' + f(1 / G.KH) + ', KV = ' + f(G.KV) + ';',
      'const float FPO = 0.022, FPA2 = ' + f(2 * 170 / (G.KH * G.KH)) + ', FPC = 2200.0, FSL = -0.2, FPJ = 0.09, FPH = 700.0, FIB = 3.2;',
      'float gX, gY, gC, gS, gTh1, gR, gR1, gZ, gYc, gYc1, gBl, gGain;',
      'vec4 gP0, gQ0, gP1, gQ1;',
      fns,
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x;',
      '  gX = p.x; gY = p.y;',
      // helix angle: static warp + breathing warp; the radius follows the twist (fz)
      '  float w1 = ' + f(G.KM1) + ' * p.x + ' + f(G.q1) + ', w2 = ' + f(G.KM2) + ' * p.x + ' + f(G.q2) + ';',
      '  float sw1 = sin(w1), sw2 = sin(w2);',
      '  float th = ' + f(G.KH) + ' * p.x - uPh.x + ' + f(G.MU1) + ' * sw1 + uPh.y * sw2;',
      '  gTh1 = ' + f(G.KH) + ' + ' + f(G.MU1 * G.KM1) + ' * cos(w1) + uPh.y * ' + f(G.KM2) + ' * cos(w2);',
      '  float fz = ' + f(1 + G.KAP) + ' - ' + f(G.KAP / G.KH) + ' * gTh1;',
      '  float fz1 = ' + f(G.KAP / G.KH) + ' * (' + f(G.MU1 * G.KM1 * G.KM1) + ' * sw1 + uPh.y * ' + f(G.KM2 * G.KM2) + ' * sw2);',
      '  gC = cos(th); gS = sin(th);',
      // radius envelope
      '  float ea = ' + f(G.KA) + ' * p.x + ' + f(G.xA) + ';',
      '  float en = 1.0 + uPh.z * cos(ea);',
      '  gZ = en * fz;',
      '  gR = uYc.z * gZ;',
      '  gR1 = uYc.z * (en * fz1 - fz * uPh.z * ' + f(G.KA) + ' * sin(ea));',
      // centre line
      '  float a1 = ' + f(G.K1) + ' * p.x + ' + f(G.x1) + ', a2 = ' + f(G.K2) + ' * p.x + ' + f(G.x2) + ';',
      '  gYc = uYc.x * sin(a1) + uYc.y * sin(a2);',
      '  gYc1 = uYc.x * ' + f(G.K1) + ' * cos(a1) + uYc.y * ' + f(G.K2) + ' * cos(a2);',
      // ripples (travelling to the right + standing), as a bilinear form like waves.js
      '  float k0 = ' + f(G.KR[0]) + ' * p.x, k1 = ' + f(G.KR[1]) + ' * p.x;',
      '  vec2 SC0 = vec2(sin(k0), cos(k0)), SC1 = vec2(sin(k1), cos(k1));',
      '  gP0 = vec4(uCS.xy * SC0.x, uCS.xy * SC0.y); gQ0 = ' + f(G.KR[0]) + ' * vec4(uCS.xy * SC0.y, -uCS.xy * SC0.x);',
      '  gP1 = vec4(uCS.xy * SC1.x, uCS.xy * SC1.y); gQ1 = ' + f(G.KR[1]) + ' * vec4(uCS.xy * SC1.y, -uCS.xy * SC1.x);',
      // screen-space depth of field: the left and right ends are defocused and a bit dimmer
      '  vec2 pv = gl_FragCoord.xy / uRes * 2.0 - 1.0;',
      '  float ex = smoothstep(' + f(DOF.x0) + ', ' + f(DOF.x1) + ', abs(pv.x));',
      '  gBl = ' + f(DOF.w) + ' * ex;',
      '  vec2 h1 = (p - vec2(' + f(DOF.h1x) + ', ' + f(DOF.h1y) + ')) * vec2(' + f(1 / DOF.h1rx) + ', ' + f(1 / DOF.h1ry) + ');',
      '  vec2 h2 = (p - vec2(' + f(DOF.h2x) + ', ' + f(DOF.h2y) + ')) * vec2(' + f(1 / DOF.h2rx) + ', ' + f(1 / DOF.h2ry) + ');',
      '  gGain = (1.0 - ' + f(DOF.dimX) + ' * ex)' +
        ' * (1.0 + ' + f(DOF.h1g) + ' * exp2(-dot(h1, h1)) + ' + f(DOF.h2g) + ' * exp2(-dot(h2, h2)));',
      '  float dyc = p.y - gYc;',
      '  float ay = dyc * uG.w;',
      '  gGain *= 1.0 - ' + f(DOF.axd) + ' * exp2(-ay * ay);',
      '  float L = 0.0;',
      body,
      // tunnel wall: two broad soft folds above and below the band
      // (they bulge out where the lenses are widest: nested eyes, like the tunnel of the Wellen)
      '  float wv = ' + f(W.a) + ' * sin(' + f(W.k) + ' * p.x - uPh.w) + ' + f(W.bulge / G.H0) + ' * uYc.z * gZ * gC * gC;',
      '  float eu = dyc - uYc.w - wv, el = dyc + uYc.w + wv;',
      '  float du = eu * uCS.w, dl = el * uCS.w;',
      '  float wb = 0.6 + 0.4 * cos(' + f(W.kb) + ' * p.x - uCS.z), wl = 1.0 - 0.5 * wb;',
      '  float ew = 1.0 - 0.3 * ex;',
      '  L += ' + f(W.I) + ' * (wb / (1.0 + du * du) + wl / (1.0 + dl * dl)) * ew;',
      // their crests: soft rational profiles (always several px wide, so no aliasing), coming and
      // going with the brightness wave
      '  float icw = 1.0 / (' + f(W.cw) + ' + uG.y);',
      '  float cu = eu * icw, cl = el * icw;',
      '  float pu = 1.0 / (1.0 + cu * cu), pl = 1.0 / (1.0 + cl * cl);',
      '  L += uW.x * (wb * wb * pu * pu + wl * wl * pl * pl) * ew;',
      // background: dark lens zone, a slightly lighter navy outside the band
      '  float rb = abs(dyc);',
      '  float base = smoothstep(0.1, 0.48, rb) * (0.85 + 0.3 * smoothstep(-0.4, 0.4, p.y)) * (1.0 - 0.4 * ex);',
      '  float Tm = L / (1.0 + 0.2 * L);',
      '  float T2 = Tm * Tm;',
      '  vec3 lc = mix(uCh, uCc, T2 / (T2 + ' + f(CW2) + '));',
      '  vec3 col = uBg * (1.0 + vec3(' + BG_LIFT.map(f).join(', ') + ') * base) + lc * (69.0 + 9.0 * Tm) * Tm;',
      // static interleaved-gradient dither (+-0.5/255) against banding; constant in time
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}'
    ].join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  function wrap(a) { a = a % TAU; return a < 0 ? a + TAU : a; }

  // create(canvas, opts) -> { render(t), resize(cssW, cssH, dpr), destroy(), setQuality(q), getQuality(),
  //                           period, centerline(xFrac, t) -> yFrac,
  //                           setColors({ crest, halo, bg }) (sRGB 0..1 triples; stored, used by the next render),
  //                           defaultColors (the original look) }
  // opts: maxPixels, quality (0.3..1), preserveDrawingBuffer, powerPreference, releaseContext (as waves.js)
  function create(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var strands = STRANDS.slice();
    var maxVec = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64;
    if (strands.length > maxVec - 11) {                     // tiny GPUs: drop the least important strands
      var prio = { H: 0, M: 2, T: 1 };
      var keep = strands.slice().sort(function (a, b) { return prio[a.ty] - prio[b.ty]; }).slice(0, Math.max(0, maxVec - 11));
      strands = strands.filter(function (s) { return keep.indexOf(s) >= 0; });
    }
    var NS = strands.length;
    var fsSrc = buildShader(strands);
    // (test hook: compile the mediump fallback even where highp is available)
    if (opts.forceMediump) fsSrc = fsSrc.replace(/#ifdef GL_FRAGMENT_PRECISION_HIGH[\s\S]*?#endif/, 'precision mediump float;');
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
        ph: gl.getUniformLocation(prog, 'uPh'), yc: gl.getUniformLocation(prog, 'uYc'),
        cs: gl.getUniformLocation(prog, 'uCS'), S: gl.getUniformLocation(prog, 'uS'), w: gl.getUniformLocation(prog, 'uW'),
        bg: gl.getUniformLocation(prog, 'uBg'), ch: gl.getUniformLocation(prog, 'uCh'), cc: gl.getUniformLocation(prog, 'uCc')
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

    var Sarr = new Float32Array(NS * 4);
    // current colours (crest, halo, bg; sRGB 0..1); kept on the JS side, so they survive a context restore
    var COL = new Float32Array(9);
    function setColors(c) {
      if (!c) return;
      var k, a;
      a = c.crest; if (a) for (k = 0; k < 3; k++) COL[k] = +a[k] || 0;
      a = c.halo; if (a) for (k = 0; k < 3; k++) COL[3 + k] = +a[k] || 0;
      a = c.bg; if (a) for (k = 0; k < 3; k++) COL[6 + k] = +a[k] || 0;
    }
    setColors(DEFAULT_COLORS);
    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1;
    var lastCss = null;
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

    // composition: screen-height units on landscape screens; narrower screens zoom out a little,
    // portrait screens show about two lenses across, open the band up and move the tunnel wall
    // out so it fills the upper and lower thirds (lay[0] = px per unit, lay[1] = vertical scale
    // of the band, lay[2] = scale of the wall offset and width)
    var lay = new Float64Array(3), PH = new Float64Array(8);
    function layout(w, h) {
      var aspect = w / h;
      lay[1] = 1; lay[2] = 1;
      if (aspect >= 1.6) lay[0] = h;
      else if (aspect >= 0.9) lay[0] = h * Math.pow(aspect / 1.6, 0.6);
      else { lay[0] = w / 1.15; lay[1] = 2.0; lay[2] = 2.0; }
    }
    // all loop phases (integer harmonics of ph), reduced to [0, 2 pi)
    function phases(ph) {
      var G = GEO;
      PH[0] = wrap(G.nD * ph); PH[1] = G.MU2 * Math.cos(G.n2 * ph - G.p2); PH[2] = G.MA * Math.cos(G.nA * ph - G.pA);
      PH[3] = G.A1 * Math.cos(G.n1 * ph - G.p1); PH[4] = G.A2 * Math.cos(G.n2c * ph - G.p2c);
      PH[5] = wrap(WALL.n * ph + 0.9); PH[6] = wrap(WALL.nb * ph + 2.0); PH[7] = ph;
    }
    function loopPhase(t) {
      var tm = t % PERIOD; if (tm < 0) tm += PERIOD;
      if (tm >= PERIOD) tm = 0;
      return tm;
    }

    function render(t) {
      var tm = loopPhase(t), ph = TAU * tm / PERIOD;
      if (dead) return;
      lastT = tm;
      if (lost || gl.isContextLost()) return;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      layout(W, H);
      var pxu = 1 / lay[0], G = GEO;
      phases(ph);
      for (var i = 0; i < NS; i++) {
        var s = strands[i], o = i * 4, T = s.tw + s.nt * ph;
        Sarr[o] = 1 + s.br * Math.cos(s.nb * ph + s.bp);
        Sarr[o + 1] = Math.cos(T); Sarr[o + 2] = Math.sin(T); Sarr[o + 3] = Math.cos(s.nv * ph + s.vq);
      }
      gl.uniform2f(loc.res, W, H);
      gl.uniform4f(loc.g, pxu, 0.6 * pxu, smooth(1.6, 3.0, 0.0075 / pxu), 1 / (DOF.axw * lay[1]));
      gl.uniform4f(loc.ph, PH[0], PH[1], PH[2], PH[5]);
      gl.uniform4f(loc.yc, PH[3], PH[4], G.H0 * lay[1], WALL.y * lay[2]);
      gl.uniform4f(loc.cs, Math.cos(G.nR * ph), Math.sin(G.nR * ph), PH[6], 1 / (WALL.w * lay[2]));
      gl.uniform4f(loc.w, lay[2] > 1 ? WALL.cIp : WALL.cI, 0, 0, 0);
      gl.uniform4fv(loc.S, Sarr);
      gl.uniform3f(loc.cc, COL[0] * CREST_G, COL[1] * CREST_G, COL[2] * CREST_G);
      gl.uniform3f(loc.ch, COL[3] * HALO_G, COL[4] * HALO_G, COL[5] * HALO_G);
      gl.uniform3f(loc.bg, COL[6] * 255, COL[7] * 255, COL[8] * 255);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

    // per strand constants for centerline(): cos/sin helix offset, radius, sub-braid swing,
    // ripple form, ripple wave number, weight
    var SK = new Float64Array(NS * 12), wSum = 0;
    for (var j = 0; j < NS; j++) {
      var q = strands[j], cp = Math.cos(q.p1), sp = Math.sin(q.p1), cq = Math.cos(q.q1), sq = Math.sin(q.q1), k = j * 12;
      SK[k] = q.side * Math.cos(q.di); SK[k + 1] = q.side * Math.sin(q.di); SK[k + 2] = 1 + q.rho;
      SK[k + 3] = q.rv * Math.cos(q.vp); SK[k + 4] = q.rv * Math.sin(q.vp);
      SK[k + 5] = q.A1 * cp + q.A1s * cq * cp; SK[k + 6] = q.A1 * sp - q.A1s * sq * cp;
      SK[k + 7] = q.A1 * sp + q.A1s * cq * sp; SK[k + 8] = -q.A1 * cp - q.A1s * sq * sp;
      SK[k + 9] = q.side > 0 ? GEO.KR[0] : GEO.KR[1]; SK[k + 10] = q.I; wSum += q.I;
    }
    // vertical position (0 = top, 1 = bottom) of the band's centre at xFrac (0..1) and time t:
    // the same geometry as the shader, averaged over the strands of both bundles (weighted by
    // their intensity); smooth in x and t
    function centerline(xFrac, t) {
      var ph = TAU * loopPhase(t) / PERIOD, G = GEO;
      var w = Math.max(1, lastCss ? lastCss[0] : W), h = Math.max(1, lastCss ? lastCss[1] : H);
      layout(w, h);
      phases(ph);
      var x = (xFrac - 0.5) * w / lay[0];
      var w1 = G.KM1 * x + G.q1, w2 = G.KM2 * x + G.q2;
      var th = G.KH * x - PH[0] + G.MU1 * Math.sin(w1) + PH[1] * Math.sin(w2), C = Math.cos(th), S = Math.sin(th);
      var th1 = G.KH + G.MU1 * G.KM1 * Math.cos(w1) + PH[1] * G.KM2 * Math.cos(w2);
      var R = G.H0 * lay[1] * (1 + PH[2] * Math.cos(G.KA * x + G.xA)) * (1 + G.KAP - G.KAP / G.KH * th1);
      var yc = PH[3] * Math.sin(G.K1 * x + G.x1) + PH[4] * Math.sin(G.K2 * x + G.x2);
      var cr = Math.cos(G.nR * ph), sr = Math.sin(G.nR * ph), acc = 0;
      var s0 = Math.sin(G.KR[0] * x), c0 = Math.cos(G.KR[0] * x), s1 = Math.sin(G.KR[1] * x), c1 = Math.cos(G.KR[1] * x);
      for (var i = 0; i < NS; i++) {
        var k = i * 12, c = C * SK[k] - S * SK[k + 1], s = S * SK[k] + C * SK[k + 1];
        var rr = SK[k + 2] + SK[k + 3] * c + SK[k + 4] * s;
        var ks = SK[k + 9] === G.KR[0] ? s0 : s1, kc = SK[k + 9] === G.KR[0] ? c0 : c1;
        var rip = (SK[k + 5] * cr + SK[k + 6] * sr) * ks + (SK[k + 7] * cr + SK[k + 8] * sr) * kc;
        acc += SK[k + 10] * (R * rr * c + rip);
      }
      return 0.5 - (yc + acc / wSum) * lay[0] / h;
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
      setColors: setColors, defaultColors: DEFAULT_COLORS };
  }

  window.WAVE_VARIANTS = window.WAVE_VARIANTS || {};
  window.WAVE_VARIANTS['h2'] = { title: 'Doppelband', create: create };
})();
