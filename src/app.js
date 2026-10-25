import { t, setLang } from "./i18n.js";
import { deviceArt, icons } from "./art.js";

const tauri = window.__TAURI__;
const invoke = tauri ? tauri.core.invoke : async () => { throw new Error("no backend"); };

// [background, sidebar, accent, text] for the theme picker preview
const THEMES = {
  mono: ["#0e0e0f", "#141415", "#ffffff", "#f3f3f1"],
  neon: ["#07100d", "#0c1714", "#2ff0b0", "#e9fff6"],
  orange: ["#100b08", "#18110c", "#ff7a1a", "#fff3ea"],
  violet: ["#0c0a12", "#13101c", "#a083ff", "#f3efff"],
  terminal: ["#000000", "#030803", "#33ff66", "#33ff66"],
  paper: ["#efede7", "#e8e5dd", "#121212", "#121212"],
  win95: ["#008080", "#c0c0c0", "#000080", "#ffffff"],
};
const PALETTE = ["#2ff0b0", "#22a6ff", "#7b6cff", "#ff3bd4", "#ff3355", "#ff8a3b", "#ffd23b", "#ffffff"];
// mouse functions a button can take, as the device encodes them
const MOUSE_FUNCS = [1, 2, 3, 4, 5, 9, 10];
const REMAPPABLE = [3, 4, 5];
const STAGE_COLORS = ["#ff4d4d", "#3ee07a", "#4d8bff", "#2fd8e6", "#ffd23b"];
const FX_COLOR = { static: 1, breathing: 2, reactive: 1, starlight: 1 };
const FX_SPEED = new Set(["wave", "reactive", "starlight"]);

const EXT_FX = ["static", "breathing", "spectrum", "wave", "reactive", "starlight", "off"];
const DEMO = [
  { key: "demo:viper", name: "Viper V3 Pro", kind: "mouse", wireless: true, receiver: true, firmware: "v1.04",
    caps: { dpi: true, stages: true, max_dpi: 35000, polling: [125, 500, 1000, 2000, 4000, 8000], battery: true, idle: true, liftoff: true, dongle_led: true, dynamic_sensitivity: true, remap: true, lighting: false, brightness: false, effects: [], zones: [] } },
  { key: "demo:basilisk", name: "Basilisk V3", kind: "mouse", firmware: "v1.10",
    caps: { dpi: true, stages: true, max_dpi: 26000, polling: [125, 500, 1000], battery: false, idle: false, lighting: true, brightness: true, effects: EXT_FX, zones: [{ id: 4, name: "logo" }, { id: 1, name: "scroll" }] } },
  { key: "demo:bw", name: "BlackWidow V4", kind: "keyboard", firmware: "v2.01",
    caps: { dpi: false, stages: false, max_dpi: 0, polling: [], battery: false, idle: false, lighting: true, brightness: true, effects: EXT_FX, zones: [{ id: 5, name: "backlight" }] } },
  { key: "demo:firefly", name: "Firefly V2", kind: "mousepad", firmware: "v1.01",
    caps: { dpi: false, stages: false, max_dpi: 0, polling: [], battery: false, idle: false, lighting: true, brightness: true, effects: EXT_FX, zones: [{ id: 0, name: "all" }] } },
].map((d) => ({ pid: 0, wireless: false, receiver: false, verified: true, online: true, serial: null, demo: true, ...d }));

const state = {
  lib: null,
  devices: [],
  view: { type: "device", key: null },
  tab: "performance",
  zone: null,
  hw: {},
  seen: new Set(),
};

// ------------------------------------------------------------------ helpers

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
const timers = {};
const debounce = (id, fn, ms = 140) => { clearTimeout(timers[id]); timers[id] = setTimeout(fn, ms); };
const svgIcon = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const I = {
  apply: svgIcon('<path d="M5 12l5 5L20 7"/>'),
  copy: svgIcon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  download: svgIcon('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: svgIcon('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
  edit: svgIcon('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  trash: svgIcon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  dup: svgIcon('<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/>'),
  wifi: svgIcon('<path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/>'),
  cable: svgIcon('<path d="M12 3v6M9 9h6v4a3 3 0 0 1-6 0zM12 16v5"/>'),
  chip: svgIcon('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
  bolt: svgIcon('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  x: '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg>',
};

function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="ic"></span><span>${esc(msg)}</span>`;
  $("#toasts").append(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, type === "error" ? 5200 : 2800);
}

function modal({ title, text = "", body = "", actions }) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal" role="dialog"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${body}
      <div class="actions">${actions.map((a, i) => `<button class="btn ${a.kind || ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div></div>`;
    const close = (v) => { root.innerHTML = ""; resolve(v); };
    root.onclick = (e) => {
      if (e.target === root) return close(null);
      const pick = e.target.closest("[data-pick]");
      if (pick) return close(+pick.dataset.pick);
      const b = e.target.closest("[data-i]");
      if (b) close(actions[+b.dataset.i].value?.(root) ?? null);
    };
    root.onkeydown = (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && e.target.tagName === "INPUT") close(actions.at(-1).value?.(root) ?? null);
    };
    $("input, textarea, button.primary", root)?.focus();
  });
}

const askText = (title, value = "", placeholder = "") =>
  modal({
    title,
    body: `<input class="text-input" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="60">`,
    actions: [{ label: t("cancel"), kind: "ghost" }, { label: t("save"), kind: "primary", value: (r) => $("input", r).value.trim() || null }],
  });

const confirmBox = (title, text) =>
  modal({ title, text, actions: [{ label: t("cancel"), kind: "ghost" }, { label: t("delete"), kind: "primary", value: () => true }] });

// ------------------------------------------------------------------ library

function defaultLib() {
  return { version: 1, presets: [], bindings: {}, photos: {}, settings: { lang: "ru", theme: "mono", autoApply: true, demo: !tauri } };
}

async function loadLib() {
  let lib = defaultLib();
  try {
    const raw = tauri ? await invoke("load_library") : localStorage.getItem("osyn-lib");
    if (raw) {
      const parsed = JSON.parse(raw);
      lib = { ...lib, ...parsed, settings: { ...lib.settings, ...parsed.settings } };
      lib.photos = lib.photos || {};
      lib.presets = (lib.presets || []).map((p) => ({ ...p, settings: normalize(p.settings) }));
    }
  } catch (e) {
    console.warn("library load failed", e);
  }
  state.lib = lib;
}

function saveLib() {
  debounce("save", async () => {
    const json = JSON.stringify(state.lib, null, 2);
    try {
      if (tauri) await invoke("save_library", { json });
      else localStorage.setItem("osyn-lib", json);
    } catch (e) {
      toast(String(e), "error");
    }
  }, 300);
}

function defaultFx() {
  return { effect: "static", colors: ["#2ff0b0", "#22a6ff"], two: false, speed: 2, direction: 1 };
}

