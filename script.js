// Soft chiffon ribbon and bow, drawn as flexible strips so it can be untied
function createRibbon(canvas) {
  const ctx = canvas.getContext("2d");
  const paper = document.createElement("canvas");
  const pctx = paper.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0; // sleeve width in CSS px; everything is sized from it
  let ox = 0;
  let oy = 0;
  let K = { x: 0, y: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const sleeve = canvas.closest(".pocket");
    W = sleeve.clientWidth;
    ox = W * 0.45;
    oy = W * 0.2;
    K = { x: ox + W * 0.5, y: oy + sleeve.clientHeight * 0.5 };
    for (const c of [canvas, paper]) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
  }

  // deterministic noise so the frayed edges do not flicker
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const bez = (a, b, c, d, t) => {
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    };
  };
  const at = (dx, dy) => ({ x: K.x + dx * W, y: K.y + dy * W });

  function sample(segments, n) {
    const pts = [];
    segments.forEach((seg, k) => {
      for (let i = k ? 1 : 0; i <= n; i++) pts.push(bez(seg[0], seg[1], seg[2], seg[3], i / n));
    });
    return pts;
  }

  // Paint one strip of ribbon: width and twist vary along it, the back face is darker,
  // and the edges get a few loose fibres like raw-edged chiffon.
  function strip(pts, widthAt, twistAt, key, shade = 1) {
    const n = pts.length;
    const left = [];
    const right = [];
    const tones = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      const s = i / (n - 1);
      const twist = twistAt(s);
      const c = Math.cos(twist);
      const half = Math.max(0.6, (widthAt(s) * W * Math.abs(c)) / 2);
      left.push({ x: pts[i].x - ty * half, y: pts[i].y + tx * half, nx: -ty, ny: tx });
      right.push({ x: pts[i].x + ty * half, y: pts[i].y - tx * half, nx: ty, ny: -tx });
      tones.push(shade * (c >= 0 ? 0.93 + 0.07 * c : 0.86 + 0.05 * -c));
    }
    for (let i = 0; i < n - 1; i++) {
      const t = (tones[i] + tones[i + 1]) / 2;
      pctx.fillStyle = pctx.strokeStyle = `rgb(${Math.round(Math.min(255, 256 * t))}, ${Math.round(250 * t)}, ${Math.round(238 * t)})`;
      pctx.beginPath();
      pctx.moveTo(left[i].x, left[i].y);
      pctx.lineTo(left[i + 1].x, left[i + 1].y);
      pctx.lineTo(right[i + 1].x, right[i + 1].y);
      pctx.lineTo(right[i].x, right[i].y);
      pctx.closePath();
      pctx.fill();
      pctx.stroke();
    }
    // soft crinkles running along the chiffon
    pctx.lineWidth = 0.8;
    for (const [off, tone] of [[-0.28, "rgba(255,255,255,0.5)"], [0.12, "rgba(214,200,172,0.22)"], [0.34, "rgba(255,255,255,0.35)"]]) {
      pctx.strokeStyle = tone;
      pctx.beginPath();
      for (let i = 0; i < n; i++) {
        const w = 0.5 + off * (0.95 + 0.05 * Math.sin(i * 0.3 + key));
        const x = left[i].x * (1 - w) + right[i].x * w;
        const y = left[i].y * (1 - w) + right[i].y * w;
        if (i) pctx.lineTo(x, y); else pctx.moveTo(x, y);
      }
      pctx.stroke();
    }
    // loose fibres on the raw edges
    pctx.strokeStyle = "rgba(240, 230, 210, 0.9)";
    pctx.lineWidth = 0.6;
    pctx.beginPath();
    for (let i = 0; i < n; i++) {
      for (const [side, e] of [[0, left[i]], [1, right[i]]]) {
        const r = hash(key * 997 + i * 2 + side);
        if (r > 0.3) continue;
        const l = 0.8 + 2.2 * hash(key * 131 + i * 7 + side);
        pctx.moveTo(e.x, e.y);
        pctx.lineTo(e.x + e.nx * l + (r - 0.3) * 2, e.y + e.ny * l);
      }
    }
    pctx.stroke();
    pctx.lineWidth = 0.6;
  }

  // Move a set of points: shrink towards the knot, then swing and drop as a loose piece
  function place(pts, { shrink = 1, dx = 0, dy = 0, turn = 0, pivot = K } = {}) {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return pts.map((p) => {
      const x = K.x + (p.x - K.x) * shrink - pivot.x;
      const y = K.y + (p.y - K.y) * shrink - pivot.y;
      return { x: pivot.x + x * cos - y * sin + dx, y: pivot.y + x * sin + y * cos + dy };
    });
  }

  function draw(u, time) {
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, paper.width, paper.height);
    pctx.lineWidth = 0.6;
    const sway = Math.sin(time / 1300);
    const breeze = Math.sin(time / 900 + 1);

    // untying timeline
    const pullRight = ease(clamp01(u / 0.4));        // right loop slips through the knot
    const pullLeft = ease(clamp01((u - 0.18) / 0.4)); // then the left one
    const loosen = ease(clamp01((u - 0.5) / 0.18));   // knot falls open
    const fall = clamp01((u - 0.62) / 0.38);          // both halves slide off and drop

    const w = 0.15;
    const leftPiece = { dx: -fall * 0.7 * W, dy: fall * fall * 1.1 * W, turn: -fall * 0.7 };
    const rightPiece = { dx: fall * 0.7 * W, dy: fall * fall * 1.1 * W, turn: fall * 0.7 };
    const sag = loosen * 0.05;

    // band wrapped round the sleeve, split at the knot
    const bandL = sample([[at(-0.52, 0.004), at(-0.36, -0.006 + sag), at(-0.16, 0.008 + sag), at(0, 0)]], 26);
    const bandR = sample([[at(0, 0), at(0.16, -0.008 + sag), at(0.36, 0.006 + sag), at(0.52, -0.004)]], 26);
    strip(place(bandL, leftPiece), () => w * 0.95, (s) => 0.25 * Math.sin(s * 5 + 1), 1, 0.97);
    strip(place(bandR, rightPiece), () => w * 0.95, (s) => 0.25 * Math.sin(s * 5 + 3), 2, 0.97);

    // tails: lengthen as the bow is pulled, flutter gently while tied
    const tail = (dir, grow, key, piece) => {
      const len = 1 + 0.45 * grow;
      const tip = at(dir * (0.2 + 0.02 * sway) * len, (0.36 + 0.01 * breeze) * len);
      const pts = sample([[at(0, 0.01), at(dir * 0.03, 0.12 * len), at(dir * (0.2 + 0.03 * breeze), 0.2 * len), tip]], 30);
      strip(place(pts, piece),
        (s) => w * (0.5 + 0.55 * Math.min(1, s * 2.5)) * (s > 0.92 ? 1 - (s - 0.92) * 4 : 1),
        (s) => 0.55 * Math.sin(s * 7 + key + sway * 0.4), key, 0.95);
    };
    tail(-1, pullLeft, 5, leftPiece);
    tail(1, pullRight, 6, rightPiece);

    // loops: gathered at the knot, fanning out, the underside a little darker
    const loop = (dir, gone, key) => {
      if (gone >= 0.999) return;
      const tip = at(dir * 0.3, -0.03 + 0.005 * sway);
      const pts = sample([
        [at(0, 0), at(dir * 0.05, -0.13), at(dir * 0.24, -0.14), tip],
        [tip, at(dir * 0.31, 0.03), at(dir * 0.12, 0.035), at(0, 0.01)],
      ], 24);
      strip(place(pts, { shrink: 1 - gone }),
        (s) => w * (0.45 + 0.6 * Math.sin(Math.PI * s)),
        (s) => 0.35 * Math.sin(2 * Math.PI * s + key) + (s > 0.5 ? 0.3 : 0), key, 1);
    };
    loop(1, pullRight, 3);
    loop(-1, pullLeft, 4);

    // the knot itself
    if (loosen < 1) {
      const knot = sample([[at(0, -0.055), at(0.02, -0.02), at(-0.02, 0.03), at(0, 0.06)]], 12);
      strip(place(knot, { shrink: 1 - loosen }), (s) => 0.085 * (0.8 + 0.2 * Math.sin(Math.PI * s)), (s) => 0.5 * (s - 0.5), 7, 0.99);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.93 * (1 - Math.pow(fall, 3));
    ctx.shadowColor = "rgba(92, 62, 22, 0.28)";
    ctx.shadowBlur = 10 * dpr;
    ctx.shadowOffsetY = 4 * dpr;
    ctx.drawImage(paper, 0, 0);
    ctx.restore();
  }

  resize();
  return { draw, resize };
}

