/* Michigan Flock transparency archive.
   Every chart is hand-rolled inline SVG: no chart library, no CDN, so this
   ports to a Worker or a Blotter page unchanged. Data comes from flock-data.js
   (or flock.json), which the build step produces. */

const NS = "http://www.w3.org/2000/svg";
const tip = document.getElementById("tip");

const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const fmt = (n) => (n == null ? "not shown" : n.toLocaleString("en-US"));
const cssvar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* A rectangle with its data end rounded, baseline end square. */
/* Numbers in prose. The roster is not fixed, so nothing is typed as a word. */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const words = (n) => {
  if (n == null || n < 0 || n >= 100 || n !== Math.floor(n)) return fmt(n);
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
};
const Words = (n) => { const w = words(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const listOf = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);
const shortName = (name) => name.replace(/ (PD|DPS|SO)$/, "");
const plural = (n, one, many) => (n === 1 ? one : (many || `${one}s`));

/* Colour on the organization maps says how many of our counties can reach
   an organization. That is a magnitude, so it takes the sequential ramp,
   and it belongs to the entity: a filter never repaints a dot. */
function countyBuckets(d) {
  const keys = d.org_map.county_keys;
  const n = keys.length;
  const pop = (c) => { let k = 0; for (let i = 0; i < n; i += 1) if ((c >> i) & 1) k += 1; return k; };
  const step = (k) => RAMP[Math.max(1, Math.min(RAMP.length - 1,
    n <= 1 ? RAMP.length - 1 : Math.round(1 + ((k - 1) * (RAMP.length - 2)) / (n - 1))))];
  const names = (c) => keys.filter((key, i) => (c >> i) & 1).map((key) => d.counties.find((x) => x.key === key).name);
  const label = (k) => (k === n && n > 1 ? `Reached from all ${words(n)} counties` : `Reached from ${words(k)} ${plural(k, "county", "counties")}`);
  return {
    n, pop, names,
    css: (c) => step(pop(c)),
    label: (c) => label(pop(c)),
    legend: Array.from({ length: n }, (_, i) => ({ k: i + 1, css: step(i + 1), label: label(i + 1) })),
  };
}

/* The county filters open on the largest operation, the first county in the
   page's own order (Kent today), the same rule the headline follows. A
   section whose chips exclude that county falls back to all of them. */
function defaultCounty(d, eligible) {
  const first = d.counties[0];
  return first && (!eligible || eligible(first)) ? first.key : "all";
}

/* Freshness, per department: when this ledger last read the portal, how far
   that trails the newest capture of any portal, and the date the portal
   itself printed. Rendered the same way wherever a department is named. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : "never");
function freshness(d, a) {
  if (!a.captured_at) return { text: "never captured", stale: true };
  const cap = a.captured_at.slice(0, 10);
  const behind = Math.round((Date.parse(d.scope.last_capture) - Date.parse(cap)) / 86400000);
  const lag = behind > 0 ? `, ${behind} ${plural(behind, "day")} behind the newest` : "";
  const portal = a.portal_updated ? `, portal dated ${dayLabel(a.portal_updated)}` : "";
  return {
    text: `read ${dayLabel(cap)} ${a.captured_at.slice(11, 16)} UTC${lag}${portal}`, // leak-linter:allow (capture stamp, not a schedule)
    short: `read ${dayLabel(cap)} &middot; new data ${a.last_new_day ? dayLabel(a.last_new_day) : "never"}${behind > 1 ? ` &middot; ${behind} days behind` : ""}`,
    stale: behind > 1,
  };
}

/* Opens a department's card in the profile panel. Assigned by profilePanel
   once it exists; the county band's department names call it. */
let openProfile = () => {};

function bar(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w));
  if (w <= 0) return el("path", { d: "" });
  return el("path", {
    d: `M${x},${y} H${x + w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h - rr} `
      + `a${rr},${rr} 0 0 1 ${-rr},${rr} H${x} Z`,
  });
}

/* Hover layer. Hit targets are separate transparent rects, bigger than the mark. */
function hover(node, html) {
  node.style.cursor = "default";
  node.addEventListener("pointerenter", () => {
    tip.innerHTML = typeof html === "function" ? html() : html;
    tip.classList.add("on");
  });
  node.addEventListener("pointermove", (e) => {
    if (typeof html === "function") tip.innerHTML = html(e);
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  });
  node.addEventListener("pointerleave", () => tip.classList.remove("on"));
}

function table(rows, head) {
  const t = document.createElement("table");
  t.innerHTML = `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
    + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return t;
}

/* A chip row. onToggle receives the clicked value and returns the new
   pressed-set so the caller owns selection rules. */
function chips(host, label, items, isOn, onToggle) {
  const group = document.createElement("div");
  group.className = "ctl-group";
  if (label) {
    const l = document.createElement("span");
    l.className = "ctl-label";
    l.textContent = label;
    group.appendChild(l);
  }
  const render = () => {
    [...group.querySelectorAll(".chip")].forEach((c) => {
      const on = isOn(c.dataset.value);
      c.setAttribute("aria-pressed", on ? "true" : "false");
      c.style.setProperty("--swatch", on ? (c.dataset.swatch || cssvar("--series-1")) : "");
      if (on && c.dataset.swatch) c.style.color = c.dataset.swatch;
      else c.style.color = "";
    });
  };
  items.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `chip${it.strong ? " county" : ""}`;
    b.dataset.value = it.value;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${it.dot === false ? "" : "<i></i>"}<span>${esc(it.label)}</span>`;
    b.addEventListener("click", () => { onToggle(it.value); });
    group.appendChild(b);
  });
  host.appendChild(group);
  group.rerender = render;
  render();
  return group;
}

/* Schematic 51-tile US grid: [row, col]. Not geographic, but neighbours
   are neighbours. */
const GRID = {
  AK: [0, 0], ME: [0, 11],
  VT: [1, 10], NH: [1, 11],
  WA: [2, 1], ID: [2, 2], MT: [2, 3], ND: [2, 4], MN: [2, 5], WI: [2, 6],
  MI: [2, 7], NY: [2, 9], RI: [2, 10], MA: [2, 11],
  OR: [3, 1], NV: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IL: [3, 6],
  IN: [3, 7], OH: [3, 8], PA: [3, 9], NJ: [3, 10], CT: [3, 11],
  CA: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5], KY: [4, 6],
  WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10],
  AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7],
  SC: [5, 8], DC: [5, 9],
  OK: [6, 4], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8],
  HI: [7, 0], TX: [7, 4], FL: [7, 9],
};

const RAMP = ["--ramp-0", "--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4", "--ramp-5"];
const SERIES = ["--series-1", "--series-2", "--series-3"];
const MAX_COMPARE = SERIES.length;

/* Fixed breaks, so the legend is readable and switching counties cannot
   repaint a state into a different class for the same count. */
function rampStep(v) {
  if (!v) return cssvar(RAMP[0]);
  const breaks = [1, 10, 40, 100, 200];
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i += 1;
  return cssvar(RAMP[Math.min(i, RAMP.length - 1)]);
}

/* ------------------------------------------------------------------ */

function masthead(d) {
  const hl = d.headline, sc = d.scope;
  document.getElementById("headline").innerHTML =
    `A plate read in ${esc(hl.county)} is searchable from <em>${words(hl.states)} states</em>.`;
  document.getElementById("dek-n").textContent =
    `This ledger captures that file from every available Michigan portal, ${words(sc.agencies)} agencies across ${words(sc.counties)} counties so far, and keeps what the portals drop.`;
  // Counts only: the county band directly below carries the breakdown.
  document.getElementById("prov-scope").innerHTML =
    `${words(sc.agencies)} agencies in ${words(sc.counties)} Michigan counties`;
  const pct = Math.round((sc.expired_rows / Math.max(sc.searches, 1)) * 100);
  document.getElementById("prov-ledger").innerHTML =
    `Each portal shows a rolling ${words(sc.window_days)}-day file; the ledger holds every capture since ${esc(sc.first_capture)}, `
    + `so <b>${fmt(sc.expired_rows)}</b> of the ${fmt(sc.searches)} searches here (${pct}%) have already fallen off the live portals.`
    + (sc.waiting.length ? ` ${Words(sc.waiting.length)} more Michigan counties have a folder in the archive and no portal with a public audit file yet.` : "");
}

