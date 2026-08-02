#!/usr/bin/env node
/**
 * Second light-theme pass: dark BACKGROUND surfaces the first codemod's fill-map
 * missed (it only knew 4 specific navy hexes). This finds every hex assigned to
 * background/backgroundColor whose luminance is dark, and maps it to a light
 * equivalent — preserving hue, so a dark-green success panel becomes a pale-green
 * one rather than flat white, keeping the semantic colour.
 *
 * Named-constant declarations (CR_BG, CR_SURFACE, DARK) are remapped too.
 */
import fs from "node:fs";

function hexToRgb(h) {
  const c = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
  }
  return "#" + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function lum(h) {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  const f = (x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Dark surface hex → light surface, hue-preserved. */
function toLight(h) {
  const [r, g, b] = hexToRgb(h);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const [hh, s] = rgbToHsl(r, g, b);
  // Near-black hue is unreliable, so judge neutrality by absolute channel
  // spread, not HSL saturation. Neutral darks map by depth so the page bg and
  // the card surface stay visually distinct (hierarchy the dark theme had).
  if (spread < 14 || s < 0.12) {
    return lum(h) < 0.005 ? "#F5F7FA" : "#FFFFFF";
  }
  // hued alert/status surface → very light tint of the same hue
  return hslToHex(hh, 0.30, 0.955);
}

const DARK_BG = 0.06;

export function convert(src) {
  let n = 0;
  // 1. constant declarations that hold a dark hex
  src = src.replace(/^(\s*const\s+[A-Z_][A-Z0-9_]*\s*=\s*)"(#[0-9A-Fa-f]{6})"(.*)$/gm, (full, pre, hex, post) => {
    if (lum(hex) < DARK_BG && /BG|SURFACE|DARK|SHELL|CARD|MID/i.test(pre)) { n++; return `${pre}"${toLight(hex)}"${post}`; }
    return full;
  });
  // 2. inline background(Color): "#dark"
  src = src.replace(/((?:backgroundColor|background)\s*:\s*)"(#[0-9A-Fa-f]{6})"/g, (full, pre, hex) => {
    if (lum(hex) < DARK_BG) { n++; return `${pre}"${toLight(hex)}"`; }
    return full;
  });
  return { src, n };
}

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
let total = 0;
for (const f of files) {
  const { src, n } = convert(fs.readFileSync(f, "utf8"));
  if (n && !dry) fs.writeFileSync(f, src);
  if (n) console.log(`${dry ? "[dry] " : ""}${f}: ${n}`);
  total += n;
}
console.log("TOTAL", total);
