/* ==========================================================================
   A book that opens where it stands.

   Each sheet is cut into three vertical slices, nested so that each turns
   about the edge of the one before it. Turning a sheet rotates the first
   slice through 180° while the outer two lead it by a few degrees on the way
   and settle back to nothing at the end — so the page bends as it lifts, the
   way paper does, and lies flat once it has landed. Every slice has a front
   and a back face; the back carries the reverse page, offset so that the
   three pieces read as one page when the sheet has turned.

     mountBook(article, {
       cover:  <img>,                       the cover, as the front of sheet 0
       sheets: [{ front: () => Node, back: () => Node, name: [frontName, backName] }, …]
       base:   () => Node                   what shows when every sheet has turned
       onPage: (label) => void              a caption for the page in view
     })

   A pointer resting on the book opens the cover; a click on the right-hand
   page turns forward, on the left-hand page turns back; leaving closes it. On
   a touchscreen a tap does the same, and the first tap opens it.
   ========================================================================== */
const SL = 3;                  /* slices per sheet */
const DELTA = 10;              /* how far the free edge leads, in degrees — a lift, not a flap */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* per-slice keyframes for one turn: forward (0→180) or back (180→0) */
function frames(dir) {
  const N = 28, out = Array.from({ length: SL }, () => []);
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = 180 * ease(t), a = dir > 0 ? th : 180 - th;
    const b = Math.sin(a * Math.PI / 180);
    const s = [a - (SL - 1) * DELTA * b, ...Array(SL - 1).fill(DELTA * b)];
    s.forEach((v, k) => out[k].push({ transform: `rotateY(${(-v).toFixed(3)}deg)`, offset: t }));
  }
  return out;
}
const FWD = frames(1), BACK = frames(-1);

