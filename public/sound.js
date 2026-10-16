// Soundtrack: 'Ephemera' by Scott Buckley – released under CC-BY 4.0 (www.scottbuckley.com.au)
// Browsers only allow sound after a gesture: the music starts with the first click, tap or key on
// the stage (or the sound button) unless the viewer switched it off. The credit fades in at the
// start and every time the music starts, then fades out again.
(function () {
  const btn = document.getElementById('wv-sound');
  const credit = document.getElementById('wv-credit');
  const stage = document.getElementById('wind-stage');
  const VOL = 0.55, CREDIT_MS = 9000;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  const audio = new Audio();
  audio.src = 'audio/ephemera.mp3';
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;

  let want = store.get('wind-sound') !== 'off';
  let on = false, fadeRaf = 0, creditTimer = 0;

  function fadeTo(target, ms, done) {
    cancelAnimationFrame(fadeRaf);
    const from = audio.volume, t0 = performance.now();
    const step = (now) => {
      const f = Math.min(1, (now - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * f));
      if (f < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
    };
    fadeRaf = requestAnimationFrame(step);
  }
  function showCredit() {
    clearTimeout(creditTimer);
    credit.classList.add('is-on');
    creditTimer = setTimeout(() => credit.classList.remove('is-on'), CREDIT_MS);
  }
  function paint() {
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Musik aus' : 'Musik ein';
    btn.classList.toggle('is-waiting', want && !on);
  }
  function start() {
    const p = audio.play();
    const ok = () => { on = true; fadeTo(VOL, 3000); showCredit(); paint(); };
    if (p && p.then) p.then(ok, () => { on = false; paint(); }); else ok();
  }
  function stop() {
    on = false;
    fadeTo(0, 900, () => { if (!on) audio.pause(); });
    paint();
  }

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    want = !on;
    store.set('wind-sound', want ? 'on' : 'off');
    if (want) start(); else stop();
  });
  // the first interaction with the animation starts the music
  const gesture = () => { if (want && !on) start(); };
  stage.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('#wv-sound, .wv-credit a')) gesture(); });
  // pause while the tab is hidden, resume when it comes back
  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) audio.pause(); else audio.play().catch(() => {});
  });

  window.wvSound = { gesture };
  paint();
  // credit at the start, fading out again
  setTimeout(showCredit, 600);
})();
