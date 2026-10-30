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
// "Number of LPR and other cameras." is a different count from "LPR cameras
// only", and the three words are the whole difference, so they are bolded
// wherever a caption is quoted.
const boldOther = (text) => esc(text).replace(/and other cameras/i, (m) => `<b>${m}</b>`);
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
// Dates read month first, spelled out: "August 8", "October 24, 2026".
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (iso) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");
const dayLabel = (iso) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : "never");
function freshness(d, a) {
  if (!a.captured_at) return { text: "never captured", short: "never captured", stale: true };
  const cap = a.captured_at.slice(0, 10);
  const portal = a.portal_updated ? `, portal dated ${dayLabel(a.portal_updated)}` : "";
  return {
    text: `read ${dayLabel(cap)} ${a.captured_at.slice(11, 16)} UTC${portal}`, // leak-linter:allow (capture stamp, not a schedule)
    short: a.stalled ? `no new data since ${capDay(a)}`
      : cityFile(a) ? `read ${dayLabel(cap)} &middot; city file through ${dayLabel(cityFile(a).through)}${a.days_behind > 1 ? ` &middot; ${a.days_behind} days behind` : ""}`
      : `read ${dayLabel(cap)} &middot; last new search ${a.last_new_day ? dayLabel(a.last_new_day) : "never"}`,
    stale: a.stalled,
  };
}

/* A search audit the department does not inline on its portal but posts as a
   file elsewhere (Holland's, since 24 September 2026, from the City of
   Holland, one file a month). The build sets audit_source for it and dates
   the last day the file covers. A read of such a department can be days newer
   than its data, so every surface that names its freshness says both. */
const cityFile = (a) => (a.audit_source && a.audit_source.kind === "city_file" ? a.audit_source : null);
function cityFileText(a) {
  const s = cityFile(a), n = a.days_behind;
  return `<b>${esc(a.name)}</b>&rsquo;s search audit is a file its city posts once a month, `
    + `not the rolling thirty-day list Flock&rsquo;s portals show natively. The latest file covers searches through ${dayLabel(s.through)}`
    + (n > 1 ? `, so the ledger counts it ${n} days behind` : "") + `. `
    + `Searches after that are not published yet, so the charts leave them as a gap and do not count them as quiet days.`
    + (s.url ? ` <a href="${esc(s.url)}" rel="noopener">Open the city&rsquo;s file</a>.` : "");
}

/* A department's searches over the last thirty days: its portal's own
   rolling count from the latest read (the last series entry). For every
   department reading its audit natively this equals the ledger's rows still
   on the live portal. A search tile under another heading than the rest
   (Holland's reads "Plates searched") is returned with that heading, so no
   surface passes it off as the same count. The card and the county rows
   both read it here. */
function recentSearches(d, a) {
  const n = a.series.length ? a.series[a.series.length - 1].searches : null;
  const r = d.transparency.relabelled.find((x) => x.slug === a.slug && x.tile === "search");
  return { n, heading: r ? r.reads.split(":")[0] : null };
}

/* A department more than a day behind the newest read has stalled. The build
   decides that (a.stalled) and dates it, and every surface that mentions such
   a department says the same thing, through capDay and stalledText. The text
   says when the first and last good reads were and never guesses why the
   reads stopped returning data, since nothing in the archive can say. */
/* The day the pages were last rebuilt, in Michigan time, so an evening
   rebuild never reads as the next day. The timeline carries the same rule. */
function refreshedLabel(iso) {
  const day = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
  return `Last refreshed: ${dayLabel(day)}, ${day.slice(0, 4)}`;
}

