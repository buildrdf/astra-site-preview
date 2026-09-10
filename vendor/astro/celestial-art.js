/* ====================================================================
   CELESTIAL ART — dimensional grahas on a 2D canvas
   ====================================================================

   THE ASSET STRATEGY
   ------------------
   We ship nine flat 128px PNGs (assets/graha/*.png). A flat bitmap that
   gets rotated to imply volume always reads as a sticker on a turntable,
   so this module never rotates the bitmap. Each PNG is demoted to one
   job — a COLOUR TEXTURE — and the volume is built around it:

     opaque base disc → texture (clipped, overscaled) → flatten the
     texture's baked shading → multiply a lighting gradient (terminator
     + limb darkening) → screen a specular and a rim light on the lit
     limb → occlusion at the far limb → glow (dark) / shadow (light).

   Because the light is a parameter, the same object is re-lit every
   frame (opts.spin) with zero texture work — the whole point: it has a
   surface, not an orientation.

   Three bodies refuse the sphere pipeline, and the artwork is why:

     · SUN    the PNG is a cartoon flame star. Only the inner ball (0.52
              of the frame) becomes the photosphere; the flame rays are
              discarded for a real layered corona. No terminator — a
              star is lit from within.
     · SATURN the PNG already has rings baked in at ~22°, so the rings
              cannot come from the bitmap at all. Only the globe (0.477)
              is sampled; the rings are rebuilt procedurally with REAL
              depth ordering — behind the globe above, in front below,
              plus the globe's shadow cast across them.
     · RAHU / lunar NODES, not bodies. The art is a figure (a deva head,
       KETU   a serpent tail), so clipping it to a disc would decapitate
              it. They become spatial glyph-objects: a solid ring with a
              recessed well, the figure standing in it, and the node
              axis passing BEHIND the ring above and IN FRONT below.
              Rahu ascends, Ketu descends.

   MEASURED SOURCE GEOMETRY (alpha bounds of the shipped PNGs in their
   128px frame, all centred): spheres 103px across (0.805 of the frame);
   Sun ball 66px (0.52); Saturn globe 61px (0.477), ring 120px; node
   figures 106px tall (0.83). These are GRAHA_BASE.fill — measured, not
   guessed. The art is already lit from the upper left, which is why the
   default light is (-0.55,-0.6): we reinforce it rather than fight it.

   REPLACING THIS WITH REAL 3D LATER
   ---------------------------------
   `drawGraha` is the single seam. A future glTF/USDZ pipeline swaps ONE
   body at a time by adding a `kind` case — e.g. 'mesh', blitting a frame
   from an offscreen WebGL/SceneKit render — while callers keep calling
   drawGraha(ctx,name,x,y,r,opts) and grahaSprite(name,size,opts)
   unchanged. opts already carries everything a real renderer needs
   (light, phase, tilt, spin, quality, focus), so no call site changes
   when the art does.

   No dependencies. No WebGL. Pure canvas 2D.
   ==================================================================== */

/* Base colour + glow per body. `token` is the app's existing GLOW string
   (skyview.js) kept verbatim so both systems stay in step.
     kind   sphere | star | ringed | node — which pipeline draws it
     fill   fraction of the 128px art frame the body occupies (measured)
     extent how far the drawing reaches past r, in units of r; grahaSprite
            uses it to size the body so rings/corona are never cropped
     spec   specular strength (matte bodies stay matte)
     dir    node direction cue: -1 ascending (Rahu), +1 descending (Ketu) */
