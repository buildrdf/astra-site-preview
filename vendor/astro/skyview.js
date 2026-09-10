/* ===================================================================
   SKY — Astra's living sky (motion-aligned, no camera).
   -------------------------------------------------------------------
   Rebuilt 2 Sep 2026 to the "Major redesign of Astra Sky" spec. The
   organising object is the CELESTIAL RIBBON: the sidereal ecliptic as a
   warm band carrying twelve rashi regions and twenty-seven nakshatra
   sectors, with the grahas hovering against it. Stars are atmosphere.
   Three visual levels, always: the thing (graha) · where it is (rashi,
   nakshatra) · what it means to me (natal house, one sentence).

   Source of truth: ephemeris.js positions() (sidereal, Lahiri) and
   sky.js alt/az - the same engine as the chart. Nothing here places a
   sign, nakshatra or planet by itself.

   Camera: a true perspective (gnomonic) projection about the view
   direction, so the field of view is the single zoom parameter and
   the zenith is not a singularity. Device motion steers the camera
   until a finger drags; Recenter hands it back.

   State: SkyMoment - birth | now | custom - each with its own
   timestamp and place. Birth never inherits device time or place.
   =================================================================== */
import { positions, retrograde, eclipticLatitudes } from "./ephemeris.js";
import { raDecToAltAz, siderealPointAltAz, siderealPointAltAzB, sunTimes } from "./sky.js";
import { ASTERISMS } from "./asterisms.js";
import { ZODIAC } from "./zodiac-lines.js";
import { GRAHA_MEANING, PLANET_STORY, HOUSE_TRANSIT_SENSE } from "./interpret.js";
import { NAK_META, nakLord, pointGrid, nakshatraRange, signNakshatras, fmtDMS } from "./zodiac.js";
import { drawGraha, grahaSprite, preloadGrahaArt, GRAHA_BASE } from "./celestial-art.js";
import { drawOrrery, orreryHit, risingLongitude } from "./orrery.js";
import { deviceBasis, quatFromBasis, basisFromQuat, slerp, quatAngle, azAltOf, basisFromAzAlt, fuseYaw } from "./orient.js";
preloadGrahaArt();

const SIGNS_SK=["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
  "Tula","Vrishchika","Dhanu","Makara","Kumbha","Meena"];
