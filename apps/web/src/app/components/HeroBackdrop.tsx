// ─── TUBA AL HIJAZ · Public Marketing Hero Backdrop ──────────────────────────
// A fully self-contained, layered backdrop for the public homepage hero.
// No external assets, no CDN images, no remote fonts — everything below is a
// CSS gradient or SVG authored inline.
//
// LIGHT THEME. This was originally a night-sky composition; it has been
// re-art-directed as a daylight one so the navy hero copy (#0B1E3F headline,
// rgba(11,30,63,0.76) body) reads on it. The rule that governs every value in
// this file: nothing behind the copy may go mid-tone. Layers either brighten
// (warm light, haze, rays) or are held to a low navy alpha and then pulled back
// further by the left-weighted light scrim at the end of the stack.
//
// Depth stack (back → front):
//   1. Daylight field     — warm-white top-left → pale blue-grey, warm horizon
//   2. Horizon bloom      — soft gold warmth rising off the sanctuary
//   3. Light column       — bright halo the grand dome is read against
//   4. Light rays         — very soft warm god-rays from the upper right
//                           (replaces the old star field; they only lighten)
//   5. Geometric lattice  — 8-point Islamic star tessellation, radially masked
//   6. Rosette medallion  — slowly counter-rotating gold hairline focal anchor
//   7. Skyline            — ONE flattened silhouette: a blurred far plane seen
//                           through the arcade, the near plane opaque over it,
//                           the whole composite carrying a vertical navy-alpha
//                           ramp (light at the spires → deeper at the plinth)
//   8. Film grain         — feTurbulence overlay, keeps the big smooth field
//                           from banding on 8-bit panels
//   9. Readability scrim  — light wash, strong at the top-left, released toward
//                           the bottom and right so the skyline keeps presence
//
// Every animation is CSS-driven (no rAF, no JS ticking) and every animated
// element carries `.thj-anim`, which the reduced-motion media query at the
// bottom of the stylesheet switches off wholesale.

const GOLD = "#C8943A";       // brand accent, unchanged
const GOLD_DEEP = "#D9A84A";  // same hue, dropped in value so hairlines and
                              // gradient-clipped text survive a light ground
const NAVY = "#1C2444";       // brand ink — also the silhouette colour

/* ── Skyline coordinate system ────────────────────────────────────────────── */
// The band is authored at 1440×360 and always rendered at its full intrinsic
// aspect ratio (width-driven, never cropped vertically) — see `.thj-sky` below.
// preserveAspectRatio="slice" was deliberately avoided: it crops from the top
// on wide viewports and would decapitate the clock tower.
const VB_W = 1440;
const VB_H = 360;
const GROUND = 282;     // cornice the buildings stand on = top of the arcade
const ARCH_FLOOR = 344; // where the arch openings meet the plinth
const PLINTH = 360;     // bottom of the band

/* ── Geometry helpers ─────────────────────────────────────────────────────── */

/** n-pointed star polygon path. */
function starPath(n: number, R: number, r: number, cx: number, cy: number, phase = 0) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = phase + (Math.PI * i) / n;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Onion dome sitting on `base`, drawn as a symmetric pair of cubics. */
function domePath(cx: number, base: number, r: number) {
  const apex = base - r * 1.34;
  return [
    `M${cx - r},${base}`,
    `C${cx - r},${base - r * 1.18} ${cx - r * 0.46},${apex} ${cx},${apex}`,
    `C${cx + r * 0.46},${apex} ${cx + r},${base - r * 1.18} ${cx + r},${base}`,
    "Z",
  ].join(" ");
}

/** Classic two-centred pointed arch opening, springing from `spring`. */
function archPath(x1: number, x2: number, spring: number, floor: number) {
  const w = x2 - x1;
  const xm = (x1 + x2) / 2;
  const apex = spring - (Math.sqrt(3) / 2) * w; // geometric apex when radius = w
  return [
    `M${x1},${floor}`,
    `L${x1},${spring}`,
    `A${w},${w} 0 0 1 ${xm},${apex.toFixed(2)}`,
    `A${w},${w} 0 0 1 ${x2},${spring}`,
    `L${x2},${floor}`,
    "Z",
  ].join(" ");
}

/* ── Silhouette primitives ────────────────────────────────────────────────── */
// All of these are drawn with a flat opaque fill inherited from their parent
// group. The parent is then masked as a whole, which forces the renderer to
// flatten the group before applying alpha — so overlapping primitives (a dome's
// base ring over its block, the arcade over the ground line) can never
// double-darken into visible seams the way per-shape opacity would.

