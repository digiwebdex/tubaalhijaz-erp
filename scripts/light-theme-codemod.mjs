#!/usr/bin/env node
/**
 * Dark → light theme codemod.
 *
 * The dark theme is hardcoded inline (2,139 `rgba(255,255,255,α)` values across
 * 29 files) with no token layer, so this converts by ROLE rather than by value:
 * the same alpha (0.06 is the worst offender) is used as a surface fill in one
 * place and a hairline border in another, and mapping both to one light value
 * would either wash out every border or muddy every card.
 *
 * Role is inferred from the CSS property the colour is assigned to.
 *
 * Contrast note: a light theme needs HIGHER alpha than its dark counterpart for
 * the same perceived contrast — dark-on-light reads stronger than light-on-dark
 * at equal alpha, so muted text at 0.3 on navy becomes ~0.55 on white, not 0.3.
 */
import fs from "node:fs";

const NAVY = "11,30,63"; // #0B1E3F — brand navy, the light theme's ink

// ── surfaces ────────────────────────────────────────────────────────────────
// On dark these were near-transparent white washes over navy. On light they
// become white cards over a soft neutral page, with faint navy tints for the
// raised/inset variants.
const SURFACE = (a) => {
  if (a <= 0.02) return "#FFFFFF";              // barely-there wash → plain card
  if (a <= 0.05) return "#FBFCFD";              // subtle raised
  if (a <= 0.08) return "#F5F7FA";              // panel / table header
  if (a <= 0.12) return "#EEF1F6";              // inset / hover
  return "#E4E9F0";                              // strongest wash
};

// ── borders ─────────────────────────────────────────────────────────────────
// Light-theme borders need real presence or the layout dissolves.
const BORDER = (a) => {
  if (a <= 0.05) return `rgba(${NAVY},0.08)`;
  if (a <= 0.08) return `rgba(${NAVY},0.11)`;
  if (a <= 0.15) return `rgba(${NAVY},0.15)`;
  return `rgba(${NAVY},0.22)`;
};

// ── text ────────────────────────────────────────────────────────────────────
// Mapped up the scale so hierarchy survives: hint < muted < secondary < body.
const TEXT = (a) => {
  if (a <= 0.2) return `rgba(${NAVY},0.38)`;    // faintest hints/placeholders
  if (a <= 0.3) return `rgba(${NAVY},0.50)`;    // muted labels
  if (a <= 0.4) return `rgba(${NAVY},0.58)`;    // secondary
  if (a <= 0.5) return `rgba(${NAVY},0.66)`;    // tertiary body
  if (a <= 0.65) return `rgba(${NAVY},0.76)`;   // body
  if (a <= 0.8) return `rgba(${NAVY},0.86)`;    // strong body
  return `rgba(${NAVY},0.94)`;                   // near-primary
};

// Opaque dark fills → light equivalents.
const FILL = {
  "#0B1E3F": "#FFFFFF",  // primary dark surface → card
  "#060F20": "#F5F7FA",  // deepest shell bg → page
  "#0A0A14": "#FFFFFF",  // popover/tooltip bg → card
  "#111827": "#F5F7FA",
};

const RE = /rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/g;

/** Which role does the colour at `idx` play, judged by the nearest preceding property? */
function roleAt(src, idx) {
  const back = src.slice(Math.max(0, idx - 120), idx);
  // JSX writes these as `prop: "rgba(...)"` or `prop: \`...${x}\``, and CSS
  // strings as `1px solid rgba(...)` — so the opening quote/backtick and any
  // shorthand prefix must be tolerated between the property and the value.
  const Q = `["'\`]?\\s*`;

  if (new RegExp(`boxShadow\\s*:\\s*${Q}[^"'\`]*$`, "i").test(back)) return "shadow";
  // border / borderTop / border-bottom / "1px solid " shorthand
  if (new RegExp(`border[A-Za-z-]*\\s*:\\s*${Q}[^"'\`]*$`, "i").test(back)) return "border";
  if (/\d+px\s+(?:solid|dashed|dotted)\s+$/i.test(back)) return "border";
  if (new RegExp(`(?:background|backgroundColor|background-color)\\s*:\\s*${Q}[^"'\`]*$`, "i").test(back)) return "surface";
  if (/(?:linear|radial)-gradient\([^)]*$/i.test(back)) return "surface";
  if (new RegExp(`(?:^|[^a-zA-Z])(?:color|fill|stroke|borderColor)\\s*:\\s*${Q}$`, "i").test(back)) return "text";
  return "text"; // default: the majority of loose uses are text/icon colours
}

export function convert(src) {
  const stats = { surface: 0, border: 0, text: 0, shadow: 0, fills: 0 };

  let out = src.replace(RE, (m, aStr, idx) => {
    const a = Number.parseFloat(aStr);
    const role = roleAt(src, idx);
    stats[role]++;
    if (role === "surface") return SURFACE(a);
    if (role === "border") return BORDER(a);
    if (role === "shadow") return `rgba(${NAVY},${Math.min(0.18, a).toFixed(2)})`;
    return TEXT(a);
  });

  for (const [dark, light] of Object.entries(FILL)) {
    const before = out.split(dark).length - 1;
    if (before) {
      out = out.split(dark).join(light);
      stats.fills += before;
    }
  }

  // Primary text was literal white on dark; on light it becomes brand navy.
  const whiteText = /(\bcolor\s*:\s*)"white"/g;
  out = out.replace(whiteText, `$1"#0B1E3F"`);
  out = out.replace(/text-white\b/g, "text-[#0B1E3F]");

  return { out, stats };
}

// CLI
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
let totals = { surface: 0, border: 0, text: 0, shadow: 0, fills: 0 };
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const { out, stats } = convert(src);
  if (!dry) fs.writeFileSync(f, out);
  for (const k of Object.keys(totals)) totals[k] += stats[k];
  const n = Object.values(stats).reduce((a, b) => a + b, 0);
  if (n) console.log(`${dry ? "[dry] " : ""}${f}: ${JSON.stringify(stats)}`);
}
console.log("TOTAL", JSON.stringify(totals));
