/* ==========================================================================
   Tonight's sky, drawn from the real thing.

   The stars here are the twenty-seven nakshatras — the Vedic star groups, not
   the Greek constellations — from the same verified catalogue the app's sky
   view uses (right ascension, declination and magnitude per star, J2000).
   Every star and every graha is placed by converting its real coordinates to
   altitude and azimuth for this minute at the viewer's chosen place. Nothing
   on this canvas is decorative: if a graha is below the horizon right now,
   it is drawn below the horizon, and the label says so.

   The camera is a gnomonic projection — the projection you get by holding a
   flat plane against the sky and looking through it, which keeps straight
   lines straight near the centre. Drag or use the arrow keys to turn.
   ========================================================================== */
import { ASTERISMS } from "../vendor/astro/asterisms.js";
import { altAz, raDecToAltAz, siderealPointAltAz } from "../vendor/astro/sky.js";

/* The twelve rashis, and the artwork the app draws them with. These are the
   same plates the app's sky view uses — translucent starlight sculpture, one
   per sign — so the band overhead here is the band the app shows. */
const RASHI = [
  ["Mesha","Aries"], ["Vrishabha","Taurus"], ["Mithuna","Gemini"], ["Karka","Cancer"],
  ["Simha","Leo"], ["Kanya","Virgo"], ["Tula","Libra"], ["Vrischika","Scorpio"],
  ["Dhanu","Sagittarius"], ["Makara","Capricorn"], ["Kumbha","Aquarius"], ["Meena","Pisces"]
];

const D = Math.PI / 180;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const norm360 = a => ((a % 360) + 360) % 360;
const shortest = (from, to) => { let d = norm360(to - from); return d > 180 ? d - 360 : d; };