function Dome({ cx, base, r }: { cx: number; base: number; r: number }) {
  const apex = base - r * 1.34;
  return (
    <g>
      <path d={domePath(cx, base, r)} />
      <rect x={cx - r * 1.12} y={base - 5} width={r * 2.24} height={9} rx={2} />
      <rect x={cx - r * 0.05} y={apex - r * 0.42} width={r * 0.1} height={r * 0.44} />
      <circle cx={cx} cy={apex - r * 0.46} r={r * 0.11} />
    </g>
  );
}

/**
 * Tapering shaft → balcony → upper shaft → bulb cap → finial.
 * Overall height above `base` works out to ≈ 1.0·h + 0.69·w.
 */
function Minaret({ cx, base, h, w }: { cx: number; base: number; h: number; w: number }) {
  const shaftTop = base - h * 0.62;
  const balconyY = shaftTop - h * 0.05;
  const upperTop = balconyY - h * 0.2;
  const capBase = upperTop - h * 0.032;
  const capR = w * 0.44;
  const capApex = capBase - capR * 1.34;
  return (
    <g>
      <path d={`M${cx - w / 2},${base} L${cx - w * 0.34},${shaftTop} L${cx + w * 0.34},${shaftTop} L${cx + w / 2},${base} Z`} />
      <rect x={cx - w * 0.72} y={balconyY} width={w * 1.44} height={h * 0.05} rx={1.5} />
      <rect x={cx - w * 0.26} y={upperTop} width={w * 0.52} height={balconyY - upperTop} />
      <rect x={cx - w * 0.5} y={capBase} width={w} height={h * 0.032} rx={1.5} />
      <path d={domePath(cx, capBase, capR)} />
      <rect x={cx - w * 0.035} y={capApex - h * 0.09} width={w * 0.07} height={h * 0.09} />
      <circle cx={cx} cy={capApex - h * 0.1} r={w * 0.1} />
    </g>
  );
}

/** Abraj Al Bait-style tower: stepped shaft, clock housing, crown, spire. */
function ClockTower({ cx, base, h, w }: { cx: number; base: number; h: number; w: number }) {
  const bodyTop = base - h * 0.68;
  const faceCy = bodyTop - h * 0.06;
  const crownTop = bodyTop - h * 0.24;
  const crownR = w * 0.3;
  const crownApex = crownTop - crownR * 1.34;
  const faceR = w * 0.29;
  return (
    <g>
      <path d={`M${cx - w / 2},${base} L${cx - w * 0.4},${bodyTop} L${cx + w * 0.4},${bodyTop} L${cx + w / 2},${base} Z`} />
      <path d={`M${cx - w * 0.52},${bodyTop} L${cx - w * 0.44},${crownTop} L${cx + w * 0.44},${crownTop} L${cx + w * 0.52},${bodyTop} Z`} />
      {/* Clock dial — the one lit detail in an otherwise flat silhouette. On the
          light theme the dial is knocked OUT of the tower rather than filled
          dark: inside the flattened group it is a near-white disc, so after the
          group's alpha ramp it reads as a bright face punched into a pale navy
          tower. Gold marks run high-opacity because that same ramp thins them. */}
      <circle cx={cx} cy={faceCy} r={faceR} fill="#E2E8F5" />
      <circle cx={cx} cy={faceCy} r={faceR} fill="none" stroke={GOLD_DEEP} strokeWidth={1.6} opacity={0.95} />
      <rect x={cx - w * 0.014} y={faceCy - faceR * 0.72} width={w * 0.028} height={faceR * 0.72} fill={GOLD_DEEP} opacity={0.9} />
      <rect x={cx - w * 0.014} y={faceCy - w * 0.014} width={faceR * 0.58} height={w * 0.028} fill={GOLD_DEEP} opacity={0.9} />
      <path d={domePath(cx, crownTop, crownR)} />
      <rect x={cx - w * 0.02} y={crownApex - h * 0.11} width={w * 0.04} height={h * 0.11} />
      <circle cx={cx} cy={crownApex - h * 0.115} r={w * 0.055} />
    </g>
  );
}

/**
 * Haram-style colonnade: a solid wall with pointed arches punched out via a
 * mask, so the far plane and the sky genuinely show through the openings.
 */