function normalize(s = {}) {
  const num = (v, d, a, b) => (Number.isFinite(+v) ? clamp(Math.round(+v), a, b) : d);
  const stages = (Array.isArray(s.dpi?.stages) ? s.dpi.stages : [])
    .slice(0, 5)
    .map((st) => ({ x: num(st.x, 800, 100, 50000), y: num(st.y ?? st.x, 800, 100, 50000) }));
  if (!stages.length) stages.push({ x: 400, y: 400 }, { x: 800, y: 800 }, { x: 1600, y: 1600 }, { x: 3200, y: 3200 });
  const zones = {};
  for (const [k, z] of Object.entries(s.lighting?.zones || {})) {
    const d = defaultFx();
    zones[k] = {
      effect: EXT_FX.includes(z.effect) ? z.effect : d.effect,
      colors: [0, 1].map((i) => (/^#[0-9a-f]{6}$/i.test(z.colors?.[i]) ? z.colors[i] : d.colors[i])),
      two: !!z.two,
      speed: num(z.speed, 2, 1, 4),
      direction: z.direction === 2 ? 2 : 1,
    };
  }
  if (!zones.all) zones.all = defaultFx();
  return {
    dpi: { stages, active: num(s.dpi?.active, 0, 0, stages.length - 1), split: !!s.dpi?.split },
    polling: num(s.polling, 1000, 125, 8000),
    lighting: { brightness: num(s.lighting?.brightness, 80, 0, 100), sync: s.lighting?.sync !== false, zones },
    calib: {
      liftoff: num(s.calib?.liftoff, 1, 0, 2),
      dynamic: !!s.calib?.dynamic,
      curve: num(s.calib?.curve, 0, 0, 3),
      customMax: Number.isFinite(+s.calib?.customMax) ? clamp(+s.calib.customMax, 1, 2.5) : 1.5,
    },
    buttons: Object.fromEntries(REMAPPABLE.map((b) => [b, MOUSE_FUNCS.includes(+s.buttons?.[b]) ? +s.buttons[b] : b])),
    dongle: { led: num(s.dongle?.led, 2, 1, 3) },
    power: { idle: num(s.power?.idle, 300, 60, 900), lowBattery: num(s.power?.lowBattery, 15, 5, 100) },
  };
}

function settingsFromHw(dev) {
  const hw = state.hw[dev.key] || {};
  const max = dev.caps.max_dpi || 26000;
  const s = normalize({});
  if (hw.stages?.[1]?.length) {
    s.dpi.stages = hw.stages[1].map(([x, y]) => ({ x, y }));
    s.dpi.active = clamp(hw.stages[0] - 1, 0, s.dpi.stages.length - 1);
  } else {
    s.dpi.stages = s.dpi.stages.filter((st) => st.x <= max);
  }
  if (hw.polling) s.polling = hw.polling;
  if (hw.idle) s.power.idle = clamp(hw.idle, 60, 900);
  if (hw.liftoff != null) s.calib.liftoff = clamp(hw.liftoff, 0, 2);
  if (hw.dynamic_sensitivity != null) s.calib.dynamic = hw.dynamic_sensitivity;
  if (hw.dongle_led != null) s.dongle.led = hw.dongle_led;
  if (hw.curve != null) s.calib.curve = hw.curve;
  for (const [b, f] of hw.buttons || []) if (REMAPPABLE.includes(b) && MOUSE_FUNCS.includes(f)) s.buttons[b] = f;
  if (hw.low_battery) s.power.lowBattery = clamp(hw.low_battery, 5, 100);
  return s;
}

function presetFor(dev) {
  const lib = state.lib;
  let p = lib.presets.find((x) => x.id === lib.bindings[dev.key]);
  if (!p) {
    p = { id: uid(), name: t("defaultPreset", { device: dev.name }), kind: dev.kind, created: Date.now(), updated: Date.now(), settings: settingsFromHw(dev) };
    lib.presets.push(p);
    lib.bindings[dev.key] = p.id;
    saveLib();
  }
  return p;
}

function touch(p) {
  p.updated = Date.now();
  saveLib();
}

const zoneFx = (s, name) => (s.lighting.sync ? s.lighting.zones.all : s.lighting.zones[name] || s.lighting.zones.all);

function editableFx(s) {
  if (s.lighting.sync || !state.zone) return s.lighting.zones.all;
  if (!s.lighting.zones[state.zone]) s.lighting.zones[state.zone] = structuredClone(s.lighting.zones.all);
  return s.lighting.zones[state.zone];
}

// ------------------------------------------------------------------ share codes

const payload = (p) => ({ format: "open-synapse/preset", version: 1, name: p.name, kind: p.kind, settings: p.settings });

function encodeCode(p) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload(p)));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "OSP1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeAny(text) {
  text = text.trim();
  let obj;
  if (text.startsWith("OSP1.")) {
    const b64 = text.slice(5).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } else {
    obj = JSON.parse(text);
  }
  if (obj?.format !== "open-synapse/preset" || typeof obj.settings !== "object") throw new Error("format");
  return {
    id: uid(),
    name: String(obj.name || "Preset").slice(0, 60),
    kind: icons[obj.kind] ? obj.kind : "mouse",
    created: Date.now(),
    updated: Date.now(),
    settings: normalize(obj.settings),
  };
}

// ------------------------------------------------------------------ hardware

async function hw(dev, cmd, args = {}) {
  if (dev.demo || !dev.online) return;
  try {
    await invoke(cmd, { key: dev.key, ...args });
  } catch (e) {
    toast(t("deviceError", { device: dev.name, error: e }), "error");
  }
}

function applyDpi(dev, s) {
  if (!dev.caps.dpi) return;
  const max = dev.caps.max_dpi || 50000;
  const st = s.dpi.stages.map(({ x, y }) => [clamp(x, 100, max), clamp(s.dpi.split ? y : x, 100, max)]);
  const cur = st[s.dpi.active] || st[0];
  debounce("dpi" + dev.key, async () => {
    if (dev.caps.stages) await hw(dev, "set_dpi_stages", { active: s.dpi.active + 1, stages: st });
    await hw(dev, "set_dpi", { x: cur[0], y: cur[1] });
  });
}

function nearest(list, v) {
  return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]);
}

function applyPolling(dev, s) {
  if (!dev.caps.polling.length) return;
  debounce("poll" + dev.key, () => hw(dev, "set_polling", { hz: nearest(dev.caps.polling, s.polling) }));
}

function applyLighting(dev, s) {
  if (!dev.caps.lighting) return;
  debounce("light" + dev.key, async () => {
    for (const z of dev.caps.zones) {
      const fx = zoneFx(s, z.name);
      const n = fx.effect === "breathing" ? (fx.two ? 2 : 1) : FX_COLOR[fx.effect] || 0;
      await hw(dev, "set_lighting", {
        zone: z.id,
        lighting: { effect: fx.effect, colors: fx.colors.slice(0, n).map(hexToRgb), speed: fx.speed, direction: fx.direction },
        brightness: s.lighting.brightness,
      });
    }
  }, 120);
}

