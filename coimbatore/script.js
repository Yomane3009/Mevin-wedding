// Raw-edged chiffon ribbon and bow, like the one on the printed card. Each piece is a
// painted image (tools/make_ribbon.py) so the bow can be untied piece by piece.
function createRibbon(canvas) {
  const ctx = canvas.getContext("2d");
  const paper = document.createElement("canvas");
  const pctx = paper.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // every image shares one frame around the knot, in sleeve widths
  const FRAME = { x: -0.56, y: -0.32, w: 1.12, h: 0.8 };
  const pieces = {};
  const loading = [];
  for (const name of ["band-left", "band-right", "tail-left", "tail-right", "loop-left", "loop-right", "knot"]) {
    const img = new Image();
    img.src = `assets/ribbon/${name}.webp`;
    pieces[name] = img;
    loading.push(img.decode().catch(() => {}));
  }
  const ready = Promise.all(loading);
  let W = 0; // sleeve width in CSS px; everything is sized from it
  let K = { x: 0, y: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const sleeve = canvas.closest(".pocket");
    W = sleeve.clientWidth;
    K = { x: W * 0.45 + W * 0.5, y: W * 0.2 + sleeve.clientHeight * 0.5 };
    for (const c of [canvas, paper]) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);

  // Draw one piece turned and scaled about the knot, then moved
  function piece(name, { scale = 1, turn = 0, dx = 0, dy = 0, alpha = 1 } = {}) {
    const img = pieces[name];
    if (!img.complete || !img.naturalWidth || alpha <= 0) return;
    pctx.save();
    pctx.globalAlpha = alpha;
    pctx.translate(K.x + dx, K.y + dy);
    pctx.rotate(turn);
    pctx.scale(scale, scale);
    pctx.drawImage(img, FRAME.x * W, FRAME.y * W, FRAME.w * W, FRAME.h * W);
    pctx.restore();
  }

  function draw(u, time) {
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, paper.width, paper.height);
    const sway = Math.sin(time / 1400);

    // untying timeline
    const pullRight = ease(clamp01(u / 0.4));        // right loop slips through the knot
    const pullLeft = ease(clamp01((u - 0.18) / 0.4)); // then the left one
    const loosen = ease(clamp01((u - 0.5) / 0.18));   // knot falls open
    const fall = clamp01((u - 0.62) / 0.38);          // both halves slide off and drop

    const side = (dir) => ({
      dx: dir * (loosen * 0.025 + fall * 0.7) * W,
      dy: (loosen * 0.015 + fall * fall * 1.1) * W,
      turn: dir * fall * 0.7,
    });
    const left = side(-1);
    const right = side(1);

    piece("band-left", left);
    piece("band-right", right);
    // tails stretch as the loops are pulled through, and stir gently while tied
    piece("tail-left", { ...left, scale: 1 + 0.3 * pullLeft, turn: left.turn + 0.025 * sway + 0.12 * pullLeft });
    piece("tail-right", { ...right, scale: 1 + 0.3 * pullRight, turn: right.turn - 0.02 * sway - 0.12 * pullRight });
    // loops shrink back into the knot and swing down as they slip through
    piece("loop-left", { scale: 1 - 0.8 * pullLeft, turn: -0.5 * pullLeft, alpha: 1 - ease(clamp01((pullLeft - 0.5) / 0.5)) });
    piece("loop-right", { scale: 1 - 0.8 * pullRight, turn: 0.5 * pullRight, alpha: 1 - ease(clamp01((pullRight - 0.5) / 0.5)) });
    piece("knot", { scale: 1 - 0.4 * loosen, alpha: 1 - loosen });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 1 - Math.pow(fall, 3);
    ctx.shadowColor = "rgba(92, 42, 44, 0.1)";
    ctx.shadowBlur = 6 * dpr;
    ctx.shadowOffsetY = 2 * dpr;
    ctx.drawImage(paper, 0, 0);
    ctx.restore();
  }

  resize();
  return { draw, resize, ready };
}

