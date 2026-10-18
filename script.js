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

// RSVP: opens the guest's email app with their reply filled in
(function rsvp() {
  const form = document.getElementById("rsvp-form");
  const status = form.querySelector(".form-status");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = (data.get("name") || "").trim();
    const attending = data.get("attending");

    if (!name || !attending) {
      status.textContent = "Please add your name and let us know if you can come.";
      return;
    }

    const body = [
      `Name: ${name}`,
      `Reply: ${attending}`,
      `Guests: ${data.get("guests") || 1}`,
      data.get("message") ? `Note: ${data.get("message")}` : "",
    ].filter(Boolean).join("\n");

    const subject = `RSVP from ${name}`;
    window.location.href =
      `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Thank you! Your email app should open to send your reply.";
  });
})();