export function createSkyField(canvas, opts = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let place = opts.place ?? { name: "London", lat: 51.5074, lon: -0.1278 };
  let when = opts.when ?? new Date();
  let target = null;                       /* the graha being shown, if any */
  let cam = { az: 180, alt: 24 }, aim = { az: 180, alt: 24 };
  let fov = opts.fov ?? 74;                /* degrees across the taller axis */
  /* the seven that can be seen, drawn wherever they stand, when asked for all of them */
  const ALL = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const allArt = {};
  if (opts.all) for (const g of ALL) { const im = new Image(); im.src = opts.art ? opts.art(g) : `assets/graha/${g.toLowerCase()}.png`;
    im.addEventListener("load", () => { dirty = true; kick(); }); allArt[g] = im; }

  /* The land: the app's own approved horizon panorama (assets/gen/land-day). One strip
     is 90° of azimuth, four tiles wrap the viewer with alternate tiles mirrored so every
     seam meets itself, and the image row at LEYE sits on the true horizon — the same
     rules skyview.js uses. Drawn in slices of azimuth, each a parallelogram between the
     horizon and a row 30° below it (and 26° above, for the peaks), then tinted for the
     night in one pass so the ground reads as ground, not as a daytime postcard. */
  let land = null, LW = 0, LH = 0;
  const LEYE = .46, LSLICE = 2, LAND_UP = 26, LAND_DOWN = 30, LPAD = 14;
  if (opts.land) { const im = new Image(); im.src = opts.land;
    im.addEventListener("load", () => {
      /* baked once with mirrored columns either side, so a slice at a tile seam can
         read a little past the edge and meet its mirrored neighbour without a gap */
      LW = im.naturalWidth; LH = im.naturalHeight;
      const cv = document.createElement("canvas"); cv.width = LW + 2 * LPAD; cv.height = LH;
      const g = cv.getContext("2d");
      g.drawImage(im, LPAD, 0);
      g.save(); g.translate(LPAD, 0); g.scale(-1, 1); g.drawImage(im, 0, 0, LPAD, LH, 0, 0, LPAD, LH); g.restore();
      g.save(); g.translate(LW + 2 * LPAD, 0); g.scale(-1, 1); g.drawImage(im, LW - LPAD, 0, LPAD, LH, 0, 0, LPAD, LH); g.restore();
      /* the lowest rows fade out, so the strip melts into the earth colour beneath it
         rather than ending on a line when the view tilts down (skyview.js does the same) */
      const fd = g.createLinearGradient(0, LH * .84, 0, LH); fd.addColorStop(0, "rgba(0,0,0,0)"); fd.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-out"; g.fillStyle = fd; g.fillRect(0, LH * .84, cv.width, LH * .16);
      g.globalCompositeOperation = "source-over";
      land = cv; dirty = true; kick(); }); }
  let off = null;
  function drawLand() {
    if (!land) return;
    if (!off) off = document.createElement("canvas");
    if (off.width !== canvas.width || off.height !== canvas.height) { off.width = canvas.width; off.height = canvas.height; }
    const g = off.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = LW, h = LH, ppd = w / 90, eye = LEYE * h;
    const slab = (a0, a1, altA, altB, sy, sh) => {
      /* the quad between azimuths a0..a1 at altitudes altA (near the horizon) and altB */
      const p0 = project(a0, altA), p1 = project(a1, altA), q0 = project(a0, altB), q1 = project(a1, altB);
      if (!p0 || !p1 || !q0 || !q1) return;
      const t = Math.floor(a0 / 90), u0 = (a0 - 90 * t) * ppd, u1 = u0 + LSLICE * ppd;
      const x0 = LPAD + ((t & 1) ? w - u0 : u0), x1 = LPAD + ((t & 1) ? w - u1 : u1);
      const dx = x1 - x0;
      /* affine: source (x, y) → screen, x along the horizon, y down the slope */
      const a = (p1[0] - p0[0]) / dx, b = (p1[1] - p0[1]) / dx;
      const c = (q0[0] - p0[0]) / (sh * (altB < altA ? 1 : -1)), d = (q0[1] - p0[1]) / (sh * (altB < altA ? 1 : -1));
      /* clipped to its own quad, grown by a pixel so the anti-aliased edges of neighbours
         overlap rather than leave a hairline; without the clip the transformed rectangle
         overshoots the far edge and the skyline grows teeth at steep angles */
      const cx = (p0[0] + p1[0] + q0[0] + q1[0]) / 4, cy = (p0[1] + p1[1] + q0[1] + q1[1]) / 4;
      const grow = (pt) => { const vx = pt[0] - cx, vy = pt[1] - cy, l = Math.hypot(vx, vy) || 1; return [pt[0] + vx / l * 1.2, pt[1] + vy / l * 1.2]; };
      const [G0, G1, G2, G3] = [p0, p1, q1, q0].map(grow);
      g.save();
      g.beginPath(); g.moveTo(G0[0], G0[1]); g.lineTo(G1[0], G1[1]); g.lineTo(G2[0], G2[1]); g.lineTo(G3[0], G3[1]); g.closePath(); g.clip();
      g.transform(a, b, c, d, p0[0] - a * x0 - c * eye, p0[1] - b * x0 - d * eye);
      const xl = Math.min(x0, x1) - 10, sw = Math.abs(dx) + 20;
      g.drawImage(land, xl, sy, sw, sh, xl, sy, sw, sh);
      g.restore();
    };
    /* below the panorama's lowest row the ground polygon's own colour carries on to the
       nadir — the same earth the strip fades into, so looking down never finds the sky */
    for (let a0 = 0; a0 < 360; a0 += LSLICE) {
      const a1 = a0 + LSLICE;
      slab(a0, a1, 0, -LAND_DOWN, eye - 8, h - eye + 8);    /* the ground below the line … */
      slab(a0, a1, 0, LAND_UP, 0, eye + 8);                 /* … then the peaks over its top edge */
    }
    /* one tint over the whole land: deep at night, almost none by day */
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(12,16,40,${(.74 * (1 - dayK) + .08 * dayK).toFixed(3)})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); ctx.restore();
  }
  let raf = 0, dirty = true;

  /* the rashi plates, loaded only if this field is asked to show the zodiac */
  const rashiArt = [];
  if (opts.zodiac) RASHI.forEach(([sans], i) => {
    const im = new Image();
    im.src = `assets/rashi/${sans.toLowerCase()}.png`;
    im.addEventListener("load", () => { dirty = true; kick(); });
    rashiArt[i] = im;
  });

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true; kick();
  }

  /* gnomonic: sky point → screen, or null when it falls behind the camera */
  function project(az, alt) {
    const a0 = cam.alt * D, a1 = alt * D, dz = (az - cam.az) * D;
    const cosc = Math.sin(a0) * Math.sin(a1) + Math.cos(a0) * Math.cos(a1) * Math.cos(dz);
    if (cosc <= .12) return null;
    const f = (H / 2) / Math.tan(fov / 2 * D);
    const x = Math.cos(a1) * Math.sin(dz) / cosc;
    const y = (Math.cos(a0) * Math.sin(a1) - Math.sin(a0) * Math.cos(a1) * Math.cos(dz)) / cosc;
    return [W / 2 + x * f, H / 2 - y * f];
  }

  /* how much of a day it is: the Sun's altitude, eased between civil dusk and full sun */
  let dayK = 0;
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgb = c => `rgb(${c.join(",")})`;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const sunAlt = altAz("Sun", when, place.lat, place.lon).alt;
    dayK = Math.max(0, Math.min(1, (sunAlt + 6) / 14)); dayK = dayK * dayK * (3 - 2 * dayK);

    /* the ground: everything below altitude zero, so the horizon is real */
    /* walked from directly behind the camera round to behind it again, so the visible
       arc is one run of points — started at 0° it wrapped mid-screen whenever the view
       faced north, the polygon crossed itself, and the ground came out sky-coloured */
    const horizon = [];
    for (let a = cam.az - 180; a <= cam.az + 180; a += 2) { const p = project(norm360(a), 0); if (p) horizon.push(p); }
    /* the sky's own gradient — zenith, middle, horizon — the app's night keys
       (skyview.js SKY_KEYS), lifting to its day blue as the Sun comes up. */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   rgb(mix([3, 4, 14],   [52, 110, 190], dayK)));
    sky.addColorStop(.58, rgb(mix([13, 17, 44], [120, 170, 226], dayK)));
    sky.addColorStop(1,   rgb(mix([26, 30, 66], [190, 214, 240], dayK)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    if (horizon.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(horizon[0][0], horizon[0][1]);
      for (const p of horizon) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(horizon[horizon.length - 1][0], H + 40);
      ctx.lineTo(horizon[0][0], H + 40);
      ctx.closePath();
      ctx.fillStyle = rgb(mix([9, 10, 18], [58, 70, 46], dayK));
      ctx.fill();
      ctx.restore();
      if (land) drawLand();
      else {
        ctx.beginPath();
        ctx.moveTo(horizon[0][0], horizon[0][1]);
        for (const p of horizon) ctx.lineTo(p[0], p[1]);
        ctx.strokeStyle = "rgba(255,255,255,.24)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    /* the compass, written on the horizon where it actually lies */
    ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,.4)";
    for (let i = 0; i < 8; i++) {
      const p = project(i * 45, 0);
      if (p && p[0] > 14 && p[0] < W - 14) ctx.fillText(COMPASS[i], p[0], p[1] + 20);
    }

    /* THE ZODIAC — the ecliptic, the twelve rashis along it, and their artwork.
       This is the belt the grahas never leave, so it is the one line on the sky
       worth drawing. Colours are the app's: brass at night (skyview.js). */
    if (opts.zodiac) {
      const ecl = [];
      for (let l = 0; l <= 360; l += 3) {
        const { alt, az } = siderealPointAltAz(l % 360, when, place.lat, place.lon);
        ecl.push({ p: project(az, alt), alt });
      }
      ctx.lineWidth = 26;
      ctx.strokeStyle = "rgba(194,155,78,.10)";
      ctx.beginPath();
      let pen = false;
      for (const e of ecl) {
        if (!e.p || (land && e.alt < -2)) { pen = false; continue; }
        pen ? ctx.lineTo(e.p[0], e.p[1]) : ctx.moveTo(e.p[0], e.p[1]);
        pen = true;
      }
      ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(214,180,110,.30)";
      ctx.stroke();

      for (let s = 0; s < 12; s++) {
        const mid = s * 30 + 15;
        const { alt, az } = siderealPointAltAz(mid, when, place.lat, place.lon);
        const p = project(az, alt);
        if (!p) continue;
        const img = rashiArt[s];
        if (land && alt < -4) continue;                     /* the ground is opaque */
        if (img?.complete && img.naturalWidth) {
          /* size by the HEIGHT of the belt, not the frame's short side: a tall
             plate sized off its width grows until one sign fills the sky */
          const h = Math.min(H, W) * (opts.all ? .27 : .34), w = h * (img.naturalWidth / img.naturalHeight);
          ctx.save();
          ctx.globalAlpha = alt < -6 ? .10 : opts.all ? .19 : .24;
          ctx.drawImage(img, p[0] - w / 2, p[1] - h / 2, w, h);
          ctx.restore();
        }
        ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = alt < -6 ? "rgba(214,180,110,.28)" : "rgba(226,196,136,.72)";
        ctx.fillText(RASHI[s][0].toUpperCase(), p[0], p[1] + 4);
        ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = alt < -6 ? "rgba(214,180,110,.2)" : "rgba(226,196,136,.5)";
        ctx.fillText(RASHI[s][1], p[0], p[1] + 17);
      }
    }

    /* the twenty-seven nakshatras */
    for (const ast of ASTERISMS) {
      const pts = ast.stars.map(s => {
        const { alt, az } = raDecToAltAz(s.ra, s.dec, when, place.lat, place.lon);
        return { p: project(az, alt), m: s.m, alt };
      });
      ctx.strokeStyle = `rgba(255,255,255,${(.16 * (1 - dayK)).toFixed(3)})`; ctx.lineWidth = 1;
      for (const [i, j] of ast.lines) {
        const a = pts[i]?.p, b = pts[j]?.p;
        if (!a || !b || (land && (pts[i].alt < -1 || pts[j].alt < -1))) continue;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (const s of pts) {
        if (!s.p) continue;
        const r = Math.max(.9, 3.1 - s.m * .42);
        if (land && s.alt < -1) continue;                           /* nothing shines through the ground */
        const dim = (s.alt < 0 ? .22 : 1) * (1 - dayK * .92);      /* stars go with the day */
        ctx.beginPath(); ctx.arc(s.p[0], s.p[1], r, 0, 7);
        ctx.fillStyle = `rgba(255,255,255,${(.55 + (4.6 - s.m) * .11) * dim})`;
        ctx.fill();
      }
      /* name the junction star's group, quietly */
      const y = pts[ast.yogatara]?.p;
      if (y && pts[ast.yogatara].alt > -2) {
        ctx.font = "500 10.5px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.fillText(ast.nak, y[0], y[1] - 11);
      }
    }

    /* every graha, at its real place — the one under discussion drawn larger below */
    if (opts.all) for (const g of ALL) {
      if (target && target.graha === g) continue;
      const { alt, az } = altAz(g, when, place.lat, place.lon);
      const p = project(az, alt);
      if (!p) continue;
      const img = allArt[g], s = g === "Sun" || g === "Moon" ? 40 : g === "Jupiter" || g === "Saturn" ? 36 : 30;
      ctx.save();
      ctx.globalAlpha = alt < 0 ? .28 : 1;
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, p[0] - s / 2, p[1] - s / 2, s, s);
      ctx.font = "600 11.5px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.textAlign = "center";
      ctx.fillText(g, p[0], p[1] + s / 2 + 15);
      ctx.restore();
    }

    /* the graha under discussion */
    if (target) {
      const { alt, az } = altAz(target.graha, when, place.lat, place.lon);
      const p = project(az, alt);
      if (p) {
        const img = target.img, s = 62;
        ctx.save();
        ctx.beginPath(); ctx.arc(p[0], p[1], 46, 0, 7);
        const glow = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], 46);
        glow.addColorStop(0, "rgba(255,255,255,.16)"); glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow; ctx.fill();
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, p[0] - s / 2, p[1] - s / 2, s, s);
        ctx.restore();
        ctx.font = "600 14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#fff"; ctx.textAlign = "center";
        ctx.fillText(target.graha, p[0], p[1] + s / 2 + 22);
        ctx.font = "500 11.5px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = "rgba(255,255,255,.6)";
        const dir = COMPASS[Math.round(norm360(az) / 45) % 8];
        ctx.fillText(alt >= 0 ? `${alt.toFixed(0)}° above the horizon · ${dir}`
                              : `${Math.abs(alt).toFixed(0)}° below the horizon · ${dir}`, p[0], p[1] + s / 2 + 40);
      }
      opts.onReadout?.(readout());
    }
  }

  function readout() {
    if (!target) return null;
    const { alt, az } = altAz(target.graha, when, place.lat, place.lon);
    return { graha: target.graha, alt, az, up: alt >= 0,
             compass: COMPASS[Math.round(norm360(az) / 45) % 8], place: place.name };
  }

  /* the camera eases toward what it was asked to look at */
  function step() {
    const da = shortest(cam.az, aim.az), dl = aim.alt - cam.alt;
    if (Math.abs(da) < .05 && Math.abs(dl) < .05 && !dirty) { raf = 0; cam.az = aim.az; cam.alt = aim.alt; draw(); return; }
    cam.az = norm360(cam.az + da * (reduce ? 1 : .12));
    cam.alt += dl * (reduce ? 1 : .12);
    dirty = false;
    draw();
    raf = requestAnimationFrame(step);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

  /* look at a graha: turn to it, and lift the eye if it sits low */
  function show(graha, img) {
    target = { graha, img };
    const { alt, az } = altAz(graha, when, place.lat, place.lon);
    aim.az = norm360(az);
    aim.alt = Math.max(4, Math.min(72, alt));
    if (reduce) { cam.az = aim.az; cam.alt = aim.alt; }
    dirty = true; kick();
    return readout();
  }

  /* drag, and arrow keys, both turning the same camera */
  let drag = null;
  canvas.addEventListener("pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, az: aim.az, alt: aim.alt };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const k = fov / H;
    aim.az = norm360(drag.az - (e.clientX - drag.x) * k);
    aim.alt = Math.max(-28, Math.min(86, drag.alt + (e.clientY - drag.y) * k));
    cam.az = aim.az; cam.alt = aim.alt;   /* dragging is direct, not eased */
    dirty = true; kick();
  });
  const drop = () => { drag = null; };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  canvas.addEventListener("keydown", e => {
    const step = e.shiftKey ? 12 : 5;
    if (e.key === "ArrowLeft") aim.az = norm360(aim.az - step);
    else if (e.key === "ArrowRight") aim.az = norm360(aim.az + step);
    else if (e.key === "ArrowUp") aim.alt = Math.min(86, aim.alt + step);
    else if (e.key === "ArrowDown") aim.alt = Math.max(-28, aim.alt - step);
    else return;
    e.preventDefault(); dirty = true; kick();
  });

  addEventListener("resize", resize, { passive: true });
  resize();

  /* Which graha stands highest over this place right now — the one worth opening
     on, so the act does not land on something below the horizon. Rahu and Ketu are
     excluded here: they are the Moon's orbital nodes, computed points with nothing
     to see, and "now look up" pointing at one would be a small lie. They stay
     pickable, and say what they are when picked. */
  const VISIBLE = ["Jupiter", "Saturn", "Mars", "Venus", "Mercury", "Moon", "Sun"];
  function highest() {
    let best = null;
    for (const g of VISIBLE) {
      const { alt } = altAz(g, when, place.lat, place.lon);
      if (!best || alt > best.alt) best = { graha: g, alt };
    }
    return best.graha;
  }

  /* turn the camera so as many of the seven as possible are in the frame at once:
     the circular mean of the azimuths of those above the horizon, at a modest
     elevation, with the field opened wide */
  function frameAll(immediate = false) {
    let sx = 0, sy = 0, sa = 0, n = 0;
    for (const g of ALL) {
      const { alt, az } = altAz(g, when, place.lat, place.lon);
      if (alt < -4) continue;
      const w = 1 + Math.max(0, alt) / 60;
      sx += Math.cos(az * D) * w; sy += Math.sin(az * D) * w; sa += alt * w; n += w;
    }
    /* the eye stays low enough that the ground is always in the frame */
    if (n) { aim.az = norm360(Math.atan2(sy, sx) / D); aim.alt = Math.max(12, Math.min(24, sa / n * .5)); }
    else { aim.az = 180; aim.alt = 18; }
    target = null;
    if (immediate || reduce) { cam.az = aim.az; cam.alt = aim.alt; }
    dirty = true; kick();
  }

  /* where a graha is on this canvas right now, in CSS pixels — for anything that
     wants to fly a picture of it into place */
  function screenPos(graha) {
    const { alt, az } = altAz(graha, when, place.lat, place.lon);
    const p = project(az, alt);
    return p ? { x: p[0], y: p[1], alt, az } : null;
  }

  return {
    show, highest, frameAll, screenPos,
    setFov(f) { fov = f; dirty = true; kick(); },
    get camera() { return { ...aim }; },
    /* resize() clears the backing store, and the repaint it schedules only
       happens on the next animation frame — which never arrives while the tab
       is in the background. Painting once, synchronously, means the sky is
       already there the moment it is shown. */
    resize() { resize(); cam.az = aim.az; cam.alt = aim.alt; draw(); },
    setPlace(p) { place = p; dirty = true; kick(); },
    setWhen(d) { when = d; dirty = true; kick(); },
    get readout() { return readout(); }
  };
}