const SIGNS_EN=["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const SIGNS_DEV=["मेष","वृषभ","मिथुन","कर्क","सिंह","कन्या","तुला","वृश्चिक","धनु","मकर","कुम्भ","मीन"];
const GRAHAS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const GRAHA_SK={Sun:"Surya",Moon:"Chandra",Mars:"Mangal",Mercury:"Budh",
  Jupiter:"Guru",Venus:"Shukra",Saturn:"Shani",Rahu:"Rahu",Ketu:"Ketu"};
const NAKS=NAK_META.map(m=>m.n);
const NSPAN=360/27;

/* One yogatara per nakshatra (J2000). Drawn as atmosphere; named only
   when the "Star names" layer is on. */
const STARS=[
  {name:"Sheratan",   ra:28.66,  dec:20.81,  m:2.6},{name:"41 Arietis", ra:42.50,  dec:27.26,  m:3.6},
  {name:"Alcyone",    ra:56.87,  dec:24.11,  m:2.9},{name:"Aldebaran",  ra:68.98,  dec:16.51,  m:0.9},
  {name:"Meissa",     ra:83.78,  dec:9.93,   m:3.5},{name:"Betelgeuse", ra:88.79,  dec:7.41,   m:0.5},
  {name:"Pollux",     ra:116.33, dec:28.03,  m:1.1},{name:"Asellus Australis",ra:131.17,dec:18.15,m:3.9},
  {name:"Epsilon Hydrae",ra:131.69,dec:6.42, m:3.4},{name:"Regulus",    ra:152.09, dec:11.97,  m:1.4},
  {name:"Zosma",      ra:168.53, dec:20.52,  m:2.6},{name:"Denebola",   ra:177.26, dec:14.57,  m:2.1},
  {name:"Algorab",    ra:187.47, dec:-16.52, m:2.9},{name:"Spica",      ra:201.30, dec:-11.16, m:1.0},
  {name:"Arcturus",   ra:213.92, dec:19.18,  m:0.0},{name:"Zubenelgenubi",ra:222.72,dec:-16.04,m:2.8},
  {name:"Dschubba",   ra:240.08, dec:-22.62, m:2.3},{name:"Antares",    ra:247.35, dec:-26.43, m:1.0},
  {name:"Shaula",     ra:263.40, dec:-37.10, m:1.6},{name:"Kaus Media", ra:275.25, dec:-29.83, m:2.7},
  {name:"Nunki",      ra:283.82, dec:-26.30, m:2.0},{name:"Altair",     ra:297.70, dec:8.87,   m:0.8},
  {name:"Rotanev",    ra:305.66, dec:14.60,  m:3.6},{name:"Lambda Aquarii",ra:343.15,dec:-7.58,m:3.7},
  {name:"Markab",     ra:346.19, dec:15.21,  m:2.5},{name:"Algenib",    ra:3.31,   dec:15.18,  m:2.8},
  {name:"Zeta Piscium",ra:18.43, dec:7.58,   m:5.2},
];
const AMBIENT=(()=>{ let s=971;
  const rnd=()=>((s=(s*1664525+1013904223)|0)>>>0)/2**32;
  return Array.from({length:460},()=>({
    ra:rnd()*360, dec:Math.asin(rnd()*1.9-0.95)*180/Math.PI, m:3.4+rnd()*2.4}));
})();
const GLOW={Sun:"255,196,110",Moon:"214,226,255",Mars:"255,128,96",
  Mercury:"150,224,170",Jupiter:"255,214,150",Venus:"242,242,255",
  Saturn:"232,204,146",Rahu:"156,146,208",Ketu:"156,146,208"};
const IMG={};
for(const g of GRAHAS){ IMG[g]=new Image(); IMG[g].src=`assets/graha/${g.toLowerCase()}.png`; }
const RASHI_ART={};
/* the rashi art layer reads the asset manifest: only APPROVED assets ship;
   a review state (artPending) may show pending ones so they can be judged in situ */
const RASHI_ID={mesha:1,vrishabha:2,mithuna:3,karka:4,simha:5,kanya:6,tula:7,vrischika:8,dhanu:9,makara:10,kumbha:11,meena:12};
let ART_PENDING=false, artLoaded=false;
/* the figure's real footprint inside its PNG - the alpha bounding box, as fractions
   of the image - so the fit registers the figure to the stars, not its transparent
   margin. Measured once per image at a small size; failure leaves the whole image. */
const ART_BOX={};
function measureArtBox(im,id){
  try{
    const S=160, cv=document.createElement("canvas"); cv.width=cv.height=S;
    const g=cv.getContext("2d",{willReadFrequently:true}); g.drawImage(im,0,0,S,S);
    const a=g.getImageData(0,0,S,S).data; let x0=S,y0=S,x1=-1,y1=-1;
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){ if(a[(y*S+x)*4+3]>24){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
    if(x1>=0) ART_BOX[id]={cx:(x0+x1+1)/(2*S), cy:(y0+y1+1)/(2*S), fw:(x1-x0+1)/S, fh:(y1-y0+1)/S};
  }catch(_){}
}
/* DAY INK (Sangram, 6 Sep: "can't see rashi artwork in day, it doesn't glow
   up"). A luminous figure drawn additively over a bright blue sky is white on
   white. By day each figure is drawn from an inked copy instead: the alpha as
   painted, the colour taken 70% of the way to a deep indigo, so the figure is
   a darker presence in the sky - the way a day-mode star app shows one - with
   30% of its own shading left so it is a figure and not a stencil. Baked once
   per image at its first daylight use, at most one image a frame, at 768 px
   on the long side: an ink wash needs no more, and reading twelve 1024
   squares in one frame would be a felt stutter. */
const ART_INK={}, INK_RGB="46,52,96", INK_MIX=0.6, INK_MAX=768;
let inkBakes=0;                                  /* bakes so far this frame; draw() resets it */
function artInk(id,img){
  const k=ART_INK[id]; if(k&&k.img===img) return k.cv;
  if(inkBakes>=1) return null; inkBakes++;
  const nw=img.naturalWidth, nh=img.naturalHeight, sc=Math.min(1,INK_MAX/Math.max(nw,nh));
  const cv=document.createElement("canvas"); cv.width=Math.max(1,Math.round(nw*sc)); cv.height=Math.max(1,Math.round(nh*sc));
  const g=cv.getContext("2d"); g.drawImage(img,0,0,cv.width,cv.height);
  g.globalCompositeOperation="source-atop"; g.fillStyle=`rgba(${INK_RGB},${INK_MIX})`; g.fillRect(0,0,cv.width,cv.height);
  ART_INK[id]={img,cv}; return cv;
}
/* THE LIT COPY (Sangram, 8 Sep: "the Rashi artworks are not illuminated when I point at
   them… they look a little bit too dark because there's a bluish tint"). Pointing used to
   raise only the OPACITY of a figure — by day, of the indigo ink above — so turning toward
   a rashi made it heavier and bluer, never brighter. A lit figure is now a lamp: its own
   painted alpha filled with warm brass, laid additively OVER the resting figure with a soft
   bloom behind it, so it reads as light on a night sky and as sunlit form on a day one, and
   over the land as readily as over the stars. 25% of its own shading survives the fill, so a
   lit rashi is still a drawing and not a stencil. Baked at most one a frame like the ink and
   kept for three signs: one figure is lit at a time, so three is already generous, and
   twelve full-size canvases is memory a phone should not have to hold. */
/* A LIT FIGURE IS LUMINOUS, NOT BRASS (Sangram, 10 Sep: "they should be glowing white,
   luminant. Why is it appearing beige? I'm not liking the beige. Nor do I like the ink blue
   which was before, but it should be glowing.").
   The first lamp filled the figure 70% with 255,212,140, which measured rgb(249,223,186) on
   screen — a warmth of 63 between red and blue, and beige by any name. It went warm to solve
   the DAY problem, where additive light on a bright sky bleaches a figure to a blank shape.
   That was the wrong lever. The lamp is white now on both skies; what differs is how it is
   composited, and by day a little of the ink is left underneath to carry the drawing instead
   of a tint being used to do it. The fill is light, not paint: 34% white over the artwork
   lifts it toward glowing and leaves two thirds of its own shading intact. */
const ART_LIT={}, LIT_RGB="255,255,255", LIT_MIX=0.34, LIT_MAX=640, LIT_KEEP=3;
/* the bloom is starlight, a touch cool — a warm halo is what read as a lamp before */
const BLOOM_RGB="214,228,255";
let litBakes=0, litClock=0;                      /* bakes this frame; draw() resets — and a use clock for the cache */
function artLit(id,img){
  const k=ART_LIT[id]; if(k&&k.img===img){ k.t=++litClock; return k.cv; }
  if(litBakes>=1||inkBakes>=1) return null; litBakes++;   /* never two image reads in one frame */
  const nw=img.naturalWidth, nh=img.naturalHeight, sc=Math.min(1,LIT_MAX/Math.max(nw,nh));
  const cv=document.createElement("canvas"); cv.width=Math.max(1,Math.round(nw*sc)); cv.height=Math.max(1,Math.round(nh*sc));
  const g=cv.getContext("2d"); g.drawImage(img,0,0,cv.width,cv.height);
  g.globalCompositeOperation="source-atop"; g.fillStyle=`rgba(${LIT_RGB},${LIT_MIX})`; g.fillRect(0,0,cv.width,cv.height);
  ART_LIT[id]={img,cv,t:++litClock};
  const ids=Object.keys(ART_LIT);
  if(ids.length>LIT_KEEP){ ids.sort((a,b)=>ART_LIT[a].t-ART_LIT[b].t); delete ART_LIT[ids[0]]; }
  return cv;
}
function loadRashiArt(){
  if(artLoaded) return; artLoaded=true;
  fetch("assets/gen/manifest.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(m=>{
    const list=Array.isArray(m)?m:(m&&(m.assets||m.entries))||[];
    for(const a of list){
      if(a.kind==="landscape"&&a.id==="land-day"){
        /* the land goes through the same gate: the approved file ships; while a
           render waits for Sangram, the review state shows the chosen candidate */
        if(a.status==="approved") loadLand((a.file||"assets/gen/land-day.png").replace(/^prototype\//,""));
        else if(ART_PENDING&&a.status==="pending-review") loadLand(`assets/gen/land-day-${a.chosen||"A"}.png`);
        continue; }
      if(a.kind==="cloud"){
        /* the three cumulus sprites go through the same gate as the land */
        const k=CLOUD_IDS.indexOf(a.id); if(k<0) continue;
        if(a.status==="approved") loadCloud(k,(a.file||`assets/gen/${a.id}.png`).replace(/^prototype\//,""));
        else if(ART_PENDING&&a.status==="pending-review") loadCloud(k,`assets/gen/${a.id}-${a.chosen||a.variant||"A"}.png`);
        continue; }
      if(a.kind!=="rashi"||!RASHI_ID[a.id]) continue;
      if(a.status!=="approved"&&!(ART_PENDING&&a.status==="pending-review")) continue;
      if(!a.file) continue;
      const im=new Image(); const id=RASHI_ID[a.id]; im.onload=()=>measureArtBox(im,id);
      im.src=a.file.replace(/^prototype\//,""); RASHI_ART[id]=im; }
  }).catch(()=>{});
}
/* ---- the land: a generated horizon panorama, gated by the same manifest ----
   One 1536x1024 strip is 90 degrees of azimuth; four tiles wrap the viewer,
   alternate tiles mirrored so every seam meets itself. One scale serves both
   axes (w/90 px per degree) and image row LEYE*h sits on the true horizon, so
   the strip reaches about 28 degrees up and 32 down. At load it is baked once
   into a canvas with a few mirrored columns of padding a side (a slice may
   then draw a little past its edges even across a tile seam) and a fade across its
   lowest rows, so the strip's bottom edge never shows when the phone points
   at the ground. Module-level, not on the sky cache: that cache is rebuilt on
   every recompute and the image is not a function of the moment. */
const LAND={img:null,w:0,h:0,src:null,sx:null,eye:0,top:0,bot:0,cv:null};
const LPAD=3, LSLICE=2, LEDGE=2.5, LEYE=0.46, LFADE=0.86;   /* padding columns a side; degrees a slice; source px a slice draws past its edges (must fit in LPAD) */
function loadLand(src){
  if(LAND.src===src) return; LAND.src=src; LAND.img=null;
  const im=new Image();
  im.onload=()=>{ if(LAND.src!==src) return; const w=im.naturalWidth, h=im.naturalHeight; if(!w||!h) return;
    const cv=document.createElement("canvas"); cv.width=w+2*LPAD; cv.height=h; const g=cv.getContext("2d");
    g.drawImage(im,LPAD,0);
    g.save(); g.translate(LPAD,0); g.scale(-1,1); g.drawImage(im,0,0,LPAD,h,0,0,LPAD,h); g.restore();
    g.save(); g.translate(w+2*LPAD,0); g.scale(-1,1); g.drawImage(im,w-LPAD,0,LPAD,h,0,0,LPAD,h); g.restore();
    const fd=g.createLinearGradient(0,h*LFADE,0,h); fd.addColorStop(0,"rgba(0,0,0,0)"); fd.addColorStop(1,"rgba(0,0,0,1)");
    g.globalCompositeOperation="destination-out"; g.fillStyle=fd; g.fillRect(0,h*LFADE,cv.width,h-h*LFADE);
    /* per-slice source columns, once: [x at a0, x at a1] in the padded canvas, running backwards on mirrored tiles */
    const ppd=w/90, n=360/LSLICE, sx=new Float64Array(n*2);
    for(let k=0;k<n;k++){ const a0=k*LSLICE, t=Math.floor(a0/90), u0=(a0-90*t)*ppd, u1=u0+LSLICE*ppd;
      sx[2*k]=LPAD+((t&1)?w-u0:u0); sx[2*k+1]=LPAD+((t&1)?w-u1:u1); }
    /* the eye line (true horizon) is read from the image, not assumed: the lowest
       point of the skyline must sit just above it, or the ground colour shows as a
       band between the sky and the peaks (horizon B, Sangram, 6 Sep) */
    let eye=LEYE*h;
    try{ const d=g.getImageData(LPAD,0,w,h).data; let low=0;
      for(let x=0;x<w;x+=16){ for(let y=0;y<h;y++){ if(d[(y*w+x)*4+3]>250){ if(y>low) low=y; break; } } }
      if(low>0) eye=Math.min(0.62*h, Math.max(eye, low+0.02*h)); }catch(_){}
    LAND.w=w; LAND.h=h; LAND.sx=sx; LAND.eye=eye; LAND.top=eye/ppd; LAND.bot=-(h-eye)/ppd; LAND.img=cv; };
  im.src=src;
}
if(typeof window!=="undefined") window.__skyLand=()=>({ready:!!LAND.img,w:LAND.w,h:LAND.h,src:LAND.src});

/* ---- the clouds: three photoreal cumulus sprites, gated like the land ----
   cloud-a is wide, cloud-b a tower, cloud-c a wisp; 1024 RGBA each, baked once
   at load to a clean CBAKE square (the source is then dropped: a cloud a few
   degrees wide never needs more) and again to a tinted copy whenever the low
   Sun has moved. All three must be in before any is drawn, so the sky is never
   half photograph, half puff. Module-level like LAND, for the same reason. */
const CLOUD_IDS=["cloud-a","cloud-b","cloud-c"], CBAKE=512, CSPAN=1.8;   /* sprite box = CSPAN*w degrees a side */
const CLOUDS_ART={base:[null,null,null],cv:[null,null,null],src:[null,null,null],n:0,key:null,at:0};
/* SOFT, once, at load (Sangram, 6 Sep, a calm landscape photograph as the bar:
   the sprites came in bright and hard-edged, "too distracting"). Four moves,
   all baked into the sprite so the frame pays nothing for them: a wide blur
   of the photograph is laid over it at a third, so the edge gains a faint
   fringe and the fine texture loses a third of its contrast; the shadows lift
   toward a pale sky, the darker the pixel the more, so a cloud is a tone of
   the sky rather than a grey object in it while its highlights keep their
   shape; the alpha is taken to 0.6 so the blue shows through everywhere; and
   the alpha edge is steepened (a^1.4), which lets the fringe fade sooner, so
   the outline is wispy rather than cut. */
const CLOUD_SKY=[190,206,232], CLOUD_LIFT=0.55, CLOUD_ALPHA=0.6, CLOUD_EDGE=1.4, CLOUD_BLUR=0.35;
function softenCloud(g,im){
  try{
    /* the blur: drawn down to 48 px in two steps and back up to CBAKE */
    const s1=document.createElement("canvas"); s1.width=s1.height=192; s1.getContext("2d").drawImage(im,0,0,192,192);
    const s2=document.createElement("canvas"); s2.width=s2.height=48; s2.getContext("2d").drawImage(s1,0,0,48,48);
    g.globalAlpha=CLOUD_BLUR; g.drawImage(s2,0,0,CBAKE,CBAKE); g.globalAlpha=1;
    const d=g.getImageData(0,0,CBAKE,CBAKE), p=d.data;
    for(let i=0;i<p.length;i+=4){ const a=p[i+3]; if(!a) continue;
      const r=p[i], gg=p[i+1], b=p[i+2], t=CLOUD_LIFT*(1-(r*0.299+gg*0.587+b*0.114)/255);
      p[i]=r+(CLOUD_SKY[0]-r)*t; p[i+1]=gg+(CLOUD_SKY[1]-gg)*t; p[i+2]=b+(CLOUD_SKY[2]-b)*t;
      p[i+3]=255*CLOUD_ALPHA*Math.pow(a/255,CLOUD_EDGE); }
    g.putImageData(d,0,0);
  }catch(_){ /* a tainted canvas keeps the photograph as it came */ }
}
function loadCloud(k,src){
  if(CLOUDS_ART.src[k]===src) return; CLOUDS_ART.src[k]=src; CLOUDS_ART.base[k]=null; CLOUDS_ART.n=0;
  const im=new Image();
  im.onload=()=>{ if(CLOUDS_ART.src[k]!==src||!im.naturalWidth) return;
    const cv=document.createElement("canvas"); cv.width=cv.height=CBAKE;
    const g=cv.getContext("2d",{willReadFrequently:true}); g.drawImage(im,0,0,CBAKE,CBAKE);
    softenCloud(g,im);
    CLOUDS_ART.base[k]=cv; CLOUDS_ART.key=null; CLOUDS_ART.n=CLOUDS_ART.base.filter(Boolean).length; };
  im.src=src;
}
/* the tinted set for this Sun: warm at the crown, mauve in the shadowed base,
   nothing at all with the Sun above 25 degrees. One source-atop pass a sprite,
   re-baked when the Sun crosses a quarter degree (about a minute of sky time
   through twilight, never at midday) and at most five times a second while
   the timeline is scrubbed — never per frame. */
function cloudSprites(sunAlt){
  const key=Math.round(Math.max(-6,Math.min(25,sunAlt))*4), now=performance.now();
  if(key===CLOUDS_ART.key||(CLOUDS_ART.key!==null&&now-CLOUDS_ART.at<200)) return CLOUDS_ART.cv;
  CLOUDS_ART.key=key; CLOUDS_ART.at=now;
  const low=1-Math.min(1,Math.max(0,sunAlt/25));
  for(let k=0;k<3;k++){
    let cv=CLOUDS_ART.cv[k]; if(!cv){ cv=document.createElement("canvas"); cv.width=cv.height=CBAKE; CLOUDS_ART.cv[k]=cv; }
    const g=cv.getContext("2d"); g.globalCompositeOperation="source-over"; g.clearRect(0,0,CBAKE,CBAKE); g.drawImage(CLOUDS_ART.base[k],0,0);
    if(low>0){ const t=g.createLinearGradient(0,CBAKE*0.15,0,CBAKE*0.9);
      t.addColorStop(0,`rgba(255,204,150,${(0.46*low).toFixed(3)})`);
      t.addColorStop(1,`rgba(96,72,104,${(0.34*low).toFixed(3)})`);
      g.globalCompositeOperation="source-atop"; g.fillStyle=t; g.fillRect(0,0,CBAKE,CBAKE); g.globalCompositeOperation="source-over"; } }
  return CLOUDS_ART.cv;
}
if(typeof window!=="undefined") window.__skyClouds=()=>({ready:CLOUDS_ART.n===3,n:CLOUDS_ART.n,src:CLOUDS_ART.src.slice(),key:CLOUDS_ART.key,
  soft:{lift:CLOUD_LIFT,alpha:CLOUD_ALPHA,edge:CLOUD_EDGE,blur:CLOUD_BLUR},field:CLOUDS.filter(c=>c.on).map(c=>({k:c.k,deg:+(c.w*1.25).toFixed(1),az:+c.az.toFixed(1),alt:+c.alt.toFixed(1)}))});

/* ---- timezone-true local time (kept; validated 31 Aug) ---- */
export function offsetAtTz(tz, utcMs){
  const f=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,
    year:"numeric",month:"numeric",day:"numeric",
    hour:"numeric",minute:"numeric",second:"numeric"});
  const m={}; for(const p of f.formatToParts(new Date(utcMs))) m[p.type]=p.value;
  return Date.UTC(m.year,m.month-1,m.day,m.hour%24,m.minute,m.second)
       - Math.floor(utcMs/1000)*1000;
}
export function utcFromLocalTz(y,mo,da,hh,mi,tz){
  const wall=Date.UTC(y,mo-1,da,hh,mi);
  let guess=wall;
  for(let i=0;i<3;i++) guess=wall-offsetAtTz(tz,guess);
  return new Date(guess);
}
const fmtLocal=(d,tz,opts)=>{ const loc=opts.hour?"en-US":"en-GB";
  try{ return d.toLocaleString(loc,{...opts,timeZone:tz||undefined}).replace("Sept","Sep"); }catch(_){ return d.toLocaleString(loc,opts); } };
const tzAbbr=(d,tz)=>{ try{ const p=new Intl.DateTimeFormat("en-IN",{timeZone:tz,timeZoneName:"short"}).formatToParts(d);
  const v=(p.find(x=>x.type==="timeZoneName")||{}).value||""; return v.startsWith("GMT")&&tz==="Asia/Kolkata"?"IST":v; }catch(_){ return ""; } };

/* OFFLINE FALLBACK places (standard offsets; IANA zone when known) */
const CITIES=[
["Aurangabad",19.88,75.34,5.5],["Mumbai",19.08,72.88,5.5],["Pune",18.52,73.86,5.5],
["Delhi",28.61,77.21,5.5],["Bengaluru",12.97,77.59,5.5],["Hyderabad",17.39,78.49,5.5],
["Chennai",13.08,80.27,5.5],["Kolkata",22.57,88.36,5.5],["Ahmedabad",23.02,72.57,5.5],
["Jaipur",26.91,75.79,5.5],["Kota",25.18,75.84,5.5],["Nashik",20.00,73.79,5.5],
["Nagpur",21.15,79.09,5.5],["Surat",21.17,72.83,5.5],["Lucknow",26.85,80.95,5.5],
["Varanasi",25.32,82.99,5.5],["Indore",22.72,75.86,5.5],["Bhopal",23.26,77.41,5.5],
["Panaji, Goa",15.49,73.83,5.5],["Kochi",9.93,76.27,5.5],["Thiruvananthapuram",8.52,76.94,5.5],
["Chandigarh",30.73,76.78,5.5],["Amritsar",31.63,74.87,5.5],["Patna",25.59,85.14,5.5],
["Guwahati",26.14,91.74,5.5],["Bhubaneswar",20.30,85.82,5.5],["Coimbatore",11.02,76.96,5.5],
["Visakhapatnam",17.69,83.22,5.5],["Rishikesh",30.09,78.27,5.5],["Ujjain",23.18,75.78,5.5],
["New York",40.71,-74.01,-5],["Los Angeles",34.05,-118.24,-8],["Chicago",41.88,-87.63,-6],
["San Francisco",37.77,-122.42,-8],["Seattle",47.61,-122.33,-8],["Austin",30.27,-97.74,-6],
["Houston",29.76,-95.37,-6],["Miami",25.76,-80.19,-5],["Boston",42.36,-71.06,-5],
["Denver",39.74,-104.99,-7],["Phoenix",33.45,-112.07,-7],["Atlanta",33.75,-84.39,-5],
["Dallas",32.78,-96.80,-6],["San Diego",32.72,-117.16,-8],["Washington DC",38.91,-77.04,-5],
["London",51.51,-0.13,0],["Paris",48.86,2.35,1],["Berlin",52.52,13.40,1],
["Amsterdam",52.37,4.90,1],["Zurich",47.38,8.54,1],["Rome",41.90,12.50,1],
["Madrid",40.42,-3.70,1],["Lisbon",38.72,-9.14,0],["Dubai",25.20,55.27,4],
["Abu Dhabi",24.45,54.38,4],["Doha",25.29,51.53,3],["Riyadh",24.71,46.68,3],
["Singapore",1.35,103.82,8],["Hong Kong",22.32,114.17,8],["Tokyo",35.68,139.69,9],
["Seoul",37.57,126.98,9],["Shanghai",31.23,121.47,8],["Beijing",39.90,116.41,8],
["Bangkok",13.76,100.50,7],["Kathmandu",27.72,85.32,5.75],["Colombo",6.93,79.85,5.5],
["Dhaka",23.81,90.41,6],["Karachi",24.86,67.01,5],["Lahore",31.55,74.34,5],
["Sydney",-33.87,151.21,10],["Melbourne",-37.81,144.96,10],["Auckland",-36.85,174.76,12],
["Toronto",43.65,-79.38,-5],["Vancouver",49.28,-123.12,-8],["Mexico City",19.43,-99.13,-6],
["São Paulo",-23.55,-46.63,-3],["Johannesburg",-26.20,28.05,2],["Nairobi",-1.29,36.82,3],
["Cairo",30.04,31.24,2],["Istanbul",41.01,28.98,3],["Moscow",55.76,37.62,3],
["Mauritius",-20.16,57.50,4],["Denpasar, Bali",-8.65,115.22,8],["Kuala Lumpur",3.14,101.69,8]];
const CITY_TZ={"New York":"America/New_York","Boston":"America/New_York",
  "Miami":"America/New_York","Atlanta":"America/New_York","Washington DC":"America/New_York",
  "Toronto":"America/Toronto","Chicago":"America/Chicago","Austin":"America/Chicago",
  "Houston":"America/Chicago","Dallas":"America/Chicago","Mexico City":"America/Mexico_City",
  "Denver":"America/Denver","Phoenix":"America/Phoenix",
  "Los Angeles":"America/Los_Angeles","San Francisco":"America/Los_Angeles",
  "Seattle":"America/Los_Angeles","San Diego":"America/Los_Angeles","Vancouver":"America/Vancouver",
  "London":"Europe/London","Paris":"Europe/Paris","Berlin":"Europe/Berlin",
  "Amsterdam":"Europe/Amsterdam","Zurich":"Europe/Zurich","Rome":"Europe/Rome",
  "Madrid":"Europe/Madrid","Lisbon":"Europe/Lisbon","Istanbul":"Europe/Istanbul",
  "Moscow":"Europe/Moscow","Dubai":"Asia/Dubai","Abu Dhabi":"Asia/Dubai",
  "Doha":"Asia/Qatar","Riyadh":"Asia/Riyadh","Singapore":"Asia/Singapore",
  "Hong Kong":"Asia/Hong_Kong","Tokyo":"Asia/Tokyo","Seoul":"Asia/Seoul",
  "Shanghai":"Asia/Shanghai","Beijing":"Asia/Shanghai","Bangkok":"Asia/Bangkok",
  "Kathmandu":"Asia/Kathmandu","Colombo":"Asia/Colombo","Dhaka":"Asia/Dhaka",
  "Karachi":"Asia/Karachi","Lahore":"Asia/Karachi","Sydney":"Australia/Sydney",
  "Melbourne":"Australia/Melbourne","Auckland":"Pacific/Auckland",
  "São Paulo":"America/Sao_Paulo","Johannesburg":"Africa/Johannesburg",
  "Nairobi":"Africa/Nairobi","Cairo":"Africa/Cairo","Mauritius":"Indian/Mauritius",
  "Denpasar, Bali":"Asia/Makassar","Kuala Lumpur":"Asia/Kuala_Lumpur"};
const cityHit=c=>({label:c[0],n:c[0],lat:c[1],lon:c[2],off:c[3],
  tz:CITY_TZ[c[0]]||(c[3]===5.5?"Asia/Kolkata":null)});
/* a name for coordinates, from the offline list when close enough */
/* when a graha below the horizon next rises, in the sky's own zone: its altitude walked
   forward in ten-minute steps for a day, the crossing then bisected. The Moon moves enough
   in a day to be re-placed at each step; the others hold their longitude. Cached per sky
   moment and graha, so a scrub costs one search per lit planet, not one per frame. */
const RISE_CACHE=new Map();
function riseAt(p){
  const key=cache.key+"|"+p.g; if(RISE_CACHE.has(key)) return RISE_CACHE.get(key);
  let out=null;
  try{
    const d0=cache.d.getTime(), sp=cache.sp, H0=-0.57;
    const altAt=t=>{ const dd=new Date(t); const L=p.g==="Moon"?positions(dd).Moon:p.L; return siderealPointAltAzB(L,p.B||0,dd,sp.lat,sp.lon).alt; };
    let t0=d0, a0=altAt(t0), found=null;
    for(let k=1;k<=150&&found==null;k++){ const t1=d0+k*600000, a1=altAt(t1);
      if(a0<H0&&a1>=H0){ let lo=t0, hi=t1; for(let j=0;j<12;j++){ const m=(lo+hi)/2; if(altAt(m)<H0) lo=m; else hi=m; } found=hi; }
      t0=t1; a0=a1; }
    if(found!=null) out=fmtLocal(new Date(found),skyTz()||undefined,{hour:"numeric",minute:"2-digit"});
  }catch(_){}
  if(RISE_CACHE.size>64) RISE_CACHE.delete(RISE_CACHE.keys().next().value);
  RISE_CACHE.set(key,out); return out;
}
function nearestCity(lat,lon){
  let best=null,bd=1e9;
  for(const c of CITIES){ const d=Math.hypot((c[1]-lat),(c[2]-lon)*Math.cos(lat*Math.PI/180));
    if(d<bd){bd=d;best=c;} }
  return bd<0.6?best[0]:null;      /* ~65 km */
}

/* the galactic equator, as RA/Dec, weighted brighter toward the centre (l=0) */
const MW=(()=>{ const R=Math.PI/180, aG=192.85948*R, dG=27.12825*R, lN=122.93192*R, out=[];
  for(let l=0;l<360;l+=4){ const L=l*R, b=0, x=lN-L;
    const sd=Math.sin(dG)*Math.sin(b)+Math.cos(dG)*Math.cos(b)*Math.cos(x);
    const ra=aG+Math.atan2(Math.cos(b)*Math.sin(x), Math.sin(b)*Math.cos(dG)-Math.cos(b)*Math.sin(dG)*Math.cos(x));
    out.push({ra:((ra/R)%360+360)%360, dec:Math.asin(sd)/R, w:0.35+0.65*Math.pow(Math.max(0,Math.cos(L)),0.7)}); }
  return out; })();

/* ====================================================================
   STATE
   ==================================================================== */
let el=null, ctx=null, running=false, watch=null, reduced=false, rafId=0;
let skyOpener=null, skyInert=[];   /* where focus came from, and the app shell made inert while the sky is up */
let viewAz=180, viewAlt=25, wantAz=180, wantAlt=25, sensing=false, followSky=true;
/* how tightly the view follows the phone: milliseconds of easing when the hand is still,
   when it is sweeping, and the turn rate (deg/s) at which the tight end is reached */
/* The tight end must be reached EARLY. A first-order filter lags by about rate x tau, so
   at 60 deg/s the old fixed 70 ms trailed the phone by 4.2 deg; 34 ms halves that. The long
   constant is only for a hand that is genuinely still, where a long tau costs no lag at all
   and buys a rock-steady image — so the curve is fully tight by 8 deg/s, not 55. */
const CAM_TAU_STILL=210, CAM_TAU_TURN=34, CAM_TURN_FULL=8;
/* THE SENSOR CAMERA IS A ROTATION, NOT TWO ANGLES (src/orient.js). wantQ is
   the phone's latest rotation, camQ the eased one; viewAz/viewAlt are read
   off camQ for labels and hand-off. Straight up is no longer special. */
let wantQ=null, camQ=null, camBasis=null, reacquire=false;
/* THE HAND'S TURN RATE, measured as NET DISPLACEMENT over a window rather than by summing
   the angle between consecutive samples. Summing was wrong in the way that mattered most:
   zero-mean sensor jitter of only a quarter degree at 60 Hz sums to tens of degrees a second,
   so a phone lying still read as "turning" and never reached the calm regime the adaptive
   filter exists to provide (measured: tau settled at 163 ms under a still hand, not 210).
   Over a window, jitter cancels and real rotation accumulates. 260 ms is long enough for
   that cancellation and short enough that the onset of a real turn is caught within a frame
   or two of it starting. */
/* Measured as the SEPARATION BETWEEN TWO SMOOTHED POSES, one quick and one slow, divided
   by the difference of their time constants. Both carry the same true rotation, so the gap
   between them is proportional to the turn rate; both suppress jitter, and what jitter
   survives is largely common to the two and cancels in the gap. Everything below a floor
   is called nothing, so a phone lying on a table reaches the calm end exactly. */
const QT_FAST=60, QT_SLOW=200, QT_FLOOR=1.2;    /* ms, ms, deg/s treated as still */
const qSpd={v:0,t:0,f:null,s:null};
let camTau=CAM_TAU_STILL;
/* how squarely the view centre points at a sky position: 1 within 12 degrees, 0 beyond 38 */
let pointedSign=null;
/* ONE RASHI AT A TIME (Sangram, 6 Sep: "at a time, only one Rashi art should be glowing…
   as we move the camera towards a different Rashi art, the previous one should dim and
   the next one should highlight"). The pointed rashi is the sector of the ecliptic nearest
   the view centre, held with two degrees of hysteresis at its edges so it never flickers
   on a boundary; its two neighbours sit at a second tier so the eye knows where to turn
   next; the rest stay a whisper, above and below the horizon alike. Weights ease per
   frame, so the last figure dims as the next lights. Looking far from the band (over 45°)
   points at nothing. A selected target outranks the pointing. */
const BAND_B=5.5;                                     /* half-width of the belt, degrees of ecliptic latitude */
/* ONE LAMP AT A TIME (Sangram, 8 Sep: "one should be highlighted at a time. Currently that's
   not happening"). The old second tier lit each neighbour at 0.42 — nearly half strength —
   so two or three big figures read as "on" together and the pointed one never stood alone.
   Now there is exactly one lit figure and eleven whispers, neighbours included, above the
   horizon and below it alike. */
const LIT={on:1,rest:0.10};
const ART_W=new Float32Array(12).fill(LIT.rest);
let POINT={s:null,L:null,sep:99};
function pointing(){
  if(!cache) return POINT;
  const a1=viewAlt*D2R, s1=Math.sin(a1), c1=Math.cos(a1);
  let best=1e9, bi=-1;
  for(let i=0;i<180;i++){ const p=cache.ecl[i]; const dz=(p.az-viewAz)*D2R, a2=p.alt*D2R;
    const cs=s1*Math.sin(a2)+c1*Math.cos(a2)*Math.cos(dz); const sep=Math.acos(Math.max(-1,Math.min(1,cs)));
    if(sep<best){ best=sep; bi=i; } }
  const sepDeg=best/D2R, Lp=(bi*2)%360;
  let s=Math.floor(Lp/30);
  if(sepDeg>45) s=null;
  else if(POINT.s!=null){ const d=((Lp-POINT.s*30)%360+360)%360; if(d<=32||d>=358) s=POINT.s; }
  POINT={s,L:Lp,sep:sepDeg};
  return POINT;
}
const litGoal=s=>{ const p=focusSignNow!=null?focusSignNow:POINT.s; return p!=null&&s===p?LIT.on:LIT.rest; };
/* how lit a figure is on its own scale: 0 while it rests, 1 when it is the one pointed at */
const litQ=w=>Math.max(0,Math.min(1,(w-LIT.rest)/(1-LIT.rest)));
const litOf=s=>ART_W[s];
let QUIET=false;   /* test states: no toasts, no motion pill (screenshots must compare) */
let revealBelow=false;   /* ground as glass to show a target that is below the horizon */
let vFov=62;                            /* vertical field of view, degrees */
const FOV_MIN=10, FOV_MAX=112;
/* past the widest field the ground falls away: orr 0 = the sky, 1 = the zodiac from above
   the Earth (orrery.js). One zoom scalar runs through both so a pinch never "ends". */
/* The pull-out used to complete inside a single quick pinch — 70 field-units of
   travel — so the eye saw the ground and then the whole Earth, nothing between
   (Sangram: "it instantly lands and instantly shows the full Earth"). Twice
   the travel now, and the ascent itself can never take under 1.4 s. */
const ORR_SPAN=150; let orr=0, wantOrr=0, orrSide=false, wheelT=null;
const ORR_MIN_MS=1400;
/* zoomed out, a drag turns the whole system: sideways spins the Earth and its ring together,
   up and down tips the ring from edge-on toward a plan view */
/* the drag sets a TARGET; the view chases it. Raw per-event updates read as jumpy on iOS,
   which coalesces pointer moves, and the same is true of the date: it now travels day by
   day toward where the finger asks rather than teleporting there. */
let orrSpin=0, orrPitch=0, wantSpin=0, wantPitch=0, orrBase=null, orrAsc=null, seekTargetMs=null;
/* the Earth's turn since the pull-out began, degrees: the globe rotates by this while the ring holds */
const orrSidereal=()=>orrBase==null?0:(((skyDate().getTime()-orrBase)/86164090.5*360)%360+360)%360;
/* zoomed out, time is the wrong scale: a whole day moves only the Moon. The rail becomes a
   year, so every graha visibly walks the ring and the rashis change under them. */
/* six months across the rail, not a year: the point is to WATCH the grahas walk, and a
   year's worth of days under one thumb travels faster than the eye can follow */
const YEAR_MS=182*864e5;
const orrTime=()=>orr>0.5;
/* one control in both views (Sangram, 6 Sep: 'the scrubber should be consistent and
   move hour by hour even when zoomed out') — a day per slider height everywhere */
const seekSpan=()=>864e5;
const zoomOf=()=>wantOrr>0?FOV_MAX+ORR_SPAN*wantOrr:vFov;
function setZoom(z){ z=Math.max(FOV_MIN,Math.min(FOV_MAX+ORR_SPAN,z)); vFov=Math.min(FOV_MAX,z); wantOrr=Math.max(0,Math.min(1,(z-FOV_MAX)/ORR_SPAN)); }

/* the default sky is a city centre, not anyone's birthplace */
let spot={lat:12.9716, lon:77.5946, from:"Bengaluru (approximate)", tz:"Asia/Kolkata"};
let cache=null, cacheAt=0, target=null, focusK=0;
let mode="now", birthOpts=null, proUser=false, custom=null;
let seek=null;        /* Now/custom mode: a scrubbed absolute Date, or null = live */
let birthSeek=null;   /* Birth mode: a scrubbed absolute Date, or null = natal */
let ghostBirth=false, trackTarget=false;
let lastFrame=0, layers=null, uiTimer=null, hintStep=0;
let tween=null;       /* {from:{g:L}, t0, ms} for the Birth->Now fast-forward */
/* the compass rose, measured off Apple's dial: 16 marks every 22.5 degrees, the cardinals
   longer and brighter, north drawn as the red pointer instead of a mark. The rose turns as
   a whole; the N in the middle stays upright, the way a compass card reads. Rotation is an
   SVG transform about an explicit centre (24,24) — a CSS transform on a positioned element
   would lose its centring translate. */
const ROSE=(()=>{ let out="";
  for(let i=1;i<16;i++){ const a=i*22.5*Math.PI/180, card=(i%4===0), R=21.2, r=card?16.4:18.3;
    out+=`<line x1="${(24+R*Math.sin(a)).toFixed(2)}" y1="${(24-R*Math.cos(a)).toFixed(2)}" x2="${(24+r*Math.sin(a)).toFixed(2)}" y2="${(24-r*Math.cos(a)).toFixed(2)}"${card?' class="c"':""}/>`; }
  return out; })();

const LAYER_DEFAULT={planets:true,rashis:true,naks:true,art:true,horizon:true,stars:true,starNames:false,sanskrit:false};

/* THE CLOUD FIELD, built once and never rebuilt.
   Fixed azimuth and altitude, so a cloud stays over the same part of the
   horizon however the phone is turned — the thing that separates a sky from a
   backdrop. Deterministic: the same seed every launch, so the sky a reader
   learns is the sky they come back to. Every cloud sits under 26 degrees of
   altitude, low where real weather stacks and where no reading happens. */
const CLOUDS=(()=>{
  let s0=20260907;                                   /* a fixed seed, not Math.random */
  const r=()=>{ s0=(s0*1103515245+12345)&0x7fffffff; return s0/0x7fffffff; };
  const out=[];
  for(let i=0;i<34;i++){
    const w=5+r()*11;
    const puffs=[];
    /* the vertical was being squashed TWICE — once by the puff spread and again
       by the ellipse scale below — which made streaks rather than clouds. The
       spread is wider now and the puffs sit a little above centre, so the top
       piles and the base stays flat, which is what a cumulus looks like. */
    const n=4+Math.floor(r()*4);
    for(let j=0;j<n;j++)
      puffs.push([(r()-0.5)*1.05, (r()-0.62)*0.62, 0.34+r()*0.30, 0.55+r()*0.45]);
    /* spread up the sky, not squashed onto the horizon: r()*r() piled them
       all into the first few degrees, where the haze band washes them out and
       the ridges cover what is left */
    out.push({ az:r()*360, alt:5+r()*32, w, h:w*(0.40+r()*0.24),
               a:0.42+r()*0.34, p:puffs });
  }
  /* sprite dressing, drawn from the same seed AFTER every position is fixed,
     so the field above is exactly the field it was: which of the three
     cumulus sprites (by index), a size, a mirror, and how solid it paints
     (the puff density 0.42..0.76 was tuned for translucent gradients; a
     photograph of a cloud reads at 0.72..1.0) */
  for(let i=0;i<out.length;i++){ const cl=out[i];
    /* SMALL AND CALM (Sangram, 6 Sep: one tower was filling most of the screen).
       The wide cloud-a and the wisp cloud-c carry the field; the tower cloud-b
       is one cloud in five and never large. The visible span, degrees across:
       most 5-9, one in seven up to 14, the tower 5-7. The old 5-16-degree puff
       width is re-derived from that span (a sprite's cloud fills about 1.25w,
       see the draw) and the height keeps its ratio, so the puff fallback
       shrinks with the sprites; positions are untouched. One cloud in three
       rests, so a 90-degree view holds about six, not nine. */
    cl.k=[0,2,0,2,1][i%5];
    const u=r(), deg=cl.k===1?5+u*2:(i%7===3?9+u*5:5+u*4);
    const ratio=cl.h/cl.w; cl.w=deg/1.25; cl.h=cl.w*ratio;
    cl.m=r()<0.5; cl.o=0.72+0.28*(cl.a-0.42)/0.34; cl.on=i%3!==2; }
  return out;
})();
/* display radius per body (px): a controlled informational scale, not angular size;
   grows gently as the field narrows so close views stay balanced */
const R_BASE={Sun:26,Moon:22,Rahu:15,Ketu:15};
const grahaR=(g,fov)=>Math.round((R_BASE[g]||19)*Math.max(0.78,Math.min(1.6,Math.pow(62/(fov||62),0.3))));
function loadLayers(){ try{ layers={...LAYER_DEFAULT,...JSON.parse(localStorage.getItem("astro.sky.layers")||"{}")}; }catch(_){ layers={...LAYER_DEFAULT}; }
  layers.horizon=true;   /* not a choice any more (Sangram, 6 Sep): the ground is always there */
  /* Planets is no longer a switch (Sangram, 5 Sep): a sky with the grahas hidden is
     a foot-gun, not a preference. A stored false from the old panel is ignored. */
  layers.planets=true; }
function saveLayers(){ try{ localStorage.setItem("astro.sky.layers",JSON.stringify(layers)); }catch(_){} }

const skyDate=()=>mode==="birth"?(birthSeek||new Date(birthOpts.date))
  :(seek||(custom?new Date(custom.iso):new Date()));
const skySpot=()=>mode==="birth"?{lat:birthOpts.lat,lon:birthOpts.lon}:custom?custom:spot;
const skyTz=()=>mode==="birth"?(birthOpts.tz||"Asia/Kolkata"):custom?(custom.tz||null):(spot.tz||Intl.DateTimeFormat().resolvedOptions().timeZone);
const cacheKey=()=>mode+"|"+(mode==="birth"?(birthSeek?birthSeek.getTime():"b")
  :(seek?seek.getTime():custom?custom.iso+custom.lat:"live"));
const wrap=a=>((a+180)%360+360)%360-180;
const clampAlt=a=>Math.max(-60,Math.min(85,a));
/* Safari has no Vibration API on any version, so the sky was silent on iPhone too.
   Same label-through-switch route as app.js: an enhancement where it works, a no-op
   where it does not. */
let SKYTAP=null;
const buzz=n=>{ try{
  if(navigator.vibrate) return void navigator.vibrate(n);
  if(!SKYTAP){ const l=document.createElement("label");
    l.setAttribute("aria-hidden","true");
    l.style.cssText="position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none";
    const b=document.createElement("input"); b.type="checkbox"; b.setAttribute("switch",""); b.tabIndex=-1;
    l.appendChild(b); document.body.appendChild(l); SKYTAP=l; }
  const was=document.activeElement; SKYTAP.click();
  if(was&&document.activeElement!==was&&was.focus) was.focus({preventScroll:true});
}catch(_){} };
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ====================================================================
   SKY MODEL — one compute per moment, cached
   ==================================================================== */
function computeSky(){
  const d=skyDate(), sp=skySpot();
  const pos=positions(d), ret=retrograde(d), lats=eclipticLatitudes(d);
  if(tween){ const k=Math.min(1,(performance.now()-tween.t0)/tween.ms);
    const e=1-Math.pow(1-k,3);
    for(const g of GRAHAS){ const a=tween.from[g], b=pos[g];
      let dl=((b-a)%360+360)%360; if(dl>180) dl-=360;
      pos[g]=((a+dl*e)%360+360)%360; }
    if(k>=1) tween=null; }
  const sunT=(mode==="birth"||custom||seek)?null:null;
  cache={
    mode, key:cacheKey(), d, sp,
    grahas:GRAHAS.map(g=>({g, retro:ret[g], L:pos[g], B:lats[g], ...siderealPointAltAzB(pos[g], lats[g], d, sp.lat, sp.lon)})),
    stars:STARS.map((s,i)=>({...s, nak:NAKS[i], ...raDecToAltAz(s.ra, s.dec, d, sp.lat, sp.lon)})),
    zod:ZODIAC.map(Z=>({lines:Z.lines, pts:Z.stars.map(st=>({m:st.m, ...raDecToAltAz(st.ra, st.dec, d, sp.lat, sp.lon)}))})),
    asts:ASTERISMS.map(A=>({lines:A.lines,
      pts:A.stars.map(s=>({m:s.m, ...raDecToAltAz(s.ra, s.dec, d, sp.lat, sp.lon)}))})),
    amb:AMBIENT.map(s=>({m:s.m, ...raDecToAltAz(s.ra, s.dec, d, sp.lat, sp.lon)})),
    amb2:AMBIENT.map(s=>({m:s.m, ...raDecToAltAz((s.ra+137.5)%360, -s.dec*0.93, d, sp.lat, sp.lon)})),
    mw:MW.map(p=>({w:p.w, ...raDecToAltAz(p.ra, p.dec, d, sp.lat, sp.lon)})),
    ecl:Array.from({length:181},(_,i)=>{ const L=i*2; return {L, ...siderealPointAltAz(L, d, sp.lat, sp.lon)}; }),
    /* the belt's two edges, ±BAND_B° of ecliptic latitude: the band is drawn as the true
       region between them, so it curves and widens the way a ring seen from inside does */
    eclN:Array.from({length:181},(_,i)=>{ const L=i*2; return {L, ...siderealPointAltAzB(L, BAND_B, d, sp.lat, sp.lon)}; }),
    eclS:Array.from({length:181},(_,i)=>{ const L=i*2; return {L, ...siderealPointAltAzB(L, -BAND_B, d, sp.lat, sp.lon)}; }),
    rashiMid:Array.from({length:12},(_,i)=>siderealPointAltAz(i*30+15, d, sp.lat, sp.lon)),
    nakMid:Array.from({length:27},(_,i)=>siderealPointAltAz(i*NSPAN+NSPAN/2, d, sp.lat, sp.lon)),
    nakEdge:Array.from({length:27},(_,i)=>siderealPointAltAz(i*NSPAN, d, sp.lat, sp.lon)),
    asc:(mode==="birth"&&birthOpts&&birthOpts.asc!=null)?siderealPointAltAz(birthOpts.asc, d, sp.lat, sp.lon):null,
    ghost:(mode!=="birth"&&ghostBirth&&target&&target.t==="graha"&&birthOpts&&birthOpts.natal&&birthOpts.natal[target.g]!=null)
      ?siderealPointAltAz(birthOpts.natal[target.g], d, sp.lat, sp.lon):null,
  };
  cache.sunAlt=cache.grahas[0].alt;
  cache.sunAz=cache.grahas[0].az;    /* the clouds take their lit edge from this */
  cacheAt=Date.now();
  if(tween) cache.key="tween"+performance.now();
}

/* ====================================================================
   CAMERA — perspective projection about the view direction
   ==================================================================== */
const D2R=Math.PI/180;
/* at most two device pixels per CSS pixel: a 3x phone was pushing ~9 MP through four
   full-screen fills every frame, and frame rate is what 'soft' means (Sangram, 6 Sep) */
const SKY_DPR=Math.min(2,(typeof devicePixelRatio=="number"&&devicePixelRatio)||1);
let CAM={W:0,H:0,F:1,r:[1,0,0],u:[0,0,1],f:[0,1,0]};
function updateCamera(W,H){
  CAM.W=W; CAM.H=H;
  /* the first stretch of a pull-out is still a zoom-out: twelve more degrees of
     sky before the ground starts to curve (Sangram: "you should be able to
     zoom out a lil more without showing earth's curvature") */
  const zs=Math.max(0,Math.min(1,orr/0.30)), fovEff=vFov+12*zs*zs*(3-2*zs);
  /* STEREOGRAPHIC, not gnomonic (Sangram, 6 Sep: "add some curve to the band… do not make
     it very straight"). Under the gnomonic every great circle was a straight line, so the
     belt could never curve and a wide view stretched its edges. The stereographic keeps
     angles, turns great circles into gentle arcs (the belt bows the way a ring seen from
     inside does) and holds the edges of a 100° view in proportion — Stellarium's default
     for the same reasons. F is the scale at the centre, px per radian; the screen's
     half-height still lands exactly fov/2 from the centre. */
  CAM.F=H/(4*Math.tan(fovEff*D2R/4));
  const B=camBasis||basisFromAzAlt(viewAz,viewAlt);   /* the phone's rotation, or the level drag camera */
  CAM.f=B.f; CAM.r=B.r; CAM.u=B.u;
}
/* for the pane and for tools: where the camera looks right now */
if(typeof window!=="undefined") window.__skyCam=()=>({az:viewAz,alt:viewAlt,f:CAM.f.slice(),u:CAM.u.slice(),sensing,followSky,rolled:!!camBasis,pointed:pointedSign,mids:cache?cache.rashiMid.map(m=>({az:+m.az.toFixed(1),alt:+m.alt.toFixed(1),up:m.up})):null});
/* returns [x, y, depth] with depth<=0 meaning behind the camera */
const vecOf=p=>{ const a=p.alt*D2R, z=p.az*D2R; return [Math.cos(a)*Math.sin(z), Math.cos(a)*Math.cos(z), Math.sin(a)]; };
const azAltOfV=v=>({az:((Math.atan2(v[0],v[1])/D2R)%360+360)%360, alt:Math.asin(Math.max(-1,Math.min(1,v[2])))/D2R});
function project(p){ return projectV(vecOf(p)); }
/* the same projection for a unit direction in the horizon frame (x east, y north, z up) */
function projectV(v){
  const X=v[0]*CAM.r[0]+v[1]*CAM.r[1]+v[2]*CAM.r[2];
  const Y=v[0]*CAM.u[0]+v[1]*CAM.u[1]+v[2]*CAM.u[2];
  const Zc=v[0]*CAM.f[0]+v[1]*CAM.f[1]+v[2]*CAM.f[2];
  if(Zc<=0.04) return [NaN,NaN,Zc];
  const k=2*CAM.F/(1+Zc);                 /* stereographic: r = 2F·tan(θ/2) */
  return [CAM.W/2+k*X, CAM.H/2-k*Y, Zc];
}
const ppdCenter=()=>CAM.F*D2R;          /* px per degree at the centre */
const onScreen=(x,y,m=0)=>Number.isFinite(x)&&x>-m&&x<CAM.W+m&&y>-m&&y<CAM.H+m;

/* the land across the visible sky, in slices of LSLICE degrees of azimuth. A
   line of constant azimuth is straight under this projection, so a slice is a
   straight-sided quad; it is split at the horizon row so the skyline lands
   exactly on alt 0. Each half is NOT one affine: at the edge of a wide view a
   line of constant altitude runs at a slope of tan(alt)·sin(θ) to the horizon,
   so the far edge of the quad is tilted and one parallelogram misses a corner
   by several pixels (a stepped skyline, striped meadow). Each half is two
   triangles instead, every corner exact, each clipped to its own triangle
   grown by half a device pixel so the anti-aliased clip edges of neighbours
   overlap rather than leave a hairline. By day the slices go straight to the
   canvas; at night, or with the ground turned to glass, they go through one
   offscreen canvas so a single tint and a single alpha apply to the whole
   land rather than to each overlapping triangle. */
const LP=new Float64Array(12), LT=new Float64Array(6);
function lproj(az,alt,i){
  const a=alt*D2R, z=az*D2R, ca=Math.cos(a);
  const vx=ca*Math.sin(z), vy=ca*Math.cos(z), vz=Math.sin(a);
  const Zc=vx*CAM.f[0]+vy*CAM.f[1]+vz*CAM.f[2];
  if(Zc<=0.04){ LP[2*i]=NaN; LP[2*i+1]=NaN; return Zc; }
  const X=vx*CAM.r[0]+vy*CAM.r[1]+vz*CAM.r[2], Y=vx*CAM.u[0]+vy*CAM.u[1]+vz*CAM.u[2];
  const k=2*CAM.F/(1+Zc);                 /* the same stereographic as projectV */
  LP[2*i]=CAM.W/2+k*X; LP[2*i+1]=CAM.H/2-k*Y; return Zc;
}
/* the triangle (x0,y0)(x1,y1)(x2,y2) with every edge pushed outward by e, into LT; false when degenerate */
function growTri(x0,y0,x1,y1,x2,y2,e){
  const cr=(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0); if(!(Math.abs(cr)>1e-4)) return false;
  const sg=cr>0?1:-1;
  /* outward unit normals of the three edges 01, 12, 20 */
  let d=Math.hypot(x1-x0,y1-y0)||1, n0x=sg*(y1-y0)/d, n0y=-sg*(x1-x0)/d;
  d=Math.hypot(x2-x1,y2-y1)||1; const n1x=sg*(y2-y1)/d, n1y=-sg*(x2-x1)/d;
  d=Math.hypot(x0-x2,y0-y2)||1; const n2x=sg*(y0-y2)/d, n2y=-sg*(x0-x2)/d;
  /* each vertex moves to where its two offset edges meet; a very sharp tip is capped */
  const at=(i,x,y,ax,ay,bx,by)=>{ const det=ax*by-ay*bx; let qx,qy;
    if(Math.abs(det)<1e-3){ qx=(ax+bx)*e; qy=(ay+by)*e; } else { qx=e*(by-ay)/det; qy=e*(ax-bx)/det; }
    const q=Math.hypot(qx,qy), cap=4*e; if(q>cap){ qx*=cap/q; qy*=cap/q; }
    LT[2*i]=x+qx; LT[2*i+1]=y+qy; };
  at(0,x0,y0,n2x,n2y,n0x,n0y); at(1,x1,y1,n0x,n0y,n1x,n1y); at(2,x2,y2,n1x,n1y,n2x,n2y);
  return true;
}
function drawLand(c,W,H,ga,day){
  const L=LAND, img=L.img, sx=L.sx, eye=L.eye, h=L.h, gh=h-eye, n=sx.length>>1;
  const direct=day>=0.999&&ga>=1, dpr=SKY_DPR, ex=0.6/dpr;
  let g=c;
  if(!direct){
    const pw=el.canvas.width, ph=el.canvas.height;
    if(!L.cv) L.cv=document.createElement("canvas");
    if(L.cv.width!==pw||L.cv.height!==ph){ L.cv.width=pw; L.cv.height=ph; }
    g=L.cv.getContext("2d"); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,pw,ph);
    g.setTransform(dpr,0,0,dpr,0,0);
  }
  const M=g.getTransform(), ma=M.a, mb=M.b, mc=M.c, md=M.d, me=M.e, mf=M.f;
  const setT=(a,b,cc,d,e,f)=>g.setTransform(ma*a+mc*b,mb*a+md*b,ma*cc+mc*d,mb*cc+md*d,ma*e+mc*f+me,mb*e+md*f+mf);
  /* one triangle: clip to it (grown), map the source band through the affine, draw the band */
  const tri=(x0,y0,x1,y1,x2,y2,a,b,cc,d,e,f,sy,sh,xl,sw)=>{
    if(!growTri(x0,y0,x1,y1,x2,y2,ex)) return;
    g.save(); g.beginPath(); g.moveTo(LT[0],LT[1]); g.lineTo(LT[2],LT[3]); g.lineTo(LT[4],LT[5]); g.closePath(); g.clip();
    setT(a,b,cc,d,e,f); g.drawImage(img,xl,sy,sw,sh,xl,sy,sw,sh); g.restore(); };
  const m=24;
  for(let k=0;k<n;k++){
    const a0=k*LSLICE, a1=a0+LSLICE;
    if(!(lproj(a0,0,0)>0.04&&lproj(a1,0,1)>0.04)) continue;      /* both horizon points in front of the camera */
    const H0x=LP[0], H0y=LP[1], H1x=LP[2], H1y=LP[3];
    const x0=sx[2*k], x1=sx[2*k+1], dx=x1-x0, xl=Math.min(x0,x1)-LEDGE, sw=Math.abs(dx)+2*LEDGE;
    const a=(H1x-H0x)/dx, b=(H1y-H0y)/dx;
    /* the sky half: rows 0..eye. Triangles H0 H1 T0 and H1 T1 T0 */
    if(lproj(a0,L.top,2)>0.04&&lproj(a1,L.top,3)>0.04){
      const T0x=LP[4], T0y=LP[5], T1x=LP[6], T1y=LP[7];
      if(!(Math.max(H0x,H1x,T0x,T1x)<-m||Math.min(H0x,H1x,T0x,T1x)>W+m||Math.max(H0y,H1y,T0y,T1y)<-m||Math.min(H0y,H1y,T0y,T1y)>H+m)){
        const cc=(H0x-T0x)/eye, d=(H0y-T0y)/eye;
        tri(H0x,H0y,H1x,H1y,T0x,T0y, a,b,cc,d,H0x-a*x0-cc*eye,H0y-b*x0-d*eye, 0,eye+LEDGE,xl,sw);
        const a2=(T1x-T0x)/dx, b2=(T1y-T0y)/dx, c2=(H1x-T1x)/eye, d2=(H1y-T1y)/eye;
        tri(H1x,H1y,T1x,T1y,T0x,T0y, a2,b2,c2,d2,T1x-a2*x1,T1y-b2*x1, 0,eye+LEDGE,xl,sw);
      }
    }
    /* the ground half: rows eye..h. Triangles H0 H1 B0 and H1 B1 B0 */
    if(lproj(a0,L.bot,4)>0.04&&lproj(a1,L.bot,5)>0.04){
      const B0x=LP[8], B0y=LP[9], B1x=LP[10], B1y=LP[11];
      if(!(Math.max(H0x,H1x,B0x,B1x)<-m||Math.min(H0x,H1x,B0x,B1x)>W+m||Math.max(H0y,H1y,B0y,B1y)<-m||Math.min(H0y,H1y,B0y,B1y)>H+m)){
        const cc=(B0x-H0x)/gh, d=(B0y-H0y)/gh;
        tri(H0x,H0y,H1x,H1y,B0x,B0y, a,b,cc,d,H0x-a*x0-cc*eye,H0y-b*x0-d*eye, eye-LEDGE,gh+LEDGE,xl,sw);
        const a2=(B1x-B0x)/dx, b2=(B1y-B0y)/dx, c2=(B1x-H1x)/gh, d2=(B1y-H1y)/gh;
        tri(H1x,H1y,B1x,B1y,B0x,B0y, a2,b2,c2,d2,B1x-a2*x1-c2*h,B1y-b2*x1-d2*h, eye-LEDGE,gh+LEDGE,xl,sw);
      }
    }
  }
  g.setTransform(ma,mb,mc,md,me,mf);
  if(!direct){
    const tint=0.82*(1-day);
    if(tint>0.002){ g.globalCompositeOperation="source-atop"; g.fillStyle=`rgba(10,14,34,${tint.toFixed(3)})`; g.fillRect(0,0,W,H); g.globalCompositeOperation="source-over"; }
    const ga0=c.globalAlpha; c.globalAlpha=ga; c.drawImage(L.cv,0,0,W,H); c.globalAlpha=ga0;
  }
}

/* ====================================================================
   CONSTELLATION FIT - where a rashi's figure sits and which way it lies
   --------------------------------------------------------------------
   Sangram, 5 Sep, Star Walk 2 as the bar: the picture must sit ON its
   stars. A sidereal rashi is a 30-degree slice of ecliptic; the shape the
   eye joins is the constellation's line figure (zodiac-lines.js), so the
   artwork is registered to THAT: the mean direction of the figure's stars,
   the principal axis of their spread in the tangent plane there (a 2-D
   PCA, gnomonic about the mean) and their extent along and across it.
   Cached on the sky cache, so it is recomputed exactly when the stars are
   and never per frame.
   ==================================================================== */
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit3=v=>{ const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; };
const wrapPi=a=>Math.atan2(Math.sin(a),Math.cos(a));
const ART_LAST=new Array(12).fill(null);   /* what was drawn this frame, for the pane */
/* the lamp, from outside: which rashi is lit, how far the light has travelled toward it, and
   what every figure is carrying this frame. validate_rashi_lamp.mjs reads exactly this. */
if(typeof window!=="undefined") window.__skyArt=()=>({
  pointed:POINT.s, sep:+POINT.sep.toFixed(2), focus:focusSignNow,
  weights:Array.from(ART_W,v=>+v.toFixed(3)),
  lit:Array.from(ART_W,v=>+litQ(v).toFixed(3)),
  drawn:ART_LAST.map((L,s)=>L?{sign:s+1,name:SIGNS_EN[s],lit:L.lit,weight:L.weight}:null).filter(Boolean),
  baked:{ink:Object.keys(ART_INK).length,lamp:Object.keys(ART_LIT).length}});
/* which end of a figure's star axis it faces: the index (in zodiac-lines.js) of the star
   its FRONT lies toward - the head of a tall figure, the facing side of a wide one. No
   geometry decides this: the ram's head is its low-longitude end (Hamal), the twins' heads
   their high-longitude end (Castor). Unlisted figures fall back to ecliptic-north-up. */
const ART_FRONT={1:0 /* Hamal: the ram's head */, 3:0 /* Castor: the twins' heads */, 9:1 /* Kaus Media: the archer's bow */};
function artFit(s){
  const F=cache.artFit||(cache.artFit=[]);
  if(F[s]!==undefined) return F[s];
  const Z=cache.zod[s]; if(!Z||Z.pts.length<3) return (F[s]=null);
  const t0=performance.now();
  const vs=Z.pts.map(vecOf);
  let m=[0,0,0]; for(const v of vs){ m[0]+=v[0]; m[1]+=v[1]; m[2]+=v[2]; } m=unit3(m);
  let t1=cross3(m,[0,0,1]); if(Math.hypot(t1[0],t1[1],t1[2])<1e-6) t1=cross3(m,[0,1,0]); t1=unit3(t1);
  const t2=cross3(t1,m);                                        /* right and up in the tangent plane at m */
  const xy=vs.map(v=>{ const z=dot3(v,m); return [dot3(v,t1)/z, dot3(v,t2)/z]; });   /* gnomonic about m */
  let mx=0,my=0; for(const p of xy){ mx+=p[0]; my+=p[1]; } mx/=xy.length; my/=xy.length;
  let sxx=0,sxy=0,syy=0; for(const [x,y] of xy){ sxx+=(x-mx)*(x-mx); sxy+=(x-mx)*(y-my); syy+=(y-my)*(y-my); }
  const th=0.5*Math.atan2(2*sxy,sxx-syy);                        /* the principal axis, modulo a half turn */
  /* the box the stars fill in a frame turned by psi: extent along it and across it, degrees */
  const ext=psi=>{ const c=Math.cos(psi), s2=Math.sin(psi); let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    for(const [x,y] of xy){ const a=(x-mx)*c+(y-my)*s2, b=(y-my)*c-(x-mx)*s2; if(a<a0)a0=a; if(a>a1)a1=a; if(b<b0)b0=b; if(b>b1)b1=b; }
    return {a0,a1,b0,b1, along:(Math.atan(a1)-Math.atan(a0))/D2R, across:(Math.atan(b1)-Math.atan(b0))/D2R}; };
  const pa=ext(th);
  /* the reference orientation: image-x along DEcreasing longitude, so the image's up is
     the ecliptic north - a figure standing on the ribbon, head to the north ecliptic pole.
     (The old rule ran image-x along increasing longitude, which stood every figure on its
     head south of the zenith; that was the intent, not the result.) */
  const e1=vecOf(cache.ecl[s*15+2]), e2=vecOf(cache.ecl[s*15+13]);
  const dv=[e1[0]-e2[0],e1[1]-e2[1],e1[2]-e2[2]];
  const psiRef=Math.atan2(dot3(dv,t2),dot3(dv,t1));
  const mean=azAltOfV(m);
  return (F[s]={m,t1,t2,xy,mx,my,th,ext,psiRef,spanAlong:pa.along,spanAcross:pa.across,meanAz:mean.az,meanAlt:mean.alt,ms:performance.now()-t0,place:null});
}
/* the placement for one image-x direction psi: the box the stars fill in that frame,
   its centre as a sky direction, and two points five degrees either side along
   image-x, from which each frame reads the screen rotation and the local scale */
function artPlace(f,psi){
  if(f.place&&f.place.psi===psi) return f.place;
  const e=f.ext(psi), c=Math.cos(psi), s2=Math.sin(psi);
  const cA=(e.a0+e.a1)/2, cB=(e.b0+e.b1)/2, cx=f.mx+cA*c-cB*s2, cy=f.my+cA*s2+cB*c;
  const C=unit3([f.m[0]+cx*f.t1[0]+cy*f.t2[0], f.m[1]+cx*f.t1[1]+cy*f.t2[1], f.m[2]+cx*f.t1[2]+cy*f.t2[2]]);
  let X=[c*f.t1[0]+s2*f.t2[0], c*f.t1[1]+s2*f.t2[1], c*f.t1[2]+s2*f.t2[2]];
  const k=dot3(X,C); X=unit3([X[0]-k*C[0],X[1]-k*C[1],X[2]-k*C[2]]);        /* tangent again at C */
  const h=5*D2R, ch=Math.cos(h), sh=Math.sin(h);
  const P0=[C[0]*ch-X[0]*sh, C[1]*ch-X[1]*sh, C[2]*ch-X[2]*sh], P1=[C[0]*ch+X[0]*sh, C[1]*ch+X[1]*sh, C[2]*ch+X[2]*sh];
  const aa=azAltOfV(C);
  return (f.place={psi,C,P0,P1,spanX:e.along,spanY:e.across,az:aa.az,alt:aa.alt});
}
/* for the pane: the fit of every rashi, and what was last drawn for those with artwork */
if(typeof window!=="undefined") window.__skyArtFit=()=>{ if(!cache) return [];
  return Array.from({length:12},(_,s)=>{ const f=artFit(s); if(!f) return {sign:s+1,name:SIGNS_EN[s]};
    const L=ART_LAST[s], P=artPlace(f,L?L.psi:f.psiRef);
    return {sign:s+1,name:SIGNS_EN[s],stars:cache.zod[s].pts.length,hasArt:!!RASHI_ART[s+1],
      anchorAz:+P.az.toFixed(2),anchorAlt:+P.alt.toFixed(2),meanAz:+f.meanAz.toFixed(2),meanAlt:+f.meanAlt.toFixed(2),
      axisDeg:+(f.th/D2R).toFixed(1),refDeg:+(f.psiRef/D2R).toFixed(1),spanAlong:+f.spanAlong.toFixed(2),spanAcross:+f.spanAcross.toFixed(2),
      scale:L?+L.scale.toFixed(3):null,drawW:L?Math.round(L.w):null,drawH:L?Math.round(L.h):null,rotDeg:L?+L.rot.toFixed(1):null,fitMs:+f.ms.toFixed(3)}; }); };

/* ====================================================================
   DRAWING PRIMITIVES
   ==================================================================== */
function glowDot(c,x,y,r,rgb,a){
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(${rgb},${a})`); g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,7); c.fill();
}
function starSprite(c,x,y,m,a){
  const r=m<=0.2?3.2:m<=1.2?2.7:m<=2.4?2.1:m<=3.2?1.7:1.3;
  glowDot(c,x,y,r*5,"228,234,255",.28*a);
  c.fillStyle=`rgba(240,244,255,${.92*a})`;
  c.beginPath(); c.arc(x,y,r,0,7); c.fill();
}
/* TWO KINDS OF TEXT ON THE SKY, and they were the same kind before.
   A 3 px hard stroke round every label is a videogame HUD, and it was the cheapest-looking
   thing on the screen. What replaced it:
   · haloText — for the sky's OWN ink: the engraved band names, the Devanagari sign glyphs,
     star names. These belong to the instrument and should look pressed into it, so the hard
     stroke becomes a soft dark bloom that lifts them off a busy figure without outlining them.
   · plateText — for text a person has to READ: a graha's name and its rashi/nakshatra line,
     the selected target, the find-mode direction. These sit on a compact rounded backplate in
     the instrument's own indigo (warm paper by day), so they are legible over any figure
     without a single stroke. */
function haloText(c,txt,x,y,fill,font,align="center",halo="rgba(6,7,20,.75)"){
  c.font=font; c.textAlign=align; c.textBaseline="middle";
  c.save();
  c.shadowColor=halo; c.shadowBlur=6; c.fillStyle=fill;
  c.fillText(txt,x,y);                                   /* twice: one pass is too faint to carry */
  c.shadowBlur=3; c.fillText(txt,x,y);
  c.restore();
  c.fillStyle=fill; c.fillText(txt,x,y);
}
function roundRect(c,x,y,w,h,r){ c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function plateText(c,txt,x,y,fill,font,a=1,lightGround=false){
  c.font=font; c.textAlign="center"; c.textBaseline="middle";
  const w=c.measureText(txt).width, px=7, py=4;
  const m=c.measureText("M"), asc=m.actualBoundingBoxAscent||8, desc=m.actualBoundingBoxDescent||3;
  const h=asc+desc;
  c.save();
  c.fillStyle=lightGround?`rgba(255,252,246,${0.93*a})`:`rgba(14,16,36,${0.90*a})`;
  roundRect(c,x-w/2-px,y-h/2-py,w+2*px,h+2*py,(h+2*py)/2); c.fill();
  c.strokeStyle=lightGround?`rgba(60,54,90,${0.14*a})`:`rgba(214,180,110,${0.16*a})`;
  c.lineWidth=0.7; c.stroke();
  c.fillStyle=fill; c.fillText(txt,x,y);
  c.restore();
}
/* the Moon with its real phase: bright limb toward the Sun's screen direction */
function moonDisc(c,x,y,R,sunXY,k,waxing){
  const im=IMG.Moon;
  c.save(); c.beginPath(); c.arc(x,y,R,0,7); c.clip();
  c.globalAlpha=0.22; if(im.complete) c.drawImage(im,x-R,y-R,2*R,2*R);
  c.globalAlpha=1;
  const ang=Math.atan2(sunXY[1]-y, sunXY[0]-x);
  c.translate(x,y); c.rotate(ang);
  const rx=R*Math.abs(2*k-1);
  c.beginPath();
  c.moveTo(0,-R); c.arc(0,0,R,-Math.PI/2,Math.PI/2,false);
  c.ellipse(0,0,Math.max(rx,0.01),R,0,Math.PI/2,3*Math.PI/2,k<0.5);
  c.closePath(); c.clip();
  c.rotate(-ang); c.translate(-x,-y);
  if(im.complete) c.drawImage(im,x-R,y-R,2*R,2*R);
  c.restore();
}
/* Rahu/Ketu: a node, not a lamp — a quiet ring with a stroke, no glow */
function nodeGlyph(c,x,y,R,a,ketu){
  c.save(); c.globalAlpha=a;
  c.strokeStyle="rgba(190,180,236,.9)"; c.lineWidth=1.4; c.setLineDash([3,3]);
  c.beginPath(); c.arc(x,y,R*0.78,0,7); c.stroke(); c.setLineDash([]);
  c.fillStyle="rgba(190,180,236,.95)"; c.beginPath(); c.arc(x,y,2.2,0,7); c.fill();
  c.beginPath(); c.moveTo(x,y-R*0.78); c.lineTo(x,y-R*1.15); c.moveTo(x,y+R*0.78); c.lineTo(x,y+R*1.15);
  if(ketu){ c.moveTo(x-R*0.78,y); c.lineTo(x-R*1.15,y); c.moveTo(x+R*0.78,y); c.lineTo(x+R*1.15,y); }
  c.stroke(); c.restore();
}

/* ====================================================================
   LABEL ENGINE — priority-ordered, collision-aware, screen-horizontal
   ==================================================================== */
const PAD={top:200,bottom:60};
let UI_RECTS={at:0,list:[]};
function makeLedger(){
  /* the chrome is reserved by its REAL rectangles (date pill, close, time chip, side stack,
     the foot card when open), read from the DOM a few times a second — a blanket 200 px at
     the top left every planet near the top of the screen nameless (7 Sep) */
  PAD.top=8; PAD.bottom=target?(el?.root.classList.contains("hascard")?330:60):60;
  const boxes=[];
  if(el&&performance.now()-UI_RECTS.at>250){ UI_RECTS={at:performance.now(),list:[]};
    for(const sel of [".sktop",".svclose",".skseekchip","#svstack","#svfoot"]){ const n=el.root.querySelector(sel); if(!n||n.hidden) continue;
      const r=n.getBoundingClientRect(); if(r.width>0&&r.height>0) UI_RECTS.list.push({x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}); } }
  for(const b of UI_RECTS.list) boxes.push(b);
  const collide=(b,x,y,w,h)=>Math.abs(b.x-x)<(b.w+w)/2+6 && Math.abs(b.y-y)<(b.h+h)/2+3;
  return {
    claim(x,y,w,h){ boxes.push({x,y,w,h}); },
    /* try anchors in order; return the first free spot or null (drop) */
    place(x,y,w,h,anchors){
      for(const [dx,dy] of anchors){
        /* a box that would run off the side is slid inward, not dropped: a name a few
           pixels from its planet still reads as its name (the Sun's caption near the right
           edge used to give up and wander off beside Mercury, 7 Sep) */
        const px=Math.max(4+w/2,Math.min(CAM.W-4-w/2,x+dx)), py=y+dy;
        if(w>CAM.W-8||py<PAD.top||py>CAM.H-PAD.bottom) continue;
        if(!boxes.some(b=>collide(b,px,py,w,h))){ boxes.push({x:px,y:py,w,h}); return [px,py]; }
      }
      return null;
    }
  };
}

/* ====================================================================
   THE FRAME
   ==================================================================== */
function targetPos(){
  if(!target||!cache) return null;
  if(target.t==="graha") return cache.grahas.find(x=>x.g===target.g);
  if(target.t==="rashi") return cache.rashiMid[target.i];
  if(target.t==="nakshatra") return cache.nakMid[target.i];
  if(target.t==="asc") return cache.asc;
  return null;
}
const sgOf=L=>Math.floor((((L%360)+360)%360)/30);
const nkOf=L=>Math.floor((((L%360)+360)%360)/NSPAN);

/* The nakshatra figures. Sangram, twice: "I still don't see the nakshatra
   shapes." They were being drawn — at sixteen percent of an already-faded
   star alpha, which on a phone in daylight is nothing at all. They now carry
   a floor of their own, brighten when their nakshatra is the selected one,
   and survive into daylight as ink. */
function drawAsterisms(c,W,starA,dim,focusNak,dayA){
  const ink=dayA>0;
  for(let ai=0;ai<cache.asts.length;ai++){
    const A=cache.asts[ai], on=focusNak===ai;
    const px=A.pts.map(p=>{ const [x,y]=project(p); return {x,y,up:p.up,m:p.m,on:onScreen(x,y,80)}; });
    if(!px.some(p=>p.on)) continue;
    const base=ink?0.42*dayA:(on?0.85:0.38)*starA;
    const lo=ink?0.15*dayA:(on?0.30:0.12)*starA;
    for(const [i,j] of A.lines){ const a2=px[i],b2=px[j];
      if(!a2||!b2||(!a2.on&&!b2.on)||!Number.isFinite(a2.x)||!Number.isFinite(b2.x)) continue;
      if(Math.hypot(a2.x-b2.x,a2.y-b2.y)>W*0.8) continue;
      c.strokeStyle=ink?`rgba(52,56,92,${(((a2.up||b2.up)?base:lo)*dim).toFixed(3)})`
                       :`rgba(168,182,236,${(((a2.up||b2.up)?base:lo)*dim).toFixed(3)})`;
      c.lineWidth=on&&!ink?1.4:1;
      c.beginPath(); c.moveTo(a2.x,a2.y); c.lineTo(b2.x,b2.y); c.stroke(); }
    if(ink) continue;
    for(const p of px){ if(!p.on||!p.up) continue;
      const r2=p.m<=1.2?2.1:p.m<=2.6?1.6:p.m<=3.6?1.25:1.0;
      c.fillStyle=`rgba(235,240,255,${((on?0.95:0.75)*starA*dim).toFixed(3)})`;
      c.beginPath(); c.arc(p.x,p.y,on?r2*1.25:r2,0,7); c.fill(); }
  }
}

/* THE TWELVE FIGURES, STAR BY STAR. Sangram, 5 Sep: "connect the stars, just
   like Star Walk 2 ... how the ancient people used to think of those shapes."
   The lines of a figure rise with the same pointing weight as its artwork,
   so the shape and the stars that make it appear together; the Stars layer
   keeps a faint trace of all twelve at night. Light at night, ink by day. */
function drawZodiac(c,W,starA,dim,dayA){
  if(!cache.zod) return;
  const ink=dayA>0;
  for(let s2=0;s2<12;s2++){
    const Z=cache.zod[s2]; if(!Z) continue;
    const w=litOf(s2);
    const trace=(layers.stars&&!ink)?0.14*starA:0;
    const a=Math.max(trace, w*(ink?0.55*dayA:0.9*Math.max(starA,0.6)))*dim;
    if(a<=0.01) continue;
    const px=Z.pts.map(p=>{ const [x,y]=project(p); return {x,y,up:p.up,m:p.m,on:onScreen(x,y,80)}; });
    if(!px.some(p=>p.on)) continue;
    c.lineWidth=w>0.5?1.4:1;
    for(const [i,j] of Z.lines){ const A=px[i],B=px[j];
      if(!A||!B||(!A.on&&!B.on)||!Number.isFinite(A.x)||!Number.isFinite(B.x)) continue;
      if(Math.hypot(A.x-B.x,A.y-B.y)>W*0.9) continue;
      c.strokeStyle=ink?`rgba(48,44,84,${a.toFixed(3)})`:`rgba(214,180,110,${a.toFixed(3)})`;   /* the rashi's own brass */
      c.beginPath(); c.moveTo(A.x,A.y); c.lineTo(B.x,B.y); c.stroke(); }
    if(w<=0.05) continue;
    /* the figure's stars, so the shape is seen to sit on real points of light */
    for(const p of px){ if(!p.on||!Number.isFinite(p.x)) continue;
      const r=p.m<=1.2?2.4:p.m<=2.6?1.9:p.m<=3.6?1.5:1.2;
      c.fillStyle=ink?`rgba(48,44,84,${(0.8*w*dayA*dim).toFixed(3)})`:`rgba(241,231,201,${(0.95*w*dim).toFixed(3)})`;
      c.beginPath(); c.arc(p.x,p.y,r*(0.8+0.5*w),0,7); c.fill(); }
  }
}
let focusSignNow=null;
function draw(){
  const _t0=performance.now();
  if(!running) return;
  const now=performance.now();
  const dt=Math.min(60,now-(lastFrame||now)); lastFrame=now;
  const W=el.canvas.width/SKY_DPR, H=el.canvas.height/SKY_DPR;
  /* SMOOTH HARDER THE HIGHER YOU POINT.
     Azimuth is a bearing, so the closer the phone gets to straight up the less
     ground a degree of it covers — and the more a steady hand's tremor swings
     it. The old code hid this by FREEZING the heading above 58 degrees, which
     is the snap that freeze caused. Now that the heading is honest it must be
     damped instead of frozen: 110ms low down, easing to 300ms near the zenith,
     so the view still follows the phone everywhere and simply becomes calmer
     where the maths is most sensitive. */
  const k=reduced?1:1-Math.exp(-dt/110);
  if(sensing&&followSky&&wantQ){
    /* the phone leads: one rotation eased toward the next, no angle anywhere.
       Taking the phone back after a drag, or the very first sample, starts from the
       view on screen and glides (τ 260 ms until within a degree) — a cut was the
       'snap' whenever the location button was tapped (7 Sep study). */
    if(!camQ){ camQ=quatFromBasis(basisFromAzAlt(viewAz,viewAlt)); reacquire=true; }
    if(reacquire&&quatAngle(camQ,wantQ)<1) reacquire=false;
    /* ADAPTIVE SMOOTHING. Still hand → a long constant, so the sky sits rock-steady and
       sensor tremor never reaches the screen. Turning hand → a short one, so the sky stays
       under the phone instead of trailing it. The constant itself glides (τ 180 ms) so
       crossing between the two is never felt as a change of character. A re-acquire still
       overrides both and takes its slow 260 ms glide. */
    const tgt=CAM_TAU_STILL+(CAM_TAU_TURN-CAM_TAU_STILL)*Math.min(1,qSpd.v/CAM_TURN_FULL);
    /* ASYMMETRIC. Tightening is what happens at the instant a turn begins, and a filter that
       tightens slowly makes the sky trail the hand for the first half second and then catch
       up — a rubber band, and the most-felt moment of the whole gesture (measured: 790 ms to
       tighten, far worse than the fixed constant it replaced). Loosening is never noticed, so
       it stays gentle. Tighten in 25 ms, relax over 400. */
    camTau+=(tgt-camTau)*(reduced?1:1-Math.exp(-dt/(tgt<camTau?25:400)));
    const kq=reduced?1:1-Math.exp(-dt/(reacquire?260:camTau));
    camQ=slerp(camQ,wantQ,kq);
    camBasis=basisFromQuat(camQ);
    const aa=azAltOf(camBasis.f); viewAz=aa.az; viewAlt=aa.alt; wantAz=viewAz; wantAlt=viewAlt;
  } else {
    viewAz+=wrap(wantAz-viewAz)*k; viewAlt+=(wantAlt-viewAlt)*k;
    if(camQ){
      /* a finger took over from the phone: roll eases out toward the level camera
         rather than cutting to it */
      const level=quatFromBasis(basisFromAzAlt(viewAz,viewAlt));
      camQ=slerp(camQ,level,k); camBasis=basisFromQuat(camQ);
      if(quatAngle(camQ,level)<0.15){ camQ=null; camBasis=null; }
    } else camBasis=null;
  }
  focusK+=((target?1:0)-focusK)*(reduced?1:1-Math.exp(-dt/160));
  { const k3=reduced?1:1-Math.exp(-dt/260);
    let step=(wantOrr-orr)*k3;
    /* rate-limited: however fast the fingers, the Earth comes out over ORR_MIN_MS */
    const cap=reduced?1:dt/ORR_MIN_MS;
    step=Math.sign(step)*Math.min(Math.abs(step),cap);
    orr+=step; if(Math.abs(wantOrr-orr)<0.002) orr=wantOrr; }
  { const k2=reduced?1:1-Math.exp(-dt/120);
    orrSpin+=(wantSpin-orrSpin)*k2; orrPitch+=(wantPitch-orrPitch)*k2; }
  /* the finger's moment, followed at display rate with a 45 ms ease: near enough to 1:1 to feel
     held, smooth enough to hide iOS's coalesced pointer events */
  if(seekWant!=null){
    const cur=skyDate().getTime(), k=reduced?1:1-Math.exp(-dt/45);
    const next=cur+(seekWant-cur)*k;
    if(Math.abs(seekWant-next)<45000){ seekTo(seekWant); seekWant=null; }
    else seekTo(Math.round(next/60000)*60000);
  }
  /* the date walks toward the target at a readable pace, so planets are seen to move */
  if(seekTargetMs!=null){
    const cur=skyDate().getTime(), gap=seekTargetMs-cur;
    if(Math.abs(gap)<60000){ seekTo(seekTargetMs); seekTargetMs=null; }
    else { /* CONSTANT speed, in days per second, not a fraction of the gap: a fraction
              leaps first and crawls after, which reads as a snap. Six days a second
              moves the Sun six degrees a second — visibly gliding, a year in a minute. */
      const cap=864e5*0.006*Math.max(8,dt);
      const step=Math.sign(gap)*Math.min(Math.abs(gap),cap);
      seekTo(cur+step); }
  }
  if((orr>=0.5)!==orrSide){ orrSide=orr>=0.5; buzz(8);
    if(!orrSide){ orrBase=null; orrAsc=null; }   /* back to the sky: the next pull-out anchors afresh */
    if(el&&el.root.querySelector("#svseek")) paintSeeker(); }
  if(!cache||cache.key!==cacheKey()||tween||(mode==="now"&&!custom&&!seek&&Date.now()-cacheAt>2000)) computeSky();
  /* the pull-out's anchor: the moment the globe view is entered (a pinch, or a test state that
     opens there), the Earth's turn and the ring's zero are measured from here */
  if(orrSide&&orrBase==null){ orrBase=skyDate().getTime(); orrAsc=risingLongitude(cache.ecl); }
  updateCamera(W,H);
  const c=ctx, ppd=ppdCenter();
  const focusSign=target&&target.t==="graha"?sgOf(cache.grahas.find(x=>x.g===target.g).L)
    :target&&target.t==="rashi"?target.i:null;
  focusSignNow=focusSign;
  pointing();
  { const kw=reduced?1:1-Math.exp(-dt/220); for(let s=0;s<12;s++) ART_W[s]+=(litGoal(s)-ART_W[s])*kw; }
  pointedSign=focusSign!=null?focusSign:POINT.s;
  const focusNak=target&&target.t==="graha"?nkOf(cache.grahas.find(x=>x.g===target.g).L)
    :target&&target.t==="nakshatra"?target.i:null;
  const dim=1-0.5*focusK;                 /* everything unrelated steps back */

  /* --- sky: darkest at the zenith; daylight washes in when the Sun is up --- */
  const day=Math.max(0,Math.min(1,(cache.sunAlt+6)/12));
  const mixc=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  /* keyframes by solar altitude: [zenith, mid-sky, horizon] */
  const SKY_KEYS=[
    [-90,[3,4,14],[13,17,44],[26,30,66]],       /* deep night: indigo depth, faint skyglow at the horizon */
    [-18,[3,4,14],[13,17,44],[26,30,66]],       /* astronomical twilight begins */
    [-12,[5,7,22],[22,26,62],[54,48,96]],       /* nautical: a violet breath at the horizon */
    [-6,[11,17,50],[50,64,126],[176,118,108]],  /* civil: rose and peach */
    [0,[38,72,148],[108,138,198],[238,168,118]],/* the Sun on the horizon */
    [6,[48,94,174],[126,160,216],[208,212,230]],
    [15,[42,98,190],[118,158,222],[198,212,236]],/* day: deep blue zenith, pale scattering at the horizon */
    [90,[40,96,192],[116,156,222],[196,210,236]]];
  const skyAt=alt=>{ let i=0; while(i<SKY_KEYS.length-2&&alt>SKY_KEYS[i+1][0]) i++;
    const A=SKY_KEYS[i], Bk=SKY_KEYS[i+1]; let t=(alt-A[0])/(Bk[0]-A[0]); t=Math.max(0,Math.min(1,t)); t=t*t*(3-2*t);
    return [mixc(A[1],Bk[1],t),mixc(A[2],Bk[2],t),mixc(A[3],Bk[3],t)]; };
  const [t0,t1,t2]=skyAt(cache.sunAlt);
  const starFade=Math.max(0,Math.min(1,(-cache.sunAlt-4)/8));   /* stars gone by civil dawn */
  /* the horizon line on screen: two far-apart points and the unit normal toward the ground */
  const hz=(()=>{
    /* under the stereographic the horizon is an arc, not a line; the chord is fitted to the
       points ON SCREEN (plus twelve degrees of margin for the panorama's peaks), where its
       error is a few pixels — fitted to every point in front of the camera, the chord of a
       wide upward view ran twenty degrees above the true horizon */
    const mg=12*ppdCenter(), pts=[];
    for(let az=0;az<360;az+=3){ const p=project({alt:0,az}); if(onScreen(p[0],p[1],mg)) pts.push({x:p[0],y:p[1],az}); }
    if(pts.length<2) return null;
    let p1=pts[0], p2=pts[0], best=-1;
    for(const p of pts){ const d=Math.hypot(p.x-p1.x,p.y-p1.y); if(d>best){best=d;p2=p;} }
    for(const p of pts){ const d=Math.hypot(p.x-p2.x,p.y-p2.y); if(d>best){best=d;p1=p;} }
    if(best<4) return null;
    const dx=(p2.x-p1.x)/best, dy=(p2.y-p1.y)/best; let nx=-dy, ny=dx;
    const g=project({alt:-6,az:p1.az});
    const side=Number.isFinite(g[0])?Math.sign((g[0]-p1.x)*nx+(g[1]-p1.y)*ny)||1:(ny>0?1:-1);
    nx*=side; ny*=side;
    /* the point of the line nearest the screen centre anchors the gradients */
    const t=((W/2-p1.x)*dx+(H/2-p1.y)*dy); const cx=p1.x+dx*t, cy=p1.y+dy*t;
    /* the horizon's circle on screen — under the stereographic camera a great circle IS a
       circle, and for the horizon it is exact: radius 2F/tan(alt), centre 2F/sin(alt) from the
       screen centre along the ground normal. The orrery's Earth disc begins on it, so the
       pull-out starts from the very line the eye is looking at. (A circle fitted through
       three points of a nearly flat arc put its centre hundreds of pixels off, 7 Sep.) */
    let circle=null;
    { const a=viewAlt*D2R; if(a>0.02){ const F=CAM.F; circle={cx:W/2+nx*2*F/Math.sin(a), cy:H/2+ny*2*F/Math.sin(a), R:2*F/Math.tan(a)}; } }
    return {p1,p2,dx,dy,nx,ny,cx,cy,pts,circle};
  })();
  const rgb=v=>`rgb(${v.join(",")})`;
  if(hz){
    /* sky: haze at the horizon deepening toward the zenith, measured away from the line */
    const D=Math.max(H,W)*1.1;
    const sg=c.createLinearGradient(hz.cx,hz.cy,hz.cx-hz.nx*D,hz.cy-hz.ny*D);
    sg.addColorStop(0,rgb(t2)); sg.addColorStop(0.06,rgb(mixc(t2,t1,0.55))); sg.addColorStop(0.32,rgb(t1)); sg.addColorStop(1,rgb(t0));
    c.fillStyle=sg; c.fillRect(0,0,W,H);
    /* daylight scattering: a broad, pale aureole toward the Sun's direction */
    const sunG=cache.grahas.find(x=>x.g==="Sun");
    if(sunG&&day>0.05){ const sp=project(sunG);
      if(Number.isFinite(sp[0])){ const ag=c.createRadialGradient(sp[0],sp[1],0,sp[0],sp[1],Math.max(W,H)*1.9);
        ag.addColorStop(0,`rgba(255,250,235,${0.55*day})`); ag.addColorStop(0.09,`rgba(235,240,250,${0.24*day})`); ag.addColorStop(0.45,`rgba(225,234,250,${0.10*day})`); ag.addColorStop(1,"rgba(225,234,250,0)");
        c.fillStyle=ag; c.fillRect(0,0,W,H); } }
    /* dawn and dusk: warmth pooled where the Sun meets the horizon */
    if(sunG&&Math.abs(cache.sunAlt)<9){
      const sp=project({alt:0,az:sunG.az});
      if(Number.isFinite(sp[0])){ const k=1-Math.abs(cache.sunAlt)/9;
        const rg=c.createRadialGradient(sp[0],sp[1],0,sp[0],sp[1],H*0.75);
        rg.addColorStop(0,`rgba(255,168,92,${0.55*k})`); rg.addColorStop(0.35,`rgba(255,140,90,${0.22*k})`); rg.addColorStop(1,"rgba(255,140,90,0)");
        c.fillStyle=rg; c.fillRect(0,0,W,H); }
    }
  } else {
    const sg=c.createLinearGradient(0,0,0,H);
    sg.addColorStop(0,rgb(viewAlt>0?t0:t2)); sg.addColorStop(1,rgb(viewAlt>0?t1:t2));
    c.fillStyle=sg; c.fillRect(0,0,W,H);
  }

  /* --- CLOUDS, by day ------------------------------------------------
     Sangram, with a photograph: "when it's daytime, can we make the landscape
     look beautiful ... mountains, some clouds, sky? Because currently it looks
     very plain."

     They are pinned to fixed sky coordinates and projected like everything
     else, so they hold still while the phone turns — a cloud that slid with
     the camera would break the illusion the whole AR view depends on. They sit
     BEHIND the astronomy on purpose: this is an instrument, and a cloud that
     hides a graha is a cloud that has cost the reader the thing they opened
     the app for. Low in the sky, where real cloud stacks up and where nothing
     is being read anyway.

     Three photographed cumulus sprites once they have passed the manifest
     gate; until then, two dozen soft ellipses whose lit edge follows the real
     Sun, so they warm at dusk with everything else. */
  if(day>0.30&&layers.horizon){
    const sunAz=cache.sunAz||0;
    /* with all three sprites through the gate each cloud is one drawImage:
       centred on its sky position, a square box of CSPAN*w degrees (the
       cumulus fills about 70% of its frame, so the visible cloud is about
       1.25w — the extent the puffs painted), the sprite's own alpha — softened
       at load, see softenCloud — for its softness, the same day and altitude
       fade for its opacity. Nothing rotates, nothing drifts. Without them, the
       puffs below paint as before. */
    const art=CLOUDS_ART.n===3?cloudSprites(cache.sunAlt):null;
    for(const cl of CLOUDS){
      if(!cl.on) continue;                                   /* one in three rests */
      const [x,y,z]=project({alt:cl.alt,az:cl.az});
      if(!Number.isFinite(x)||z<0) continue;
      const w=cl.w*ppd, h=cl.h*ppd;
      if(x<-w*2||x>W+w*2||y<-h*3||y>H+h*3) continue;
      if(art){
        const S=CSPAN*cl.w*ppd, a=cl.o*day*Math.min(1,Math.max(0,(cl.alt-2)/8));
        c.save(); c.globalAlpha=a; c.translate(x,y); if(cl.m) c.scale(-1,1);
        c.drawImage(art[cl.k],-S/2,-S/2,S,S); c.restore();
        continue; }
      /* brighter on the side facing the Sun, greyer away from it */
      let d=((cl.az-sunAz+540)%360)-180;
      const lit=Math.max(0,1-Math.abs(d)/150);
      /* Nearly white. Mixed a third of the way into the sky's own tint they
         were the same luminance as the sky and simply did not read — a cloud
         has to be BRIGHTER than the blue behind it, not a tinted version of
         it. Only a touch of the sky colour, for the shadowed underside. */
      const base=mixc([250,252,255],t2,0.10);
      const warm=mixc(base,[255,238,210],0.5*lit*(1-Math.min(1,Math.max(0,cache.sunAlt/25))));
      const a=cl.a*day*Math.min(1,Math.max(0,(cl.alt-2)/8));
      c.save(); c.translate(x,y); c.scale(1,h/w);
      for(const puff of cl.p){
        const g=c.createRadialGradient(puff[0]*w,puff[1]*w,0,puff[0]*w,puff[1]*w,puff[2]*w);
        g.addColorStop(0,`rgba(${warm.join(",")},${(a*puff[3]).toFixed(3)})`);
        g.addColorStop(0.55,`rgba(${warm.join(",")},${(a*puff[3]*0.45).toFixed(3)})`);
        g.addColorStop(1,`rgba(${base.join(",")},0)`);
        c.fillStyle=g; c.beginPath(); c.arc(puff[0]*w,puff[1]*w,puff[2]*w,0,7); c.fill();
      }
      c.restore();
    }
  }

  /* --- stars: atmosphere, fading in daylight --- */
  const starA=starFade*(layers.stars?1:0);
  const slip=2.7*(camBasis?camBasis.f[0]:Math.sin(viewAz*D2R));   /* plane 1 parallax, restrained — from the look
     vector's east component, so it never wraps at north or flips over the zenith (a 5° jump, 7 Sep study) */
  if(starA>0.02){
    if(vFov>56){ /* wide view: a second, fainter plane of stars (the same seeded field, turned) */
      const k=Math.min(1,(vFov-56)/30);
      for(const s of cache.amb2){ if(!s.up) continue; const [x,y]=project({alt:s.alt,az:s.az+slip*1.4}); if(!onScreen(x,y,4)) continue;
        c.fillStyle=`rgba(215,224,255,${0.12*starA*k})`; c.beginPath(); c.arc(x,y,0.75,0,7); c.fill(); }
    }
    /* the Milky Way: one continuous path per layer (segment-wise strokes leave a string of
       pearls), feathered by three widths; the half toward the galactic centre gets a core */
    { const pts=cache.mw.map(p=>{ const [x,y]=project(p); return {x,y,w:p.w,up:p.up}; });
      const path=(pred)=>{ c.beginPath(); let pen=false,last=null;
        for(let i=0;i<=pts.length;i++){ const p=pts[i%pts.length];
          const ok=Number.isFinite(p.x)&&pred(p)&&!(last&&Math.hypot(p.x-last.x,p.y-last.y)>W*0.6);
          if(!ok){ pen=false; last=Number.isFinite(p.x)?p:null; continue; }
          pen?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),pen=true); last=p; } };
      c.lineCap="round"; c.lineJoin="round";
      for(const wid of [30,25,20,16,12,9,6]){ path(()=>true); c.strokeStyle=`rgba(205,214,242,${0.011*starA*dim})`; c.lineWidth=wid*ppd; c.stroke(); }
      for(const wid of [14,10,7,4]){ path(p=>p.w>0.6); c.strokeStyle=`rgba(222,226,246,${0.014*starA*dim})`; c.lineWidth=wid*ppd; c.stroke(); }
    }
    for(const s of cache.amb){ if(!s.up) continue; const [x,y]=project({alt:s.alt,az:s.az+slip}); if(!onScreen(x,y,6)) continue;
      const a=(s.m>5?.15:s.m>4.4?.22:.32)*starA;
      c.fillStyle=`rgba(225,232,255,${a})`; c.beginPath(); c.arc(x,y,s.m>4.6?0.7:1.05,0,7); c.fill(); }
    drawAsterisms(c,W,starA,dim,focusNak);
    for(const s of cache.stars){ if(!s.up) continue; const [x,y]=project(s); if(!onScreen(x,y,30)) continue;
      starSprite(c,x,y,s.m,starA*dim); }
  }
  /* DAYLIGHT. The stars are not really visible, and the nakshatras are the
     reference frame of the whole system — so the twenty-seven yogataras and
     their figures stay, drawn as quiet ink on the bright sky rather than as
     light. All twenty-seven, not the three brightest: a frame with a quarter
     of its marks missing is not a frame. */
  if(day>0.5&&layers.stars){
    drawAsterisms(c,W,0,dim,focusNak,day);
    /* A FIELD, NOT TWENTY-SEVEN DOTS. Sangram: "in the day also the stars
       should be visible ... in the sky blue you're not able to show ... make
       those stars brighter or use some other tricks." Only the yogataras were
       drawn by day, so the sky read as empty with a few marks on it rather
       than as a sky. The ambient field comes through too now, and every star
       carries a dark core inside a light halo — on a bright blue ground a
       light dot alone has almost no contrast, while a dark centre reads at any
       brightness. That is the trick: contrast both ways, not more alpha. */
    for(const s2 of cache.amb){ if(!s2.up) continue;
      const [x,y]=project({alt:s2.alt,az:s2.az+slip}); if(!onScreen(x,y,6)) continue;
      const a=(s2.m>5?0.20:s2.m>4.4?0.28:0.38)*day*dim;
      c.fillStyle=`rgba(255,253,246,${(a*0.9).toFixed(3)})`;
      c.beginPath(); c.arc(x,y,s2.m>4.6?1.15:1.5,0,7); c.fill();
      c.fillStyle=`rgba(44,48,86,${(a*0.75).toFixed(3)})`;
      c.beginPath(); c.arc(x,y,s2.m>4.6?0.55:0.75,0,7); c.fill(); }
    for(const s of cache.stars){ if(!s.up) continue; const [x,y]=project(s); if(!onScreen(x,y,10)) continue;
      const big=s.m<=2.6;
      c.fillStyle=`rgba(255,252,244,${(big?0.78:0.58)*day*dim})`; c.beginPath(); c.arc(x,y,big?3.2:2.3,0,7); c.fill();
      c.fillStyle=`rgba(30,33,62,${(big?0.72:0.56)*day*dim})`; c.beginPath(); c.arc(x,y,big?1.5:1.1,0,7); c.fill(); }
  }
  /* the figures' lines belong to the figure, not to the star layer: drawn whenever
     artwork or stars are on, weighted by pointing */
  /* --- horizon and land, drawn BEFORE the belt, the figures, the names and the grahas
     (Sangram, 6 Sep): what is below the horizon stays faintly in view through the ground,
     a figure straddling the line lights up whole when pointed at, and a planet down there
     says when it rises. --- */
  if(layers.horizon){
    const horizon=hz?hz.pts:[];
    /* ground: the half-plane on the nadir side of the horizon chord (the arc's sagitta
       across the screen is a few pixels, and the panorama covers the line itself),
       shaded from horizon haze into deep ground */
    c.save();
    if(hz){
      const {p1,p2,dx,dy,nx,ny,cx,cy}=hz, L=6000;
      /* the horizon is an ARC under the stereographic camera: the ground, the haze and the
         edge follow the projected line itself, extended along the chord beyond both ends
         (a straight chord left a step against the Earth's curve during the pull-out, 7 Sep) */
      const arc=hz.pts.map(q=>({x:q.x,y:q.y,t:(q.x-cx)*dx+(q.y-cy)*dy})).sort((a,b)=>a.t-b.t);
      const a0=arc[0], a1=arc[arc.length-1];
      const along=()=>{ c.moveTo(a0.x-dx*L,a0.y-dy*L); for(const q of arc) c.lineTo(q.x,q.y); c.lineTo(a1.x+dx*L,a1.y+dy*L); };
      const ga=revealBelow?0.38:1;
      /* aerial perspective: the ground near the horizon wears the sky's haze — pale and
         airy by day, the sky's warmth at dusk, blue-black at night; the nadir stays dark */
      const hazeC=day>0.5?mixc(t2,[160,168,184],0.45):mixc(t2,[10,12,26],0.42);
      const midC=mixc(hazeC,[12,14,28],day>0.5?0.38:0.72);
      const gg=c.createLinearGradient(cx,cy,cx+nx*H*0.95,cy+ny*H*0.95);
      if(day>0.5){
        /* LAND, not a slab (Sangram, 5 Sep: "the mountains and the land are not
           really looking nice"). Haze at the line, then a sage meadow, then earth
           darkening underfoot — the colours of ground seen from a hill, not a
           material swatch. */
        /* the land continues from the nearest slope: no bright strip at the line */
        const sage=[76,104,66], earth=[54,60,44];
        gg.addColorStop(0,`rgba(36,58,46,${0.96*ga})`);
        gg.addColorStop(0.06,`rgba(${mixc([36,58,46],sage,0.5).join(",")},${0.95*ga})`);
        gg.addColorStop(0.22,`rgba(${sage.join(",")},${0.95*ga})`);
        gg.addColorStop(0.58,`rgba(${earth.join(",")},${0.95*ga})`);
        gg.addColorStop(1,`rgba(22,24,18,${0.96*ga})`);
      } else {
        gg.addColorStop(0,`rgba(${hazeC.join(",")},${0.9*ga})`); gg.addColorStop(0.22,`rgba(${midC.join(",")},${0.9*ga})`); gg.addColorStop(1,`rgba(6,7,16,${0.95*ga})`);
      }
      c.fillStyle=gg;
      c.beginPath(); along(); c.lineTo(a1.x+dx*L+nx*L,a1.y+dy*L+ny*L); c.lineTo(a0.x-dx*L+nx*L,a0.y-dy*L+ny*L); c.closePath(); c.fill();
      /* haze rising from the line into the sky: airy by day, a thin breath at night */
      const hzC=mixc(t2,[255,255,255],0.3*day);
      const hzg=c.createLinearGradient(cx,cy,cx-nx*H*(0.14+0.1*day),cy-ny*H*(0.14+0.1*day));
      hzg.addColorStop(0,`rgba(${hzC.join(",")},${0.32+0.3*day})`); hzg.addColorStop(1,`rgba(${hzC.join(",")},0)`);
      c.fillStyle=hzg;
      { const hh=H*0.24; c.beginPath(); along(); c.lineTo(a1.x+dx*L-nx*hh,a1.y+dy*L-ny*hh);
        for(let i=arc.length-1;i>=0;i--) c.lineTo(arc[i].x-nx*hh,arc[i].y-ny*hh);
        c.lineTo(a0.x-dx*L-nx*hh,a0.y-dy*L-ny*hh); c.closePath(); c.fill(); }
      /* a soft luminous edge — never a hard line */
      c.strokeStyle=`rgba(${mixc(t2,[220,228,255],0.5).join(",")},${0.05+0.08*day})`; c.lineWidth=6; c.lineCap="round";
      c.beginPath(); along(); c.stroke();
      /* the land: the generated panorama once the manifest lets it through
         (approved, or pending while under review); until then the procedural
         ranges below — a sense of place, not scenery, the same land at every
         azimuth of this spot */
      if(LAND.img){ drawLand(c,W,H,ga,day); }
      else if(horizon.length>4){
        /* the point list runs by azimuth and drops everything behind the camera, so when the
           camera faces north the 357-degree point and the 0-degree point sit next to each
           other on screen but at opposite ends of the array: closing the polygon on array
           order drew a thin double-filled sliver from the horizon to the bottom of the
           screen, right under the N label. Sort along the horizon line instead. */
        const ord=horizon.map(p=>({az:p.az,x:p.x,y:p.y,t:(p.x-cx)*dx+(p.y-cy)*dy})).sort((a,b)=>a.t-b.t);
        /* MOUNTAINS, not bumps. Three sines gave a rounded swell that read as a
           bump; crests come from RIDGED value noise — the fold 1-|2n-1| makes
           sharp peaks and soft saddles — in three octaves, seeded, so the same
           land stands at every azimuth of this spot. Each range is lit from the
           Sun's side of the screen and shadowed on the other, the way a real
           range shows its facets. */
        const hashN=(i,seed)=>{ const x=Math.sin(i*127.1+seed*311.7)*43758.5453; return x-Math.floor(x); };
        const vn=(az,f,seed)=>{ const u=((az%360)+360)%360/360*f, i=Math.floor(u), t=u-i, tt=t*t*(3-2*t);
          return hashN(i%f,seed)*(1-tt)+hashN((i+1)%f,seed)*tt; };
        const ridged=(az,f,seed)=>1-Math.abs(2*vn(az,f,seed)-1);
        /* peaks every ~25 degrees with finer detail on them: a 62-degree field shows two
           or three real summits, not one swell */
        const profile=(az,seed)=>0.50*ridged(az,14,seed)+0.32*ridged(az,31,seed+7)+0.18*ridged(az,67,seed+13);
        const sunP=project({az:cache.grahas[0].az,alt:Math.max(cache.grahas[0].alt,8)});
        const sunSide=Number.isFinite(sunP[0])?Math.sign(sunP[0]-W/2)||1:(Math.sin(wrap(cache.grahas[0].az-viewAz)*D2R)>=0?1:-1);
        const ridge=(amp,seed,col,lit)=>{
          const g2=c.createLinearGradient(sunSide>0?W:0,0,sunSide>0?0:W,0);
          const warm=mixc(col,[255,226,186],lit*day), cool=mixc(col,[36,44,78],lit*0.9);
          g2.addColorStop(0,`rgba(${warm.join(",")},${0.96*ga})`); g2.addColorStop(1,`rgba(${cool.join(",")},${0.96*ga})`);
          c.fillStyle=g2; c.beginPath(); let pen0=false; const crest=[];
          for(const p of ord){ const h=Math.max(0,amp*ppd*profile(p.az,seed));
            const x=p.x-nx*h, y=p.y-ny*h; crest.push([x,y]); pen0?c.lineTo(x,y):(c.moveTo(x,y),pen0=true); }
          const e=ord[ord.length-1], f=ord[0];
          c.lineTo(e.x+dx*L,e.y+dy*L); c.lineTo(e.x+dx*L+nx*L,e.y+dy*L+ny*L);
          c.lineTo(f.x-dx*L+nx*L,f.y-dy*L+ny*L); c.lineTo(f.x-dx*L,f.y-dy*L); c.closePath(); c.fill();
          /* a thread of light along the crest, strongest on the Sun's side: the edge
             a range shows against the sky */
          const cg=c.createLinearGradient(sunSide>0?W:0,0,sunSide>0?0:W,0);
          cg.addColorStop(0,day>0.5?`rgba(255,246,228,${(0.34*lit*4)*ga})`:`rgba(150,160,220,${(0.16*lit*4)*ga})`);
          cg.addColorStop(1,day>0.5?`rgba(255,246,228,${(0.06*lit*4)*ga})`:`rgba(150,160,220,${(0.04*lit*4)*ga})`);
          c.strokeStyle=cg; c.lineWidth=1; c.beginPath();
          crest.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke(); };
        /* FOUR RANGES, not two, and taller — the old pair were 2.2 and 1.2
           degrees of sky, which is a bump rather than a horizon. Aerial
           perspective does the work: the far range is almost the sky's own
           haze, each nearer one steps darker, so distance is read as colour
           rather than drawn as outline. Still the same land at every azimuth
           of this spot — a sense of place, not scenery. */
        /* far to near: haze-blue mountains, then blue-green, then the dark green of
           the nearest slope; the nearer, the more its facets show */
        /* four clearly stepped ranges: haze-blue, slate-blue, blue-green, the dark
           green of the nearest slope — distance read as colour */
        const cols=day>0.5?[[118,138,168],[82,104,128],[60,90,80],[36,58,46]]:[[14,16,42],[10,12,32],[7,9,24],[4,6,16]];
        ridge(9.5,3,mixc(hazeC,cols[0],0.72),0.05);     /* summits climb well into the sky */
        ridge(6.6,11,mixc(hazeC,cols[1],0.86),0.08);
        ridge(4.2,19,mixc(hazeC,cols[2],0.94),0.12);
        ridge(2.2,29,cols[3],0.16);
      }
    } else if(viewAlt<0){ c.fillStyle="rgba(4,5,14,0.94)"; c.fillRect(0,0,W,H); }
    c.restore();
    /* the true horizon, faint: the ranges stand on it, it must not cut across them
       (and the panorama's near hills straddle it, so it is not drawn over the land) */
    c.strokeStyle=`rgba(${mixc(t2,[200,212,255],0.55).join(",")},${day>0.5?0.07:0.16})`; c.lineWidth=1; c.beginPath(); let pen=false;
    let last=null;
    for(const p of horizon){ if(last&&Math.hypot(p.x-last.x,p.y-last.y)>W) pen=false;
      pen?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),pen=true); last=p; }
    if(!LAND.img) c.stroke();
  }

  if(layers.art||layers.stars) drawZodiac(c,W,starA,dim,day>0.5?day:0);

  /* --- the CELESTIAL RIBBON --- */
  const eclPts=cache.ecl.map(p=>{ const [x,y,z]=project(p); return {L:p.L,x,y,z,up:p.up}; });
  const bandW=Math.max(34,Math.min(150,2*BAND_B*ppd));  /* the belt's width at the screen centre, px */
  const nPts=cache.eclN.map(p=>{ const [x,y]=project(p); return {x,y}; });
  const sPts=cache.eclS.map(p=>{ const [x,y]=project(p); return {x,y}; });
  const bwAt=i=>{ const n=nPts[i], q=sPts[i]; return Number.isFinite(n.x)&&Number.isFinite(q.x)?Math.hypot(n.x-q.x,n.y-q.y):bandW; };
  const ribbon=(lw,style,upOnly)=>{
    c.strokeStyle=style; c.lineWidth=lw; c.lineCap="butt"; c.lineJoin="round";
    c.beginPath(); let pen=false,last=null;
    for(const p of eclPts){
      if(!Number.isFinite(p.x)||(last&&Math.hypot(p.x-last.x,p.y-last.y)>W*0.6)){ pen=false; last=p; continue; }
      pen?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),pen=true); last=p;
    }
    c.stroke();
  };
  if(layers.rashis||layers.naks){
    /* THE BELT (Sangram, 6 Sep: "add some curve… cylindrical… soft, string-like… slightly
       bigger"). Not a stroke of constant pixel width: the true region between ±BAND_B° of
       ecliptic latitude, projected, so it curves and widens toward the screen's edges the
       way a ring seen from inside does. Each sector is three nested fills, wide and faint
       to narrow and full, which feathers the edges; the pointed sector glows, its
       neighbours less, the rest a whisper. */
    const belt=(i0,i1,shrink)=>{
      const pt=(i,side)=>{ const e=eclPts[i], q=side>0?nPts[i]:sPts[i];
        if(!Number.isFinite(e.x)||!Number.isFinite(q.x)) return null;
        return [e.x+(q.x-e.x)*(1-shrink), e.y+(q.y-e.y)*(1-shrink)]; };
      const top=[], bot=[];
      for(let i=i0;i<=i1;i++){ const a=pt(i,1), b=pt(i,-1); if(!a||!b) return false; top.push(a); bot.push(b); }
      for(let i=1;i<top.length;i++) if(Math.hypot(top[i][0]-top[i-1][0],top[i][1]-top[i-1][1])>W*0.6) return false;
      c.beginPath(); top.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
      for(let i=bot.length-1;i>=0;i--) c.lineTo(bot[i][0],bot[i][1]);
      c.closePath(); return true; };
    for(let s=0;s<12;s++){
      const w=litOf(s), on=w>0.9;
      const a=(0.028+0.20*w+(s%2?0.012:0))*(layers.rashis?1:0.4)*(on?1:dim)*(1-0.15*day)+(day>0.5?0.012:0);
      const i0=s*15, i1=s*15+15;
      if(!belt(i0,i1,0)) continue;
      c.fillStyle=`rgba(194,155,78,${(a*0.16).toFixed(3)})`; c.fill();
      for(const k of [0.22,0.42,0.6,0.78]){ belt(i0,i1,k); c.fillStyle=`rgba(194,155,78,${(a*0.24).toFixed(3)})`; c.fill(); }
    }
    ribbon(0.9,day>0.5?`rgba(120,96,50,${0.28*(0.6+0.4*dim)})`:`rgba(214,180,110,${0.3*(0.6+0.4*dim)})`);   /* the ecliptic line itself, quiet; ink in daylight */
    /* boundary ticks: rashi across the band, nakshatra on its lower half, pada when close */
    const tickAt=(p,len,side,style,lw)=>{
      const i=Math.round(p.L/2), a=eclPts[Math.max(0,i-1)], b=eclPts[Math.min(180,i+1)];
      const [x,y]=project(p); if(!onScreen(x,y,30)||!Number.isFinite(a.x)||!Number.isFinite(b.x)) return;
      let nx=-(b.y-a.y), ny=(b.x-a.x); const n=Math.hypot(nx,ny)||1; nx/=n; ny/=n;
      if(ny<0){nx=-nx;ny=-ny;}                                 /* normal points screen-down */
      c.strokeStyle=style; c.lineWidth=lw; c.beginPath();
      if(side===0){ c.moveTo(x-nx*len,y-ny*len); c.lineTo(x+nx*len,y+ny*len); }
      else { c.moveTo(x,y); c.lineTo(x+nx*len,y+ny*len); }
      c.stroke();
    };
    if(layers.rashis) for(let s=0;s<12;s++) tickAt(cache.ecl[s*15],bwAt(s*15)/2+2,0,day>0.5?`rgba(110,88,44,${0.34*dim})`:`rgba(214,180,110,${0.36*dim})`,1);
    if(layers.naks) for(let i=0;i<27;i++){ const e=cache.nakEdge[i]; if(!e.up&&mode!=="birth") continue;
      tickAt({...e,L:i*NSPAN},bwAt(Math.round(i*NSPAN/2)%181)/2,1,`rgba(160,150,214,${(focusNak===i||focusNak===i-1?0.85:0.28)*dim})`,0.9); }
    if(layers.naks&&vFov<30) for(let i=0;i<108;i++){ if(i%4===0) continue;
      const L=i*NSPAN/4; const p=siderealPointAltAz(L, cache.d, cache.sp.lat, cache.sp.lon);
      tickAt({...p,L},bandW/5,1,`rgba(160,150,214,${0.35*dim})`,0.8); }
    /* the focused nakshatra: a violet highlight on the lower edge */
    if(focusNak!=null&&layers.naks){
      const i0=focusNak*NSPAN, i1=(focusNak+1)*NSPAN;
      /* the selected nakshatra reads as a quiet BRASS band with brass edges, not the thick
         lavender-white wedge it was — that looked like a broken selection mask laid over the
         figure. Selection is carried by the band's edges and the card, not by brightness. */
      c.strokeStyle=`rgba(214,180,110,${0.20*focusK})`; c.lineWidth=Math.max(3,bandW*0.30);
      c.beginPath(); let pen=false,last=null;
      for(let L=i0;L<=i1+0.01;L+=1.5){ const p=siderealPointAltAz(L, cache.d, cache.sp.lat, cache.sp.lon); const [x,y]=project(p);
        if(!Number.isFinite(x)||(last&&Math.hypot(x-last[0],y-last[1])>W*0.6)){pen=false;last=[x,y];continue;}
        pen?c.lineTo(x,y):(c.moveTo(x,y),pen=true); last=[x,y]; }
      c.stroke();
    }
  }
  /* rashi artwork: a figure appears when you POINT at it — full when its
     rashi is within 12 degrees of the view centre, gone beyond 38 — and never
     all twelve at once (Sangram, 5 Sep, Star Walk 2 as the bar). Drawn
     additively at night so the figure is light in the sky, not a decal on it.
     PLACED BY THE CONSTELLATION FIT: centred on the box its stars fill, its
     long side along their principal axis when both are clearly elongated,
     sized to cover that box with 15% of air, and held to 0.6-1.6 of the old
     ecliptic-chord size. */
  const artT0=performance.now(); let artMs=0; ART_LAST.fill(null); inkBakes=0; litBakes=0;
  /* how much of a figure is ink rather than light: the luminous additive draw
     carries the night, the inked source-over draw carries the day, and through
     the four degrees of Sun either side of the horizon (day 0.35..0.7) both are
     drawn and cross-faded, so nothing pops at sunset. By day the alpha follows
     the pointing weight - 0.16 for a figure merely in view, 0.55 for the one
     pointed at - so turning toward a figure visibly lights it up. */
  const ink=(()=>{ const t=Math.max(0,Math.min(1,(day-0.35)/0.35)); return t*t*(3-2*t); })();
  /* The LAMP crosses from light to brass on its own, earlier curve. The resting figure can
     keep drawing additively well into twilight because it is faint; the lamp cannot — at
     6:35 PM, with the resting crossfade only half done, half an additive lamp over a bright
     twilight sky clipped Virgo to a flat white stencil with no drawing left in it. Additive
     light needs a genuinely dark sky, so the lamp is brass from the moment the sky has any
     real brightness in it (the Sun within about a degree and a half of the horizon). */
  const lampInk=(()=>{ const t=Math.max(0,Math.min(1,(day-0.10)/0.28)); return t*t*(3-2*t); })();
  if(layers.art) for(let s=0;s<12;s++){
    const img=RASHI_ART[s+1]; if(!img||!img.complete||!img.naturalWidth) continue;
    const w=litOf(s), q=litQ(w);                /* eased: one figure lit, eleven a whisper */
    const f=artFit(s); if(!f) continue;
    const box=ART_BOX[s+1]||{cx:.5,cy:.5,fw:1,fh:1}, nw=img.naturalWidth, nh=img.naturalHeight;
    const cw=box.fw*nw, chh=box.fh*nh;
    /* which way the figure lies: its long side follows the stars' axis when the stars have
       one; of the two ways round, the one that puts its front on its ART_FRONT star, else
       the one nearer the reference, so no figure stands on its head. A figure with no long
       side keeps image-x along the axis; stars with no axis keep the reference. */
    let psi=f.psiRef;
    if(f.spanAlong>1.25*f.spanAcross){ const tall=chh>1.15*cw, c0=tall?f.th-Math.PI/2:f.th, c1=c0+Math.PI;
      const hs=ART_FRONT[s+1], H=hs!=null?f.xy[hs]:null;
      if(H){ const u0=tall?c0+Math.PI/2:c0;                          /* the figure's front for candidate c0 */
        psi=(Math.cos(u0)*(H[0]-f.mx)+Math.sin(u0)*(H[1]-f.my))>=0?c0:c1; }
      else psi=Math.abs(wrapPi(c0-f.psiRef))<=Math.abs(wrapPi(c1-f.psiRef))?c0:c1; }
    const P=artPlace(f,psi);
    const C=projectV(P.C); if(!onScreen(C[0],C[1],300)) continue;
    const A=projectV(P.P0), B=projectV(P.P1); if(!Number.isFinite(A[0])||!Number.isFinite(B[0])) continue;
    const ppdX=Math.hypot(B[0]-A[0],B[1]-A[1])/10;                 /* px per degree along image-x, here */
    const base=28.6*ppdX;                                          /* the old size: a 22-degree ecliptic chord x1.3 */
    let k=Math.max(P.spanX*1.15*ppdX/cw, P.spanY*1.15*ppdX/chh);    /* cover the star box, image px -> screen px */
    const big=k*Math.max(nw,nh), lim=Math.max(0.6*base,Math.min(1.6*base,big)); k*=lim/big;
    const dw=k*nw, dh=k*nh; if(Math.max(dw,dh)<50) continue;
    const rot=Math.atan2(B[1]-A[1],B[0]-A[0]);
    ART_LAST[s]={psi,scale:lim/base,w:dw,h:dh,rot:rot/D2R,lit:+q.toFixed(3),weight:+w.toFixed(3)};
    c.save(); c.translate(C[0],C[1]); c.rotate(rot);
    /* feet down: when the fit would stand a figure on its head (its up pointing below the
       screen's horizontal), mirror it across its own star axis — head and tail keep their
       stars, the body moves to the other side of the line (the ram near the western horizon
       at 10 AM, 6 Sep) */
    if(Math.cos(rot)<0) c.scale(1,-1);
    /* THE RESTING FIGURE — luminous at night, inked by day, cross-faded through dusk. It
       carries none of the pointing any more: the ink used to climb to 0.55 alpha of deep
       indigo on the figure being pointed at, which is what made a pointed rashi read as a
       dark blue bruise instead of a lit one. It now barely moves; the lamp below does the
       lighting. */
    /* both resting draws fade out by exactly as much as the lamp fades in, so a figure
       CHANGES MATERIAL as the light reaches it — cool white to warm brass at night, indigo
       ink to warm brass by day — instead of stacking a second copy of itself on top. Three
       additive passes of one image blew the lit figure's torso to flat white and lost the
       drawing inside it; a cross-fade keeps every fold. */
    /* the resting draws fade out as the lamp fades in — but not to nothing by DAY. A white
       figure laid on a pale sky needs something under it or it is a silhouette in reverse;
       a quarter of the ink stays to carry the drawing. At night the additive lamp carries
       its own form, so there it fades away completely. */
    const rest=1-q, restInk=1-0.76*q;
    if(ink<1){ c.globalAlpha=0.62*w*dim*(1-ink)*rest; c.globalCompositeOperation="lighter"; c.drawImage(img,-box.cx*dw,-box.cy*dh,dw,dh); }
    if(ink>0){ const inked=artInk(s+1,img);      /* null only while this image's bake waits its frame */
      if(inked){ c.globalAlpha=(0.11+0.24*w)*dim*ink*restInk; c.globalCompositeOperation="source-over"; c.drawImage(inked,-box.cx*dw,-box.cy*dh,dw,dh); } }
    /* THE LAMP — the pointed figure only, warm brass, additive, with its own bloom behind
       it. Additive light reads as illumination on a night sky AND on a bright day one, and
       over the land as readily as over the stars, so a rashi below the horizon lights up
       exactly like one above it. At most two figures carry it at once, and only while the
       light crosses from the last figure to the next. */
    /* `dim` steps everything back behind a selection — but the lit figure IS the selection's
       own rashi, so the lamp must not be dimmed by it or choosing a graha visibly darkens the
       figure it just pointed you at. The lamp keeps full strength exactly as far as it is lit. */
    const lampDim=dim+(1-dim)*q;
    if(q>0.015){ const lamp=artLit(s+1,img); const bl=Math.max(12,0.09*Math.max(dw,dh));
      if(lamp){
        /* Light behaves differently on the two skies, and one rule cannot serve both. At
           NIGHT the figure gives off light: additive, with a bloom behind it. By DAY the sky
           is already near white, so adding light only bleaches the figure to a blank shape
           (verified at 11 AM: Libra went to a white blob) — there a lit figure is one laid on
           in warm brass, saturated against the cool blue, keeping every line of its drawing.
           Both are cross-faded by the same `ink` the resting figure uses, so dusk has no step. */
        /* NIGHT — the figure gives off light: additive, over a cool bloom. */
        if(lampInk<1){ c.globalCompositeOperation="lighter";
          c.shadowColor=`rgba(${BLOOM_RGB},${(0.55*q*(1-lampInk)).toFixed(3)})`; c.shadowBlur=bl;
          c.globalAlpha=0.24*q*lampDim*(1-lampInk); c.drawImage(lamp,-box.cx*dw,-box.cy*dh,dw,dh);
          c.shadowBlur=0; c.shadowColor="rgba(0,0,0,0)";
          c.globalAlpha=0.58*q*lampDim*(1-lampInk); c.drawImage(lamp,-box.cx*dw,-box.cy*dh,dw,dh); }
        /* DAY — the same white figure, laid on rather than added, so a sky that is already
           near white cannot bleach it flat. The ink kept beneath it (see `rest` above) is
           what holds the drawing; the tint used to do that job and made it beige. */
        if(lampInk>0){ c.globalCompositeOperation="source-over";
          c.shadowColor=`rgba(${BLOOM_RGB},${(0.42*q*lampInk).toFixed(3)})`; c.shadowBlur=bl;
          c.globalAlpha=0.78*q*lampDim*lampInk; c.drawImage(lamp,-box.cx*dw,-box.cy*dh,dw,dh);
          c.shadowBlur=0; c.shadowColor="rgba(0,0,0,0)"; } } }
    c.restore();
  }
  artMs=performance.now()-artT0;

  /* --- labels: priority order, one ledger --- */
  const L=makeLedger();
  const sysF=(px,w)=>`${w||500} ${px}px -apple-system,system-ui,sans-serif`;
  const devF=px=>`600 ${px}px "Devanagari Sangam MN","Kohinoor Devanagari","Noto Sans Devanagari",-apple-system,system-ui,sans-serif`;
  /* graha discs claim first so no caption ever sits on a planet */
  const discs=cache.grahas.map(p=>{ const [x,y]=project(p);
    const R=grahaR(p.g,vFov), Re=Math.round(R*((GRAHA_BASE[p.g]?.extent||1.34)-0.34));   /* rings / corona reach */
    const vis=onScreen(x,y,60); if(vis) L.claim(x,y,2*Re+6,2*Re+6); return {p,x,y,R,Re,vis}; });
  const tgt=targetPos(); const tgtXY=tgt?project(tgt):null;
  if(tgtXY&&Number.isFinite(tgtXY[0])) L.claim(tgtXY[0],tgtXY[1],60,60);
  /* the compass marks claim next: a person must always know which way they face, so a
     caption moves rather than the mark (drawn last, over the land, see below) */
  const compass=[];
  if(layers.horizon) for(const [az,t] of [[0,"N"],[45,"NE"],[90,"E"],[135,"SE"],[180,"S"],[225,"SW"],[270,"W"],[315,"NW"]]){
    const card=t.length===1;
    const p=project({alt:-1.2,az}); if(!onScreen(p[0],p[1],20)) continue;
    const font=`700 ${card?12:9.5}px -apple-system,system-ui,sans-serif`; c.font=font;
    const w=Math.ceil(c.measureText(t).width)+(card?16:12), h=card?20:16;
    const pos=L.place(p[0],p[1]+12,w,h,[[0,0],[0,10],[0,-22]]); if(!pos) continue;
    compass.push({t,card,x:p[0],y0:p[1],cx:pos[0],cy:pos[1],w,h,font});
  }
  if(typeof window!=="undefined") window.__skyCompass=compass.map(m=>({t:m.t,x:Math.round(m.cx),y:Math.round(m.cy)}));
  /* 1. the selected target label + 2. grahas */
  const grahaLabels=[]; const LABEL_LOG=[]; if(typeof window!=="undefined") window.__skyLabels=LABEL_LOG;
  for(const {p,x,y,R,Re,vis} of discs){
    if(!vis||!layers.planets) continue;
    const isT=target&&target.t==="graha"&&target.g===p.g;
    /* the planet sitting in the rashi you point at lights up with it, so
       "which planet is in which rashi" is felt rather than read — below the
       horizon too, where its caption says when it rises */
    const lit=isT||(pointedSign!=null&&sgOf(p.L)===pointedSign);
    if(!p.up&&!isT&&!lit&&mode!=="birth") continue;
    const txt=p.g+(p.retro&&p.g!=="Rahu"&&p.g!=="Ketu"?" ℞":"");
    if(lit&&!isT) glowDot(c,x,y,Re*2.9,"241,231,201",(p.up?0.30:0.22)*dim);
    grahaLabels.push({p,x,y,R:Re,isT,lit,txt});
  }
  grahaLabels.sort((a,b)=>((b.isT?2:0)+(b.lit?1:0))-((a.isT?2:0)+(a.lit?1:0)));
  const drawnLabels=[];
  for(const g of grahaLabels){
    const font=sysF(g.isT?14.5:g.lit?14.5:12.5,g.isT||g.lit?700:600); c.font=font;
    const w=c.measureText(g.txt).width+4;
    const pos=L.place(g.x,g.y,w,15,[[0,g.R+19],[0,-g.R-18],[g.R+w/2+12,0],[-g.R-w/2-12,0]]);
    if(!pos){ LABEL_LOG.push({g:g.p.g,placed:false}); continue; }
    const d={...g,font,pos,w,sub:null,subPos:null};
    if(g.isT||g.lit){ /* one concise identification: rashi · nakshatra, under the name — and, below
                         the horizon, when it rises (Sangram, 6 Sep). Placed HERE, before the band's
                         names claim their lanes, so a lit planet's caption sits under its name and
                         the band yields (7 Sep: the Sun's caption had wandered beside Mercury) */
      const sg=sgOf(g.p.L), nk=nkOf(g.p.L); let sub=`${SIGNS_DEV[sg]} ${layers.sanskrit?SIGNS_SK[sg]:SIGNS_EN[sg]} · ${NAKS[nk]}`;
      if(!g.p.up){ const r=riseAt(g.p); sub+=r?` · rises ${r}`:" · below the horizon"; }
      c.font=devF(10.5); const sw=c.measureText(sub).width+4; const below=pos[1]>g.y;
      /* 19 px clears the name's own box plus the ledger's padding (15 collided with it and
         the caption silently vanished); then the far side, then beside the disc */
      d.sub=sub; d.subPos=L.place(pos[0],pos[1],sw,13,[[0,below?19:-19],[0,below?34:-34],[0,below?-34:34],[sw/2+g.R+22,0],[-(sw/2+g.R+22),0],[0,below?49:-49]]);
    }
    drawnLabels.push(d); LABEL_LOG.push({g:g.p.g,placed:true,pos:pos.map(Math.round),sub:!!d.subPos});
  }
  /* 3 + 4. the tape is engraved: rashi glyph + name set into the upper
     lane, nakshatra names into the lower lane, both running along the
     band. Letterpress = a dark offset copy beneath a light copy. A
     sector too narrow for its text shows only the glyph, then nothing;
     the focused item always falls back to a floating caption. */
  const engrave=(txt,x,y,ang,font,light,alpha)=>{
    c.save(); c.translate(x,y); c.rotate(ang); c.font=font; c.textAlign="center"; c.textBaseline="middle";
    if(day>0.5){ /* daylight: ink pressed into the pale band, light relief above */
      c.fillStyle=`rgba(255,250,240,${0.55*alpha})`; c.fillText(txt,-0.6,-0.7);
      c.fillStyle=`rgba(58,46,24,${0.9*alpha})`; c.fillText(txt,0,0);
    } else {
      c.fillStyle=`rgba(18,14,8,${0.55*alpha})`; c.fillText(txt,0.7,0.9);
      c.fillStyle=light.replace(/[\d.]+\)$/,`${alpha})`); c.fillText(txt,0,0);
    }
    c.restore();
  };
  const laneAt=(mid,e1,e2)=>{               /* screen frame of a sector: centre, tangent angle, up-normal */
    const [x,y]=project(mid); const a=project(e1), b=project(e2);
    if(!onScreen(x,y,40)||!Number.isFinite(a[0])||!Number.isFinite(b[0])) return null;
    const wid=Math.hypot(b[0]-a[0],b[1]-a[1]); if(wid<1) return null;
    let ang=Math.atan2(b[1]-a[1],b[0]-a[0]); if(ang>Math.PI/2) ang-=Math.PI; else if(ang<-Math.PI/2) ang+=Math.PI;
    const nx=-Math.sin(ang), ny=Math.cos(ang);       /* perpendicular; ny>0 means screen-down */
    const ux=ny>0?-nx:nx, uy=ny>0?-ny:ny;            /* unit vector toward screen-up */
    return {x,y,wid,ang,ux,uy};
  };
  /* LOD by field of view: wide = Devanagari alone; medium adds the second line
     (English by default, Sanskrit when the layer is on); no glyph on the band */
  const midLOD=vFov<75;
  if(layers.rashis) for(let s=0;s<12;s++){
    const m=cache.rashiMid[s];
    const f=laneAt(m,cache.ecl[s*15],cache.ecl[s*15+15]); if(!f) continue;
    const lw=bwAt(s*15+7), w=litOf(s), on=s===pointedSign;
    const alpha=(on?1:0.42+0.4*w)*(on?1:dim)*(m.up||on?1:0.55);
    const big=on?Math.min(24,Math.max(17,lw*0.26)):Math.min(20,Math.max(13.5,lw*0.22));
    const dev=SIGNS_DEV[s]; c.font=devF(big); const wDev=c.measureText(dev).width;
    const sub=layers.sanskrit?SIGNS_SK[s]:SIGNS_EN[s];
    const showSub=midLOD&&(on||f.wid>wDev+70);
    const px=f.x+f.ux*lw*(showSub?0.30:0.22), py=f.y+f.uy*lw*(showSub?0.30:0.22);
    if(f.wid>wDev+14&&L.place(px,py,Math.min(f.wid-8,wDev),big+4,[[0,0]])){
      engrave(dev,px,py,f.ang,devF(big),"rgba(214,180,110,1)",alpha);      /* rashi = brass; planets keep the ivory */
      if(showSub){ const sx=f.x+f.ux*lw*0.07, sy=f.y+f.uy*lw*0.07; const fs=on?11.5:10;
        c.font=sysF(fs,on?600:500); const wSub=c.measureText(sub).width;
        if(L.place(sx,sy,wSub,fs+1,[[0,0]])) engrave(sub,sx,sy,f.ang,sysF(fs,on?600:500),"rgba(194,155,78,1)",alpha*0.95); }
    } else if(on){                                        /* focused but cramped: floating caption */
      c.font=devF(17); const w=c.measureText(SIGNS_DEV[s]).width+6;
      const pos=L.place(f.x,f.y,w,20,[[0,-bandW/2-14],[0,bandW/2+16]]);
      if(pos) haloText(c,SIGNS_DEV[s],pos[0],pos[1],"rgba(214,180,110,1)",devF(17));
    }
  }
  const track=t=>t.toUpperCase().split("").join("\u2009");   /* letter-spaced small caps look */
  /* the nakshatra that lights with the rashi: the lit planet's, else the one under the pointing */
  const litG=grahaLabels.filter(g=>g.lit&&!g.isT).map(g=>g.p);
  const litNak=focusNak!=null?focusNak:litG.length?nkOf(litG[0].L):(pointedSign!=null&&POINT.L!=null&&sgOf(POINT.L)===pointedSign?nkOf(POINT.L):null);
  if(layers.naks) for(let i=0;i<27;i++){
    const on=i===focusNak||i===litNak; if(!midLOD&&!on) continue;
    /* below the horizon the name used to be dropped entirely. The grahas down
       there are drawn dimmed, not deleted, and the ring of names is the thing
       that makes the ground legible as sky-you-cannot-see-yet. */
    const m=cache.nakMid[i];
    const below=!m.up;
    const f=laneAt(m,cache.nakEdge[i],cache.nakEdge[(i+1)%27]); if(!f) continue;
    const txt=track(NAKS[i]);
    const lw=bwAt(Math.round((i*NSPAN+NSPAN/2)/2)%181);
    const px=f.x-f.ux*lw*0.26, py=f.y-f.uy*lw*0.26;
    const size=on?12:Math.min(11,Math.max(8,lw*0.11));
    c.font=sysF(size,on?700:600); const w=c.measureText(txt).width;
    if(f.wid>w+12&&L.place(px,py,Math.min(f.wid-6,w),size+3,[[0,0]])){
      engrave(txt,px,py,f.ang,sysF(size,on?700:600),on?"rgba(226,220,255,1)":"rgba(196,188,236,1)",(on?1:0.5)*(on?1:dim)*(below?0.5:1));
    } else if(on){
      const anchors=[[0,bandW/2+14],[0,bandW/2+28],[0,-(bandW/2+14)],[w/2+30,bandW/2+14],[-(w/2+30),bandW/2+14]];
      const pos=L.place(f.x,f.y,w+4,12,anchors);
      if(pos) haloText(c,txt,pos[0],pos[1],"rgba(196,188,236,1)",sysF(10.5,700));
    }
  }
  /* 5. star names only when asked for, and only the bright ones */
  if(layers.starNames&&starA>0.2) for(const s of cache.stars){ if(!s.up||s.m>2.2) continue;
    const [x,y]=project(s); if(!onScreen(x,y,20)) continue;
    c.font=sysF(9.5,500); const w=c.measureText(s.name).width+4;
    const pos=L.place(x,y,w,12,[[0,12],[0,-12]]);
    if(pos) haloText(c,s.name,pos[0],pos[1],`rgba(168,174,203,${0.7*dim})`,sysF(9.5,500)); }

  /* --- vignette: corners recede a little (more at night) --- */
  { const vg=c.createRadialGradient(W/2,H*0.46,Math.min(W,H)*0.45,W/2,H*0.46,Math.max(W,H)*0.78);
    vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,`rgba(2,3,10,${0.22-0.14*day})`);
    c.fillStyle=vg; c.fillRect(0,0,W,H); }
  /* --- grahas: art, halo, phase, nodes; then their labels --- */
  const sunD=discs.find(d=>d.p.g==="Sun");
  /* on the way out to the orrery the sky's bodies are gone by orr 0.50, before
     the ring hangs its own (orrery.js: sc starts at 0.50) — one Sun at a time */
  const so=Math.max(0,Math.min(1,(orr-0.34)/0.16)), skyBodyA=1-so*so*(3-2*so);
  for(const {p,x,y,R,vis} of discs){
    if(!vis||!layers.planets) continue;
    const isT=target&&target.t==="graha"&&target.g===p.g;
    const litHere=pointedSign!=null&&sgOf(p.L)===pointedSign;
    const a=(p.up?1:(isT||litHere?0.72:0.32))*(isT?1:(target?0.55+0.45*(1-focusK):1))*skyBodyA;
    c.globalAlpha=a;
    const ground=day>0.5?"light":"dark";
    const sunOK=sunD&&Number.isFinite(sunD.x)&&p.g!=="Sun";
    let light; if(sunOK){ const dx=sunD.x-x, dy=sunD.y-y, d=Math.hypot(dx,dy)||1; light={x:dx/d,y:dy/d}; }
    const q=(isT||R>=22)?"high":"low";
    if(p.g==="Moon"){
      const sun=cache.grahas[0]; const e=((p.L-sun.L)%360+360)%360, kk=(1-Math.cos(e*D2R))/2, waxing=e<180;
      /* the renderer lights a waxing Moon from +x: turn the frame so that side faces the Sun */
      const th=sunOK?Math.atan2(sunD.y-y,sunD.x-x):(waxing?0:Math.PI);
      c.save(); c.translate(x,y); c.rotate(waxing?th:th-Math.PI);
      drawGraha(c,"Moon",0,0,R,{phase:{illum:kk,waxing},quality:q,focus:isT,ground}); c.restore();
    } else {
      drawGraha(c,p.g,x,y,R,{light,quality:q,focus:isT,ground,tilt:22});
    }
    c.globalAlpha=1;
  }
  for(const g of drawnLabels){
    const a=(g.p.up?1:0.45)*(g.isT?1:(target?0.55+0.45*(1-focusK):1))*skyBodyA;
    const lt=day>0.5;
    plateText(c,g.txt,g.pos[0],g.pos[1],lt?`rgba(22,20,40,${a})`:`rgba(245,246,252,${a})`,g.font,a,lt);
    if(g.sub&&g.subPos){ const p2=g.subPos;
      plateText(c,g.sub,p2[0],p2[1],lt?`rgba(60,54,86,${a})`:`rgba(224,206,160,${a})`,devF(10.5),a*0.92,lt); }
  }
  /* birth ghost: where the selected graha stood at birth */
  if(cache.ghost){ const [x,y]=project(cache.ghost); if(onScreen(x,y,20)){
    c.save(); c.setLineDash([3,3]); c.strokeStyle="rgba(186,148,255,.85)"; c.lineWidth=1.3;
    c.beginPath(); c.arc(x,y,9,0,7); c.stroke(); c.setLineDash([]);
    if(tgtXY&&Number.isFinite(tgtXY[0])){ c.strokeStyle="rgba(186,148,255,.35)"; c.beginPath(); c.moveTo(x,y); c.lineTo(tgtXY[0],tgtXY[1]); c.stroke(); }
    c.restore(); plateText(c,`${target.g} at birth`,x,y+18,"rgba(214,196,255,.95)",sysF(10,500),0.9,day>0.5); } }
  /* lagna: a gold diamond on the rising point, birth mode only */
  if(cache.asc){ const [x,y]=project(cache.asc); if(onScreen(x,y,20)){
    const isT=target&&target.t==="asc";
    c.save(); c.translate(x,y); c.rotate(Math.PI/4);
    c.fillStyle=`rgba(226,190,100,${isT?1:0.9})`; c.strokeStyle="rgba(255,240,200,.9)"; c.lineWidth=1.2;
    c.beginPath(); c.rect(-6,-6,12,12); c.fill(); c.stroke(); c.restore();
    glowDot(c,x,y,26,"226,190,100",.35);
    c.font=sysF(11.5,700); const t=`${birthOpts.sign} Lagna`; const w=c.measureText(t).width+4;
    const pos=L.place(x,y,w,14,[[0,-20],[0,20],[w/2+14,0]]);
    if(pos) plateText(c,t,pos[0],pos[1],"rgba(241,231,201,.98)",sysF(11.5,700),1,day>0.5); } }

  /* --- compass: N E S W as small dark pills on the horizon line, over the land, so they
     read against scenery (Sangram, 6 Sep: "the directions are not really coming up");
     the in-betweens smaller. Placed through the ledger last, so a planet's name wins
     the spot and the mark yields. --- */
  for(const m of compass){
    c.save(); c.globalAlpha=m.card?0.94:0.72; c.font=m.font;
    c.fillStyle="rgba(8,10,26,.66)"; c.beginPath();
    if(c.roundRect) c.roundRect(m.cx-m.w/2,m.cy-m.h/2,m.w,m.h,m.h/2); else c.rect(m.cx-m.w/2,m.cy-m.h/2,m.w,m.h);
    c.fill(); c.strokeStyle="rgba(190,200,240,.38)"; c.lineWidth=1; c.stroke();
    c.strokeStyle="rgba(190,200,240,.55)"; c.beginPath(); c.moveTo(m.x,m.y0-3); c.lineTo(m.cx,m.cy-m.h/2); c.stroke();   /* the tick from the line to the pill */
    c.fillStyle=m.card?"rgba(238,242,255,.96)":"rgba(206,214,244,.92)"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(m.t,m.cx,m.cy+0.5);
    c.restore();
  }
  /* --- the guide: halo on the target, or an edge pointer to it --- */
  if(tgt&&orr<0.5){
    const [x,y]=tgtXY;
    const inside=Number.isFinite(x)&&x>36&&x<W-36&&y>110&&y<H-150;
    if(inside){
      const rr=target.t==="graha"?grahaR(target.g,vFov):14;
      const tone=target.t==="graha"?(GRAHA_BASE[target.g]?.token||"241,231,201"):"241,231,201";
      const hg=c.createRadialGradient(x,y,rr*0.9,x,y,rr*2.6);
      hg.addColorStop(0,`rgba(${tone},${day>0.5?0.10:0.22})`); hg.addColorStop(1,`rgba(${tone},0)`);
      c.fillStyle=hg; c.beginPath(); c.arc(x,y,rr*2.6,0,7); c.fill();
      c.strokeStyle=day>0.5?"rgba(40,36,60,.55)":"rgba(241,231,201,.6)"; c.lineWidth=1.2; c.beginPath(); c.arc(x,y,rr+7,0,7); c.stroke();
      if(!target.seen){ target.seen=true; buzz(10); setFoot(); }
    }else{
      target.seen=false;
      /* direction on the sphere, not the flat map: angular offset from the view */
      const dAz=wrap(tgt.az-viewAz), dAlt=tgt.alt-viewAlt;
      const ang=Math.atan2(-dAlt,dAz);
      const cx=W/2, cy=H/2, m=Math.min(W/2-52, H/2-160);
      const ex=cx+Math.cos(ang)*m, ey=cy+Math.sin(ang)*m;
      const bob=reduced?0:4*Math.sin(now/260);
      c.save(); c.translate(ex+Math.cos(ang)*bob,ey+Math.sin(ang)*bob); c.rotate(ang);
      c.fillStyle="rgba(241,231,201,.95)"; c.beginPath(); c.moveTo(16,0); c.lineTo(-8,-10); c.lineTo(-3,0); c.lineTo(-8,10); c.closePath(); c.fill();
      c.restore();
      const total=Math.round(Math.hypot(dAz,dAlt));
      const word=Math.abs(dAz)>=Math.abs(dAlt)?(dAz>0?"right":"left"):(dAlt>0?"up":"down");
      const lbl=!tgt.up&&target.t!=="asc"?`${target.label.split(" · ")[0]} · below horizon`:`${target.label.split(" · ")[0]} · ${total}° ${word}`;
      c.font=sysF(11.5,600); const lw=c.measureText(lbl).width/2+10;
      plateText(c,lbl,Math.max(lw,Math.min(W-lw,ex)),ey+(Math.sin(ang)>0?-22:24),"rgba(241,231,201,.98)",sysF(11.5,600),1,day>0.5);
    }
  }
  if(orr>0.002) drawOrrery(c,W,H,orr,{horizon:hz&&hz.circle,ascAnchor:orrAsc,sidereal:orrSidereal(),grahas:cache.grahas,ecl:cache.ecl,sunAlt:cache.sunAlt,sunAz:cache.grahas[0].az,asc:(mode==="birth"&&birthOpts&&birthOpts.asc!=null)?birthOpts.asc:null,
    spot:cache.sp,layers,target,reduced,now,mode,spin:orrSpin,pitch:orrPitch,names:{SIGNS_DEV,SIGNS_EN,SIGNS_SK,NAKS},padBottom:target&&el.root.classList.contains("hascard")?330:150});
  { const cp=el.root.querySelector("#svcompass"); if(cp&&!cp.hidden){ const g=cp.querySelector(".skrose");
      if(g) g.setAttribute("transform",`rotate(${wrap(-viewAz).toFixed(1)} 24 24)`); } }
  /* accessibility: one sentence describing the view */
  if(now-(el._ariaAt||0)>1500){ el._ariaAt=now;
    { const ul=el.root.querySelector("#svlist"); if(ul){ const html=cache.grahas.map(g=>{ const s=sgOf(g.L), n2=nkOf(g.L);
        return `<li><button data-g="${g.g}" aria-pressed="${target?.t==="graha"&&target.g===g.g}">${g.g}${g.retro&&g.g!=="Rahu"&&g.g!=="Ketu"?" retrograde":""}, ${SIGNS_EN[s]}, ${NAKS[n2]}, ${g.up?Math.round(g.alt)+" degrees up":"below the horizon"}</button></li>`; }).join("");
      if(ul._html!==html){ ul._html=html; ul.innerHTML=html; } } }
    const dir=["north","north-east","east","south-east","south","south-west","west","north-west"][Math.round((((viewAz%360)+360)%360)/45)%8];
    const vis=discs.filter(d=>d.vis&&d.p.up).map(d=>d.p.g);
    el.canvas.setAttribute("aria-label",orr>0.5?`The zodiac ring seen from above the Earth. ${cache.grahas.map(g=>g.g+" in "+SIGNS_EN[sgOf(g.L)]).join(", ")}.${target?" Selected: "+target.label+".":""}`:`Looking ${dir}, ${Math.round(viewAlt)} degrees up. ${vis.length?vis.join(", ")+" visible.":"No graha in view."}${target?" Selected: "+target.label+".":""}`); }
  { const F=window.__skyFrame||(window.__skyFrame={n:0,sum:0,max:0,over16:0,art:0}); const d=performance.now()-_t0; F.n++; F.sum+=d; if(d>F.max) F.max=d; if(d>16) F.over16++; F.art+=(typeof artMs==="number"?artMs:0); }
  rafId=requestAnimationFrame(draw);
}

/* ====================================================================
   SELECTION CARDS — the thing · where it is · what it means to me
   ==================================================================== */
function houseOf(sg){ return birthOpts&&birthOpts.lagna?((sg+1-birthOpts.lagna+12)%12)+1:null; }
/* WHAT KIND OF THING THIS IS (Sangram, 8 Sep: "when you click on any nakshatra or anything,
   and the information card comes up, it just says its name. It should also add a label as to
   whether this is a nakshatra, this is a graha, what it is"). Every card now opens with its
   own class, in the Sanskrit term the app teaches and the plain English that explains it —
   and the grahas are named honestly: Rahu and Ketu are nodes, not planets, and the Sun and
   Moon are luminaries (§ astrological integrity). */
const GRAHA_KIND={Sun:"Luminary",Moon:"Luminary",Rahu:"Lunar node",Ketu:"Lunar node"};
const kindLine=t=>`<span class="skkind">${t}</span>`;
function setFoot(){
  const f=document.getElementById("svfoot"); if(!f) return;
  el.root.classList.toggle("hascard",!!target);
  const chip=document.getElementById("svtrack");
  if(!target){ f.innerHTML=""; f.hidden=true; if(chip) chip.hidden=true; return; }
  f.hidden=false;
  const p=targetPos(); if(!p){ f.innerHTML=""; return; }
  const dir=["N","NE","E","SE","S","SW","W","NW"][Math.round(((p.az%360)+360)%360/45)%8];
  const g=target.t==="graha"?target.g:null;
  if(g){
    const gr=pointGrid(p.L), sg=gr.sign-1, nk=gr.nak;
    const house=houseOf(sg);
    const meaning=mode==="birth"
      ? (house&&PLANET_STORY[g]?PLANET_STORY[g].inHouse[house]:GRAHA_MEANING[g]?.body||"")
      : (house?`${g==="Moon"?"Today":"Right now"} ${g} moves through your ${house}${["st","nd","rd"][house-1]||"th"} house — ${HOUSE_TRANSIT_SENSE[house]||""}.`:GRAHA_MEANING[g]?.body||"");
    const why=mode==="birth"
      ? [`${g} stood in ${SIGNS_EN[sg]} (${SIGNS_SK[sg]}) at ${fmtDMS(gr.degInSign)}, in ${NAKS[nk]} pada ${gr.pada}.`,
         house?`Counted from your ${birthOpts.sign} Lagna, ${SIGNS_EN[sg]} is your ${house}${["st","nd","rd"][house-1]||"th"} house.`:null,
         p.retro&&g!=="Rahu"&&g!=="Ketu"?`It was retrograde at your birth.`:null].filter(Boolean)
      : [`${g} is transiting ${SIGNS_EN[sg]} (${SIGNS_SK[sg]}) at ${fmtDMS(gr.degInSign)}, in ${NAKS[nk]} pada ${gr.pada}.`,
         house?`${SIGNS_EN[sg]} maps to your natal ${house}${["st","nd","rd"][house-1]||"th"} house.`:null,
         p.retro&&g!=="Rahu"&&g!=="Ketu"?`It is retrograde — matters return rather than settle first time.`:null].filter(Boolean);
    /* the peek sheet (§20-21): most of the sky stays visible; meaning first, one primary action */
    const sentence=String(meaning||"").replace(/&#8212;/g,"—").split(/(?<=[.!?])\s/)[0];
    f.innerHTML=`<div class="skcard peek">
      <div class="skcardrow">
        <div class="skart" id="skart" aria-hidden="true"></div>
        <div class="skmain">
          ${kindLine(`Graha · ${GRAHA_KIND[g]||"Planet"}`)}
          <b>${g}${p.retro&&g!=="Rahu"&&g!=="Ketu"?' <i class="skretro">℞</i>':""}</b>
          <span class="skline"><span class="dev">${SIGNS_DEV[sg]}</span> ${layers.sanskrit?SIGNS_SK[sg]:SIGNS_EN[sg]} · ${NAKS[nk]}${house?` · your ${house}${["st","nd","rd"][house-1]||"th"}`:""}${p.up?"":" · below the horizon"}</span>
        </div>
        <button class="skx" id="svclear" aria-label="Clear selection">✕</button>
      </div>
      <p class="skmeaning">${sentence}</p>
      <div class="skacts">
        <button class="skact solid" id="svexplore" aria-label="See more about ${g}">See more</button>
        <button class="skact${trackTarget?" on":""}" id="svtrackb">${trackTarget?"Tracking":"Track"}</button>
      </div>
    </div>`;
    /* the art in the card is the same dimensional object as in the sky */
    try{ const art=document.getElementById("skart"); const c=grahaSprite(g,44,{ground:"dark",quality:"high",tilt:22}); art.appendChild(c); }catch(_){}
    document.getElementById("svexplore").onclick=()=>{
      const pt=targetPos(); const [x,y]=pt?project(pt):[NaN,NaN];
      const origin=Number.isFinite(x)?{x,y,r:grahaR(g,vFov)}:null;
      buzz(8);
      dispatchEvent(new CustomEvent("astra:open",{detail:{kind:"planet",id:g,mode:mode==="birth"?"birth":"now",at:skyDate().toISOString(),from:"sky",emphasis:mode==="birth"?"birth":"now",origin}})); };
    document.getElementById("svtrackb").onclick=()=>{ trackTarget=!trackTarget; setFoot(); buzz(5); if(trackTarget) aimAt(targetPos(),{below:true}); };
  }else if(target.t==="rashi"){
    const s=target.i;
    const here=cache.grahas.filter(x=>sgOf(x.L)===s).map(x=>x.g);
    const naks=signNakshatras(s+1);
    f.innerHTML=`<div class="skcard">
      <div class="skcardrow">
        <div class="skdev">${SIGNS_DEV[s]}</div>
        <div class="skmain">${kindLine("Rashi · Zodiac sign")}<b>${SIGNS_EN[s]} · ${SIGNS_SK[s]}</b>
          <span class="skline"><em>Region</em> ${s*30}° – ${(s+1)*30}° of the sidereal zodiac${houseOf(s)?` · your ${houseOf(s)}${["st","nd","rd"][houseOf(s)-1]||"th"} house`:""}</span>
          <span class="skline"><em>${mode==="birth"?"Here at birth":"Here now"}</em> ${here.length?here.join(", "):"no graha"}</span>
          <span class="skline"><em>Nakshatras</em> ${naks.map(n=>n.padas.length<4?`part of ${n.name}`:n.name).join(", ")}</span>
        </div>
        <button class="skx" id="svclear" aria-label="Clear selection">✕</button>
      </div>
      <div class="skacts">
        ${here.map(g=>`<button class="skact" data-pick="${g}">${g}</button>`).join("")}
        <button class="skact solid" id="svexplore" aria-label="See more about ${SIGNS_EN[s]}">See more</button>
      </div></div>`;
    f.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>selectTarget({t:"graha",g:b.dataset.pick,label:b.dataset.pick}));
    document.getElementById("svexplore").onclick=()=>{ const m=project(cache.rashiMid[s]); const origin=Number.isFinite(m[0])?{x:m[0],y:m[1],r:28}:null; buzz(8);
      dispatchEvent(new CustomEvent("astra:open",{detail:{kind:"rashi",id:s+1,mode:mode==="birth"?"birth":"now",at:skyDate().toISOString(),from:"sky",emphasis:mode==="birth"?"birth":"now",origin}})); };
  }else if(target.t==="nakshatra"){
    const i=target.i, r=nakshatraRange(i), m=NAK_META[i];
    const here=cache.grahas.filter(x=>nkOf(x.L)===i).map(x=>x.g);
    f.innerHTML=`<div class="skcard">
      <div class="skcardrow">
        <img class="skart" src="assets/graha/${nakLord(i).toLowerCase()}.png" alt="">
        <div class="skmain">${kindLine("Nakshatra · Lunar mansion")}<b>${r.name}</b>
          <span class="skline"><em>Range</em> ${fmtDMS(r.start)} – ${fmtDMS(r.end)} · ${r.signs.map(x=>SIGNS_EN[x-1]).join(" and ")}</span>
          <span class="skline"><em>Ruler</em> ${nakLord(i)} · ${m.deity} · ${m.symbol}</span>
          <span class="skline"><em>${mode==="birth"?"Here at birth":"Here now"}</em> ${here.length?here.join(", "):"no graha"}</span>
        </div>
        <button class="skx" id="svclear" aria-label="Clear selection">✕</button>
      </div>
      <div class="skacts">
        ${here.map(g=>`<button class="skact" data-pick="${g}">${g}</button>`).join("")}
        <button class="skact solid" id="svexplore" aria-label="See more about ${r.name}">See more</button>
      </div></div>`;
    f.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>selectTarget({t:"graha",g:b.dataset.pick,label:b.dataset.pick}));
    document.getElementById("svexplore").onclick=()=>{ const m=project(cache.nakMid[i]); const origin=Number.isFinite(m[0])?{x:m[0],y:m[1],r:24}:null; buzz(8);
      dispatchEvent(new CustomEvent("astra:open",{detail:{kind:"nakshatra",id:i,mode:mode==="birth"?"birth":"now",at:skyDate().toISOString(),from:"sky",emphasis:mode==="birth"?"birth":"now",origin}})); };
  }else if(target.t==="asc"){
    const gr=pointGrid(birthOpts.asc);
    f.innerHTML=`<div class="skcard">
      <div class="skcardrow">
        <div class="skdev" style="font-size:22px">◆</div>
        <div class="skmain">${kindLine("Lagna · Rising sign")}<b>${birthOpts.sign} Lagna</b>
          <span class="skline"><em>Rising point</em> ${gr.signName} ${fmtDMS(gr.degInSign)} · ${gr.nakName} pada ${gr.pada}</span>
          <span class="skline skwhere">on the eastern horizon at the first breath</span></div>
        <button class="skx" id="svclear" aria-label="Clear selection">✕</button>
      </div>
      <p class="skmeaning">${gr.signName} was rising on the eastern horizon at your birth. That point fixes your 1st house — and so every other house.</p>
      <div class="skacts"><button class="skact solid" id="svlagna">See in birth chart</button></div></div>`;
    document.getElementById("svlagna").onclick=()=>{ closeSkyView(); dispatchEvent(new CustomEvent("astra:openhouse",{detail:1})); };
  }
  const cb=document.getElementById("svclear"); if(cb) cb.onclick=()=>clearTarget();
  measureCard();
}
/* The seeker's touch strip is 48px wide down the right edge, and the card can
   be over 400px tall — so the strip lay across the card's own close button and
   swallowed every tap on it. The seeker now clears the card by the card's
   measured height, and sits behind it in the stack besides. */
function measureCard(){
  const f=document.getElementById("svfoot"); if(!f||!el) return;
  const set=()=>{ const card=f.querySelector(".skcard");
    el.root.style.setProperty("--cardh", card?`${Math.round(card.getBoundingClientRect().height)}px`:"0px"); };
  set();                       /* the card is in the DOM already; measure it now */
  requestAnimationFrame(set);  /* and again once its entry animation has laid out */
}
function clearTarget(){ target=null; trackTarget=false; ghostBirth=false; revealBelow=false; cache=null; setFoot(); syncFind(); }

/* ====================================================================
   AIM / SEARCH / FIND
   ==================================================================== */
function aimAt(p,opts={}){
  if(!p) return;
  const detachedOrNoSensors=!(sensing&&followSky);
  if(!detachedOrNoSensors&&!opts.force) return;
  /* The floor of six degrees stops a plain "show me Saturn" from pointing at
     the dirt. But while TRACKING through time, following a graha down past
     the horizon is the entire point — Sangram: "when it goes below the Earth,
     then it stops tracking it." It stopped because the aim was clamped to six
     and stayed there. Tracking now follows it down, and turns the ground to
     glass on the way so there is something to see. */
  const floor=opts.below?-50:6;
  if(opts.below&&p.alt<0&&!revealBelow){ revealBelow=true; syncFind(); }
  wantAz=p.az; wantAlt=clampAlt(Math.max(floor,Math.min(66,p.alt)));
  if(reduced||opts.instant){ viewAz=wantAz; viewAlt=wantAlt; }
}
function buildIndex(){
  const items=[];
  GRAHAS.forEach(g=>items.push({t:"graha",g,label:g,kind:"graha",keys:[g,GRAHA_SK[g]].map(x=>x.toLowerCase())}));
  SIGNS_SK.forEach((s,i)=>items.push({t:"rashi",i,label:`${SIGNS_EN[i]} · ${s}`,kind:"rashi",keys:[s.toLowerCase(),SIGNS_EN[i].toLowerCase()]}));
  NAKS.forEach((n,i)=>items.push({t:"nakshatra",i,label:n,kind:"nakshatra",keys:[n.toLowerCase()]}));
  if(birthOpts) items.push({t:"asc",label:`${birthOpts.sign} Lagna`,kind:"lagna",keys:["lagna","ascendant","rising",birthOpts.sign.toLowerCase()]});
  if(layers.starNames) STARS.forEach((s,i)=>items.push({t:"nakshatra",i,label:`${s.name} · ${NAKS[i]}`,kind:"star",keys:[s.name.toLowerCase()]}));
  return items;
}
let INDEX=null, searchCat=null;
const CATS=[["graha","Planets","the nine grahas"],["rashi","Rashis","twelve signs of the zodiac"],["nakshatra","Nakshatras","twenty-seven lunar mansions"],["lagna","Lagna","the rising point at birth"],["star","Stars","the bright yogataras"]];
function hitLabel(h){
  if(h.t==="rashi") return `<b class="dev">${SIGNS_DEV[h.i]}</b><span class="sub">${SIGNS_EN[h.i]} · ${SIGNS_SK[h.i]}</span>`;
  if(h.t==="nakshatra"&&h.kind==="nakshatra"){ const r=nakshatraRange(h.i), s0=r.signs[0], s1=r.signs[r.signs.length-1];
    return `<b>${NAKS[h.i]}</b><span class="sub">${SIGNS_EN[s0-1]}${s1!==s0?` – ${SIGNS_EN[s1-1]}`:""}</span>`; }
  if(h.t==="graha") return `<b>${h.g}</b><span class="sub">${GRAHA_SK[h.g]}</span>`;
  return `<b>${h.label}</b><span class="sub">${h.kind}</span>`;
}
function renderSearch(q){
  const res=document.getElementById("svres"); if(!res) return; q=(q||"").trim().toLowerCase();
  INDEX=buildIndex();
  const bind=(hits)=>{ res.querySelectorAll(".svhit").forEach((b,i)=>b.onclick=()=>{ selectTarget(hits[i]); document.getElementById("svsearch").hidden=true; }); };
  if(q){
    const hits=INDEX.filter(it=>it.keys.some(k=>k.startsWith(q)))
      .concat(INDEX.filter(it=>it.keys.some(k=>!k.startsWith(q)&&k.includes(q)))).slice(0,12);
    res.innerHTML=hits.length?hits.map(h=>`<button class="svhit">${hitLabel(h)}</button>`).join(""):`<p class="svnone">Nothing in the sky by that name.</p>`;
    bind(hits); return;
  }
  if(!searchCat){
    const avail=CATS.filter(([k])=>INDEX.some(it=>it.kind===k));
    res.innerHTML=`<p class="skseyebrow">Find in the sky</p><div class="skcats">${avail.map(([k,l,n])=>`<button class="skcat" data-c="${k}"><i class="ci ${k}"></i><span><b>${l}</b><small>${n}</small></span><em>›</em></button>`).join("")}</div>`;
    res.querySelectorAll(".skcat").forEach(b=>b.onclick=()=>{ searchCat=b.dataset.c; buzz(4); renderSearch(""); });
    return;
  }
  const hits=INDEX.filter(it=>it.kind===searchCat);
  const title=(CATS.find(([k])=>k===searchCat)||[])[1]||"";
  res.innerHTML=`<button class="skcatback" id="svcatback">‹ ${title}</button><div class="skcatlist">${hits.map(h=>`<button class="svhit">${hitLabel(h)}</button>`).join("")}</div>`;
  res.querySelector("#svcatback").onclick=()=>{ searchCat=null; renderSearch(""); };
  bind(hits);
}
const runSearch=renderSearch;
function selectTarget(hit){
  if(hit.t==="asc"&&mode!=="birth"){ setSkyMode("birth"); }
  revealBelow=false;
  target={...hit,seen:false};
  const q=document.getElementById("svq"), res=document.getElementById("svres");
  if(q){ q.value=""; q.blur(); } if(res) res.innerHTML="";
  cache=null; computeSky();
  aimAt(targetPos());
  buzz(6); setFoot(); syncFind(); wakeUI();
}
/* Find-mode helpers for manual explore: fly there, or hand back to the phone */
function syncFind(){
  const fb=el?.root.querySelector("#svfind"); if(!fb) return;
  if(!target){ fb.hidden=true; return; }
  const p=targetPos(); if(!p){ fb.hidden=true; return; }
  const [x,y]=project(p); const inside=Number.isFinite(x)&&x>36&&x<CAM.W-36&&y>110&&y<CAM.H-150;
  if(inside||(sensing&&followSky)){ fb.hidden=true; return; }
  fb.hidden=false;
  const below=!p.up&&target.t!=="asc";
  fb.innerHTML=below
    ?`<button class="skpill solid" id="svreveal">${revealBelow?"Hide the ground":"Show below horizon"}</button>${sensing?`<button class="skpill" id="svtrackp">Track with phone</button>`:""}`
    :`<button class="skpill solid" id="svgo">Take me there</button>${sensing?`<button class="skpill" id="svtrackp">Track with phone</button>`:""}`;
  const go=fb.querySelector("#svgo"); if(go) go.onclick=()=>{ aimAt(targetPos(),{force:true}); buzz(6); };
  const rv=fb.querySelector("#svreveal"); if(rv) rv.onclick=()=>{ revealBelow=!revealBelow; if(revealBelow){ followSky=false; aimAt(targetPos(),{force:true}); } buzz(6); syncFind(); syncRecenter(); };
  const tp=fb.querySelector("#svtrackp"); if(tp) tp.onclick=()=>{ followSky=true; syncRecenter(); buzz(6); };
}

/* ====================================================================
   MODE + CAPSULE (the single contextual line)
   ==================================================================== */
const CAL_SVG=`<svg class="skcal" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`;
function fmtMoment(){
  const w=document.getElementById("svcap"); if(!w) return;
  const tz=skyTz(); const d=skyDate();
  const t=fmtLocal(d,tz,{hour:"numeric",minute:"2-digit"});
  const dd=fmtLocal(d,tz,{day:"numeric",month:"short",year:"numeric"});
  const ab=tzAbbr(d,tz);
  if(mode==="birth"){
    const natal=new Date(birthOpts.date);
    if(!birthSeek||Math.abs(birthSeek-natal)<30000){
      w.innerHTML=`${CAL_SVG}<span>${esc(dd)} · ${esc(birthOpts.place.split(",")[0])}</span><i class="skpen" aria-hidden="true">✎</i>`;
      w.dataset.act="birthedit";
    }else{
      const mins=Math.round((birthSeek-natal)/60000), abs=Math.abs(mins);
      const span=abs<60?`${abs} min`:abs<1440?`${Math.floor(abs/60)}h ${abs%60?abs%60+"m":""}`.trim():`${Math.round(abs/1440)} d`;
      w.innerHTML=`${CAL_SVG}<span>${span} ${mins<0?"before":"after"} birth</span><b class="skreturn">Birth time</b>`;
      w.dataset.act="birthreturn";
    }
  }else if(custom){
    w.innerHTML=`${CAL_SVG}<span>${esc(dd)} · ${esc(custom.place.split(",")[0])}</span><b class="skreturn">\u21ba Now</b>`;
    w.dataset.act="live";
  }else if(seek){
    w.innerHTML=`${CAL_SVG}<span>${esc(dd)} · ${esc(placeName())}</span><b class="skreturn">\u21ba Now</b>`;
    w.dataset.act="live";
  }else{
    /* the time is the seeker's to show; the pill names the day and the place */
    w.innerHTML=`${CAL_SVG}<span>${esc(dd)} · ${esc(placeName())}</span><i class="skpen" aria-hidden="true">✎</i>`;
    w.dataset.act="edit";
  }
}
function placeName(){
  const f=String(spot.from||"");
  if(!/your location|approximate/i.test(f)) return f.split(",")[0];
  return nearestCity(spot.lat,spot.lon)||(f.includes("approximate")?f.replace(/\s*\(approximate\)/,""):"your location");
}
function setSkyMode(m,opts={}){
  if(m===mode||(m==="birth"&&!birthOpts)) return;
  const prev=cache?Object.fromEntries(cache.grahas.map(x=>[x.g,x.L])):null;
  mode=m; birthSeek=null; seek=null;
  el.root.classList.toggle("birthmode",m==="birth");
  el.root.querySelectorAll("#svseg button").forEach(b=>{ b.classList.toggle("on",b.dataset.m===m); b.setAttribute("aria-selected",b.dataset.m===m); });
  if(prev&&!reduced&&!opts.instant) tween={from:prev,t0:performance.now(),ms:900};
  cache=null; computeSky();
  if(m==="birth"){
    toast("The sky you were born under.");
    if(!target&&cache.asc) target={t:"asc",label:`${birthOpts.sign} Lagna`,kind:"lagna",seen:false};
  } else if(target&&target.t==="asc") target=null;
  aimAt(targetPos());
  fmtMoment(); setFoot(); syncFind(); buildSeeker();
}
let toastT=null;
function toast(msg){ if(QUIET) return;
  const t=el.root.querySelector("#sktoast"); if(!t) return;
  t.textContent=msg; t.hidden=false; t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.classList.remove("in"); setTimeout(()=>t.hidden=true,350); },2600);
}

/* ====================================================================
   VERTICAL TIME SEEKER — the signature interaction
   ==================================================================== */
let seekActive=false, seekLastHour=null, seekLastSign=null, seekLastNak=null, seekEvents=null;
function anchorDate(){ return mode==="birth"?new Date(birthOpts.date):custom?new Date(custom.iso):new Date(); }
/* Moon rise/set for the civil day: altitude sign changes, bisected to the minute */
function moonTimes(d,lat,lon){
  const day0=new Date(d); day0.setHours(0,0,0,0);
  const altAt=t=>siderealPointAltAzB(positions(new Date(t)).Moon, eclipticLatitudes(new Date(t)).Moon, new Date(t), lat, lon).alt;
  let rise=null,set=null, prev=altAt(day0.getTime());
  for(let t=day0.getTime()+15*60e3;t<=day0.getTime()+864e5;t+=15*60e3){
    const a=altAt(t);
    if(prev<0&&a>=0||prev>=0&&a<0){ let lo=t-15*60e3, hi=t; for(let i=0;i<10;i++){ const m=(lo+hi)/2; ((altAt(m)>=0)===(a>=0))?hi=m:lo=m; }
      if(a>=0) rise=rise||new Date((lo+hi)/2); else set=set||new Date((lo+hi)/2); }
    prev=a;
  }
  return {rise,set};
}
function buildSeeker(){
  const s=el.root.querySelector("#svseek"); if(!s) return;
  const d=skyDate(), sp=skySpot(), tz=skyTz();
  const st=sunTimes(d,sp.lat,sp.lon);
  let mt={rise:null,set:null}; try{ mt=moonTimes(d,sp.lat,sp.lon); }catch(_){}
  seekEvents={rise:st.rise,set:st.set,mrise:mt.rise,mset:mt.set,anchor:anchorDate()};
  paintSeeker();
}
function paintSeeker(){
  const s=el.root.querySelector("#svseek"); if(!s) return;
  const d=skyDate(), tz=skyTz();
  const off=offsetAtTz(tz||Intl.DateTimeFormat().resolvedOptions().timeZone,d.getTime());
  const chip=s.querySelector(".skseekchip");
  const knob=s.querySelector(".skseekknob");
  const rl=s.querySelector(".skseekrule");
  const localMs=d.getTime()+off; const dayStart=localMs-((localMs%864e5)+864e5)%864e5; /* local midnight */
  const frac=(localMs-dayStart)/864e5;
  const say=fmtLocal(d,tz,{hour:"numeric",minute:"2-digit"}); if(chip) chip.textContent=say; s.setAttribute("aria-valuetext",say);
  if(knob) knob.style.top=(frac*100).toFixed(2)+"%";
  if(!rl) return;
  const mark=(dd,cls,txt)=>{ if(!dd) return ""; const f=((dd.getTime()+off)-dayStart)/864e5; if(f<0||f>1) return "";
    return `<i class="${cls}" style="top:${(f*100).toFixed(2)}%">${txt||""}</i>`; };
  rl.innerHTML=[0,3,6,9,12,15,18,21,24].map(h=>`<span style="top:${(h/24*100).toFixed(2)}%">${h===0?"12 AM":h===12?"12 PM":h===24?"12 AM":h<12?h+" AM":(h-12)+" PM"}</span>`).join("")
    +mark(seekEvents?.rise,"sksun","☀")+mark(seekEvents?.set,"sksun","☀")
    +mark(seekEvents?.mrise,"skmoonm","☾")+mark(seekEvents?.mset,"skmoonm","☾")
    +(mode==="birth"?mark(new Date(birthOpts.date),"skbirth"):mark(new Date(),"sknow"));
  s.dataset.day=fmtLocal(d,tz,{day:"numeric",month:"short"});
}
function seekTo(ms){
  const dNew=new Date(ms);
  if(mode==="birth") birthSeek=dNew; else seek=dNew;
  const prevSel=target&&target.t==="graha"?cache.grahas.find(x=>x.g===target.g):null;
  cache=null; computeSky();
  /* haptics: hour, sunrise/sunset, the anchor, and the selected graha's sign/nakshatra edges */
  const tz=skyTz(); const unit=36e5;   /* an hour a tick, on the ground and above it */
  const hr=Math.floor((ms+offsetAtTz(tz||Intl.DateTimeFormat().resolvedOptions().timeZone,ms))/unit);
  if(seekLastHour!==null&&hr!==seekLastHour) buzz(3);
  seekLastHour=hr;
  const crossed=(t)=>t&&prevSeekMs!=null&&((prevSeekMs<t.getTime())!==(ms<t.getTime()));
  if(crossed(seekEvents?.rise)||crossed(seekEvents?.set)||crossed(seekEvents?.anchor)) buzz(9);
  else if(crossed(seekEvents?.mrise)||crossed(seekEvents?.mset)) buzz(6);
  if(prevSel){ const nowSel=cache.grahas.find(x=>x.g===target.g);
    const s0=sgOf(prevSel.L), s1=sgOf(nowSel.L), n0=nkOf(prevSel.L), n1=nkOf(nowSel.L);
    if(s0!==s1){ buzz(8); toast(`${target.g} entered ${SIGNS_EN[s1]}`); }
    else if(n0!==n1&&(target.g==="Moon"||vFov<45)){ buzz(4); toast(`${target.g} entered ${NAKS[n1]}`); }
    if((prevSel.alt>0)!==(nowSel.alt>0)) buzz(6);
    if(trackTarget) aimAt(nowSel,{force:true,instant:true,below:true}); }
  prevSeekMs=ms;
  fmtMoment(); paintSeeker();
  /* the card is DOM: rebuilt at most six times a second while scrubbing */
  const tNow=performance.now(); if(tNow>=footDue){ footDue=tNow+160; setFoot(); }
}
let prevSeekMs=null, seekWant=null, footDue=0;
function wireSeeker(){
  const s=el.root.querySelector("#svseek"); if(!s) return;
  let dragging=false, startY=0, startMs=0, holdT=null;
  const H=()=>s.getBoundingClientRect().height;
  const expand=on=>{ s.classList.toggle("open",on); seekActive=on; if(on){ buildSeeker(); paintSeeker(); } };
  s.addEventListener("pointerdown",e=>{ e.stopPropagation(); dragging=true; startY=e.clientY; startMs=skyDate().getTime(); prevSeekMs=startMs;
    seekLastHour=null; try{ s.setPointerCapture(e.pointerId); }catch(_){} holdT=setTimeout(()=>expand(true),140); wakeUI(); });
  s.addEventListener("pointermove",e=>{ if(!dragging) return; e.stopPropagation();
    const dy=e.clientY-startY; if(Math.abs(dy)>4&&!seekActive){ clearTimeout(holdT); expand(true); }
    if(!seekActive) return;
    const ms=startMs+(dy/H())*seekSpan();  /* down = later, like reading top to bottom */
    /* the finger only names the moment; the frame loop glides the sky to it at display rate
       (seekWant, draw()). Recomputing the whole sky inside every pointer event was the
       stutter (Sangram, 7 Sep: "buttery smooth… frames for every small movement") */
    seekWant=Math.round(ms/60000)*60000; });
  const end=e=>{ if(!dragging) return; dragging=false; clearTimeout(holdT); setTimeout(()=>expand(false),900); };
  s.addEventListener("pointerup",end); s.addEventListener("pointercancel",end);
  s.addEventListener("keydown",e=>{ const step=e.shiftKey?60:15; let ms=skyDate().getTime();
    if(e.key==="ArrowDown"){ ms+=step*60000; } else if(e.key==="ArrowUp"){ ms-=step*60000; } else return;
    e.preventDefault(); prevSeekMs=skyDate().getTime(); seekTo(ms); });
}
function returnToAnchor(){ if(mode==="birth") birthSeek=null; else { seek=null; custom=custom&&custom.fromLink?null:custom; }
  cache=null; computeSky(); fmtMoment(); paintSeeker(); setFoot(); buzz(7); }

/* ====================================================================
   LAYERS SHEET
   ==================================================================== */
let layersClosing=null, layersOpen=false;
/* Audited 5 Sep (Sangram: "do not expose a setting merely because the renderer
   has a boolean"). Eight booleans exist. Planets is gone from the UI. Five are
   COMMON — each changes what a person sees at a glance. Two are ADVANCED:
   star names are for the curious, Sanskrit names are a labelling preference. */
/* Sangram, 5 Sep 20:30: "all the layers should be visible when the bottom
   tray opens … tap or untap … I don't want multiple different things,
   dropdowns, or tabs." And 6 Sep: no preset tiles ("we can get rid of it"),
   no Horizon chip ("horizon should always be there"), an even count. One
   grid, six chips. Each chip carries the colour its kind wears in the sky,
   so the tray doubles as the legend. */
/* the same three colours the sky draws with: rashi brass, nakshatra lavender, planet ivory */
export const KIND_COLOUR={rashi:"#D6B46E", nak:"#C4BCEC", star:"#E4EAFF", planet:"#F1E7C9", land:"#7F9A72"};
const LAYER_ALL=[["rashis","Rashis",KIND_COLOUR.rashi],["naks","Nakshatras",KIND_COLOUR.nak],["art","Rashi artwork",KIND_COLOUR.rashi],
  ["stars","Stars",KIND_COLOUR.star],["starNames","Star names",KIND_COLOUR.star],["sanskrit","Sanskrit names",KIND_COLOUR.rashi]];
function paintLayers(){
  const sh=el.root.querySelector("#svlayers"); if(!sh) return;
  const chip=(k,label,col)=>`<button class="sklchip" data-l="${k}" role="switch" aria-checked="${!!layers[k]}" style="--kc:${col}"><i class="sklk" aria-hidden="true"></i><span>${label}</span></button>`;
  /* a plain drawer (Sangram, 6 Sep): six chips need no grab handle and no
     pull-to-dismiss — it slides up, the ✕, the scrim or Escape closes it */
  sh.innerHTML=`<div class="sklhandle">
    <div class="sklhead"><b id="svltitle">Layers</b><button class="skx" id="svlclose" aria-label="Close">✕</button></div></div>
    <div class="sklbody">
    <div class="sklgrid">${LAYER_ALL.map(r=>chip(...r)).join("")}</div>
    </div>`;
  sh.onclick=e=>{
    const sw=e.target.closest("[data-l]");
    if(sw){ layers[sw.dataset.l]=!layers[sw.dataset.l]; saveLayers(); syncLayers(sh); buzz(4); return; }
    if(e.target.closest("#svlclose")){ closeLayers(); }
  };
}
/* Patch the sheet that is already on screen. Re-rendering with innerHTML
   threw the focused switch away — VoiceOver landed on nothing, and the next
   Escape closed the whole sky instead of the sheet. */
function syncLayers(sh){
  sh.querySelectorAll("[data-l]").forEach(b=>{ const on=!!layers[b.dataset.l]; b.setAttribute("aria-checked",on); });
}
/* The sheet OVERLAYS the canvas — nothing is resized, so the camera cannot move.
   It never dismisses itself: no timer, no mode change closes it. Only the
   person does — grabber swipe, tap on the sky, ✕, or the Layers button again. */
function openLayers(){
  const sh=el.root.querySelector("#svlayers"), sc=el.root.querySelector("#svlscrim"), btn=el.root.querySelector("#svlayersb"); if(!sh) return;
  if(layersClosing){ clearTimeout(layersClosing); layersClosing=null; }
  layersOpen=true; paintLayers(); el.root.querySelector("#svsearch").hidden=true;
  sh.hidden=false; sc.hidden=false; sh.style.transform=""; el.root.classList.add("haslayers");
  if(btn) btn.setAttribute("aria-expanded","true");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(!layersOpen) return; sh.classList.add("in");
    /* VoiceOver lands on the title, not on whatever was under the finger */
    const t=sh.querySelector("#svltitle"); if(t){ t.tabIndex=-1; t.focus({preventScroll:true}); } }));
  buzz(5);
}
function closeLayers(immediate){
  const sh=el.root.querySelector("#svlayers"), sc=el.root.querySelector("#svlscrim"), btn=el.root.querySelector("#svlayersb"); if(!sh||!layersOpen) return;
  layersOpen=false;
  sc.hidden=true; el.root.classList.remove("haslayers"); sh.classList.remove("in","dragging"); sh.style.transform="";
  if(btn) btn.setAttribute("aria-expanded","false");
  /* focus goes back to the Layers button unless the person already put it somewhere else */
  const ae=document.activeElement; if(!ae||ae===document.body||sh.contains(ae)){ if(btn) btn.focus({preventScroll:true}); }
  if(layersClosing){ clearTimeout(layersClosing); layersClosing=null; }
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(immediate){ sh.hidden=true; return; }
  /* reduced motion fades (200ms) instead of sliding (380ms); neither is a hard cut */
  const id=setTimeout(()=>{ if(layersClosing!==id) return; layersClosing=null; if(!layersOpen) sh.hidden=true; }, reduce?220:420);
  layersClosing=id;
}
function wireLayers(n){
  n.querySelector("#svlscrim").addEventListener("click",()=>closeLayers());
  /* Escape closes the topmost thing only: the sheet, not the sky view behind it */
  n.querySelector("#svlayers").addEventListener("keydown",e=>{
    if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closeLayers(); return; }
    /* aria-modal is a promise: Tab stays in the drawer, wrapping between ✕ and the last chip */
    if(e.key!=="Tab") return;
    const f=[...e.currentTarget.querySelectorAll("button")]; if(!f.length) return;
    const first=f[0], last=f[f.length-1], a=document.activeElement;
    if(e.shiftKey&&(a===first||!f.includes(a))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&a===last){ e.preventDefault(); first.focus(); }
  });
}

/* ====================================================================
   DEVICE ORIENTATION (validated 30-31 Aug) + Android stream fix
   ==================================================================== */
let yawSt={fix:null,fixT:0,fixT0:0}, sawAbsolute=false;
if(typeof window!=="undefined") window.__skyMotion=()=>({turnRate:+qSpd.v.toFixed(2),tau:+camTau.toFixed(1),
  lag:camQ&&wantQ?+quatAngle(camQ,wantQ).toFixed(3):null,reacquire});
if(typeof window!=="undefined") window.__skyYaw=()=>({fix:yawSt.fix,avg:yawSt.avg,poorLock:!!yawSt.poorLock,moving:yawSt.movingT!=null&&performance.now()-yawSt.movingT<500,reacquire});   /* for the pane and the replay harness */
function onOrient(ev){
  if(ev.alpha==null && ev.webkitCompassHeading==null) return;
  if(ev.webkitCompassHeading==null){ if(ev.absolute===true) sawAbsolute=true; else if(sawAbsolute) return; }
  const D=Math.PI/180;

  /* THE HEADING GOES IN AS ALPHA, NOT AS AN OFFSET ON THE ANSWER.
     This used to north-reference by estimating `webkitCompassHeading - azm`
     and adding it back. Those are not the same kind of angle.
     webkitCompassHeading is a YAW — a rotation about the vertical, a function
     of alpha alone. `azm` is the BEARING OF THE LOOK DIRECTION, which depends
     on alpha, beta AND gamma. Their difference therefore is not a constant: it
     carries a tilt term whose size and SIGN are set by how far the hand is
     rolled. Treating it as a constant, and low-passing it fast, let it absorb
     the tilt — so raising the phone rotated the sky on its own, one way for a
     left-rolled hand and the other for a right-rolled one. Sangram: "the AR
     view snaps in different directions ... it just takes control."

     Simulated against the shipped code on that exact motion — due east
     throughout, only the tilt changing, twelve degrees of hand roll: the view
     swung 39 degrees at a peak of 287 deg/s against a 62-degree field, and
     came back down 33 degrees from where it started.

     WITH THE HAND EXACTLY LEVEL THE OLD ERROR WAS EXACTLY ZERO. That is why
     it survived every desk test, every simulator run and every screenshot
     gate, and why the previous fix — a trust taper — could only soften it.

     Referenced here instead, alpha and the compass are both yaws, the
     subtraction is a genuine constant, and the matrix below is the only thing
     that decides where the camera looks. */
  let aDeg;
  if(ev.webkitCompassHeading!=null){
    const h=((360-ev.webkitCompassHeading)%360+360)%360;         /* the W3C alpha for true north */
    if(ev.alpha!=null){
      /* the gyro carries the view, the compass is consulted — fuseYaw() in orient.js;
         tools/validate_ar_motion.mjs replays the motions Sangram reported */
      sensing=true; el._lastSensor=performance.now();
      aDeg=fuseYaw(yawSt, ev.alpha, ev.beta||0, ev.gamma||0, h, ev.webkitCompassAccuracy, performance.now());
      if(aDeg==null) return;
    } else aDeg=h;                                               /* no gyro yaw at all: the compass alone */
  } else if(ev.absolute===true){
    aDeg=ev.alpha||0;                                            /* Android is already north-referenced */
  } else if(yawSt.fix!=null && ev.alpha!=null){
    aDeg=ev.alpha+yawSt.fix;                                      /* iOS dropped the compass for a frame: coast */
  } else return;

  const B=deviceBasis(aDeg, ev.beta||0, ev.gamma||0);
  const {az:azm, alt:altm}=azAltOf(B.f);

  sensing=true; el._lastSensor=performance.now();
  if(!followSky) return;                                        /* detached: the drag camera owns the view */
  const nq=quatFromBasis(B);
  /* HOW FAST THE HAND IS TURNING, straight off the sensor stream, in degrees a second.
     One fixed smoothing constant cannot serve both ends of the motion: tight enough to
     follow a deliberate sweep without the sky trailing the phone is loose enough to show
     every micro-tremor when the phone is held still, and calm enough to hold a still image
     is laggy in a sweep. So the constant now follows the hand (see updateCamera). The speed
     itself is smoothed over ~120 ms, or it would be as noisy as the thing it is measuring. */
  const tn=performance.now(), dtq=Math.max(1,Math.min(200,tn-(qSpd.t||tn)));
  if(!qSpd.f||!qSpd.s){ qSpd.f=nq; qSpd.s=nq; }
  else { qSpd.f=slerp(qSpd.f,nq,1-Math.exp(-dtq/QT_FAST));
         qSpd.s=slerp(qSpd.s,nq,1-Math.exp(-dtq/QT_SLOW)); }
  qSpd.v=Math.max(0,quatAngle(qSpd.f,qSpd.s)/((QT_SLOW-QT_FAST)/1000)-QT_FLOOR);
  qSpd.t=tn;
  wantQ=nq;

  /* Within a few degrees of straight up the look direction's BEARING is
     genuinely undefined — every azimuth names the same patch of sky — so it is
     held there. The window is narrow now (80 to 88) because the azimuth below
     it is finally correct; the old 58-to-80 taper was hiding the tilt error
     rather than the pole, and it is what made the last stretch of the climb
     feel like the view was fighting the hand.

     The per-sample step cap is gone with it. Lag that catches up later IS a
     snap, which is the failure the freeze produced before; and at iOS's ~60Hz
     the old nine-degree cap permitted 540 deg/s, so it never bounded anything
     except a genuinely fast pan. */
  /* no taper, no hold: these two are for hand-off to the drag camera and for
     the compass; the camera itself follows wantQ */
  wantAz=azm; wantAlt=altm;
  const fb=el?.root.querySelector("#svrecenter"); if(fb) fb.hidden=true;
}
function armSensors(){ if(watch) return; watch=onOrient;
  yawSt={fix:null,fixT:0,fixT0:0}; sawAbsolute=false; wantQ=null; camQ=null; camBasis=null; reacquire=false;   /* iOS re-references alpha whenever motion updates restart */
  addEventListener("deviceorientationabsolute",watch); addEventListener("deviceorientation",watch); }
let compassShown=false;
function syncLoc(){
  const b=el?.root.querySelector("#svlocb"); if(!b) return;
  const st=!(sensing&&followSky)?"off":(compassShown?"compass":"on");
  b.dataset.state=st;
  b.setAttribute("aria-label",st==="off"?(sensing?"Recenter on my phone":"Follow my phone"):st==="on"?"Show the compass":"Hide the compass");
  const cp=el.root.querySelector("#svcompass"); if(cp) cp.hidden=!compassShown;
  const rc=el.root.querySelector("#svrecenter"); if(rc) rc.hidden=true;
}
const syncRecenter=syncLoc;
/* turn to face north: azimuth to 0, pitch eased back to where the horizon is on screen.
   Detaches from the phone first — otherwise the next sensor frame would snap the view back. */
function faceNorth(){
  buzz(8); followSky=false;
  wantAz=0; wantAlt=clampAlt(Math.max(-4,Math.min(48,viewAlt)));
  if(reduced){ viewAz=wantAz; viewAlt=wantAlt; }
  syncLoc(); wakeUI();
}
function locTap(){
  buzz(7);
  /* seen from above the Earth the button had nothing to follow; it now brings
     you back down to the sky over your own head (Sangram, 5 Sep) */
  if(orrTime()){
    /* above the Earth the button first brings your own place round to the front and level
       (Sangram, 7 Sep); tapped again once it is there, it brings you back down to the sky */
    const d=orrSidereal(), off=((orrSpin-d+180)%360+360)%360-180;
    if(Math.abs(off)>3||Math.abs(orrPitch)>3){ wantSpin=orrSpin-off; wantPitch=0; buzz(6); syncLoc(); return; }
    wantOrr=0; followSky=true; syncLoc(); return; }
  const canAsk=typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function";
  if(!sensing){
    if(canAsk){ DeviceOrientationEvent.requestPermission().then(r=>{ if(r==="granted"){ armSensors(); followSky=true; syncLoc(); }
      else toast("Motion access is off — allow it in Settings › Safari › Motion & Orientation."); }).catch(()=>{}); return; }
    armSensors(); followSky=true;
    if(!sensing){ /* no sensors at all: look east, the sky's natural front */ wantAz=90; wantAlt=Math.max(wantAlt,14); toast("No motion sensors — drag to explore"); }
    syncLoc(); return;
  }
  if(!followSky){ followSky=true; compassShown=false; syncLoc(); return; }
  compassShown=!compassShown; syncLoc();
}

/* ====================================================================
   MOMENT EDITOR (Now mode only — viewing place/date, never natal data)
   ==================================================================== */
let editPlace=null, plistSeq=0;
function tznoteFor(place){ const n=el.root.querySelector(".svtznote"); if(!n) return;
  n.innerHTML=place&&place.tz?"Times follow the place’s own clock — daylight saving included.":"Times are the place’s standard clock time (daylight saving not applied)."; }
function renderPlist(hits){
  const list=el.root.querySelector("#svplist"); if(!list) return;
  list.innerHTML=hits.map((c,i)=>`<button class="svpitem${editPlace&&editPlace.n===c.n?" on":""}" data-i="${i}">${c.raw?esc(c.label):c.label}${c.detail?` <span class="svpsub">${esc(c.detail)}</span>`:""}</button>`).join("");
  list.querySelectorAll(".svpitem").forEach(b=>b.onclick=()=>{ const c=hits[+b.dataset.i];
    editPlace={n:c.n,lat:c.lat,lon:c.lon,off:c.off,tz:c.tz||null}; el.root.querySelector("#svp").value=c.n; list.innerHTML=""; tznoteFor(editPlace); });
}
function pinnedPlaces(){
  const extra=[{label:`Use ${placeName()==="your location"?"my location":placeName()}`,n:placeName(),lat:spot.lat,lon:spot.lon,off:-new Date().getTimezoneOffset()/60,tz:spot.tz||Intl.DateTimeFormat().resolvedOptions().timeZone}];
  if(birthOpts) extra.push({label:`Birthplace · ${birthOpts.place}`,n:birthOpts.place,lat:birthOpts.lat,lon:birthOpts.lon,off:birthOpts.off??5.5,tz:birthOpts.tz||"Asia/Kolkata"});
  return extra;
}
function paintPlist(q){
  const list=el.root.querySelector("#svplist"); if(!list) return;
  const seq=++plistSeq; const pinned=pinnedPlaces();
  if(!q){ renderPlist(pinned.concat(CITIES.slice(0,4).map(cityHit))); return; }
  const lq=q.toLowerCase();
  renderPlist(pinned.filter(p=>p.label.toLowerCase().includes(lq)).concat(CITIES.filter(c=>c[0].toLowerCase().includes(lq)).slice(0,5).map(cityHit)));
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)
    .then(r=>r.json()).then(j=>{ if(seq!==plistSeq) return;
      const hits=(j.results||[]).map(x=>({label:x.name,n:x.name,raw:true,detail:[x.admin1,x.country].filter(Boolean).join(", "),lat:x.latitude,lon:x.longitude,off:offsetAtTz(x.timezone,Date.now())/36e5,tz:x.timezone}));
      if(hits.length) renderPlist(pinned.filter(p=>p.label.toLowerCase().includes(lq)).concat(hits)); }).catch(()=>{});
}
function openEditor(){
  if(!proUser){ dispatchEvent(new CustomEvent("astra:pro")); return; }
  const ed=el.root.querySelector("#svedit"); if(!ed) return;
  ed.hidden=false; const d=skyDate(), tz=skyTz();
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz||undefined,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d);
  const P={}; parts.forEach(p=>P[p.type]=p.value);
  el.root.querySelector("#svd").value=`${P.year}-${P.month}-${P.day}`;
  el.root.querySelector("#svt").value=`${P.hour==="24"?"00":P.hour}:${P.minute}`;
  editPlace=custom?{n:custom.place,lat:custom.lat,lon:custom.lon,off:custom.off,tz:custom.tz||null}
    :{n:placeName(),lat:spot.lat,lon:spot.lon,off:-new Date().getTimezoneOffset()/60,tz:spot.tz||Intl.DateTimeFormat().resolvedOptions().timeZone};
  el.root.querySelector("#svp").value=editPlace.n; paintPlist(""); tznoteFor(editPlace);
}
function applyMoment(){
  const dv=el.root.querySelector("#svd").value, tv=el.root.querySelector("#svt").value||"12:00";
  if(!dv||!editPlace) return;
  const typed=el.root.querySelector("#svp").value.trim();
  if(typed&&typed!==editPlace.n){ const first=el.root.querySelector(".svpitem"); if(first){ first.click(); } }
  const [y,mo,da]=dv.split("-").map(Number), [hh,mi]=tv.split(":").map(Number);
  const when=editPlace.tz?utcFromLocalTz(y,mo,da,hh,mi,editPlace.tz):new Date(Date.UTC(y,mo-1,da,0,Math.round(hh*60+mi-editPlace.off*60)));
  custom={iso:when.toISOString(),lat:editPlace.lat,lon:editPlace.lon,off:editPlace.off,tz:editPlace.tz||null,place:editPlace.n};
  seek=null; el.root.querySelector("#svedit").hidden=true; mode="now";
  cache=null; computeSky(); fmtMoment(); setFoot(); buildSeeker();
  const up=cache.grahas.filter(x=>x.up&&x.g!=="Rahu"&&x.g!=="Ketu"); const aim=up.sort((a,b)=>b.alt-a.alt)[0];
  if(aim) aimAt(aim);
}

/* ====================================================================
   CHROME: immersive fade, hints
   ==================================================================== */
function wakeUI(){ el?.root.classList.remove("quiet"); clearTimeout(uiTimer);
  uiTimer=setTimeout(()=>{ if(el&&!seekActive&&!target) el.root.classList.add("quiet"); },4500); }
function showHints(){
  let seen={}; try{ seen=JSON.parse(localStorage.getItem("astro.sky.hints")||"{}"); }catch(_){}
  const seq=[["move","Move your phone to look around"],["pinch","Pinch to zoom · keep pinching in to see the Earth"],["time","Drag the time bar to move the sky"]]
    .filter(([k])=>!seen[k]);
  if(!seq.length) return;
  let i=0; const next=()=>{ if(i>=seq.length||!running) return; const [k,msg]=seq[i++];
    toast(msg); seen[k]=1; try{ localStorage.setItem("astro.sky.hints",JSON.stringify(seen)); }catch(_){}
    setTimeout(next,3400); };
  setTimeout(next,1200);
}

/* ====================================================================
   OPEN / CLOSE
   ==================================================================== */
export function openSkyView(opts={}){
  reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  QUIET=!!opts.quiet; ART_PENDING=!!opts.artPending;
  loadLayers(); loadRashiArt();
  if(opts.lat!=null) spot={lat:opts.lat,lon:opts.lon,from:opts.from||"your location",tz:opts.tz||Intl.DateTimeFormat().resolvedOptions().timeZone};
  birthOpts=opts.birth||null; proUser=!!opts.pro;
  mode="now"; custom=null; seek=null; birthSeek=null; followSky=true; target=null; ghostBirth=false; trackTarget=false; tween=null;
  if(opts.at){ const d=new Date(opts.at); if(!isNaN(d)&&Math.abs(d-Date.now())>60000){
    custom={iso:d.toISOString(),lat:spot.lat,lon:spot.lon,off:-d.getTimezoneOffset()/60,tz:spot.tz,place:placeName(),fromLink:true}; } }
  if(!el){
    const n=document.createElement("div"); n.className="skyview sky2"; n.id="skyview";
    n.innerHTML=`<canvas id="svc" role="img" aria-label="The sky"></canvas>
      <ul class="svlist" id="svlist" aria-label="Objects in view"></ul>
      <div class="sktop">
        <div class="svseg" id="svseg" role="tablist" aria-label="Which sky" hidden>
          <button data-m="birth" role="tab" aria-selected="false">Birth</button>
          <button data-m="now" class="on" role="tab" aria-selected="true">Now</button>
        </div>
        <button class="skcap" id="svcap" aria-label="Viewing moment"></button>
      </div>
      <button class="svclose" aria-label="Close">✕</button>
      <button class="skcompass" id="svcompass" hidden aria-label="Compass — tap to face north">
        <svg viewBox="0 0 48 48" aria-hidden="true"><g class="skrose">${ROSE}<path class="sknpt" d="M24 5.4l3.3 6.4h-6.6z"/></g></svg><span>N</span></button>
      <div class="skstack" id="svstack">
        <button class="skstk" id="svsearchb" aria-label="Search the sky"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16.5 16.5l4 4"/></svg></button>
        <button class="skstk" id="svlayersb" aria-label="Layers" aria-haspopup="dialog" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5 9-5z"/><path d="M3 14l9 5 9-5"/></svg></button>
        <button class="skstk skloc" id="svlocb" aria-label="Follow my phone" data-state="off"><svg viewBox="0 0 24 24"><path class="beam" d="M12 3.3v3.3"/><path class="arrowN" d="M12 8.5L17 20.4L12 17.1L7 20.4Z"/><path class="arrow" d="M20.5 3.5L3.5 11l8 2 2 8z"/></svg></button>
      </div>
      <div class="skseek" id="svseek" role="slider" tabindex="0" aria-label="Time of day" aria-valuetext="">
        <div class="skseekchip"></div>
        <div class="skseektrack"><div class="skseekrule"></div><div class="skseekknob"></div></div>
      </div>
      <div class="sksearch" id="svsearch" hidden role="dialog" aria-label="Search the sky">
        <div class="skshead">
          <div class="sksfield"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16.5 16.5l4 4"/></svg>
            <input id="svq" type="search" placeholder="Search the sky" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <button class="skx" id="svsclose" aria-label="Close">✕</button>
        </div>
        <div class="svres" id="svres"></div>
      </div>
      <div class="sklscrim" id="svlscrim" hidden></div>
      <div class="sklayers" id="svlayers" hidden role="dialog" aria-modal="true" aria-labelledby="svltitle"></div>
      <div class="skfind" id="svfind" hidden></div>
      <button class="skpill" id="svrecenter" hidden>⌖ Recenter</button>
      <button class="skpill" id="svmotion" hidden>Follow my phone</button>
      <div class="sktoast" id="sktoast" hidden></div>
      <div class="svedit" id="svedit" hidden>
        <div class="svquick" id="svquick"><button data-q="now">Now</button><button data-q="birth">Birth</button></div>
        <p class="svemote">Every sky is kept. Pick a moment and a place, and stand under it again.</p>
        <div class="sverow">
          <label class="fld"><span class="flabel">Date</span><input type="date" id="svd"></label>
          <label class="fld"><span class="flabel">Local time</span><input type="time" id="svt"></label>
        </div>
        <label class="fld"><span class="flabel">Place</span><input type="search" id="svp" placeholder="Search a city" autocomplete="off" autocorrect="off" spellcheck="false"></label>
        <div class="svplist" id="svplist"></div>
        <p class="svtznote"></p>
        <div class="sverow"><button class="primary" id="svapply">See this sky</button>
          <button class="proclose" id="svcancel" style="margin:0;width:auto;padding:13px 18px">Cancel</button></div>
      </div>
      <div class="svfoot skfoot" id="svfoot" hidden></div>`;
    document.body.appendChild(n);
    el={root:n, canvas:n.querySelector("#svc")};
    ctx=el.canvas.getContext("2d");
    const fit=()=>{ const w=Math.max(innerWidth,document.documentElement.clientWidth||0,320), h=Math.max(innerHeight,document.documentElement.clientHeight||0,480);
      el.canvas.width=w*SKY_DPR; el.canvas.height=h*SKY_DPR; ctx.setTransform(SKY_DPR,0,0,SKY_DPR,0,0); };
    fit(); addEventListener("resize",fit); el._fit=fit;
    n.querySelector(".svclose").onclick=()=>{ if(history.state&&history.state.sky) history.back(); else closeSkyView(); };
    addEventListener("popstate",()=>{ if(running&&!(history.state&&history.state.sky)) closeSkyView(); });
    addEventListener("keydown",e=>{ if(e.key!=="Escape"||!running) return; if(layersOpen){ closeLayers(); return; }
      /* Escape dismisses the topmost panel first. The search sheet and the moment editor sit
         above the canvas and used to fall through here and close the whole sky (§78). */
      const ped=n.querySelector("#svedit"), psr=n.querySelector("#svsearch");
      if(ped&&!ped.hidden){ ped.hidden=true; return; }
      if(psr&&!psr.hidden){ psr.hidden=true; return; }
      n.querySelector(".svclose").click(); });
    n.querySelector("#svsearchb").onclick=()=>{ const s=n.querySelector("#svsearch"); s.hidden=!s.hidden; searchCat=null; if(!s.hidden){ renderSearch(""); } closeLayers(true); wakeUI(); };
    n.querySelector("#svsclose").onclick=()=>{ n.querySelector("#svsearch").hidden=true; };
    n.querySelector("#svlocb").onclick=()=>{ locTap(); };
    n.querySelector("#svcompass").onclick=()=>{ faceNorth(); };
    n.querySelector("#svquick").onclick=e=>{ const b=e.target.closest("[data-q]"); if(!b) return; buzz(6);
      n.querySelector("#svedit").hidden=true;
      if(b.dataset.q==="now"){ custom=null; seek=null; birthSeek=null; if(mode!=="now") setSkyMode("now"); else { cache=null; computeSky(); fmtMoment(); buildSeeker(); } }
      else if(birthOpts){ if(mode!=="birth") setSkyMode("birth"); else { birthSeek=null; cache=null; computeSky(); fmtMoment(); buildSeeker(); } } };
    n.querySelector("#svlayersb").onclick=()=>{ if(layersOpen) closeLayers(); else openLayers(); wakeUI(); };
    wireLayers(n);
    const q=n.querySelector("#svq"); q.oninput=()=>renderSearch(q.value);
    q.onkeydown=e=>{ if(e.key==="Enter"){ const first=n.querySelector(".svhit"); if(first) first.click(); } };
    n.querySelector("#svcap").onclick=e=>{
      if(e.target.closest(".skreturn")){ returnToAnchor(); wakeUI(); return; }   /* the return chip */
      openEditor(); wakeUI(); };
    n.querySelector("#svcancel").onclick=()=>{ n.querySelector("#svedit").hidden=true; };
    n.querySelector("#svapply").onclick=applyMoment;
    n.querySelector("#svp").oninput=e=>paintPlist(e.target.value);
    n.querySelector("#svp").onkeydown=e=>{ if(e.key==="Enter"){ const f=n.querySelector(".svpitem"); if(f) f.click(); } };
    n.querySelector("#svlist").onclick=e=>{ const b=e.target.closest("[data-g]"); if(!b) return; const g=b.dataset.g;
      target={t:"graha",g,label:g,kind:"graha",seen:false}; ghostBirth=false; cache=null; computeSky(); setFoot(); syncFind(); aimAt(targetPos(),{force:true}); buzz(6); };
    n.querySelector("#svrecenter").onclick=()=>{ followSky=true; if(wantOrr>0){ wantOrr=0; vFov=FOV_MAX; } syncRecenter(); buzz(8); wakeUI(); };
    wireSeeker();
    /* gestures: one finger drags (detaches motion), two fingers pinch the field of view, tap selects */
    /* One list of chrome for every gesture guard. Three copies had drifted apart, so a
       double-tap on Layers or Search reached the canvas handler and reset the camera. */
    const SKY_CHROME=".sktop,.svclose,.skstack,.skcompass,.skseek,.sksearch,.sklayers,.sklscrim,.skfind,.skpill,.svedit,.svsearch,.skfoot,.skcard";
    const ptrs=new Map(); let moved=0, pinch0=null, pinched=false;
    n.addEventListener("pointerdown",e=>{
      if(e.target.closest(SKY_CHROME)) return;
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0;
      if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0={d:Math.hypot(a.x-b.x,a.y-b.y),z:zoomOf()}; pinched=true; }
      wakeUI(); });
    n.addEventListener("pointermove",e=>{
      if(!ptrs.has(e.pointerId)) return;
      const prev=ptrs.get(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.size===2&&pinch0){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y);
        setZoom(pinch0.z*pinch0.d/Math.max(20,d)); return; }
      const dx=e.clientX-prev.x, dy=e.clientY-prev.y; moved+=Math.abs(dx)+Math.abs(dy);
      if(moved>10&&sensing&&followSky){ followSky=false; wantAz=viewAz; wantAlt=clampAlt(viewAlt); syncRecenter(); }
      if(orr>0.25){ wantSpin-=dx*0.30; wantPitch=Math.max(-62,Math.min(78,wantPitch+dy*0.17)); return; }
      /* a sideways drag has to turn MORE than dx/F when the camera is pitched: the screen
         foreshortens azimuth by cos(alt). Without this the sky slid under the finger. */
      const F=CAM.F||1, cA=Math.max(0.35,Math.cos(viewAlt*D2R));
      wantAz-=dx/(F*cA)/D2R; wantAlt=clampAlt(wantAlt+dy/F/D2R);
      if(reduced){ viewAz=wantAz; viewAlt=wantAlt; } });
    const up=e=>{ const was=ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if(ptrs.size<2) pinch0=null;
      /* A pinch must never end in a tap. The two-finger branch of pointermove returns before
         `moved` accumulates, so every zoom used to select — or clear — whatever sat under the
         finger that lifted first. Remember that two fingers were down until both are up. */
      const wasPinch=pinched; if(!ptrs.size) pinched=false;
      if(!was||wasPinch||moved>10||!cache||e.type==="pointercancel") return;
      const r=el.canvas.getBoundingClientRect(); const cx=e.clientX-r.left, cy=e.clientY-r.top;
      hitTest(cx,cy); };
    n.addEventListener("pointerup",up); n.addEventListener("pointercancel",up);
    n.addEventListener("dblclick",e=>{ if(e.target.closest(SKY_CHROME)) return;
      if(wantOrr>0){ wantSpin=0; wantPitch=0; wantOrr=0; vFov=FOV_MAX; buzz(6); return; }
      const tp=target&&targetPos(); if(tp){ aimAt(tp,{force:true}); vFov=Math.max(FOV_MIN,Math.min(vFov,40)); buzz(6); } else { vFov=62; buzz(4); } });
    n.addEventListener("wheel",e=>{ setZoom(zoomOf()*(e.deltaY>0?1.08:0.92)); },{passive:true});
  }
  el._fit();
  el.root.classList.add("on"); el.root.classList.remove("birthmode","quiet");
  /* a full-screen view is modal in practice: the app shell underneath must not take Tab or
     VoiceOver focus while the sky is up, and focus starts inside the sky (§84, §86) */
  if(!skyInert.length){ skyOpener=document.activeElement; skyInert=[...document.querySelectorAll(".app,#tabs,#sheet,#calsheet")].filter(x=>!x.inert); skyInert.forEach(x=>{ x.inert=true; }); }
  el.root.tabIndex=-1; el.root.focus({preventScroll:true});
  try{ history.pushState({sky:1},""); }catch(_){}
  const seg=el.root.querySelector("#svseg");
  seg.hidden=!birthOpts;
  seg.querySelectorAll("button").forEach(b=>{ b.classList.toggle("on",b.dataset.m==="now"); b.setAttribute("aria-selected",b.dataset.m==="now"); b.onclick=()=>setSkyMode(b.dataset.m); });
  el.root.querySelector("#svedit").hidden=true; el.root.querySelector("#svsearch").hidden=true; closeLayers(true);
  el.root.querySelector("#svq").value=""; el.root.querySelector("#svres").innerHTML="";
  cache=null; computeSky();
  if(opts.mode==="birth"&&birthOpts){ mode="birth"; el.root.classList.add("birthmode");
    seg.querySelectorAll("button").forEach(b=>{ b.classList.toggle("on",b.dataset.m==="birth"); b.setAttribute("aria-selected",b.dataset.m==="birth"); });
    cache=null; computeSky(); }
  if(opts.focus){ const p=cache.grahas.find(x=>x.g===opts.focus); if(p) target={t:"graha",g:opts.focus,label:opts.focus,kind:"graha",seen:false}; }
  else if(mode==="birth"&&cache.asc) target={t:"asc",label:`${birthOpts.sign} Lagna`,kind:"lagna",seen:false};
  let aim=target&&targetPos();
  if(!aim||(!aim.up&&target.t!=="asc")){ const upG=cache.grahas.filter(x=>x.up&&x.g!=="Rahu"&&x.g!=="Ketu");
    aim=upG.find(x=>x.g===(opts.focus||""))||upG.find(x=>x.g==="Sun")||upG.find(x=>x.g==="Moon")||upG.sort((a,b)=>b.alt-a.alt)[0]||aim||null; }
  if(aim){ wantAz=aim.az; wantAlt=clampAlt(Math.max(8,Math.min(65,aim.alt))); viewAz=reduced?wantAz:wantAz-14; viewAlt=wantAlt; }
  /* ---- reproducible test states (phase gates + phone testers):
     az/alt/fov pin the camera, sel selects without re-aiming, state forces manual | find:<graha> | seek | layers | below ---- */
  if(opts.az!=null){ wantAz=viewAz=((+opts.az)%360+360)%360; }
  if(opts.alt!=null){ wantAlt=viewAlt=clampAlt(+opts.alt); }
  if(opts.fov){ vFov=Math.max(FOV_MIN,Math.min(FOV_MAX,+opts.fov)); }
  orr=wantOrr=0; orrSide=false; orrSpin=orrPitch=wantSpin=wantPitch=0; seekTargetMs=null;
  if(opts.orr!=null){ orr=wantOrr=Math.max(0,Math.min(1,+opts.orr)); orrSide=orr>=0.5; if(wantOrr>0) vFov=FOV_MAX; }
  if(opts.spin!=null) orrSpin=wantSpin=+opts.spin; if(opts.pitch!=null) orrPitch=wantPitch=+opts.pitch;   /* test states: a dragged globe */
  const selOf=s=>{ if(!s) return null; const m=String(s).match(/^(rashi|nak):(\d+)$/);
    if(m) return m[1]==="rashi"?{t:"rashi",i:+m[2],label:SIGNS_SK[+m[2]],kind:"rashi",seen:false}:{t:"nakshatra",i:+m[2],label:NAKS[+m[2]],kind:"nakshatra",seen:false};
    if(s==="asc") return cache.asc?{t:"asc",label:`${birthOpts?.sign||""} Lagna`,kind:"lagna",seen:false}:null;
    return cache.grahas.find(x=>x.g===s)?{t:"graha",g:s,label:s,kind:"graha",seen:false}:null; };
  const st=String(opts.state||"");
  if(opts.sel){ const t=selOf(opts.sel); if(t){ target=t; if(opts.az==null){ const p=targetPos(); if(p&&p.up){ wantAz=viewAz=p.az; wantAlt=viewAlt=clampAlt(p.alt); } } } }
  if(st.startsWith("find:")){ const t=selOf(st.slice(5)); if(t){ target=t; followSky=false; if(opts.az==null){ const p=targetPos(); if(p){ wantAz=viewAz=(p.az+150)%360; wantAlt=viewAlt=20; } } } }
  if(st==="below"){ const down=cache.grahas.filter(x=>!x.up&&x.g!=="Rahu"&&x.g!=="Ketu").sort((a,b)=>b.alt-a.alt)[0]; if(down){ target={t:"graha",g:down.g,label:down.g,kind:"graha",seen:false}; followSky=false; } }
  if(st==="manual"){ followSky=false; }
  if(st==="compass"){ compassShown=true; followSky=false; }
  if(st==="orrery"){ orr=wantOrr=1; orrSide=true; vFov=FOV_MAX; followSky=false; }
  fmtMoment(); setFoot(); syncFind(); buildSeeker(); wakeUI(); showHints();
  if(st==="seek"){ const s=el.root.querySelector("#svseek"); if(s){ s.classList.add("open"); seekActive=true; paintSeeker(); } }
  if(st==="layers"){ openLayers(); }
  if(st==="search"||st.startsWith("search:")){ const s=el.root.querySelector("#svsearch"); if(s){ s.hidden=false; searchCat=st.includes(":")?st.split(":")[1]:null; renderSearch(""); } }
  if(st==="moment"){ openEditor(); }
  if(st==="manual"||st.startsWith("find:")||st==="below"){ setTimeout(syncRecenter,0); setTimeout(syncFind,0); }
  cancelAnimationFrame(rafId); running=true; lastFrame=0; draw();   /* one loop: a close and an open in the same tick used to leave two */
  if(mode==="birth") toast("The sky you were born under.");
  const canAsk=typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function";
  const fb=el.root.querySelector("#svmotion");
  fb.hidden=true;                                   /* the location button owns motion permission now */
  if(!QUIET&&(!canAsk||opts.motion===true)){ armSensors(); }
  setTimeout(syncLoc,50);
  setTimeout(()=>{ if(running&&!sensing) toast(canAsk&&fb&&!fb.hidden?"Drag to explore — or tap Follow my phone":"Motion tracking unavailable · drag to explore"); },2500);
}
function hitTest(cx,cy){
  if(orr>0.5){ const h=orreryHit(cx,cy);
    if(h){ target={...h,seen:true}; ghostBirth=false; revealBelow=false; cache=null; computeSky(); buzz(6); setFoot(); syncFind(); }
    else if(target) clearTarget();
    wakeUI(); return; }
  let best=null,bd=34;
  for(const p of cache.grahas){ const [x,y]=project(p); if(!Number.isFinite(x)) continue; const d2=Math.hypot(x-cx,y-cy); if(d2<bd){bd=d2;best={t:"graha",g:p.g,label:p.g,kind:"graha"};} }
  if(!best&&cache.asc){ const [x,y]=project(cache.asc); if(Number.isFinite(x)&&Math.hypot(x-cx,y-cy)<28) best={t:"asc",label:`${birthOpts.sign} Lagna`,kind:"lagna"}; }
  if(!best&&(layers.rashis||layers.naks)){
    /* the ribbon: nearest ecliptic sample within the band; upper half = rashi, lower = nakshatra */
    let bi=-1,bdd=1e9,by=0;
    cache.ecl.forEach((p,i)=>{ const [x,y]=project(p); if(!Number.isFinite(x)) return; const d=Math.hypot(x-cx,y-cy); if(d<bdd){bdd=d;bi=i;by=y;} });
    const bandW=Math.max(34,Math.min(150,2*BAND_B*ppdCenter()));
    if(bi>=0&&bdd<bandW/2+16){ const L=cache.ecl[bi].L;
      if(cy<=by&&layers.rashis) best={t:"rashi",i:sgOf(L),label:`${SIGNS_EN[sgOf(L)]} · ${SIGNS_SK[sgOf(L)]}`,kind:"rashi"};
      else if(layers.naks) best={t:"nakshatra",i:nkOf(L),label:NAKS[nkOf(L)],kind:"nakshatra"};
      else best={t:"rashi",i:sgOf(L),label:`${SIGNS_EN[sgOf(L)]} · ${SIGNS_SK[sgOf(L)]}`,kind:"rashi"}; }
  }
  if(best){ target={...best,seen:false}; ghostBirth=false; revealBelow=false; cache=null; computeSky(); buzz(6); setFoot(); syncFind(); }
  else if(target){ clearTarget(); }
  wakeUI();
}
export function closeSkyView(){
  running=false; cancelAnimationFrame(rafId); rafId=0; sensing=false; target=null; followSky=true; seekActive=false; tween=null; revealBelow=false;
  orr=wantOrr=0; orrSpin=orrPitch=wantSpin=wantPitch=0; seekTargetMs=null;
  if(watch){ removeEventListener("deviceorientationabsolute",watch); removeEventListener("deviceorientation",watch); watch=null; }
  yawSt={fix:null,fixT:0,fixT0:0}; sawAbsolute=false; wantQ=null; camQ=null; camBasis=null; reacquire=false;
  skyInert.forEach(x=>{ x.inert=false; }); skyInert=[];
  const back=skyOpener; skyOpener=null;
  if(back&&back.isConnected&&back!==document.body&&(document.activeElement===document.body||(el&&el.root.contains(document.activeElement)))) back.focus({preventScroll:true});
  if(el){ el.root.classList.remove("on"); el.root.querySelector("#svq").value=""; el.root.querySelector("#svres").innerHTML=""; el.root.querySelector("#svfoot").hidden=true; }
}
