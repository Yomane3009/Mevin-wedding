// Opening: tap the card to untie the bow and lift the vellum sleeve
(function opening() {
  const wrap = document.getElementById("card-wrap");
  const button = document.getElementById("open-btn");
  let opened = false;

  // While sealed, shrink the card so the whole thing fits on screen
  function fit() {
    if (opened) return;
    const room = window.innerHeight - 32 - 80;
    const scale = Math.min(1, room / wrap.offsetHeight);
    wrap.style.setProperty("--fit", scale.toFixed(3));
  }
  fit();
  window.addEventListener("resize", fit);
  if (document.fonts) document.fonts.ready.then(fit);

  function open() {
    if (opened) return;
    opened = true;
    wrap.classList.add("opened");
    const vellum = wrap.querySelector(".vellum");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      wrap.classList.add("gone");
      document.body.classList.remove("sealed");
    };
    vellum.addEventListener("transitionend", (event) => {
      if (event.propertyName === "opacity") finish();
    });
    setTimeout(finish, 4000); // fallback if the transition never reports
  }

  wrap.addEventListener("click", (event) => {
    if (!opened) {
      event.preventDefault();
      open();
    }
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
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