function countyBand(d) {
  const host = document.getElementById("county-band");
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  d.counties.forEach((c) => {
    const div = document.createElement("div");
    div.className = "county-card reveal";
    // The departments inside the county, in the page order (searches, largest
    // first); each name opens that department's card in the panel below.
    // The camera count stands in its own column beside the name, in the
    // display face the county figures use, since it is the figure the
    // portals exist to publish; searches and sharing run underneath the name.
    const rows = c.slugs.map((sl) => byAgency[sl]).filter(Boolean).map((a) =>
      `<li><div class="dept-main"><button type="button" class="dept-link" data-slug="${esc(a.slug)}">${esc(a.name)}</button>`
      + `<span>${fmt(a.searches)} ${plural(a.searches, "search", "searches")} &middot; `
      + `${a.had_out ? `shares to ${fmt(a.out_total)}` : `<span class="muted">no sharing list</span>`}</span>`
      + `<span class="fresh${freshness(d, a).stale ? " stale" : ""}">${freshness(d, a).short}</span></div>`
      + `<div class="dept-cams"><b>${a.cameras == null ? "&ndash;" : fmt(a.cameras)}</b><small>${a.cameras === 1 ? "camera" : "cameras"}</small></div></li>`).join("");
    div.innerHTML = `
      <h3>${esc(c.name)}</h3>
      <p class="sub">${c.agencies} ${plural(c.agencies, "department")} &middot; ${fmt(c.cameras)} cameras</p>
      <div class="county-figs">
        <div><span>${c.publish_out ? fmt(c.out_total) : "&ndash;"}</span><span>${c.publish_out ? "organizations can query it" : "publishes no sharing list"}</span></div>
        <div><span>${c.publish_out ? c.out_states : "&ndash;"}</span><span>states they sit in</span></div>
        <div><span>${fmt(c.searches)}</span><span>searches on record</span></div>
        <div><span>${c.wide_pct}%</span><span>reach past ${fmt(d.wide_reach_threshold)} networks</span></div>
      </div>
      <ul class="county-depts">${rows}</ul>`;
    div.querySelectorAll(".dept-link").forEach((btn) => {
      const a = byAgency[btn.dataset.slug];
      hover(btn, `<b>${esc(a.name)}</b><br><span class="k">${a.had_out ? `${fmt(a.out_total)} organizations can query its cameras across ${a.out_states} states` : "publishes no sharing list"}`
        + ` &middot; ${fmt(a.searches)} searches on record &middot; open its card</span>`);
      btn.addEventListener("click", () => {
        openProfile(a.slug);
        document.getElementById("profile").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    host.appendChild(div);
  });
}

/* Albers Equal Area Conic, the standard projection for the lower 48.
   Alaska and Hawaii are omitted: no organization in the archive is in
   either, so an inset would be two empty boxes. */
function albers(lat, lng) {
  const R = Math.PI / 180;
  const p1 = 29.5 * R, p2 = 45.5 * R, p0 = 37.5 * R, l0 = -96 * R;
  const n = (Math.sin(p1) + Math.sin(p2)) / 2;
  const C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
  const rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
  const theta = n * (lng * R - l0);
  const rho = Math.sqrt(C - 2 * n * Math.sin(lat * R)) / n;
  // Albers y grows northward; SVG y grows downward, so negate it here once
  // rather than in every caller.
  return [rho * Math.sin(theta), -(rho0 - rho * Math.cos(theta))];
}

/* 02 - every organization on a real map of the country */
function geoMap(d) {
  const om = d.org_map;
  const svg = document.getElementById("geomap");
  const W = 900, H = 560, PAD = 14;
  const keys = om.county_keys;
  const HOME = "MI";

  const B = countyBuckets(d);
  const bucketOf = (c) => ({ css: B.css(c), label: B.label(c) });

  // Project once, then fit the whole drawing to the viewBox.
  const rings = [];
  for (const [st, parts] of Object.entries(om.outlines)) {
    parts.forEach((ring) => rings.push({ st, pts: ring.map(([x, y]) => albers(y, x)) }));
  }
  const xs = rings.flatMap((r) => r.pts.map((p) => p[0]));
  const ys = rings.flatMap((r) => r.pts.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((W - PAD * 2) / (x1 - x0), (H - PAD * 2) / (y1 - y0));
  const ox = (W - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (H - (y1 - y0) * k) / 2 - y0 * k;
  const project = (lat, lng) => {
    const [px, py] = albers(lat, lng);
    return [px * k + ox, py * k + oy];
  };

  const placed = om.entries.filter((e) => e.lat != null && e.h !== "none");
  let kind = "all";
  let county = defaultCounty(d, (c) => c.publish_out);
  let dept = "all";
  let selState = null;

  const deptBit = (slug) => 1 << om.agency_keys.indexOf(slug);
  const countyBit = (key) => 1 << keys.indexOf(key);

  const visible = () => placed.filter((e) =>
    (kind === "all" || e.k === kind)
    && (county === "all" || (e.c & countyBit(county)) !== 0)
    && (dept === "all" || (e.a & deptBit(dept)) !== 0));

  const panel = document.getElementById("geo-panel");
  const renderPanel = () => {
    const rows = visible().filter((e) => !selState || e.s === selState);
    const label = selState
      ? (om.outlines[selState] ? selState : selState)
      : "Every state";
    const byKind = {};
    rows.forEach((e) => { (byKind[e.k] ||= []).push(e); });
    const order = Object.keys(byKind).sort((a, b) => byKind[b].length - byKind[a].length);
    panel.innerHTML = `
      <h4 class="geo-panel-head">${selState ? esc(label) : "All jurisdictions"}</h4>
      <p class="geo-panel-sub">${fmt(rows.length)} organization${rows.length === 1 ? "" : "s"}`
      + `${dept === "all" ? "" : ` &middot; shared by ${esc(om.agency_names[dept])}`}`
      + `${dept === "all" && county !== "all" ? ` &middot; ${esc(d.counties.find((c) => c.key === county).name)}` : ""}`
      + `${kind === "all" ? "" : ` &middot; ${esc(om.kind_labels[kind] || kind)}`}`
      + `${selState ? " &middot; click the state again to clear" : " &middot; click a state to narrow"}</p>`
      + (rows.length ? `<div class="geo-list">${order.map((kk) => `
          <div class="geo-kind"><h5>${esc(om.kind_labels[kk] || kk)} (${byKind[kk].length})</h5>
          ${byKind[kk].slice(0, 200).map((e) => `<div class="geo-item">
              <i style="background:${cssvar(bucketOf(e.c).css)}"></i>
              <span>${esc(e.n)}<span class="where"><br>${esc(e.p || "location not resolved")}${e.s ? `, ${esc(e.s)}` : ""}`
              + `${e.h.startsWith("county") ? " (county centroid)" : e.h === "statewide" ? " (statewide)" : e.h === "state" ? " (state centroid, not placed)" : ""}</span></span>
            </div>`).join("")}
          ${byKind[kk].length > 200 ? `<div class="geo-item"><i></i><span class="where">and ${fmt(byKind[kk].length - 200)} more</span></div>` : ""}
          </div>`).join("")}</div>`
        : `<p class="geo-empty">No organizations match this filter here.</p>`);
  };

  const draw = () => {
    svg.textContent = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);

    const shapes = el("g");
    for (const [st, parts] of Object.entries(om.outlines)) {
      const dPath = parts.map((ring) => ring.map(([lng, lat], i) => {
        const [px, py] = project(lat, lng);
        return `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
      }).join(" ") + " Z").join(" ");
      const path = el("path", { d: dPath, class: `state${st === selState ? " sel" : ""}${st === HOME ? " home" : ""}` });
      const n = visible().filter((e) => e.s === st).length;
      hover(path, `<b>${st}</b><br>${fmt(n)} organization${n === 1 ? "" : "s"}`
        + `${kind === "all" ? "" : ` of this kind`}<br><span class="k">click to list them</span>`);
      path.addEventListener("click", () => {
        selState = selState === st ? null : st;
        draw();
        renderPanel();
      });
      shapes.appendChild(path);
    }
    svg.appendChild(shapes);

    const pts = visible().map((e) => ({ e, xy: project(e.lat, e.lng) }));
    const dots = el("g");
    // Draw the widely shared organizations first so the rarer, single-county
    // dots land on top of them.
    pts.sort((a, b) => B.pop(b.e.c) - B.pop(a.e.c)).forEach(({ e, xy }) => {
      dots.appendChild(el("circle", {
        cx: xy[0].toFixed(1), cy: xy[1].toFixed(1),
        r: e.h === "state" || e.h === "statewide" ? 2 : 3.1,
        class: "dot",
        fill: cssvar(bucketOf(e.c).css),
        stroke: cssvar("--ink-dim"), "stroke-width": 0.5,
        "fill-opacity": e.h === "state" ? 0.4 : 0.9,
      }));
    });
    svg.appendChild(dots);

    // One hit layer with a nearest-point lookup, rather than 1,600 rects.
    const hit = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    hit.style.pointerEvents = "none";
    hover(svg, (ev) => {
      if (!ev) return "";
      const r = svg.getBoundingClientRect();
      const mx = ((ev.clientX - r.left) / r.width) * W;
      const my = ((ev.clientY - r.top) / r.height) * H;
      let best = null, bestD = 64;
      pts.forEach((p) => {
        const dd = (p.xy[0] - mx) ** 2 + (p.xy[1] - my) ** 2;
        if (dd < bestD) { bestD = dd; best = p.e; }
      });
      if (!best) return "";
      const near = pts.filter((p) => (p.xy[0] - mx) ** 2 + (p.xy[1] - my) ** 2 < 25).length;
      return `<b>${esc(best.n)}</b><br><span class="k">${esc(om.kind_labels[best.k] || best.k)}`
        + ` &middot; ${esc(best.p || "location not resolved")}${best.s ? `, ${esc(best.s)}` : ""}<br>`
        + `${esc(bucketOf(best.c).label)}: ${esc(B.names(best.c).join(", "))}`
        + `${near > 1 ? `<br>${near - 1} more agency${near - 1 === 1 ? "" : "s"} at this point` : ""}</span>`;
    });
    svg.appendChild(hit);
  };

  const host = document.getElementById("geo-controls");

  const countyCtl = chips(host, "County", [
    { value: "all", label: "All counties", dot: false },
    ...d.counties.filter((c) => c.publish_out).map((c) => ({ value: c.key, label: c.name, dot: false, strong: true })),
  ], (v) => v === county, (v) => {
    county = v;
    // A department outside the chosen county can no longer apply.
    if (dept !== "all" && county !== "all" && om.agency_county[dept] !== county) dept = "all";
    countyCtl.rerender();
    buildDeptChips();
    kindCtl.rerender();
    draw();
    renderPanel();
  });

  const deptHost = document.createElement("div");
  deptHost.className = "ctl-group";
  host.appendChild(deptHost);
  let deptCtl = null;
  function buildDeptChips() {
    deptHost.textContent = "";
    const slugs = om.agency_keys.filter((sl) => county === "all" || om.agency_county[sl] === county);
    const items = [{ value: "all", label: "All departments", dot: false }].concat(
      slugs.map((sl) => {
        const n = placed.filter((e) => (e.a & deptBit(sl)) !== 0).length;
        return { value: sl, label: `${om.agency_names[sl]} (${fmt(n)})`, dot: false };
      }).sort((a, b) => a.label.localeCompare(b.label)));
    deptCtl = chips(deptHost, "Shared by", items, (v) => v === dept, (v) => {
      dept = v;
      // Selecting a department implies its county; keep the two consistent.
      if (dept !== "all") {
        const own = om.agency_county[dept];
        if (county !== "all" && county !== own) county = own;
      }
      deptCtl.rerender();
      countyCtl.rerender();
      kindCtl.rerender();
      draw();
      renderPanel();
    });
  }

  const kindHost = document.createElement("div");
  kindHost.className = "ctl-group";
  host.appendChild(kindHost);
  const kindItems = [{ value: "all", label: "All kinds", dot: false }].concat(
    Object.entries(placed.reduce((m, e) => { m[e.k] = (m[e.k] || 0) + 1; return m; }, {}))
      .sort((a, b) => b[1] - a[1])
      .map(([k2, n]) => ({ value: k2, label: `${om.kind_labels[k2] || k2} (${n})`, dot: false })));
  const kindCtl = chips(kindHost, "Kind", kindItems,
    (v) => v === kind, (v) => { kind = v; kindCtl.rerender(); draw(); renderPanel(); });

  buildDeptChips();

  document.getElementById("geo-legend").innerHTML = B.legend.map((b) =>
    `<span><i style="background:var(${b.css});border-radius:50%"></i> ${b.label}</span>`).join("")
    + `<span><i style="background:var(--rule-bright);border-radius:50%"></i> smaller dot: placed to a state only</span>`;

  draw();
  renderPanel();

  const sheriffs = placed.filter((e) => e.k === "sheriff").length;
  const police = placed.filter((e) => e.k === "police").length;
  const single = placed.filter((e) => B.pop(e.c) === 1);
  const singleBy = d.counties.map((c) => ({ c, rows: single.filter((e) => (e.c >> keys.indexOf(c.key)) & 1) }))
    .sort((a, b) => b.rows.length - a.rows.length);
  const spread = om.agency_keys.map((sl) => ({
    sl,
    n: placed.filter((e) => (e.a & deptBit(sl)) !== 0).length,
    states: new Set(placed.filter((e) => (e.a & deptBit(sl)) !== 0).map((e) => e.s)).size,
  })).sort((a, b) => b.n - a.n);
  /* Distance from the nearest county that can reach each precisely placed
     partner, measured from that county's centroid. A state centroid is not a
     place, so those are left out of the distribution. */
  const miles = (a, b) => {
    const R = 3958.8, r = Math.PI / 180;
    const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const centroid = Object.fromEntries(d.counties.map((c) => [c.key, [c.lat, c.lng]]));
  const nearest = (e) => Math.min(...keys.filter((key, i) => (e.c >> i) & 1).map((key) => miles(centroid[key], [e.lat, e.lng])));
  const precise = om.entries.filter((e) => e.lat != null && /^(place|county)/.test(e.h));
  const dists = precise.map(nearest).sort((a, b) => a - b);
  const q = (p) => Math.round(dists[Math.floor(p * (dists.length - 1))]);
  const within = (m) => dists.filter((x) => x <= m).length;
  const perDept = om.agency_keys.map((sl, i) => {
    const home = centroid[om.agency_county[sl]];
    const ds = precise.filter((e) => (e.a >> i) & 1).map((e) => miles(home, [e.lat, e.lng])).sort((a, b) => a - b);
    return { sl, n: ds.length, median: ds.length ? Math.round(ds[Math.floor(ds.length / 2)]) : null };
  }).filter((x) => x.median != null).sort((a, b) => b.median - a.median);

  document.getElementById("find-geo").innerHTML =
    `The typical partner is not nearby. Of the ${fmt(dists.length)} organizations placed to a city or county, the typical one sits `
    + `<b>${fmt(q(0.5))} miles</b> from the nearest county here that can reach it; ${fmt(within(50))} are within fifty miles and `
    + `${fmt(dists.length - within(500))} are more than five hundred away. `
    + `Per department, measured from its own county, that typical distance runs from ${fmt(perDept[perDept.length - 1].median)} miles for `
    + `${esc(om.agency_names[perDept[perDept.length - 1].sl])} to ${fmt(perDept[0].median)} for ${esc(om.agency_names[perDept[0].sl])}. `
    + `<b>${fmt(om.precise)}</b> of ${fmt(om.entries.length)} organizations resolve to a specific city or county, `
    + `${fmt(om.statewide)} are statewide bodies where a state centroid is the right answer, and `
    + `<b>${fmt(om.imprecise)}</b> could not be placed more precisely than their state. `
    + `The network is overwhelmingly local government: ${fmt(police)} municipal police departments and ${fmt(sheriffs)} county sheriffs. `
    + `<b>${fmt(single.length)}</b> organizations can be reached from one county here and no other; `
    + `${esc(singleBy[0].c.name)} accounts for ${fmt(singleBy[0].rows.length)} of those, `
    + `${esc(singleBy[singleBy.length - 1].c.name)} for ${fmt(singleBy[singleBy.length - 1].rows.length)}. `
    + `Filter by department to see one agency's own network: ${esc(om.agency_names[spread[0].sl])} reaches `
    + `<b>${fmt(spread[0].n)}</b> placed organizations across ${spread[0].states} states, `
    + `${esc(om.agency_names[spread[spread.length - 1].sl])} reaches ${fmt(spread[spread.length - 1].n)} across ${spread[spread.length - 1].states}.`;

  document.getElementById("tbl-orgs").appendChild(
    table(om.entries.map((e) => [
      e.n, e.p || "", e.s || "", om.kind_labels[e.k] || e.k,
      B.names(e.c).map((n) => n.replace(/ County$/, "")).join(", "),
      om.agency_keys.filter((sl, i) => e.a >> i & 1).map((sl) => om.agency_names[sl]).join(", "),
      e.h,
    ]), ["Organization", "Placed at", "State", "Kind", "Reachable from",
      "Shared by", "How it was placed"]));
}

/* 01 - tile grid map, filterable by county */
function mapChart(d) {
  // The tile map itself was retired with the tab layout (the dot map on the
  // same tab says the same thing); the state ranking and its finding stay.
  // Drawing continues into a detached element so nothing else changes.
  const svg = document.getElementById("map") || document.createElementNS(NS, "svg");
  /* A county with no published list has nothing to put on this map, so it
     gets no chip; the finding names it instead. */
  const silentC = d.counties.filter((c) => !c.publish_out);
  const scopes = [{ value: "all", label: "All counties" },
    ...d.counties.filter((c) => c.publish_out).map((c) => ({ value: c.key, label: c.name, strong: true }))];
  let scope = defaultCounty(d, (c) => c.publish_out);

  const countFor = (s) => (scope === "all" ? s.orgs : (s.by_county[scope] || 0));

  const draw = () => {
    svg.textContent = "";
    const cell = 46, gap = 6;
    const w = 12 * (cell + gap), h = 8 * (cell + gap);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    const byCode = Object.fromEntries(d.states.map((s) => [s.code, s]));

    for (const [code, [r, c]] of Object.entries(GRID)) {
      const s = byCode[code];
      const n = s ? countFor(s) : 0;
      const x = c * (cell + gap), y = r * (cell + gap);
      const g = el("g");
      g.appendChild(el("rect", {
        x, y, width: cell, height: cell, rx: 4,
        fill: rampStep(n),
        stroke: code === "MI" ? cssvar("--series-2") : cssvar("--rule"),
        "stroke-width": code === "MI" ? 2 : 1,
      }));
      g.appendChild(el("text", {
        x: x + cell / 2, y: y + cell / 2 + 1,
        "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": 13, "font-weight": 500,
        fill: n >= 40 ? "#04141c" : cssvar(n ? "--ink-2" : "--ink-dim"),
      }, code));
      if (n) {
        g.appendChild(el("text", {
          x: x + cell / 2, y: y + cell - 6, "text-anchor": "middle",
          "font-size": 10.5, fill: n >= 40 ? "#04141c" : cssvar("--ink-2"),
        }, n));
      }
      const each = s
        ? d.counties.map((c2) => `${c2.name}: ${fmt(s.by_county[c2.key] || 0)}`).join("<br>")
        : "";
      hover(g, s && n
        ? `<b>${code}</b> &middot; ${fmt(n)} organization${n === 1 ? "" : "s"}<br><span class="k">${each}</span>`
        : `<b>${code}</b><br><span class="k">no organizations with access${s ? ` from ${scopes.find((x) => x.value === scope).label.toLowerCase()}` : ""}</span>`);
      svg.appendChild(g);
    }

    const ranked = d.states.map((s) => ({ ...s, n: countFor(s) }))
      .filter((s) => s.n > 0).sort((a, b) => b.n - a.n);
    const ranks = document.getElementById("ranks");
    const top = ranked.slice(0, 14);
    const rmax = top.length ? top[0].n : 1;
    ranks.innerHTML = top.map((s) => `<div class="rank-row${s.code === "MI" ? " mi" : ""}">
        <span>${s.code}</span>
        <span><span class="bar" style="width:${Math.max(2, (s.n / rmax) * 100)}%"></span></span>
        <span class="n">${fmt(s.n)}</span></div>`).join("");
    document.getElementById("rank-title").textContent =
      `Organizations with query access, by state${scope === "all" ? "" : ` (${scopes.find((x) => x.value === scope).label})`}`;

    const mi = ranked.find((s) => s.code === "MI");
    const total = scope === "all"
      ? d.orgs_total
      : d.counties.find((c) => c.key === scope).out_total;
    const away = total - (mi ? mi.n : 0);
    const topAway = ranked.find((s) => s.code !== "MI");
    const byStates = d.counties.filter((c) => c.publish_out).sort((a, b) => b.out_states - a.out_states);
    document.getElementById("find-reach").innerHTML = scope === "all"
      ? `Only <b>${fmt(mi.n)}</b> of ${fmt(total)} organizations are in Michigan, and the largest single destination outside it is ${esc(topAway ? topAway.code : "")}. `
        + `Switch to a single county and the shape changes: ${esc(byStates[0].name)} reaches ${byStates[0].out_states} states, `
        + `${esc(byStates[byStates.length - 1].name)} reaches ${byStates[byStates.length - 1].out_states}.`
        + (silentC.length ? ` ${esc(listOf(silentC.map((c) => c.name)))} ${plural(silentC.length, "has", "have")} no portal that publishes a sharing list, so ${plural(silentC.length, "it has", "they have")} no chip here.` : "")
      : `${esc(scopes.find((x) => x.value === scope).label)}: <b>${fmt(total)}</b> organizations across <b>${ranked.length}</b> states, `
        + `${fmt(away)} of them outside Michigan. ${fmt(d.counties.find((c) => c.key === scope).exclusive.count)} can be reached from this county and no other in the archive.`;
  };

  const ctl = chips(document.getElementById("map-controls"), "County",
    scopes, (v) => v === scope, (v) => { scope = v; ctl.rerender(); draw(); });
  draw();

  const cols = d.counties.map((c) => c.name);
  document.getElementById("tbl-states").appendChild(
    table(d.states.map((s) => [s.code, fmt(s.orgs), ...d.counties.map((c) => fmt(s.by_county[c.key] || 0))]),
      ["State", "Combined", ...cols]));

  const scale = document.getElementById("map-scale") || document.createElement("div");
  const labels = ["0", "1–9", "10–39", "40–99", "100–199", "200+"];
  scale.innerHTML = `<span>Organizations</span>`
    + labels.map((l, i) => `<i style="background:var(${RAMP[i]})"></i><span>${l}</span>`).join("");
}

/* 02 - county comparison */
function countyTable(d) {
  const rows = [
    ["Departments with a portal", (c) => fmt(c.agencies)],
    ["Cameras", (c) => fmt(c.cameras)],
    ["Departments publishing a sharing list", (c) => `${fmt(c.publish_out)} of ${fmt(c.agencies)}`],
    ["Organizations that can query it", (c) => (c.publish_out ? fmt(c.out_total) : `<span class="muted">not published</span>`)],
    ["…of those, in Michigan", (c) => (c.publish_out ? fmt(c.out_mi) : "")],
    ["…outside Michigan", (c) => (c.publish_out ? fmt(c.out_away) : "")],
    ["States reached", (c) => (c.publish_out ? fmt(c.out_states) : "")],
    ["Federal organizations", (c) => (c.publish_out ? fmt(c.fed) : "")],
    ["Reachable from this county only", (c) => (c.publish_out ? fmt(c.exclusive.count) : "")],
    ["Organizations it receives from", (c) => (c.publish_in ? fmt(c.in_total) : `<span class="muted">not published</span>`)],
    ["Searches on record", (c) => fmt(c.searches)],
    ["…with no stated reason", (c) => fmt(c.no_reason)],
    ["Median networks per search", (c) => fmt(c.reach_median)],
    ["Share reaching 1,000+ networks", (c) => `${c.wide_pct}%`],
    ["Hotlist hits", (c) => fmt(c.hits)],
  ];
  const t = document.getElementById("county-table");
  t.innerHTML = `<thead><tr><th></th>${d.counties.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead>`
    + `<tbody>${rows.map(([label, f]) => `<tr><td>${esc(label)}</td>`
      + d.counties.map((c) => `<td>${f(c)}</td>`).join("") + `</tr>`).join("")}</tbody>`;

  document.getElementById("county-h2").textContent = `${Words(d.counties.length)} counties, ${words(d.counties.length)} different operations`;
  const listed = d.counties.filter((c) => c.publish_out);
  const byStates = [...listed].sort((a, b) => b.out_states - a.out_states || b.out_total - a.out_total);
  const wide = [...d.counties].sort((a, b) => b.wide_pct - a.wide_pct);
  const singles = d.counties.filter((c) => c.agencies === 1);
  const silent = d.counties.filter((c) => !c.publish_out);
  const top = byStates[0], low = byStates[byStates.length - 1];
  document.getElementById("find-county").innerHTML =
    `${esc(top.name)} reaches <b>${top.out_states}</b> states through ${fmt(top.out_total)} organizations; `
    + `${esc(low.name)} reaches <b>${low.out_states}</b> through ${fmt(low.out_total)}. `
    + `Searches travel furthest from <b>${esc(wide[0].name)}</b>, where ${wide[0].wide_pct}% reach past ${fmt(d.wide_reach_threshold)} networks, `
    + `against ${wide[wide.length - 1].wide_pct}% in ${esc(wide[wide.length - 1].name)}. `
    + (silent.length ? `${esc(listOf(silent.map((c) => c.name)))} ${plural(silent.length, "has", "have")} no portal that publishes a sharing list, so ${plural(silent.length, "its", "their")} reach cannot be measured. ` : "")
    + (singles.length ? `${esc(listOf(singles.map((c) => c.name)))} ${plural(singles.length, "is", "are")} one department each today, so read ${plural(singles.length, "that column", "those columns")} as a department, not a county.` : "");
}

/* 03 - outbound sharing, grouped by county with a county union row */
function sharingChart(d) {
  const svg = document.getElementById("sharing");
  const rowH = 44, headH = 34, padL = 216, padR = 78, padT = 8, w = 900;
  const groups = d.counties.map((c) => ({
    county: c,
    members: d.agencies.filter((a) => a.county_key === c.key)
      .sort((x, y) => y.out_total - x.out_total),
  }));
  const bodyRows = groups.reduce((n, g) => n + g.members.length + 1, 0);
  const h = padT + bodyRows * rowH + groups.length * headH + 14;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const max = Math.max(...d.agencies.map((a) => a.out_total), ...d.counties.map((c) => c.out_total));
  const plot = w - padL - padR;
  const x = (v) => (v / max) * plot;

  let y = padT;
  groups.forEach((g) => {
    svg.appendChild(el("text", {
      x: 0, y: y + 16, "font-size": 11, "letter-spacing": "0.14em",
      fill: cssvar("--ink-dim"),
    }, g.county.name.toUpperCase()));
    svg.appendChild(el("line", {
      x1: 0, x2: w, y1: y + 24, y2: y + 24, stroke: cssvar("--rule"), "stroke-width": 1,
    }));
    y += headH;

    const drawRow = (label, sub, mi, away, total, isUnion) => {
      const bh = isUnion ? 22 : 20;
      svg.appendChild(el("text", {
        x: padL - 12, y: y + bh / 2 + 4, "text-anchor": "end",
        "font-size": isUnion ? 12.5 : 12.5,
        "font-weight": isUnion ? 500 : 400,
        fill: isUnion ? cssvar("--ink") : cssvar("--ink"),
      }, label));
      if (sub) {
        svg.appendChild(el("text", {
          x: padL - 12, y: y + bh / 2 + 19, "text-anchor": "end",
          "font-size": 11.5, fill: cssvar("--ink-2"),
        }, sub));
      }
      const wMi = x(mi), wAway = x(away);
      const m = bar(padL, y, Math.max(wMi - (wAway ? 2 : 0), 0), bh, wAway ? 0 : 4);
      m.setAttribute("fill", cssvar("--series-1"));
      m.setAttribute("fill-opacity", isUnion ? 1 : 0.82);
      hover(m, `<b>${esc(label)}</b><br>${fmt(mi)} Michigan organizations`);
      svg.appendChild(m);
      if (wAway > 0) {
        const aw = bar(padL + wMi, y, wAway, bh, 4);
        aw.setAttribute("fill", cssvar("--series-2"));
        aw.setAttribute("fill-opacity", isUnion ? 1 : 0.82);
        hover(aw, `<b>${esc(label)}</b><br>${fmt(away)} organizations outside Michigan`);
        svg.appendChild(aw);
      }
      svg.appendChild(el("text", {
        x: padL + Math.max(wMi + wAway, 2) + 10, y: y + bh / 2 + 4,
        "font-size": 12, "font-weight": isUnion ? 500 : 400,
        fill: isUnion ? cssvar("--ink") : cssvar("--ink-2"),
      }, fmt(total)));
      y += rowH;
    };

    g.members.forEach((a) => {
      if (a.had_out) { drawRow(a.name, "", a.out_mi, a.out_away, a.out_total, false); return; }
      // A portal with no list is silent, not empty: no bar, and it says so.
      svg.appendChild(el("text", { x: padL - 12, y: y + 14, "text-anchor": "end", "font-size": 12.5, fill: cssvar("--ink") }, a.name));
      svg.appendChild(el("text", { x: padL, y: y + 14, "font-size": 11.5, fill: cssvar("--ink-dim") }, "publishes no sharing list"));
      y += rowH;
    });
    const pub = g.members.filter((a) => a.had_out).length;
    if (pub) {
      drawRow(`${g.county.name} combined`, `${pub} of ${g.members.length} ${plural(g.members.length, "department")} ${plural(pub, "publishes", "publish")}`,
        g.county.out_mi, g.county.out_away, g.county.out_total, true);
    } else {
      svg.appendChild(el("text", { x: padL - 12, y: y + 14, "text-anchor": "end", "font-size": 12.5, "font-weight": 500, fill: cssvar("--ink") }, `${g.county.name} combined`));
      svg.appendChild(el("text", { x: padL, y: y + 14, "font-size": 11.5, fill: cssvar("--ink-dim") }, "no list to combine"));
      y += rowH;
    }
    y += 6;
  });

  /* The contrast the data supports: inside the county with the most portals,
     the department keeping its list in Michigan against the one that does
     not, and how far the union sits above its largest member. */
  const big = [...groups].sort((a, b) => b.members.length - a.members.length)[0];
  const listed = big.members.filter((a) => a.had_out && a.out_total > 0);
  const local = [...listed].sort((a, b) => (a.out_away / a.out_total) - (b.out_away / b.out_total))[0];
  const open = [...listed].sort((a, b) => b.out_away - a.out_away)[0];
  const largest = [...listed].sort((a, b) => b.out_total - a.out_total)[0];
  document.getElementById("find-policy").innerHTML =
    `<b>${esc(local.name)}</b> shares with ${fmt(local.out_total)} organizations${local.out_away ? `, ${fmt(local.out_away)} of them outside Michigan` : " and every one of them is in Michigan"}. `
    + `<b>${esc(open.name)}</b>, in the same county on the same vendor, shares with ${fmt(open.out_total)}, of which ${fmt(open.out_away)} are not. `
    + `Nothing about the cameras differs. The sharing policy does. `
    + `Because the ${words(listed.length)} ${esc(big.county.name)} lists overlap heavily, the county&rsquo;s combined list is ${fmt(big.county.out_total)}, `
    + `${big.county.out_total - largest.out_total < largest.out_total * 0.1 ? "barely above" : "against"} ${esc(largest.name)}&rsquo;s own ${fmt(largest.out_total)}: `
    + `one permissive department effectively sets the county&rsquo;s exposure.`;

  document.getElementById("tbl-sharing").appendChild(
    table([
      ...d.agencies.map((a) => [a.name, a.county, a.had_out ? fmt(a.out_total) : "not published", a.had_out ? fmt(a.out_mi) : "", a.had_out ? fmt(a.out_away) : "", a.had_out ? a.out_states : "", a.had_in ? fmt(a.in_total) : "not published"]),
      ...d.counties.map((c) => [`${c.name} combined`, c.name, fmt(c.out_total), fmt(c.out_mi), fmt(c.out_away), c.out_states, fmt(c.in_total)]),
    ], ["Source", "County", "Shares out to", "Michigan", "Out of state", "States", "Receives from"]));
}

/* 04 - daily trends with a comparison selector */
function trendsChart(d) {
  const t = d.trends;
  const svg = document.getElementById("trend");
  const METRICS = [
    { value: "searches", label: "Searches per day", unit: "searches", int: true },
    { value: "reach_median", label: "Typical reach", unit: "networks", int: true },
    { value: "wide_pct", label: "Share reaching 1,000+", unit: "%", int: false },
  ];
  let metric = "searches";

  /* Colour is held by the entity for as long as it stays selected, so
     deselecting one line never repaints the others. */
  const held = new Map();
  const take = (key) => {
    const used = new Set(held.values());
    const free = SERIES.find((s) => !used.has(s));
    if (free) held.set(key, free);
  };
  const selected = () => [...held.keys()];
  const byKey = Object.fromEntries(t.series.map((s) => [s.key, s]));

  const items = [
    { value: "all", label: "All sources", strong: true },
    ...t.series.filter((s) => s.kind === "county").map((s) => ({ value: s.key, label: s.name, strong: true })),
    ...t.series.filter((s) => s.kind === "agency").map((s) => ({ value: s.key, label: s.name })),
  ];

  const draw = () => {
    svg.textContent = "";
    const m = METRICS.find((x) => x.value === metric);
    const padL = 62, padR = 18, padT = 18, padB = 38, w = 980, h = 340;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const n = t.days.length;
    const X = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

    const scaleFrom = held.size ? selected().map((k) => byKey[k]) : t.series;
    const values = scaleFrom.flatMap((s) => s[metric]).filter((v) => v != null);
    const top = Math.max(...values, 1);
    const nice = metric === "wide_pct" ? 100 : Math.max(10, Math.ceil(top / 10) * 10);
    const Y = (v) => padT + plotH - (v / nice) * plotH;

    // Context lines are drawn from the same scale, so they must be clipped
    // rather than allowed to run off the top when a small source is selected.
    const clipId = "plot-clip";
    const defs = el("defs");
    const clip = el("clipPath", { id: clipId });
    clip.appendChild(el("rect", { x: padL, y: padT, width: plotW, height: plotH }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    // gridlines
    for (let g = 0; g <= 4; g += 1) {
      const v = (nice / 4) * g;
      svg.appendChild(el("line", {
        x1: padL, x2: w - padR, y1: Y(v), y2: Y(v),
        stroke: cssvar("--rule"), "stroke-width": 1,
      }));
      svg.appendChild(el("text", {
        x: padL - 10, y: Y(v) + 4, "text-anchor": "end",
        "font-size": 10.5, fill: cssvar("--ink-dim"),
      }, m.unit === "%" ? `${v.toFixed(0)}%` : fmt(Math.round(v))));
    }

    // date axis, first of month plus every seventh day
    t.days.forEach((day, i) => {
      const dd = day.slice(8);
      if (dd !== "01" && i % 7 !== 0) return;
      svg.appendChild(el("text", {
        x: X(i), y: h - padB + 18, "text-anchor": "middle",
        "font-size": 10.5, fill: cssvar("--ink-dim"),
      }, `${day.slice(5, 7)}/${dd}`));
    });

    // partial edges, marked rather than dropped
    [0, n - 1].forEach((i) => {
      svg.appendChild(el("rect", {
        x: i === 0 ? padL : X(i) - (plotW / (n - 1)) / 2,
        y: padT, width: (plotW / (n - 1)) / 2, height: plotH,
        fill: cssvar("--surface-1"), "fill-opacity": 0.75,
      }));
    });

    const path = (s, key) => {
      const pts = [];
      s[metric].forEach((v, i) => { if (v != null) pts.push([X(i), Y(v)]); });
      if (pts.length < 2) return null;
      return el("path", {
        d: pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
        fill: "none",
        stroke: key ? cssvar(key) : cssvar("--rule-bright"),
        "stroke-width": key ? 2 : 1,
        "stroke-opacity": key ? 1 : 0.55,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      });
    };

    // context first, selected on top, everything clipped to the plot
    const layer = el("g", { "clip-path": `url(#${clipId})` });
    t.series.filter((s) => s.kind === "agency" && !held.has(s.key))
      .forEach((s) => { const p = path(s); if (p) layer.appendChild(p); });
    selected().forEach((k) => { const p = path(byKey[k], held.get(k)); if (p) layer.appendChild(p); });
    svg.appendChild(layer);

    // crosshair
    const cross = el("line", {
      y1: padT, y2: padT + plotH, stroke: cssvar("--ink-dim"),
      "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0,
    });
    svg.appendChild(cross);
    const hit = el("rect", { x: padL, y: padT, width: plotW, height: plotH, fill: "transparent" });
    hit.addEventListener("pointerleave", () => cross.setAttribute("opacity", 0));
    hover(hit, (e) => {
      if (!e) return "";
      const rect = svg.getBoundingClientRect();
      const frac = ((e.clientX - rect.left) / rect.width) * w;
      const i = Math.max(0, Math.min(n - 1, Math.round(((frac - padL) / plotW) * (n - 1))));
      cross.setAttribute("x1", X(i));
      cross.setAttribute("x2", X(i));
      cross.setAttribute("opacity", 1);
      const edge = (i === 0 || i === n - 1)
        ? `<br><span class="k">partial day, not comparable</span>` : "";
      const lines = selected().map((k) => {
        const v = byKey[k][metric][i];
        return `<span style="color:${cssvar(held.get(k))}">&#9679;</span> ${esc(byKey[k].name)}: `
          + `<b>${v == null ? "no searches" : m.int ? fmt(v) : `${v}%`}</b>`;
      }).join("<br>");
      return `<b>${t.days[i]}</b>${edge}<br>${lines || '<span class="k">nothing selected</span>'}`;
    });
    svg.appendChild(hit);
  };

  const metricCtl = chips(document.getElementById("trend-controls"), "Metric",
    METRICS.map((x) => ({ value: x.value, label: x.label, dot: false })),
    (v) => v === metric, (v) => { metric = v; metricCtl.rerender(); draw(); });

  const srcCtl = chips(document.getElementById("trend-controls"), "Compare",
    items, (v) => held.has(v), (v) => {
      if (held.has(v)) held.delete(v);
      else if (held.size < MAX_COMPARE) take(v);
      else return;
      [...srcCtl.querySelectorAll(".chip")].forEach((c) => {
        c.dataset.swatch = held.has(c.dataset.value) ? cssvar(held.get(c.dataset.value)) : "";
      });
      srcCtl.rerender();
      draw();
    });
  // Open on the first county's line and its two busiest departments, so the
  // chart says something before anyone touches it; still within the cap.
  const first = d.counties[0];
  if (first) {
    [`county:${first.key}`, ...first.slugs.slice(0, 2)].filter((k) => byKey[k]).slice(0, MAX_COMPARE).forEach(take);
  }
  [...srcCtl.querySelectorAll(".chip")].forEach((c) => {
    c.dataset.swatch = held.has(c.dataset.value) ? cssvar(held.get(c.dataset.value)) : "";
  });
  srcCtl.rerender();
  draw();

  document.getElementById("trend-note").textContent =
    `${t.days.length} days, ${t.days[0]} to ${t.days[t.days.length - 1]}. `
    + `Up to ${MAX_COMPARE} sources at once; unselected departments stay as grey context. `
    + `The shaded edges are the first and last day, both partial by construction.`;

  // small multiples, every source at a glance
  const host = document.getElementById("sparks");
  const agencySeries = t.series.filter((s) => s.kind === "agency");
  const peak = Math.max(...agencySeries.flatMap((s) => s.searches), 1);
  agencySeries.forEach((s) => {
    const div = document.createElement("div");
    div.className = "spark";
    const total = s.searches.reduce((a, b) => a + b, 0);
    const active = s.searches.filter((v) => v > 0).length;
    div.innerHTML = `<h4>${esc(s.name)}</h4>
      <div class="meta">${fmt(total)} searches &middot; active on ${active} of ${t.days.length} days</div>`;
    const sw = 210, sh = 48;
    const sp = el("svg", { viewBox: `0 0 ${sw} ${sh}`, width: sw, height: sh,
      role: "img", "aria-label": `${s.name} daily searches` });
    const SX = (i) => (i / (t.days.length - 1)) * sw;
    const SY = (v) => sh - 3 - (v / peak) * (sh - 8);
    const pts = s.searches.map((v, i) => `${i ? "L" : "M"}${SX(i).toFixed(1)},${SY(v).toFixed(1)}`).join(" ");
    sp.appendChild(el("path", {
      d: `${pts} L${sw},${sh} L0,${sh} Z`,
      fill: cssvar("--series-1"), "fill-opacity": 0.13, stroke: "none",
    }));
    sp.appendChild(el("path", {
      d: pts, fill: "none", stroke: cssvar("--series-1"),
      "stroke-width": 1.5, "stroke-linejoin": "round",
    }));
    div.appendChild(sp);
    hover(div, `<b>${esc(s.name)}</b><br>${fmt(total)} searches over ${t.days.length} days<br>`
      + `<span class="k">busiest day ${fmt(Math.max(...s.searches))} &middot; all sparklines share one scale</span>`);
    host.appendChild(div);
  });

  // A claim the data can support: which source swings hardest day to day.
  const rank = agencySeries
    .filter((s) => s.searches.reduce((a, b) => a + b, 0) > 200)
    .map((s) => {
      const v = s.searches.slice(1, -1);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
      return { name: s.name, cv: sd / mean, mean };
    }).sort((a, b) => b.cv - a.cv);
  const vol = agencySeries.map((s) => ({ name: s.name, n: s.searches.reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n);
  const top2 = vol[0].n + vol[1].n, rest = vol.slice(2).reduce((a, b) => a + b.n, 0);
  document.getElementById("find-trend").innerHTML =
    `All sparklines share one scale, so the largest sources stand out by volume alone: `
    + `${esc(vol[0].name)} and ${esc(vol[1].name)} ${top2 > rest ? `run more searches than the other ${words(vol.length - 2)} departments combined` : `account for ${Math.round(top2 / (top2 + rest) * 100)}% of all searches`}. `
    + `Among the ${rank.length} sources with enough volume to measure, <b>${esc(rank[0].name)}</b> is the most erratic day to day, `
    + `swinging ${(rank[0].cv * 100).toFixed(0)}% around an average of ${rank[0].mean.toFixed(0)} searches a day, `
    + `while <b>${esc(rank[rank.length - 1].name)}</b> holds to ${(rank[rank.length - 1].cv * 100).toFixed(0)}% around ${rank[rank.length - 1].mean.toFixed(0)}. `
    + `${fmt(t.days.length)} days is enough to see a weekly rhythm and not enough to call a trend.`;
}

/* 05 - who was added and dropped */
function changesList(d) {
  const host = document.getElementById("changes");
  const all = d.sharing_changes;
  let dir = "all";
  let county = "all";

  const dep = document.getElementById("departures");
  dep.innerHTML = d.network_departures.slice(0, 12).map((r) => `
    <div class="dep-row">
      <span class="n">${r.n}&times;</span>
      <span><span class="who">${esc(r.org)}</span>
        <span class="where">dropped by ${esc(r.agencies.join(", "))} &middot; ${r.first.slice(0, 10)} to ${r.last.slice(0, 10)}</span></span>
    </div>`).join("");

  const orgChips = (list, cls) => {
    if (!list.length) return "";
    const show = list.slice(0, 8);
    const rest = list.length - show.length;
    return show.map((o) => `<span class="org ${cls}">${esc(o)}</span>`).join("")
      + (rest > 0 ? `<span class="org more">and ${fmt(rest)} more</span>` : "");
  };

  const render = () => {
    const rows = all.filter((e) => (dir === "all" || e.direction === dir)
      && (county === "all" || e.county_key === county));
    host.innerHTML = rows.map((e) => `
      <div class="change${e.suspect ? " suspect" : ""}">
        <div class="change-when">
          <b>${esc(e.name)}</b>
          <span class="cty">${esc(e.county)}</span><br>
          ${e.at.slice(0, 10)} ${e.at.slice(11, 16)} &middot; ${e.direction === "outbound" ? "can query us" : "we can query them"}
          <div class="change-delta">${fmt(e.before)} &rarr; ${fmt(e.after)}
            ${e.added.length ? `&middot; +${e.added.length}` : ""}${e.removed.length ? ` &middot; &minus;${e.removed.length}` : ""}</div>
          ${e.suspect ? `<span class="flag">capture fault</span>` : ""}
        </div>
        <div>
          ${e.suspect ? `<p class="hint" style="margin:0">${esc(e.suspect_why)}. Shown for completeness and excluded from every count on this page. The names in a fault diff are an artefact of the bad read, so they are not listed.</p>` : ""}
          <div class="orgs">${orgChips(e.added, "add")}${orgChips(e.removed, "rem")}</div>
        </div>
      </div>`).join("") || `<div class="change"><div class="change-when">No changes match this filter.</div></div>`;
  };

  const dirCtl = chips(document.getElementById("change-controls"), "Direction", [
    { value: "all", label: "Both", dot: false },
    { value: "outbound", label: "Who can query us", dot: false },
    { value: "inbound", label: "Who we can query", dot: false },
  ], (v) => v === dir, (v) => { dir = v; dirCtl.rerender(); render(); });

  county = defaultCounty(d);
  const ctyCtl = chips(document.getElementById("change-controls"), "County", [
    { value: "all", label: "All counties", dot: false },
    ...d.counties.map((c) => ({ value: c.key, label: c.name, dot: false, strong: true })),
  ], (v) => v === county, (v) => { county = v; ctyCtl.rerender(); render(); });

  render();

  const real = all.filter((e) => !e.suspect);
  const adds = real.reduce((n, e) => n + e.added.length, 0);
  const rems = real.reduce((n, e) => n + e.removed.length, 0);
  const top = d.network_departures[0];
  document.getElementById("find-changes").innerHTML =
    `<b>${real.length}</b> real changes across ${d.agencies.length} departments in five days of capture: `
    + `${fmt(adds)} organizations added, ${fmt(rems)} removed. `
    + (top ? `<b>${esc(top.org)}</b> was dropped by all ${top.n} portals between ${top.first.slice(0, 10)} and ${top.last.slice(0, 10)}, `
      + `which is what one organization leaving the vendor&rsquo;s network looks like from the outside. ` : "")
    + `${all.length - real.length} further events were capture faults, kept visible above rather than quietly dropped.`;
}

/* 06 - networkCount range per source, grouped by county */
function radiusChart(d) {
  const svg = document.getElementById("radius");
  const groups = d.counties.map((c) => ({
    county: c,
    members: d.agencies.filter((a) => a.county_key === c.key && a.searches > 0)
      .sort((x, y) => y.net_median - x.net_median),
  })).filter((g) => g.members.length);
  const rowH = 42, headH = 30, padL = 168, padR = 92, padT = 28, w = 900;
  const h = padT + groups.reduce((n, g) => n + g.members.length, 0) * rowH + groups.length * headH + 16;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const max = Math.max(...d.agencies.map((a) => a.net_max));
  const plot = w - padL - padR;
  const x = (v) => (v / max) * plot;

  [0, 1500, 3000, 4500, 6000].forEach((tick) => {
    svg.appendChild(el("line", {
      x1: padL + x(tick), x2: padL + x(tick), y1: padT - 8, y2: h - 20,
      stroke: cssvar("--rule"), "stroke-width": 1,
    }));
    svg.appendChild(el("text", {
      x: padL + x(tick), y: padT - 14, "text-anchor": "middle",
      "font-size": 10.5, fill: cssvar("--ink-dim"),
    }, fmt(tick)));
  });
  svg.appendChild(el("text", {
    x: w - padR + 14, y: padT - 14, "font-size": 10.5, fill: cssvar("--ink-dim"),
  }, "median"));

  let y = padT;
  groups.forEach((g) => {
    svg.appendChild(el("text", {
      x: 0, y: y + 12, "font-size": 11, "letter-spacing": "0.14em",
      fill: cssvar("--ink-dim"),
    }, g.county.name.toUpperCase()));
    y += headH;
    g.members.forEach((a) => {
      const cy = y + 10;
      svg.appendChild(el("text", {
        x: padL - 12, y: cy + 4, "text-anchor": "end",
        "font-size": 12.5, fill: cssvar("--ink"),
      }, a.name));
      svg.appendChild(el("line", {
        x1: padL + x(a.net_min), x2: padL + x(a.net_max), y1: cy, y2: cy,
        stroke: cssvar("--rule-bright"), "stroke-width": 2, "stroke-linecap": "round",
      }));
      const iqr = bar(padL + x(a.net_p25), cy - 7, Math.max(x(a.net_p75) - x(a.net_p25), 3), 14, 4);
      iqr.setAttribute("fill", cssvar("--series-1"));
      iqr.setAttribute("fill-opacity", 0.85);
      svg.appendChild(iqr);
      svg.appendChild(el("line", {
        x1: padL + x(a.net_median), x2: padL + x(a.net_median), y1: cy - 11, y2: cy + 11,
        stroke: cssvar("--ground"), "stroke-width": 5,
      }));
      svg.appendChild(el("line", {
        x1: padL + x(a.net_median), x2: padL + x(a.net_median), y1: cy - 10, y2: cy + 10,
        stroke: cssvar("--series-2"), "stroke-width": 2,
      }));
      svg.appendChild(el("text", {
        x: w - padR + 14, y: cy + 4, "font-size": 12, fill: cssvar("--ink-2"),
      }, fmt(a.net_median)));
      const hit = el("rect", { x: padL - 4, y: y - 6, width: plot + 8, height: rowH - 6, fill: "transparent" });
      hover(hit, `<b>${esc(a.name)}</b> &middot; ${esc(a.county)}<br>a typical search reaches <b>${fmt(a.net_median)}</b> networks<br>
        <span class="k">middle half ${fmt(a.net_p25)} to ${fmt(a.net_p75)} &middot; full range ${fmt(a.net_min)} to ${fmt(a.net_max)} &middot; ${fmt(a.searches)} searches</span>`);
      svg.appendChild(hit);
      y += rowH;
    });
  });

  const searching = d.agencies.filter((a) => a.searches > 0);
  const measured = searching.filter((a) => a.searches >= 50).sort((a, b) => b.net_median - a.net_median);
  const hiM = measured[0], loM = measured[measured.length - 1];
  const CEIL = 5900;
  const wide = searching.filter((a) => a.net_max > CEIL);
  document.getElementById("find-radius").innerHTML =
    `A typical <b>${esc(hiM.name)}</b> search queries <b>${fmt(hiM.net_median)}</b> networks. A typical <b>${esc(loM.name)}</b> search queries <b>${fmt(loM.net_median)}</b>. `
    + `The gap is habit rather than capability: <b>${wide.length}</b> of these ${searching.length} departments${wide.includes(loM) ? `, including ${esc(shortName(loM.name))},` : ""} ran at least one search that reached past ${fmt(CEIL)}.`;

  document.getElementById("tbl-radius").appendChild(
    table(searching.map((a) => [a.name, a.county, fmt(a.searches), fmt(a.net_min), fmt(a.net_p25), fmt(a.net_median), fmt(a.net_p75), fmt(a.net_max)]),
      ["Source", "County", "Searches", "Narrowest", "A quarter under", "Typical", "Three quarters under", "Widest"]));
}

/* 07 - stated reason, paired with how far that kind of search travels.
   Two panels sharing one set of row labels, each on its own scale. This is
   deliberately NOT a dual-axis plot: the panels do not overlap. */
function offenseChart(d) {
  const svg = document.getElementById("offense");
  const top = d.offenses.slice(0, 18);
  const rowH = 28, padL = 300, padT = 26, w = 980;
  const countW = 300, gapW = 74, reachW = 190;
  const countX = padL, reachX = padL + countW + gapW;
  const h = padT + top.length * rowH + 16;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const max = top[0].count;
  const total = d.offenses.reduce((s, o) => s + o.count, 0);
  const baseline = d.wide_pct_all;

  const head = (x, label) => svg.appendChild(el("text", {
    x, y: padT - 14, "font-size": 10.5, fill: cssvar("--ink-dim"),
    "letter-spacing": "0.08em",
  }, label));
  head(countX, "SEARCHES");
  head(reachX, `SHARE REACHING ${fmt(d.wide_reach_threshold)}+ NETWORKS`);

  const bx = reachX + (baseline / 100) * reachW;
  svg.appendChild(el("line", {
    x1: bx, x2: bx, y1: padT - 6, y2: padT + top.length * rowH - 8,
    stroke: cssvar("--rule-bright"), "stroke-width": 1, "stroke-dasharray": "3 3",
  }));
  svg.appendChild(el("text", {
    x: bx, y: padT + top.length * rowH + 8, "text-anchor": "middle",
    "font-size": 10.5, fill: cssvar("--ink-dim"),
  }, `all searches ${baseline}%`));

  top.forEach((o, i) => {
    const y = padT + i * rowH;
    const bh = 14;
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 4, "text-anchor": "end",
      "font-size": 12, fill: o.low ? cssvar("--ink") : cssvar("--ink-2"),
    }, o.type.length > 40 ? `${o.type.slice(0, 38)}…` : o.type));

    const b = bar(countX, y, Math.max((o.count / max) * countW, 2), bh, 4);
    b.setAttribute("fill", o.low ? cssvar("--series-2") : cssvar("--series-1"));
    svg.appendChild(b);
    svg.appendChild(el("text", {
      x: countX + (o.count / max) * countW + 10, y: y + bh / 2 + 4,
      "font-size": 11.5, fill: cssvar("--ink-2"),
    }, fmt(o.count)));

    svg.appendChild(el("rect", {
      x: reachX, y: y + 3, width: reachW, height: bh - 6, rx: 2, fill: cssvar("--ramp-0"),
    }));
    const r = bar(reachX, y + 3, Math.max((o.wide_pct / 100) * reachW, 2), bh - 6, 3);
    r.setAttribute("fill", o.wide_pct >= baseline ? cssvar("--series-3") : cssvar("--rule-bright"));
    svg.appendChild(r);
    svg.appendChild(el("text", {
      x: reachX + reachW + 10, y: y + bh / 2 + 4, "font-size": 11.5,
      fill: o.wide_pct >= baseline ? cssvar("--ink") : cssvar("--ink-dim"),
    }, `${o.wide_pct.toFixed(0)}%`));

    const hit = el("rect", { x: 0, y: y - 4, width: w, height: rowH - 2, fill: "transparent" });
    hover(hit, `<b>${esc(o.type)}</b><br>${fmt(o.count)} searches &middot; ${((o.count / total) * 100).toFixed(1)}% of stated reasons<br>
      <span class="k">median reach ${fmt(o.reach_median)} networks &middot; 90th percentile ${fmt(o.reach_p90)}<br>
      ${fmt(o.wide)} of ${fmt(o.reach_n)} reached past ${fmt(d.wide_reach_threshold)}</span>`);
    svg.appendChild(hit);
  });

  const low = d.offenses.filter((o) => o.low).reduce((s, o) => s + o.count, 0);
  const wc = d.offenses.find((o) => o.type === "Welfare Check");
  const al = d.offenses.find((o) => o.type === "Alcohol Offenses (Non-DUI)");
  const hom = d.offenses.find((o) => o.type === "Homicide/Death Investigation");
  document.getElementById("find-offense").innerHTML =
    `<b>${fmt(low)}</b> searches, ${((low / total) * 100).toFixed(1)}% of those with a stated reason, cite something with no obvious criminal predicate. `
    + `The second panel is why that matters: <b>${al.wide_pct.toFixed(0)}%</b> of non-DUI alcohol searches reach past ${fmt(d.wide_reach_threshold)} networks `
    + `and <b>${wc.wide_pct.toFixed(0)}%</b> of welfare checks do, against <b>${hom.wide_pct.toFixed(0)}%</b> for homicide and death investigations. `
    + `One welfare check in ten reaches more than ${fmt(wc.reach_p90)} networks. The least serious categories travel the furthest.`;

  document.getElementById("tbl-offense").appendChild(
    table(d.offenses.map((o) => [
      o.type, fmt(o.count), `${((o.count / total) * 100).toFixed(1)}%`,
      fmt(o.reach_median), fmt(o.reach_p90), `${o.wide_pct.toFixed(1)}%`, o.low ? "yes" : "",
    ]),
    ["Stated reason", "Searches", "Share", "Typical reach", "Nine in ten reach under",
      `Reaching ${fmt(d.wide_reach_threshold)}+`, "No criminal predicate"]));
}

/* 08 - hour x weekday, filterable by county */
function heatChart(d) {
  const svg = document.getElementById("heat");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scopes = [{ value: "all", label: "All counties", dot: false },
    ...d.counties.map((c) => ({ value: c.key, label: c.name, dot: false, strong: true }))];
  let scope = defaultCounty(d);

  const draw = () => {
    svg.textContent = "";
    const grid = scope === "all" ? d.hour_grid : d.counties.find((c) => c.key === scope).hour_grid;
    const cw = 30, ch = 30, gap = 3, padL = 52, padT = 26;
    const w = padL + 24 * (cw + gap), h = padT + 7 * (ch + gap) + 8;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    const flat = grid.flat();
    const max = Math.max(...flat, 1);

    for (let hr = 0; hr < 24; hr += 3) {
      svg.appendChild(el("text", {
        x: padL + hr * (cw + gap) + cw / 2, y: padT - 10,
        "text-anchor": "middle", "font-size": 10.5, fill: cssvar("--ink-dim"),
      }, String(hr).padStart(2, "0")));
    }
    grid.forEach((row, di) => {
      svg.appendChild(el("text", {
        x: padL - 12, y: padT + di * (ch + gap) + ch / 2 + 4,
        "text-anchor": "end", "font-size": 11.5, fill: cssvar("--ink-2"),
      }, days[di]));
      row.forEach((v, hr) => {
        const x = padL + hr * (cw + gap), y = padT + di * (ch + gap);
        const frac = v / max;
        const step = v === 0 ? 0 : Math.min(5, 1 + Math.floor(frac * 4.999));
        const g = el("g");
        g.appendChild(el("rect", {
          x, y, width: cw, height: ch, rx: 3,
          fill: cssvar(RAMP[step]), stroke: cssvar("--rule"), "stroke-width": 1,
        }));
        if (v > 0 && frac > 0.28) {
          g.appendChild(el("text", {
            x: x + cw / 2, y: y + ch / 2 + 3.5, "text-anchor": "middle",
            "font-size": 10.5, fill: step >= 4 ? "#04141c" : cssvar("--ink-2"),
          }, v));
        }
        hover(g, `<b>${days[di]} ${String(hr).padStart(2, "0")}:00</b><br>${fmt(v)} searches<br><span class="k">Eastern local time</span>`);
        svg.appendChild(g);
      });
    });

    let night = 0;
    grid.forEach((row) => row.forEach((v, hr) => { if (hr >= 22 || hr < 6) night += v; }));
    const tot = flat.reduce((s, v) => s + v, 0) || 1;
    let peakDay = 0, peakHr = 0, peak = -1;
    grid.forEach((row, di) => row.forEach((v, hr) => {
      if (v > peak) { peak = v; peakDay = di; peakHr = hr; }
    }));
    const label = scopes.find((x) => x.value === scope).label;
    document.getElementById("find-heat").innerHTML =
      `${esc(label)}: searches track the working day rather than the crime clock. `
      + `The busiest cell is ${days[peakDay]} at ${String(peakHr).padStart(2, "0")}:00 with ${fmt(peak)} searches, `
      + `and <b>${((night / tot) * 100).toFixed(1)}%</b> run between 22:00 and 06:00 local. `
      + `This is the one chart here that needs months of archive before it means much.`;
  };

  const ctl = chips(document.getElementById("heat-controls"), "County",
    scopes, (v) => v === scope, (v) => { scope = v; ctl.rerender(); draw(); });
  draw();

  document.getElementById("heat-scale").innerHTML = `<span>Fewer</span>`
    + RAMP.map((r) => `<i style="background:var(${r})"></i>`).join("") + `<span>More</span>`;
}

/* 10 - transparency: what each portal discloses, and what none of them do */
function transparencySection(d) {
  const tr = d.transparency;
  const t = document.getElementById("trans-table");
  const PK = Object.keys(tr.prohibition_labels);

  const cell = (pct) => pct === 100
    ? `<span class="mark yes">● all rows</span>`
    : pct === 0
      ? `<span class="mark no">○ none</span>`
      : `<span class="mark no">◐ ${pct}%</span>`;

  const VAR = tr.varies;
  const pubCell = (r) => {
    const on = VAR.filter((v) => v.publishers.includes(r.slug)).length;
    const dots = VAR.map((v) => `<i class="${v.publishers.includes(r.slug) ? "on" : ""}" title="${esc(v.label)}"></i>`).join("");
    const dropped = r.dropped.length ? `<br><span class="muted">dropped ${r.dropped.length} on ${esc(r.dropped[0].since.slice(0, 10))}</span>` : "";
    return `<span class="mark ${on === VAR.length ? "yes" : "no"}">${on === VAR.length ? "●" : on ? "◐" : "○"} ${on} of ${VAR.length}</span><span class="dotrow">${dots}</span>${dropped}`;
  };
  t.innerHTML = `<thead><tr>
      <th>Source</th><th>Optional figures</th><th>Search reason</th><th>User column</th>
      <th>Acceptable-use policy</th><th>Limits it puts in writing</th>
    </tr></thead><tbody>`
    + tr.rows.map((r) => `<tr>
        <td>${esc(r.name)}<br><span class="muted" style="font-size:10.5px">${esc(r.county)} &middot; ${fmt(r.searches)} searches</span></td>
        <td>${pubCell(r)}</td>
        <td>${cell(r.reason_pct)}</td>
        <td>${cell(r.user_pct)}</td>
        <td>${r.has_aup ? `<span class="mark yes">● published</span>` : `<span class="mark no">○ none found</span>`}</td>
        <td>${PK.filter((k) => r.prohibitions[k]).length
          ? PK.filter((k) => r.prohibitions[k]).map((k) =>
            `<span class="org add" style="font-size:10.5px">${esc(tr.prohibition_labels[k])}</span>`).join(" ")
          : `<span class="muted">none stated</span>`}</td>
      </tr>`).join("")
    + `</tbody>`;

  const best = tr.rows[0];
  const worst = tr.rows[tr.rows.length - 1];
  const noAup = tr.rows.filter((r) => !r.has_aup);
  const repro = tr.rows.filter((r) => r.prohibitions.reproductive);
  const imm = tr.rows.filter((r) => r.prohibitions.immigration);
  const n = tr.rows.length;
  const changed = tr.changed;
  const byDept = {};
  changed.forEach((c) => { (byDept[c.name] ||= []).push(c); });
  document.getElementById("find-trans").innerHTML =
    `<b>${esc(best.name)}</b> discloses the most: ${best.published} of the ${VAR.length} optional figures, a stated reason on ${best.reason_pct}% of its rows and ${best.prohibition_count} limits in writing. `
    + `<b>${esc(worst.name)}</b> the least, publishing ${worst.published} of the ${VAR.length}, a search reason on ${worst.reason_pct}% of its rows and filling the user column on ${worst.user_pct}%. `
    + (noAup.length ? `${Words(noAup.length)} of the ${words(n)} portals ${plural(noAup.length, "carries", "carry")} no acceptable-use section this archive can find (${esc(listOf(noAup.map((r) => r.name)))}). ` : `Every portal carries an acceptable-use section. `)
    + `<b>${Words(repro.length)}</b> of the ${words(n)}${repro.length ? `, ${esc(listOf(repro.map((r) => r.name)))},` : ""} ${plural(repro.length, "names", "name")} reproductive rights investigations as off limits, `
    + `while ${imm.length === n ? `all ${words(n)}` : `${words(imm.length)} of the ${words(n)}`} name immigration enforcement. `
    + Object.entries(byDept).map(([name, cs]) =>
      `<b>${esc(name)}</b>&rsquo;s portal was rebuilt on ${esc(cs[0].since.slice(0, 10))} and stopped publishing ${esc(listOf(cs.map((c) => c.label.toLowerCase())))}; `
      + `its search audit continues. The lists it published until ${esc(cs[0].last.slice(0, 10))} are what the sharing sections use for it.`).join(" ")
    + (() => {
      // One sentence per caption, not per portal: the same wording on six
      // tiles is one fact.
      const groups = {};
      tr.relabelled.forEach((r) => { (groups[`${r.tile}|${r.reads}|${r.usual}`] ||= []).push(r); });
      return Object.values(groups).map((rs) => {
        const r = rs[0];
        return ` ${esc(listOf(rs.map((x) => x.name)))} ${plural(rs.length, "captions its", "caption their")} ${r.tile} tile `
          + `&ldquo;${esc(r.reads)}&rdquo; where the other portals read &ldquo;${esc(r.usual)}&rdquo;, so that figure is not the same count.`;
      }).join("");
    })();

  const uc = d.user_column;
  const fills = uc.rows.filter((r) => r.filled_pct === 100);
  document.getElementById("user-column").innerHTML =
    `<h4>The user column does not name anyone</h4>`
    + `<p>${fills.length} of the ${uc.rows.length} portals fill a user column on every audit row, and every `
    + `one of them fills it with <span class="quote">${esc(uc.marker)}</span>. The column records that a user `
    + `was attached to the search and refuses to say which, so <b>no portal in this archive identifies an `
    + `officer</b>, not even to a pseudonym that would let two searches be tied to the same person.</p>`
    + `<p>That makes the column above a weaker distinction than it looks. `
    + (uc.blank_portals.length
      ? `${esc(uc.blank_portals.join(" and "))} leaves it empty entirely`
      : "One portal leaves it empty")
    + (uc.partial_portals.length
      ? ` and ${esc(uc.partial_portals.join(" and "))} fills it on `
        + `${uc.rows.find((r) => r.name === uc.partial_portals[0]).filled_pct}% of rows`
      : "")
    + `, which the table reads as more and less disclosure. It is not: none of them disclose an identifier, `
    + `because the field is redacted before it is published. The build fails if that ever stops being true.</p>`;

  document.getElementById("tier-floor-h").textContent = `What all ${words(n)} publish`;
  document.getElementById("tier-floor").innerHTML =
    tr.universal.map(([, label]) => `<li>${esc(label)}</li>`).join("");
  document.getElementById("tier-varies").innerHTML =
    VAR.map((v) => `<li>${esc(v.label)}<span>${v.publishers.length} of ${n}`
      + `${v.silent.length ? `; not ${esc(listOf(v.silent.map((sl) => tr.rows.find((r) => r.slug === sl).name)))}` : ""}</span></li>`).join("");
  document.getElementById("tier-absent").innerHTML =
    tr.absent.map(([label, why]) => `<li>${esc(label)}<span>${esc(why)}</span></li>`).join("");

  const mostShared = [...d.agencies].sort((a, b) => b.out_total - a.out_total)[0];
  document.getElementById("one-way").innerHTML = `
    <h4>The audit only looks one way</h4>
    <p>Each portal offers a downloadable log of searches <em>its own officers ran</em>. It has the timestamp,
    the reach, and usually the stated reason. That is the transparency people point to.</p>
    <p>The ${fmt(d.orgs_total)} outside organizations can also query these cameras. Those queries appear in no
    public log anywhere on any of these portals. ${esc(mostShared.name)} is the most-shared department here:
    its audit covers ${fmt(mostShared.searches)} searches by its own officers, while
    ${fmt(mostShared.out_total)} outside agencies hold access to the same cameras with no public log at all.
    The published audit describes the smaller half of the activity.</p>
    <p class="quote">"All system access requires a valid law enforcement reason. All system activity is
    routinely audited. All system access is stored indefinitely." The audit is real and it is stored
    indefinitely. The public gets thirty days of one direction of it.</p>`;

  const pp = d.policy_vs_practice;
  const conflict = pp.filter((r) => r.prohibits && r.traffic > 0);
  const nolimit = pp.filter((r) => !r.prohibits && r.traffic > 0);
  document.getElementById("policy-practice").innerHTML = `
    <h4>Where the policy and the log disagree</h4>
    <p>${Words(pp.filter((r) => r.prohibits).length)} of the ${words(pp.length)} name traffic enforcement as a prohibited use. Their own audit logs contain searches
    whose stated reason is a traffic infraction.</p>
    ${pp.filter((r) => r.prohibits || r.traffic).map((r) => `
      <div class="pp-row">
        <span>${esc(r.name)}</span>
        <span class="${r.prohibits ? "yes" : "no"}">${r.prohibits ? "prohibits traffic enforcement" : "no stated prohibition"}</span>
        <span>${fmt(r.traffic)} traffic searches</span>
      </div>`).join("")}
    <p style="margin-top:1rem">This is two of a department's own disclosures side by side, not a proven breach.
    A traffic infraction can arise inside a criminal investigation, and the portal never publishes the
    narrative that would settle which it was. That is the point: the department publishes the rule and a
    number, and withholds the one field that would let anyone check.</p>
    ${conflict.length ? `<p><b>${conflict.map((r) => esc(r.name)).join(" and ")}</b> publish the prohibition and the searches.
      ${nolimit.length ? `<b>${esc(nolimit[0].name)}</b> publishes no prohibition and logged the most of any department, ${fmt(nolimit[0].traffic)}.` : ""}</p>` : ""}`;
}

/* 11 - the size of the whole network, measured from the search audit */
function networkSize(d) {
  const ns = d.network_size;
  const svg = document.getElementById("netsize");
  if (!ns.series.length) return;

  const days = [...new Set(ns.series.flatMap((r) => r.days))].sort();
  const padL = 64, padR = 18, padT = 20, padB = 38, W = 980, H = 300;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const X = (day) => padL + (days.indexOf(day) / (days.length - 1)) * plotW;
  const all = ns.series.flatMap((r) => r.ceiling);
  const lo = Math.floor(Math.min(...all) / 200) * 200 - 200;
  const hi = Math.ceil(Math.max(...all) / 200) * 200;
  const Y = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;

  for (let g = 0; g <= 4; g += 1) {
    const v = lo + ((hi - lo) / 4) * g;
    svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: Y(v), y2: Y(v),
      stroke: cssvar("--rule"), "stroke-width": 1 }));
    svg.appendChild(el("text", { x: padL - 10, y: Y(v) + 4, "text-anchor": "end",
      "font-size": 10.5, fill: cssvar("--ink-dim") }, fmt(Math.round(v))));
  }
  days.forEach((day, i) => {
    if (i % 5 !== 0 && i !== days.length - 1) return;
    svg.appendChild(el("text", { x: X(day), y: H - padB + 18, "text-anchor": "middle",
      "font-size": 10.5, fill: cssvar("--ink-dim") }, `${day.slice(5, 7)}/${day.slice(8)}`));
  });

  ns.series.forEach((r, i) => {
    const colour = cssvar(SERIES[i % SERIES.length]);
    const pts = r.days.map((day, j) => [X(day), Y(r.ceiling[j])]);
    svg.appendChild(el("path", {
      d: pts.map((p, j) => `${j ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
      fill: "none", stroke: colour, "stroke-width": 2,
      "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
    pts.forEach((pt, j) => {
      const g = el("g");
      g.appendChild(el("circle", { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: 3,
        fill: colour, stroke: cssvar("--ground"), "stroke-width": 1 }));
      hover(g, `<b>${esc(r.name)}</b><br>${r.days[j]}<br>`
        + `<span class="k">could reach ${fmt(r.ceiling[j])} networks that day</span>`);
      svg.appendChild(g);
    });
  });

  document.getElementById("net-legend").innerHTML = ns.series.map((r, i) =>
    `<span><i style="background:var(${SERIES[i % SERIES.length]})"></i> ${esc(r.name)}</span>`).join("")
    + `<span>widest search run each day, of ${fmt(ns.threshold)}+ networks</span>`;

  const a = ns.series[0], b = ns.series[1];
  const worst = ns.agreement.length
    ? Math.max(...ns.agreement.map((x) => Math.abs(x.diff))) : 0;
  document.getElementById("find-net").innerHTML =
    `<b>${esc(a.name)}</b> could reach ${fmt(a.first)} networks at the start of the archive and ${fmt(a.last)} at the end, `
    + `a loss of <b>${fmt(-a.change)}</b> in ${a.span_days} days, or ${Math.abs(a.slope).toFixed(1)} a day. `
    + (b ? `<b>${esc(b.name)}</b> measured the same thing independently and got ${Math.abs(b.slope).toFixed(1)} a day, `
      + `agreeing to within ${fmt(worst)} networks on all ${ns.agreement.length} days both ran a full-scope search. ` : "")
    + `That is a <b>${(Math.abs(a.change) / a.first * 100).toFixed(1)}%</b> contraction in a month, and it is not one department&rsquo;s story: `
    + `${esc(a.name)}${b ? ` and ${esc(b.name)}` : ""} share with almost entirely different sets of agencies and still see the same national pool draining at the same rate.`;

  const ov = ns.overlap;
  document.getElementById("net-limit").innerHTML = `
    <h4>Can this tell us which agency left? No, and the reason matters</h4>
    <p>It is tempting to read a drop in the ceiling as a specific agency leaving. It cannot be, for two reasons.</p>
    <p>The ceiling counts <em>networks</em>, not organizations, and it counts the whole pool rather than any one
    department's partners. It falls by about ${Math.abs(a.slope).toFixed(0)} a day. The sharing-list diffs, the only
    thing that can put a name to a departure, can name two or three a day.</p>
    ${ov.length ? `<p>Where both signals exist, they do not move together:</p>
      ${ov.map((o) => `<div class="pp-row">
        <span>${o.day}</span>
        <span class="${o.delta != null && o.delta < -20 ? "yes" : "no"}">${o.delta == null ? "first day" : `ceiling ${o.delta > 0 ? "+" : ""}${o.delta}`}</span>
        <span>${o.named} organizations named</span>
      </div>`).join("")}
      <p style="margin-top:1rem">${esc(ov.filter((o) => o.delta != null).slice(0, 2).map((o, i) =>
        `${i ? "then " : ""}${Words(o.named).toLowerCase()} named departures alongside a ${words(Math.abs(o.delta))}-network ${o.delta < 0 ? "drop" : "rise"}`).join(", "))}.
      The two are measuring different populations, and no arithmetic joins them.</p>` : ""}
    <p><b>What would work.</b> The ceiling is free: it sits in every search row, every day. The sharing list is
    captured a few times a day. Run both long enough and you will eventually get days where exactly one
    organization leaves and the ceiling moves by a known amount, and that amount is how many networks that
    organization was contributing. There are ${ov.length} days of overlap so far. This needs months, not days,
    and it is the strongest argument for leaving the capture running.</p>`;
}

/* ------------------------------------------------------------------ */

function footerNotes(d) {
  const span = (a, key) => {
    const vals = a.series.map((s) => s[key]).filter((v) => v != null);
    return vals.length > 1 ? { first: vals[0], last: vals[vals.length - 1] } : null;
  };
  const withSeries = d.agencies.filter((a) => a.series.length > 1);
  const veh = withSeries.map((a) => ({ a, s: span(a, "vehicles") })).filter((x) => x.s);
  const down = veh.filter((x) => x.s.last < x.s.first).length;
  const real = d.sharing_changes.filter((e) => !e.suspect);
  const stamps = d.agencies.flatMap((a) => a.series.map((s) => s.at)).sort();
  const spanDays = Math.round((Date.parse(stamps[stamps.length - 1]) - Date.parse(stamps[0])) / 86400000);
  const widest = [...d.network_departures].sort((a, b) => b.n - a.n)[0];
  const bits = [
    `In ${fmt(spanDays)} days of capture the archive recorded <b>${real.length}</b> changes to sharing lists that the live portals do not show`
    + (widest ? `, including one organization dropped by ${words(widest.n)} portals in ${words(widest.span_days + 1)} ${plural(widest.span_days + 1, "day")}.` : "."),
  ];
  if (veh.length) {
    bits.push(`The unique-vehicle counters move both ways over the same span, falling for ${down} of ${veh.length} departments, `
      + `which is how you can tell the figure is a rolling window and not a running total.`);
  }
  const faults = d.sharing_changes.length - real.length;
  if (faults) {
    bits.push(`It also caught ${faults} capture ${plural(faults, "fault")}, where a portal read returned page markup instead of the sharing list and recovered hours later. `
      + `A single reading would have taken the fault for the truth.`);
  }
  document.getElementById("foot-archive").innerHTML = bits.join(" ");
  document.getElementById("foot-unresolved").textContent =
    `${d.unresolved_orgs.length} of ${fmt(d.orgs_total)} organizations carry no resolvable state and are excluded from the map and the state ranking.`;
  document.getElementById("foot-built").innerHTML =
    `Built ${d.generated_at.replace("T", " ").replace("Z", " UTC")} from ` // leak-linter:allow (build stamp, not a schedule)
    + `<a href="${esc(d.archive_repo)}/commit/${esc(d.archive_commit)}">archive commit ${esc(d.archive_commit)}</a>`
    + `${d.archive_commit_at ? ` of ${esc(d.archive_commit_at.slice(0, 10))}` : ""}. `
    + `The archive itself is public: <a href="${esc(d.archive_repo)}">${esc(d.archive_repo.replace("https://", ""))}</a>.`;
  document.getElementById("gen").textContent = `archive read ${d.generated_at.slice(0, 10)}`;
}

/* --- department profile, a re-view of everything else on one card ---- */

function profilePanel(d) {
  const host = document.getElementById("profile-controls");
  const body = document.getElementById("profile-body");
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const hit = Object.fromEntries(d.exposure.hit_rate.map((r) => [r.slug, r]));
  const rec = Object.fromEntries(d.exposure.reciprocity.map((r) => [r.slug, r]));
  const pos = Object.fromEntries(d.posture.rows.map((r) => [r.slug, r]));
  const bur = Object.fromEntries(d.bursts.rows.map((r) => [r.slug, r]));
  const tra = Object.fromEntries(d.transparency.rows.map((r) => [r.slug, r]));
  const events = {};
  d.sharing_changes.forEach((c) => {
    if (c.suspect) return;
    events[c.slug] = (events[c.slug] || 0) + (c.added || []).length + (c.removed || []).length;
  });

  let open = null;
  // One chip group per county, in the page order, so the departments read as
  // a breakdown of each county rather than one flat row of thirteen.
  const ctls = [];
  const select = (v) => { open = v; ctls.forEach((c) => c.rerender()); render(); };
  d.counties.forEach((c) => {
    const items = c.slugs.filter((sl) => byAgency[sl]).map((sl) => ({ value: sl, label: byAgency[sl].name, dot: false }));
    ctls.push(chips(host, c.name, items, (v) => v === open, (v) => select(open === v ? null : v)));
  });
  openProfile = (slug) => select(slug);

  function fig(label, value, note) {
    return `<div class="prof-fig"><span>${esc(label)}</span>`
      + `<span>${value}${note ? ` <small>${note}</small>` : ""}</span></div>`;
  }

  function render() {
    if (!open) {
      body.innerHTML = '<p class="hint" style="margin:0">'
        + "Pick a department to pull everything this page knows about it onto one card.</p>";
      return;
    }
    const a = byAgency[open];
    const h = hit[open] || {}, r = rec[open] || {}, p = pos[open] || {};
    const b = bur[open] || {}, t = tra[open] || {};
    const topKind = (d.fingerprint.top[open] || [])[0];
    const rate = h.per_1k == null ? "not shown"
      : `${h.per_1k}${h.comparable ? "" : "<small> not comparable</small>"}`;
    body.innerHTML = `<div class="prof-card">`
      + `<h3>${esc(a.name)}</h3>`
      + `<p class="prof-sub">${esc(a.county)} &middot; ${fmt(a.cameras)} LPR cameras &middot; `
      + `${fmt(a.searches)} searches in the archive &middot; last ${esc(freshness(d, a).text)}</p>`
      + `<div class="prof-figs">`
      + fig("Shares out to", a.had_out ? fmt(a.out_total) : "not published", a.had_out ? "organizations" : "")
      + fig("Can query back", a.had_in ? fmt(a.in_total) : "not published", a.had_in && r.mutual != null ? `${fmt(r.mutual)} mutual` : "")
      + fig("One-way outward", r.only_out != null ? fmt(r.only_out) : "not ranked", r.only_out != null ? "cannot query them" : "needs both lists")
      + fig("Typical reach", fmt(p.median), p.median_frac != null ? `${p.median_frac}% of its own widest` : "")
      + fig("Widest search", fmt(p.ceiling), "networks")
      + fig("Hotlist matches", rate, "per 1,000 vehicles")
      + fig("Vehicles seen", a.vehicles != null ? fmt(a.vehicles) : (a.dropped.some((x) => x.field === "vehicles") ? "no longer published" : "not published"), a.vehicles != null ? "last 30 days" : "")
      + fig("Sustained runs", fmt(b.bursts), b.largest ? `largest ${b.largest}` : "none")
      + fig("Stated reason given", `${t.reason_pct}%`, "of searches")
      + fig("Uses named off limits", fmt(t.prohibition_count), "of 5")
      + fig("Sharing changes seen", fmt(events[open] || 0), "since capture began")
      + `</div>`
      + (topKind
        ? `<p class="prof-note">Its most common stated reason is <b>${esc(topKind.type)}</b> `
          + `at ${topKind.pct}% of searches. `
          + (p.pct ? `${p.pct.own}% of its searches touched only its own cameras.` : "")
          + `</p>`
        : "")
      + `</div>`;
  }
  render();
}

/* --- organization search over the whole outbound network ------------- */

function orgSearch(d) {
  const om = d.org_map;
  const input = document.getElementById("org-q");
  const note = document.getElementById("org-q-note");
  const out = document.getElementById("org-results");
  const LIMIT = 24;
  const B = countyBuckets(d);
  const keyed = om.entries.map((e) => ({
    e, hay: `${e.n} ${e.p || ""} ${e.s || ""}`.toLowerCase(),
  }));

  /* Outbound only: this indexes who can query these cameras. The inbound
     lists are a different population and are not searchable here, so the note
     says so rather than letting a miss read as a bug. */
  const blurb = `${fmt(om.entries.length)} organizations with access to these cameras, `
    + `across ${d.states_total} states. Type at least two characters.`;
  note.textContent = blurb;

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      out.innerHTML = "";
      note.textContent = blurb;
      return;
    }
    const hits = keyed.filter((k) => k.hay.includes(q)).map((k) => k.e);
    note.textContent = hits.length
      ? `${fmt(hits.length)} match${hits.length === 1 ? "" : "es"}`
        + (hits.length > LIMIT ? `, showing the first ${LIMIT}` : "")
      : "No organization matches that.";
    out.innerHTML = hits.slice(0, LIMIT).map((e) => {
      const via = om.agency_keys.filter((sl, i) => (e.a >> i) & 1).map((sl) => om.agency_names[sl]);
      const where = [e.p, e.s].filter(Boolean).join(", ");
      return `<div class="org-hit">`
        + `<i style="background:var(${B.css(e.c)})" title="${esc(B.label(e.c))}"></i>`
        + `<span><b>${esc(e.n)}</b>`
        + `<span class="where">${esc(om.kind_labels[e.k] || e.k)}`
        + `${where ? ` &middot; ${esc(where)}` : ""}`
        + `${e.h === "none" || e.h === "state" ? " &middot; not placed precisely" : ""}</span>`
        + `<span class="via">Can query: ${via.length ? esc(via.join(", ")) : "no current portal"}</span>`
        + `</span></div>`;
    }).join("");
  };
  input.addEventListener("input", draw);
  draw();
}

/* 05 - one-way access, and what the cameras flag */

function exposureSection(d) {
  const rows = d.exposure.reciprocity;
  const svg = document.getElementById("recip");
  const rowH = 40, padL = 168, padR = 64, padT = 10, w = 900;
  const h = padT + rows.length * rowH + 16;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const total = (r) => r.mutual + r.only_out + r.only_in;
  const max = Math.max(...rows.map(total));
  const plot = w - padL - padR;
  const x = (v) => (v / max) * plot;

  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const bh = 20;
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 4, "text-anchor": "end", "font-size": 12.5,
      fill: cssvar("--ink"),
    }, r.name));
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 18, "text-anchor": "end", "font-size": 11,
      fill: cssvar("--ink-dim"),
    }, r.county));

    const segs = [
      { v: r.mutual, css: "--series-1", label: "mutual" },
      { v: r.only_out, css: "--series-2", label: "can query us, we cannot query them" },
      { v: r.only_in, css: "--series-3", label: "we can query them, they cannot query us" },
    ];
    let cx = padL;
    segs.forEach((s, si) => {
      if (s.v <= 0) return;
      const sw = x(s.v);
      const last = segs.slice(si + 1).every((z) => z.v <= 0);
      const m = bar(cx, y, Math.max(sw - (last ? 0 : 2), 0), bh, last ? 4 : 0);
      m.setAttribute("fill", cssvar(s.css));
      hover(m, `<b>${esc(r.name)}</b><br>${fmt(s.v)} ${s.label}`);
      svg.appendChild(m);
      cx += sw;
    });
    svg.appendChild(el("text", {
      x: cx + 10, y: y + bh / 2 + 4, "font-size": 12, fill: cssvar("--ink-2"),
    }, fmt(total(r))));
  });

  /* rows arrive sorted by (one-way outward minus one-way inward), so the two
     ends of the array ARE the two extremes this paragraph is about. Naming
     slugs here would let the prose drift from the data. */
  const gv = rows[0];
  const wk = rows[rows.length - 1];
  const mutualShare = Math.round(
    rows.reduce((n, r) => n + r.mutual, 0) / rows.reduce((n, r) => n + total(r), 0) * 100);
  const excl = d.exposure.reciprocity_excluded;
  document.getElementById("find-recip").innerHTML =
    `Across the ${words(rows.length)} departments that publish both lists only <b>${mutualShare}%</b> of sharing relationships run both ways`
    + (excl.length ? ` (${esc(listOf(excl.map((r) => r.name)))} ${plural(excl.length, "publishes", "publish")} one list or neither and cannot be ranked). ` : ". ")
    + `<b>${esc(gv.name)}</b> is the extreme: ${fmt(gv.out)} organizations can query its cameras and it can `
    + `query ${fmt(gv.inb)} back, leaving <b>${fmt(gv.only_out)}</b> that see it and that it cannot see. `
    + `<b>${esc(wk.name)}</b> sits at the other end, querying ${fmt(wk.only_in)} organizations that cannot query it. `
    + `This is not ${fmt(gv.only_out)} separate decisions. `
    + (() => {
      const bu = d.bundles;
      const gvb = bu.rows.find((r) => r.slug === gv.slug);
      const top = bu.blocks.slice(0, 2);
      return `Grouping every organization by the exact set of these departments that share with it finds `
        + top.map((b) => `<b>${fmt(b.n)}</b> shared by exactly ${b.members.map((m) => esc(m.replace(/ (PD|DPS|SO)$/, ""))).join(", ")}`).join(" and ")
        + ` and by nobody else here. Blocks like that are what a network membership looks like from outside: joining one `
        + `grants everyone already in it access at once. Those two blocks alone hold ${gvb.pct_top2}% of ${esc(gv.name)}&rsquo;s `
        + `one-way partners, and the ${bu.blocks.length} blocks of ${fmt(bu.min_size)} or more organizations hold ${gvb.pct}%`
        + (bu.rows.filter((r) => r.pct != null && r.pct >= 80).length > bu.rows.length / 2 ? `, a share above 80% for most of the ${words(bu.rows.length)}` : "")
        + `. The portals never name a network, so this is as close as the archive gets, and the asymmetry is real either way.`;
    })();

  /* hotlist match rate */
  const hits = d.exposure.hit_rate.filter((r) => r.per_1k != null);
  const svg2 = document.getElementById("hitrate");
  const rh = 34, pl = 168, pr = 96, pt = 8, w2 = 900;
  const h2 = pt + hits.length * rh + 14;
  svg2.setAttribute("viewBox", `0 0 ${w2} ${h2}`);
  svg2.setAttribute("width", w2);
  const hmax = Math.max(...hits.map((r) => r.per_1k));
  const plot2 = w2 - pl - pr;

  hits.forEach((r, i) => {
    const y = pt + i * rh;
    const bh = 18;
    svg2.appendChild(el("text", {
      x: pl - 12, y: y + bh / 2 + 4, "text-anchor": "end", "font-size": 12.5,
      fill: r.comparable ? cssvar("--ink") : cssvar("--ink-2"),
    }, r.name));
    const bw = (r.per_1k / hmax) * plot2;
    const m = bar(pl, y, bw, bh, 4);
    if (r.comparable) {
      m.setAttribute("fill", cssvar("--series-1"));
    } else {
      m.setAttribute("fill", cssvar("--ramp-1"));
      m.setAttribute("stroke", cssvar("--rule-bright"));
      m.setAttribute("stroke-dasharray", "3 3");
    }
    hover(m, `<b>${esc(r.name)}</b><br>${r.per_1k} matches per 1,000 vehicles`
      + `<br><span class="k">${fmt(r.hits)} alerts over ${fmt(r.vehicles)} vehicles</span>`
      + (r.comparable ? "" : `<br><span class="k">${esc(r.scope)}</span>`));
    svg2.appendChild(m);
    svg2.appendChild(el("text", {
      x: pl + bw + 10, y: y + bh / 2 + 4, "font-size": 12,
      fill: r.comparable ? cssvar("--ink-2") : cssvar("--ink-dim"),
    }, r.comparable ? String(r.per_1k) : `${r.per_1k} (different basis)`));
  });

  const ranked = hits.filter((r) => r.comparable);
  const top = ranked[0], bot = ranked[ranked.length - 1];
  const perCam = ranked.map((r) => r.per_camera).filter(Boolean);
  const unrated = d.exposure.hit_rate.filter((r) => r.per_1k == null);
  document.getElementById("find-hits").innerHTML =
    (unrated.length ? `${esc(listOf(unrated.map((r) => r.name)))} ${plural(unrated.length, "publishes", "publish")} no vehicle or hit count today and ${plural(unrated.length, "is", "are")} not drawn. ` : "")
    + `<b>${esc(top.name)}</b> records ${top.per_1k} hotlist matches per thousand vehicles; `
    + `<b>${esc(bot.name)}</b> records ${bot.per_1k}, a <b>${d.exposure.spread}x</b> spread. `
    + `It is not that the busy departments see more cars: vehicles per camera runs from `
    + `${fmt(Math.min(...perCam))} to ${fmt(Math.max(...perCam))} and the ranking does not follow it. `
    + `What this measures is matches per vehicle seen, and the two sides of that fraction are not the same `
    + `kind of count: an alert is an event, so one flagged car passing thirty cameras in a month is thirty `
    + `alerts and one vehicle. A hotlist is mostly stolen vehicles and outstanding warrants, so a camera `
    + `watching a road with more flagged traffic on it will match more often, and a denser network will `
    + `count the same car more times. `
    + `That is a statement about the roads, not about how any department uses the system, and the portals `
    + `publish nothing that would separate the two.`;

  document.getElementById("hit-caveat").innerHTML =
    `<h4>One of these is not like the others</h4>`
    + `<p>${esc((hits.find((r) => !r.comparable) || {}).name || "")} labels the same counter `
    + `&ldquo;Total Hotlist Alerts (Includes KCSO and Nationwide Partners)&rdquo;, where every other portal says `
    + `&ldquo;Number of Hotlist Hits&rdquo;. That is a wider numerator over the same denominator, so its rate is `
    + `drawn but not ranked. Two departments using the same vendor template can publish differently scoped `
    + `numbers under visually identical tiles, which is only visible if you read the label rather than the figure.</p>`;

  document.getElementById("tbl-exposure").appendChild(
    table([
      ...d.exposure.reciprocity.map((r) => {
        const hr = d.exposure.hit_rate.find((x) => x.slug === r.slug) || {};
        return [r.name, r.county, fmt(r.out), fmt(r.inb), fmt(r.mutual), fmt(r.only_out),
          fmt(r.only_in), hr.per_1k == null ? "not shown" : String(hr.per_1k),
          hr.comparable === false ? "different basis" : ""];
      }),
      ...excl.map((r) => {
        const hr = d.exposure.hit_rate.find((x) => x.slug === r.slug) || {};
        return [r.name, r.county, "", "", "", "", "", hr.per_1k == null ? "not shown" : String(hr.per_1k), `does not publish ${r.missing}`];
      }),
    ], ["Department", "County", "Shares out to", "Can query", "Mutual",
      "One-way outward", "One-way inward", "Matches per 1,000", "Note"]));
}

/* 10 - search posture and offence fingerprint */

function postureSection(d) {
  const p = d.posture;
  const svg = document.getElementById("posture");
  const rowH = 42, padL = 168, padR = 120, padT = 10, w = 900;
  const h = padT + p.rows.length * rowH + 14;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const plot = w - padL - padR;
  const shade = ["--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4", "--ramp-5"];
  /* A department whose widest search is 153 networks cannot lead a chart
     about restraint, so the ones measured against the whole pool sort first. */
  const order = [...p.rows].sort((x, y) =>
    (y.ceiling >= 5000) - (x.ceiling >= 5000) || y.median_frac - x.median_frac);

  document.getElementById("posture-legend").innerHTML = p.tiers.map((t, i) =>
    `<span><i style="background:var(${shade[i]})"></i> ${esc(t.label)}</span>`).join("");

  order.forEach((r, i) => {
    const y = padT + i * rowH;
    const bh = 20;
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 4, "text-anchor": "end", "font-size": 12.5,
      fill: cssvar("--ink"),
    }, r.name));
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 18, "text-anchor": "end", "font-size": 11,
      fill: cssvar("--ink-dim"),
    }, `${fmt(r.n)} searches`));

    let cx = padL;
    p.tiers.forEach((t, ti) => {
      const pct = r.pct[t.key];
      if (!pct) return;
      const sw = (pct / 100) * plot;
      const last = p.tiers.slice(ti + 1).every((z) => !r.pct[z.key]);
      const m = bar(cx, y, Math.max(sw - (last ? 0 : 2), 0), bh, last ? 4 : 0);
      m.setAttribute("fill", cssvar(shade[ti]));
      hover(m, `<b>${esc(r.name)}</b><br>${pct}% of searches: ${esc(t.label.toLowerCase())}`
        + `<br><span class="k">${fmt(r.counts[t.key])} searches</span>`);
      svg.appendChild(m);
      cx += sw;
    });
    svg.appendChild(el("text", {
      x: padL + plot + 10, y: y + bh / 2 + (r.thin ? -2 : 4), "font-size": 11.5,
      fill: cssvar("--ink-2"),
    }, `widest ${fmt(r.ceiling)}`));
    if (r.thin) {
      svg.appendChild(el("text", {
        x: padL + plot + 10, y: y + bh / 2 + 13, "font-size": 11,
        fill: cssvar("--series-2"),
      }, "thin sample"));
    }
  });

  const wide = p.rows.filter((r) => r.ceiling >= 5000);
  const narrow = [...wide].sort((a, b) => a.median_frac - b.median_frac)[0];
  const broad = [...wide].sort((a, b) => b.median_frac - a.median_frac)[0];
  document.getElementById("find-posture").innerHTML =
    `<b>${p.full_pool} of ${p.total}</b> departments have run at least one search reaching the whole `
    + `pool of roughly six thousand networks, so access is not what separates them. `
    + `<b>${esc(broad.name)}</b> runs a typical search at ${broad.median_frac}% of its own widest; `
    + `<b>${esc(narrow.name)}</b> runs one at ${narrow.median_frac}%, with ${narrow.pct.t1}% of its searches `
    + `under a hundredth of what it has shown it can reach. `
    + `Both could search the country. One habitually does not. `
    + `Reading reach in absolute networks hides that, because it makes a restrained department and a small `
    + `one look the same.`;

  /* offence fingerprint matrix */
  const f = d.fingerprint;
  const short = (sl) => f.names[sl].replace(/ (PD|DPS|SO)$/, "");
  const t = document.getElementById("fp-table");
  const bandOf = (v) => {
    const breaks = [0.2, 0.3, 0.4, 0.5];
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i += 1;
    return `--ramp-${i + 1}`;
  };
  t.innerHTML = `<thead><tr><th></th>`
    + f.slugs.map((s) => `<th class="rot">${esc(short(s))}</th>`).join("")
    + `</tr></thead><tbody>`
    + f.slugs.map((a, i) => `<tr><td>${esc(f.names[a])}</td>`
      + f.slugs.map((b, j) => {
        if (i === j) return `<td class="cell self">&middot;</td>`;
        const v = f.matrix[i][j];
        return `<td class="cell" data-a="${i}" data-b="${j}" `
          + `style="background:var(${bandOf(v)})">${v.toFixed(2)}</td>`;
      }).join("") + `</tr>`).join("")
    + `</tbody>`;
  [...t.querySelectorAll("td.cell[data-a]")].forEach((td) => {
    const a = f.slugs[+td.dataset.a], b = f.slugs[+td.dataset.b];
    const pair = f.pairs.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!pair) return;
    const av = pair.a === a ? pair.a_pct : pair.b_pct;
    const bv = pair.a === a ? pair.b_pct : pair.a_pct;
    hover(td, `<b>${esc(short(a))} vs ${esc(short(b))}</b><br>${esc(pair.driver)}`
      + `<br><span class="k">${esc(short(a))} ${av}% &middot; ${esc(short(b))} ${bv}%</span>`);
  });

  document.getElementById("fp-scale").innerHTML =
    "Least different" + [1, 2, 3, 4, 5].map((n) =>
      `<i style="background:var(--ramp-${n})"></i>`).join("") + "Most different"
    + `<span style="margin-left:0.6rem">0.00 to ${Math.max(...f.pairs.map((x) => x.jsd)).toFixed(2)}`
    + " on a scale where 0 is an identical mix of stated reasons and 1 is no overlap at all</span>";

  const most = f.pairs[0], least = f.pairs[f.pairs.length - 1];
  document.getElementById("find-fp").innerHTML =
    `<b>${esc(short(most.a))}</b> and <b>${esc(short(most.b))}</b> have the least in common: `
    + `${esc(most.driver)} accounts for ${most.a_pct}% of one department&rsquo;s searches and `
    + `${most.b_pct}% of the other&rsquo;s. `
    + `<b>${esc(short(least.a))}</b> and <b>${esc(short(least.b))}</b> are the closest pair, and they are the `
    + `two largest users on the list. `
    + `The cameras and the vendor are identical everywhere on this page; what each department points them at `
    + `is not. `
    + (f.too_small.length
      ? `${esc(f.too_small.map((s) => `${s.name} (${s.n} searches)`).join(" and "))} `
        + `${f.too_small.length === 1 ? "is" : "are"} below the ${f.min_searches}-search floor `
        + `and ${f.too_small.length === 1 ? "is" : "are"} left out rather than plotted as if comparable.`
      : "");

  document.getElementById("tbl-fp").appendChild(
    table(f.pairs.map((x) => [short(x.a), short(x.b), x.jsd.toFixed(3), x.driver,
      `${x.a_pct}%`, `${x.b_pct}%`]),
    ["Department", "Department", "Divergence", "Biggest difference", "Share", "Share"]));
}

/* 12 - sustained runs of searches */

function burstsSection(d) {
  const b = d.bursts;
  const rows = b.rows.filter((r) => r.searches > 0);
  const svg = document.getElementById("bursts");
  const rowH = 40, padL = 168, padR = 150, padT = 10, w = 900;
  const h = padT + rows.length * rowH + 14;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  const plot = w - padL - padR;
  const max = Math.max(...rows.map((r) => r.in_burst_pct), 5);

  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const bh = 20;
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 4, "text-anchor": "end", "font-size": 12.5,
      fill: cssvar("--ink"),
    }, r.name));
    svg.appendChild(el("text", {
      x: padL - 12, y: y + bh / 2 + 18, "text-anchor": "end", "font-size": 11,
      fill: cssvar("--ink-dim"),
    }, `${fmt(r.searches)} searches`));
    const bw = (r.in_burst_pct / max) * plot;
    if (bw > 0) {
      const m = bar(padL, y, bw, bh, 4);
      m.setAttribute("fill", cssvar("--series-1"));
      hover(m, `<b>${esc(r.name)}</b><br>${r.in_burst_pct}% of searches sit inside a run`
        + `<br><span class="k">${fmt(r.bursts)} runs, largest ${r.largest}</span>`);
      svg.appendChild(m);
    }
    svg.appendChild(el("text", {
      x: padL + Math.max(bw, 2) + 10, y: y + bh / 2 + 4, "font-size": 12,
      fill: cssvar(r.bursts ? "--ink-2" : "--ink-dim"),
    }, r.bursts ? `${r.in_burst_pct}%  ${fmt(r.bursts)} run${r.bursts === 1 ? "" : "s"}` : "no runs"));
  });

  const busy = rows.filter((r) => r.bursts > 0);
  const lead = busy[0];
  const quiet = rows.filter((r) => r.bursts === 0);
  document.getElementById("find-bursts").innerHTML =
    `The archive holds <b>${fmt(b.total)}</b> runs of ${b.min_searches} or more searches with no `
    + `${Math.round(b.gap_seconds / 60)}-minute gap inside them. `
    + `They are concentrated: <b>${esc(lead.name)}</b> accounts for ${fmt(lead.bursts)} of them and spends `
    + `${lead.in_burst_pct}% of its searching inside one, while ${quiet.length} of the ${rows.length} departments `
    + `never string five together at all. `
    + `They are also narrow: the median run spends <b>${b.median_focus}%</b> of its searches on one stated `
    + `reason, and ${fmt(b.single_reason)} of ${fmt(b.focus_n)} runs never leave a single reason at all. `
    + `That is as far as the data goes. The portals redact the user column to a placeholder, so nothing here `
    + `can say whether a run is one officer working straight through or several people busy at once, and the `
    + `page does not claim it.`;

  document.getElementById("runs").innerHTML = b.top.map((x) =>
    `<div class="run">`
    + `<div class="n">${x.n} <small>searches in ${x.minutes} min</small></div>`
    + `<div class="who">${esc(x.name)}</div>`
    + `<div class="when">${esc(x.start)}${x.reach_median != null
      ? ` &middot; reach ${fmt(x.reach_median)}` : ""}`
    + `${x.focus != null ? ` &middot; ${x.focus}% one reason` : ""}</div>`
    + `<div class="kinds">${x.kinds.length
      ? esc(x.kinds.map((k) => `${k.type} x${k.n}`).join(", ")) : "no stated reason"}</div>`
    + `</div>`).join("");
}

/* 04 - cameras on the ground: the portal's count against the map */

function camerasSection(d) {
  const cam = d.cameras;
  const svg = document.getElementById("cammap");
  const host = document.getElementById("cam-controls");
  const panel = document.getElementById("cam-panel");
  if (!cam || !cam.available) {
    panel.innerHTML = '<p class="hint">The camera inventory was not available to this build.</p>';
    return;
  }
  const W = 900, PAD = 18, LABEL = 22, cellH = 300;
  const rows = cam.rows;
  const N = rows.length;

  /* One frame per county. A single frame spanning Kalamazoo to Detroit would
     make every city a speck; each frame fits its own county's boundaries and
     shows the cameras that fall inside that frame, whoever runs them. */
  const byKey = {};
  rows.forEach((r) => { (byKey[r.county_key] ||= []).push(r); });
  const frames = d.counties.map((c) => ({ c, rows: byKey[c.key] || [] })).filter((f) => f.rows.length);
  const ncols = Math.min(3, frames.length);
  const cellW = W / ncols;
  const H = Math.ceil(frames.length / ncols) * cellH;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);

  /* Colour is the operator tag, which is the thing the reader has to weigh:
     a camera tagged to this agency, a camera tagged to someone else, or a
     camera nobody has attributed. Fixed to the entity, never to the filter. */
  const OP = [
    { o: 2, label: "Tagged to this department", css: "--series-1" },
    { o: 1, label: "Tagged to another operator", css: "--series-2" },
    { o: 0, label: "No operator tag", css: "--rule-bright" },
  ];
  const opCss = (o) => (OP.find((x) => x.o === o) || OP[2]).css;

  let sel = "all";
  const shapes = {}, dots = [];
  const defs = el("defs");
  svg.appendChild(defs);

  frames.forEach((f, i) => {
    const col = i % ncols, row = Math.floor(i / ncols);
    const cx0 = col * cellW, cy0 = row * cellH;
    const pts = [];
    f.rows.forEach((r) => (cam.outlines[r.slug] || []).forEach((ring) => ring.forEach((p) => pts.push(p))));
    const g = el("g");
    const clipId = `camclip${i}`;
    const clip = el("clipPath", { id: clipId });
    clip.appendChild(el("rect", { x: cx0, y: cy0, width: cellW, height: cellH }));
    defs.appendChild(clip);
    g.setAttribute("clip-path", `url(#${clipId})`);
    svg.appendChild(g);
    svg.appendChild(el("rect", { x: cx0 + 0.5, y: cy0 + 0.5, width: cellW - 1, height: cellH - 1, fill: "none", stroke: cssvar("--rule") }));
    const mirroredHere = f.rows.some((r) => r.mirrored);
    svg.appendChild(el("text", { x: cx0 + PAD, y: cy0 + 15, "font-size": 11, "letter-spacing": "0.14em", fill: cssvar("--ink-dim") },
      `${f.c.name.toUpperCase()}${mirroredHere ? "" : " · NOT MIRRORED"}`));
    if (!pts.length) return;
    const lat0 = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
    const kx = Math.cos(lat0 * Math.PI / 180);
    const xs = pts.map((p) => p[0] * kx), ys = pts.map((p) => -p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min((cellW - PAD * 2) / (x1 - x0), (cellH - LABEL - PAD * 2) / (y1 - y0));
    const ox = cx0 + (cellW - (x1 - x0) * k) / 2 - x0 * k;
    const oy = cy0 + LABEL + (cellH - LABEL - (y1 - y0) * k) / 2 - y0 * k;
    const project = (lat, lng) => [lng * kx * k + ox, -lat * k + oy];
    const box = { w: (cx0 - ox) / (kx * k), e: (cx0 + cellW - ox) / (kx * k), n: (oy - cy0 - LABEL) / k, s: (oy - cy0 - cellH) / k };

    f.rows.forEach((r) => {
      const rings = cam.outlines[r.slug] || [];
      const dPath = rings.map((ring) => ring.map(([lng, lat], j) => {
        const [x, y] = project(lat, lng);
        return `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join("") + "Z").join("");
      const path = el("path", { d: dPath, class: `juris${r.mirrored ? "" : " unmirrored"}` });
      path.dataset.slug = r.slug;
      hover(path, () => `<b>${esc(r.name)}</b><br>${r.mirrored ? `${fmt(r.mapped)} mapped cameras inside` : "outside the mirrored area"}`
        + `<br><span class="k">portal says ${fmt(r.portal)}</span>`);
      path.addEventListener("click", () => { sel = sel === r.slug ? "all" : r.slug; ctl.rerender(); draw(); });
      g.appendChild(path);
      shapes[r.slug] = path;
    });

    if (!mirroredHere) return;
    cam.points.forEach((p) => {
      if (p.lat < box.s || p.lat > box.n || p.lng < box.w || p.lng > box.e) return;
      const [x, y] = project(p.lat, p.lng);
      const c = el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.2, class: "cam" });
      c.setAttribute("fill", cssvar(opCss(p.o)));
      const r = p.j >= 0 ? rows[p.j] : null;
      hover(c, `<b>${r ? esc(r.name) : "Outside these jurisdictions"}</b>`
        + `<br>${OP.find((x) => x.o === p.o).label.toLowerCase()}${p.f ? "" : "<br><span class=\"k\">not tagged as Flock</span>"}`);
      g.appendChild(c);
      dots.push({ node: c, p });
    });
  });

  const items = [{ value: "all", label: `All ${words(N)}`, dot: false }].concat(
    rows.map((r) => ({ value: r.slug, label: r.name, dot: false })));
  const ctl = chips(host, "Jurisdiction", items, (v) => v === sel,
    (v) => { sel = v; ctl.rerender(); draw(); });

  function draw() {
    rows.forEach((r) => {
      const s = shapes[r.slug];
      if (!s) return;
      s.classList.toggle("sel", sel === r.slug);
      s.classList.toggle("dim", sel !== "all" && sel !== r.slug);
    });
    dots.forEach(({ node, p }) => {
      const inSel = sel === "all" ? true : (p.j >= 0 && rows[p.j].slug === sel);
      node.setAttribute("fill-opacity", inSel ? 1 : 0.18);
      node.setAttribute("r", inSel ? 3.2 : 2.2);
    });
    renderPanel();
  }

  /* The portal counts Flock LPR devices, so that is what is set against it:
     Flock-tagged nodes with a two-direction node counted as two. Cameras of
     another make cannot be in the portal's number and are stated separately. */
  const excluded = (r) => (r.other_make || r.no_make)
    ? ` Not counted here: ${r.other_make ? `${fmt(r.other_make)} of another make` : ""}`
      + `${r.other_make && r.no_make ? " and " : ""}${r.no_make ? `${fmt(r.no_make)} with no make tag` : ""}.`
    : "";
  const defNote = (r) => (r.camera_def && !/only/i.test(r.camera_def)
    ? ` Its tile reads &ldquo;${esc(r.camera_def)}&rdquo;, which is not the LPR-only count this comparison assumes.` : "");
  const coverNote = (r) => (r.mirrored && r.coverage < 1
    ? ` The mirror&rsquo;s box covers ${Math.round(r.coverage * 100)}% of this boundary&rsquo;s area; the rest is not read.` : "");
  const verdict = (r) => {
    if (!r.mirrored) return `<b>Not mirrored.</b> This boundary lies outside the areas the camera inventory covers, so the map can say nothing here, and nothing is fetched on demand to fill it.${defNote(r)}`;
    if (r.portal == null) return "The portal publishes no camera count." + coverNote(r);
    const fd = r.flock_devices;
    if (fd === r.portal) return "The two counts agree, which does not prove they count the same cameras." + excluded(r) + defNote(r) + coverNote(r);
    if (fd > r.portal) {
      return `<b>${fmt(fd - r.portal)} more Flock devices on the map than the portal claims.</b> The map counts every camera inside the line, whoever runs it`
        + (r.op_other ? `: ${fmt(r.op_other)} here carry another operator's name (${esc(r.other_operators.map((o) => o.name).join(", "))})` : "")
        + (r.op_untagged ? `, and ${fmt(r.op_untagged)} carry no operator at all` : "")
        + `. Stale nodes for cameras since removed would also land on this side.` + excluded(r) + defNote(r) + coverNote(r);
    }
    return `<b>${fmt(r.portal - fd)} fewer Flock devices on the map than the portal claims.</b> The map is incomplete here: `
      + `the department says it runs ${fmt(r.portal)}, volunteers have found ${fmt(fd)}.` + excluded(r) + defNote(r) + coverNote(r);
  };

  const mirroredRows = rows.filter((r) => r.mirrored);
  const unmirrored = rows.filter((r) => !r.mirrored);
  const equal = mirroredRows.filter((r) => r.portal != null && r.flock_devices === r.portal);
  function renderPanel() {
    if (sel === "all") {
      const over = mirroredRows.filter((r) => r.portal != null && r.flock_devices > r.portal);
      const short = mirroredRows.filter((r) => r.portal != null && r.flock_devices < r.portal);
      panel.innerHTML = `<h4 class="cam-panel-head">${Words(mirroredRows.length)} jurisdictions on the map, ${equal.length ? `${words(equal.length)} ${plural(equal.length, "match", "matches")}` : "zero matches"}</h4>`
        + `<div class="cam-figs">`
        + `<div><span>Mapped in the mirrored regions</span><span>${fmt(cam.region_live)}<small>${fmt(cam.region_flock)} tagged Flock</small></span></div>`
        + `<div><span>Inside these ${words(N)}</span><span>${fmt(cam.in_any)}<small>${fmt(cam.region_live - cam.in_any)} outside them</small></span></div>`
        + `<div><span>Map exceeds portal</span><span>${over.length}<small>${esc(over.map((r) => shortName(r.name)).join(", "))}</small></span></div>`
        + `<div><span>Map short of portal</span><span>${short.length}<small>${esc(short.map((r) => shortName(r.name)).join(", "))}</small></span></div>`
        + (unmirrored.length ? `<div><span>Not mirrored</span><span>${unmirrored.length}<small>${esc(unmirrored.map((r) => shortName(r.name)).join(", "))}</small></span></div>` : "")
        + `</div>`
        + `<p class="cam-verdict">Pick a jurisdiction, or click its outline, to see which way its mismatch runs and why. `
        + `Mapped as of the last OpenStreetMap edit on ${esc(cam.as_of || "an unknown date")}; the inventory refreshes daily.</p>`;
      return;
    }
    const r = rows.find((x) => x.slug === sel);
    panel.innerHTML = `<h4 class="cam-panel-head">${esc(r.name)}</h4>`
      + `<p class="hint" style="margin:0 0 0.8rem">${esc(r.county)} &middot; boundary: ${esc(r.boundary)}</p>`
      + `<div class="cam-figs">`
      + `<div><span>Portal says</span><span>${fmt(r.portal)}<small>${esc(r.camera_def || "LPR cameras it operates")}</small></span></div>`
      + (r.mirrored
        ? `<div><span>Flock devices mapped</span><span>${fmt(r.flock_devices)}<small>${fmt(r.mapped)} nodes of any make${r.multi ? `, ${fmt(r.multi)} carrying two cameras` : ""}</small></span></div>`
          + `<div><span>Tagged to it</span><span>${fmt(r.op_agency)}<small>${fmt(r.tagged_anywhere)} anywhere in the mirrored regions</small></span></div>`
          + `<div><span>Other operator</span><span>${fmt(r.op_other)}<small>${fmt(r.op_untagged)} untagged</small></span></div>`
          + `<div><span>Likely duplicates</span><span>${fmt(r.dup)}<small>${fmt(r.poles)} two-camera poles</small></span></div>`
        : `<div><span>On the map</span><span>&ndash;<small>not mirrored</small></span></div>`)
      + `</div>`
      + `<p class="cam-verdict">${verdict(r)}</p>`;
  }

  draw();

  document.getElementById("cam-legend").innerHTML = OP.map((o) =>
    `<span><i style="background:var(${o.css});border-radius:50%"></i> ${o.label}</span>`).join("")
    + `<span><i style="background:var(--surface-2);border:1px solid var(--rule-bright)"></i> boundary the department polices</span>`
    + (unmirrored.length ? `<span><i style="border:1px dashed var(--rule-bright)"></i> boundary outside the mirrored area</span>` : "");

  /* table */
  const t = document.getElementById("cam-table");
  t.innerHTML = `<thead><tr><th>Department</th><th>Portal says</th><th>Flock devices mapped</th><th>Nodes, any make</th>`
    + `<th>Tagged to it</th><th>Other operator</th><th>Untagged</th><th>Two-camera poles</th><th>Likely duplicates</th><th>Which way</th></tr></thead><tbody>`
    + rows.map((r) => {
      const fd = r.flock_devices;
      if (!r.mirrored) {
        return `<tr><td>${esc(r.name)}<br><span class="muted">${esc(r.boundary)}</span></td>`
          + `<td class="num">${fmt(r.portal)}</td><td colspan="8" class="muted">not mirrored: the boundary lies outside the camera inventory</td></tr>`;
      }
      const dir = r.portal == null ? "" : fd > r.portal ? "map exceeds portal" : fd < r.portal ? "map short of portal" : "equal";
      const cls = fd > (r.portal ?? 0) ? "over" : fd < (r.portal ?? 0) ? "short" : "";
      const dot = cls ? `<i class="dir ${cls}"></i>` : "";
      return `<tr><td>${esc(r.name)}<br><span class="muted">${esc(r.boundary)}</span></td>`
        + `<td class="num">${fmt(r.portal)}</td><td class="num">${fmt(fd)}</td><td class="num">${fmt(r.mapped)}</td>`
        + `<td class="num">${fmt(r.op_agency)}</td><td class="num">${fmt(r.op_other)}</td><td class="num">${fmt(r.op_untagged)}</td>`
        + `<td class="num">${fmt(r.poles)}</td><td class="num">${fmt(r.dup)}</td><td>${dot}${dir}</td></tr>`;
    }).join("") + `</tbody>`;

  const over = mirroredRows.filter((r) => r.portal != null && r.flock_devices > r.portal);
  const short = mirroredRows.filter((r) => r.portal != null && r.flock_devices < r.portal);
  const untagged = mirroredRows.reduce((n, r) => n + r.op_untagged, 0);
  const inside = mirroredRows.reduce((n, r) => n + r.mapped, 0);
  const dups = mirroredRows.reduce((n, r) => n + r.dup, 0);
  const poles = mirroredRows.reduce((n, r) => n + r.poles, 0);
  const multiRows = mirroredRows.filter((r) => r.multi);
  const otherMake = mirroredRows.reduce((n, r) => n + r.other_make, 0);
  const noMake = mirroredRows.reduce((n, r) => n + r.no_make, 0);
  const worst = [...short].sort((a, b) => (a.flock_devices / a.portal) - (b.flock_devices / b.portal))[0];
  document.getElementById("find-cams").innerHTML =
    `For <b>${words(over.length)}</b> of the ${words(mirroredRows.length)} jurisdictions on the map it holds more cameras than the portal claims and for <b>${words(short.length)}</b> it holds fewer; `
    + `${equal.length ? `${words(equal.length)} (${esc(listOf(equal.map((r) => r.name)))}) ${plural(equal.length, "matches", "match")} exactly` : "none match"}. `
    + (unmirrored.length ? `${esc(listOf(unmirrored.map((r) => r.name)))} ${plural(unmirrored.length, "lies", "lie")} outside the mirrored area and cannot be compared. ` : "")
    + `The two sides fail for different reasons. `
    + `The portal counts what the agency operates; the map counts what sits inside the line, and <b>${fmt(untagged)}</b> of the `
    + `${fmt(inside)} mapped cameras inside these ${words(mirroredRows.length)} carry no operator tag at all, so a county or state camera on a city street `
    + `lands in the city's count. `
    + (worst ? `Where the map falls short, it is simply unfinished: <b>${esc(worst.name)}</b> says it runs ${fmt(worst.portal)} and the map has ${fmt(worst.flock_devices)}. ` : "")
    + (otherMake ? `${fmt(otherMake)} mapped cameras inside these boundaries are another make and are not set against any portal figure. ` : "")
    + `Duplicates do not explain any of it: direction is tagged on almost every node, ${fmt(poles)} close pairs inside these `
    + `jurisdictions face different ways and are two cameras on one pole, and ${fmt(dups)} face the same way.`;

  const defs2 = {};
  rows.forEach((r) => { if (r.camera_def) (defs2[r.camera_def] ||= []).push(r); });
  const defOrder = Object.entries(defs2).sort((a, b) => b[1].length - a[1].length);
  const noCaption = rows.filter((r) => !r.camera_def);
  document.getElementById("cam-count").innerHTML =
    `<h4>What a camera is, on each side</h4>`
    + `<p>Flock counts devices. On ${words(defOrder[0][1].length)} of the ${words(N)} portals the tile reads &ldquo;${esc(defOrder[0][0])}&rdquo;`
    + defOrder.slice(1).map(([def, rs]) => `; ${esc(listOf(rs.map((r) => r.name)))} ${plural(rs.length, "reads", "read")} &ldquo;${esc(def)}&rdquo;`).join("")
    + (noCaption.length ? `; ${esc(listOf(noCaption.map((r) => r.name)))} ${plural(noCaption.length, "carries", "carry")} no caption under the tile` : "")
    + `. The wording is a template variant, not a change: every portal has carried its caption since its first capture. `
    + `Where a portal shows a total alongside the LPR count the two are equal, so a pole carrying two cameras facing opposite ways is two. OpenStreetMap usually draws `
    + `the same pole as two nodes with two directions, but a mapper can also draw one node carrying both directions. `
    + (multiRows.length
      ? `Inside these ${words(mirroredRows.length)} that happens on ${fmt(multiRows.reduce((n, r) => n + r.multi, 0))} nodes, in `
        + `${esc(listOf(multiRows.map((r) => r.name)))}, and each is counted as two here, the way Flock counts. `
      : `Inside these ${words(mirroredRows.length)} no node does, so a node is a device. `)
    + `Cameras of another make (${fmt(otherMake)} inside these boundaries) and the ${fmt(noMake)} with no make tag are shown on the `
    + `map and kept out of the comparison, because the portal counts Flock devices only.</p>`
    + `<p>The operator tag is the weak link. ${fmt(untagged)} of ${fmt(inside)} cameras inside these boundaries name no operator, `
    + `and &ldquo;Flock Safety&rdquo; as an operator names the vendor, not the agency. Until those are filled in, the map can say `
    + `how many cameras stand in a city and not how many belong to its police department.</p>`;
}

/* 05 - the private side: companies on the network, and which way it runs */

function privateSection(d) {
  const pv = d.private;
  const keys = pv.publishers.inbound;
  const pubOut = pv.publishers.outbound;
  const shortName = (sl) => pv.agency_names[sl].replace(/ (PD|DPS|SO)$/, "");
  const commercial = pv.inbound_private.filter((r) => r.category !== "nonprofit");
  const nonprofitOut = pv.outbound_private.filter((r) => r.category === "nonprofit");
  const companiesOut = pv.outbound_private.filter((r) => r.category !== "nonprofit");

  /* stat band */
  document.getElementById("private-band").innerHTML = [
    [fmt(commercial.length), "private operators", `whose cameras at least one of the ${words(keys.length)} departments publishing that list can query`, "cool"],
    [fmt(companiesOut.length), "companies", `that can query cameras of the ${words(pubOut.length)} departments publishing that list`, "accent"],
    [fmt(nonprofitOut.length), nonprofitOut.length === 1 ? "nonprofit" : "nonprofits",
      nonprofitOut.length ? `that can: ${esc(nonprofitOut.map((r) => r.name.replace(/\s*\[.*\]$/, "")).join(", "))}` : "on the outbound side", ""],
    [fmt(pv.counts.public_nonpolice_out), "other public bodies",
      (() => {
        const k = pv.public_out_kinds;
        const lab = Object.assign({}, d.org_map.kind_labels,
          { public: "dispatch, natural resources, parks, municipalities and the like", unclassified: "matched no rule" });
        return "with query access: " + Object.entries(k).sort((x, y) => y[1] - x[1])
          .map(([kind, n]) => `${(lab[kind] || kind).toLowerCase()} ${n}`).join(", ");
      })(), ""],
  ].map(([n, label, note, cls]) =>
    `<div class="stat"><div class="stat-num ${cls}">${n}</div><div class="stat-label">${label}</div><div class="stat-note">${note}</div></div>`).join("");

  /* matrix: operator x department */
  const t = document.getElementById("private-table");
  const groups = {};
  pv.inbound_private.forEach((r) => { (groups[r.category] = groups[r.category] || []).push(r); });
  const order = ["retail", "residential", "health", "nonprofit"].filter((k) => groups[k]);
  t.innerHTML = `<thead><tr><th>Operator</th><th>State</th>`
    + keys.map((sl) => `<th class="tilt">${esc(shortName(sl))}</th>`).join("")
    + `<th>On the map</th></tr></thead><tbody>`
    + order.map((cat) =>
      `<tr class="group"><td colspan="${keys.length + 3}">${esc(pv.labels[cat])} &middot; ${groups[cat].length}</td></tr>`
      + groups[cat].map((r) =>
        `<tr><td>${esc(r.name)}</td><td class="muted">${esc(r.state || "")}</td>`
        + keys.map((sl) => `<td class="dots"><i class="${r.depts.includes(sl) ? "on" : ""}"></i></td>`).join("")
        + `<td class="num">${r.osm_cameras ? `${fmt(r.osm_cameras)} cameras` : `<span class="muted">not tagged</span>`}</td></tr>`).join("")
    ).join("") + `</tbody>`;
  [...t.querySelectorAll("td.dots")].forEach((td, i) => {
    const row = td.closest("tr"); const name = row.firstChild.textContent;
    const sl = keys[i % keys.length];
    hover(td, `<b>${esc(name)}</b><br>${td.firstChild.classList.contains("on")
      ? `${esc(pv.agency_names[sl])} can query its cameras` : `not on ${esc(pv.agency_names[sl])}&rsquo;s inbound list`}`);
  });

  /* finding */
  const lead = pv.per_dept[0];
  const none = pv.per_dept.filter((r) => !r.private_feeds);
  const residential = (groups.residential || []).length;
  const retail = (groups.retail || []).length;
  const mapped = pv.inbound_private.filter((r) => r.osm_cameras);
  document.getElementById("find-private").innerHTML =
    `<b>${fmt(commercial.length)}</b> private operators appear on the inbound side, and <b>${fmt(companiesOut.length)}</b> on the outbound: `
    + `a company can hand its cameras to the police here, and ${companiesOut.length ? "some can look back" : "no company can look back"} through theirs, `
    + `on the ${words(pubOut.length)} of ${words(d.agencies.length)} portals that publish who can query them. `
    + `Most of the private feeds are housing rather than retail: <b>${fmt(residential)}</b> apartment communities and property managers `
    + `against ${fmt(retail)} retailers and carriers. `
    + `<b>${esc(lead.name)}</b> can query the most private operators (${fmt(lead.private_feeds)}); `
    + `${none.length ? `${esc(none.map((r) => r.name).join(" and "))} ${none.length === 1 ? "lists" : "list"} none. ` : ""}`
    + `Only ${mapped.length === 1 ? "one of these operators, " : `${fmt(mapped.length)} of these operators, `}`
    + `${esc(mapped.map((r) => r.name).join(", "))}, can be matched to cameras on the map, which says more about the map&rsquo;s `
    + `operator tags than about the operators. `
    + (nonprofitOut.length
      ? `The one non-government organization that can query these cameras is ${esc(nonprofitOut.map((r) => r.name).join(", "))}, a nonprofit.`
      : "");

  /* OSM operators */
  const ot = document.getElementById("osm-op-table");
  const PRIV = new Set(["retail", "residential", "health", "nonprofit"]);
  const priv = pv.osm_operators.filter((o) => PRIV.has(o.category));
  const pub = pv.osm_operators.filter((o) => !PRIV.has(o.category));
  ot.innerHTML = `<thead><tr><th>Operator on the map</th><th>Cameras</th><th>Where</th><th>In any sharing list</th></tr></thead><tbody>`
    + priv.map((o) => {
      const where = o.where.map((w) => `${w.slug ? esc(shortName(w.slug)) : "outside these jurisdictions"} ${w.n}`).join(", ");
      return `<tr><td>${esc(o.name)}<br><span class="muted">${esc(pv.labels[o.category] || o.category)}</span></td>`
        + `<td class="num">${fmt(o.n)}</td><td>${where}</td>`
        + `<td>${o.listed.length ? `<span class="mark yes">● ${esc(o.listed.join(", "))}</span>` : `<span class="mark no">○ no list names it</span>`}</td></tr>`;
    }).join("")
    + `<tr><td colspan="4" class="muted">${fmt(pub.length)} more operator tags in the mirrored regions are other agencies or unresolved tags `
    + `(${esc(pub.map((o) => o.name).slice(0, 4).join(", "))}${pub.length > 4 ? ", and others" : ""}).</td></tr>`
    + `</tbody>`;

  /* vendor and system entries */
  const v = pv.vendor_entries;
  document.getElementById("private-vendor").innerHTML =
    `<h4>The list is the vendor&rsquo;s directory, verbatim</h4>`
    + `<p>${v.length ? v.map((r) => `<span class="quote">${esc(r.name)}</span> is listed as an organization `
      + `${esc(r.depts.map((sl) => pv.agency_names[sl]).join(" and "))} can query`).join("; ") + "."
      : "No vendor or system entries appear in the lists at the moment."} `
    + `Those are not agencies. They read as entries in the vendor&rsquo;s own account directory, printed by the portal `
    + `as if they were partners, which is worth knowing when reading any of these lists as a roster: the count `
    + `includes whatever sits in the same table.</p>`;

  /* public non-police bodies with query access */
  const kindLabel = Object.assign({ other: "Other public body", unclassified: "Matched no rule", public: "Public body" }, d.org_map.kind_labels);
  document.getElementById("tbl-public-out").appendChild(
    table(pv.public_nonpolice_out.map((r) => [
      r.name, kindLabel[r.kind] || r.kind, r.state || "",
      r.depts.map((sl) => shortName(sl)).join(", "),
    ]), ["Organization", "Kind", "State", "Can query cameras of"]));
}

// Served, the page fetches flock.json. As a file:// bundle it links
// flock-data.js, which assigns window.FLOCK_DATA. Prefer the global so one
// app.js covers both, and keep the fetch so a Worker deployment needs no change.
function loadPayload(name, url) {
  if (window[name]) return Promise.resolve(window[name]);
  return fetch(url).then((r) => r.json());
}

/* ------------------------------------------------------------------ */
/* Overview tab: how current each department is, and what the latest read
   changed. Everything here is rendered from figures the build bucketed to
   the local day; the browser does no date arithmetic of its own. */

function overviewSection(d) {
  const sc = d.scope, td = d.today;
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const t = document.getElementById("fresh-table");
  const behindDays = (a) => (a.captured_day ? Math.round((Date.parse(sc.last_capture) - Date.parse(a.captured_day)) / 86400000) : null);
  const status = (a) => {
    const b = behindDays(a);
    if (b == null) return `<span class="mark no">&#9675; never read</span>`;
    if (b > 1) return `<span class="mark no">&#9679; ${b} days behind</span>`;
    if (b === 1) return `<span class="mark">&#9681; a day behind</span>`;
    return `<span class="mark yes">&#9679; current</span>`;
  };
  t.innerHTML = `<thead><tr><th>Department</th><th>County</th><th>Last read</th><th class="num">New searches then</th>`
    + `<th>Last new data</th><th>Portal&rsquo;s own date</th><th>Status</th></tr></thead><tbody>`
    + d.agencies.map((a) => `<tr class="${behindDays(a) > 1 ? "stale" : ""}">`
      + `<td><button type="button" class="dept-link" data-slug="${esc(a.slug)}">${esc(a.name)}</button></td>`
      + `<td class="muted">${esc(a.county.replace(/ County$/, ""))}</td>`
      + `<td>${a.captured_at ? `${dayLabel(a.captured_day)} ${a.captured_at.slice(11, 16)} UTC` : "never"}</td>` // leak-linter:allow (capture stamp, not a schedule)
      + `<td class="num">${a.captured_at ? (a.new_rows_last_read ? `+${fmt(a.new_rows_last_read)}` : "0") : ""}</td>`
      + `<td>${a.last_new_day ? dayLabel(a.last_new_day) : `<span class="muted">none yet</span>`}</td>`
      + `<td>${a.portal_updated ? dayLabel(a.portal_updated) : `<span class="muted">not read</span>`}</td>`
      + `<td>${status(a)}</td></tr>`).join("") + `</tbody>`;
  t.querySelectorAll(".dept-link").forEach((btn) => btn.addEventListener("click", () => {
    openProfile(btn.dataset.slug);
    document.getElementById("profile").scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  const behind = d.agencies.filter((a) => behindDays(a) > 1);
  const quiet = d.agencies.filter((a) => a.captured_day === sc.last_capture && !a.new_rows_last_read);
  const newest = [...d.agencies].filter((a) => a.new_rows_last_read).sort((a, b) => b.new_rows_last_read - a.new_rows_last_read);
  document.getElementById("find-fresh").innerHTML =
    `The latest read was ${dayLabel(sc.last_capture)}, and it reached <b>${words(td.captured.length)}</b> of the ${words(d.agencies.length)} portals`
    + (td.not_captured.length ? ` (${esc(listOf(td.not_captured.map((s) => byAgency[s].name)))} ${plural(td.not_captured.length, "was", "were")} not read)` : "")
    + `. ${behind.length
      ? `<b>${esc(listOf(behind.map((a) => a.name)))}</b> ${plural(behind.length, "is", "are")} behind the others: ${esc(listOf(behind.map((a) => `last read ${dayLabel(a.captured_day)}, last new data ${a.last_new_day ? dayLabel(a.last_new_day) : "never"}`)))}. `
      : "Every portal is current to within a day. "}`
    + (newest.length ? `The most new searches in the latest read came from <b>${esc(newest[0].name)}</b> (${fmt(newest[0].new_rows_last_read)})` : "No portal added searches in the latest read")
    + (quiet.length ? `; ${esc(listOf(quiet.map((a) => a.name)))} ${plural(quiet.length, "was", "were")} read and had nothing new.` : ".");

  const changedDepts = [...new Set(td.changes.map((c) => c.name))];
  document.getElementById("today-band").innerHTML = [
    [fmt(td.new_rows), "new searches", `added to the ledger by the ${dayLabel(td.day)} read`, "cool"],
    [`${td.captured.length} of ${d.agencies.length}`, "portals read", td.not_captured.length ? `missed: ${esc(td.not_captured.map((s) => byAgency[s].name).join(", "))}` : "every portal answered", ""],
    [fmt(td.added), plural(td.added, "organization added", "organizations added"), changedDepts.length ? `to a sharing list at ${esc(listOf(changedDepts))}` : "to any sharing list", ""],
    [fmt(td.removed), plural(td.removed, "organization dropped", "organizations dropped"), td.departures.length ? `${words(td.departures.length)} left several portals at once` : "none left several portals at once", "accent"],
  ].map(([n, label, note, cls]) =>
    `<div class="stat"><div class="stat-num ${cls}">${n}</div><div class="stat-label">${label}</div><div class="stat-note">${note}</div></div>`).join("");
  document.getElementById("today-list").innerHTML = td.changes.length
    ? td.changes.map((c) => `<div class="ev"><b>${esc(c.name)}</b> <span class="muted">${c.direction === "outbound" ? "who can query it" : "whose cameras it can query"}</span>`
      + (c.added.length ? ` <span class="org add">+${c.added.length}</span> ${esc(c.added.slice(0, 6).join(", "))}${c.added.length > 6 ? ", &hellip;" : ""}` : "")
      + (c.removed.length ? ` <span class="org rem">&minus;${c.removed.length}</span> ${esc(c.removed.slice(0, 6).join(", "))}${c.removed.length > 6 ? ", &hellip;" : ""}` : "") + `</div>`).join("")
    : `<p class="hint">No sharing list changed in the latest read${td.faults ? `; ${words(td.faults)} capture ${plural(td.faults, "fault")} recorded` : ""}.</p>`;
}

/* Tabs: five groups of sections, addressed by hash so a link opens a tab. */
const TABS = [["overview", "Overview"], ["sharing", "Sharing"], ["searches", "Searches"], ["cameras", "Cameras"], ["portals", "Portals"]];
function tabs() {
  const nav = document.getElementById("tabs");
  const sections = [...document.querySelectorAll("section[data-tab]")];
  const valid = new Set(TABS.map((t) => t[0]));
  const current = () => (valid.has(location.hash.slice(1)) ? location.hash.slice(1) : TABS[0][0]);
  const show = (key) => {
    sections.forEach((s) => { s.hidden = s.dataset.tab !== key; });
    nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === key)));
  };
  TABS.forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.tab = key; b.setAttribute("role", "tab"); b.textContent = label;
    b.addEventListener("click", () => { history.replaceState(null, "", `#${key}`); show(key); nav.scrollIntoView({ behavior: "smooth", block: "start" }); });
    nav.appendChild(b);
  });
  window.addEventListener("hashchange", () => show(current()));
  show(current());
}

loadPayload("FLOCK_DATA", "flock.json")
  .then((d) => {
    // Each section renders on its own, so one data edge case in one chart
    // cannot blank every section after it. A failure still reaches the
    // console, which the headless gate treats as a failed build.
    const steps = [
      ["masthead", masthead], ["county band", countyBand], ["profile", profilePanel], ["overview", overviewSection],
      ["reach", mapChart], ["map", geoMap], ["org search", orgSearch], ["cameras", camerasSection],
      ["private", privateSection], ["sharing", sharingChart], ["exposure", exposureSection], ["trends", trendsChart],
      ["changes", changesList], ["radius", radiusChart], ["reason", offenseChart], ["posture", postureSection],
      ["rhythm", heatChart], ["transparency", transparencySection], ["network", networkSize], ["footer", footerNotes],
    ];
    steps.forEach(([name, fn]) => { try { fn(d); } catch (e) { console.error(`section ${name} failed`, e); } });
    tabs();
  })
  .catch((err) => {
    document.body.insertAdjacentHTML("afterbegin",
      `<pre style="padding:2rem;color:#c08a10">This build is missing its data file.\n\n${err}</pre>`);
  });
