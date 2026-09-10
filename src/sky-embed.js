/* The real sky, on the website.

   "The sky above you" opens the app's own immersive sky — vendor/astro/skyview.js, the same
   module the app runs (vendored by tools/sync-engine.mjs): the camera, the zodiac figures,
   the time seeker, pinch/wheel zoom that keeps going past the widest field until the ground
   falls away into the Earth and the orrery, and "follow my phone".

     import { openRealSky, closeRealSky, preloadRealSky } from "./sky-embed.js";
     openRealSky({ lat: 19.076, lon: 72.8777, name: "Mumbai", tz: "Asia/Kolkata" });

   Nothing here reaches into the sky's internals. Everything is done from outside: the
   stylesheet is injected once, the module is imported on first use, the page underneath is
   locked and made inert while the sky is up and restored exactly when it goes (by ✕,
   Escape, the Back button, or closeRealSky()), and the arrow keys are translated into the
   gestures the sky already understands — a drag to look around, a wheel step to zoom, and
   the time seeker's own ↑/↓. */

const CSS_URL = new URL("../sky.css", import.meta.url).href;
const SKY_URL = new URL("../vendor/astro/skyview.js", import.meta.url).href;

let cssReady = null, skyReady = null;
let S = null;                 /* the open session, or null */
let quietEvents = false;

function loadCss() {
  if (cssReady) return cssReady;
  cssReady = new Promise(resolve => {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = CSS_URL; l.setAttribute("data-skyview-css", "");
    l.onload = () => resolve();
    l.onerror = () => { cssReady = null; l.remove(); resolve(); };   /* retry next time; open anyway */
    document.head.appendChild(l);
  });
  return cssReady;
}
function loadSky() {
  if (!skyReady) skyReady = import(SKY_URL).catch(e => { skyReady = null; throw e; });
  return skyReady;
}

/* Warm the stylesheet and the module (≈200 KB of engine) before the first tap —
   call it when the sky section scrolls near, or on pointerenter of the button. */
export function preloadRealSky() { return Promise.all([loadCss(), loadSky()]).then(() => {}); }

export function isRealSkyOpen() { return !!S; }

/* The sky announces three app-only intents on window: astra:open (a detail page),
   astra:openhouse (the birth chart) and astra:pro (the paywall — never sent here, since
   the site opens the sky with pro:true). The site has none of those destinations; the
   listeners are deliberate no-ops so the intents are known to be handled. */
const ignore = () => {};

/**
 * Open the app's real sky, full screen, for a place.
 * @param {{lat:number, lon:number, name?:string, tz?:string, quiet?:boolean, onClose?:()=>void}} o
 *   tz is an IANA zone ("Asia/Kolkata"); without it the visitor's own clock is used.
 *   quiet (default true) turns off the sky's own toasts and hint sequence and its
 *   automatic phone-follow on Android; a hint of ours is shown instead.
 * @returns {Promise<void>} resolves once the sky is on screen.
 */
export async function openRealSky({ lat, lon, name, tz, quiet = true, onClose } = {}) {
  if (!Number.isFinite(+lat) || !Number.isFinite(+lon)) throw new TypeError("openRealSky: lat and lon are required");
  if (S) return;
  const token = { opener: document.activeElement, onClose, scroll: [scrollX, scrollY] };
  S = token;
  let mod;
  try { [, mod] = await Promise.all([loadCss(), loadSky()]); }
  catch (e) { if (S === token) S = null; throw e; }
  if (S !== token) return;                                 /* closed while it was loading */

  if (!quietEvents) { for (const t of ["astra:open", "astra:openhouse", "astra:pro"]) addEventListener(t, ignore); quietEvents = true; }

  const de = document.documentElement, body = document.body;
  token.overflow = [de.style.overflow, body.style.overflow];
  de.style.overflow = "hidden"; body.style.overflow = "hidden";   /* the sky's wheel listener is passive: without this the page scrolls under it */

  mod.openSkyView({ lat: +lat, lon: +lon, from: name || "your location", tz: tz || undefined,
                    at: new Date().toISOString(), pro: true, quiet });
  const root = document.getElementById("skyview");
  token.mod = mod; token.root = root;
  root.classList.add("skyembed");

  /* the page underneath is out of reach of Tab and VoiceOver while the sky is up —
     only the elements WE made inert are released afterwards */
  token.inert = [...body.children].filter(n => n !== root && !n.inert && !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(n.tagName));
  token.inert.forEach(n => { n.inert = true; });

  /* the sky closes itself on ✕, Escape and Back; follow it rather than wrap it */
  token.mo = new MutationObserver(() => { if (!root.classList.contains("on")) finish(token); });
  token.mo.observe(root, { attributes: true, attributeFilter: ["class"] });

  addEventListener("keydown", onKey, true);
  showHint(token);
}

/* Close the sky from outside (it closes itself on ✕ / Escape / Back). */
export function closeRealSky() {
  const s = S; if (!s) return;
  if (!s.mod) { S = null; return; }                        /* still loading: the open just stops */
  s.mod.closeSkyView();
  finish(s);
  if (history.state && history.state.sky) history.back(); /* drop the entry the sky pushed; its popstate finds the sky closed */
}