export const GRAHA_BASE = {
  Sun:     { token:"255,196,110", rgb:[255,196,110], glow:0.62, kind:"star",   spec:0.00, fill:0.520, extent:1.95 },
  Moon:    { token:"214,226,255", rgb:[214,226,255], glow:0.34, kind:"sphere", spec:0.05, fill:0.805, extent:1.34 },
  Mars:    { token:"255,128,96",  rgb:[255,128,96],  glow:0.30, kind:"sphere", spec:0.10, fill:0.805, extent:1.34 },
  Mercury: { token:"150,224,170", rgb:[150,224,170], glow:0.28, kind:"sphere", spec:0.14, fill:0.805, extent:1.34 },
  Jupiter: { token:"255,214,150", rgb:[255,214,150], glow:0.32, kind:"sphere", spec:0.12, fill:0.805, extent:1.34 },
  Venus:   { token:"242,242,255", rgb:[242,242,255], glow:0.38, kind:"sphere", spec:0.22, fill:0.805, extent:1.34 },
  Saturn:  { token:"232,204,146", rgb:[232,204,146], glow:0.30, kind:"ringed", spec:0.12, fill:0.477, extent:2.34 },
  Rahu:    { token:"156,146,208", rgb:[156,146,208], glow:0.26, kind:"node",   spec:0.00, fill:0.830, extent:1.34, dir:-1 },
  Ketu:    { token:"156,146,208", rgb:[156,146,208], glow:0.26, kind:"node",   spec:0.00, fill:0.830, extent:1.34, dir:+1 },
};

const NAMES = Object.keys(GRAHA_BASE);
const KEYOF = {}; for (const n of NAMES) KEYOF[n.toLowerCase()] = n;
const baseOf = name => GRAHA_BASE[KEYOF[String(name).toLowerCase()]] || GRAHA_BASE.Moon;
const nameOf = name => KEYOF[String(name).toLowerCase()] || "Moon";

/* ---- texture loading ------------------------------------------------
   Paths resolve against this module's URL, so the same code works from
   the app (prototype/index.html) and from tools/art-demo.html. */
const ART = {};
let artPromise = null;

export function preloadGrahaArt() {
  if (artPromise) return artPromise;
  if (typeof Image === "undefined") return (artPromise = Promise.resolve(false));
  artPromise = Promise.all(NAMES.map(n => new Promise(res => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { ART[n] = im; res(true); };
    im.onerror = () => res(false);
    im.src = new URL(`../../assets/graha/${n.toLowerCase()}.png`, import.meta.url).href;
  }))).then(r => {
    SPRITES.clear();          // sprites baked before the art landed are untextured
    return r.every(Boolean);
  });
  return artPromise;
}
if (typeof Image !== "undefined") preloadGrahaArt();      // warm on import

const texture = n => { const im = ART[n]; return (im && im.complete && im.naturalWidth) ? im : null; };

/* ---- small helpers -------------------------------------------------- */
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DEG = Math.PI / 180;
/* Stroke insets are absolute (a 0.6px hairline), so on a 1px body they can
   drive an arc radius negative — which throws in a real 2D context. */
const arcR = v => v > 0.01 ? v : 0.01;

/* Normalised screen light, rotated by `spin` (a light drift — the caller
   animates it; the texture is never rotated). */
function lightVec(o) {
  const l = o.light || { x: -0.55, y: -0.6 };
  const m = Math.hypot(l.x, l.y) || 1;
  let lx = l.x / m, ly = l.y / m;
  if (o.spin) { const a = o.spin * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
                [lx, ly] = [lx * c - ly * s, lx * s + ly * c]; }
  return [lx, ly];
}

/* ---- shared sphere pipeline -----------------------------------------
   Draws an opaque, lit sphere of radius r centred at the origin of the
   CURRENT transform. Everything downstream (Moon phase, Saturn's globe)
   builds on this, which is what keeps the nine bodies feeling like one
   material system. */