function applyPower(dev, s) {
  if (!dev.caps.idle) return;
  debounce("power" + dev.key, () => hw(dev, "set_power", { idle: s.power.idle, lowBattery: s.power.lowBattery }), 300);
}

function applyCalib(dev, s) {
  if (dev.caps.liftoff) debounce("calib" + dev.key, () => hw(dev, "set_liftoff", { level: s.calib.liftoff }), 200);
  if (dev.caps.dynamic_sensitivity)
    debounce("dyn" + dev.key, () => hw(dev, "set_dynamic_sensitivity", { on: s.calib.dynamic, curve: s.calib.curve, customMax: s.calib.customMax }), 300);
  if (dev.caps.dongle_led) debounce("led" + dev.key, () => hw(dev, "set_dongle_led", { mode: s.dongle.led }), 200);
}

function applyButtons(dev, s) {
  if (!dev.caps.remap) return;
  debounce("buttons" + dev.key, async () => {
    for (const b of REMAPPABLE) await hw(dev, "set_button", { button: b, function: s.buttons[b] });
  }, 200);
}

function applyAll(dev, p) {
  applyButtons(dev, p.settings);
  applyCalib(dev, p.settings);
  applyDpi(dev, p.settings);
  applyPolling(dev, p.settings);
  applyLighting(dev, p.settings);
  applyPower(dev, p.settings);
}

async function readHw(dev) {
  if (dev.demo) {
    state.hw[dev.key] = { battery: 76, charging: false };
    return;
  }
  if (!dev.online) return;
  try {
    state.hw[dev.key] = await invoke("device_state", { key: dev.key });
  } catch (e) {
    console.warn(e);
  }
}

// ------------------------------------------------------------------ device discovery

async function poll() {
  let list = [];
  if (tauri) {
    try {
      // a sleeping mouse behind its receiver cannot be read or written
      list = (await invoke("list_devices")).map((d) => ({ ...d, online: d.online && !d.asleep }));
    } catch (e) {
      console.warn(e);
    }
  }
  const all = [...list, ...(state.lib.settings.demo ? DEMO : [])];
  const sig = (ds) => ds.map((d) => `${d.key}:${d.online}:${d.firmware}`).join("|");
  const changed = sig(all) !== sig(state.devices);

  for (const d of all) {
    if (d.online && !state.seen.has(d.key)) {
      state.seen.add(d.key);
      const bound = !!state.lib.bindings[d.key];
      await readHw(d);
      const p = presetFor(d);
      if (bound && state.lib.settings.autoApply) applyAll(d, p);
    }
  }
  for (const k of [...state.seen]) if (!all.some((d) => d.key === k && d.online)) state.seen.delete(k);

  if (changed) {
    state.devices = all;
    if (state.view.type === "device" && !all.some((d) => d.key === state.view.key)) {
      state.view.key = all[0]?.key ?? null;
      state.zone = null;
    }
    render();
  }
}

async function refreshBatteries() {
  for (const d of state.devices) if (d.caps.battery && !d.demo) await readHw(d);
  renderSidebar();
  const ring = $(".battery");
  if (ring && currentDevice()) ring.outerHTML = batteryBlock(currentDevice());
}

const currentDevice = () => state.devices.find((d) => d.key === state.view.key);

// ------------------------------------------------------------------ rendering

function render() {
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  $("#device-count").textContent = state.devices.length;
  const list = $("#device-list");
  if (!state.devices.length) {
    list.innerHTML = `<div class="side-empty">${esc(t("noDevicesSide"))}</div>`;
  } else {
    list.innerHTML = state.devices
      .map((d) => {
        const b = state.hw[d.key]?.battery;
        const active = state.view.type === "device" && state.view.key === d.key;
        const sub = d.demo ? t("demo") : d.asleep ? t("sleeping") : d.online ? (d.wireless ? t("wireless") : t("wired")) : t("asleep");
        return `<button class="dev-item ${active ? "active" : ""}" data-key="${esc(d.key)}">
          <span class="dev-icon">${state.lib.photos[d.key] ? `<img src="${state.lib.photos[d.key]}" alt="">` : icons[d.kind] || icons.other}</span>
          <span style="min-width:0"><div class="dev-name">${esc(d.name)}</div>
          <div class="dev-sub"><span class="dot ${d.online ? "" : "off"}"></span>${esc(sub)}</div></span>
          ${d.caps.battery && b != null ? `<span class="batt-mini">${b}%</span>` : ""}
        </button>`;
      })
      .join("");
  }
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", state.view.type === b.dataset.view));
}

function renderMain() {
  const main = $("#main");
  const top = main.scrollTop;
  if (state.view.type === "library") main.innerHTML = libraryView();
  else if (state.view.type === "settings") main.innerHTML = settingsView();
  else {
    const dev = currentDevice();
    main.innerHTML = dev ? deviceView(dev) : emptyView();
    if (dev) paintPreview(dev);
  }
  main.querySelectorAll('input[type="range"]').forEach(setFill);
  main.scrollTop = top;
}

function rerender() {
  const main = $("#main");
  const top = main.scrollTop;
  renderMain();
  main.querySelector(".page")?.style.setProperty("animation", "none");
  main.scrollTop = top;
}

function setFill(el) {
  const p = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty("--p", p + "%");
}

const pad2 = (n) => String(n).padStart(2, "0");
const head = (num, title, right = "") =>
  `<div class="sec-head"><span><b>${pad2(num)}</b> / ${esc(title)}</span><span class="r">${right}</span></div>`;

function ruler() {
  let s = "";
  for (let i = 0; i < 40; i++) s += `<span style="top:${i * 120}px">${i * 10}</span>`;
  return `<div class="ruler" aria-hidden="true">${s}</div>`;
}

function emptyView() {
  return `<div class="page">${ruler()}<div class="empty"><div class="empty-inner">
    <div class="pulse"><img src="logo.svg" alt=""></div>
    <span class="eyebrow">00 / ${esc(t("devices"))}</span>
    <h2>${esc(t("emptyTitle"))}</h2><p>${esc(t("emptyText"))}</p>
    <button class="btn primary" data-act="demo-on">${esc(t("tryDemo"))}</button>
  </div></div></div>`;
}

function batteryBlock(dev) {
  const s = state.hw[dev.key] || {};
  if (!dev.caps.battery || s.battery == null) return `<div class="battery" hidden></div>`;
  const on = Math.round(s.battery / 10);
  return `<div class="battery">
    <div class="batt-bar ${s.battery <= 15 ? "low" : ""}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>
    <div class="batt-text"><b>${s.battery}%</b>${esc(s.charging ? t("charging") : t("battery"))}</div>
  </div>`;
}

function stageInner(dev) {
  const photo = state.lib.photos[dev.key];
  return photo ? `<img class="photo" src="${photo}" alt="">` : deviceArt(dev);
}