function Arcade() {
  const step = 46;
  const pier = 13;
  const spring = 326;
  const from = -46;
  const to = 1486;
  const bays = [];
  for (let x = from; x <= to; x += step) {
    bays.push(<path key={x} d={archPath(x + pier, x + step, spring, ARCH_FLOOR)} fill="#000" />);
  }
  return (
    <>
      <defs>
        <mask id="thjh-arcade">
          <rect x={from} y={GROUND} width={to - from + step} height={PLINTH - GROUND} fill="#1C2444" />
          {bays}
        </mask>
      </defs>
      <rect x={from} y={GROUND} width={to - from + step} height={PLINTH - GROUND} mask="url(#thjh-arcade)" />
    </>
  );
}

/* ── Composed skyline ─────────────────────────────────────────────────────── */

/**
 * The load-bearing composition (flanking minarets, grand dome, clock tower)
 * sits inside x≈500–1000 so it still reads when the band is scaled up and
 * centre-cropped at narrow viewports.
 */
function Skyline() {
  const B = GROUND;
  return (
    <g>
      {/* left wing */}
      <rect x={0} y={B - 70} width={210} height={70} />
      <Dome cx={148} base={B - 70} r={28} />
      <Minaret cx={262} base={B} h={158} w={17} />
      <rect x={300} y={B - 84} width={190} height={84} />
      <Dome cx={352} base={B - 84} r={24} />
      <Dome cx={440} base={B - 84} r={24} />

      {/* ── centre composition ── */}
      <Minaret cx={545} base={B} h={196} w={19} />
      <rect x={580} y={B - 88} width={166} height={88} />
      <Dome cx={663} base={B - 88} r={80} />
      <Minaret cx={782} base={B} h={208} w={19} />
      <ClockTower cx={888} base={B} h={218} w={76} />
      <Minaret cx={968} base={B} h={176} w={17} />
      {/* ── /centre ── */}

      {/* right wing */}
      <rect x={1000} y={B - 92} width={188} height={92} />
      <Dome cx={1050} base={B - 92} r={28} />
      <Dome cx={1140} base={B - 92} r={28} />
      <Minaret cx={1226} base={B} h={168} w={17} />
      <rect x={1262} y={B - 72} width={178} height={72} />
      <Dome cx={1352} base={B - 72} r={26} />

      <Arcade />
    </g>
  );
}

/** Softened echo of the skyline, standing on the arcade floor line. */
function FarSkyline() {
  const B = ARCH_FLOOR;
  return (
    <g>
      <Minaret cx={120} base={B} h={130} w={13} />
      <rect x={180} y={B - 58} width={200} height={58} />
      <Dome cx={280} base={B - 58} r={40} />
      <Minaret cx={430} base={B} h={150} w={13} />
      <rect x={470} y={B - 50} width={180} height={50} />
      <Dome cx={615} base={B - 50} r={46} />
      <Minaret cx={716} base={B} h={168} w={14} />
      <rect x={760} y={B - 56} width={220} height={56} />
      <Dome cx={848} base={B - 56} r={36} />
      <Minaret cx={1030} base={B} h={152} w={13} />
      <rect x={1070} y={B - 60} width={240} height={60} />
      <Dome cx={1190} base={B - 60} r={42} />
      <Minaret cx={1340} base={B} h={138} w={13} />
    </g>
  );
}

/* ── Rosette medallion ────────────────────────────────────────────────────── */

