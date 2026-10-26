// Silk waves – procedural recreation of a soft, slowly flowing dark silk loop (10 s, seamless).
// Built for wind.auer.page; the reference video was only used for visual comparison.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var PERIOD = 10;

  // ---------------------------------------------------------------------------
  // "Silk tunnel": a dark, tilted almond-shaped void framed by translucent silk folds.
  //
  // Eye frame: q = A * R(-tilt) * (p - centre), p = screen point in screen-height units
  // (y up), A = slight anisotropic squash so the almond is rounder.  Two layers:
  //  1. Silk strands: 12 explicit analytic curves (6 per bundle), rising left -> right:
  //        v(u) = s * F(u / s) + ripples(u, t),
  //        F(x) = mid + hlf * sig((x - C) / L) + (cv * x + tl) * x,  sig(x) = x / sqrt(1 + x^2)
  //     The upper bundle sweeps from the left-middle over the top towards the top-right, the
  //     lower one (point-mirrored) rises from the bottom-left to the right-middle, so together
  //     they wrap the void.  Each strand zooms out of the void (scale s grows by ZOOM per
  //     period) and turns slowly clockwise, fading in near the void and out when large;
  //     strands are staggered so the picture is statistically steady and loops seamlessly.
  //     Per strand: crest with depth-of-field width, ribbon twist (thin bright edge-on parts,
  //     wide dim face-on parts), crisp inner edge with a broad one-sided glow towards the tunnel
  //     wall (the lit body of the fold), an optional companion thread and, on the two most
  //     in-focus crests per bundle, hair-like fibre striations.
  //     Shape, placement and brightness were fitted to the reference (time-averaged image,
  //     ridge density, gradient orientations and highlight map).
  //  2. Tunnel wall: broad, strongly defocused sheets (corners, top and bottom bands) - two
  //     soft log-radial sheet trains that zoom outwards at the strands' rate, bent by low-order
  //     angular harmonics and weighted to a few sectors so they read as blurred folds rather
  //     than rings.  Costs one log, one inversesqrt and two cos.
  // All time dependence is built from phase = 2*pi*(t mod 10)/10 with integer harmonics.
  // Line widths never drop below ~0.6 px, fibres fade out before they reach the pixel grid
  // and the profiles are smooth rational bells, so nothing shimmers.
  // ---------------------------------------------------------------------------
  var SCENE = {"G":{"tilt":16.5,"cx":0.01276,"cy":0.01539,"ax":1.1,"ay":0.91037,"glow":0.0012,"gain":69.0,"soft":0.45,"shw":5.0,"she":4.0},"fams":[{"A0":0.02,"phi0":3.2144,"psi0":3.32975,"A0b":0.007,"phi0b":3.82092,"psi0b":3.70807},{"A0":0.02,"phi0":5.63596,"psi0":2.40851,"A0b":0.007,"phi0b":4.47181,"psi0b":3.58353}],"strands":[{"fam":0,"ty":"H","o":0.04742,"s0":0.69379,"aHi":0.32529,"aLo":-0.33983,"C":-1.08381,"L":0.425,"cv":0.11954,"tl":0.00488,"hw":0.01306,"kap":9.51985,"tw":4.21104,"b0":0.00138,"b1":0.0048,"I":1.61416,"fib":0,"tb":0.6,"lw":0.83755,"comp":0.01879,"A1":0.0105,"p1":0.80099,"A1s":0.00918,"q1":3.6225,"rot":0.13832,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":0,"ty":"T","o":0.21408,"s0":0.69379,"aHi":0.30105,"aLo":-0.2638,"C":-1.16746,"L":0.33512,"cv":0.13407,"tl":0.0845,"hw":0.00389,"kap":7.8792,"tw":4.67187,"b0":0.00269,"b1":0.00677,"I":0.65762,"fib":0,"tb":0.6,"lw":1.1073,"comp":0.01458,"A1":0.0121,"p1":5.15402,"A1s":0.00769,"q1":0.1597,"rot":0.11984,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":0,"ty":"H","o":0.88075,"s0":0.69379,"aHi":0.27915,"aLo":-0.26281,"C":-1.05587,"L":0.3464,"cv":0.11548,"tl":-0.0115,"hw":0.01362,"kap":12.11748,"tw":3.95774,"b0":0.00119,"b1":0.00859,"I":1.72092,"fib":0.73046,"tb":0.6,"lw":0.78471,"comp":0.02126,"A1":0.00705,"p1":5.53366,"A1s":0.00711,"q1":2.56443,"rot":0.13471,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":0,"ty":"H","o":0.54742,"s0":0.69379,"aHi":0.34314,"aLo":-0.26302,"C":-1.24272,"L":0.4068,"cv":0.12158,"tl":-0.04582,"hw":0.01284,"kap":7.38219,"tw":0.53267,"b0":0.0016,"b1":0.00706,"I":1.75143,"fib":0.85044,"tb":0.6,"lw":1.15118,"comp":0.02968,"A1":0.0073,"p1":1.05824,"A1s":0.00917,"q1":2.4814,"rot":0.09303,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":0,"ty":"M","o":0.71408,"s0":0.69379,"aHi":0.29586,"aLo":-0.28076,"C":-1.0227,"L":0.34044,"cv":0.12923,"tl":-0.06471,"hw":0.02256,"kap":10.80876,"tw":6.185,"b0":0.01457,"b1":0.00633,"I":0.65378,"fib":0,"tb":0.2,"lw":0.62897,"comp":0,"A1":0.0114,"p1":2.63536,"A1s":0.01032,"q1":1.88736,"rot":0.14054,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":0,"ty":"H","o":0.38075,"s0":0.69379,"aHi":0.28859,"aLo":-0.33164,"C":-1.05536,"L":0.32733,"cv":0.12521,"tl":0.08263,"hw":0.01319,"kap":10.11862,"tw":5.50472,"b0":0.00094,"b1":0.00664,"I":1.76826,"fib":0,"tb":0.6,"lw":1.18966,"comp":0.0145,"A1":0.01225,"p1":2.96797,"A1s":0.01149,"q1":6.2232,"rot":0.11614,"a0":0.17406,"ka":1.47858,"xo":0.94765,"fi0":0,"fi1":0.16387,"dir":1},{"fam":1,"ty":"H","o":0.18908,"s0":0.61194,"aHi":0.4316,"aLo":-0.27004,"C":0.66284,"L":0.43749,"cv":-0.00246,"tl":-0.02268,"hw":0.0083,"kap":11.30784,"tw":0.76902,"b0":0.0012,"b1":0.01405,"I":1.9034,"fib":0.88475,"tb":0.6,"lw":1.04463,"comp":0.0142,"A1":0.00757,"p1":1.0599,"A1s":0.00512,"q1":5.92637,"rot":0.10752,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1},{"fam":1,"ty":"T","o":0.35575,"s0":0.61194,"aHi":0.4041,"aLo":-0.2171,"C":0.7939,"L":0.56495,"cv":-0.00896,"tl":-0.00598,"hw":0.00464,"kap":9.35541,"tw":1.80558,"b0":0.0038,"b1":0.0088,"I":0.73827,"fib":0,"tb":0.6,"lw":0.86456,"comp":0.02409,"A1":0.01017,"p1":1.19426,"A1s":0.00969,"q1":1.75843,"rot":0.14321,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1},{"fam":1,"ty":"H","o":0.52242,"s0":0.61194,"aHi":0.34341,"aLo":-0.3303,"C":0.63056,"L":0.41742,"cv":0.00296,"tl":-0.11042,"hw":0.00878,"kap":7.39475,"tw":5.25611,"b0":0.00142,"b1":0.00817,"I":1.88579,"fib":0,"tb":0.6,"lw":0.73581,"comp":0.02646,"A1":0.00983,"p1":0.03163,"A1s":0.00531,"q1":0.1898,"rot":0.09097,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1},{"fam":1,"ty":"H","o":0.68908,"s0":0.61194,"aHi":0.42502,"aLo":-0.27754,"C":0.77522,"L":0.44381,"cv":-0.01705,"tl":-0.11994,"hw":0.00817,"kap":8.57283,"tw":0.38512,"b0":0.00111,"b1":0.01289,"I":1.91397,"fib":0,"tb":0.6,"lw":0.91329,"comp":0.02325,"A1":0.01156,"p1":5.8509,"A1s":0.00634,"q1":2.7422,"rot":0.10883,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1},{"fam":1,"ty":"M","o":0.85575,"s0":0.61194,"aHi":0.33618,"aLo":-0.24844,"C":0.73891,"L":0.41406,"cv":-0.02849,"tl":-0.12579,"hw":0.02165,"kap":12.47839,"tw":2.62754,"b0":0.02077,"b1":0.01075,"I":0.73918,"fib":0,"tb":0.2,"lw":0.96544,"comp":0,"A1":0.00704,"p1":2.32007,"A1s":0.00887,"q1":4.98454,"rot":0.14732,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1},{"fam":1,"ty":"H","o":0.02242,"s0":0.61194,"aHi":0.36143,"aLo":-0.29268,"C":0.75854,"L":0.53237,"cv":0.00695,"tl":-0.12632,"hw":0.00966,"kap":9.3557,"tw":5.94203,"b0":0.00132,"b1":0.01175,"I":1.81978,"fib":0.79212,"tb":0.6,"lw":0.94022,"comp":0.01932,"A1":0.0124,"p1":2.91328,"A1s":0.01165,"q1":0.90686,"rot":0.13767,"a0":0.17708,"ka":2.1687,"xo":-0.22641,"fi0":0,"fi1":0.5862,"dir":-1}]};
  var K = [[4.4, 8.9], [4.0, 8.3]];                  // wave numbers per family (long standing, travelling ripple)
  var ZOOM = 2.5;                                     // scale growth of a strand over one 10 s period
  var LOGZ = Math.log(ZOOM);
  // screen-space depth of field + highlight balance (see main())
  var DOF = {"w":0.026,"r0":0.78,"r1":1.2,"dimC":0.15,"hx":-0.4,"hy":0.28,"hrx":0.32,"hry":0.16,"hg":0.3,"hs":0.6,"ht":0.6,"dx0":0.2,"dx1":0.75,"dg":0.15,"ds":0.3,"fw":0.02,"f0":0.45,"f1":0.85,"ty0":-0.06,"ty1":0.12,"tx0":0.2,"tx1":0.5,"tw":0.024,"td":0.3};
  var BR = {"g":1.03,"a2":0.17,"t2":2.1,"a1":0.08,"t1":5.6};   // breathing: 2nd-harmonic swell, 1st-harmonic counterweight
  var TUN = {"ky":1.5756,"n1":1,"n2":2,"r0":0.35,"r1":0.95544,"r2":0.5652,"r3":1.18852,"fo":1,"a1":0.13093,"a2":0.05,"ang":[-0.38974,0.4642,0.43842,-0.7],"bend":[[1.44,2.16,1.08,-1.62],[2.7,-1.26,1.98,0.72]],"sway":[[0.3,0.3,0.3,0.3,0.0],[0.3,0.3,0.3,0.3,2.0]]};

  function f(x) { var s = (+x).toFixed(5); return s.indexOf('.') < 0 ? s + '.0' : s; }

  function buildShader(strands, G, TUN, DOF) {
    var body = '', bodyM = '';
    for (var i = 0; i < strands.length; i++) {
      var s = strands[i], side = s.fam === 0 ? 1 : -1;
      var mid = side * (s.aHi + s.aLo) / 2, hlf = (s.aHi - s.aLo) / 2;
      var fb = s.fam === 0 ? 'P0, Q0, LW0, LD0' : 'P1, Q1, LW1, LD1';
      // hero crests carry the fibre striations (the two most in-focus ones per bundle: s.fib > 0),
      // the other crests use the same profile without fibres; blurred folds skip the twist too
      var fn = s.ty === 'M' ? 'strandM' : s.fib > 0 && s.ty === 'H' ? 'strandH' : 'strandT';
      // ripple (a, b) = travelling A1*(cos, sin)(p1 - dir*ph) + standing A1s*cos(ph + q1)*(cos, sin)(p1),
      // written as a bilinear form in (cos ph, sin ph) x (sin, cos)(k u)
      var cp = Math.cos(s.p1), sp = Math.sin(s.p1), cq = Math.cos(s.q1), sq = Math.sin(s.q1);
      var rc = [s.A1 * cp + s.A1s * cq * cp, s.A1 * s.dir * sp - s.A1s * sq * cp,
                s.A1 * sp + s.A1s * cq * sp, -s.A1 * s.dir * cp - s.A1s * sq * sp];
      // reach = kb * blurMul + kx  (kx also has scale terms) -> blurMul recovered in the shader
      var kb = 5 * (s.b0 + s.b1), ks = 2 * s.hw + (s.comp || 0);
      var line = '  L += ' + fn + '(q, ' + fb + ', uS[' + i + '], vec4(' + rc.map(f).join(', ') + '), ' +
        [side, mid, hlf, s.C, 1 / s.L, s.hw, s.b0, s.b1, s.I, s.kap, s.tw, s.fib, s.lw, -side * s.cv, s.tl, s.tb, s.comp,
          s.a0, s.ka * (0.78 - 0.08 * side), s.xo, 1 / kb, ks].map(f).join(', ') + ');\n';
      if (s.ty === 'M') bodyM += line; else body += line;
    }
    var NS = strands.length;

    function strandFn(name, comp, fib, twist) {
      return [
        'float ' + name + '(vec2 q, vec4 Ps, vec4 Pd, float LW, float LD, vec4 D, vec4 RC,',
        '    float side, float mid, float hlf, float C, float iL, float hwMax, float b0, float b1,',
        '    float I, float kap, float tw, float fib, float lw, float cv, float tl, float tb, float comp,',
        '    float a0, float ka, float xo, float ikb, float ks) {',
        '  if (D.y < 0.002) return 0.0;',                 // faded out: uniform branch
        '  float scl = 1.0 / D.x;',
        '  float uu = q.x + D.z * q.y;',                  // slow clockwise turn of this strand
        '  float vv = q.y - D.z * q.x;',
        '  float up = uu * D.x;',                         // zoom: strand-local coordinate
        '  float x = (up - C) * iL;',
        '  float r = inversesqrt(1.0 + x * x);',
        '  float sg = x * r;',
        '  float dv = vv - (mid + hlf * sg + (cv * up + tl) * up) * scl - lw * LW - dot(RC, Ps);',
        // conservative reach, precomputed per strand, widened per pixel by the screen-space defocus
        '  float xb = side > 0.0 ? gBl.x : gBl.y;',      // extra (screen-space) defocus at this pixel
        '  float reach = D.w + 5.0 * xb;',
        '  if (abs(dv) > reach) return 0.0;',
        '  float bend = r * r;',
        // the outer flat side (top band for upper strands, bottom band for lower) defocuses most
        '  float fo = (1.0 - bend) * (side * sg > 0.0 ? 1.0 : 0.6);',
        '  float bm = (D.w - ks * scl - uG.y * 5.0 - 0.04) * ikb;',  // blur multiplier, recovered from the reach
        // depth-of-field blur: strand-local (outer flats, zoom) times the per-family focus map,
        // plus a screen-space term that defocuses everything beyond the eye ring (corners)
        '  float wd = (b0 + b1 * fo * fo) * bm * (side > 0.0 ? gFoc.x : gFoc.y) + xb;',
        '  float w = wd + uG.y;',                         // + pixel footprint (anti-aliasing)
        '  float hws = hwMax * scl;',
        '  float sl = hlf * iL * r * bend + 2.0 * cv * up + tl + lw * LD + dot(RC, Pd);',
        '  float d = dv * inversesqrt(1.0 + sl * sl);',   // slope-corrected distance
        // crisp inner edge, softer fall-off on the outer side (towards the tunnel wall), where
        // the lit body of the fold extends as a broad one-sided sheet glow
        '  float ou = side * d > 0.0 ? 1.0 : 0.0;',
        '  float ad = abs(d) * (1.0 - SOFT * ou);',
        // ribbon twist: edge-on parts are thin & bright, face-on parts wide & dim
        twist ? '  float c = cos(kap * up + tw + side * uG.w);\n  float edge = c * c;' : '  const float edge = 0.5;',
        '  float wc = 0.0015 + hws * (1.0 - edge) + w;',
        '  float y = ad / wc;',
        '  float prof = 1.0 / (1.0 + y * y);',
        '  prof *= prof;',
        '  float res = prof * 0.008 / (wc + 0.003);',
        // one heavy-tailed sheet glow (energy ~ constant, width grows with blur)
        '  float g = (0.007 + 1.6 * w) * (1.0 + SHW * ou);',
        '  float gd = g + ad;',
        '  res += GLOW * (1.0 + SHE * ou) * g / (gd * gd);',
        comp ? [
          // companion thread: a second crest of the same fold, drifting to either side and crossing it
          '  float dc = d - comp * scl * sin(0.55 * kap * up + 2.0 * tw - side * uG.w);',
          '  float w2 = 0.0015 + 0.35 * hws + w;',
          '  float y2 = dc / w2;',
          '  float p2 = 1.0 / (1.0 + y2 * y2);',
          '  res += 0.45 * p2 * p2 * 0.008 / (w2 + 0.003);'].join('\n') : '',
        fib ? [
          '#ifdef HP',
          // hair-like fibres: one short patch of loose, slanted hairs beside the crest (outer side),
          // drifting along the strand; each hair gets its own brightness and extent from a hash of
          // its index, whose boundaries sit at the profile minima so nothing pops
          '  float pa = (up - C - xo / iL - FPD * sin(uG.w + tw)) * scl;',   // along: distance to the patch centre
          '  float pc = side * d - FPO;',                                    // across: beside the crest
          '  float env = exp2(-pa * pa * FPA - pc * pc * FPC);',
          '  if (env > 0.003) {',
          '    float e = (d - FSL * side * uu) * 837.76 + kap;',             // 2pi / 0.0075
          '    float id = floor(e * 0.1591549 + 0.5);',
          '    float h = fract(sin(id * 12.9898 + tw) * 43758.5453);',
          '    float pf = pa + (fract(h * 17.31) - 0.5) * FPJ;',
          '    float ln = (0.5 + 0.5 * cos(e)) * h * h * exp2(-pf * pf * FPH);',
          '    res += fib * env * ln * uG.z * (1.0 - smoothstep(0.002, 0.006, wd)) * FIB;',
          '  }',
          '#endif'].join('\n') : '',
        // brightness along the strand: strongest around a point near the bend, fading along the flats
        '  float xa = (x - xo) * ka;',
        '  float along = a0 + (1.0 - a0) / (1.0 + xa * xa);',
        // fade to exactly zero at the reach so the early-out never leaves a seam
        '  float win = clamp((1.0 - abs(dv) / reach) * 2.2, 0.0, 1.0);',
        '  float tbx = side > 0.0 ? tb * gTw : tb;',       // less twist contrast where the upper bundle is boosted
        '  return I * D.y * along * (1.0 - tbx + tbx * edge) * win * res * (side > 0.0 ? gGain.x : gGain.y);',
        '}', ''].join('\n');
    }

    var T = TUN;
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#define HP 1',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform vec4 uG;',             // eye units per px, AA width, fibre gate, loop phase
      'uniform vec4 uXf;',            // centre.xy, cos(tilt), sin(tilt)
      'uniform vec4 uAn;',            // aniso x, y, loop fraction t/10, -
      'uniform vec4 uF[2];',          // per family long standing wave
      'uniform vec4 uT[2];',          // tunnel sheets: angular bend harmonics (time dependent)
      'uniform vec4 uS[' + NS + '];', // per strand: (1/scale, weight, rotation, reach)
      'uniform vec2 uCS;',            // cos, sin of the loop phase
      'const vec2 K0 = vec2(' + K[0].map(f).join(',') + ');',
      'const vec2 K1 = vec2(' + K[1].map(f).join(',') + ');',
      'const float GLOW = ' + f(G.glow) + ';',
      'const float SOFT = ' + f(G.soft != null ? G.soft : 0.45) + ';',     // outer-side softening of the crest
      'const float SHW = ' + f(G.shw != null ? G.shw : 0.0) + ';',        // outer sheet glow: extra width
      'const float SHE = ' + f(G.she != null ? G.she : 0.0) + ';',        // outer sheet glow: extra energy
      // per-pixel maps shared by all strands (set at the top of main)
      'float gDof;',                  // 0 inside the eye ring .. 1 in the screen corners
      'vec2 gGain;',                  // brightness map per bundle (x: upper, y: lower)
      'vec2 gFoc;',                   // blur multiplier map per bundle
      'vec2 gBl;',                    // extra additive blur per bundle
      'float gTw;',                   // twist contrast multiplier for the upper bundle
      // fibre patches: drift, offset beside the crest, along / across falloff, slant, per-hair
      // extent jitter and falloff, strength
      'const float FPD = 0.25, FPO = 0.022, FPA = 250.0, FPC = 2200.0, FSL = -0.2, FPJ = 0.09, FPH = 1100.0, FIB = 2.0;',
      '',
      strandFn('strandH', true, true, true),
      strandFn('strandT', true, false, true),
      strandFn('strandM', false, false, false),
      'void main() {',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) * uG.x;',
      '  vec2 q0 = p - uXf.xy;',
      '  vec2 q = vec2(q0.x * uXf.z + q0.y * uXf.w, -q0.x * uXf.w + q0.y * uXf.z) * uAn.xy;',
      '  vec2 S0 = sin(K0 * q.x), C0 = cos(K0 * q.x);',
      '  vec2 S1 = sin(K1 * q.x), C1 = cos(K1 * q.x);',
      '  vec4 P0 = vec4(uCS * S0.y, uCS * C0.y), Q0 = K0.y * vec4(uCS * C0.y, -uCS * S0.y);',
      '  vec4 P1 = vec4(uCS * S1.y, uCS * C1.y), Q1 = K1.y * vec4(uCS * C1.y, -uCS * S1.y);',
      '  float LW0 = uF[0].x * S0.x + uF[0].y * C0.x, LD0 = K0.x * (uF[0].x * C0.x - uF[0].y * S0.x);',
      '  float LW1 = uF[1].x * S1.x + uF[1].y * C1.x, LD1 = K1.x * (uF[1].x * C1.x - uF[1].y * S1.x);',
      // screen-space depth of field: the corners (beyond the eye ring) are strongly defocused and dim
      '  vec2 pv = gl_FragCoord.xy / uRes * 2.0 - 1.0;',
      '  gDof = smoothstep(' + f(DOF.r0) + ', ' + f(DOF.r1) + ', length(pv));',
      // highlight balance (eye frame, so it follows the eye on portrait screens): the upper bundle
      // is brightest and sharpest where it rises over the upper left, the lower bundle a bit dimmer
      // on the right
      '  vec2 hb = (q - vec2(' + f(DOF.hx) + ', ' + f(DOF.hy) + ')) * vec2(' + f(1 / DOF.hrx) + ', ' + f(1 / DOF.hry) + ');',
      '  float hl = exp2(-dot(hb, hb));',
      '  gTw = 1.0 - ' + f(DOF.ht) + ' * hl;',
      '  float rd = smoothstep(' + f(DOF.dx0) + ', ' + f(DOF.dx1) + ', q.x);',
      // tails: the upper bundle's left end where it drops below the eye axis (towards the bottom-left
      // corner) and the lower bundle's right end where it climbs above it (towards the top-right)
      '  vec2 tl2 = vec2(smoothstep(' + f(DOF.ty0) + ', ' + f(DOF.ty1) + ', -q.y) * smoothstep(' + f(DOF.tx0) + ', ' + f(DOF.tx1) + ', -q.x),',
      '                  smoothstep(' + f(DOF.ty0) + ', ' + f(DOF.ty1) + ', q.y) * smoothstep(' + f(DOF.tx0) + ', ' + f(DOF.tx1) + ', q.x));',
      '  gGain = vec2(1.0 + ' + f(DOF.hg) + ' * hl, 1.0 - ' + f(DOF.dg) + ' * rd) * (1.0 - ' + f(DOF.dimC) + ' * gDof) * (1.0 - ' + f(DOF.td) + ' * tl2);',
      '  gFoc = vec2(1.0 - ' + f(DOF.hs) + ' * hl, 1.0 + ' + f(DOF.ds) + ' * rd);',
      // tilted focal plane: the upper bundle defocuses towards its right/top end, the lower
      // bundle towards its left/bottom end (bottom-left corner), on top of the corner defocus
      '  gBl = ' + f(DOF.w) + ' * gDof + ' + f(DOF.fw) + ' * vec2(smoothstep(' + f(DOF.f0) + ', ' + f(DOF.f1) + ', q.x), smoothstep(' + f(DOF.f0) + ', ' + f(DOF.f1) + ', -q.x)) + ' + f(DOF.tw) + ' * tl2;',
      '  float L = 0.0;',
      body,
      bodyM,
      // tunnel wall: broad defocused sheets zooming outwards with the strands
      '  vec2 e = q * vec2(1.0, ' + f(T.ky) + ');',
      '  float re2 = dot(e, e) + 1e-4;',
      '  float ir = inversesqrt(re2);',
      '  float re = re2 * ir;',
      '  vec4 hv = vec4(e.x * ir, e.y * ir, 0.0, 0.0);',
      '  hv.zw = vec2(hv.x * hv.x - hv.y * hv.y, 2.0 * hv.x * hv.y);',
      '  float lr = log(re) * ' + f(1 / LOGZ) + ' - uAn.z;',
      '  float s1 = 0.5 + 0.5 * cos(' + f(TAU * T.n1) + ' * lr + dot(uT[0], hv));',
      '  float s2 = 0.5 + 0.5 * cos(' + f(TAU * T.n2) + ' * lr + dot(uT[1], hv));',
      '  float ang = max(0.0, 1.0 + dot(vec4(' + T.ang.map(f).join(', ') + '), hv));',
      // (r0 stays well away from the centre: the log-radial sheets would crowd into stripes there)
      '  float ten = smoothstep(' + f(Math.max(0.3, T.r0)) + ', ' + f(T.r1) + ', re) * (1.0 - ' + f(T.fo) + ' * smoothstep(' + f(T.r2) + ', ' + f(T.r3) + ', re));',
      '  L += ten * ang * (' + f(T.a1) + ' * s1 * s1 + ' + f(T.a2) + ' * s2 * s2);',
      // background: dark almond void, navy ring, slightly darker corners
      '  float rb = length(q * vec2(1.0, 2.7));',
      '  float base = (smoothstep(0.35, 1.0, rb) - 0.9 * smoothstep(1.2, 2.2, rb)) * (0.9 + 0.45 * smoothstep(-0.35, 0.45, q.y));',
      '  L *= 1.0 - 0.4 * smoothstep(0.9, 1.5, length(pv));',
      '  float Tm = L / (1.0 + 0.2 * L);',
      '  vec3 col = vec3(17.6, 19.0, 24.0) + vec3(4.4, 5.2, 6.6) * base + vec3(0.53, 0.645, 1.0) * (' + f(G.gain) + ' + 9.0 * Tm) * Tm;',
      // static interleaved-gradient dither (+-0.5/255) against banding; constant in time
      '  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
      '  gl_FragColor = vec4((col + (n - 0.5)) / 255.0, 1.0);',
      '}'
    ].join('\n');
  }

  var VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  // createWaves(canvas, opts) -> { render(tSeconds), resize(cssW, cssH, dpr), destroy(), setQuality(q), getQuality() }
  // opts: maxPixels (internal pixel budget; default 0.6 MP on phone-sized screens, 1.5 MP
  //       otherwise), quality (extra resolution scale 0.3..1, default 1; see setQuality),
  //       preserveDrawingBuffer, powerPreference (default 'default'), releaseContext (destroy()
  //       also drops the WebGL context; a later createWaves() on the same canvas restores it
  //       asynchronously and draws the last frame as soon as the context is back), tilt (degrees),
  //       portraitTurn (degrees the eye turns on portrait screens, default 86; 0 keeps it level).
  // resize() / setQuality() redraw the last rendered time themselves (changing the canvas size
  // clears it), so the canvas never shows an empty frame.  After destroy() every method is a no-op.
  window.createWaves = function (canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: opts.powerPreference || 'default' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not available');
    var SC = opts.scene || SCENE, TU = opts.tunnel || TUN;   // (overrides are for tuning tools)
    var G = SC.G;
    var strands = SC.strands.slice();
    var maxVec = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64;
    var budget = maxVec - 10;                             // 1 vec4 per strand, a few for globals
    if (strands.length > budget) {                        // tiny GPUs: drop the least important strands
      var prio = { H: 0, M: 1, T: 2 };
      var keep = strands.slice().sort(function (a, b) { return prio[a.ty] - prio[b.ty]; }).slice(0, Math.max(0, budget));
      strands = strands.filter(function (s) { return keep.indexOf(s) >= 0; });
    }
    var NS = strands.length;
    var fsSrc = buildShader(strands, G, TU, opts.dof || DOF);
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
      // the linked program keeps what it needs: free the shader objects right away
      gl.detachShader(prog, vs); gl.detachShader(prog, fs);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!ok && !gl.isContextLost()) throw new Error(info);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      loc = {
        res: gl.getUniformLocation(prog, 'uRes'), g: gl.getUniformLocation(prog, 'uG'),
        xf: gl.getUniformLocation(prog, 'uXf'), an: gl.getUniformLocation(prog, 'uAn'),
        cs: gl.getUniformLocation(prog, 'uCS'), F: gl.getUniformLocation(prog, 'uF'), T: gl.getUniformLocation(prog, 'uT'), S: gl.getUniformLocation(prog, 'uS')
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
    // (asynchronous; onRestored builds the program and draws the last requested frame)
    if (gl.isContextLost()) {
      lost = true;
      var le = canvas.__wavesLoseCtx;
      // (the lost event of the old instance may still be pending: retry a few times)
      var tries = 0;
      var tryRestore = function () {
        if (dead || !gl.isContextLost() || !le) return;
        try { le.restoreContext(); } catch (err) { /* not restorable (yet) */ }
        if (++tries < 4) setTimeout(tryRestore, 30 * tries);
      };
      if (le) { canvas.__wavesLoseCtx = null; tryRestore(); }
    }

    var Farr = new Float32Array(8), Tarr = new Float32Array(8), Sarr = new Float32Array(NS * 4);
    var W = canvas.width || 1, H = canvas.height || 1;
    var quality = opts.quality || 1;
    var lastCss = null;
    if (!lost) init();                                     // (else: onRestored does it)

    function resize(cssW, cssH, dpr) {
      if (dead) return;
      dpr = dpr || 1;
      lastCss = [cssW, cssH, dpr];
      var phone = Math.min(cssW, cssH) < 600 && dpr >= 1.5;
      var maxPixels = opts.maxPixels || (phone ? 0.6e6 : 1.5e6);
      var s = Math.min(dpr, Math.sqrt(maxPixels / Math.max(1, cssW * cssH))) * quality;
      W = Math.max(1, Math.round(cssW * s)); H = Math.max(1, Math.round(cssH * s));
      if (canvas.width === W && canvas.height === H) return;   // unchanged: keep the buffer
      canvas.width = W; canvas.height = H;                      // (this clears the drawing buffer)
      gl.viewport(0, 0, W, H);
      if (lastT !== null) render(lastT);                        // ... so redraw the last frame now
    }
    // adaptive-quality hook (the page's frame-time governor lowers this; 1 = full budget)
    function setQuality(q) {
      if (dead) return;
      q = Math.max(0.3, Math.min(1, q));
      if (q === quality) return;
      quality = q;
      if (lastCss) resize(lastCss[0], lastCss[1], lastCss[2]);
    }

    function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

    function update(ph, aaw) {
      var i, o;
      for (i = 0; i < 2; i++) {
        var F = SC.fams[i];
        var m0 = F.A0 * Math.cos(ph + F.psi0), m1 = F.A0b * Math.cos(2 * ph + F.psi0b);
        Farr[i * 4] = m0 * Math.cos(F.phi0) + m1 * Math.cos(F.phi0b);
        Farr[i * 4 + 1] = m0 * Math.sin(F.phi0) + m1 * Math.sin(F.phi0b);
      }
      // tunnel sheets: phase offset + angular bend (ca, sa, cos2a, sin2a), slowly swaying
      for (i = 0; i < 2; i++) {
        var b = TU.bend[i], sw = TU.sway[i];
        for (var k = 0; k < 4; k++) Tarr[i * 4 + k] = b[k] + sw[k] * Math.cos(ph + sw[4] + k * 1.7);
      }
      // highlight breathing: the reference's highlights swell twice per loop (around t = 2 s and 7 s);
      // a gentle integer-harmonic gain on all strands sets that rhythm (and evens out the
      // once-per-loop swell that the strand staggering alone would give)
      var breath = BR.g + BR.a2 * Math.cos(2 * (ph - TAU * BR.t2 / PERIOD)) - BR.a1 * Math.cos(ph - TAU * BR.t1 / PERIOD);
      for (i = 0; i < NS; i++) {
        var s = strands[i];
        var fr = (s.o + ph / TAU) % 1;
        o = i * 4;
        var scl = s.s0 * Math.pow(ZOOM, fr);
        var bm = 1 + 4 * Math.pow(Math.max(0, scl - 1), 1.5);
        Sarr[o] = 1 / scl;
        Sarr[o + 1] = smooth(s.fi0, s.fi1, fr) * (1 - smooth(0.72, 1.0, fr)) * breath;
        Sarr[o + 2] = -s.rot * (fr - 0.5);                       // slow clockwise turn
        // conservative distance beyond which the strand contributes nothing visible
        Sarr[o + 3] = 5 * ((s.b0 + s.b1) * bm + aaw) + (2 * s.hw + (s.comp || 0)) * scl + 0.04;
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
      // composition: the almond is laid out for landscape; narrow screens zoom in a little,
      // portrait screens turn the eye so that its long axis follows the long side of the screen
      var aspect = W / H, norm, ang, cx = G.cx, cy = G.cy;
      var tiltDeg = opts.tilt != null ? opts.tilt : G.tilt;
      if (aspect >= 1.6) { norm = H; ang = tiltDeg; }
      else if (aspect >= 0.9) { norm = H * Math.pow(aspect / 1.6, 0.6); ang = tiltDeg; }
      else {
        norm = H / 1.75; ang = tiltDeg + (opts.portraitTurn != null ? opts.portraitTurn : 86);
        var ra = (ang - tiltDeg) * Math.PI / 180, ox = cx, oy = cy;
        cx = ox * Math.cos(ra) - oy * Math.sin(ra); cy = ox * Math.sin(ra) + oy * Math.cos(ra);
      }
      var tilt = ang * Math.PI / 180;
      var pxu = 1 / norm, amax = Math.max(G.ax, G.ay);
      update(ph, 0.6 * pxu * amax);
      gl.uniform2f(loc.res, W, H);
      gl.uniform4f(loc.g, pxu, 0.6 * pxu * amax, smooth(1.6, 3.0, 0.0075 / (pxu * amax)), ph);
      gl.uniform4f(loc.xf, cx, cy, Math.cos(tilt), Math.sin(tilt));
      gl.uniform4f(loc.an, G.ax, G.ay, tm / PERIOD, 0);
      gl.uniform2f(loc.cs, Math.cos(ph), Math.sin(ph));
      gl.uniform4fv(loc.F, Farr);
      gl.uniform4fv(loc.T, Tarr);
      gl.uniform4fv(loc.S, Sarr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function destroy() {
      if (dead) return;
      dead = true;
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      if (!gl.isContextLost()) { gl.deleteBuffer(buf); gl.deleteProgram(prog); }
      prog = buf = loc = null;
      // the canvas belongs to the host; free the GPU context only when asked to.  The lost event
      // is marked restorable and the extension kept on the canvas, so a later createWaves() on
      // the same canvas can bring the context back.
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
      getQuality: function () { return quality; } };
  };
})();
