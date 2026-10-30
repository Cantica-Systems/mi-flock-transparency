/* The Michigan map behind the page, shared by the report and the timeline.
   The build projects it (backdrop-data.js: county outlines, the state line, and a
   marker on each city or township a department serves), so this only lays the paths into an SVG that style.css
   fixes behind the content. Decorative, so hidden from assistive tech. */
(function () {
  const b = window.FLOCK_BACKDROP;
  if (!b) return;
  const el = document.createElement("div");
  el.className = "backdrop";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<svg viewBox="0 0 ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet">`
    + `<path class="all-counties" d="${b.all_counties}"></path>`
    + `<path class="state" d="${b.state}"></path>`
    + b.markers.map((m) => `<g class="marker" transform="translate(${m.x} ${m.y})"><circle class="halo" r="6"></circle><circle class="dot" r="2.4"></circle></g>`).join("")
    + `</svg>`;
  document.body.prepend(el);
})();