function Rosette() {
  const c = 300;
  return (
    <svg viewBox="0 0 600 600" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="thjh-rose-fade" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="#E2E8F5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#E2E8F5" stopOpacity="0" />
        </radialGradient>
        <mask id="thjh-rose-mask">
          <rect width="600" height="600" fill="url(#thjh-rose-fade)" />
        </mask>
      </defs>

      {/* GOLD_DEEP rather than GOLD: a 0.6px hairline of #C9A24B on a near-white
          field is effectively invisible, so the medallion is drawn one value
          down and then held back by the wrapper's opacity instead. */}
      <g mask="url(#thjh-rose-mask)" fill="none" stroke={GOLD_DEEP} strokeLinejoin="round">
        {/* outer ring, very slow clockwise */}
        <g className="thj-anim thj-spin" style={{ transformOrigin: "300px 300px" }}>
          <path d={starPath(16, 272, 214, c, c)} strokeWidth="0.9" opacity="0.55" />
          <path d={starPath(16, 240, 200, c, c, Math.PI / 16)} strokeWidth="0.6" opacity="0.35" />
          <circle cx={c} cy={c} r="278" strokeWidth="0.7" opacity="0.3" />
          <circle cx={c} cy={c} r="252" strokeWidth="0.5" opacity="0.2" />
        </g>

        {/* inner rosette, very slow counter-clockwise */}
        <g className="thj-anim thj-spin-rev" style={{ transformOrigin: "300px 300px" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={c - 116}
              y={c - 116}
              width="232"
              height="232"
              strokeWidth="0.7"
              opacity="0.4"
              transform={`rotate(${(i * 90) / 6} ${c} ${c})`}
            />
          ))}
          <path d={starPath(8, 150, 76, c, c)} strokeWidth="1" opacity="0.6" />
          <circle cx={c} cy={c} r="70" strokeWidth="0.8" opacity="0.45" />
          <circle cx={c} cy={c} r="44" strokeWidth="0.6" opacity="0.3" />
        </g>
      </g>
    </svg>
  );
}

/* ── Public component ─────────────────────────────────────────────────────── */