function sphere(ctx, r, B, lx, ly, o, texName) {
  const hi = o.quality === "high", light = o.ground === "light";
  const im = texture(texName);

  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();

  /* 1. opaque base — guarantees the disc is solid before any multiply,
        so 'multiply'/'screen' never bite into the page behind it, and
        gives us a graceful body-coloured sphere when art is missing. */
  const bg = ctx.createRadialGradient(lx * r * .4, ly * r * .4, 0, 0, 0, r);
  bg.addColorStop(0, rgba(B.rgb, 1));
  bg.addColorStop(1, `rgb(${B.rgb.map(v => Math.round(v * .42)).join(",")})`);
  ctx.fillStyle = bg; ctx.fillRect(-r, -r, 2 * r, 2 * r);

  /* 2. the texture, overscaled so its soft AA edge falls outside the clip */
  if (im) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const F = (2 * r / B.fill) * 1.04;
    const ox = texName === "Moon" && o.spin ? Math.cos(o.spin * 2 * Math.PI) * r * .02 : 0;  // libration, not rotation
    ctx.drawImage(im, ox - F / 2, -F / 2, F, F);
    /* 3. flatten the baked shading toward the base colour so OUR light
          is the one the eye reads (and, on Saturn, so the ring stripe
          baked across the globe stops competing). */
    ctx.globalAlpha = (texName === "Saturn" ? .34 : .18) * BASE_A;
    ctx.fillStyle = rgba(B.rgb, 1); ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.globalAlpha = BASE_A;
  }

  /* 4. lighting: a radial ramp centred on the sub-solar point. Multiply
        keeps the texture's hue and only removes light, which is what a
        terminator physically is. */
  const px = lx * r * .62, py = ly * r * .62;
  const g = ctx.createRadialGradient(px, py, r * .02, px, py, r * 2.05);
  for (const [t, c] of [[0, "#ffffff"], [.30, "#f7f5f3"], [.52, "#cdc9d6"],
                        [.72, "#78758e"], [.88, "#37364d"], [1, "#171929"]])
    g.addColorStop(t, c);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);

  /* 5. ambient occlusion at the limb — a hard silhouette is what makes
        the body sit ON the warm paper instead of floating over it. */
  const ao = ctx.createRadialGradient(0, 0, r * .80, 0, 0, r);
  ao.addColorStop(0, "rgba(255,255,255,1)");
  ao.addColorStop(1, light ? "rgba(96,92,120,1)" : "rgba(150,146,176,1)");
  ctx.fillStyle = ao; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.globalCompositeOperation = "source-over";

  /* 6. specular + rim light, added back with 'screen' (never 'lighter',
        which blows out to white on the off-white ground). */
  if (hi && B.spec > 0) {
    const s = ctx.createRadialGradient(px * 1.15, py * 1.15, 0, px * 1.15, py * 1.15, r * .5);
    s.addColorStop(0, `rgba(255,255,255,${B.spec})`);
    s.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = s; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  }
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = Math.max(0.7, r * .055);
  const rim = ctx.createLinearGradient(lx * r, ly * r, -lx * r, -ly * r);
  rim.addColorStop(0, rgba(B.rgb, light ? .34 : .5));
  rim.addColorStop(.45, rgba(B.rgb, 0));
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = rim; ctx.beginPath(); ctx.arc(0, 0, r * .975, 0, 7); ctx.stroke();

  /* a cool bounce on the shadow limb separates the body from the indigo */
  if (hi && !light) {
    const bl = ctx.createLinearGradient(-lx * r, -ly * r, lx * r, ly * r);
    bl.addColorStop(0, "rgba(120,150,220,.30)");
    bl.addColorStop(.5, "rgba(120,150,220,0)");
    bl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.strokeStyle = bl; ctx.lineWidth = Math.max(0.6, r * .04);
    ctx.beginPath(); ctx.arc(0, 0, r * .98, 0, 7); ctx.stroke();
  }
  ctx.restore();

  /* 7. a hairline silhouette — the one thing that keeps a 40px body
        legible on #F7F5EF, where glow does nothing. */
  if (light) {
    ctx.save(); ctx.strokeStyle = "rgba(44,42,66,.20)";
    ctx.lineWidth = Math.max(0.6, r * .014);
    ctx.beginPath(); ctx.arc(0, 0, arcR(r - ctx.lineWidth / 2), 0, 7); ctx.stroke(); ctx.restore();
  }
}