function finish(s) {
  if (S !== s) return;
  S = null;
  s.mo && s.mo.disconnect();
  removeEventListener("keydown", onKey, true);
  clearTimeout(s.hintT);
  if (s.hint) s.hint.remove();
  (s.inert || []).forEach(n => { n.inert = false; });
  const de = document.documentElement, body = document.body;
  if (s.overflow) { de.style.overflow = s.overflow[0]; body.style.overflow = s.overflow[1]; }
  /* Back (or the sky's own history.back()) may restore a scroll position late; put the
     page back where the visitor left it, and stop once it is there */
  const [x, y] = s.scroll;
  const put = () => { if (!S && (Math.abs(scrollX - x) > 1 || Math.abs(scrollY - y) > 1)) scrollTo(x, y); };
  put(); requestAnimationFrame(put); setTimeout(put, 150);
  /* focus goes back to whatever opened the sky (the sky tries too, but the page was still
     inert when it did) */
  const a = document.activeElement;
  if (s.opener && s.opener.isConnected && s.opener !== document.body &&
      (!a || a === document.body || (s.root && s.root.contains(a)))) {
    try { s.opener.focus({ preventScroll: true }); } catch (_) {}
  }
  if (s.onClose) { try { s.onClose(); } catch (e) { console.error(e); } }
}

/* ---- keys ---------------------------------------------------------------------------
   ← →        look around (in the orrery: turn the Earth)        Shift = a bigger step
   ↑ ↓        move through time, 15 minutes (Shift: an hour) — the seeker's own keys
   Alt+↑ ↓    look up / down            PageUp / PageDown  the same
   +  −       zoom in / out (keep zooming out: the ground falls away to the Earth)
   The sky itself only answers Escape and, on its focused seeker, ↑/↓. Everything else is
   delivered as the input the sky already handles, so its own easing, limits and orrery
   behaviour apply unchanged. */
function onKey(e) {
  const s = S; if (!s || !s.root || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
  const root = s.root; if (!root.classList.contains("on")) return;
  const seek = root.querySelector("#svseek"), t = e.target;
  if (t === seek) return;                                  /* the seeker's own ↑/↓, and ours forwarded to it */
  if (t instanceof Element && t.closest("input,textarea,select,[contenteditable],.sklayers,.sksearch,.svedit")) return;
  for (const q of ["#svlayers", "#svsearch", "#svedit"]) { const n = root.querySelector(q); if (n && !n.hidden) return; }
  const k = e.key, big = e.shiftKey ? 3 : 1;
  if (k === "ArrowLeft" || k === "ArrowRight") look(s, (k === "ArrowRight" ? -1 : 1) * big, 0);
  else if ((k === "ArrowUp" || k === "ArrowDown") && e.altKey) look(s, 0, (k === "ArrowUp" ? 1 : -1) * big);
  else if (k === "PageUp" || k === "PageDown") look(s, 0, k === "PageUp" ? 2 : -2);
  else if (k === "ArrowUp" || k === "ArrowDown") {
    if (!seek) return;
    seek.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
  }
  else if (k === "+" || k === "=") zoom(s, -1);
  else if (k === "-" || k === "_") zoom(s, 1);
  else return;
  e.preventDefault(); e.stopPropagation();
  dismissHint(s);
}

/* a short drag through the middle of the sky: the same path a finger takes. Over 10 px,
   so the sky never reads it as a tap-to-select. */
let ptr = 7000;
function look(s, sx, sy) {
  const c = s.root.querySelector("#svc"); if (!c || typeof PointerEvent !== "function") return;
  const r = c.getBoundingClientRect(), step = Math.max(28, Math.min(r.width, r.height) * 0.07);
  const x = r.left + r.width / 2, y = r.top + r.height / 2, dx = sx * step, dy = sy * step;
  const id = ptr = ptr >= 7999 ? 7000 : ptr + 1;
  const fire = (type, px, py) => c.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: "mouse", isPrimary: false, clientX: px, clientY: py, bubbles: true, cancelable: true }));
  fire("pointerdown", x, y); fire("pointermove", x + dx, y + dy); fire("pointerup", x + dx, y + dy);
}
function zoom(s, dir) {
  const c = s.root.querySelector("#svc"); if (!c) return;
  for (let i = 0; i < 2; i++) c.dispatchEvent(new WheelEvent("wheel", { deltaY: dir * 100, bubbles: true, cancelable: true }));
}

/* ---- the hint: the one thing a visitor would not discover on their own ---- */
function showHint(s) {
  const touch = matchMedia("(pointer: coarse)").matches;
  const h = document.createElement("div");
  h.className = "skembedhint"; h.setAttribute("role", "status");
  h.innerHTML = touch
    ? "Pinch to zoom · <b>keep pinching in</b> and the ground falls away to the Earth<br>Tap the arrow to follow your phone around the sky"
    : "Scroll to zoom · <b>keep zooming out</b> and the ground falls away to the Earth<br><kbd>←</kbd><kbd>→</kbd> look around · <kbd>↑</kbd><kbd>↓</kbd> move through time · <kbd>+</kbd><kbd>−</kbd> zoom";
  s.root.appendChild(h); s.hint = h;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (S === s) h.classList.add("in"); }));
  s.hintT = setTimeout(() => dismissHint(s), 7000);
  const early = () => { s.root.removeEventListener("pointerdown", early); s.hintT2 = setTimeout(() => dismissHint(s), 1600); };
  s.root.addEventListener("pointerdown", early);
}
function dismissHint(s) {
  const h = s.hint; if (!h || !h.classList.contains("in")) return;
  h.classList.remove("in");
  setTimeout(() => { if (s.hint === h) { h.remove(); s.hint = null; } }, 500);
}