export default function HeroBackdrop() {
  // Both skyline planes share identical box geometry so their ground lines stay
  // locked together at every breakpoint. They now live in a single SVG (see
  // layer 7) so the composite can be alpha-ramped as one silhouette.
  const skyBox = "thj-sky absolute inset-x-0 bottom-0 w-full h-auto";
  const skyRatio = { aspectRatio: `${VB_W} / ${VB_H}` };

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{CSS}</style>

      {/* 1 · daylight field — warm white pooling top-left (under the copy),
             cooling to the pale blue-grey of the page background, then warming
             again at the horizon where the sanctuary sits */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 96% at 16% 2%, rgba(226,232,245,0.10) 0%, rgba(226,232,245,0.045) 38%, rgba(226,232,245,0) 66%)," +
            "radial-gradient(84% 70% at 86% 8%, rgba(59,127,232,0.12) 0%, rgba(59,127,232,0) 62%)," +
            "radial-gradient(72% 46% at 50% 100%, rgba(200,148,58,0.20) 0%, rgba(200,148,58,0) 72%)," +
            "linear-gradient(180deg, #07091A 0%, #0B1024 42%, #0F1326 72%, #141830 100%)",
        }}
      />

      {/* 2 · horizon bloom — warm light rising off the sanctuary */}
      <div
        className="thj-anim thj-drift absolute inset-x-[-10%] bottom-[-24%] h-[78%]"
        style={{
          background:
            "radial-gradient(58% 100% at 50% 100%, rgba(200,148,58,0.26) 0%, rgba(200,148,58,0.10) 40%, rgba(200,148,58,0) 74%)",
        }}
      />
      {/* light column behind the grand dome — on the light theme this brightens
          rather than glows, giving the dome a halo to be read against */}
      <div
        className="thj-anim thj-glow absolute bottom-0 left-1/2 -translate-x-1/2 w-[62%] h-[74%]"
        style={{
          background:
            "radial-gradient(40% 100% at 50% 100%, rgba(217,168,74,0.55) 0%, rgba(200,148,58,0.20) 44%, rgba(200,148,58,0) 80%)",
        }}
      />

      {/* 3 · light rays — the daylight replacement for the old star field.
             Every stop is a warm near-white, so this layer can only ADD
             luminance; it is incapable of hurting the copy. The radial mask
             pins the fan to the upper right, well clear of the headline. */}
      <div
        className="thj-anim thj-rays absolute inset-0"
        style={{
          background:
            "repeating-conic-gradient(from 188deg at 79% -8%," +
            "rgba(226,232,245,0) 0deg, rgba(226,232,245,0.16) 2.1deg," +
            "rgba(226,232,245,0) 5.2deg, rgba(226,232,245,0) 12deg)",
          WebkitMaskImage:
            "radial-gradient(74% 86% at 79% -8%, #000 0%, rgba(0,0,0,0.5) 44%, rgba(0,0,0,0) 78%)",
          maskImage:
            "radial-gradient(74% 86% at 79% -8%, #000 0%, rgba(0,0,0,0.5) 44%, rgba(0,0,0,0) 78%)",
          opacity: 0.5,
        }}
      />

      {/* 4 · geometric lattice, radially masked so it never reads as flat
             wallpaper. Weighted right-of-centre on the light theme so the
             tessellation lives with the medallion instead of under the copy. */}
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <pattern id="thjh-lattice" width="112" height="112" patternUnits="userSpaceOnUse">
            <path d={starPath(8, 46, 21, 56, 56)} fill="none" stroke={GOLD_DEEP} strokeWidth="0.6" />
            <path d="M56 10 L102 56 L56 102 L10 56 Z" fill="none" stroke={GOLD_DEEP} strokeWidth="0.35" />
            <circle cx="56" cy="56" r="7" fill="none" stroke={GOLD_DEEP} strokeWidth="0.4" />
          </pattern>
          <radialGradient id="thjh-lattice-fade" cx="64%" cy="24%" r="74%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="52%" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#E2E8F5" stopOpacity="0" />
          </radialGradient>
          <mask id="thjh-lattice-mask">
            <rect width="100%" height="100%" fill="url(#thjh-lattice-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#thjh-lattice)" mask="url(#thjh-lattice-mask)" opacity="0.12" />
      </svg>

      {/* 5 · rosette medallion — desktop focal anchor, cropped off the right edge */}
      <div className="hidden lg:block absolute top-[6%] right-[-14%] w-[640px] h-[640px] xl:w-[760px] xl:h-[760px] opacity-50">
        <div
          className="absolute inset-[12%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(217,168,74,0.40) 0%, rgba(200,148,58,0.12) 42%, rgba(200,148,58,0) 70%)" }}
        />
        <Rosette />
      </div>

      {/* 6 · skyline — far plane + near plane composited inside ONE masked
             group. Drawing the far plane first and the near plane opaquely over
             it means the arcade genuinely occludes what is behind it (no ghost
             minarets bleeding through the domes), while the group mask applies
             a single vertical navy-alpha ramp to the finished composite:
             ~0.13 at the spires → ~0.40 at the plinth. That keeps it a tinted
             architectural wash rather than a black cutout, and keeps its upper
             reaches — the only part that can ever sit behind copy — barely
             above the page background in value. */}
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={skyBox} style={skyRatio} aria-hidden="true">
        <defs>
          <linearGradient id="thjh-sil-ramp" x1="0" y1="40" x2="0" y2={PLINTH} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.13" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.24" />
            <stop offset="76%" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.4" />
          </linearGradient>
          {/* the mask box is wider than the viewBox because the arcade runs
              from x=-46 to x=1486 so it survives the mobile scale-up */}
          <mask id="thjh-sil-fade" maskUnits="userSpaceOnUse" x={-80} y={-60} width={VB_W + 160} height={VB_H + 60}>
            <rect x={-80} y={-60} width={VB_W + 160} height={VB_H + 60} fill="url(#thjh-sil-ramp)" />
          </mask>
          <filter id="thjh-soften" x="-6%" y="-16%" width="112%" height="132%">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
        </defs>

        <g mask="url(#thjh-sil-fade)" fill={NAVY}>
          {/* far plane — blurred and held back for atmospheric perspective */}
          <g opacity="0.46" filter="url(#thjh-soften)">
            <FarSkyline />
          </g>
          {/* near plane — opaque inside the group, so it occludes cleanly */}
          <Skyline />
        </g>
      </svg>

      {/* 7 · film grain — the field is smoother and larger than the old night
             mesh, so this stays purely as anti-banding insurance. Soft-light
             against mid-grey noise is close to a no-op in value terms. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] mix-blend-soft-light" aria-hidden="true">
        <filter id="thjh-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#thjh-grain)" />
      </svg>

      {/* 8 · readability scrim — a LIGHT wash now, not a dark one. Horizontally
             it is strongest at the left where the copy sits and releases toward
             the right so the medallion and the dome/tower cluster keep their
             presence. The vertical mask then releases it toward the bottom, so
             the plinth and arcade are never washed out — the copy never reaches
             down there, and letting the base stay solid is what stops the
             skyline reading as a half-drawn image. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(7,9,26,0.94) 0%, rgba(7,9,26,0.88) 26%," +
            "rgba(7,9,26,0.62) 46%, rgba(7,9,26,0.26) 66%, rgba(7,9,26,0) 86%)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 56%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 56%, rgba(0,0,0,0.6) 78%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* gold hairline sealing the hero against the section below */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${GOLD}66 22%, ${GOLD}cc 50%, ${GOLD}66 78%, transparent 100%)` }}
      />
    </div>
  );
}

/* ── Stylesheet ───────────────────────────────────────────────────────────── */
// Scoped by the `thj-` prefix. Kept as CSS animations rather than JS so nothing
// runs on a rAF loop; the reduced-motion block at the end is the single kill
// switch for every animated element in the hero (backdrop *and* Home.tsx).

const CSS = `
/* Skyline plane scales with viewport WIDTH and is anchored to the bottom, so
   the band is never cropped vertically (which would behead the clock tower).
   Below lg the whole band is scaled up and allowed to overflow sideways, which
   centre-crops onto the dome/tower composition rather than shrinking it away. */