/* ---- atmosphere: glow on indigo, contact shadow on paper ------------- */
function halo(ctx, r, B, lx, ly, o) {
  const f = o.focus ? 1.7 : 1;
  ctx.save();
  if (o.ground === "light") {
    ctx.translate(-lx * r * .07, -ly * r * .07);           // shadow opposite the light
    const s = ctx.createRadialGradient(0, 0, r * .88, 0, 0, r * 1.2);
    s.addColorStop(0, "rgba(46,42,66,.13)");
    s.addColorStop(1, "rgba(46,42,66,0)");
    ctx.fillStyle = s; ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
    ctx.translate(lx * r * .07, ly * r * .07);
    const t = ctx.createRadialGradient(0, 0, r * .9, 0, 0, r * 1.28);
    t.addColorStop(0, rgba(B.rgb, .16 * f));
    t.addColorStop(1, rgba(B.rgb, 0));
    ctx.fillStyle = t; ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  } else {
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, r * .88, 0, 0, r * (1.34 + (o.focus ? .16 : 0)));
    g.addColorStop(0, rgba(B.rgb, .30 * B.glow * f));
    g.addColorStop(.55, rgba(B.rgb, .10 * B.glow * f));
    g.addColorStop(1, rgba(B.rgb, 0));
    ctx.fillStyle = g; ctx.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
  }
  ctx.restore();
}

/* ---- SUN ------------------------------------------------------------
   Lit from within: no terminator, no rim. Restraint comes from keeping
   the corona wide, low-alpha and only three layers deep. */
function drawSun(ctx, r, B, lx, ly, o) {
  const hi = o.quality === "high", light = o.ground === "light";
  const f = o.focus ? 1.28 : 1;
  ctx.save();
  ctx.globalCompositeOperation = light ? "source-over" : "lighter";
  for (const [r0, r1, a] of [[.92, 1.95, .17], [.96, 1.42, .20], [1.0, 1.14, .26]]) {
    const g = ctx.createRadialGradient(0, 0, r * r0, 0, 0, r * r1);
    g.addColorStop(0, rgba(B.rgb, a * f * (light ? .62 : 1)));
    g.addColorStop(1, rgba(B.rgb, 0));
    ctx.fillStyle = g; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  const bg = ctx.createRadialGradient(0, -r * .12, 0, 0, 0, r);
  bg.addColorStop(0, "rgb(255,236,196)");
  bg.addColorStop(.62, `rgb(${B.rgb.join(",")})`);
  bg.addColorStop(1, "rgb(226,142,52)");
  ctx.fillStyle = bg; ctx.fillRect(-r, -r, 2 * r, 2 * r);

  const im = texture("Sun");
  if (im) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const F = (2 * r / B.fill) * 1.04;
    ctx.globalAlpha = .9 * BASE_A; ctx.drawImage(im, -F / 2, -F / 2, F, F);
    /* granulation: the same bitmap sampled at a second scale (a scale,
       never a rotation) so the plasma reads as depth, not as a decal. */
    if (hi) { ctx.globalAlpha = .22 * BASE_A; ctx.globalCompositeOperation = "overlay";
              ctx.drawImage(im, -F * .59, -F * .59, F * 1.18, F * 1.18); }
    ctx.globalAlpha = BASE_A; ctx.globalCompositeOperation = "source-over";
  }
  /* limb darkening — real, and the thing that stops a star looking flat */
  const ld = ctx.createRadialGradient(0, 0, r * .55, 0, 0, r);
  ld.addColorStop(0, "rgba(255,255,255,0)");
  ld.addColorStop(.82, "rgba(196,104,26,.20)");
  ld.addColorStop(1, "rgba(150,68,14,.55)");
  ctx.fillStyle = ld; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();

  ctx.save();                                        // hot chromosphere edge
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  ctx.strokeStyle = light ? "rgba(214,132,42,.42)" : "rgba(255,226,168,.55)";
  ctx.lineWidth = Math.max(0.7, r * .035);
  ctx.beginPath(); ctx.arc(0, 0, r * .985, 0, 7); ctx.stroke();
  ctx.restore();
}

/* ---- SATURN ---------------------------------------------------------
   Real depth ordering. `tilt` is the ring plane's opening angle: the
   ellipse's minor axis is sin(tilt) of the major, so 5° is almost
   edge-on and 40° is wide open. A constant ROLL matches the shipped
   art's ring axis and keeps the object from reading as a logo. */
const ROLL = -13 * DEG;
const R_IN = 1.24, R_OUT = 2.27;                     // ring radii, in globe radii (C ring inner → A ring outer)