const capDay = (a) => (a.captured_day ? dayLabel(a.captured_day) : "never");
function stalledText(a) {
  const dropped = a.dropped || [];
  return `<b>${esc(a.name)}</b> is ${a.on_daily_read ? "still read every day" : "no longer read every day"}, `
    + `but no read since ${capDay(a)} has returned any data. `
    + `The ledger first captured its portal on ${dayLabel(a.first_read_day)}, taking in ${fmt(a.first_capture_rows)} `
    + `${plural(a.first_capture_rows, "search", "searches")}${a.search_days ? ` going back to ${dayLabel(a.search_days[0])}` : ""}, `
    + `and kept capturing it until ${capDay(a)}. Everything this page shows for ${esc(a.name)} stops there.`
    + (dropped.length
      ? ` Before that, on ${dayLabel(dropped[0].since.slice(0, 10))}, its portal was rebuilt and stopped publishing `
        + `${esc(listOf(dropped.map((x) => x.label.toLowerCase())))}; the lists shown for it are the last ones it published, `
        + `on ${dayLabel(dropped[0].last.slice(0, 10))}.`
      : "")
    + (a.portal_url ? ` <a href="${esc(a.portal_url)}" rel="noopener">Open its portal</a> to see what it shows today.` : "");
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
    `A plate read in ${esc(hl.county)} is searchable from <em>${fmt(hl.states)}</em> States.`;
  // The running total of searches the ledger holds, under the headline. It
  // is dated from the oldest search (audit_from), never from the first read:
  // each portal's first read took in the thirty days it was still showing,
  // so about half the total predates the day the ledger began, and "since
  // the ledger began" over this figure would be false. The scope sentence
  // says "of those" because some known portals (Troy, Ferndale, Milan)
  // publish no search list and are not among sc.agencies. The statewide
  // count is a floor, counted at build time from the portals' own sharing
  // lists (scope.mi_agencies), hence "at least".
  document.getElementById("tally").innerHTML =
    `<span class="tally-lead">This site monitors every Michigan agency that subscribes to Flock and has made its transparency portal public. `
    + `Each portal names the agencies allowed to search its cameras and the agencies whose cameras it can search. `
    + `Those names add up to at least ${fmt(sc.mi_agencies)} Michigan agencies on Flock. `
    + `Of those, ${fmt(sc.agencies)} departments in ${fmt(sc.counties)} counties publish their searches.</span>`
    + `<span class="tally-num">${fmt(sc.searches)}</span>`
    + `<span class="tally-text">searches have been performed by officers across all tracked agencies since ${dayLabel(sc.audit_from)}, ${sc.audit_from.slice(0, 4)}.</span>`;
  // How this works. expired_rows counts ledger rows absent from each
  // portal's latest live file (measured, not a 30-day cutoff).
  document.getElementById("about-text").innerHTML =
    `Each Flock portal only publishes the last ${fmt(sc.window_days)} days of data. We capture every portal every day, building a rolling ledger of each addition, deletion and change from one day to the next. `
    + `So far that is <b class="about-n">${fmt(sc.expired_rows)}</b> previously published records that now take a FOIA request to retrieve from the departments. `
    + `The ledger keeps every one as it disappears, saving you the time and effort of a request. This page is rebuilt from that ledger daily.`;
  const repo = esc(d.archive_repo);
  document.getElementById("about-links").insertAdjacentHTML("afterbegin",
    `<li><a href="${repo}">The archive on GitHub</a></li>`
    + `<li><a href="${repo}/tree/site">This page&rsquo;s source on GitHub</a></li>`);
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
    // Searches are the two line items the department card leads with: the
    // portal's own last-thirty-days count and everything on record.
    // One line each, plain text: the columns are narrow, and every span in a
    // row is a block, so a nested marker would land on a line of its own.
    const recentLine = (a) => {
      const rs = recentSearches(d, a);
      if (rs.n == null) return "no thirty-day count";
      return `${fmt(rs.n)} ${plural(rs.n, "search", "searches")} in the last 30 days${rs.heading ? ", counted differently" : ""}`;
    };
    const rows = c.slugs.map((sl) => byAgency[sl]).filter(Boolean).map((a) =>
      `<li><div class="dept-main"><button type="button" class="dept-link" data-slug="${esc(a.slug)}">${esc(a.name)}</button>`
      + `<span class="dept-recent">${recentLine(a)}</span>`
      + `<span class="dept-kept">${fmt(a.searches)} ${plural(a.searches, "search", "searches")} on record</span>`
      + `<span>${a.had_out ? `${fmt(a.out_total)} can search it` : `<span class="muted">no sharing list</span>`}</span>`
      + `<span class="fresh${freshness(d, a).stale ? " stale" : ""}">${freshness(d, a).short}</span></div>`
      + `<div class="dept-cams"><b>${a.cameras == null ? "&ndash;" : fmt(a.cameras)}</b><small>${a.cameras === 1 ? "camera" : "cameras"}</small></div></li>`).join("");
    div.innerHTML = `
      <h3>${esc(c.name)}</h3>
      <p class="sub">${c.agencies} ${plural(c.agencies, "department")} &middot; ${fmt(c.cameras)} cameras</p>
      <div class="county-figs">
        <div><span>${c.publish_out ? fmt(c.out_total) : "&ndash;"}</span><span>${c.publish_out ? "outside organizations can search its cameras" : "publishes no sharing list"}</span></div>
        <div><span>${c.publish_out ? c.out_states : "&ndash;"}</span><span>states they sit in</span></div>
        <div><span>${fmt(c.searches)}</span><span>searches its officers ran, in the ledger</span></div>
        <div><span>${c.wide_pct}%</span><span>of searches reached past ${fmt(d.wide_reach_threshold)} camera networks</span></div>
      </div>
      <ul class="county-depts">${rows}</ul>`;
    div.querySelectorAll(".dept-link").forEach((btn) => {
      const a = byAgency[btn.dataset.slug];
      hover(btn, `<b>${esc(a.name)}</b><br><span class="k">${a.had_out ? `${fmt(a.out_total)} outside organizations in ${a.out_states} states can search its cameras` : "publishes no sharing list"}`
        + ` &middot; ${(() => { const rs = recentSearches(d, a); return rs.n == null ? "" : `${fmt(rs.n)} searches in the last 30 days${rs.heading ? ` (its portal&rsquo;s heading: ${esc(rs.heading)})` : ""}, `; })()}`
        + `${fmt(a.searches)} on record &middot; open its card</span>`);
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
      <h4 class="geo-panel-head">${selState ? esc(label) : "Every state"}</h4>
      <p class="geo-panel-sub">${fmt(rows.length)} organization${rows.length === 1 ? "" : "s"}`
      + `${dept === "all" ? "" : ` &middot; can search ${esc(om.agency_names[dept])}&rsquo;s cameras`}`
      + `${dept === "all" && county !== "all" ? ` &middot; ${esc(d.counties.find((c) => c.key === county).name)}` : ""}`
      + `${kind === "all" ? "" : ` &middot; ${esc(om.kind_labels[kind] || kind)}`}`
      + `${selState ? " &middot; click the state again to clear" : " &middot; click a state to narrow"}</p>`
      + (rows.length ? `<div class="geo-list">${order.map((kk) => `
          <div class="geo-kind"><h5>${esc(om.kind_labels[kk] || kk)} (${byKind[kk].length})</h5>
          ${byKind[kk].slice(0, 200).map((e) => `<div class="geo-item">
              <i style="background:${cssvar(bucketOf(e.c).css)}"></i>
              <span>${esc(e.n)}<span class="where"><br>${esc(e.p || "location not resolved")}${e.s ? `, ${esc(e.s)}` : ""}`
              + `${e.h.startsWith("county") ? " (placed at the middle of the county)" : e.h === "statewide" ? " (statewide)" : e.h === "state" ? " (names only a state)" : ""}</span></span>
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
    deptCtl = chips(deptHost, "Can search the cameras of", items, (v) => v === dept, (v) => {
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

  const listed = spread.filter((x) => x.n > 0);
  const singleListed = singleBy.filter((x) => x.rows.length > 0);
  document.getElementById("find-geo").innerHTML =
    `Most of the organizations that can search these cameras are far away. The typical one is <b>${fmt(q(0.5))} miles</b> from the nearest county here; `
    + `${fmt(within(50))} are within fifty miles and ${fmt(dists.length - within(500))} are more than five hundred miles away. `
    + `Nearly all are local police: ${fmt(police)} city and town police departments and ${fmt(sheriffs)} county sheriffs. `
    + (listed.length > 1 ? `Reach differs widely by department: ${esc(om.agency_names[listed[0].sl])}&rsquo;s list covers <b>${fmt(listed[0].n)}</b> organizations in ${listed[0].states} states, `
      + `${esc(om.agency_names[listed[listed.length - 1].sl])}&rsquo;s covers ${fmt(listed[listed.length - 1].n)} in ${listed[listed.length - 1].states}. ` : "")
    + (singleListed.length ? `${fmt(single.length)} organizations can reach just one county here, ${fmt(singleListed[0].rows.length)} of them ${esc(singleListed[0].c.name)}. ` : "")
    + `Each is placed from its own name: ${fmt(om.precise)} of the ${fmt(om.entries.length)} at their city or county, ${fmt(om.statewide)} statewide bodies at the middle of their state, `
    + `and ${fmt(om.imprecise)} that name only a state, drawn as smaller dots.`;

  document.getElementById("tbl-orgs").appendChild(
    table(om.entries.map((e) => [
      e.n, e.p || "", e.s || "", om.kind_labels[e.k] || e.k,
      B.names(e.c).map((n) => n.replace(/ County$/, "")).join(", "),
      om.agency_keys.filter((sl, i) => e.a >> i & 1).map((sl) => om.agency_names[sl]).join(", "),
      e.h,
    ]), ["Organization", "Placed at", "State", "Kind", "Can search cameras in",
      "Can search the cameras of", "How it was placed"]));
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
      `Organizations that can search, by state${scope === "all" ? "" : ` (${scopes.find((x) => x.value === scope).label})`}`;

    const mi = ranked.find((s) => s.code === "MI");
    const total = scope === "all"
      ? d.orgs_total
      : d.counties.find((c) => c.key === scope).out_total;
    const away = total - (mi ? mi.n : 0);
    const topAway = ranked.find((s) => s.code !== "MI");
    const byStates = d.counties.filter((c) => c.publish_out).sort((a, b) => b.out_states - a.out_states);
    document.getElementById("find-reach").innerHTML = scope === "all"
      ? `Only <b>${fmt(mi.n)}</b> of the ${fmt(total)} organizations that can search these cameras are in Michigan; the most outside it are in ${esc(topAway ? topAway.code : "")}. `
        + `County by county it differs: ${esc(byStates[0].name)}&rsquo;s cameras can be searched from ${byStates[0].out_states} states, `
        + `${esc(byStates[byStates.length - 1].name)}&rsquo;s from ${byStates[byStates.length - 1].out_states}.`
        + (silentC.length ? ` ${esc(listOf(silentC.map((c) => c.name)))} ${plural(silentC.length, "has", "have")} no portal that publishes a sharing list, so ${plural(silentC.length, "it has", "they have")} no chip here.` : "")
      : `${esc(scopes.find((x) => x.value === scope).label)}&rsquo;s cameras can be searched by <b>${fmt(total)}</b> organizations in <b>${ranked.length}</b> states, `
        + `${fmt(away)} of them outside Michigan. ${fmt(d.counties.find((c) => c.key === scope).exclusive.count)} of them can search this county&rsquo;s cameras and no other county&rsquo;s here.`;
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
    `<b>${esc(local.name)}</b> lets ${fmt(local.out_total)} outside organizations search its cameras${local.out_away ? `, ${fmt(local.out_away)} of them outside Michigan` : ", all of them in Michigan"}. `
    + `<b>${esc(open.name)}</b>, in the same county with the same cameras from the same company, lets ${fmt(open.out_total)} search, ${fmt(open.out_away)} of them outside Michigan. `
    + `The difference is each department&rsquo;s own choice. `
    + `The ${words(listed.length)} ${esc(big.county.name)} lists overlap heavily, so the county&rsquo;s combined list, ${fmt(big.county.out_total)}, is `
    + `${big.county.out_total - largest.out_total < largest.out_total * 0.1 ? "barely more than" : "set against"} ${esc(largest.name)}&rsquo;s own ${fmt(largest.out_total)}: `
    + `in practice, the most open department decides how widely the whole county can be searched.`;

  document.getElementById("tbl-sharing").appendChild(
    table([
      ...d.agencies.map((a) => [a.name, a.county, a.had_out ? fmt(a.out_total) : "not published", a.had_out ? fmt(a.out_mi) : "", a.had_out ? fmt(a.out_away) : "", a.had_out ? a.out_states : "", a.had_in ? fmt(a.in_total) : "not published"]),
      ...d.counties.map((c) => [`${c.name} combined`, c.name, fmt(c.out_total), fmt(c.out_mi), fmt(c.out_away), c.out_states, fmt(c.in_total)]),
    ], ["Department", "County", "Can search its cameras", "In Michigan", "Outside Michigan", "States", "Whose cameras it can search"]));
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
  /* A line covers only the days its own portal's file reached. Past that
     span a zero is a day nobody read, so it is drawn as a gap, never as a
     drop, and kept out of every per-day figure below. */
  const covers = (s, i) => !s.covered || (t.days[i] >= s.covered[0] && t.days[i] <= s.covered[1]);
  const span = (s) => {
    const idx = t.days.map((_, i) => i).filter((i) => covers(s, i));
    return [idx[0], idx[idx.length - 1]];
  };

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
    const values = scaleFrom.flatMap((s) => s[metric].filter((v, i) => covers(s, i))).filter((v) => v != null);
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
      s[metric].forEach((v, i) => { if (v != null && covers(s, i)) pts.push([X(i), Y(v)]); });
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
          + `<b>${!covers(byKey[k], i) ? "not read" : v == null ? "no searches" : m.int ? fmt(v) : `${v}%`}</b>`;
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

  // Late means first read after the first night of capture, not a line that
  // starts a day after Kent's, whose grafted history reaches one day further.
  const agencyOf = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const agencyLines = t.series.filter((s) => s.kind === "agency");
  const late = agencyLines.filter((s) => agencyOf[s.key] && agencyOf[s.key].first_read_day > d.scope.first_capture);
  const early = agencyLines.filter((s) => s.covered && s.covered[1] < t.days[t.days.length - 1]);
  document.getElementById("trend-note").textContent =
    `${t.days.length} days, from ${dayLabel(t.days[0])} to ${dayLabel(t.days[t.days.length - 1])}. `
    + `The first and last day are only partly covered, so they are drawn faded. `
    + `A line only covers the days its portal's file reached, so a line that starts late or stops early means the portal was not read then, not that nobody searched`
    + (late.length ? `: ${listOf(late.map((s) => s.name))} ${plural(late.length, "was", "were")} first read after ${dayLabel(d.scope.first_capture)}` : "")
    + (early.length ? `${late.length ? ", and" : ":"} ${listOf(early.map((s) => cityFile(agencyOf[s.key])
      ? `${s.name}'s line stops on ${dayLabel(s.covered[1])} because the City of Holland has not yet posted its file for the days after`
      : `${s.name}'s line stops on ${dayLabel(s.covered[1])} because no read since ${dayLabel(agencyOf[s.key].captured_day)} has returned data`))}` : "")
    + `.`;

  // small multiples, every source at a glance
  const host = document.getElementById("sparks");
  const agencySeries = t.series.filter((s) => s.kind === "agency");
  const peak = Math.max(...agencySeries.flatMap((s) => s.searches), 1);
  agencySeries.forEach((s) => {
    const div = document.createElement("div");
    div.className = "spark";
    const [i0, i1] = span(s);
    const covered = s.searches.slice(i0, i1 + 1);
    const total = covered.reduce((a, b) => a + b, 0);
    const active = covered.filter((v) => v > 0).length;
    div.innerHTML = `<h4>${esc(s.name)}</h4>
      <div class="meta">${fmt(total)} searches &middot; some on ${active} of the ${covered.length} days covered</div>`;
    const sw = 210, sh = 48;
    const sp = el("svg", { viewBox: `0 0 ${sw} ${sh}`, width: sw, height: sh,
      role: "img", "aria-label": `${s.name} daily searches` });
    const SX = (i) => (i / (t.days.length - 1)) * sw;
    const SY = (v) => sh - 3 - (v / peak) * (sh - 8);
    const pts = covered.map((v, j) => `${j ? "L" : "M"}${SX(i0 + j).toFixed(1)},${SY(v).toFixed(1)}`).join(" ");
    sp.appendChild(el("path", {
      d: `${pts} L${SX(i1).toFixed(1)},${sh} L${SX(i0).toFixed(1)},${sh} Z`,
      fill: cssvar("--series-1"), "fill-opacity": 0.13, stroke: "none",
    }));
    sp.appendChild(el("path", {
      d: pts, fill: "none", stroke: cssvar("--series-1"),
      "stroke-width": 1.5, "stroke-linejoin": "round",
    }));
    div.appendChild(sp);
    hover(div, `<b>${esc(s.name)}</b><br>${fmt(total)} searches over the ${covered.length} days read, ${t.days[i0]} to ${t.days[i1]}<br>`
      + `<span class="k">busiest day ${fmt(Math.max(...s.searches))} &middot; all sparklines share one scale</span>`);
    host.appendChild(div);
  });

  // A claim the data can support: which source swings hardest day to day.
  const rank = agencySeries
    .filter((s) => s.searches.reduce((a, b) => a + b, 0) > 200)
    .map((s) => {
      // The covered days without their two partial edges.
      const [i0, i1] = span(s);
      const v = s.searches.slice(i0 + 1, i1);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
      return { name: s.name, cv: sd / mean, mean };
    }).sort((a, b) => b.cv - a.cv);
  const vol = agencySeries.map((s) => ({ name: s.name, n: s.searches.reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n);
  const top2 = vol[0].n + vol[1].n, rest = vol.slice(2).reduce((a, b) => a + b.n, 0);
  document.getElementById("find-trend").innerHTML =
    `The small charts all use one scale, so the busiest departments stand out: `
    + `${esc(vol[0].name)} and ${esc(vol[1].name)} ${top2 > rest ? `run more searches than the other ${words(vol.length - 2)} departments combined` : `run ${Math.round(top2 / (top2 + rest) * 100)}% of all searches`}. `
    + `Of the ${words(rank.length)} departments busy enough to judge, <b>${esc(rank[0].name)}</b> is the least steady from day to day, `
    + `swinging ${(rank[0].cv * 100).toFixed(0)}% either side of about ${rank[0].mean.toFixed(0)} searches a day, `
    + `and <b>${esc(rank[rank.length - 1].name)}</b> the steadiest, at ${(rank[rank.length - 1].cv * 100).toFixed(0)}% either side of ${rank[rank.length - 1].mean.toFixed(0)}. `
    + `${Words(t.days.length)} days is enough to see a weekly rhythm, not a trend.`;
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
        <span class="where">dropped by ${esc(listOf(r.agencies))} &middot; ${dayLabel(r.first.slice(0, 10))} to ${dayLabel(r.last.slice(0, 10))}</span></span>
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
          ${dayLabel(e.at.slice(0, 10))} &middot; ${e.direction === "outbound" ? "who can search its cameras" : "whose cameras it can search"}
          <div class="change-delta">${fmt(e.before)} &rarr; ${fmt(e.after)}
            ${e.added.length ? `&middot; +${e.added.length}` : ""}${e.removed.length ? ` &middot; &minus;${e.removed.length}` : ""}</div>
          ${e.suspect ? `<span class="flag">capture fault</span>` : ""}
        </div>
        <div>
          ${e.suspect ? `<p class="hint" style="margin:0">${esc(e.suspect_why)}. This read went wrong, so it is shown here and left out of every count on the page, and the names it produced are not listed.</p>` : ""}
          <div class="orgs">${orgChips(e.added, "add")}${orgChips(e.removed, "rem")}</div>
        </div>
      </div>`).join("") || `<div class="change"><div class="change-when">No changes match this filter.</div></div>`;
  };

  const dirCtl = chips(document.getElementById("change-controls"), "Direction", [
    { value: "all", label: "Both", dot: false },
    { value: "outbound", label: "Who can search its cameras", dot: false },
    { value: "inbound", label: "Whose cameras it can search", dot: false },
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
    `In ${fmt(d.scope.capture_days)} days of capture the ledger has seen <b>${real.length}</b> changes to these departments&rsquo; sharing lists: `
    + `${fmt(adds)} organizations added and ${fmt(rems)} dropped. `
    + (top ? `The largest single departure: <b>${esc(top.org)}</b> disappeared from ${words(top.n)} portals between ${dayLabel(top.first.slice(0, 10))} and ${dayLabel(top.last.slice(0, 10))}, `
      + `which is what one organization leaving the network looks like from outside. ` : "")
    + (all.length - real.length ? `${Words(all.length - real.length)} more ${plural(all.length - real.length, "read", "reads")} went wrong and returned page code instead of a list; ${plural(all.length - real.length, "it is", "they are")} shown above and left out of every count.` : "");
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
    `A typical <b>${esc(hiM.name)}</b> search reaches <b>${fmt(hiM.net_median)}</b> camera networks. A typical <b>${esc(loM.name)}</b> search reaches <b>${fmt(loM.net_median)}</b>. `
    + `The gap is habit, not capability: <b>${wide.length}</b> of these ${searching.length} departments${wide.includes(loM) ? `, ${esc(shortName(loM.name))} among them,` : ""} have run at least one search past ${fmt(CEIL)}.`;

  document.getElementById("tbl-radius").appendChild(
    table(searching.map((a) => [a.name, a.county, fmt(a.searches), fmt(a.net_min), fmt(a.net_p25), fmt(a.net_median), fmt(a.net_p75), fmt(a.net_max)]),
      ["Department", "County", "Searches", "Narrowest", "A quarter under", "Typical", "Three quarters under", "Widest"]));
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
      <span class="k">typical reach ${fmt(o.reach_median)} camera networks &middot; nine in ten under ${fmt(o.reach_p90)}<br>
      ${fmt(o.wide)} of ${fmt(o.reach_n)} reached past ${fmt(d.wide_reach_threshold)}</span>`);
    svg.appendChild(hit);
  });

  const low = d.offenses.filter((o) => o.low).reduce((s, o) => s + o.count, 0);
  const wc = d.offenses.find((o) => o.type === "Welfare Check");
  const al = d.offenses.find((o) => o.type === "Alcohol Offenses (Non-DUI)");
  const hom = d.offenses.find((o) => o.type === "Homicide/Death Investigation");
  document.getElementById("find-offense").innerHTML =
    `<b>${fmt(low)}</b> searches, ${((low / total) * 100).toFixed(1)}% of those with a reason, give a reason that names no crime. `
    + `Those tend to reach furthest: <b>${al.wide_pct.toFixed(0)}%</b> of alcohol searches other than drunk driving reach past ${fmt(d.wide_reach_threshold)} camera networks, `
    + `and <b>${wc.wide_pct.toFixed(0)}%</b> of welfare checks do, against <b>${hom.wide_pct.toFixed(0)}%</b> of homicide and death investigations. `
    + `One welfare check in ten reaches more than ${fmt(wc.reach_p90)} networks. The least serious reasons travel the furthest.`;

  document.getElementById("tbl-offense").appendChild(
    table(d.offenses.map((o) => [
      o.type, fmt(o.count), `${((o.count / total) * 100).toFixed(1)}%`,
      fmt(o.reach_median), fmt(o.reach_p90), `${o.wide_pct.toFixed(1)}%`, o.low ? "yes" : "",
    ]),
    ["Stated reason", "Searches", "Share", "Typical reach, in networks", "Nine in ten reach under",
      `Share reaching ${fmt(d.wide_reach_threshold)}+`, "Names no crime"]));
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
      `${esc(label)}: searches follow office hours more than they follow crime. `
      + `The busiest hour is ${days[peakDay]} at ${String(peakHr).padStart(2, "0")}:00, with ${fmt(peak)} searches, `
      + `and <b>${((night / tot) * 100).toFixed(1)}%</b> run between 10 at night and 6 in the morning. `
      + `This chart needs months of data before it says much.`;
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
    const dropped = r.dropped.length ? `<br><span class="muted">stopped publishing ${r.dropped.length} on ${dayLabel(r.dropped[0].since.slice(0, 10))}</span>` : "";
    return `<span class="mark ${on === VAR.length ? "yes" : "no"}">${on === VAR.length ? "●" : on ? "◐" : "○"} ${on} of ${VAR.length}</span><span class="dotrow">${dots}</span>${dropped}`;
  };
  t.innerHTML = `<thead><tr>
      <th>Department</th><th>Optional figures</th><th>Reason given for each search</th><th>User column</th>
      <th>Rules for using the cameras</th><th>Uses it rules out in writing</th>
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
    `<b>${esc(best.name)}</b> tells you the most: ${best.published} of the ${VAR.length} optional figures, a reason on ${best.reason_pct}% of its searches and ${best.prohibition_count} uses ruled out in writing. `
    + `<b>${esc(worst.name)}</b> tells you the least: ${worst.published} of the ${VAR.length} optional figures, a reason on ${worst.reason_pct}% of its searches and the user column filled on ${worst.user_pct}%. `
    + (noAup.length ? `${Words(noAup.length)} of the ${words(n)} portals ${plural(noAup.length, "has", "have")} no rules-of-use section this ledger can find (${esc(listOf(noAup.map((r) => r.name)))}). ` : `Every portal has a rules-of-use section. `)
    + `<b>${Words(repro.length)}</b> of the ${words(n)}${repro.length ? `, ${esc(listOf(repro.map((r) => r.name)))},` : ""} ${plural(repro.length, "names", "name")} reproductive rights investigations as off limits, `
    + `while ${imm.length === n ? `all ${words(n)}` : `${words(imm.length)} of the ${words(n)}`} name immigration enforcement. `
    + Object.entries(byDept).map(([name, cs]) =>
      `<b>${esc(name)}</b>&rsquo;s portal was rebuilt on ${dayLabel(cs[0].since.slice(0, 10))} and stopped publishing ${esc(listOf(cs.map((c) => c.label.toLowerCase())))}, `
      + `though its search log continued; the lists it published until ${dayLabel(cs[0].last.slice(0, 10))} are the ones this page uses for it.`).join(" ")
    + (() => {
      // One sentence per caption, not per portal: the same wording on six
      // tiles is one fact.
      const groups = {};
      tr.relabelled.forEach((r) => { (groups[`${r.tile}|${r.reads}|${r.usual}`] ||= []).push(r); });
      return Object.values(groups).map((rs) => {
        const r = rs[0];
        return ` ${esc(listOf(rs.map((x) => x.name)))} ${plural(rs.length, "labels its", "label their")} ${r.tile} figure `
          + `&ldquo;${boldOther(r.reads)}&rdquo; where the other portals say &ldquo;${boldOther(r.usual)}&rdquo;, so the two do not count the same thing.`;
      }).join("");
    })();

  const uc = d.user_column;
  const fills = uc.rows.filter((r) => r.filled_pct === 100);
  document.getElementById("user-column").innerHTML =
    `<h4>The user column does not name anyone</h4>`
    + `<p>Each search in the downloadable log has a user column. ${Words(fills.length)} of the ${words(uc.rows.length)} portals fill it on every search, and every `
    + `one fills it with <span class="quote">${esc(uc.marker)}</span>. The column says an officer ran the search and hides which one, so <b>no portal here identifies an `
    + `officer</b>, not even by a stand-in name that would show two searches came from the same person.</p>`
    + `<p>That makes the user column in the table above a weaker difference than it looks. `
    + (uc.blank_portals.length
      ? `${esc(listOf(uc.blank_portals))} ${plural(uc.blank_portals.length, "leaves", "leave")} it empty`
      : "One portal leaves it empty")
    + (uc.partial_portals.length
      ? ` and ${esc(listOf(uc.partial_portals))} ${plural(uc.partial_portals.length, "fills", "fill")} it on `
        + `${uc.rows.find((r) => r.name === uc.partial_portals[0]).filled_pct}% of rows`
      : "")
    + `, which can look like more or less openness. It is not: none of them shows who searched, `
    + `because the field is blanked out before it is published. This ledger checks that on every build.</p>`;

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
    <p>Each portal offers a downloadable log of the searches <em>its own officers ran</em>, with the time,
    how far each search reached, and usually the reason. That is the transparency people point to.</p>
    <p>The ${fmt(d.orgs_total)} outside organizations can search these cameras too, and their searches appear
    in no public log on any of these portals. ${esc(mostShared.name)} is the most widely shared department here:
    its log covers ${fmt(mostShared.searches)} searches by its own officers, while
    ${fmt(mostShared.out_total)} outside agencies can search the same cameras with no public log at all.
    The published log shows the smaller half of what happens.</p>
    <p class="quote">"All system access requires a valid law enforcement reason. All system activity is
    routinely audited. All system access is stored indefinitely." The record is real and kept forever.
    The public sees thirty days of one direction of it.</p>`;

  const pp = d.policy_vs_practice;
  const conflict = pp.filter((r) => r.prohibits && r.traffic > 0);
  const nolimit = pp.filter((r) => !r.prohibits && r.traffic > 0);
  document.getElementById("policy-practice").innerHTML = `
    <h4>Where the policy and the log disagree</h4>
    <p>${Words(pp.filter((r) => r.prohibits).length)} of the ${words(pp.length)} portals rule out traffic enforcement as a use of the cameras. Their own search logs include searches
    whose stated reason is a traffic offence.</p>
    ${pp.filter((r) => r.prohibits || r.traffic).map((r) => `
      <div class="pp-row">
        <span>${esc(r.name)}</span>
        <span class="${r.prohibits ? "yes" : "no"}">${r.prohibits ? "rules out traffic enforcement" : "no such rule"}</span>
        <span>${fmt(r.traffic)} traffic searches</span>
      </div>`).join("")}
    <p style="margin-top:1rem">This sets two of a department&rsquo;s own statements side by side; it does not prove a rule was broken.
    A traffic offence can come up inside a criminal investigation, and the portal never publishes the
    notes that would settle which it was. The department publishes the rule and a number, and withholds the one detail that would let anyone check.</p>
    ${conflict.length ? `<p><b>${esc(listOf(conflict.map((r) => r.name)))}</b> publish both the rule and the searches.
      ${nolimit.length ? `<b>${esc(nolimit[0].name)}</b> has no such rule and logged the most traffic searches of any department, ${fmt(nolimit[0].traffic)}.` : ""}</p>` : ""}`;
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
    + `<span>widest search each day, counting only days with one past ${fmt(ns.threshold)} camera networks</span>`;

  const a = ns.series[0], b = ns.series[1];
  const worst = ns.agreement.length
    ? Math.max(...ns.agreement.map((x) => Math.abs(x.diff))) : 0;
  document.getElementById("find-net").innerHTML =
    `At the start of the archive, <b>${esc(a.name)}</b>&rsquo;s widest search reached ${fmt(a.first)} camera networks. At the end it reached ${fmt(a.last)}, `
    + `<b>${fmt(-a.change)}</b> fewer in ${a.span_days} days, about ${Math.abs(a.slope).toFixed(0)} a day. `
    + (b ? `<b>${esc(b.name)}</b>&rsquo;s widest searches fell at the same pace, and the two agreed to within ${fmt(worst)} networks on all ${ns.agreement.length} days both ran one. ` : "")
    + `${b ? "The two departments" : esc(a.name)} share with mostly different agencies, so this is not one department&rsquo;s partners leaving: the whole national network shrank by about <b>${(Math.abs(a.change) / a.first * 100).toFixed(0)}%</b>.`;

  const ov = ns.overlap;
  document.getElementById("net-limit").innerHTML = `
    <h4>Can this say which agencies left? No</h4>
    <p>The widest search counts camera networks across the whole country, not organizations, and it falls by about ${Math.abs(a.slope).toFixed(0)} a day.
    Only the sharing lists can name an organization that left, and they name two or three a day.</p>
    ${ov.length ? `<p>On days when both are available, they do not move together:</p>
      ${ov.map((o) => `<div class="pp-row">
        <span>${dayLabel(o.day)}</span>
        <span class="${o.delta != null && o.delta < -20 ? "yes" : "no"}">${o.delta == null ? "first day" : `widest search ${o.delta > 0 ? "+" : ""}${o.delta}`}</span>
        <span>${o.named} ${plural(o.named, "organization")} named as leaving</span>
      </div>`).join("")}
      <p style="margin-top:1rem">They measure different things, and no arithmetic joins them.</p>` : ""}
    <p><b>What would work.</b> Given months of daily reads, there will be days when exactly one organization leaves and the widest search drops by a known amount, which is how many networks that organization brought with it. There ${ov.length === 1 ? "is one day" : `are ${fmt(ov.length)} days`} with both signals so far.</p>`;
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
  // Inclusive local days, the same count the timeline prints for its window.
  const spanDays = d.scope.capture_days;
  const widest = [...d.network_departures].sort((a, b) => b.n - a.n)[0];
  const bits = [
    `In ${fmt(spanDays)} days of capture the archive recorded <b>${real.length}</b> changes to sharing lists that the live portals do not show`
    + (widest ? `, including one organization dropped by ${words(widest.n)} portals in ${words(widest.span_days + 1)} ${plural(widest.span_days + 1, "day")}.` : "."),
  ];
  if (veh.length) {
    bits.push(`The vehicle counts move both ways over the same span, falling for ${down} of ${veh.length} departments, `
      + `which is how you can tell they cover the last thirty days and are not running totals.`);
  }
  const faults = d.sharing_changes.length - real.length;
  if (faults) {
    bits.push(`It also caught ${faults} bad ${plural(faults, "read")}, where a portal returned page code instead of the sharing list and recovered hours later. `
      + `A single reading would have taken the error for the truth.`);
  }
  document.getElementById("foot-archive").innerHTML = bits.join(" ");
  const filed = d.agencies.filter((a) => cityFile(a));
  const fc = document.getElementById("foot-city-file");
  if (filed.length) {
    fc.hidden = false;
    fc.innerHTML = `<strong>Days behind.</strong> Flock&rsquo;s own portals list searches as a rolling thirty days, current as of the page. `
      + `${esc(listOf(filed.map((a) => a.name)))} ${plural(filed.length, "has", "have")} not done that since the portal began linking a file its city posts once a month instead, so ${plural(filed.length, "its searches arrive", "their searches arrive")} in a batch after the month closes. `
      + `A department read every day can still be behind, so the ledger counts days behind from the last day that file covers, not from the last read: `
      + `${esc(listOf(filed.map((a) => `${a.name} was ${a.days_behind} ${plural(a.days_behind, "day")} behind on the ${dayLabel(d.scope.last_capture)} read, for a file through ${dayLabel(a.audit_source.through)}`)))}. `
      + `The count falls back once the next file is posted, and the days between are drawn as a gap, never as days with no searches.`;
  }
  document.getElementById("foot-unresolved").textContent =
    `${d.unresolved_orgs.length} of ${fmt(d.orgs_total)} organizations name no state that can be read and are left off the map and the state ranking.`;
  document.getElementById("foot-built").innerHTML =
    `Built ${d.generated_at.replace("T", " ").replace("Z", " UTC")} from ` // leak-linter:allow (build stamp, not a schedule)
    + `<a href="${esc(d.archive_repo)}/commit/${esc(d.archive_commit)}">archive commit ${esc(d.archive_commit)}</a>`
    + `${d.archive_commit_at ? ` of ${esc(d.archive_commit_at.slice(0, 10))}` : ""}. `
    + `The archive itself is public: <a href="${esc(d.archive_repo)}">${esc(d.archive_repo.replace("https://", ""))}</a>.`;
  document.getElementById("gen").textContent = refreshedLabel(d.generated_at);
}

/* --- department profile, a re-view of everything else on one card ---- */

function profilePanel(d) {
  const host = document.getElementById("profile-controls");
  const body = document.getElementById("profile-body");
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const hit = Object.fromEntries(d.exposure.hit_rate.map((r) => [r.slug, r]));
  const rec = Object.fromEntries(d.exposure.reciprocity.map((r) => [r.slug, r]));
  const pos = Object.fromEntries(d.posture.rows.map((r) => [r.slug, r]));
  const tra = Object.fromEntries(d.transparency.rows.map((r) => [r.slug, r]));
  const PL = d.transparency.prohibition_labels;
  const events = {};
  d.sharing_changes.forEach((c) => {
    if (c.suspect) return;
    events[c.slug] = (events[c.slug] || 0) + (c.added || []).length + (c.removed || []).length;
  });

  // Opens on the first county's first department (Kent County SO), so the
  // card says something before anyone picks; clicking it again closes it.
  let open = (d.counties[0] && d.counties[0].slugs.find((sl) => byAgency[sl])) || null;
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
  const notShown = (a, field) => (a.dropped.some((x) => x.field === field) ? "no longer published" : "not published");

  function render() {
    if (!open) {
      body.innerHTML = '<p class="hint" style="margin:0">'
        + "Pick a department to see its main figures on one card.</p>";
      return;
    }
    const a = byAgency[open];
    const h = hit[open] || {}, r = rec[open] || {}, p = pos[open] || {}, t = tra[open] || {};
    const topKind = (d.fingerprint.top[open] || [])[0];
    const rate = h.per_1k == null ? notShown(a, "hits")
      : `${h.per_1k}${h.comparable ? "" : "<small> counted differently</small>"}`;
    const ruled = Object.keys(PL).filter((k) => (t.prohibitions || {})[k]).map((k) => PL[k].toLowerCase());
    const lastRead = a.stalled
      ? fig("Last good read", capDay(a), "no data since then")
      : fig("Last read", capDay(a), a.new_rows_last_read ? `${fmt(a.new_rows_last_read)} new ${plural(a.new_rows_last_read, "search", "searches")}` : "nothing new that day");
    // Searches as two line items: the portal's own rolling count from the
    // latest read (recentSearches), and everything the ledger holds. The
    // second is dated from the oldest search it holds with the first read
    // beside it, because each portal's first read took in the thirty days it
    // was still showing.
    const rs = recentSearches(d, a);
    const recent = rs.n == null
      ? fig("Searches, last 30 days", notShown(a, "searches"), "")
      : fig("Searches, last 30 days", fmt(rs.n), `its portal&rsquo;s own count, read ${capDay(a)}`
        + (rs.heading ? `, under the heading &ldquo;${esc(rs.heading)}&rdquo;` : ""));
    const kept = fig("Searches on record", fmt(a.searches),
      a.search_days ? `back to ${dayLabel(a.search_days[0])}; first read ${dayLabel(a.first_read_day)}` : "");
    body.innerHTML = `<div class="prof-card${a.stalled ? " stalled" : ""}">`
      + `<h3>${esc(a.name)}</h3>`
      + `<p class="prof-sub">${esc(a.county)} &middot; ${esc(freshness(d, a).text)}</p>`
      + `<div class="prof-figs main">`
      + fig("Cameras, by its own count", a.cameras != null ? fmt(a.cameras) : "not published",
        a.camera_def ? (/and other cameras/i.test(a.camera_def) ? "plate readers <b>and other cameras</b>" : "plate readers") : "")
      + recent
      + kept
      + fig(`Outside orgs that can search ${a.name}\u2019s cameras`, a.had_out ? fmt(a.out_total) : "not published",
        a.had_out ? `in ${a.out_states} ${plural(a.out_states, "state")}${a.publishes_out ? "" : `, as of ${dayLabel(a.list_as_of.outbound.slice(0, 10))}`}` : "")
      + fig("Orgs that allow it to search their cameras", a.had_in ? fmt(a.in_total) : "not published",
        a.had_in && r.mutual != null ? `${fmt(r.mutual)} of them both ways` : "")
      + lastRead
      + `</div>`
      + (a.stalled ? `<p class="prof-note warn">${stalledText(a)}</p>` : "")
      + (cityFile(a) ? `<p class="prof-note">${cityFileText(a)}</p>` : "")
      + `<p class="prof-links">`
      + (a.portal_url ? `<a href="${esc(a.portal_url)}" rel="noopener">Open its live portal &#8599;</a>` : "")
      + `<a href="${esc(a.archive_url)}" rel="noopener">See every copy the ledger kept &#8599;</a></p>`
      + `<details class="prof-more"><summary>More about ${esc(a.name)}</summary>`
      + `<div class="prof-figs">`
      + fig("A typical search reaches", fmt(p.median), "camera networks")
      + fig("Its widest search reached", fmt(p.ceiling), "camera networks")
      + fig("Hotlist alerts", rate, h.per_1k == null ? "" : "per 1,000 vehicles seen")
      + fig("Vehicles its cameras saw", a.vehicles != null ? fmt(a.vehicles) : notShown(a, "vehicles"), a.vehicles != null ? "last 30 days" : "")
      + fig("Searches with a reason given", `${t.reason_pct}%`, "")
      + fig("Can search its cameras, cannot be searched by it", r.only_out != null ? fmt(r.only_out) : "not known",
        r.only_out != null ? "one-way access" : "needs both lists")
      + fig("Sharing-list changes seen", fmt(events[open] || 0), `since ${dayLabel(a.first_read_day)}`)
      + `</div>`
      + `<p class="prof-note">`
      + (ruled.length ? `Its portal rules out ${esc(listOf(ruled))} in writing. ` : "Its portal rules out no use of the cameras in writing. ")
      + (topKind ? `Its most common stated reason for a search is <b>${esc(topKind.type)}</b>, at ${topKind.pct}% of searches. ` : "")
      + (p.pct ? `${p.pct.own}% of its searches looked only at its own cameras.` : "")
      + `</p></details>`
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
  const blurb = `${fmt(om.entries.length)} organizations that can search these cameras, `
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
        + `<span class="via">Can search: ${via.length ? esc(listOf(via)) : "no current portal"}</span>`
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
      { v: r.mutual, css: "--series-1", label: "both ways" },
      { v: r.only_out, css: "--series-2", label: "they can search its cameras, not the other way" },
      { v: r.only_in, css: "--series-3", label: "it can search theirs, not the other way" },
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
    `Across the ${words(rows.length)} departments that publish both lists, only <b>${mutualShare}%</b> of these relationships run both ways. `
    + `<b>${esc(gv.name)}</b> is the most lopsided: ${fmt(gv.out)} outside organizations can search its cameras and it can search ${fmt(gv.inb)} of theirs, `
    + `so <b>${fmt(gv.only_out)}</b> can look in without ${esc(shortName(gv.name))} being able to look back. `
    + `<b>${esc(wk.name)}</b> is at the other end: it can search the cameras of ${fmt(wk.only_in)} organizations that cannot search its own. `
    + (() => {
      const bu = d.bundles;
      const gvb = bu.rows.find((r) => r.slug === gv.slug);
      const top = bu.blocks.slice(0, 2);
      return `This does not look like ${fmt(gv.only_out)} separate decisions. Large groups of organizations appear on exactly the same departments&rsquo; lists and no others: `
        + top.map((b) => `<b>${fmt(b.n)}</b> on ${b.members.length === 1 ? `${esc(b.members[0])}&rsquo;s list alone` : `exactly ${esc(listOf(b.members.map((m) => m.replace(/ (PD|DPS|SO)$/, ""))))}&rsquo;s`}`).join(", and ")
        + `. That is what joining a large shared network looks like from outside: everyone already in it gets access at once. `
        + `Groups like these hold ${gvb.pct}% of ${esc(gv.name)}&rsquo;s one-way partners. The portals never name these networks, so this is read from the lists, not stated by them.`;
    })()
    + (excl.length ? ` ${esc(listOf(excl.map((r) => r.name)))} ${plural(excl.length, "does", "do")} not publish both lists and ${plural(excl.length, "is", "are")} left out.` : "");

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
    hover(m, `<b>${esc(r.name)}</b><br>${r.per_1k} alerts per 1,000 vehicles`
      + `<br><span class="k">${fmt(r.hits)} alerts over ${fmt(r.vehicles)} vehicles</span>`
      + (r.comparable ? "" : `<br><span class="k">${esc(r.scope)}</span>`));
    svg2.appendChild(m);
    svg2.appendChild(el("text", {
      x: pl + bw + 10, y: y + bh / 2 + 4, "font-size": 12,
      fill: r.comparable ? cssvar("--ink-2") : cssvar("--ink-dim"),
    }, r.comparable ? String(r.per_1k) : `${r.per_1k} (counted differently)`));
  });

  const ranked = hits.filter((r) => r.comparable);
  const top = ranked[0], bot = ranked[ranked.length - 1];
  const perCam = ranked.map((r) => r.per_camera).filter(Boolean);
  const unrated = d.exposure.hit_rate.filter((r) => r.per_1k == null);
  const agencyBy = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const stoppedOn = (sl) => ((agencyBy[sl] || {}).dropped || []).find((x) => x.field === "hits" || x.field === "vehicles");
  document.getElementById("find-hits").innerHTML =
    (unrated.length ? `${esc(listOf(unrated.map((r) => (stoppedOn(r.slug)
      ? `${r.name}, which stopped publishing its vehicle and alert counts on ${dayLabel(stoppedOn(r.slug).since.slice(0, 10))},`
      : `${r.name}, which publishes no vehicle or alert count,`))))} ${plural(unrated.length, "is", "are")} not drawn. ` : "")
    + `<b>${esc(top.name)}</b>&rsquo;s cameras raise ${top.per_1k} hotlist alerts per thousand vehicles; `
    + `<b>${esc(bot.name)}</b>&rsquo;s raise ${bot.per_1k}, a <b>${d.exposure.spread}-fold</b> difference. `
    + `Busier cameras do not explain it: vehicles per camera runs from ${fmt(Math.min(...perCam))} to ${fmt(Math.max(...perCam))}, and the ranking does not follow. `
    + `The two counts are different kinds of thing. One flagged car passing thirty cameras in a month is thirty alerts but one vehicle, `
    + `so a camera on a road with more stolen cars or wanted drivers alerts more often, and a denser camera network counts the same car more times. `
    + `The rate says something about the roads, not about how a department uses the system, and the portals publish nothing that would separate the two.`;

  document.getElementById("hit-caveat").innerHTML =
    `<h4>One of these is counted differently</h4>`
    + `<p>${esc((hits.find((r) => !r.comparable) || {}).name || "")} labels the same figure `
    + `&ldquo;Total Hotlist Alerts (Includes KCSO and Nationwide Partners)&rdquo;, where every other portal says `
    + `&ldquo;Number of Hotlist Hits&rdquo;. It counts more alerts over the same vehicles, so its rate is drawn but not ranked. `
    + `Two portals built from the same template can put differently counted numbers in boxes that look identical; only the label shows it.</p>`;

  document.getElementById("tbl-exposure").appendChild(
    table([
      ...d.exposure.reciprocity.map((r) => {
        const hr = d.exposure.hit_rate.find((x) => x.slug === r.slug) || {};
        return [r.name, r.county, fmt(r.out), fmt(r.inb), fmt(r.mutual), fmt(r.only_out),
          fmt(r.only_in), hr.per_1k == null ? "not published" : String(hr.per_1k),
          hr.comparable === false ? "alerts counted differently" : ""];
      }),
      ...excl.map((r) => {
        const hr = d.exposure.hit_rate.find((x) => x.slug === r.slug) || {};
        return [r.name, r.county, "", "", "", "", "", hr.per_1k == null ? "not published" : String(hr.per_1k), `does not publish ${r.missing}`];
      }),
    ], ["Department", "County", "Can search its cameras", "It can search theirs", "Both ways",
      "Only they can search", "Only it can search", "Hotlist alerts per 1,000 vehicles", "Note"]));
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
    `<b>${p.full_pool} of ${p.total}</b> departments have run at least one search across the whole national network of about six thousand camera networks, `
    + `so what separates them is habit, not access. `
    + `A typical <b>${esc(broad.name)}</b> search reaches ${broad.median_frac}% as far as its widest; `
    + `a typical <b>${esc(narrow.name)}</b> search reaches ${narrow.median_frac}%, and ${narrow.pct.t1}% of its searches stay under a hundredth of its widest. `
    + `Both could search the country. One usually does not. `
    + `Counted in raw networks instead, a careful department and a small one would look the same.`;

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
    + `<b>${esc(short(least.a))}</b> and <b>${esc(short(least.b))}</b> search for the most similar reasons. `
    + `The cameras and the vendor are identical everywhere on this page; what each department points them at `
    + `is not. `
    + (f.too_small.length
      ? `${esc(listOf(f.too_small.map((s) => `${s.name} (${s.n} ${plural(s.n, "search", "searches")} with a reason)`)))} `
        + `${f.too_small.length === 1 ? "has" : "have"} fewer than ${f.min_searches} searches with a reason given, too few to compare, `
        + `and ${f.too_small.length === 1 ? "is" : "are"} left out.`
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
  const W = 900, PAD = 18, LABEL = 22, GRID_H = 300, FOCUS_H = 600;
  const rows = cam.rows;
  const N = rows.length;

  /* One frame per county. A single frame spanning Kalamazoo to Detroit would
     make every city a speck; each frame fits its own county's boundaries and
     shows the cameras that fall inside that frame, whoever runs them. A
     focused county is drawn alone at full width, and a focused department
     is that county's frame fitted to the department's own boundary. */
  const byKey = {};
  rows.forEach((r) => { (byKey[r.county_key] ||= []).push(r); });
  const frames = d.counties.map((c) => ({ c, rows: byKey[c.key] || [] })).filter((f) => f.rows.length);
  svg.setAttribute("width", W);

  /* Colour is the operator tag, which is the thing the reader has to weigh:
     a camera tagged to this agency, a camera tagged to someone else, or a
     camera nobody has attributed. Fixed to the entity, never to the filter. */
  const OP = [
    { o: 2, label: "Owner recorded as this department", css: "--series-1" },
    { o: 1, label: "Owner recorded as someone else", css: "--series-2" },
    { o: 0, label: "No owner recorded", css: "--rule-bright" },
  ];
  const opCss = (o) => (OP.find((x) => x.o === o) || OP[2]).css;

  // "all", "county:<key>" or a department slug. Opens on the first county
  // in page order (Kent County), the same rule every county-level control
  // follows; "All" is one click away.
  const firstCounty = frames[0] ? `county:${frames[0].c.key}` : "all";
  let sel = firstCounty;
  const focusOf = () => (sel === "all" ? null
    : sel.startsWith("county:") ? { county: sel.slice(7) }
      : { slug: sel, county: rows.find((r) => r.slug === sel).county_key });
  const shapes = {}, dots = [];

  function layout() {
    svg.textContent = "";
    Object.keys(shapes).forEach((k) => delete shapes[k]);
    dots.length = 0;
    const defs = el("defs");
    svg.appendChild(defs);
    const focus = focusOf();
    const shown = focus ? frames.filter((f) => f.c.key === focus.county) : frames;
    const ncols = focus ? 1 : Math.min(3, shown.length);
    const cellW = W / ncols, cellH = focus ? FOCUS_H : GRID_H;
    svg.setAttribute("viewBox", `0 0 ${W} ${Math.ceil(shown.length / ncols) * cellH}`);
    svg.setAttribute("aria-label", focus
      ? `Map of ${focus.slug ? rows.find((r) => r.slug === focus.slug).name : shown[0].c.name} with jurisdiction outlines and a dot for every mapped licence-plate camera`
      : "One map frame per county with jurisdiction outlines and a dot for every mapped licence-plate camera");
    shown.forEach((f, i) => drawFrame(f, i, ncols, cellW, cellH, defs, focus));
  }

  function drawFrame(f, i, ncols, cellW, cellH, defs, focus) {
    const col = i % ncols, row = Math.floor(i / ncols);
    const cx0 = col * cellW, cy0 = row * cellH;
    // Fit to the focused department, with room around it for its
    // neighbours; otherwise to every department in the county.
    const fitRows = focus && focus.slug ? f.rows.filter((r) => r.slug === focus.slug) : f.rows;
    const pts = [];
    fitRows.forEach((r) => (cam.outlines[r.slug] || []).forEach((ring) => ring.forEach((p) => pts.push(p))));
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
      `${f.c.name.toUpperCase()}${mirroredHere ? "" : " · NOT COVERED BY THE MAP"}`));
    if (!pts.length) return;
    const lat0 = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
    const kx = Math.cos(lat0 * Math.PI / 180);
    const xs = pts.map((p) => p[0] * kx), ys = pts.map((p) => -p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (focus && focus.slug) {
      const mx = (x1 - x0) * 0.12, my = (y1 - y0) * 0.12;
      x0 -= mx; x1 += mx; y0 -= my; y1 += my;
    }
    const k = Math.min((cellW - PAD * 2) / (x1 - x0), (cellH - LABEL - PAD * 2) / (y1 - y0));
    const ox = cx0 + (cellW - (x1 - x0) * k) / 2 - x0 * k;
    const oy = cy0 + LABEL + (cellH - LABEL - (y1 - y0) * k) / 2 - y0 * k;
    const project = (lat, lng) => [lng * kx * k + ox, -lat * k + oy];
    const box = { w: (cx0 - ox) / (kx * k), e: (cx0 + cellW - ox) / (kx * k), n: (oy - cy0 - LABEL) / k, s: (oy - cy0 - cellH) / k };
    const dotR = focus ? 4.2 : 3.2;

    f.rows.forEach((r) => {
      const rings = cam.outlines[r.slug] || [];
      const dPath = rings.map((ring) => ring.map(([lng, lat], j) => {
        const [x, y] = project(lat, lng);
        return `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join("") + "Z").join("");
      const path = el("path", { d: dPath, class: `juris${r.mirrored ? "" : " unmirrored"}` });
      path.dataset.slug = r.slug;
      hover(path, () => `<b>${esc(r.name)}</b><br>${r.mirrored ? `${fmt(r.mapped)} mapped ${plural(r.mapped, "camera")} inside its area` : "outside the area the map covers"}`);
      // Clicking the focused department steps back out to its county.
      path.addEventListener("click", () => { select(sel === r.slug ? `county:${r.county_key}` : r.slug); });
      g.appendChild(path);
      shapes[r.slug] = path;
    });

    if (!mirroredHere) return;
    cam.points.forEach((p) => {
      if (p.lat < box.s || p.lat > box.n || p.lng < box.w || p.lng > box.e) return;
      const [x, y] = project(p.lat, p.lng);
      const c = el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: dotR, class: "cam" });
      c.setAttribute("fill", cssvar(opCss(p.o)));
      const r = p.j >= 0 ? rows[p.j] : null;
      hover(c, `<b>${r ? esc(r.name) : "Outside these departments&rsquo; areas"}</b>`
        + `<br>${OP.find((x) => x.o === p.o).label.toLowerCase()}${p.f ? "" : "<br><span class=\"k\">not recorded as a Flock camera</span>"}`);
      g.appendChild(c);
      dots.push({ node: c, p, r: dotR });
    });
  }

  const items = [{ value: "all", label: `All ${words(N)}`, dot: false }]
    .concat(frames.map((f) => ({ value: `county:${f.c.key}`, label: f.c.name, dot: false, strong: true })))
    .concat(rows.map((r) => ({ value: r.slug, label: r.name, dot: false })));
  const select = (v) => { sel = v; ctl.rerender(); layout(); draw(); };
  const ctl = chips(host, "Show", items, (v) => v === sel, select);

  function draw() {
    const focus = focusOf();
    rows.forEach((r) => {
      const s = shapes[r.slug];
      if (!s) return;
      s.classList.toggle("sel", !!(focus && focus.slug === r.slug));
      s.classList.toggle("dim", !!(focus && focus.slug && focus.slug !== r.slug));
    });
    dots.forEach(({ node, p, r }) => {
      const inSel = !focus || !focus.slug ? true : (p.j >= 0 && rows[p.j].slug === focus.slug);
      node.setAttribute("fill-opacity", inSel ? 1 : 0.18);
      node.setAttribute("r", inSel ? r : r * 0.7);
    });
    renderPanel();
  }


  /* The panel beside the map says only what the map shows. How it compares
     with the portals is section 3, so the two sources never share a box. */
  function renderPanel() {
    const inScope = (r) => sel === "all" || (sel.startsWith("county:") ? r.county_key === sel.slice(7) : r.slug === sel);
    const scope = rows.filter((r) => inScope(r) && r.mirrored);
    const unm = rows.filter((r) => inScope(r) && !r.mirrored);
    const sum = (k) => scope.reduce((n, r) => n + (r[k] || 0), 0);
    const one = sel !== "all" && !sel.startsWith("county:") ? rows.find((r) => r.slug === sel) : null;
    const head = one ? esc(one.name) : sel === "all" ? `All ${words(N)} departments` : esc(frames.find((f) => f.c.key === sel.slice(7)).c.name);
    const sub = one ? `${esc(one.county)} &middot; area: ${esc(one.boundary)}`
      : `${words(scope.length + unm.length)} ${plural(scope.length + unm.length, "department")} with a portal`;
    if (one && !one.mirrored) {
      panel.innerHTML = `<h4 class="cam-panel-head">${head}</h4><p class="hint" style="margin:0 0 0.8rem">${sub}</p>`
        + `<p class="cam-verdict">The map this ledger reads does not cover this area, so it can say nothing here.</p>`;
      return;
    }
    const makes = one ? (one.other_makes || []) : [];
    panel.innerHTML = `<h4 class="cam-panel-head">${head}</h4>`
      + `<p class="hint" style="margin:0 0 0.8rem">${sub}</p>`
      + `<div class="cam-figs">`
      + `<div><span>Cameras on the map inside</span><span>${fmt(sum("mapped"))}<small>${fmt(sum("flock"))} recorded as Flock cameras</small></span></div>`
      + `<div><span>Owner: the department</span><span>${fmt(sum("op_agency"))}</span></div>`
      + `<div><span>Owner: someone else</span><span>${fmt(sum("op_other"))}${one && one.other_operators && one.other_operators.length ? `<small>${esc(listOf(one.other_operators.map((o) => o.name)))}</small>` : ""}</span></div>`
      + `<div><span>No owner recorded</span><span>${fmt(sum("op_untagged"))}</span></div>`
      + (one && one.other_make ? `<div><span>Another make</span><span>${fmt(one.other_make)}<small>${esc(listOf(makes.map((m) => m.name)))}</small></span></div>` : "")
      + (!one ? `<div><span>Outside every area</span><span>${sel === "all" ? fmt(cam.region_live - cam.in_any) : "&ndash;"}<small>${sel === "all" ? "in the areas the map covers" : "pick All to count"}</small></span></div>` : "")
      + `</div>`
      + (unm.length ? `<p class="hint">Not covered by the map: ${esc(listOf(unm.map((r) => r.name)))}.</p>` : "")
      + `<p class="cam-verdict">${one ? "How this compares with the department&rsquo;s own count is in section 3 below." : "Pick a department, or click its outline, to zoom in. Section 3 below sets these counts against the portals."}</p>`;
  }

  layout();
  draw();

  // Where the dots come from, in two sentences. Each area is read from
  // OpenStreetMap once a day, by one of two reads (the shared mirror, and the
  // ledger's own read of the counties the mirror leaves out), so the copy
  // gives one total; only a stale second read is named, since it leaves
  // those areas undrawn. The per-department panel lists every make.
  const src = cam.sources || [];
  const inv = src.find((x) => x.kind === "inventory");
  const own = src.find((x) => x.kind === "ledger");
  document.getElementById("cam-sources").innerHTML = inv
    ? (() => {
      const total = inv.cameras + (own && own.used ? own.cameras : 0);
      const ms = cam.makes_read || [];
      const flock = ms.find((m) => /flock/i.test(m.name));
      const others = ms.filter((m) => m !== flock);
      const otherN = others.reduce((n, m) => n + m.n, 0);
      const makes = ms.length
        ? ` ${fmt(flock ? flock.n : 0)} are recorded as Flock Safety`
          + (otherN ? `, ${fmt(otherN)} as other makes (mostly ${esc(listOf(others.slice(0, 2).map((m) => m.name)))})` : "")
          + (cam.no_make_read ? `, and ${fmt(cam.no_make_read)} with no make` : "") + `.`
        : "";
      return `The map draws ${fmt(total)} cameras from OpenStreetMap, the volunteer map DeFlock is built on, read once a day and last edited ${esc(cam.as_of ? dayLabel(cam.as_of) : "on an unknown date")}.`
        + makes
        + (own && !own.used ? ` ${esc(listOf(own.areas))} show as not covered: the last read of them, on ${esc(own.read ? dayLabel(own.read) : "an unknown date")}, is too old to draw.` : "");
    })()
    : "";

  const unmirrored = rows.filter((r) => !r.mirrored);
  document.getElementById("cam-legend").innerHTML = OP.map((o) =>
    `<span><i style="background:var(${o.css});border-radius:50%"></i> ${o.label}</span>`).join("")
    + `<span><i style="background:var(--surface-2);border:1px solid var(--rule-bright)"></i> area the department polices</span>`
    + (unmirrored.length ? `<span><i style="border:1px dashed var(--rule-bright)"></i> area the map does not cover</span>` : "");
}

/* Cameras, section 1: the departments' own figures and nothing else. */
const camCaption = (def) => (!def ? "" : /and other cameras/i.test(def) ? "plate readers <b>and other cameras</b>"
  : /LPR cameras only/i.test(def) ? "plate readers only" : esc(def));

function camOfficial(d) {
  const cc = d.camera_changes;
  const changes = Object.fromEntries(cc.per_dept.map((r) => [r.slug, r.official]));
  const listed = d.agencies.filter((a) => a.cameras != null);
  const t = document.getElementById("cam-official-table");
  t.innerHTML = `<thead><tr><th>Department</th><th>County</th><th class="num">Cameras it says it runs</th>`
    + `<th>What the figure counts</th><th>Changes the ledger has seen</th><th>Portal</th></tr></thead><tbody>`
    + d.agencies.map((a) => {
      const ch = changes[a.slug] || [];
      return `<tr class="${a.stalled ? "stale" : ""}"><td>${esc(a.name)}</td><td class="muted">${esc(a.county.replace(/ County$/, ""))}</td>`
        + `<td class="num">${a.cameras != null ? fmt(a.cameras) : "not published"}${a.stalled ? `<br><span class="muted">as of ${capDay(a)}</span>` : ""}</td>`
        + `<td>${camCaption(a.camera_def)}${a.camera_tiles && a.camera_tiles.lpr_only != null && a.camera_tiles.total != null ? `<br><span class="muted">plate readers alone: ${fmt(a.camera_tiles.lpr_only)}</span>` : ""}</td>`
        + `<td>${ch.length ? ch.map((c) => `<b>${fmt(c.from)} &rarr; ${fmt(c.to)}</b> on ${dayLabel(c.day)}`).join("<br>") : `<span class="muted">none since ${dayLabel(a.first_read_day)}</span>`}</td>`
        + `<td>${a.portal_url ? `<a href="${esc(a.portal_url)}" rel="noopener">open &#8599;</a>` : ""}</td></tr>`;
    }).join("") + `</tbody>`;

  const total = listed.reduce((n, a) => n + a.cameras, 0);
  const only = listed.filter((a) => /LPR cameras only/i.test(a.camera_def || ""));
  const other = listed.filter((a) => /and other cameras/i.test(a.camera_def || ""));
  const stalled = listed.filter((a) => a.stalled);
  const off = cc.official;
  document.getElementById("find-cam-official").innerHTML =
    `The ${words(listed.length)} portals list <b>${fmt(total)}</b> cameras between them. `
    + `${Words(only.length)} count plate readers only. ${Words(other.length)} label the figure &ldquo;LPR <b>and other cameras</b>&rdquo;, `
    + `so theirs can include cameras that do not read plates. `
    + `In ${fmt(cc.capture_days)} days of daily reads, `
    + (off.length
      ? `${off.length === 1 ? "one count has" : `${words(off.length)} counts have`} changed: ${esc(listOf(off.map((c) => `${c.name} went from ${fmt(c.from)} to ${fmt(c.to)} on ${dayLabel(c.day)}`)))}. `
      : "no count has changed. ")
    + (stalled.length ? `${esc(listOf(stalled.map((a) => a.name)))}&rsquo;s figure is from its last good read, on ${esc(listOf(stalled.map((a) => capDay(a))))}. ` : "")
    + `No portal says where its cameras are; for that, the next section turns to the volunteer map.`;
}

/* Cameras, section 3: the portal's count against the map's, as a floor.
   The map counts every Flock device inside the line, whoever owns it, with a
   point carrying two directions counted as two the way Flock counts; devices
   recorded as someone else's are set aside first, since the portal cannot be
   counting them. What is left over, either way, is a lower bound. */
function camTogether(d) {
  const cam = d.cameras;
  if (!cam || !cam.available) return;
  const rows = cam.rows;
  const N = rows.length;
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const elsewhere = (r) => r.flock_devices - r.comparable;
  const isAgency = (name) => /police|public safety|sheriff|\bdps\b|department/i.test(name);
  const namesOf = (r) => listOf(r.other_flock.map((o) => `${o.name} (${o.n})`));
  const lprKnown = (r) => !r.lpr_and_other || r.lpr_only_tile != null;

  const verdict = (r) => {
    const a = byAgency[r.slug] || {};
    if (!r.mirrored) return `<span class="muted">The map does not cover this area.</span>`;
    if (r.portal == null) return `<span class="muted">The portal gives no count.</span>`;
    const m = r.comparable, p = r.portal;
    const asOf = a.stalled ? ` (The portal&rsquo;s figure is as of ${capDay(a)}.)` : "";
    if (m === p) return `The counts agree. That does not prove they are the same cameras.${asOf}`;
    if (m > p) {
      return `<b>At least ${fmt(m - p)} ${plural(m - p, "is", "are")} not the department&rsquo;s.</b> `
        + `The map has ${fmt(m)} that could be its own and it says it runs ${fmt(p)}, so the rest belong to someone else or have since come down.${asOf}`;
    }
    return `<b>At least ${fmt(p - m)} of its cameras ${plural(p - m, "is", "are")} not on the map.</b> `
      + `It says it runs ${fmt(p)} and the map has ${fmt(m)} that could be its own`
      + (lprKnown(r) ? `, so volunteers have not found them all yet.` : `. Volunteers may not have found them all, and its figure can also include cameras that are not plate readers, which this map would not show.`) + asOf;
  };

  const t = document.getElementById("cam-together-table");
  t.innerHTML = `<thead><tr><th>Department</th><th class="num">Portal says</th><th class="num">Flock cameras on the map inside its area</th>`
    + `<th>Recorded as someone else&rsquo;s</th><th>What that tells us</th></tr></thead><tbody>`
    + rows.map((r) => `<tr><td>${esc(r.name)}<br><span class="muted">${esc(r.boundary)}</span></td>`
      + `<td class="num">${fmt(r.portal)}${r.camera_def ? `<br><span class="muted">${camCaption(r.camera_def)}</span>` : ""}</td>`
      + `<td class="num">${r.mirrored ? fmt(r.flock_devices) : "&ndash;"}</td>`
      + `<td>${r.mirrored ? (elsewhere(r) ? esc(namesOf(r)) : `<span class="muted">none</span>`) : ""}</td>`
      + `<td class="verdict">${verdict(r)}</td></tr>`).join("") + `</tbody>`;

  const mapped = rows.filter((r) => r.mirrored && r.portal != null);
  const over = mapped.filter((r) => r.comparable > r.portal);
  const short = mapped.filter((r) => r.comparable < r.portal);
  const equal = mapped.filter((r) => r.comparable === r.portal);
  const unm = rows.filter((r) => !r.mirrored);
  const sumP = mapped.reduce((n, r) => n + r.portal, 0);
  const sumM = mapped.reduce((n, r) => n + r.flock_devices, 0);
  const surplus = over.reduce((n, r) => n + r.comparable - r.portal, 0);
  const recorded = mapped.reduce((n, r) => n + elsewhere(r), 0);
  const missing = short.reduce((n, r) => n + r.portal - r.comparable, 0);
  const owners = {};
  mapped.forEach((r) => r.other_flock.forEach((o) => { owners[o.name] = (owners[o.name] || 0) + o.n; }));
  const ownerList = Object.entries(owners).sort((x, y) => y[1] - x[1]);
  const agencyOwners = ownerList.filter(([n]) => isAgency(n));
  const pv = d.private;
  const privFeeds = pv ? pv.inbound_private.filter((r) => r.category !== "nonprofit") : [];
  const housing = privFeeds.filter((r) => r.category === "residential").length;
  document.getElementById("find-cams").innerHTML =
    `Across the ${words(mapped.length)} departments the map covers, the portals list <b>${fmt(sumP)}</b> cameras and volunteers have mapped `
    + `<b>${fmt(sumM)}</b> Flock cameras inside the same areas. `
    + (recorded ? `Volunteers recorded another owner for ${fmt(recorded)} of those: ${esc(listOf(ownerList.map(([n, k]) => `${n} (${k})`)))}`
      + (agencyOwners.length ? `. ${Words(agencyOwners.length)} of those ${plural(agencyOwners.length, "is", "are")} another police department` : "")
      + `. Setting them aside, ` : "")
    + (over.length ? `the map still holds more than the department says it runs in ${words(over.length)} places, so at least <b>${fmt(surplus)}</b> more cameras there belong to someone else, or have come down, and have no owner recorded. ` : "")
    + (short.length ? `In ${words(short.length)} places it holds fewer, so at least <b>${fmt(missing)}</b> of those departments&rsquo; cameras are not mapped yet or are not plate readers. ` : "")
    + (equal.length ? `${esc(listOf(equal.map((r) => r.name)))} ${plural(equal.length, "matches", "match")} exactly. ` : "")
    + (unm.length ? `${esc(listOf(unm.map((r) => r.name)))} ${plural(unm.length, "lies", "lie")} outside the map&rsquo;s coverage. ` : "")
    + (privFeeds.length ? `Who owns that leftover cannot be read from the map. The departments&rsquo; own portals name <b>${fmt(privFeeds.length)}</b> private owners whose cameras they can search, ${fmt(housing)} of them apartment communities and property managers, `
      + `and cameras like theirs stand inside these same areas (<a href="#sharing" data-tab-link="sharing" data-target="sec-private">see private cameras</a>).` : "");

  // Why the two can never match exactly, in plain terms.
  const mirroredRows = rows.filter((r) => r.mirrored);
  const defs = {};
  rows.forEach((r) => { if (r.camera_def) (defs[camCaption(r.camera_def)] ||= []).push(r); });
  const multi = mirroredRows.reduce((n, r) => n + r.multi, 0);
  const otherMake = mirroredRows.reduce((n, r) => n + r.other_make, 0);
  const noMake = mirroredRows.reduce((n, r) => n + r.no_make, 0);
  const untagged = mirroredRows.reduce((n, r) => n + r.op_untagged, 0);
  const inside = mirroredRows.reduce((n, r) => n + r.mapped, 0);
  const dups = mirroredRows.reduce((n, r) => n + r.dup, 0);
  const poles = mirroredRows.reduce((n, r) => n + r.poles, 0);
  const otherMakes = (cam.makes_inside || []).filter((m) => m.name !== "Flock Safety");
  document.getElementById("cam-count").innerHTML =
    `<p><b>They count different things.</b> The portal counts the cameras the department operates, wherever they stand. The map counts what volunteers have found inside the department&rsquo;s boundary, whoever owns it. `
    + Object.entries(defs).map(([cap, rs]) => `${Words(rs.length)} ${plural(rs.length, "portal counts", "portals count")} ${cap}`).join("; ") + `.</p>`
    + `<p><b>Only Flock cameras are compared.</b> ${fmt(otherMake)} cameras of another make inside these areas (${esc(listOf(otherMakes.map((m) => `${fmt(m.n)} ${m.name}`)))}) and ${fmt(noMake)} with no make recorded are drawn on the map and left out, because the portal counts Flock devices only.</p>`
    + `<p><b>A pole with two cameras counts as two.</b> Volunteers usually map it as two points, but sometimes as one point facing two ways; that happens on ${fmt(multi)} points here, and each is counted as two, the way Flock counts.</p>`
    + `<p><b>Most owners are blank.</b> ${fmt(untagged)} of the ${fmt(inside)} mapped cameras inside these areas have no owner recorded, and &ldquo;Flock Safety&rdquo; as an owner names the vendor, not the department. Until volunteers fill that in, the map can say how many cameras stand in a city but not how many belong to its police.</p>`
    + `<p><b>Duplicates do not explain the gaps.</b> Of the close pairs of points inside these areas, ${fmt(poles)} face different ways and are two cameras on one pole, and ${fmt(dups)} face the same way and may be one camera drawn twice.</p>`;

  const full = document.getElementById("cam-table");
  full.innerHTML = `<thead><tr><th>Department</th><th class="num">Portal says</th><th class="num">Flock cameras on the map</th>`
    + `<th class="num">Not recorded as someone else&rsquo;s</th><th class="num">Mapped points, any make</th>`
    + `<th class="num">Owner: the department</th><th class="num">Owner: someone else</th><th class="num">No owner</th>`
    + `<th class="num">Two cameras on one pole</th><th class="num">Possible duplicates</th></tr></thead><tbody>`
    + rows.map((r) => (!r.mirrored
      ? `<tr><td>${esc(r.name)}</td><td class="num">${fmt(r.portal)}</td><td colspan="8" class="muted">not covered by the map</td></tr>`
      : `<tr><td>${esc(r.name)}</td><td class="num">${fmt(r.portal)}</td><td class="num">${fmt(r.flock_devices)}</td><td class="num">${fmt(r.comparable)}</td>`
        + `<td class="num">${fmt(r.mapped)}</td><td class="num">${fmt(r.op_agency)}</td><td class="num">${fmt(r.op_other)}</td><td class="num">${fmt(r.op_untagged)}</td>`
        + `<td class="num">${fmt(r.poles)}</td><td class="num">${fmt(r.dup)}</td></tr>`)).join("") + `</tbody>`;
}

/* Cameras, section 4: the two change signals, side by side and never summed. */
function camChanges(d) {
  const cc = d.camera_changes;
  const byAgency = Object.fromEntries(d.agencies.map((a) => [a.slug, a]));
  const recent = cc.recent.slice(0, 12);
  const sinceAdds = cc.added_since, sinceRems = cc.removed_since;
  const editedDepts = [...new Set(cc.recent.map((e) => e.name))];
  const stalled = d.agencies.filter((a) => a.stalled);
  document.getElementById("cam-changes").innerHTML =
    `<div class="cam-col"><h3 class="dep-head">On the portals: the department&rsquo;s own count</h3>`
    + `<p class="hint">Compared between one day&rsquo;s read and the next, for every department.</p>`
    + (cc.official.length
      ? `<ul class="cam-list">${cc.official.map((c) => `<li><b>${esc(c.name)}</b> ${fmt(c.from)} &rarr; ${fmt(c.to)} cameras <span class="muted">${dayLabel(c.day)}</span></li>`).join("")}</ul>`
      : `<p>No department&rsquo;s count has changed.</p>`)
    + `<p>${Words(cc.official.length)} ${plural(cc.official.length, "change")} in ${fmt(cc.capture_days)} days. Every other department&rsquo;s figure has held steady since its first read`
    + (stalled.length ? `, ${listOf(stalled.map((a) => `${esc(a.name)}&rsquo;s until its last good read on ${capDay(a)}`))}` : "") + `.</p></div>`
    + `<div class="cam-col"><h3 class="dep-head">On the DeFlock map: volunteer edits</h3>`
    + `<p class="hint">Cameras added to or taken off the map inside these departments&rsquo; areas, dated by the edit.</p>`
    + (recent.length
      ? `<ul class="cam-list">${recent.map((e) => `<li><span class="org ${e.kind === "add" ? "add" : "rem"}">${e.kind === "add" ? "added" : "taken off"}</span> `
        + `<b>${esc(e.name)}</b> ${esc(e.where)} <span class="muted">${dayLabel(e.day)}</span></li>`).join("")}</ul>`
        + (cc.recent.length > recent.length ? `<p class="hint">and ${fmt(cc.recent.length - recent.length)} more on the timeline</p>` : "")
      : `<p>No edits inside these areas since ${dayLabel(cc.since)}.</p>`)
    + `<p>${fmt(sinceAdds)} added and ${fmt(sinceRems)} taken off since ${dayLabel(cc.since)}${editedDepts.length ? `, all in ${esc(listOf(editedDepts))}` : ""}. `
    + (cc.first_edit ? `The map&rsquo;s history inside these areas begins in ${monthYear(cc.first_edit)}, and since then ${fmt(cc.added)} cameras have been added and ${fmt(cc.removed)} taken off.` : "")
    + (cc.no_history.length ? ` ${esc(listOf(cc.no_history))} ${plural(cc.no_history.length, "has", "have")} no map history, because the ledger&rsquo;s own read of that area is a daily snapshot` : "")
    + (cc.partial_history.length ? `${cc.no_history.length ? ", and" : ""} ${esc(listOf(cc.partial_history))} ${plural(cc.partial_history.length, "has", "have")} history only for the part of ${plural(cc.partial_history.length, "its", "their")} area the shared map covers` : "")
    + (cc.no_history.length || cc.partial_history.length ? "." : "")
    + `</p></div>`;

  const sinceEdits = sinceAdds + sinceRems;
  document.getElementById("find-cam-changes").innerHTML =
    `In the same ${fmt(cc.capture_days)} days the portals changed ${cc.official.length === 1 ? "once" : `${words(cc.official.length)} times`} and the map ${sinceEdits === 1 ? "once" : `${words(sinceEdits)} times`}, and the two should not be read as one record. `
    + `A map edit is often a volunteer finding a camera that has stood for months, fixing a position or clearing a duplicate, not a camera going up or coming down. `
    + `When a portal&rsquo;s count moves, an edit near the same date inside the same area hints at which camera it was, and proves nothing. `
    + `<a href="timeline.html#t=cameras,osm_add,osm_remove&r=all">The timeline</a> shows both, day by day.`;
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
    [fmt(commercial.length), "private owners", `whose cameras at least one of the ${words(keys.length)} departments that publish that list can search`, "cool"],
    [fmt(companiesOut.length), companiesOut.length === 1 ? "company" : "companies", `that can search the cameras of the ${words(pubOut.length)} departments that publish that list`, "accent"],
    [fmt(nonprofitOut.length), nonprofitOut.length === 1 ? "nonprofit" : "nonprofits",
      nonprofitOut.length ? `that can: ${esc(nonprofitOut.map((r) => r.name.replace(/\s*\[.*\]$/, "")).join(", "))}` : "on the outbound side", ""],
    [fmt(pv.counts.public_nonpolice_out), "other public bodies",
      (() => {
        const k = pv.public_out_kinds;
        const lab = Object.assign({}, d.org_map.kind_labels,
          { public: "dispatch, natural resources, parks, municipalities and the like", unclassified: "matched no rule" });
        return "that can search: " + Object.entries(k).sort((x, y) => y[1] - x[1])
          .map(([kind, n]) => `${(lab[kind] || kind).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())} ${n}`).join(", ");
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
      ? `${esc(pv.agency_names[sl])} can search its cameras` : `not on ${esc(pv.agency_names[sl])}&rsquo;s list`}`);
  });

  /* finding */
  const lead = pv.per_dept[0];
  // "None" only for a department that publishes the list; one that does not
  // publish it is not a department with no private feeds.
  const none = pv.per_dept.filter((r) => !r.private_feeds && keys.includes(r.slug));
  const unpublished = d.agencies.filter((a) => !keys.includes(a.slug));
  const residential = (groups.residential || []).length;
  const retail = (groups.retail || []).length;
  const mapped = pv.inbound_private.filter((r) => r.osm_cameras);
  document.getElementById("find-private").innerHTML =
    `<b>${fmt(commercial.length)}</b> private owners appear on the lists of cameras these departments can search: `
    + `<b>${fmt(residential)}</b> apartment communities and property managers, and ${fmt(retail)} retail or commercial ${plural(retail, "company", "companies")}. `
    + (companiesOut.length ? `${fmt(companiesOut.length)} ${plural(companiesOut.length, "company", "companies")} can also search police cameras. `
      : `None appear the other way: on the ${words(pubOut.length)} portals that publish who can search their cameras, no company can. `)
    + `<b>${esc(lead.name)}</b> can search the most private owners&rsquo; cameras (${fmt(lead.private_feeds)})`
    + (none.length ? `; ${esc(listOf(none.map((r) => r.name)))} ${plural(none.length, "lists", "list")} none` : "")
    + (unpublished.length ? `, and ${esc(listOf(unpublished.map((a) => a.name)))} ${plural(unpublished.length, "does", "do")} not publish this list` : "") + `. `
    + (mapped.length ? `Only ${mapped.length === 1 ? "one of these owners" : `${words(mapped.length)} of these owners`}, ${esc(listOf(mapped.map((r) => r.name)))}, `
      + `can be found by name on the DeFlock map, which says more about how rarely volunteers record an owner than about where the cameras are. ` : "")
    + (nonprofitOut.length
      ? `The one organization outside government that can search the police cameras is ${esc(listOf(nonprofitOut.map((r) => r.name.replace(/\s*\[.*\]$/, ""))))}, a nonprofit.`
      : "");

  /* OSM operators */
  const ot = document.getElementById("osm-op-table");
  const PRIV = new Set(["retail", "residential", "health", "nonprofit"]);
  const priv = pv.osm_operators.filter((o) => PRIV.has(o.category));
  const pub = pv.osm_operators.filter((o) => !PRIV.has(o.category));
  ot.innerHTML = `<thead><tr><th>Owner recorded on the map</th><th class="num">Cameras</th><th>Where</th><th>On any department&rsquo;s list</th></tr></thead><tbody>`
    + priv.map((o) => {
      const where = o.where.map((w) => `${w.slug ? esc(shortName(w.slug)) : "outside these departments&rsquo; areas"} ${w.n}`).join(", ");
      return `<tr><td>${esc(o.name)}<br><span class="muted">${esc(pv.labels[o.category] || o.category)}</span></td>`
        + `<td class="num">${fmt(o.n)}</td><td>${where}</td>`
        + `<td>${o.listed.length ? `<span class="mark yes">● ${esc(o.listed.join(", "))}</span>` : `<span class="mark no">○ no list names it</span>`}</td></tr>`;
    }).join("")
    + `<tr><td colspan="4" class="muted">${fmt(pub.length)} more owners recorded on the map are police or other agencies, or entries that could not be read `
    + `(${esc(pub.map((o) => o.name).slice(0, 4).join(", "))}${pub.length > 4 ? ", and others" : ""}).</td></tr>`
    + `</tbody>`;

  /* vendor and system entries */
  const v = pv.vendor_entries;
  document.getElementById("private-vendor").innerHTML =
    `<h4>The list is the vendor&rsquo;s directory, verbatim</h4>`
    + `<p>${v.length ? v.map((r) => `<span class="quote">${esc(r.name)}</span> is listed as an organization `
      + `${esc(listOf(r.depts.map((sl) => pv.agency_names[sl])))} can ${r.direction === "inbound" ? "search the cameras of" : "be searched by"}`).join("; ") + "."
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
    ]), ["Organization", "Kind", "State", "Can search the cameras of"]));
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
  const status = (a) => {
    if (!a.captured_at) return `<span class="mark no">&#9675; never read</span>`;
    if (a.stalled) return `<span class="mark no">&#9679; no new data since ${capDay(a)}</span>`;
    if (cityFile(a) && a.days_behind > 1) return `<span class="mark no">&#9679; ${a.days_behind} days behind</span>`;
    if (a.days_behind === 1) return `<span class="mark">&#9681; a day behind</span>`;
    return `<span class="mark yes">&#9679; current</span>`;
  };
  t.innerHTML = `<thead><tr><th>Department</th><th>County</th><th>Last good read</th><th class="num">New searches it found</th>`
    + `<th>Last day with anything new</th><th>Date the portal printed</th><th>Status</th><th>Portal</th></tr></thead><tbody>`
    + d.agencies.map((a) => `<tr class="${a.stalled ? "stale" : ""}">`
      + `<td><button type="button" class="dept-link" data-slug="${esc(a.slug)}">${esc(a.name)}</button></td>`
      + `<td class="muted">${esc(a.county.replace(/ County$/, ""))}</td>`
      + `<td>${a.captured_at ? `${dayLabel(a.captured_day)} ${a.captured_at.slice(11, 16)} UTC` : "never"}</td>` // leak-linter:allow (capture stamp, not a schedule)
      + `<td class="num">${a.captured_at ? (a.new_rows_last_read ? `+${fmt(a.new_rows_last_read)}` : "0") : ""}</td>`
      + `<td>${a.last_new_day ? dayLabel(a.last_new_day) : `<span class="muted">none yet</span>`}</td>`
      + `<td>${a.portal_updated ? dayLabel(a.portal_updated) : `<span class="muted">not read</span>`}</td>`
      + `<td>${status(a)}</td>`
      + `<td>${a.portal_url ? `<a href="${esc(a.portal_url)}" rel="noopener">open &#8599;</a>` : ""}</td></tr>`).join("") + `</tbody>`;
  t.querySelectorAll(".dept-link").forEach((btn) => btn.addEventListener("click", () => {
    openProfile(btn.dataset.slug);
    document.getElementById("sec-profile").scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  const stalled = d.agencies.filter((a) => a.stalled);
  const behindFile = d.agencies.filter((a) => cityFile(a) && a.days_behind > 1 && !a.stalled);
  const quiet = d.agencies.filter((a) => a.captured_day === sc.last_capture && !a.new_rows_last_read && !behindFile.includes(a));
  const newest = [...d.agencies].filter((a) => a.captured_day === sc.last_capture && a.new_rows_last_read)
    .sort((a, b) => b.new_rows_last_read - a.new_rows_last_read);
  document.getElementById("find-fresh").innerHTML =
    `The latest read, on ${dayLabel(sc.last_capture)}, captured <b>${words(td.captured.length)}</b> of the ${words(d.agencies.length)} portals. `
    + (stalled.length
      ? `${esc(listOf(stalled.map((a) => a.name)))} ${plural(stalled.length, "has", "have")} returned no new data since ${esc(listOf(stalled.map((a) => capDay(a))))}; the note below says what that means. `
      : "")
    + (behindFile.length
      ? `${esc(listOf(behindFile.map((a) => `${a.name} is ${a.days_behind} days behind`)))}, because ${plural(behindFile.length, "its audit comes", "their audits come")} from a monthly city file rather than the portal; the note below says what that means. `
      : "")
    + (newest.length ? `The most new searches came from <b>${esc(newest[0].name)}</b> (${fmt(newest[0].new_rows_last_read)})` : "No portal had new searches in the latest read")
    + (quiet.length ? `, and ${esc(listOf(quiet.map((a) => a.name)))} ${plural(quiet.length, "was", "were")} read and had nothing new.` : ".")
    + ` A portal with nothing new that day is normal for a small department; its status stays current.`;
  const note = document.getElementById("stalled-note");
  if (stalled.length || behindFile.length) {
    const named = [...stalled, ...behindFile];
    note.hidden = false;
    note.innerHTML = `<h4>${named.length === 1 ? `About ${esc(named[0].name)}` : "Departments that are behind"}</h4>`
      + stalled.map((a) => `<p>${stalledText(a)}</p>`).join("")
      + behindFile.map((a) => `<p>${cityFileText(a)}</p>`).join("");
  }

  const addDepts = [...new Set(td.changes.filter((c) => c.added.length).map((c) => c.name))];
  const remDepts = [...new Set(td.changes.filter((c) => c.removed.length).map((c) => c.name))];
  const missed = td.not_captured.map((s) => byAgency[s]);
  document.getElementById("today-band").innerHTML = [
    [fmt(td.new_rows), plural(td.new_rows, "new search", "new searches"), `found by the ${dayLabel(td.day)} read`, "cool"],
    [`${td.captured.length} of ${d.agencies.length}`, "portals captured",
      missed.length ? `none from ${esc(listOf(missed.map((a) => `${a.name} since ${capDay(a)}`)))}` : "every portal answered", ""],
    [fmt(td.added), plural(td.added, "organization added", "organizations added"), addDepts.length ? `to sharing lists at ${esc(listOf(addDepts))}` : "to any sharing list", ""],
    [fmt(td.removed), plural(td.removed, "organization dropped", "organizations dropped"),
      (remDepts.length ? `from sharing lists at ${esc(listOf(remDepts))}; ` : "")
      + (td.departures.length ? `${words(td.departures.length)} left several portals at once` : "none left several portals at once"), "accent"],
  ].map(([n, label, note2, cls]) =>
    `<div class="stat"><div class="stat-num ${cls}">${n}</div><div class="stat-label">${label}</div><div class="stat-note">${note2}</div></div>`).join("");
  document.getElementById("today-list").innerHTML = td.changes.length
    ? td.changes.map((c) => `<div class="ev"><b>${esc(c.name)}</b> <span class="muted">${c.direction === "outbound" ? "who can search its cameras" : "whose cameras it can search"}</span>`
      + (c.added.length ? ` <span class="org add">+${c.added.length}</span> ${esc(c.added.slice(0, 6).join(", "))}${c.added.length > 6 ? ", &hellip;" : ""}` : "")
      + (c.removed.length ? ` <span class="org rem">&minus;${c.removed.length}</span> ${esc(c.removed.slice(0, 6).join(", "))}${c.removed.length > 6 ? ", &hellip;" : ""}` : "") + `</div>`).join("")
    : `<p class="hint">No sharing list changed in the latest read${td.faults ? `; ${words(td.faults)} capture ${plural(td.faults, "fault")} recorded` : ""}.</p>`;
}

/* Tabs: five groups of sections and a link to the timeline, in a bar pinned
   under the masthead, addressed by hash so a link opens a tab. */
const TABS = [["overview", "Overview"], ["sharing", "Who can search"], ["searches", "Searches"], ["cameras", "Cameras"], ["sources", "Sources"]];
// Links made before the Sources tab replaced the Portals tab still land.
const LEGACY_TABS = { portals: "sources" };
function tabs() {
  const nav = document.getElementById("tabs");
  const anchor = document.getElementById("tabs-anchor");
  const sections = [...document.querySelectorAll("section[data-tab]")];
  const valid = new Set(TABS.map((t) => t[0]));
  const keyOf = (h) => { const k = LEGACY_TABS[h] || h; return valid.has(k) ? k : TABS[0][0]; };
  const current = () => keyOf(location.hash.slice(1));
  // A tab opens on a short list of its own sections, so a long tab can be
  // read from its contents rather than by scrolling to find out.
  TABS.forEach(([key]) => {
    const mine = sections.filter((s) => s.dataset.tab === key && s.id && s.querySelector("h2"));
    if (mine.length < 2) return;
    const idx = document.createElement("div");
    idx.className = "tab-index";
    idx.innerHTML = `<span class="ctl-label">On this tab</span><ol>`
      + mine.map((s) => `<li><button type="button" data-target="${esc(s.id)}">${esc(s.querySelector("h2").textContent)}</button></li>`).join("")
      + `</ol>`;
    idx.querySelectorAll("button").forEach((b) => b.addEventListener("click", () =>
      document.getElementById(b.dataset.target).scrollIntoView({ behavior: "smooth", block: "start" })));
    mine[0].insertBefore(idx, mine[0].firstChild);
  });
  const show = (key) => {
    sections.forEach((s) => { s.hidden = s.dataset.tab !== key; });
    nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === key)));
  };
  // The bar sits at the top of the page, above the masthead, so it is on the
  // first screen on any device. Picking a tab brings the start of its
  // content up under the bar, unless that start is already in view.
  const go = (key) => {
    history.replaceState(null, "", `#${key}`);
    show(key);
    const top = anchor.getBoundingClientRect().top + window.scrollY - nav.offsetHeight;
    const inView = anchor.getBoundingClientRect().top < window.innerHeight * 0.5 && window.scrollY <= top;
    if (!inView) window.scrollTo({ top, behavior: "smooth" });
  };
  TABS.forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.tab = key; b.setAttribute("role", "tab"); b.textContent = label;
    b.addEventListener("click", () => go(key));
    nav.appendChild(b);
  });
  // The timeline is its own page; the bar links to it the same way on both.
  const tl = document.createElement("a");
  tl.href = "timeline.html"; tl.className = "tab-page"; tl.innerHTML = "Timeline &#8599;";
  nav.appendChild(tl);
  document.querySelectorAll("[data-tab-link]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    go(a.dataset.tabLink);
    const target = a.dataset.target && document.getElementById(a.dataset.target);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  window.addEventListener("hashchange", () => show(current()));
  show(current());
}

/* Sources: every portal the ledger reads, with a link to the live page and to
   the archive's own copy, so any figure can be checked against its file. */
function sourcesSection(d) {
  const t = document.getElementById("sources-table");
  const host = (u) => u.replace(/^https?:\/\//, "");
  const ok = d.agencies.filter((a) => !a.stalled);
  const stalled = d.agencies.filter((a) => a.stalled);
  t.innerHTML = `<thead><tr><th>Department</th><th>County</th><th>Live portal, at ${esc(host(d.portal_home).replace(/\/$/, ""))}</th><th>Every copy the ledger kept, on GitHub</th>`
    + `<th>First read</th><th>Last good read</th><th>Status</th></tr></thead><tbody>`
    + d.agencies.map((a) => `<tr class="${a.stalled ? "stale" : ""}">`
      + `<td>${esc(a.name)}</td><td class="muted">${esc(a.county.replace(/ County$/, ""))}</td>`
      + `<td>${a.portal_url ? `<a href="${esc(a.portal_url)}" rel="noopener">/${esc(a.portal_url.replace(/^.*\//, ""))} &#8599;</a>` : `<span class="muted">not recorded</span>`}</td>`
      + `<td><a href="${esc(a.archive_url)}" rel="noopener">${esc(`${a.county_key}/${a.slug}`)} &#8599;</a></td>`
      + `<td>${a.first_read_day ? dayLabel(a.first_read_day) : ""}</td>`
      + `<td>${capDay(a)}</td>`
      + `<td>${a.stalled ? `<span class="mark no">&#9679; no new data since ${capDay(a)}</span>` : `<span class="mark yes">&#9679; read daily</span>`}</td></tr>`).join("")
    + `</tbody>`;
  document.getElementById("find-sources").innerHTML =
    `The ledger reads ${words(d.agencies.length)} portals in ${words(d.counties.length)} counties once a day. `
    + `${Words(ok.length)} ${plural(ok.length, "was", "were")} captured on ${dayLabel(d.scope.last_capture)}. `
    + stalled.map((a) => stalledText(a)).join(" ");
  document.getElementById("sources-more").innerHTML =
    `The whole archive is public at <a href="${esc(d.archive_repo)}" rel="noopener">${esc(host(d.archive_repo))}</a>, `
    + `one folder per county, and Flock lists every published portal at <a href="${esc(d.portal_home)}" rel="noopener">${esc(host(d.portal_home))}</a>. `
    + `The camera map on the Cameras tab is drawn from <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>, `
    + `the same data <a href="https://deflock.me" rel="noopener">DeFlock</a> maps, and not from any portal.`
    + (d.scope.waiting.length ? ` ${Words(d.scope.waiting.length)} more Michigan counties (${esc(listOf(d.scope.waiting))}) have a folder in the archive and no department publishing a portal it can read yet.` : "");
}

loadPayload("FLOCK_DATA", "flock.json")
  .then((d) => {
    // Each section renders on its own, so one data edge case in one chart
    // cannot blank every section after it. A failure still reaches the
    // console, which the headless gate treats as a failed build.
    const steps = [
      ["masthead", masthead], ["county band", countyBand], ["profile", profilePanel], ["overview", overviewSection],
      ["reach", mapChart], ["map", geoMap], ["org search", orgSearch], ["cameras", camerasSection], ["camera counts", camOfficial], ["camera comparison", camTogether], ["camera changes", camChanges],
      ["private", privateSection], ["sources", sourcesSection], ["sharing", sharingChart], ["exposure", exposureSection], ["trends", trendsChart],
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