.thj-sky {
  transform-origin: 50% 100%;
  transform: scale(1.85);
}
@media (min-width: 640px)  { .thj-sky { transform: scale(1.4); } }
@media (min-width: 768px)  { .thj-sky { transform: scale(1.18); } }
@media (min-width: 1024px) { .thj-sky { transform: none; } }

@keyframes thj-spin      { to   { transform: rotate(360deg); } }
@keyframes thj-spin-rev  { to   { transform: rotate(-360deg); } }
@keyframes thj-drift     { 0%,100% { transform: translate3d(0,0,0) scale(1); }
                           50%     { transform: translate3d(-2.5%,2%,0) scale(1.07); } }
@keyframes thj-glow      { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes thj-rays      { 0%,100% { opacity: 0.36; } 50% { opacity: 0.62; } }
@keyframes thj-cue       { 0%   { transform: translateY(-120%); opacity: 0; }
                           35%  { opacity: 1; }
                           100% { transform: translateY(320%); opacity: 0; } }
@keyframes thj-sheen     { 0%   { transform: translateX(-160%) skewX(-18deg); }
                           100% { transform: translateX(320%)  skewX(-18deg); } }
@keyframes thj-ping      { 0%   { transform: scale(1);   opacity: 0.7; }
                           70%  { transform: scale(2.6); opacity: 0; }
                           100% { transform: scale(2.6); opacity: 0; } }

.thj-spin     { animation: thj-spin 190s linear infinite; }
.thj-spin-rev { animation: thj-spin-rev 140s linear infinite; }
.thj-drift    { animation: thj-drift 26s ease-in-out infinite; }
.thj-glow     { animation: thj-glow 11s ease-in-out infinite; }
.thj-rays     { animation: thj-rays 19s ease-in-out infinite; }
.thj-cue      { animation: thj-cue 2.6s cubic-bezier(0.4,0,0.2,1) infinite; }
.thj-ping     { animation: thj-ping 2.8s cubic-bezier(0,0,0.2,1) infinite; }

/* Gold gradient headline accent, re-valued for the light theme. The old ramp
   topped out at #EBD5A2, which is ~1.2:1 against a near-white field — it would
   have rendered the accent word all but blank. This ramp is an antique-brass
   read of the same hue: its LIGHTEST stop (#A8842C) still clears 3:1 against
   #F4F8FC, and the headline is large bold display type, so 3:1 is the AA bar.
   Falls back to flat deep gold where background-clip on text is unsupported. */
.thj-goldtext { color: #8A6A1E; }
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .thj-goldtext {
    background-image: linear-gradient(100deg, #6B4E12 0%, #A8842C 32%, #7C5D18 62%, #A8842C 88%, #8C6A20 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
}

/* CTA sheen — only sweeps on deliberate hover, never idles */
.thj-sheen { opacity: 0; }
.thj-cta:hover .thj-sheen { opacity: 1; animation: thj-sheen 900ms ease-out; }

/* Keyboard focus visibility for the hero CTAs. Navy, not gold: the primary CTA
   has a gold fill, so a gold ring would vanish against it, and gold on the
   light page is ~2:1 — below the 3:1 non-text contrast bar for focus rings. */
.thj-cta:focus-visible { outline: 2px solid ${NAVY}; outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .thj-anim,
  .thj-anim *,
  .thj-sheen,
  .thj-cta:hover .thj-sheen {
    animation: none !important;
    transition: none !important;
  }
  /* kill the CTA lift and the arrow nudge as well */
  .thj-cta, .thj-cta * { transition: none !important; }
  .thj-cta:hover, .thj-cta:hover * { transform: none !important; }
  /* freeze ambient layers at a legible resting state */
  .thj-glow  { opacity: 0.8 !important; }
  .thj-rays  { opacity: 0.5 !important; }
  .thj-sheen { opacity: 0 !important; }
}
`;