export function mountBook(book, { cover, title, sheets, base, onPage, touch }) {
  const n = sheets.length + 1;                       /* the cover is sheet 0 */
  const bk = el("div", "bk");
  const baseEl = el("div", "bk-base");
  bk.append(baseEl);

  const SHEETS = [{ front: null, back: null, name: ["Cover", "Title page"], isCover: true }, ...sheets];
  const rows = SHEETS.map((sh, i) => {
    const sheet = el("div", "bk-sheet");
    let parent = sheet;
    const slices = [];
    for (let k = 0; k < SL; k++) {
      const slice = el("div", "bk-slice");
      const front = el("div", "bk-face front"), back = el("div", "bk-face back");
      const fpg = el("div", "bk-pg"), bpg = el("div", "bk-pg");
      fpg.style.left = `${-k * 100}%`; bpg.style.left = `${-(SL - 1 - k) * 100}%`;
      const fsh = el("i", "bk-shade"), bsh = el("i", "bk-shade");
      fsh.style.left = fpg.style.left; bsh.style.left = bpg.style.left;
      front.append(fpg, fsh); back.append(bpg, bsh);
      if (sh.isCover) front.classList.add("is-cover");
      slice.append(front, back);
      parent.append(slice); parent = slice;
      slices.push({ slice, fpg, bpg, fsh, bsh });
    }
    bk.append(sheet);
    return { sheet, slices, sh, built: false, turned: false, i };
  });

  const build = row => {
    if (row.built) return; row.built = true;
    for (const { fpg, bpg } of row.slices) {
      if (row.sh.isCover) { const im = cover.cloneNode(); im.alt = ""; fpg.append(im); bpg.append(titlePage()); }
      else { if (row.sh.front) fpg.append(row.sh.front()); if (row.sh.back) bpg.append(row.sh.back()); }
    }
  };
  const titlePage = () => { const w = el("div", "bk-title"); if (title) w.append(title()); return w; };
  let baseBuilt = false;
  const buildBase = () => { if (baseBuilt) return; baseBuilt = true; if (base) baseEl.append(base()); };

  /* resting placement: the unturned pile on the right, the turned pile on the left */
  function settle() {
    for (const r of rows) {
      const z = r.turned ? r.i + 1 : n - r.i;
      r.sheet.style.transform = `translateZ(${(z * .6).toFixed(1)}px)`;
      r.sheet.style.zIndex = String(z);
      r.slices.forEach(({ slice, fsh, bsh }, k) => {
        slice.style.transform = k === 0 && r.turned ? "rotateY(-180deg)" : "rotateY(0deg)";
        fsh.style.opacity = 0; bsh.style.opacity = 0;
      });
    }
  }

  let turned = 0, busy = 0;
  const caption = () => {
    const r = rows[turned - 1], next = rows[turned];
    const left = r ? r.sh.name[1] : null, right = next ? next.sh.name[0] : "The end";
    onPage?.(turned === 0 ? "" : [left, right].filter(Boolean).join(" · "));
  };

  function turn(dir) {
    const idx = dir > 0 ? turned : turned - 1;
    const r = rows[idx]; if (!r) return Promise.resolve();
    build(r); if (dir > 0 && idx === n - 1) buildBase(); if (dir > 0 && idx + 1 < n) build(rows[idx + 1]);
    r.turned = dir > 0;
    turned += dir;
    busy++;
    r.sheet.style.zIndex = String(n + 5);
    r.sheet.style.transform = `translateZ(${(n * .6 + 2).toFixed(1)}px)`;
    const dur = reduce ? 1 : 1050 + Math.random() * 120;
    const anims = r.slices.map(({ slice, fsh, bsh }, k) => {
      const shade = Array.from({ length: 29 }, (_, i) => { const t = i / 28, a = 180 * ease(t);
        return { opacity: (Math.sin(a * Math.PI / 180) * .55).toFixed(3), offset: t }; });
      fsh.animate(shade, { duration: dur, easing: "linear" });
      bsh.animate(shade, { duration: dur, easing: "linear" });
      return slice.animate((dir > 0 ? FWD : BACK)[k], { duration: dur, easing: "linear", fill: "forwards" });
    });
    caption();
    return Promise.all(anims.map(a => a.finished)).catch(() => {}).then(() => {
      anims.forEach(a => a.cancel());
      busy--;
      if (!busy) settle();
    });
  }

  async function open() { book.classList.add("open"); if (turned === 0) await turn(1); }
  async function close() {
    while (turned > 0) { const p = turn(-1); await new Promise(r => setTimeout(r, reduce ? 0 : 140)); if (turned === 0) await p; }
    book.classList.remove("open");
  }
  const next = () => { if (turned < n) turn(1); };
  const prev = () => { if (turned > 1) turn(-1); else close(); };

  build(rows[0]);                                   /* the cover is seen closed: build it now */
  settle();
  const hint = el("span", "open-hint"); hint.textContent = touch ? "Tap to open" : "Open";
  const cap = el("p", "bk-cap");
  const shell = el("div", "bk-shell"); shell.append(bk, hint);
  const face = book.querySelector(".cover");
  face.replaceChildren(shell);
  face.after(cap);
  onPage = (onPage || (t => { cap.textContent = t; }));

  const side = e => { const r = bk.getBoundingClientRect(); return e.clientX < r.left + r.width * (book.classList.contains("open") ? .5 : 0) ? -1 : 1; };
  face.addEventListener("click", e => {
    if (!book.classList.contains("open")) return open();
    side(e) > 0 ? next() : prev();
  });
  face.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") { e.preventDefault(); book.classList.contains("open") ? next() : open(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "Escape") close();
  });
  if (!touch) {
    let leaveT = 0;
    book.addEventListener("pointerenter", () => { clearTimeout(leaveT); open(); });
    book.addEventListener("pointerleave", () => { leaveT = setTimeout(close, 260); });
    face.addEventListener("focus", open);
    face.addEventListener("blur", () => { if (!book.matches(":hover")) close(); });
  }
  return { open, close, next, prev };
}