/* The ring's real structure, as [fraction of the A ring's outer edge,
   opacity, useHighlightColour]. Actual Saturn radii: C 1.24–1.53,
   B 1.53–1.95, Cassini division 1.95–2.03, A 2.03–2.27 — so the gaps
   land where they physically are, not where they look pretty. */
const RING_STOPS = [
  [0.000, 0], [0.545, 0],                            // empty inside the C ring
  [0.550, .26], [0.670, .34],                        // C ring — sheer
  [0.678, .88], [0.780, .92, 1], [0.856, .80],       // B ring — the bright one
  [0.862, .10], [0.892, .12],                        // Cassini division
  [0.898, .60], [0.972, .52],                        // A ring
  [0.978, .22], [0.984, .46],                        // Encke gap
  [0.998, .30], [1.000, 0],
];

function ringPaint(ctx, R, s, light) {               // s = sin(tilt)
  /* On indigo the ring reads by being brighter than the ground; on warm
     paper it has to read by being DARKER, so the palette flips. */
  const c = light ? "168,134,78" : "232,204,146";
  const hi = light ? "206,176,120" : "255,236,196";
  const k = light ? 1.12 : 1;                        // paper needs a touch more body
  ctx.save(); ctx.scale(1, s);                       // gradient circles become the ring's ellipses
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * R_OUT);
  for (const [t, a, h] of RING_STOPS)
    g.addColorStop(t, `rgba(${h ? hi : c},${Math.min(1, a * k)})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R * R_OUT, 0, 7); ctx.fill();
  ctx.restore();
}

/* The globe's shadow, cast onto the ring, opposite the light. Clipped to
   the annulus — filled loose it would smear a dark band over the globe. */
function castShadow(ctx, R, s, lx, ly) {
  const E = R * R_OUT * 2;
  ctx.save();
  ctx.scale(1, s);
  ctx.beginPath();
  ctx.arc(0, 0, R * R_OUT, 0, 7);
  ctx.arc(0, 0, R * R_IN, 0, 7, true);
  ctx.clip();
  ctx.scale(1, 1 / s);                               // the shadow itself stays circular
  const sx = -lx * R * .30, sy = -ly * R * .30 * s;
  const g = ctx.createRadialGradient(sx, sy, R * .30, sx, sy, R * 1.5);
  g.addColorStop(0, "rgba(12,10,26,.62)");
  g.addColorStop(.55, "rgba(12,10,26,.30)");
  g.addColorStop(1, "rgba(12,10,26,0)");
  ctx.fillStyle = g; ctx.fillRect(-E, -E, 2 * E, 2 * E);
  ctx.restore();
}

function drawSaturn(ctx, r, B, lx, ly, o) {
  const s = Math.max(.06, Math.sin(clamp(o.tilt == null ? 22 : o.tilt, 1, 75) * DEG));
  const hi = o.quality === "high", E = r * R_OUT * 2;
  /* the ring is drawn in a rolled frame, so the light must be rolled too */
  const cr = Math.cos(-ROLL), sr = Math.sin(-ROLL);
  const rlx = lx * cr - ly * sr, rly = lx * sr + ly * cr;

  /* 1. the WHOLE ring, drawn once, behind everything. Drawing it in one
        pass instead of two halves is what keeps the ring tips seamless:
        two abutting fills leave an antialiasing line down the middle. */
  ctx.save(); ctx.rotate(ROLL);
  ringPaint(ctx, r, s, o.ground === "light");
  if (hi) castShadow(ctx, r, s, rlx, rly);
  ctx.restore();

  /* 2. the globe, opaque — it occludes the far half for free */
  sphere(ctx, r, B, lx, ly, o, "Saturn");

  ctx.save(); ctx.rotate(ROLL);
  /* 3. the ring's own shadow on the globe: a soft band just off the ring
        plane, away from the light. It must ramp in AND out — a hard
        leading edge reads as a cut across the globe, not as a shadow. */
  if (hi) {
    ctx.save();
    ctx.rotate(-ROLL); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip(); ctx.rotate(ROLL);
    const h = r * s * 1.6, y0 = rly < 0 ? -h * .15 : -h * .85;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, "rgba(10,8,22,0)");
    g.addColorStop(.30, "rgba(10,8,22,.26)");
    g.addColorStop(.62, "rgba(10,8,22,.19)");
    g.addColorStop(1, "rgba(10,8,22,0)");
    ctx.fillStyle = g; ctx.fillRect(-r, y0, 2 * r, h);
    ctx.restore();
  }

  /* 4. re-assert the NEAR half, but ONLY where it crosses the globe —
        the one place the globe wrongly covered it. The near/far boundary
        sits outside the globe's disc, so this clip hides it completely. */
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.beginPath(); ctx.rect(-E, 0, 2 * E, E); ctx.clip();
  ringPaint(ctx, r, s, o.ground === "light");
  ctx.restore();
}

/* ---- RAHU / KETU ----------------------------------------------------
   A node is a crossing point, not a body. This keeps skyview's identity
   (a ring, a centre mark, ticks on the node axis) and gives it depth: a
   solid tilted ring, a recessed well, the figure standing in the well,
   and the axis passing behind the ring above and in front of it below. */
function drawNode(ctx, r, B, lx, ly, o) {
  const hi = o.quality === "high", light = o.ground === "light";
  const asc = B.dir < 0;
  const ink = light ? "70,64,112" : "196,188,240";
  const axis = r * 1.18;

  /* axis, far end — drawn first so the ring passes IN FRONT of it */
  ctx.save();
  ctx.strokeStyle = rgba(B.rgb, light ? .55 : .62); ctx.lineWidth = Math.max(0.8, r * .038);
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -r * .80); ctx.lineTo(0, -axis); ctx.stroke();
  ctx.restore();

  /* the well: a recessed disc, dark at the inner edge nearest the light
     (which is what makes it read as concave rather than domed) */
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, 7); ctx.clip();
  const w = ctx.createRadialGradient(-lx * r * .5, -ly * r * .5, r * .05, 0, 0, r * .95);
  w.addColorStop(0, light ? "rgb(228,224,240)" : "rgb(30,28,54)");
  w.addColorStop(1, light ? "rgb(188,182,214)" : "rgb(12,11,26)");
  ctx.fillStyle = w; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  const ig = ctx.createRadialGradient(0, r * .1, r * .1, 0, r * .1, r * .9);
  ig.addColorStop(0, rgba(B.rgb, light ? .18 : .26));   // inner glow
  ig.addColorStop(1, rgba(B.rgb, 0));
  ctx.fillStyle = ig; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();

  /* the figure — drawn WHOLE, never clipped to a disc */
  const im = texture(asc ? "Rahu" : "Ketu");
  ctx.save();
  if (im) {
    /* contact shadow, a soft gradient rather than a flat ellipse: a
       hard-edged blob is the one thing that would make this look cheap */
    ctx.save(); ctx.translate(0, r * .34); ctx.scale(1, .34);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * .52);
    sh.addColorStop(0, "rgba(8,7,20,.36)"); sh.addColorStop(.55, "rgba(8,7,20,.20)");
    sh.addColorStop(1, "rgba(8,7,20,0)");
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, r * .52, 0, 7); ctx.fill();
    ctx.restore();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const F = (r * 1.30) / B.fill;
    ctx.drawImage(im, -F / 2, -F / 2 - r * .04, F, F);
  } else {                                           // art missing: a plain node mark
    ctx.fillStyle = rgba(B.rgb, .9);
    ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, 7); ctx.fill();
  }
  ctx.restore();

  /* the ring: a solid torus, lit on one side, shadowed on the other. The
     node axis threads behind it above and in front of it below, which is
     what turns a flat circle into a hoop in space. */
  ctx.save();
  const RR = r * .97, lw = Math.max(1.2, r * .11);
  const rg = ctx.createLinearGradient(lx * RR, ly * RR, -lx * RR, -ly * RR);
  rg.addColorStop(0, rgba(B.rgb, light ? .95 : 1));
  rg.addColorStop(.5, `rgba(${ink},${light ? .5 : .55})`);
  rg.addColorStop(1, light ? "rgba(70,64,112,.75)" : "rgba(58,52,104,.85)");
  ctx.strokeStyle = rg; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(0, 0, RR, 0, 7); ctx.stroke();
  if (hi) {
    ctx.strokeStyle = light ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.45)";
    ctx.lineWidth = Math.max(0.6, r * .026);         // inner bevel — the ring has thickness
    ctx.beginPath(); ctx.arc(0, 0, arcR(RR - lw * .52), 0, 7); ctx.stroke();
    /* the dashed orbit line from skyview's glyph, kept for identity —
       dropped at low quality, where dashes are only noise */
    ctx.setLineDash([r * .10, r * .10]); ctx.lineWidth = Math.max(0.6, r * .022);
    ctx.strokeStyle = rgba(B.rgb, light ? .5 : .62);
    ctx.beginPath(); ctx.arc(0, 0, r * .74, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();

  /* axis, near end + the direction cue: Rahu ascends, Ketu descends */
  ctx.save();
  ctx.strokeStyle = rgba(B.rgb, light ? .8 : .92); ctx.lineWidth = Math.max(0.9, r * .045);
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, r * .80); ctx.lineTo(0, axis); ctx.stroke();
  if (!asc) {                                        // Ketu keeps its cross ticks
    ctx.lineWidth = Math.max(0.7, r * .032);
    ctx.beginPath();
    ctx.moveTo(-r * .86, 0); ctx.lineTo(-r * 1.12, 0);
    ctx.moveTo(r * .86, 0); ctx.lineTo(r * 1.12, 0); ctx.stroke();
  }
  const cy = asc ? -axis : axis, k = asc ? -1 : 1, cw = r * .145;
  ctx.fillStyle = rgba(B.rgb, light ? .92 : 1);
  ctx.beginPath();
  ctx.moveTo(0, cy + k * r * .125);
  ctx.lineTo(-cw, cy - k * r * .04);
  ctx.lineTo(cw, cy - k * r * .04);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---- MOON PHASE -----------------------------------------------------
   Orientation matches app.js `moonPath(r,illum,waxing)` exactly: WAXING
   PUTS THE LIT LIMB ON THE RIGHT (northern-hemisphere convention). The
   terminator is a half-ellipse whose x-radius is r·|1-2·illum|, so it
   collapses to a straight line at the quarters. Waning is the same
   construction mirrored in x. Because the phase IS the lighting, the
   Moon takes its light direction from the phase, not from opts.light. */
function moonNight(ctx, r, illum, waxing, o) {
  const k = clamp(illum, 0, 1);
  ctx.save();
  if (!waxing) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);                                   // whole disc …
  ctx.moveTo(0, -r);                                        // … minus the lit region
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);       // right limb
  ctx.ellipse(0, 0, Math.max(r * Math.abs(2 * k - 1), 0.01), r,
              0, Math.PI / 2, 3 * Math.PI / 2, k < 0.5);    // terminator
  ctx.closePath();
  if (!waxing) ctx.scale(-1, 1);
  const g = ctx.createRadialGradient(0, -r * .2, r * .1, 0, 0, r);
  const A = o.ground === "light" ? [.90, .80] : [.93, .86];
  g.addColorStop(0, `rgba(14,16,34,${A[0]})`);
  g.addColorStop(1, `rgba(9,10,24,${A[1]})`);
  ctx.fillStyle = g; ctx.fill("evenodd");
  ctx.restore();
  /* earthshine: the unlit disc stays a body, not a hole */
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.globalCompositeOperation = "screen";
  const e = ctx.createRadialGradient(0, -r * .25, r * .05, 0, 0, r * 1.05);
  e.addColorStop(0, "rgba(96,116,168,.16)");
  e.addColorStop(1, "rgba(96,116,168,0)");
  ctx.fillStyle = e; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
}

/* ====================================================================
   PUBLIC API
   ==================================================================== */

/**
 * Draw a graha centred at (x,y) with body radius r.
 * Rings and coronas reach past r — see GRAHA_BASE[name].extent.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name  sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu
 * @param {object} opts
 *   light   {x,y}  screen-space light direction (default {x:-0.55,y:-0.6})
 *   phase   {illum:0..1, waxing:bool}   Moon only
 *   tilt    degrees, Saturn ring opening (default 22)
 *   spin    0..1, drifts the LIGHT (never the bitmap); caller animates it
 *   quality 'low'|'high'  (default: auto — 'low' under r≈26)
 *   focus   bool, a touch more glow when selected
 *   ground  'dark'|'light'  (default 'dark'; 'light' targets #F7F5EF)
 */
/* the caller's globalAlpha when drawGraha was entered: every alpha written
   below is relative to it, so a fading sky (skyview) or a ring at alpha sc
   (orrery) actually fades. Before this the renderer reset alpha to 1 and the
   orrery's Sun showed at full strength on a globe that was itself invisible —
   Sangram's 'two suns' (5 Sep). */
let BASE_A = 1;
export function drawGraha(ctx, name, x, y, r, opts = {}) {
  if (!ctx || !(r > 0)) return;
  BASE_A = ctx.globalAlpha;
  const n = nameOf(name), B = baseOf(name);
  const o = {
    quality: opts.quality || (r < 26 ? "low" : "high"),
    ground: opts.ground === "light" ? "light" : "dark",
    tilt: opts.tilt, spin: opts.spin, focus: !!opts.focus,
    light: opts.light, phase: opts.phase,
  };
  let [lx, ly] = lightVec(o);
  /* the Moon's light is its phase — otherwise the shading and the
     terminator would disagree and the sphere would fall apart */
  if (n === "Moon" && o.phase) { lx = o.phase.waxing ? 1 : -1; ly = 0; }

  ctx.save();
  ctx.translate(x, y);
  try {
    if (B.kind !== "star") halo(ctx, r, B, lx, ly, o);
    if (B.kind === "star") drawSun(ctx, r, B, lx, ly, o);
    else if (B.kind === "ringed") drawSaturn(ctx, r, B, lx, ly, o);
    else if (B.kind === "node") drawNode(ctx, r, B, lx, ly, o);
    else {
      sphere(ctx, r, B, lx, ly, o, n);
      if (n === "Moon" && o.phase) moonNight(ctx, r, o.phase.illum, !!o.phase.waxing, o);
    }
  } finally { ctx.restore(); }
}

/* ---- sprite cache ---------------------------------------------------
   Keyed by everything that changes the pixels. Capped and evicted FIFO
   because a 300px sprite at 3× DPR is ~3MB of backing store. */
const SPRITES = new Map();
const SPRITE_CAP = 48;

/**
 * A rendered, devicePixelRatio-aware HTMLCanvasElement for DOM heroes.
 * `sizePx` is the CSS box; the body is sized so rings/coronas fit inside.
 * Cached — call it freely.
 */
export function grahaSprite(name, sizePx, opts = {}) {
  const n = nameOf(name), B = baseOf(name);
  const q = opts.quality || (sizePx < 56 ? "low" : "high");
  const ground = opts.ground === "light" ? "light" : "dark";
  const ph = opts.phase ? `${Math.round(clamp(opts.phase.illum, 0, 1) * 48)}${opts.phase.waxing ? "w" : "n"}` : "-";
  const key = `${n}|${sizePx}|${q}|${ph}|${ground}|${opts.tilt == null ? "-" : opts.tilt}|${opts.focus ? 1 : 0}|${opts.spin ? Math.round(opts.spin * 60) : 0}`;
  const hit = SPRITES.get(key);
  if (hit) return hit;

  const dpr = (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1) || 1;
  const c = document.createElement("canvas");
  c.width = Math.round(sizePx * dpr); c.height = Math.round(sizePx * dpr);
  c.style.width = c.style.height = sizePx + "px";
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  drawGraha(ctx, n, sizePx / 2, sizePx / 2, (sizePx / 2) / B.extent,
            { ...opts, quality: q, ground });

  if (SPRITES.size >= SPRITE_CAP) SPRITES.delete(SPRITES.keys().next().value);
  SPRITES.set(key, c);
  return c;
}
