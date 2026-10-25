// Device illustrations. Every lit element sits in a `.zone[data-zone]` group so the
// lighting preview can drive each zone separately.

export const icons = {
  mouse: '<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 6.5v3"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
  keypad: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="13" height="15" rx="3"/><path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01M17 14l3 2-2 4"/></svg>',
  mousepad: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M6 15h4"/></svg>',
  headset: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="2"/><rect x="17" y="14" width="4" height="7" rx="2"/></svg>',
  dock: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="8" ry="4"/><path d="M4 10v4c0 2.2 3.6 4 8 4s8-1.8 8-4v-4"/></svg>',
  other: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3"/></svg>',
};

const defs = `
<defs>
  <filter id="bloom" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <radialGradient id="shade" cx="0.35" cy="0.25" r="0.9">
    <stop offset="0" stop-color="#fff" stop-opacity="0.08"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
  </radialGradient>
  <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
</defs>`;

const wrap = (inner) =>
  `<svg class="art" viewBox="0 0 300 225" xmlns="http://www.w3.org/2000/svg">${defs}${inner}</svg>`;

function rnd(i) {
  // deterministic pseudo random so the preview does not jump between renders
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)).toFixed(3);
}

function mouse(zones) {
  const has = (z) => zones.includes(z);
  const body = "M150 14 C204 14 222 66 222 118 C222 176 194 211 150 211 C106 211 78 176 78 118 C78 66 96 14 150 14 Z";
  return wrap(`
    <ellipse cx="150" cy="214" rx="86" ry="10" fill="url(#floor)"/>
    ${has("all") ? `<g class="zone" data-zone="all"><path d="${body}" class="led-stroke glow" stroke-width="4" transform="translate(150 113) scale(1.04) translate(-150 -113)"/></g>` : ""}
    <path class="body" d="${body}"/>
    <path d="M150 18 V96 M88 92 C110 99 190 99 212 92" stroke="rgba(0,0,0,0.55)" stroke-width="2" fill="none"/>
    <path d="M150 18 V96" stroke="rgba(255,255,255,0.05)" stroke-width="1" fill="none" transform="translate(1 0)"/>
    <rect x="76" y="70" width="6" height="22" rx="3" class="body-2"/>
    <rect x="76" y="98" width="6" height="22" rx="3" class="body-2"/>
    <rect x="143" y="38" width="14" height="34" rx="7" fill="#0c0f13"/>
    ${has("scroll")
      ? `<g class="zone" data-zone="scroll"><rect x="145.5" y="41" width="9" height="28" rx="4.5" class="led glow" style="--i:0;--r:${rnd(1)}"/></g>`
      : `<rect x="145.5" y="41" width="9" height="28" rx="4.5" class="unlit"/>`}
    <rect x="146" y="80" width="8" height="8" rx="2" class="body-2"/>
    ${has("logo")
      ? `<g class="zone" data-zone="logo"><g class="led glow" style="--i:2;--r:${rnd(2)}">${logoGlyph(150, 160, 1)}</g></g>`
      : `<g class="unlit">${logoGlyph(150, 160, 1)}</g>`}
    <path class="shade" d="${body}"/>
  `);
}

