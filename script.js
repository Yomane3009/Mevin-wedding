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

  function finish() {
    opened = true;
    wrap.classList.add("opened");
    document.body.classList.remove("sealed");
    // the shrink is a transform, so give back the layout space it leaves below the card
    const shrink = parseFloat(wrap.style.getPropertyValue("--shrink")) || 1;
    wrap.style.marginBottom = `${-wrap.offsetHeight * (1 - shrink)}px`;
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
