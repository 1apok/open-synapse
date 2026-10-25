// Renders src/logo.svg to a 1024px PNG that `tauri icon` turns into every platform icon.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../src/logo.svg", import.meta.url), "utf8");
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });
writeFileSync(new URL("../assets/icon-1024.png", import.meta.url), png);
console.log("assets/icon-1024.png written");
