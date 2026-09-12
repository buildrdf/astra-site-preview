/* ==========================================================================
   A book that opens where it stands.

   Each sheet is cut into three vertical slices, nested so that each turns
   about the edge of the one before it. Turning a sheet rotates the first
   slice while the outer two lead it by a few degrees, so the page bends as it
   lifts. A turned sheet does not lie flat on the left: it comes to rest
   standing at a little past ninety degrees, so what is seen on the left is
   a slim, curled stack of pages seen edge-on — never a second full page, and
   never any text.

     mountBook(article, {
       cover:  <img>                        the cover, the front of sheet 0
       sheets: [{ front: () => Node, name }, …]   one page of content each
       base:   () => Node                   what shows once every sheet has turned
       touch:  boolean
     })

   Nothing opens on hover. The cover carries a "Click to open" pill; a click
   opens it, a click on the right-hand page turns forward, a click on the
   stack turns back, Escape or a click elsewhere closes the book.
   ========================================================================== */
const SL = 3;                  /* slices per sheet */
const DELTA = 7;               /* how far the free edge leads, in degrees */
const REST = 106;              /* where a turned sheet comes to rest, degrees past the spine */
const FAN = 2.5;               /* each further sheet stands a little further over */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const ease = t => 1 - Math.pow(1 - t, 3);                  /* a page is pushed, then it glides */

/* the three slice angles for a sheet turned through `a` degrees */
const angles = a => { const b = Math.sin(Math.min(a, 180) * Math.PI / 180);
  return [a - (SL - 1) * DELTA * b, ...Array(SL - 1).fill(DELTA * b)]; };
/* per-slice keyframes: from angle a0 to a1 */
function frames(a0, a1) {
  const N = 30, out = Array.from({ length: SL }, () => []);
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + (a1 - a0) * ease(t);
    angles(a).forEach((v, k) => out[k].push({ transform: `rotateY(${(-v).toFixed(3)}deg)`, offset: t }));
  }
  return out;
}

export function mountBook(book, { cover, sheets, base, touch }) {
  const n = sheets.length + 1;                       /* the cover is sheet 0 */
  const bk = el("div", "bk");
  const baseEl = el("div", "bk-base");
  bk.append(baseEl);

  const SHEETS = [{ front: null, name: "Cover", isCover: true }, ...sheets];
  const rows = SHEETS.map((sh, i) => {
    const sheet = el("div", "bk-sheet");
    let parent = sheet;
    const slices = [];
    for (let k = 0; k < SL; k++) {
      const slice = el("div", "bk-slice");
      const front = el("div", "bk-face front"), back = el("div", "bk-face back");
      const fpg = el("div", "bk-pg"); fpg.style.left = `${-k * 100}%`;
      const fsh = el("i", "bk-shade"); fsh.style.left = fpg.style.left;
      front.append(fpg, fsh);
      if (sh.isCover) { front.classList.add("is-cover"); back.classList.add("is-inside"); }
      slice.append(front, back);
      parent.append(slice); parent = slice;
      slices.push({ slice, fpg, fsh });
    }
    bk.append(sheet);
    return { sheet, slices, sh, built: false, turned: false, i, rest: REST + i * FAN };
  });

  const build = row => {
    if (row.built) return; row.built = true;
    for (const { fpg } of row.slices) {
      if (row.sh.isCover) { const im = cover.cloneNode(); im.alt = ""; fpg.append(im); }
      else if (row.sh.front) fpg.append(row.sh.front());
    }
  };
  let baseBuilt = false;
  const buildBase = () => { if (baseBuilt) return; baseBuilt = true; if (base) baseEl.append(base()); };

  /* resting placement: the unturned pile flat on the right, the turned ones standing on the left */
  function settle() {
    for (const r of rows) {
      const z = r.turned ? r.i + 1 : n - r.i;
      r.sheet.style.transform = `translateZ(${(z * .6).toFixed(1)}px)`;
      r.sheet.style.zIndex = String(z);
      const a = r.turned ? angles(r.rest) : [0, 0, 0];
      r.slices.forEach(({ slice, fsh }, k) => { slice.style.transform = `rotateY(${(-a[k]).toFixed(3)}deg)`; fsh.style.opacity = 0; });
    }
  }

  let turned = 0, busy = 0;
  const cap = el("p", "bk-cap");
  const caption = () => { const next = rows[turned]; cap.textContent = turned === 0 ? "" : next ? next.sh.name : "The end"; };

  function turn(dir) {
    const idx = dir > 0 ? turned : turned - 1;
    const r = rows[idx]; if (!r) return Promise.resolve();
    build(r); if (dir > 0 && idx === n - 1) buildBase(); if (dir > 0 && idx + 1 < n) build(rows[idx + 1]);
    r.turned = dir > 0;
    turned += dir;
    busy++;
    r.sheet.style.zIndex = String(n + 5);
    r.sheet.style.transform = `translateZ(${(n * .6 + 2).toFixed(1)}px)`;
    const dur = reduce ? 1 : (r.sh.isCover ? 1250 : 1050);
    const kf = dir > 0 ? frames(0, r.rest) : frames(r.rest, 0);
    const anims = r.slices.map(({ slice, fsh }, k) => {
      const shade = Array.from({ length: 31 }, (_, i) => { const t = i / 30, a = (dir > 0 ? r.rest * ease(t) : r.rest * (1 - ease(t)));
        return { opacity: (Math.sin(Math.min(a, 90) * Math.PI / 180) * .4).toFixed(3), offset: t }; });
      fsh.animate(shade, { duration: dur, easing: "linear" });
      return slice.animate(kf[k], { duration: dur, easing: "linear", fill: "forwards" });
    });
    caption();
    return Promise.all(anims.map(a => a.finished)).catch(() => {}).then(() => {
      anims.forEach(a => a.cancel());
      busy--;
      if (!busy) settle();
    });
  }

  async function open() { if (book.classList.contains("open")) return; book.classList.add("open"); await turn(1); }
  async function close() {
    if (!book.classList.contains("open")) return;
    while (turned > 0) { const p = turn(-1); await new Promise(r => setTimeout(r, reduce ? 0 : 110)); if (turned === 0) await p; }
    book.classList.remove("open");
  }
  const next = () => { if (turned < n) turn(1); };
  const prev = () => { if (turned > 1) turn(-1); else close(); };

  build(rows[0]);                                   /* the cover is seen closed: build it now */
  settle();
  const hint = el("span", "open-hint"); hint.textContent = touch ? "Tap to open" : "Click to open";
  const shell = el("div", "bk-shell"); shell.append(bk, hint);
  const face = book.querySelector(".cover");
  face.replaceChildren(shell);
  face.after(cap);

  /* which side was clicked: the standing stack on the left, or the page on the right */
  const side = e => { const r = bk.getBoundingClientRect(); return e.clientX < r.left + r.width * .12 ? -1 : 1; };
  face.addEventListener("click", e => {
    e.stopPropagation();
    if (!book.classList.contains("open")) return open();
    side(e) > 0 ? next() : prev();
  });
  face.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") { e.preventDefault(); book.classList.contains("open") ? next() : open(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "Escape") close();
  });
  /* a click anywhere else, or Escape, closes the book */
  document.addEventListener("click", e => { if (book.classList.contains("open") && !book.contains(e.target)) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  return { open, close, next, prev };
}
