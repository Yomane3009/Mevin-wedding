// Opening: the card is pulled up out of its vellum sleeve, by tap or by dragging up
(function opening() {
  const wrap = document.getElementById("card-wrap");
  const card = wrap.querySelector(".card");
  const pin = card.querySelector(".pin");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let progress = 0;
  let opened = false;
  let animating = false;
  let drag = null;

  // How far the card rises: until the wedding date and church location clear the sleeve.
  // --shrink eases the whole card back a little so the bow stays in view once it is out.
  function measure() {
    const width = wrap.clientWidth;
    const pull = pin.offsetTop + pin.offsetHeight + width * 0.04;
    const needed = wrap.getBoundingClientRect().top + window.scrollY + pull + width * 1.45 * 0.72;
    const shrink = Math.min(1, (window.innerHeight - 16) / needed);
    wrap.style.setProperty("--pull", `${pull}px`);
    wrap.style.setProperty("--shrink", Math.max(0.82, shrink).toFixed(3));
  }

  function render(p) {
    progress = p;
    wrap.style.setProperty("--p", p.toFixed(4));
    // a slight hand-held tilt while the card is in motion
    wrap.style.setProperty("--tilt", (-2.2 * Math.sin(Math.PI * p)).toFixed(3));
  }

  function settle(target, duration) {
    const from = progress;
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    animating = true;
    function frame(now) {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      render(from + (target - from) * ease(t));
      if (t < 1) return requestAnimationFrame(frame);
      animating = false;
      if (target === 1) finish();
    }
    requestAnimationFrame(frame);
  }

  // Once the card is out of the sleeve, the full invitation pops free and settles in the
  // middle of the screen while the sleeve falls away
  function finish() {
    opened = true;
    wrap.classList.add("opened");
    const revealed = document.getElementById("revealed");
    const tilt = parseFloat(wrap.style.getPropertyValue("--tilt")) || 0;
    const from = card.getBoundingClientRect();
    const pocketTop = wrap.querySelector(".pocket").getBoundingClientRect().top;
    const sleeveTransform = getComputedStyle(wrap).transform;

    // lift the sleeve out of the page flow exactly where it is
    const { offsetTop, offsetLeft, offsetWidth } = wrap;
    Object.assign(wrap.style, {
      position: "absolute", margin: "0", top: `${offsetTop}px`, left: `${offsetLeft}px`, width: `${offsetWidth}px`,
    });

    revealed.appendChild(card);
    const to = card.getBoundingClientRect();
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top - to.top;
    const lift = Math.min(from.height * 0.55, from.bottom - pocketTop + 24);
    const duration = reduceMotion ? 0 : 1600;

    card.style.transformOrigin = "50% 0";
    const pop = card.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${tilt}deg)` },
      { transform: `translate(${dx * 0.6}px, ${dy - lift}px) scale(${scale * 1.02}) rotate(${tilt * 0.4}deg)`, offset: 0.38 },
      { transform: "translate(0, -6px) scale(1.035)", offset: 0.78 },
      { transform: "none" },
    ], { duration, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });

    wrap.animate([
      { transform: sleeveTransform, opacity: 1 },
      { transform: `${sleeveTransform === "none" ? "" : sleeveTransform} translateY(140px)`, opacity: 0 },
    ], { duration: duration * 0.6, delay: duration * 0.2, easing: "ease-in", fill: "forwards" })
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

  function open() {
    if (opened || animating) return;
    settle(1, reduceMotion ? 0 : 1800 * (1 - progress) + 200);
  }

  wrap.addEventListener("pointerdown", (event) => {
    if (opened || animating) return;
    drag = { y: event.clientY, start: progress, moved: false };
    wrap.setPointerCapture(event.pointerId);
    wrap.classList.add("dragging");
  });

  wrap.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dy = drag.y - event.clientY;
    if (Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const pull = parseFloat(getComputedStyle(wrap).getPropertyValue("--pull")) || 1;
    render(Math.max(0, Math.min(1, drag.start + dy / pull)));
  });

  function release() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    wrap.classList.remove("dragging");
    if (!moved || progress > 0.2) open();
    else settle(0, 300);
  }
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);

  // Links on the card only work once it is out of the sleeve
  wrap.addEventListener("click", (event) => {
    if (!opened) event.preventDefault();
  });

  document.getElementById("open-btn").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });

  measure();
  window.addEventListener("resize", () => { if (!opened && !progress) measure(); });
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
        ctx.fillStyle = `rgba(255, 216, 160, ${alpha})`;
        ctx.shadowColor = "rgba(255, 210, 150, 0.8)";
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
        ctx.fillStyle = `rgba(${p.tint}, 0.55)`;
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
        ctx.fillStyle = `rgba(255, 224, 170, ${Math.max(0, s.life)})`;
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