function logoGlyph(cx, cy, s) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M9 -12 C4 -15 -8 -14 -8 -7 C-8 -1 8 -2 8 5 C8 12 -4 14 -9 10" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" class="logo-path"/>
    <circle cx="9" cy="-12" r="4"/><circle cx="-9" cy="10" r="4"/>
  </g>`;
}

function keyboard(zones, compact = false) {
  const cols = compact ? 15 : 18;
  const rows = compact ? 5 : 6;
  const x0 = compact ? 42 : 14, w = compact ? 216 : 272, y0 = 62, h = compact ? 88 : 104;
  const pad = 8, gap = 3;
  const kw = (w - pad * 2 - gap * (cols - 1)) / cols;
  const kh = (h - pad * 2 - gap * (rows - 1)) / rows;
  let keys = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c > 3 && c < (compact ? 10 : 11)) {
        if (c === 4) {
          const sw = kw * ((compact ? 10 : 11) - 4) + gap * ((compact ? 10 : 11) - 5);
          keys += `<rect x="${x0 + pad + c * (kw + gap)}" y="${y0 + pad + r * (kh + gap)}" width="${sw}" height="${kh}" rx="2" style="--i:${c + 3};--r:${rnd(r * 40 + c)}"/>`;
        }
        continue;
      }
      keys += `<rect x="${(x0 + pad + c * (kw + gap)).toFixed(1)}" y="${(y0 + pad + r * (kh + gap)).toFixed(1)}" width="${kw.toFixed(1)}" height="${kh.toFixed(1)}" rx="2" style="--i:${c};--r:${rnd(r * 40 + c)}"/>`;
    }
  }
  const lit = zones.length > 0;
  return wrap(`
    <ellipse cx="150" cy="${y0 + h + 14}" rx="${w / 2 + 6}" ry="12" fill="url(#floor)"/>
    <rect class="body" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="10"/>
    ${lit ? `<g class="zone" data-zone="${zones[0] === "backlight" ? "backlight" : "all"}"><g class="keys leds glow">${keys}</g></g>`
          : `<g class="unlit">${keys}</g>`}
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="10" fill="url(#shade)" opacity="0.6" pointer-events="none"/>
  `);
}

function keypad(zones) {
  let keys = "";
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++)
      keys += `<rect x="${92 + c * 22}" y="${52 + r * 22 + c * 2}" width="18" height="18" rx="3" style="--i:${c};--r:${rnd(r * 9 + c)}"/>`;
  return wrap(`
    <ellipse cx="150" cy="204" rx="80" ry="10" fill="url(#floor)"/>
    <path class="body" d="M82 44 H208 C216 44 220 50 220 58 V150 C220 186 190 200 160 200 H110 C92 200 80 188 80 170 V58 C80 50 76 44 82 44 Z"/>
    <circle cx="200" cy="170" r="16" class="body-2"/>
    ${zones.length ? `<g class="zone" data-zone="${zones[0]}"><g class="keys leds glow">${keys}</g></g>` : `<g class="unlit">${keys}</g>`}
  `);
}

function mousepad(zones) {
  const lit = zones.length > 0;
  return wrap(`
    <ellipse cx="150" cy="190" rx="132" ry="12" fill="url(#floor)"/>
    ${lit ? `<g class="zone" data-zone="all"><rect x="22" y="44" width="256" height="140" rx="16" class="led-stroke glow" stroke-width="4" style="--i:0"/></g>` : ""}
    <rect class="body" x="26" y="48" width="248" height="132" rx="13"/>
    <path d="M40 60 H260" stroke="rgba(255,255,255,0.03)" stroke-width="80" opacity="0.4"/>
    <g class="unlit">${logoGlyph(250, 160, 0.7)}</g>
  `);
}

function dock(zones) {
  const lit = zones.length > 0;
  return wrap(`
    <ellipse cx="150" cy="186" rx="104" ry="14" fill="url(#floor)"/>
    <path class="body" d="M58 112 C58 92 100 78 150 78 C200 78 242 92 242 112 V140 C242 160 200 174 150 174 C100 174 58 160 58 140 Z"/>
    <ellipse cx="150" cy="112" rx="92" ry="32" class="body-2"/>
    ${lit ? `<g class="zone" data-zone="all"><path d="M58 140 C58 160 100 174 150 174 C200 174 242 160 242 140" class="led-stroke glow" stroke-width="4" style="--i:0"/></g>` : ""}
    <ellipse cx="150" cy="110" rx="70" ry="22" fill="#0d1014"/>
  `);
}

function headset() {
  return wrap(`
    <ellipse cx="150" cy="206" rx="96" ry="10" fill="url(#floor)"/>
    <path d="M78 140 V112 C78 66 112 34 150 34 C188 34 222 66 222 112 V140" fill="none" stroke="#1a1f26" stroke-width="14" stroke-linecap="round"/>
    <rect class="body" x="58" y="118" width="46" height="78" rx="22"/>
    <rect class="body" x="196" y="118" width="46" height="78" rx="22"/>
    <g class="unlit">${logoGlyph(81, 157, 0.65)}${logoGlyph(219, 157, 0.65)}</g>
  `);
}

export function deviceArt(device) {
  const zones = device.caps.zones.map((z) => z.name);
  switch (device.kind) {
    case "mouse": return mouse(zones);
    case "keyboard": return keyboard(zones, /mini|60|65/i.test(device.name));
    case "keypad": return keypad(zones);
    case "mousepad": return mousepad(zones);
    case "dock": return dock(zones);
    case "headset": return headset();
    default: return mouse(zones);
  }
}