// Opening: tap the bow, the ribbon unties and falls away, then the invitation pops up
(function opening() {
  const wrap = document.getElementById("card-wrap");
  const card = wrap.querySelector(".card");
  const pin = card.querySelector(".pin");
  const sprig = wrap.querySelector(".sprig");
  const ribbon = createRibbon(document.getElementById("ribbon-canvas"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    // called from the guest's tap, so the browser allows the music to start here
    window.dispatchEvent(new Event("invitation:open"));
    wrap.classList.add("untying");
    const speed = reduceMotion ? 0 : 1;

    setTimeout(() => {
      sprig.animate([
        { transform: "translate(-46%, -86%) rotate(-6deg)", opacity: 1 },
        { transform: "translate(-40%, 160%) rotate(38deg)", opacity: 0 },
      ], { duration: 1300 * speed, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "forwards" });
    }, 700 * speed);

    await tween(2400 * speed, (t) => { untie = t; });

    // the invitation rises out of the sleeve, then pops free
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    await tween(900 * speed, (t) => {
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
    const to = card.getBoundingClientRect();
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top - to.top;
    const lift = Math.min(from.height * 0.55, from.bottom - pocketTop + 24);
    const duration = reduceMotion ? 0 : 1600;

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
    });
  }

  wrap.addEventListener("click", (event) => {
    // links on the card only work once it is out of the sleeve
    if (!opened) event.preventDefault();
    open();
  });

  document.getElementById("open-btn").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });

  measure();
  window.addEventListener("resize", () => { if (!started) measure(); });
  if (document.fonts) document.fonts.ready.then(measure);
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
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let visible = true;
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  new ResizeObserver(resize).observe(stage);

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
      angle: rand(0, Math.PI), spin: rand(-0.015, 0.015), tint: Math.random() < 0.5 ? "253, 246, 236" : "246, 222, 214",
    };
  }

  window.addEventListener("invitation:pop", (event) => {
    if (reduceMotion) return;
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
        const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time / 900 + d.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 251, 238, ${alpha})`;
        ctx.shadowColor = "rgba(255, 246, 220, 0.9)";
        ctx.shadowBlur = 6;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

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

  if (!reduceMotion) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);
    requestAnimationFrame(frame);
  }
})();

// Soft background music: starts with the opening tap, fades in, and can be paused
(function music() {
  const audio = document.getElementById("music");
  const toggle = document.getElementById("music-toggle");
  const VOLUME = 0.4;
  let wanted = true;
  try { wanted = localStorage.getItem("music") !== "off"; } catch (e) {}

  let fade = 0;
  function fadeTo(target, ms, done) {
    const id = ++fade;
    const from = audio.volume;
    const start = performance.now();
    function step(now) {
      if (id !== fade) return; // a newer fade took over
      const t = Math.max(0, Math.min(1, (now - start) / ms));
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  function play() {
    audio.volume = 0;
    const started = audio.play();
    if (started) started.catch(() => setState(false));
    fadeTo(VOLUME, 3000);
  }

  function setState(on) {
    toggle.setAttribute("aria-pressed", String(on));
    toggle.setAttribute("aria-label", on ? "Pause music" : "Play music");
  }

  window.addEventListener("invitation:open", () => {
    toggle.hidden = false;
    setState(wanted);
    if (wanted) play();
  }, { once: true });

  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-pressed") !== "true";
    setState(on);
    try { localStorage.setItem("music", on ? "on" : "off"); } catch (e) {}
    if (on) play();
    else fadeTo(0, 400, () => audio.pause());
  });
})();