// Opening: the guest taps the ribbon, it unties and falls away, the invitation pops up,
// and the page glides down through the details. It runs the same for every guest,
// including phones set to reduce motion (common on iPhones): skipping it there jumped
// straight to the open card
(function opening() {
  const wrap = document.getElementById("card-wrap");
  const card = wrap.querySelector(".card");
  const pin = card.querySelector(".pin");
  const ribbon = createRibbon(document.getElementById("ribbon-canvas"));
  let untie = 0;
  let started = false;
  let opened = false;

  // How far the card rises out of the sleeve before it pops free
  function measure() {
    const width = wrap.clientWidth;
    const pull = pin.offsetTop + pin.offsetHeight + width * 0.04;
    const needed = wrap.getBoundingClientRect().top + window.scrollY + pull + width * 1.45 * 0.72;
    const shrink = Math.min(1, (window.innerHeight - 16) / needed);
    wrap.style.setProperty("--pull", `${pull}px`);
    wrap.style.setProperty("--shrink", Math.max(0.82, shrink).toFixed(3));
    ribbon.resize();
  }

  // the ribbon breathes gently while tied, and is redrawn every frame while untying
  (function loop(time) {
    if (opened) return;
    ribbon.draw(untie, time);
    requestAnimationFrame(loop);
  })(performance.now());

  function tween(duration, step) {
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const t = duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
        step(t);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  async function open() {
    if (started) return;
    started = true;
    window.dispatchEvent(new Event("invitation:open"));
    wrap.classList.add("untying");

    await tween(2400, (t) => { untie = t; });

    // the invitation rises out of the sleeve, then pops free
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    await tween(900, (t) => {
      const p = ease(t);
      wrap.style.setProperty("--p", p.toFixed(4));
      wrap.style.setProperty("--tilt", (-2 * Math.sin(Math.PI * p)).toFixed(3));
    });
    finish();
  }

  // The full invitation pops free and settles in the middle of the screen while the
  // sleeve falls away behind it
  function finish() {
    opened = true;
    wrap.classList.add("opened");
    const revealed = document.getElementById("revealed");
    const from = card.getBoundingClientRect();
    const pocketTop = wrap.querySelector(".pocket").getBoundingClientRect().top;
    const sleeveTransform = getComputedStyle(wrap).transform;

    // lift the sleeve out of the page flow exactly where it is, in front of the card
    // so the card visibly slides out from under the vellum
    const { offsetTop, offsetLeft, offsetWidth } = wrap;
    Object.assign(wrap.style, {
      position: "absolute", margin: "0", top: `${offsetTop}px`, left: `${offsetLeft}px`, width: `${offsetWidth}px`, zIndex: 3,
    });
    wrap.querySelector(".pocket-back").style.display = "none";
    wrap.querySelector(".ribbon").style.display = "none";

    revealed.appendChild(card);
    sizeUnits();
    const to = card.getBoundingClientRect();
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top - to.top;
    const lift = Math.min(from.height * 0.55, from.bottom - pocketTop + 24);
    const duration = 1600;

    card.style.transformOrigin = "50% 0";
    const pop = card.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transform: `translate(${dx * 0.6}px, ${dy - lift}px) scale(${scale * 1.02})`, offset: 0.38 },
      { transform: "translate(0, -6px) scale(1.035)", offset: 0.78 },
      { transform: "none" },
    ], { duration, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });

    wrap.animate([
      { transform: sleeveTransform, opacity: 1 },
      { transform: `${sleeveTransform === "none" ? "" : sleeveTransform} translateY(140px)`, opacity: 0 },
    ], { duration: duration * 0.4, delay: duration * 0.22, easing: "ease-in", fill: "forwards" })
      .finished.then(() => { wrap.style.display = "none"; });

    setTimeout(() => {
      const r = card.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent("invitation:pop", { detail: { x: r.left + r.width / 2, y: r.top + r.height * 0.3 } }));
    }, duration * 0.75);

    pop.finished.then(() => {
      card.style.transformOrigin = "";
      document.body.classList.remove("sealed");
      setTimeout(tour, 1400);
    });
  }

  // Scroll gently to the end of the page so guests see everything once. Scrolling by
  // hand (a swipe, the wheel or the keys) hands control back to them; a plain tap
  // does not, so tapping to turn the sound on leaves the tour running
  function tour() {
    if (window.scrollY > 40) return; // the guest has already set off on their own
    const from = window.scrollY;
    const distance = document.documentElement.scrollHeight - window.innerHeight - from;
    if (distance <= 0) return;
    const duration = Math.min(22000, Math.max(7000, distance * 7));
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const start = performance.now();
    let stopped = false;
    const events = ["wheel", "touchmove", "keydown"];
    // the page scrolls smoothly for links; the tour moves it itself, frame by frame
    // (older Safari does not know scrollTo's "instant", so switch the smoothing off)
    const root = document.documentElement.style;
    root.scrollBehavior = "auto";
    const stop = () => {
      stopped = true;
      root.scrollBehavior = "";
      events.forEach((e) => window.removeEventListener(e, stop));
    };
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    let expected = from;
    (function step(now) {
      if (stopped) return;
      // the page moved somewhere we did not put it: the guest is scrolling
      if (Math.abs(window.scrollY - expected) > 40) return stop();
      const t = Math.min(1, (now - start) / duration);
      expected = Math.round(from + distance * ease(t));
      window.scrollTo(0, expected);
      expected = window.scrollY; // the browser may clamp or round it
      if (t < 1) requestAnimationFrame(step);
      else stop();
    })(start);
  }

  // iOS 15 and older have no container units (cqw), so the card would fall apart;
  // give them the same sizes in pixels through --cq (see styles.css)
  function sizeUnits() {
    if (window.CSS && CSS.supports("width: 1cqw")) return;
    for (const el of [wrap, document.getElementById("revealed")]) {
      el.style.setProperty("--cq", `${el.clientWidth / 100}px`);
    }
  }

  sizeUnits();
  measure();
  window.addEventListener("resize", () => {
    sizeUnits();
    if (!started) measure();
  });
  // The guest opens it: a tap on the ribbon (or anywhere on the sleeve) unties it.
  // That tap also counts as permission for sound, so the music starts with the opening.
  const hint = document.getElementById("open-hint");
  let ready = false;
  let asked = false;
  function tap() {
    if (started) return;
    if (!ready) { asked = true; return; }
    if (hint) hint.hidden = true;
    wrap.removeAttribute("role");
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("aria-label");
    open();
  }
  wrap.addEventListener("click", tap);
  wrap.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tap(); }
  });
  Promise.all([ribbon.ready, document.fonts ? document.fonts.ready : null]).then(() => {
    measure();
    ready = true;
    wrap.classList.add("ready");
    if (asked) tap();
    else if (hint) hint.hidden = false;
  });
})();