function deviceView(dev) {
  const p = presetFor(dev);
  const tabs = [
    ["performance", dev.caps.dpi || dev.caps.polling.length],
    ["lighting", dev.caps.lighting],
    ["power", dev.caps.idle || dev.caps.battery],
    ["buttons", dev.caps.remap],
    ["calibration", dev.caps.liftoff],
  ].filter(([, ok]) => ok).map(([id]) => id);
  if (!tabs.includes(state.tab)) state.tab = tabs[0] || "performance";
  const idx = state.devices.indexOf(dev) + 1;
  const conn = dev.receiver ? t("receiver") : dev.wireless ? t("wireless") : t("wired");

  const chips = [
    dev.demo ? `<span class="chip solid">${esc(t("demo"))}</span>` : "",
    `<span class="chip">${dev.wireless ? I.wifi : I.cable}${esc(conn)}</span>`,
    dev.firmware ? `<span class="chip">${I.chip}FW ${esc(dev.firmware)}</span>` : "",
    !dev.online ? `<span class="chip warn">${esc(t(dev.asleep ? "sleepingHint" : "asleep"))}</span>` : "",
    !dev.verified ? `<span class="chip warn" title="${esc(t("unverifiedHint"))}">${esc(t("unverified"))}</span>` : "",
  ].join("");

  const options = state.lib.presets
    .map((x) => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)}</option>`)
    .join("");

  let body = "";
  if (dev.kind === "headset") body = `<div class="grid"><div class="card"><div class="card-body"><p class="muted">${esc(t("headsetNote"))}</p></div></div></div>`;
  else if (state.tab === "performance") body = performanceTab(dev, p.settings);
  else if (state.tab === "lighting") body = lightingTab(dev, p.settings);
  else if (state.tab === "calibration") body = calibTab(dev, p.settings);
  else if (state.tab === "buttons") body = buttonsTab(dev, p.settings);
  else body = powerTab(dev, p.settings);

  const [first, ...rest] = dev.name.split(" ");
  const title = rest.length ? `${esc(first)} <span class="it">${esc(rest.join(" "))}</span>` : esc(dev.name);

  return `<div class="page">${ruler()}
    <section class="hero">
      <div class="hero-info">
        <span class="kind-label"><b>${pad2(idx)}</b> / ${esc(t("kind_" + dev.kind))} · ${esc(conn)}</span>
        <h1>${title}</h1>
        <div class="chips">${chips}</div>
        ${batteryBlock(dev)}
        <div class="preset-bar">
          <select class="select" data-act="bind" aria-label="${esc(t("preset"))}">${options}</select>
          <button class="btn" data-act="save-as">${I.plus}${esc(t("saveAs"))}</button>
          <button class="btn icon" data-act="copy-code" data-id="${p.id}" title="${esc(t("copyCode"))}">${I.copy}</button>
          <button class="btn icon" data-act="export" data-id="${p.id}" title="${esc(t("exportFile"))}">${I.download}</button>
        </div>
      </div>
      <div class="stage-wrap">
        <div class="stage" data-drop>
          <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
          <span class="stage-tag">${dev.pid ? "PID " + dev.pid.toString(16).toUpperCase().padStart(4, "0") : "DEMO"} · ${esc(t("preview"))}</span>
          ${stageInner(dev)}
        </div>
        <div class="stage-actions">
          <button class="btn" data-act="photo">${I.upload}${esc(t(state.lib.photos[dev.key] ? "changePhoto" : "addPhoto"))}</button>
          ${state.lib.photos[dev.key] ? `<button class="btn" data-act="photo-reset">${I.x.replace("<svg", '<svg style="width:10px;height:10px;stroke:currentColor;stroke-width:2"')}${esc(t("resetPhoto"))}</button>` : ""}
        </div>
        <input type="file" accept="image/*" data-photo-input hidden>
      </div>
    </section>
    ${tabs.length > 1 ? `<div class="tabs">${tabs.map((id, i) => `<button class="tab ${id === state.tab ? "active" : ""}" data-tab="${id}"><small>${pad2(i + 1)}</small>${esc(t("tab_" + id))}</button>`).join("")}</div>` : ""}
    ${body}
  </div>`;
}

function performanceTab(dev, s) {
  if (!dev.caps.dpi && !dev.caps.polling.length) return `<div class="grid"><div class="card"><div class="card-body"><p class="muted">${esc(t("noPerformance"))}</p></div></div></div>`;
  const max = dev.caps.max_dpi || 26000;
  const cur = s.dpi.stages[s.dpi.active];
  const dpiCard = dev.caps.dpi
    ? `<div class="card span-7">${head(1, t("dpi"), `MAX ${max}`)}<div class="card-body">
      <div class="dpi-big"><span class="num" id="dpi-num">${cur.x}</span><span class="unit">DPI</span></div>
      <div class="stages">
        ${s.dpi.stages.map((st, i) => `<button class="stage-chip ${i === s.dpi.active ? "selected" : ""}" data-act="stage" data-i="${i}">
          <div class="lbl"><i class="stage-dot" style="--sc:${STAGE_COLORS[i]}"></i>${esc(t("stage"))} ${pad2(i + 1)}</div><div class="val" data-stage-val="${i}">${st.x}${s.dpi.split ? ` / ${st.y}` : ""}</div>
          ${s.dpi.stages.length > 1 ? `<span class="x" data-act="stage-del" data-i="${i}">${I.x}</span>` : ""}
        </button>`).join("")}
        ${s.dpi.stages.length < 5 ? `<button class="stage-add" data-act="stage-add" title="${esc(t("addStage"))}">+</button>` : ""}
      </div>
      <div class="row"><span class="lab">${s.dpi.split ? "X" : "DPI"}</span>
        <input type="range" min="100" max="${max}" step="50" value="${cur.x}" data-dpi="x">
        <input class="val-input" type="number" min="100" max="${max}" step="50" value="${cur.x}" data-dpi-num="x"></div>
      ${s.dpi.split ? `<div class="row"><span class="lab">Y</span>
        <input type="range" min="100" max="${max}" step="50" value="${cur.y}" data-dpi="y">
        <input class="val-input" type="number" min="100" max="${max}" step="50" value="${cur.y}" data-dpi-num="y"></div>` : ""}
      <div class="row" style="margin-top:22px;justify-content:space-between"><span class="hint">${esc(t("linkXY"))}</span>
        <label class="switch"><input type="checkbox" data-act="split" ${s.dpi.split ? "checked" : ""}><span></span></label></div>
      <p class="hint-mono" style="margin:18px 0 0">${esc(t("dpiHint"))}</p>
    </div></div>`
    : "";
  const pollCard = dev.caps.polling.length
    ? `<div class="card ${dev.caps.dpi ? "span-5" : ""}">${head(dev.caps.dpi ? 2 : 1, t("polling"), `${nearest(dev.caps.polling, s.polling)} ${esc(t("hz"))}`)}<div class="card-body">
      <p class="hint" style="margin:0 0 18px">${esc(t("pollingHint"))}</p>
      <div class="seg">${dev.caps.polling.map((hz) => `<button class="${nearest(dev.caps.polling, s.polling) === hz ? "on" : ""}" data-act="poll" data-hz="${hz}">
        ${hz >= 1000 ? hz / 1000 + "K" : hz}<small>${hz} ${esc(t("hz"))}</small></button>`).join("")}</div>
    </div></div>`
    : "";
  return `<div class="grid">${dpiCard}${pollCard}</div>`;
}

function lightingTab(dev, s) {
  if (!dev.caps.lighting) return `<div class="grid"><div class="card"><div class="card-body"><p class="muted">${esc(t("noLighting"))}</p></div></div></div>`;
  const zones = dev.caps.zones;
  if (!state.zone || !zones.some((z) => z.name === state.zone)) state.zone = zones[0]?.name;
  const fx = s.lighting.sync ? s.lighting.zones.all : zoneFx(s, state.zone);
  const nColors = fx.effect === "breathing" ? (fx.two ? 2 : 1) : FX_COLOR[fx.effect] || 0;

  const colorSlot = (i) => `<div class="color-slot">
      <label class="color-input" style="background:${fx.colors[i]}"><input type="color" value="${fx.colors[i]}" data-color="${i}"></label>
      <div><div class="slot-label">${esc(i ? t("secondColor") : t("color"))}</div><div class="hex" data-hex="${i}">${fx.colors[i]}</div></div>
    </div>`;

  const syncRight = zones.length > 1
    ? `<label class="row" style="gap:10px;margin:0"><span>${esc(t("syncZones"))}</span><span class="switch"><input type="checkbox" data-act="sync" ${s.lighting.sync ? "checked" : ""}><span></span></span></label>`
    : "";

  return `<div class="grid">
    <div class="card span-8">${head(1, t("lighting"), syncRight)}<div class="card-body">
      ${zones.length > 1 && !s.lighting.sync ? `<div class="zone-tabs">${zones.map((z) => `<button class="${z.name === state.zone ? "on" : ""}" data-act="zone" data-zone="${z.name}">${esc(t("zone_" + z.name))}</button>`).join("")}</div>` : ""}
      <div class="effects">${dev.caps.effects.map((e) => `<button class="fx ${fx.effect === e ? "on" : ""}" data-act="fx" data-fx="${e}" style="--c1:${fx.colors[0]}">
        <span class="sw"></span><span class="name">${esc(t("fx_" + e))}</span></button>`).join("")}</div>
      ${nColors ? `<div class="field-label">${esc(t("color"))}</div>
        <div class="swatches">${PALETTE.map((c) => `<button class="swatch ${fx.colors[0] === c ? "on" : ""}" style="--c:${c}" data-act="swatch" data-c="${c}"></button>`).join("")}</div>
        <div class="row" style="gap:28px;flex-wrap:wrap;margin-top:18px">${colorSlot(0)}${nColors > 1 ? colorSlot(1) : ""}
          ${fx.effect === "breathing" ? `<label class="row" style="gap:10px;margin:0"><span class="hint">${esc(t("secondColor"))}</span>
            <span class="switch"><input type="checkbox" data-act="two" ${fx.two ? "checked" : ""}><span></span></span></label>` : ""}
        </div>` : ""}
      ${FX_SPEED.has(fx.effect) ? `<div class="field-label">${esc(t("speed"))}</div><div class="row">
        <span class="hint-mono">${esc(t("slow"))}</span><input type="range" min="1" max="4" step="1" value="${5 - fx.speed}" data-speed><span class="hint-mono">${esc(t("fast"))}</span></div>` : ""}
      ${fx.effect === "wave" ? `<div class="field-label">${esc(t("direction"))}</div>
        <div class="seg small">${[[1, t("left")], [2, t("right")]].map(([v, l]) => `<button class="${fx.direction === v ? "on" : ""}" data-act="dir" data-v="${v}">${esc(l)}</button>`).join("")}</div>` : ""}
    </div></div>
    <div class="card span-4">${head(2, t("brightness"), `<span id="bright-val">${s.lighting.brightness}%</span>`)}<div class="card-body">
      <div class="dpi-big"><span class="num" id="bright-big">${s.lighting.brightness}</span><span class="unit">%</span></div>
      ${dev.caps.brightness ? `<div class="row"><input type="range" min="0" max="100" step="1" value="${s.lighting.brightness}" data-bright></div>` : ""}
    </div></div>
  </div>`;
}

function dongleCard(dev, s, n) {
  if (!dev.caps.dongle_led) return "";
  return `<div class="card">${head(n, t("dongleLed"))}<div class="card-body">
    <p class="hint" style="margin:0 0 18px">${esc(t("dongleLedHint"))}</p>
    <div class="seg small">${[[1, "ledConn"], [2, "ledBatt"], [3, "ledLow"]].map(([v, k]) => `<button class="${s.dongle.led === v ? "on" : ""}" data-act="dongle-led" data-v="${v}">${esc(t(k))}</button>`).join("")}</div>
  </div></div>`;
}

function powerTab(dev, s) {
  if (!dev.caps.idle && !dev.caps.battery) return `<div class="grid"><div class="card"><div class="card-body"><p class="muted">${esc(t("noPower"))}</p></div></div></div>`;
  const mins = Math.round(s.power.idle / 60);
  return `<div class="grid">
    <div class="card span-6">${head(1, t("sleep"), `<span id="idle-val">${mins} ${esc(t("min"))}</span>`)}<div class="card-body">
      <p class="hint" style="margin:0 0 18px">${esc(t("sleepHint"))}</p>
      <div class="row"><input type="range" min="1" max="15" step="1" value="${mins}" data-idle></div>
    </div></div>
    <div class="card span-6">${head(2, t("lowBattery"), `<span id="low-val">${s.power.lowBattery}%</span>`)}<div class="card-body">
      <p class="hint" style="margin:0 0 18px">${esc(t("lowBatteryHint"))}</p>
      <div class="row"><input type="range" min="5" max="100" step="1" value="${s.power.lowBattery}" data-low></div>
    </div></div>
    ${dongleCard(dev, s, 3)}
  </div>`;
}

function buttonsTab(dev, s) {
  const names = { 3: "btnMiddle", 4: "btnBack", 5: "btnForward" };
  return `<div class="grid">
    <div class="card span-8">${head(1, t("remap"), esc(t("remapLayer")))}<div class="card-body">
      ${REMAPPABLE.map((b) => `<div class="setting" style="padding-left:0;padding-right:0">
        <div><div class="t">${esc(t(names[b]))}</div>${s.buttons[b] === b ? `<div class="d">${esc(t("btnDefault"))}</div>` : ""}</div>
        <select class="select" data-act="button" data-b="${b}">${MOUSE_FUNCS.map((f) => `<option value="${f}" ${s.buttons[b] === f ? "selected" : ""}>${esc(t("fn" + f))}</option>`).join("")}</select>
      </div>`).join("")}
    </div></div>
    <div class="card span-4">${head(2, t("remapNote"))}<div class="card-body">
      <p class="hint" style="margin:0">${esc(t("remapNoteText"))}</p>
    </div></div>
  </div>`;
}

function calibTab(dev, s) {
  return `<div class="grid">
    <div class="card span-7">${head(1, t("liftoff"), esc(t(["liftLow", "liftMid", "liftHigh"][s.calib.liftoff])))}<div class="card-body">
      <p class="hint" style="margin:0 0 18px">${esc(t("liftoffHint"))}</p>
      <div class="seg">${[[0, "liftLow"], [1, "liftMid"], [2, "liftHigh"]].map(([v, k]) => `<button class="${s.calib.liftoff === v ? "on" : ""}" data-act="liftoff" data-v="${v}">${esc(t(k))}</button>`).join("")}</div>
    </div></div>
    <div class="card span-5">${head(2, t("resetTitle"))}<div class="card-body">
      <p class="hint" style="margin:0">${esc(t("resetHint"))}</p>
    </div></div>
    ${dev.caps.dynamic_sensitivity ? `<div class="card">${head(3, t("dynSens"))}<div class="card-body">
      <div class="row" style="justify-content:space-between"><span class="hint">${esc(t("dynSensHint"))}</span>
      <label class="switch"><input type="checkbox" data-act="dynsens" ${s.calib.dynamic ? "checked" : ""}><span></span></label></div>
      ${s.calib.dynamic ? `<div class="field-label">${esc(t("curve"))}</div>
        <div class="seg small">${[0, 1, 2, 3].map((c) => `<button class="${s.calib.curve === c ? "on" : ""}" data-act="curve" data-v="${c}">${esc(t("curve" + c))}</button>`).join("")}</div>
        ${s.calib.curve === 3 ? `<div class="field-label">${esc(t("curveMax"))} <span id="curve-max">${s.calib.customMax.toFixed(2)}×</span></div>
          <div class="row"><input type="range" min="1" max="2.5" step="0.05" value="${s.calib.customMax}" data-curve-max></div>` : ""}` : ""}
    </div></div>` : ""}
  </div>`;
}

function paintPreview(dev) {
  const s = presetFor(dev).settings;
  document.querySelectorAll(".stage .zone").forEach((el) => {
    const fx = zoneFx(s, el.dataset.zone === "all" && dev.caps.zones[0] ? dev.caps.zones[0].name : el.dataset.zone);
    el.dataset.fx = fx.effect;
    el.dataset.dir = fx.direction;
    el.toggleAttribute("data-two", fx.effect === "breathing" && fx.two);
    el.style.setProperty("--c1", fx.colors[0]);
    el.style.setProperty("--c2", fx.colors[1]);
    el.style.setProperty("--dur", (1.2 + fx.speed * 0.9).toFixed(2) + "s");
    el.style.setProperty("--bright", Math.max(0.08, s.lighting.brightness / 100));
  });
}

function presetCard(p, i) {
  const s = p.settings;
  const fx = s.lighting.zones.all;
  const bound = state.devices.filter((d) => state.lib.bindings[d.key] === p.id);
  const swatch = ["spectrum", "wave"].includes(fx.effect) ? "spectrum" : "";
  const date = new Date(p.updated).toLocaleDateString(state.lib.settings.lang === "en" ? "en-GB" : "ru-RU");
  return `<article class="preset">
    <div class="preset-num"><span>${pad2(i + 1)} / ${esc(t("kind_" + p.kind))}</span><span>${date}</span></div>
    <div class="preset-top">
      <span class="preset-swatch ${swatch}" style="--c1:${fx.effect === "off" ? "#2a2c31" : fx.colors[0]}"></span>
      <div style="min-width:0"><div class="preset-name">${esc(p.name)}</div>
      <div class="preset-meta">${esc(t("fx_" + fx.effect))}${p.kind === "mouse" ? ` · ${s.polling} ${esc(t("hz"))}` : ""}</div></div>
    </div>
    <div class="preset-specs">
      ${p.kind === "mouse" ? `<span class="spec">${s.dpi.stages.map((x) => x.x).join(" · ")} DPI</span>` : ""}
      ${bound.map((d) => `<span class="badge">${esc(d.name)}</span>`).join("")}
    </div>
    <div class="preset-actions">
      <button class="btn primary" data-act="apply" data-id="${p.id}">${I.apply}${esc(t("apply"))}</button>
      <button class="btn ghost icon" data-act="copy-code" data-id="${p.id}" title="${esc(t("copyCode"))}">${I.copy}</button>
      <button class="btn ghost icon" data-act="export" data-id="${p.id}" title="${esc(t("exportFile"))}">${I.download}</button>
      <button class="btn ghost icon" data-act="rename" data-id="${p.id}" title="${esc(t("rename"))}">${I.edit}</button>
      <button class="btn ghost icon" data-act="dup" data-id="${p.id}" title="${esc(t("duplicate"))}">${I.dup}</button>
      <button class="btn ghost icon danger" data-act="del" data-id="${p.id}" title="${esc(t("delete"))}">${I.trash}</button>
    </div>
  </article>`;
}

function libraryView() {
  const ps = [...state.lib.presets].sort((a, b) => b.updated - a.updated);
  return `<div class="page">${ruler()}
    <div class="page-head">
      <div><span class="eyebrow">${pad2(ps.length)} / ${esc(t("library"))}</span>
        <h1>${esc(t("libraryTitleA"))} <span class="it">${esc(t("libraryTitleB"))}</span></h1><p>${esc(t("libraryText"))}</p></div>
      <div class="actions">
        <button class="btn" data-act="import">${I.upload}${esc(t("import"))}</button>
        <button class="btn primary" data-act="paste">${I.copy}${esc(t("importCode"))}</button>
      </div>
    </div>
    ${ps.length ? `<div class="presets">${ps.map(presetCard).join("")}</div>` : `<div class="grid"><div class="card"><div class="card-body"><p class="muted">${esc(t("noPresets"))}</p></div></div></div>`}
  </div>`;
}

function settingsView() {
  const st = state.lib.settings;
  return `<div class="page">${ruler()}
    <div class="page-head"><div><span class="eyebrow">03 / Open Synapse</span><h1>${esc(t("settings"))}</h1></div></div>
    ${head(1, t("theme"), esc(t("theme_" + st.theme)))}
    <div class="themes">${Object.entries(THEMES).map(([k, c]) => `<button class="theme-card ${st.theme === k ? "on" : ""}" data-act="theme" data-v="${k}">
      <span class="theme-prev" style="--p1:${c[0]};--p2:${c[1]};--p3:${c[2]};--p4:${c[3]}"><i class="p-side"></i><i class="p-main"></i></span>
      <span class="theme-name">${esc(t("theme_" + k))}</span></button>`).join("")}</div>
    <div class="grid" style="border-top:1px solid var(--line)">
      <div class="card">${head(2, t("general"))}
        <div class="setting"><div class="t">${esc(t("language"))}</div>
          <div class="seg small" style="width:240px">${[["ru", "Русский"], ["en", "English"]].map(([v, l]) => `<button class="${st.lang === v ? "on" : ""}" data-act="lang" data-v="${v}">${l}</button>`).join("")}</div></div>
        <div class="setting"><div><div class="t">${esc(t("autoApply"))}</div><div class="d">${esc(t("autoApplyHint"))}</div></div>
          <label class="switch"><input type="checkbox" data-act="autoapply" ${st.autoApply ? "checked" : ""}><span></span></label></div>
        <div class="setting"><div><div class="t">${esc(t("demoMode"))}</div><div class="d">${esc(t("demoModeHint"))}</div></div>
          <label class="switch"><input type="checkbox" data-act="demo" ${st.demo ? "checked" : ""}><span></span></label></div>
      </div>
      <div class="card">${head(3, t("about"), "v0.1.0 · MIT")}
        <div class="about"><img src="logo.svg" alt=""><div><b>Open Synapse</b><p class="muted" style="margin:6px 0 0">${esc(t("aboutText"))}</p>
        <p class="hint" style="margin:6px 0 0">${esc(t("dataFolder"))}</p></div></div>
      </div>
    </div>
  </div>`;
}

function applyTheme() {
  document.documentElement.dataset.theme = THEMES[state.lib.settings.theme] ? state.lib.settings.theme : "mono";
}

// ------------------------------------------------------------------ device photos

function loadPhoto(file, dev) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      state.lib.photos[dev.key] = c.toDataURL("image/webp", 0.86);
      saveLib();
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ------------------------------------------------------------------ actions

async function applyPresetTo(p, dev) {
  state.lib.bindings[dev.key] = p.id;
  saveLib();
  applyAll(dev, p);
  toast(t("applied", { name: p.name, device: dev.name }));
}

async function chooseDevice() {
  const ds = state.devices.filter((d) => d.online);
  if (ds.length <= 1) return ds[0] || null;
  return modal({
    title: t("applyTo"),
    body: `<div style="display:flex;flex-direction:column;gap:6px">${ds.map((d, i) => `<button class="dev-item" data-pick="${i}"><span class="dev-icon">${icons[d.kind]}</span><span class="dev-name">${esc(d.name)}</span></button>`).join("")}</div>`,
    actions: [{ label: t("cancel"), kind: "ghost" }],
  }).then((i) => (i == null ? null : ds[i]));
}

async function exportPreset(p) {
  const contents = JSON.stringify(payload(p), null, 2);
  const name = p.name.replace(/[\\/:*?"<>|]+/g, "_") + ".osp";
  if (tauri) {
    try {
      if (await invoke("export_file", { name, contents })) toast(t("exported"));
    } catch (e) {
      toast(String(e), "error");
    }
  } else {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([contents], { type: "application/json" })), download: name });
    a.click();
  }
}

function addImported(texts) {
  let n = 0;
  for (const text of texts) {
    try {
      state.lib.presets.push(decodeAny(text));
      n++;
    } catch {
      /* counted below */
    }
  }
  saveLib();
  if (n) toast(t("imported", { n }));
  if (n < texts.length) toast(t("badCode"), "error");
  rerender();
}

async function onClick(e) {
  if (e.target.closest("[data-pick]")) return;
  const item = e.target.closest(".dev-item[data-key]");
  if (item) {
    state.view = { type: "device", key: item.dataset.key };
    state.zone = null;
    return render();
  }
  const nav = e.target.closest(".nav-btn");
  if (nav) {
    state.view = { type: nav.dataset.view };
    return render();
  }
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.dataset.tab;
    return rerender();
  }

  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT" || el.type === "checkbox") return;
  const act = el.dataset.act;
  const dev = currentDevice();
  const p = dev && state.view.type === "device" ? presetFor(dev) : null;
  const s = p?.settings;
  const byId = (id) => state.lib.presets.find((x) => x.id === id);

  switch (act) {
    case "demo-on":
      state.lib.settings.demo = true;
      saveLib();
      return poll();
    case "stage":
      s.dpi.active = +el.dataset.i;
      touch(p); applyDpi(dev, s);
      return rerender();
    case "stage-del":
      e.stopPropagation();
      s.dpi.stages.splice(+el.dataset.i, 1);
      s.dpi.active = clamp(s.dpi.active, 0, s.dpi.stages.length - 1);
      touch(p); applyDpi(dev, s);
      return rerender();
    case "stage-add": {
      const last = s.dpi.stages.at(-1);
      const v = clamp(Math.round((last.x * 2) / 50) * 50, 100, dev.caps.max_dpi || 26000);
      s.dpi.stages.push({ x: v, y: v });
      s.dpi.active = s.dpi.stages.length - 1;
      touch(p); applyDpi(dev, s);
      return rerender();
    }
    case "poll":
      s.polling = +el.dataset.hz;
      touch(p); applyPolling(dev, s);
      return rerender();
    case "fx":
      editableFx(s).effect = el.dataset.fx;
      touch(p); applyLighting(dev, s);
      return rerender();
    case "swatch":
      editableFx(s).colors[0] = el.dataset.c;
      touch(p); applyLighting(dev, s);
      return rerender();
    case "zone":
      state.zone = el.dataset.zone;
      return rerender();
    case "dongle-led":
      s.dongle.led = +el.dataset.v;
      touch(p); applyCalib(dev, s);
      return rerender();
    case "curve":
      s.calib.curve = +el.dataset.v;
      touch(p); applyCalib(dev, s);
      return rerender();
    case "liftoff":
      s.calib.liftoff = +el.dataset.v;
      touch(p); applyCalib(dev, s);
      return rerender();
    case "dir":
      editableFx(s).direction = +el.dataset.v;
      touch(p); applyLighting(dev, s);
      return rerender();
    case "save-as": {
      const name = await askText(t("saveAs"), p.name + " 2", t("presetName"));
      if (!name) return;
      const np = { ...structuredClone(p), id: uid(), name, created: Date.now(), updated: Date.now() };
      state.lib.presets.push(np);
      state.lib.bindings[dev.key] = np.id;
      saveLib();
      return rerender();
    }
    case "copy-code":
      await navigator.clipboard.writeText(encodeCode(byId(el.dataset.id)));
      return toast(t("codeCopied"));
    case "export":
      return exportPreset(byId(el.dataset.id));
    case "apply": {
      const target = await chooseDevice();
      if (target) await applyPresetTo(byId(el.dataset.id), target);
      return rerender();
    }
    case "rename": {
      const x = byId(el.dataset.id);
      const name = await askText(t("rename"), x.name, t("presetName"));
      if (name) { x.name = name; touch(x); rerender(); }
      return;
    }
    case "dup": {
      const x = byId(el.dataset.id);
      state.lib.presets.push({ ...structuredClone(x), id: uid(), name: x.name + " (2)", created: Date.now(), updated: Date.now() });
      saveLib();
      return rerender();
    }
    case "del": {
      const x = byId(el.dataset.id);
      if (!(await confirmBox(t("delete"), t("deleteConfirm", { name: x.name })))) return;
      state.lib.presets = state.lib.presets.filter((y) => y.id !== x.id);
      for (const [k, v] of Object.entries(state.lib.bindings)) if (v === x.id) delete state.lib.bindings[k];
      saveLib();
      return rerender();
    }
    case "import":
      if (tauri) {
        try {
          const texts = await invoke("import_files");
          if (texts.length) addImported(texts);
        } catch (err) {
          toast(String(err), "error");
        }
      }
      return;
    case "paste": {
      const text = await modal({
        title: t("importCode"),
        body: `<textarea class="text-input" placeholder="OSP1.…"></textarea>`,
        actions: [{ label: t("cancel"), kind: "ghost" }, { label: t("import"), kind: "primary", value: (r) => $("textarea", r).value }],
      });
      if (text) addImported([text]);
      return;
    }
    case "lang":
      state.lib.settings.lang = el.dataset.v;
      setLang(el.dataset.v);
      saveLib();
      return render();
    case "theme":
      state.lib.settings.theme = el.dataset.v;
      applyTheme();
      saveLib();
      return rerender();
    case "photo":
      return $("[data-photo-input]")?.click();
    case "photo-reset":
      delete state.lib.photos[dev.key];
      saveLib();
      return render();
  }
}

function onInput(e) {
  const el = e.target;
  const dev = currentDevice();
  if (el.type === "range") setFill(el);
  if (!dev || state.view.type !== "device") return;
  const p = presetFor(dev);
  const s = p.settings;
  const max = dev.caps.max_dpi || 26000;

  if (el.dataset.dpi || el.dataset.dpiNum) {
    const axis = el.dataset.dpi || el.dataset.dpiNum;
    const v = clamp(Math.round(+el.value || 100), 100, max);
    const st = s.dpi.stages[s.dpi.active];
    st[axis] = v;
    if (!s.dpi.split) st.y = st.x;
    if (el.dataset.dpi) {
      const n = $(`[data-dpi-num="${axis}"]`);
      if (n) n.value = v;
    } else {
      const r = $(`[data-dpi="${axis}"]`);
      if (r && e.type === "change") { r.value = v; setFill(r); }
    }
    $("#dpi-num").textContent = st.x;
    $(`[data-stage-val="${s.dpi.active}"]`).textContent = s.dpi.split ? `${st.x} / ${st.y}` : st.x;
    touch(p); applyDpi(dev, s);
  } else if (el.dataset.color) {
    const fx = editableFx(s);
    fx.colors[+el.dataset.color] = el.value;
    el.parentElement.style.background = el.value;
    $(`[data-hex="${el.dataset.color}"]`).textContent = el.value;
    document.querySelectorAll(".fx").forEach((b) => b.style.setProperty("--c1", fx.colors[0]));
    paintPreview(dev);
    touch(p); applyLighting(dev, s);
  } else if (el.dataset.speed != null) {
    editableFx(s).speed = 5 - +el.value;
    paintPreview(dev);
    touch(p); applyLighting(dev, s);
  } else if (el.dataset.curveMax != null) {
    s.calib.customMax = +el.value;
    $("#curve-max").textContent = (+el.value).toFixed(2) + "×";
    touch(p); applyCalib(dev, s);
  } else if (el.dataset.bright != null) {
    s.lighting.brightness = +el.value;
    $("#bright-val").textContent = el.value + "%";
    $("#bright-big").textContent = el.value;
    paintPreview(dev);
    touch(p); applyLighting(dev, s);
  } else if (el.dataset.idle != null) {
    s.power.idle = +el.value * 60;
    $("#idle-val").textContent = `${el.value} ${t("min")}`;
    touch(p); applyPower(dev, s);
  } else if (el.dataset.low != null) {
    s.power.lowBattery = +el.value;
    $("#low-val").textContent = el.value + "%";
    touch(p); applyPower(dev, s);
  }
}

function onChange(e) {
  const el = e.target;
  const act = el.dataset.act;
  const st = state.lib.settings;
  const dev = currentDevice();
  if (act === "bind" && dev) {
    const p = state.lib.presets.find((x) => x.id === el.value);
    if (p) applyPresetTo(p, dev).then(rerender);
  } else if (act === "split" && dev) {
    const p = presetFor(dev);
    p.settings.dpi.split = el.checked;
    if (!el.checked) p.settings.dpi.stages.forEach((x) => (x.y = x.x));
    touch(p); applyDpi(dev, p.settings);
    rerender();
  } else if (act === "sync" && dev) {
    const p = presetFor(dev);
    p.settings.lighting.sync = el.checked;
    touch(p); applyLighting(dev, p.settings);
    rerender();
  } else if (act === "two" && dev) {
    const p = presetFor(dev);
    editableFx(p.settings).two = el.checked;
    touch(p); applyLighting(dev, p.settings);
    rerender();
  } else if (act === "dynsens" && dev) {
    const p = presetFor(dev);
    p.settings.calib.dynamic = el.checked;
    touch(p); applyCalib(dev, p.settings);
    rerender();
  } else if (act === "button" && dev) {
    const p = presetFor(dev);
    p.settings.buttons[+el.dataset.b] = +el.value;
    touch(p); applyButtons(dev, p.settings);
    rerender();
  } else if (act === "autoapply") {
    st.autoApply = el.checked;
    saveLib();
  } else if (act === "demo") {
    st.demo = el.checked;
    saveLib();
    poll();
  } else if (el.matches("[data-photo-input]") && dev) {
    loadPhoto(el.files[0], dev);
  } else if (el.dataset.dpiNum) {
    onInput(e);
  }
}

// ------------------------------------------------------------------ boot

async function boot() {
  await loadLib();
  setLang(state.lib.settings.lang);
  applyTheme();

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("contextmenu", (e) => { if (!e.target.closest("input, textarea")) e.preventDefault(); });

  if (tauri) {
    const win = tauri.window.getCurrentWindow();
    $("#wc-min").onclick = () => win.minimize();
    $("#wc-max").onclick = () => win.toggleMaximize();
    $("#wc-close").onclick = () => win.close();
  }

  const stageOf = (e) => e.target.closest?.("[data-drop]");
  document.addEventListener("dragover", (e) => { const s = stageOf(e); if (s) { e.preventDefault(); s.classList.add("drag"); } });
  document.addEventListener("dragleave", (e) => stageOf(e)?.classList.remove("drag"));
  document.addEventListener("drop", (e) => {
    if (!stageOf(e)) return;
    e.preventDefault();
    if (currentDevice()) loadPhoto(e.dataTransfer.files[0], currentDevice());
  });

  render();
  await poll();
  setInterval(poll, 2500);
  setInterval(refreshBatteries, 60000);
}

boot();
