/* Timeline explorer. Self-contained: shares style.css with the report, not app.js. */

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
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function hover(node, html) {
  node.addEventListener("pointerenter", () => { tip.innerHTML = typeof html === "function" ? html() : html; tip.classList.add("on"); });
  node.addEventListener("pointermove", (e) => {
    if (typeof html === "function") tip.innerHTML = html(e);
    const pad = 14; let x = e.clientX + pad, y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  });
  node.addEventListener("pointerleave", () => tip.classList.remove("on"));
}

function chips(host, label, items, isOn, onToggle) {
  const group = document.createElement("div");
  group.className = "ctl-group";
  if (label) { const l = document.createElement("span"); l.className = "ctl-label"; l.textContent = label; group.appendChild(l); }
  const render = () => {
    [...group.querySelectorAll(".chip")].forEach((c) => {
      const on = isOn(c.dataset.value);
      c.setAttribute("aria-pressed", on ? "true" : "false");
      c.style.setProperty("--swatch", on ? (c.dataset.swatch || cssvar("--series-1")) : "");
      c.style.color = on && c.dataset.swatch ? c.dataset.swatch : "";
    });
  };
  items.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `chip${it.strong ? " county" : ""}`;
    b.dataset.value = it.value; if (it.swatch) b.dataset.swatch = it.swatch;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${it.dot === false ? "" : "<i></i>"}<span>${esc(it.label)}</span>`;
    b.addEventListener("click", () => onToggle(it.value));
    group.appendChild(b);
  });
  host.appendChild(group);
  group.rerender = render; render();
  return group;
}

/* Calendar arithmetic on ISO day strings, in UTC so DST cannot skip a day. */
const toDate = (d) => new Date(`${d}T00:00:00Z`);
const toIso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (d, n) => toIso(new Date(toDate(d).getTime() + n * 86400000));
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const pretty = (d) => toDate(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/* Visual class per event type. Three validated hues carry the three big
   families; the rare kinds are glyphs above the column, never a fourth hue. */
const VIS = {
  add: { fill: "--series-1", label: "added to a sharing list" },
  remove: { fill: "--series-2", label: "dropped from a sharing list" },
  osm_add: { fill: "--series-3", label: "camera mapped" },
  osm_remove: { fill: "--series-3", hatch: true, label: "camera removed from the map" },
  cameras: { outline: true, label: "portal camera count changed" },
  fault: { glyph: "triangle", label: "capture fault" },
  departure: { glyph: "diamond", label: "organization left several portals" },
  portal: { glyph: "square", label: "portal stopped publishing a figure" },
};
const BAR_TYPES = ["add", "remove", "osm_add", "osm_remove", "cameras"];
const GLYPH_TYPES = ["fault", "departure", "portal"];

// Same two-way load as app.js: window.TIMELINE_DATA when bundled, fetch when served.
function loadPayload(name, url) {
  if (window[name]) return Promise.resolve(window[name]);
  return fetch(url).then((r) => r.json());
}

loadPayload("TIMELINE_DATA", "timeline.json").then(init).catch((err) => {
  document.body.insertAdjacentHTML("afterbegin",
    `<pre style="padding:2rem;color:#c08a10">This build is missing its data file.\n\n${err}</pre>`);
});

function init(tl) {
  const byDay = Object.fromEntries(tl.days.map((d) => [d.d, d]));
  const slugs = tl.sources.filter((s) => s.county && s.county !== s.key).map((s) => s.key);
  const state = {
    range: tl.presets.captures.slice(),
    day: tl.last_capture || tl.today,
    types: new Set(tl.types.map((t) => t.key)),
    // Opens on the first county in the report's order (the largest
    // operation); "Everything" stays one click away, and the hash overrides.
    source: (tl.sources.find((s) => s.county === s.key) || { key: "all" }).key,
    preset: "captures",
  };

  /* ---- hash ---- */
  const readHash = () => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (h.get("r") && tl.presets[h.get("r")]) { state.preset = h.get("r"); state.range = tl.presets[state.preset].slice(); }
    if (h.get("a") && h.get("b")) { state.range = [h.get("a"), h.get("b")]; state.preset = ""; }
    if (h.get("d")) state.day = h.get("d");
    if (h.get("t")) state.types = new Set(h.get("t").split(",").filter((t) => VIS[t]));
    if (h.get("s") && tl.sources.some((s) => s.key === h.get("s"))) state.source = h.get("s");
  };
  const writeHash = () => {
    const h = new URLSearchParams();
    h.set("d", state.day);
    if (state.preset) h.set("r", state.preset); else { h.set("a", state.range[0]); h.set("b", state.range[1]); }
    if (state.types.size !== tl.types.length) h.set("t", [...state.types].join(","));
    if (state.source !== "all") h.set("s", state.source);
    history.replaceState(null, "", `#${h.toString()}`);
  };
  readHash();

  /* ---- filters ---- */
  const sourceOk = (ev) => {
    if (state.source === "all") return true;
    if (ev.t === "departure") return (ev.who || []).some((s) => s === state.source || tl.county_of[s] === state.source);
    if (!ev.s) return false;
    if (ev.s === state.source) return true;
    return tl.county_of[ev.s] === state.source;
  };
  const visible = (ev) => state.types.has(ev.t) && sourceOk(ev);
  const searchesOn = (d) => {
    if (!d) return 0;
    return Object.entries(d.srch).reduce((n, [s, v]) =>
      n + ((state.source === "all" || s === state.source || tl.county_of[s] === state.source) ? v : 0), 0);
  };

  /* ---- controls ---- */
  const rangeHost = document.getElementById("range-controls");
  const rangeCtl = chips(rangeHost, "Range", [
    { value: "captures", label: `Capture window (${tl.presets.captures[0]} on)`, dot: false },
    { value: "audit", label: `Search audit (${tl.presets.audit[0]} on)`, dot: false },
    { value: "all", label: `Everything (${tl.presets.all[0]} on)`, dot: false },
  ], (v) => v === state.preset, (v) => {
    state.preset = v; state.range = tl.presets[v].slice();
    if (state.day < state.range[0] || state.day > state.range[1]) state.day = state.range[1];
    update();
  });
  const typeCtl = chips(document.getElementById("type-controls"), "Show",
    tl.types.map((t) => ({ value: t.key, label: `${VIS[t.key].label} (${fmt(t.n)})`, swatch: VIS[t.key].fill ? cssvar(VIS[t.key].fill) : cssvar("--ink-2") })),
    (v) => state.types.has(v), (v) => {
      if (state.types.has(v)) state.types.delete(v); else state.types.add(v);
      update();
    });
  const srcCtl = chips(document.getElementById("source-controls"), "Source",
    tl.sources.map((s) => ({ value: s.key, label: s.name, dot: false, strong: s.county === s.key })),
    (v) => v === state.source, (v) => { state.source = v; update(); });

  /* ---- strip ---- */
  const svg = document.getElementById("strip");
  const W = 1200, H = 250, padL = 44, padR = 18, padT = 26, padB = 36;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  const defs = el("defs");
  const pat = el("pattern", { id: "hatch", patternUnits: "userSpaceOnUse", width: 5, height: 5, patternTransform: "rotate(45)" });
  pat.appendChild(el("rect", { width: 5, height: 5, fill: cssvar("--series-3"), "fill-opacity": 0.25 }));
  pat.appendChild(el("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: cssvar("--series-3"), "stroke-width": 2 }));
  defs.appendChild(pat);
  svg.appendChild(defs);
  const gAxis = el("g"), gLine = el("g"), gBars = el("g"), gGlyph = el("g"), gHit = el("g"), gSel = el("g");
  [gAxis, gSel, gLine, gBars, gGlyph, gHit].forEach((g) => svg.appendChild(g));

  let drag = null;

  function drawStrip() {
    [gAxis, gLine, gBars, gGlyph, gHit, gSel].forEach((g) => { while (g.firstChild) g.removeChild(g.firstChild); });
    const [a, b] = state.range;
    const n = daysBetween(a, b) + 1;
    const plot = W - padL - padR, bw = plot / n;
    const x = (i) => padL + i * bw;
    const dayAt = (i) => addDays(a, i);

    // counts per day per type, filtered
    const cols = [];
    let maxStack = 1, maxSearch = 1;
    for (let i = 0; i < n; i++) {
      const d = byDay[dayAt(i)];
      const counts = {};
      let stack = 0;
      if (d) d.ev.forEach((ev) => { if (visible(ev)) { counts[ev.t] = (counts[ev.t] || 0) + ev.n; if (BAR_TYPES.includes(ev.t)) stack += ev.n; } });
      const s = searchesOn(d);
      maxStack = Math.max(maxStack, stack); maxSearch = Math.max(maxSearch, s);
      cols.push({ d, counts, stack, s });
    }
    const plotH = H - padT - padB;
    const y = (v) => padT + plotH - (v / maxStack) * plotH;
    const ys = (v) => padT + plotH - (v / maxSearch) * plotH;

    // axis: baseline, left ticks, date labels
    gAxis.appendChild(el("line", { x1: padL, x2: W - padR, y1: padT + plotH + 0.5, y2: padT + plotH + 0.5, stroke: cssvar("--rule-bright") }));
    [0, maxStack].forEach((v) => {
      gAxis.appendChild(el("text", { x: padL - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11.5, fill: cssvar("--ink-dim") }, fmt(v)));
      if (v) gAxis.appendChild(el("line", { x1: padL, x2: W - padR, y1: y(v) + 0.5, y2: y(v) + 0.5, stroke: cssvar("--rule") }));
    });
    const step = n <= 45 ? 1 : n <= 120 ? 7 : n <= 400 ? 30 : 60;
    for (let i = 0; i < n; i++) {
      const d = dayAt(i);
      const dt = toDate(d);
      const tick = step === 1 ? (dt.getUTCDay() === 1 || n <= 14) : step === 7 ? dt.getUTCDay() === 1 : (dt.getUTCDate() === 1 && (step === 30 || dt.getUTCMonth() % 2 === 0));
      if (!tick) continue;
      const label = step === 1 ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
        : step === 7 ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
          : dt.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
      gAxis.appendChild(el("line", { x1: x(i) + 0.5, x2: x(i) + 0.5, y1: padT + plotH, y2: padT + plotH + 5, stroke: cssvar("--rule-bright") }));
      // A label that would run past the right edge is dropped, not clipped.
      if (x(i) + 3 + label.length * 7 <= W - padR) {
        gAxis.appendChild(el("text", { x: x(i) + 3, y: padT + plotH + 18, "font-size": 11.5, fill: cssvar("--ink-dim") }, label));
      }
    }
    // Caption sits at the left, where the tallest bars and their glyphs are not.
    gAxis.appendChild(el("text", { x: padL, y: padT - 10, "font-size": 11.5, fill: cssvar("--ink-dim") },
      `changes per day as bars; searches per day as the line, own scale, peak ${fmt(maxSearch)}`));

    // search volume line
    let path = "";
    cols.forEach((c, i) => { path += `${i ? "L" : "M"}${(x(i) + bw / 2).toFixed(1)},${ys(c.s).toFixed(1)}`; });
    if (cols.some((c) => c.s)) gLine.appendChild(el("path", { d: path, fill: "none", stroke: cssvar("--ink-dim"), "stroke-width": 1.2, "stroke-opacity": 0.8 }));

    // bars + glyphs + hit targets
    const gap = bw > 4 ? 1 : 0;
    cols.forEach((c, i) => {
      const partial = dayAt(i) === tl.today;
      let base = 0;
      BAR_TYPES.forEach((t) => {
        const v = c.counts[t]; if (!v) return;
        const top = y(base + v), bot = y(base);
        const r = el("rect", { x: x(i) + gap / 2, y: top, width: Math.max(bw - gap, 0.6), height: Math.max(bot - top - (base ? 1 : 0), 0.8) });
        const vis = VIS[t];
        if (vis.outline) { r.setAttribute("fill", "none"); r.setAttribute("stroke", cssvar("--ink")); r.setAttribute("stroke-width", 1); }
        else r.setAttribute("fill", vis.hatch ? "url(#hatch)" : cssvar(vis.fill));
        if (partial) r.setAttribute("opacity", 0.45);
        gBars.appendChild(r);
        base += v;
      });
      GLYPH_TYPES.forEach((t, gi) => {
        const v = c.counts[t]; if (!v) return;
        const cx = x(i) + bw / 2, cy = y(c.stack) - 9 - gi * 12;
        const g = t === "fault"
          ? el("path", { d: `M${cx},${cy - 5} L${cx + 5},${cy + 4} L${cx - 5},${cy + 4} Z`, fill: cssvar("--series-2") })
          : VIS[t].glyph === "square" ? el("rect", { x: cx - 4, y: cy - 4, width: 8, height: 8, fill: "none", stroke: cssvar("--ink"), "stroke-width": 1.5 })
          : el("path", { d: `M${cx},${cy - 5} L${cx + 5},${cy} L${cx},${cy + 5} L${cx - 5},${cy} Z`, fill: cssvar("--ink") });
        if (partial) g.setAttribute("opacity", 0.45);
        gGlyph.appendChild(g);
      });
      if (c.d && c.d.d === state.day) {
        gSel.appendChild(el("rect", { x: x(i), y: padT - 4, width: Math.max(bw, 1), height: plotH + 4, fill: cssvar("--surface-2") }));
      } else if (dayAt(i) === state.day) {
        gSel.appendChild(el("rect", { x: x(i), y: padT - 4, width: Math.max(bw, 1), height: plotH + 4, fill: cssvar("--surface-2") }));
      }
      const hit = el("rect", { x: x(i), y: padT - 6, width: Math.max(bw, 1), height: plotH + 6, fill: "transparent" });
      hit.style.cursor = "pointer";
      const d = dayAt(i);
      hover(hit, () => {
        const parts = Object.entries(c.counts).map(([t, v]) => `${fmt(v)} ${VIS[t].label}`);
        return `<b>${esc(pretty(d))}</b><br>${parts.length ? parts.join("<br>") : "no change recorded"}`
          + `<br><span class="k">${fmt(c.s)} searches${c.d && c.d.cap.length ? ` · ${c.d.cap.length} portals captured` : ""}</span>`;
      });
      hit.addEventListener("pointerdown", (e) => { drag = { from: i, to: i, moved: false }; hit.setPointerCapture(e.pointerId); });
      hit.addEventListener("pointermove", (e) => {
        if (!drag) return;
        // Column under the pointer, measured against the whole SVG rather than
        // the hit rectangle, which is only one column wide.
        const rect = svg.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (W / rect.width);
        const j = Math.max(0, Math.min(n - 1, Math.floor((sx - padL) / bw)));
        if (j !== drag.to) { drag.to = j; drag.moved = true; showDrag(x, bw, plotH); }
      });
      hit.addEventListener("pointerup", () => {
        if (!drag) return;
        const { from, to, moved } = drag; drag = null;
        if (moved && Math.abs(to - from) >= 2) {
          state.range = [dayAt(Math.min(from, to)), dayAt(Math.max(from, to))]; state.preset = "";
          if (state.day < state.range[0] || state.day > state.range[1]) state.day = state.range[0];
        } else {
          state.day = d;
        }
        update();
      });
      gHit.appendChild(hit);
    });
  }
  function showDrag(x, bw, plotH) {
    const old = gSel.querySelector(".drag"); if (old) old.remove();
    const lo = Math.min(drag.from, drag.to), hi = Math.max(drag.from, drag.to);
    const r = el("rect", { class: "drag", x: x(lo), y: padT - 4, width: (hi - lo + 1) * bw, height: plotH + 4, fill: cssvar("--series-1"), "fill-opacity": 0.12 });
    gSel.appendChild(r);
  }

  document.getElementById("strip-legend").innerHTML = BAR_TYPES.concat(GLYPH_TYPES).map((t) => {
    const v = VIS[t];
    const sw = v.outline ? `border:1px solid var(--ink);background:none`
      : v.hatch ? `background:repeating-linear-gradient(45deg,var(--series-3) 0 2px,transparent 2px 5px)`
        : v.glyph === "triangle" ? `background:var(--series-2);clip-path:polygon(50% 0,100% 100%,0 100%)`
          : v.glyph === "diamond" ? `background:var(--ink);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)`
          : v.glyph === "square" ? `background:none;border:1.5px solid var(--ink);box-sizing:border-box`
            : `background:var(${v.fill})`;
    return `<span><i style="${sw}"></i> ${esc(v.label)}</span>`;
  }).join("") + `<span><i style="background:none;border-bottom:1px solid var(--ink-dim);height:1px"></i> searches per day</span>`;

  /* ---- day panel ---- */
  function prevStateFor(slug, day) {
    for (let i = tl.days.length - 1; i >= 0; i--) {
      const d = tl.days[i];
      if (d.d < day && d.st[slug]) return { day: d.d, st: d.st[slug] };
    }
    return null;
  }
  function drawDay() {
    const d = byDay[state.day];
    document.getElementById("day-head").textContent = pretty(state.day);
    const sub = document.getElementById("day-sub");
    const inCapture = state.day >= tl.presets.captures[0] && state.day <= (tl.last_capture || tl.today);
    const evs = d ? d.ev.filter(visible) : [];
    sub.innerHTML = d && d.cap.length
      ? `${state.day === tl.today ? "<b>Today, in progress.</b> " : ""}${d.cap.length} of ${slugs.length} portals captured (${esc(d.cap.map((s) => tl.agency_names[s]).join(", "))})`
        + (d.ceil ? ` &middot; network ceiling ${fmt(d.ceil)}` : "")
      : inCapture ? `<b>No capture ran on this day.</b> Anything that changed on the portals went unrecorded until the next one.`
        : state.day > (tl.last_capture || "") && state.day <= tl.today
          ? `<b>After the last capture (${esc(tl.last_capture)}).</b> Nothing has been recorded since.`
          : `Before the capture window. Only the search audit${state.day < tl.presets.audit[0] ? " is not here either; only the map history" : ""} reaches this far.`;

    const host = document.getElementById("day-events");
    if (!evs.length) {
      host.innerHTML = `<p class="hint">No change of the selected kinds${state.source !== "all" ? " for this source" : ""} on this day.</p>`;
    } else {
      const groups = {};
      evs.forEach((ev) => (groups[ev.t] = groups[ev.t] || []).push(ev));
      host.innerHTML = BAR_TYPES.concat(GLYPH_TYPES).filter((t) => groups[t]).map((t) => {
        const list = groups[t];
        const total = list.reduce((n, ev) => n + ev.n, 0);
        return `<div class="ev-group"><h4>${esc(VIS[t].label)} <span>${fmt(total)}</span></h4>`
          + list.map((ev) => {
            const who = ev.s ? esc(tl.agency_names[ev.s]) : (t === "departure" ? "several portals" : "outside the eight jurisdictions");
            const dir = ev.dir ? ` · ${ev.dir}` : "";
            const names = ev.names.length ? `<div class="orgs">${ev.names.map((x) => `<span class="org ${t === "remove" || t === "osm_remove" ? "rem" : "add"}">${esc(x)}</span>`).join("")}`
              + (ev.n > ev.names.length ? `<span class="org more">and ${fmt(ev.n - ev.names.length)} more</span>` : "") + `</div>` : "";
            return `<div class="ev"><div class="ev-who">${who}${dir}${ev.note ? ` <span class="k">${esc(ev.note)}</span>` : ""}</div>${names}</div>`;
          }).join("") + `</div>`;
      }).join("");
    }

    // state table
    const t = document.getElementById("day-state");
    const rows = slugs.filter((s) => state.source === "all" || s === state.source || tl.county_of[s] === state.source);
    const cell = (v, prev) => {
      if (v == null) return `<td class="num muted">·</td>`;
      let delta = "";
      if (prev != null && v != null && prev !== v) { const df = v - prev; delta = ` <small class="${df > 0 ? "up" : "down"}">${df > 0 ? "+" : ""}${fmt(df)}</small>`; }
      if (v == null && prev != null) delta = ` <small class="down">stopped</small>`;
      return `<td class="num">${v == null ? "&ndash;" : fmt(v)}${delta}</td>`;
    };
    t.innerHTML = `<thead><tr><th>Department</th><th>Cameras</th><th>Vehicles, 30d</th><th>Searches, 30d</th><th>Hotlist hits</th><th>Shares out</th><th>Can query</th><th>Searches today</th><th>Median reach</th></tr></thead><tbody>`
      + rows.map((s) => {
        const st = d ? d.st[s] : null;
        const prev = prevStateFor(s, state.day);
        const p = prev ? prev.st : {};
        const srch = d ? d.srch[s] : null, reach = d ? d.reach[s] : null;
        return `<tr><td>${esc(tl.agency_names[s])}${st ? "" : `<br><span class="muted">no capture</span>`}</td>`
          + (st ? cell(st.cameras, p.cameras) + cell(st.vehicles, p.vehicles) + cell(st.searches, p.searches) + cell(st.hits, p.hits) + cell(st.outbound, p.outbound) + cell(st.inbound, p.inbound)
            : `<td class="num muted">·</td>`.repeat(6))
          + `<td class="num">${srch == null ? `<span class="muted">·</span>` : fmt(srch)}</td><td class="num">${reach == null || reach < 0 ? `<span class="muted">·</span>` : fmt(reach)}</td></tr>`;
      }).join("") + `</tbody>`;
    document.getElementById("day-state-note").textContent = d && d.cap.length
      ? "Deltas are against the previous captured day for that department. Vehicles, hits and thirty-day searches are rolling counters."
      : "Searches today and median reach come from the search audit, which does not need a capture to exist for the day.";
    const odd = (tl.relabelled || []).filter((r) => d && d.cap.includes(r.slug));
    if (odd.length) {
      const groups = {};
      odd.forEach((r) => { (groups[`${r.tile}|${r.reads}`] ||= []).push(r); });
      document.getElementById("day-state-note").textContent += " " + Object.values(groups).map((rs) =>
        `${rs.map((r) => tl.agency_names[r.slug]).join(", ")}: ${rs[0].tile} tile reads "${rs[0].reads}" where the others read "${rs[0].usual}", so that figure is not the same count.`).join(" ");
    }
  }

  /* ---- navigation ---- */
  const step = (n) => {
    const nd = addDays(state.day, n);
    if (nd > tl.today || nd < tl.axis_start) return;
    state.day = nd;
    if (nd < state.range[0]) { state.range[0] = nd; state.preset = ""; }
    if (nd > state.range[1]) { state.range[1] = nd; state.preset = ""; }
    update();
  };
  document.getElementById("day-prev").addEventListener("click", () => step(-1));
  document.getElementById("day-next").addEventListener("click", () => step(1));
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    if (e.key === "Home") { e.preventDefault(); state.day = state.range[0]; update(); }
    if (e.key === "End") { e.preventDefault(); state.day = state.range[1]; update(); }
  });

  function update() {
    rangeCtl.rerender(); typeCtl.rerender(); srcCtl.rerender();
    drawStrip(); drawDay(); writeHash();
    const n = daysBetween(state.range[0], state.range[1]) + 1;
    const shown = tl.days.filter((d) => d.d >= state.range[0] && d.d <= state.range[1])
      .reduce((c, d) => c + d.ev.filter(visible).reduce((k, ev) => k + ev.n, 0), 0);
    document.getElementById("strip-note").textContent =
      `${fmt(n)} days from ${state.range[0]} to ${state.range[1]}, ${fmt(shown)} changes of the selected kinds. `
      + `Drag across the bars to zoom to a range; click a bar to open its day.`;
  }
  update();

  document.getElementById("tl-notes").innerHTML =
    `Built ${esc(tl.generated_at)}. Last portal capture ${esc(tl.last_capture || "none")}. `
    + (tl.before_axis.length
      ? `${fmt(tl.before_axis.length)} map nodes carry OpenStreetMap creation dates before ${esc(tl.axis_start)} `
        + `(${esc(tl.before_axis.map((e) => e.d.slice(0, 4)).join(", "))}); presumably surveillance nodes retagged as ALPR years later, they sit outside the axis.`
      : "");
}