// Countdown to the wedding date set on #countdown[data-date]
(function countdown() {
  const section = document.getElementById("countdown");
  const target = new Date(section.dataset.date).getTime();
  if (Number.isNaN(target)) return;

  const units = {
    days: section.querySelector('[data-unit="days"]'),
    hours: section.querySelector('[data-unit="hours"]'),
    minutes: section.querySelector('[data-unit="minutes"]'),
    seconds: section.querySelector('[data-unit="seconds"]'),
  };

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      section.querySelector(".timer").hidden = true;
      section.querySelector(".timer-done").hidden = false;
      clearInterval(timer);
      return;
    }
    const s = Math.floor(diff / 1000);
    units.days.textContent = Math.floor(s / 86400);
    units.hours.textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
    units.minutes.textContent = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    units.seconds.textContent = String(s % 60).padStart(2, "0");
  }

  const timer = setInterval(tick, 1000);
  tick();
})();

// Fade sections in as they scroll into view
(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => observer.observe(el));
})();

// Background: drifting gold dust, a few falling petals, and a sparkle burst when the card pops out
(function ambience() {
  const canvas = document.getElementById("ambience");
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let visible = true;
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    // the mobile browser bar sliding in and out nudges the height while scrolling;
    // rebuilding the canvas for that would blank it for a frame, so ignore small changes
    if (stage.clientWidth === width && Math.abs(stage.clientHeight - height) < 120) return;
    width = stage.clientWidth;
    height = stage.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  // one soft glowing mote, drawn once and stamped for each speck of dust
  // (a canvas shadow on every speck every frame is slow on phones)
  const mote = document.createElement("canvas");
  mote.width = mote.height = 32;
  const mctx = mote.getContext("2d");
  const glow = mctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, "rgba(255, 252, 240, 1)");
  glow.addColorStop(0.25, "rgba(255, 249, 232, 0.85)");
  glow.addColorStop(0.55, "rgba(255, 246, 220, 0.25)");
  glow.addColorStop(1, "rgba(255, 246, 220, 0)");
  mctx.fillStyle = glow;
  mctx.fillRect(0, 0, 32, 32);

  const dust = Array.from({ length: 55 }, () => ({
    x: rand(0, width), y: rand(0, height), r: rand(0.6, 2.2),
    vx: rand(-0.12, 0.12), vy: rand(-0.35, -0.08), phase: rand(0, Math.PI * 2),
  }));
  const petals = Array.from({ length: 14 }, () => newPetal(true));
  let sparks = [];

  function newPetal(anywhere) {
    return {
      x: rand(0, width), y: anywhere ? rand(0, height) : rand(-60, -10), size: rand(6, 11),
      vy: rand(0.35, 0.8), sway: rand(0.4, 1.2), phase: rand(0, Math.PI * 2),
      angle: rand(0, Math.PI), spin: rand(-0.015, 0.015), tint: Math.random() < 0.5 ? "253, 246, 236" : "242, 200, 198",
    };
  }

  window.addEventListener("invitation:pop", (event) => {
    const box = stage.getBoundingClientRect();
    const cx = event.detail.x - box.left;
    const cy = event.detail.y - box.top;
    for (let i = 0; i < 70; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(1.5, 6);
      sparks.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, life: 1, r: rand(1, 2.6) });
    }
  });

  function frame(time) {
    if (visible && !document.hidden) {
      ctx.clearRect(0, 0, width, height);

      for (const d of dust) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.y < -10) { d.y = height + 10; d.x = rand(0, width); }
        if (d.x < -10) d.x = width + 10;
        if (d.x > width + 10) d.x = -10;
        ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time / 900 + d.phase));
        const size = d.r * 2 + 8;
        ctx.drawImage(mote, d.x - size / 2, d.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.vy;
        p.x += Math.sin(time / 1400 + p.phase) * p.sway * 0.6;
        p.angle += p.spin;
        if (p.y > height + 30) petals[i] = newPetal(false);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, 0.55 + 0.35 * Math.sin(time / 700 + p.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.tint}, 0.75)`;
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }

      sparks = sparks.filter((s) => s.life > 0);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.06;
        s.vx *= 0.98;
        s.life -= 0.012;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 252, 240, ${Math.max(0, s.life)})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);
  requestAnimationFrame(frame);
})();

// Engagement film: starts as the invitation opens and plays once, with a small blurred
// copy running behind the page. The backdrop follows the framed film, and seeking or
// pausing the film moves the backdrop with it. When it ends, a button offers a replay.
(function film() {
  const video = document.getElementById("film");
  const backdrop = document.getElementById("film-bg");
  const replay = document.getElementById("film-replay");
  if (!video || !backdrop) return;
  let running = false;
  let userPaused = false;
  let syncing = false;

  const start = (v) => v.play().catch(() => {});
  function align() {
    syncing = true;
    video.currentTime = backdrop.currentTime;
  }

  video.addEventListener("seeked", () => {
    if (syncing) { syncing = false; return; }
    backdrop.currentTime = video.currentTime; // the guest moved the film
  });
  video.addEventListener("pause", () => {
    // browsers pause muted films that scroll off screen; only a guest's pause counts
    if (video.ended || document.visibilityState !== "visible" || syncing) return;
    const rect = video.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      userPaused = true;
      backdrop.pause();
    }
  });
  video.addEventListener("play", () => {
    running = true;
    userPaused = false;
    if (replay) replay.hidden = true;
    if (backdrop.ended || Math.abs(backdrop.currentTime - video.currentTime) > 1) {
      backdrop.currentTime = video.currentTime;
    }
    if (backdrop.paused) start(backdrop);
  });
  video.addEventListener("ended", () => {
    backdrop.pause();
    if (replay) replay.hidden = false;
  });
  if (replay) {
    replay.addEventListener("click", () => {
      video.currentTime = 0;
      backdrop.currentTime = 0;
      start(video);
    });
  }

  // keep both running and in step while the film plays: big gaps jump, small drift is
  // eased out by nudging the backdrop's speed so nothing visibly skips
  setInterval(() => {
    if (!running || userPaused || video.ended || document.visibilityState !== "visible") return;
    if (backdrop.paused && !backdrop.ended) start(backdrop);
    if (video.paused) start(video);
    if (backdrop.readyState < 2 || video.readyState < 2) return;
    const drift = video.currentTime - backdrop.currentTime;
    if (Math.abs(drift) > 1) {
      if (video.paused) align();
      else backdrop.currentTime = video.currentTime;
      backdrop.playbackRate = 1;
    } else {
      backdrop.playbackRate = 1 + Math.max(-0.1, Math.min(0.1, drift * 0.5));
    }
  }, 250);

  window.addEventListener("invitation:open", () => {
    running = true;
    start(backdrop);
    start(video);
  }, { once: true });
})();

// The film's own soundtrack is the site's music: it fades in as the card opens and the
// note button turns it off and on. Browsers only allow sound once the guest has tapped
// the page, so until then the film plays silently and the sound comes in on that tap.
(function sound() {
  const film = document.getElementById("film");
  const backdrop = document.getElementById("film-bg");
  const toggle = document.getElementById("music-toggle");
  const hint = document.getElementById("sound-hint");
  if (!film || !toggle) return;
  const VOLUME = 0.8;
  let wanted = true;
  try { wanted = localStorage.getItem("music") !== "off"; } catch (e) {}
  let on = wanted;
  // what we last set, so a mute from the film's own controls can be told apart
  let ourMute = film.muted;
  const mute = (value) => { ourMute = value; film.muted = value; };

  let fade = 0;
  function fadeTo(target, ms, done) {
    const id = ++fade;
    const from = film.volume;
    const start = performance.now();
    function step(now) {
      if (id !== fade) return; // a newer fade took over
      const t = Math.max(0, Math.min(1, (now - start) / ms));
      film.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  function setState(value) {
    on = value;
    toggle.setAttribute("aria-pressed", String(on));
    toggle.setAttribute("aria-label", value ? "Turn sound off" : "Turn sound on");
  }

  // If the browser refuses the sound it pauses the film instead (Safari may do so a
  // moment later), so put it back on mute, keep it playing and wait for a real tap
  function soundOn() {
    film.volume = 0;
    mute(false);
    const refused = () => {
      if (!film.paused || film.muted || !on) return;
      mute(true);
      film.play().catch(() => {});
      waitForTap();
    };
    film.play().then(() => {
      if (on && !film.muted) fadeTo(VOLUME, 2500);
      setTimeout(refused, 400);
    }, refused);
  }

  function soundOff() {
    fadeTo(0, 400, () => mute(true));
  }

  // Only a finished tap (touchend), a click or a key counts as the guest's go-ahead.
  // A touch that starts a swipe does not, and unmuting on it would stop the film.
  let waiting = false;
  function waitForTap() {
    if (waiting) return;
    waiting = true;
    const events = ["touchend", "click", "keydown"];
    const go = (event) => {
      events.forEach((e) => window.removeEventListener(e, go, true));
      waiting = false;
      if (hint) hint.hidden = true;
      // Low Power Mode on iPhones holds even silent films until a tap
      if (backdrop && backdrop.paused) backdrop.play().catch(() => {});
      if (toggle.contains(event.target)) return; // the note button handles itself
      if (on && film.muted) soundOn();
      else if (film.paused) film.play().catch(() => {});
    };
    events.forEach((e) => window.addEventListener(e, go, true));
    // a gentle nudge, since nothing else tells the guest the film has sound
    if (hint) hint.hidden = false;
  }

  window.addEventListener("invitation:open", () => {
    toggle.hidden = false;
    setState(wanted);
    if (!wanted) return;
    // unmuting before the guest has touched the page would make the browser stop the film
    const touched = navigator.userActivation && navigator.userActivation.hasBeenActive;
    if (touched) soundOn();
    else waitForTap();
  }, { once: true });

  toggle.addEventListener("click", () => {
    // while the film waits silently for a first tap, tapping the note means "sound on"
    const turnOn = !on || film.muted;
    setState(turnOn);
    try { localStorage.setItem("music", turnOn ? "on" : "off"); } catch (e) {}
    if (turnOn) soundOn();
    else soundOff();
  });

  // the film's own controls can mute it too; keep the button in step
  film.addEventListener("volumechange", () => {
    if (film.muted === ourMute) return;
    ourMute = film.muted;
    setState(!film.muted);
  });
})();

// RSVP: sends the guest's reply to the Google Sheet behind data-endpoint
// (tools/rsvp-sheet.gs). A reply already sent from this phone is remembered.
(function rsvp() {
  const section = document.getElementById("rsvp");
  const form = document.getElementById("rsvp-form");
  if (!section || !form) return;
  const endpoint = section.dataset.endpoint;
  if (!endpoint) return; // not set up yet: keep the section hidden
  section.hidden = false;
  const status = document.getElementById("rsvp-status");
  const guests = document.getElementById("rsvp-guests");
  const button = form.querySelector("button");
  const done = document.getElementById("rsvp-done");

  function thank(name) {
    form.hidden = true;
    done.hidden = false;
    done.querySelector(".rsvp-thanks").textContent = name ? `Thank you, ${name.split(/\s+/)[0]}!` : "Thank you!";
  }

  // someone else on the same phone (or a change of plans) can send a fresh reply
  done.querySelector("button").addEventListener("click", () => {
    try { localStorage.removeItem("rsvp"); } catch (e) {}
    form.reset();
    guests.hidden = false;
    button.disabled = false;
    status.textContent = "";
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  form.addEventListener("input", () => { status.textContent = ""; });

  // the head count only matters for guests who are coming
  form.addEventListener("change", () => {
    const choice = form.elements.attending.value;
    guests.hidden = choice === "Sorry, can't make it";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const attending = form.elements.attending.value;
    status.classList.remove("error");
    if (!name || !attending) {
      status.textContent = !name ? "Please tell us your name." : "Please let us know if you can come.";
      status.classList.add("error");
      return;
    }
    if (form.elements.website.value) return thank(name);

    const data = new URLSearchParams({
      name,
      attending,
      guests: attending === "Sorry, can't make it" ? "0" : form.elements.guests.value,
      message: form.elements.message.value.trim(),
      site: "coimbatore", // the sheet keeps these on their own tab
    });
    button.disabled = true;
    status.textContent = "Sending…";
    try {
      // Google's script answers from another site, so the reply can't be read;
      // reaching it at all means the row was written
      await fetch(endpoint, { method: "POST", mode: "no-cors", body: data });
      try { localStorage.setItem("rsvp", name); } catch (e) {}
      thank(name);
    } catch (e) {
      button.disabled = false;
      status.textContent = "That didn't go through. Please check your connection and try again.";
      status.classList.add("error");
    }
  });

  try {
    const sent = localStorage.getItem("rsvp");
    if (sent) thank(sent);
  } catch (e) {}
})();
