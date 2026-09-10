/* ====================================================================
   ORRERY — the zodiac seen from above the Earth
   --------------------------------------------------------------------
   Pinch past the widest sky view and the ground falls away: the globe
   you were standing on shrinks to a sphere, and the ribbon that arched
   over your head becomes the ring it always was — the zodiac around the
   Earth, with every graha at its sidereal longitude for the moment on
   the seeker. The Moon rides an inner ring with Rahu and Ketu on it
   (they are the Moon's nodes). The rising sign points at the ring.

   It is a chart in space, not a scale model, and the caption says so.
   Same objects, same names, same taps as the sky. No new screen.

   drawOrrery(ctx, W, H, k, env)  k: 0 = the sky, 1 = the orrery
   orreryHit(x, y)                the object under a tap, or null
   ==================================================================== */
import { drawGraha, GRAHA_BASE } from "./celestial-art.js";
import { renderGlobe } from "./globe.js";

const D2R=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{ t=clamp(t,0,1); return t*t*(3-2*t); };
const NSPAN=360/27;
const sgOf=L=>Math.floor((((L%360)+360)%360)/30);
const nkOf=L=>Math.floor((((L%360)+360)%360)/NSPAN);
const norm=L=>((L%360)+360)%360;

/* NASA's Blue Marble, mapped onto the globe. The projection is the expensive part and it
   only changes when the size or the viewing longitude/latitude change, so it is done once
   into an offscreen canvas and blitted every frame. The terminator, atmosphere and limb
   are painted over it live, so day and night still track the real Sun.
   Public domain, NASA Visible Earth 57752 — see assets/earth/SOURCE.txt. */
let EARTH_TEX=null, EARTH_READY=false, EARTH_PX=null;
function earthTexture(){
  if(EARTH_TEX) return EARTH_TEX;
  EARTH_TEX=new Image();
  EARTH_TEX.decoding="async";
  EARTH_TEX.onload=()=>{ try{
      const c=document.createElement("canvas"); c.width=EARTH_TEX.naturalWidth; c.height=EARTH_TEX.naturalHeight;
      const x=c.getContext("2d",{willReadFrequently:true}); x.drawImage(EARTH_TEX,0,0);
      EARTH_PX=x.getImageData(0,0,c.width,c.height); EARTH_READY=true;
    }catch(_){ EARTH_READY=false; } };
  EARTH_TEX.src=new URL("../../assets/earth/bluemarble_1024.jpg",import.meta.url).href;
  return EARTH_TEX;
}
/* the globe as seen from a given angle. Projection is per-pixel, so the result is cached and
   the angles are quantised to 3 degrees: turning the Earth then costs a few dozen renders
   across a whole drag rather than one per frame. */
const GLOBE=new Map(); const GLOBE_CAP=48;
function globeSprite(D,lat0,lon0,pitch){
  const q=v=>Math.round(v/3)*3;
  const key=`${Math.round(D)}|${q(lat0)}|${q(lon0)}|${q(pitch||0)}`;
  const hit=GLOBE.get(key); if(hit) return hit;
  if(!EARTH_READY||!EARTH_PX) return null;
  lat0=q(lat0); lon0=q(lon0); pitch=q(pitch||0);
  const S=Math.max(24,Math.round(D)), R=S/2;
  const c=document.createElement("canvas"); c.width=S; c.height=S;
  const ctx=c.getContext("2d"); const img=ctx.createImageData(S,S);
  const src=EARTH_PX.data, TW=EARTH_PX.width, TH=EARTH_PX.height, out=img.data;
  const tilt=lat0*D2R-26*D2R+pitch*D2R, ct=Math.cos(tilt), st=Math.sin(tilt);
  const l0=lon0*D2R;
  for(let py=0;py<S;py++){
    const y=(py+0.5-R)/R;
    for(let px=0;px<S;px++){
      const x=(px+0.5-R)/R;
      const d2=x*x+y*y; if(d2>1) continue;
      const z=Math.sqrt(1-d2);
      /* screen (x, -y, z) back through the observer tilt to geographic coordinates */
      const Y=-y, Z=z;
      const Yg=Y*ct+Z*st, Zg=-Y*st+Z*ct;
      const lat=Math.asin(Math.max(-1,Math.min(1,Yg)));
      const lon=Math.atan2(x,Zg)+l0;
      let u=(lon/(2*Math.PI)+0.5)%1; if(u<0) u+=1;
      const v=0.5-lat/Math.PI;
      /* bilinear, wrapping in longitude: the source is 1024x512 and the near
         view magnifies it many times over, so point sampling shows the
         texture's own pixel grid. Four taps costs a cache miss, not a frame. */
      const fx=u*TW-0.5, fy=Math.max(0,Math.min(TH-1.001,v*TH-0.5));
      const x0=Math.floor(fx), y0=Math.floor(fy);
      const tx=fx-x0, ty=fy-y0;
      const xa=((x0%TW)+TW)%TW, xb=(xa+1)%TW;
      const ya=Math.max(0,Math.min(TH-1,y0)), yb=Math.min(TH-1,ya+1);
      const i00=(ya*TW+xa)*4, i10=(ya*TW+xb)*4, i01=(yb*TW+xa)*4, i11=(yb*TW+xb)*4;
      const di=(py*S+px)*4;
      for(let ch=0;ch<3;ch++){
        const top=src[i00+ch]+(src[i10+ch]-src[i00+ch])*tx;
        const bot=src[i01+ch]+(src[i11+ch]-src[i01+ch])*tx;
        out[di+ch]=top+(bot-top)*ty;
      }
      out[di+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  if(GLOBE.size>=GLOBE_CAP) GLOBE.delete(GLOBE.keys().next().value);
  GLOBE.set(key,c); return c;
}

/* The Earth's land as soft blobs [lat, lon, radius in degrees]. This is
   an emblem of home at 60–140 px, not a map: enough that Africa, the
   Americas, Eurasia and Australia read at a glance. */
const LAND=[
  /* Africa */ [5,20,22],[-15,22,15],[20,5,14],[25,20,12],[-28,25,8],[10,40,7],
  /* Europe */ [50,10,10],[55,30,9],[42,20,6],[40,-4,5],[60,15,6],[62,30,7],
  /* Asia */ [55,70,20],[45,100,20],[30,90,14],[60,110,14],[65,140,12],[35,110,10],
             [20,78,12],[48,135,7],[10,102,7],[25,52,8],[33,60,8],[40,45,6],[70,100,10],
  /* North America */ [45,-100,20],[60,-110,16],[35,-100,12],[65,-150,10],[30,-90,8],
             [20,-100,6],[50,-70,8],[72,-40,12],[58,-130,8],
  /* South America */ [-5,-60,16],[-20,-55,12],[-32,-64,8],[5,-70,8],[-45,-70,5],
  /* Australia */ [-25,135,13],[-20,125,6],[-38,145,5],[-40,172,4],
  /* Antarctica */ [-85,0,20],[-78,60,10],[-78,-60,10],[-75,150,8],
];
const RING_R={Sun:15,Moon:10,Mars:9,Mercury:8,Jupiter:12,Venus:9.5,Saturn:11,Rahu:7,Ketu:7};

/* a fixed field of faint stars behind the scene — seeded, never random per frame */
let STARS=null;
function starField(W,H){
  if(STARS&&STARS.W===W&&STARS.H===H) return STARS.pts;
  let s=987654321; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const pts=[]; for(let i=0;i<160;i++) pts.push({x:rnd()*W,y:rnd()*H,r:0.35+rnd()*1.05,a:0.18+rnd()*0.55});
  STARS={W,H,pts}; return pts;
}

/* the last frame's layout, for taps */
let LAST={planets:[],ring:[],band:0,names:null};

function text(c,txt,x,y,fill,font,align="center",halo="rgba(4,5,18,.82)"){
  c.save(); c.font=font; c.textAlign=align; c.textBaseline="middle"; c.lineJoin="round";
  c.lineWidth=3; c.strokeStyle=halo; c.strokeText(txt,x,y); c.fillStyle=fill; c.fillText(txt,x,y); c.restore();
}
const sysF=(px,w)=>`${w||500} ${px}px -apple-system,system-ui,sans-serif`;
const devF=px=>`600 ${px}px "Devanagari Sangam MN","Kohinoor Devanagari","Noto Sans Devanagari",-apple-system,system-ui,sans-serif`;

/* the rising sign for this moment: where the ecliptic crosses the eastern horizon */
export function risingLongitude(ecl){
  if(!ecl||ecl.length<3) return null;
  let east=null, any=null;
  for(let i=0;i<ecl.length-1;i++){ const a=ecl[i], b=ecl[i+1];
    if(!Number.isFinite(a.alt)||!Number.isFinite(b.alt)) continue;
    if(a.alt>0&&b.alt<=0){ const t=a.alt/(a.alt-b.alt); const L=a.L+(b.L-a.L)*t; const az=(a.az+b.az)/2;
      if(any==null) any=L; if(az<180&&east==null) east=L; } }
  return east!=null?east:any;
}

/* a small label ledger of its own — the sky's ledger reserves room for sky chrome */
function ledger(W,H,top,bottom){
  const boxes=[];
  const hit=(b,x,y,w,h)=>Math.abs(b.x-x)<(b.w+w)/2+5&&Math.abs(b.y-y)<(b.h+h)/2+3;
  return {
    claim(x,y,w,h){ boxes.push({x,y,w,h}); },
    place(x,y,w,h,anchors){
      for(const [dx,dy] of anchors){ const px=x+dx, py=y+dy;
        if(px-w/2<4||px+w/2>W-4||py<top||py>H-bottom) continue;
        if(!boxes.some(b=>hit(b,px,py,w,h))){ boxes.push({x:px,y:py,w,h}); return [px,py]; } }
      return null; }
  };
}

/* ---- the Earth ------------------------------------------------------ */
/* THE GLOBE IS LIT BY THE SUN, NOT BY THE RING.
   `light` arrives as a direction taken from the Sun's position on the zodiac
   ring. The terminator below does not use it — it is built from the observer's
   own solar altitude and azimuth, which is what fixed "at half past eight in
   the evening India was painted in full afternoon". So the day-side highlight
   and the bright limb arc were being drawn from one frame while the night was
   drawn from another: the bright limb was painted over the NIGHT limb, which
   is what reads as the lit face pointing the wrong way.

   sun.alt/sun.az are already passed in. Building the light from them puts every
   part of the globe in one frame by construction. The observer's own basis in
   screen space is E=(1,0,0), N=(0,cos k,-sin k), Z=(0,sin k,cos k) with
   k = 26deg - pitch, so a Sun at azimuth 90 and altitude 0 gives (1,0) — due
   east, screen right, the same as the terminator's own `ux=sin A`; and a Sun
   overhead gives (0,-1), pointing exactly at the observer's mark. */
function sunLight(sun,pitch,fallback){
  if(!sun||sun.alt==null||sun.az==null) return fallback;
  const k=(26-(pitch||0))*D2R, ca=Math.cos(sun.alt*D2R), sa=Math.sin(sun.alt*D2R);
  const rx=ca*Math.sin(sun.az*D2R);
  const ry=ca*Math.cos(sun.az*D2R)*Math.cos(k)+sa*Math.sin(k);
  const n=Math.hypot(rx,ry)||1;
  return {x:rx/n, y:-ry/n};
}
function drawEarth(c,cx,cy,R,light,spot,e,now,reduced,landA,spin,pitch,texA,sun,W,H){
  if(c.globalAlpha<=0.002) return;                             /* not yet visible: nothing to paint */
  light=sunLight(sun,pitch,light);
  const lat0=(spot?.lat||0)*D2R, lon0=((spot?.lon||0)+(spin||0))*D2R;
  const tilt=lat0-26*D2R+(pitch||0)*D2R;                       /* the observer sits a little above the disc centre */
  const proj=(la,lo)=>{ const f=la*D2R, l=lo*D2R-lon0;
    const X=Math.cos(f)*Math.sin(l), Y=Math.sin(f), Z=Math.cos(f)*Math.cos(l);
    const y2=Y*Math.cos(tilt)-Z*Math.sin(tilt), z2=Y*Math.sin(tilt)+Z*Math.cos(tilt);
    return {x:cx+X*R, y:cy-y2*R, z:z2, X, y2}; };
  const dpr=(typeof devicePixelRatio!=="undefined"?devicePixelRatio:1)||1;
  const tA=texA==null?1:texA;
  /* THE GLOBE ON THE GPU (globe.js): imagery on a lit sphere with its own atmosphere,
     terminator, city lights, cloud deck and ocean glint, rendered offscreen and set
     down here in one drawImage. It shares proj()'s camera exactly — same tilt, same
     facing longitude — so the observer's mark below still sits on the right city.
     texA is a uniform there: the photograph fades in over a plain lit ball, as it
     did here. Only the part of the globe on screen is rendered, so the near view
     costs a screen's worth of pixels, not a globe's. When WebGL or the imagery is
     unavailable the software sprite below carries on untouched. */
  const WW=W||2*cx, HH=H||2*cy;
  const glb=renderGlobe({R,dpr,win:{x0:-cx/R,y0:-cy/R,x1:(WW-cx)/R,y1:(HH-cy)/R},lat0:spot?.lat||0,lon0:spot?.lon||0,spin:spin||0,pitch:pitch||0,
    sun,light,texA:tA,cloudsA:tA,lightsA:tA,t:reduced?0:now});
  if(glb){
    const v=glb.view;
    c.drawImage(glb,0,0,v.pw,v.ph,cx+v.x0*R,cy+v.y0*R,(v.x1-v.x0)*R,(v.y1-v.y0)*R);
  } else drawEarthSprite(c,cx,cy,R,light,spot,proj,tilt,landA,spin,pitch,tA,sun,dpr);
  /* you: a small mark where this sky is being watched from */
  if(e>0.55&&spot){ const p=proj(spot.lat,spot.lon); if(p.z>0){
    const a=(e-0.55)/0.45; const pulse=reduced?0:0.5+0.5*Math.sin(now/600);
    c.strokeStyle=`rgba(255,244,214,${0.5*a})`; c.lineWidth=1.2; c.beginPath(); c.arc(p.x,p.y,4+pulse*3,0,7); c.stroke();
    c.fillStyle=`rgba(255,250,235,${a})`; c.beginPath(); c.arc(p.x,p.y,2.4,0,7); c.fill();
    /* the halo has to fade with the label, or the first moments of the fade-in
       are a black word on a lit continent */
    if(R>44) text(c,"You",p.x+9,p.y,`rgba(241,231,201,${(0.95*a).toFixed(3)})`,sysF(10,600),"left",
      `rgba(4,5,18,${(0.82*a).toFixed(3)})`);
  } }
}
/* the software globe: the fallback when WebGL or the imagery is not available.
   One Blue Marble JPEG projected onto the disc, dressed with 2D gradients. */
function drawEarthSprite(c,cx,cy,R,light,spot,proj,tilt,landA,spin,pitch,tA,sun,dpr){
  /* atmosphere: a cool rim outside the disc, brighter toward the light */
  const ar=c.createRadialGradient(cx,cy,R*0.98,cx,cy,R*1.18);
  ar.addColorStop(0,"rgba(120,178,255,.55)"); ar.addColorStop(0.45,"rgba(110,170,255,.18)"); ar.addColorStop(1,"rgba(100,160,255,0)");
  c.fillStyle=ar; c.beginPath(); c.arc(cx,cy,R*1.18,0,7); c.fill();
  /* the globe itself: photography where it has loaded, the drawn emblem until then */
  /* Under the surface of the photograph, a plain lit sphere. It carries the
     first stretch of the climb on its own: a 1024px Blue Marble magnified
     across a phone is a picture of its own pixels, and from a hundred metres
     up you would not be seeing continents anyway. The photograph fades in as
     the magnification becomes honest. */
  const gg=c.createRadialGradient(cx+light.x*R*0.35,cy+light.y*R*0.35,R*0.02,cx,cy,R);
  gg.addColorStop(0,"#3f7fae"); gg.addColorStop(0.5,"#28577f"); gg.addColorStop(1,"#12294a");
  c.fillStyle=gg; c.beginPath(); c.arc(cx,cy,R,0,7); c.fill();
  const sprite=tA>0.004?globeSprite(Math.min(1400,2*R*dpr),spot?.lat||0,(spot?.lon||0)+(spin||0),pitch||0):null;
  if(sprite){
    c.save(); c.beginPath(); c.arc(cx,cy,R,0,7); c.clip();
    const wasA=c.globalAlpha; c.globalAlpha=wasA*tA;
    c.drawImage(sprite,cx-R,cy-R,2*R,2*R);
    c.globalAlpha=wasA;
    c.restore();
  } else if(!EARTH_READY){
    /* nothing extra: the lit sphere above stands in until the texture loads */
  }
  c.save(); c.beginPath(); c.arc(cx,cy,R,0,7); c.clip();
  if(!sprite&&!EARTH_READY){
    c.globalAlpha*=landA;
    for(const [la,lo,rad] of LAND){ const p=proj(la,lo); if(p.z<=0.03) continue;
      const rr=rad*D2R*R*0.95; const ang=Math.atan2(p.y-cy,p.x-cx);
      const a=Math.abs(la);
      c.fillStyle=a>62?"rgba(214,222,226,.92)":a>40?"rgba(128,152,104,.95)":a>17&&a<34?"rgba(190,168,112,.95)":"rgba(104,146,92,.95)";
      c.beginPath(); c.ellipse(p.x,p.y,Math.max(1,rr*Math.max(0.12,p.z)),Math.max(1,rr),ang,0,7); c.fill(); }
    c.globalAlpha/=Math.max(0.001,landA);
  }
  /* the limb hazes over with air. Close in this is most of what you would
     actually see; far out it is a thin blue edge. */
  const hz=c.createRadialGradient(cx,cy,R*lerp(0.15,0.78,Math.min(1,tA)),cx,cy,R);
  hz.addColorStop(0,"rgba(126,172,224,0)");
  hz.addColorStop(1,`rgba(126,172,224,${(0.55-0.3*Math.min(1,tA)).toFixed(3)})`);
  c.fillStyle=hz; c.fillRect(cx-R,cy-R,2*R,2*R);
  /* a thin veil of cloud on the lit side */
  const cg=c.createRadialGradient(cx+light.x*R*0.5,cy+light.y*R*0.5,R*0.1,cx+light.x*R*0.2,cy+light.y*R*0.2,R*1.1);
  cg.addColorStop(0,"rgba(255,255,255,.22)"); cg.addColorStop(0.5,"rgba(255,255,255,.08)"); cg.addColorStop(1,"rgba(255,255,255,0)");
  c.fillStyle=cg; c.fillRect(cx-R,cy-R,2*R,2*R);
  /* NIGHT. This used to run across the light vector taken from the ring, with
     the sphere's centre as its anchor — and near the surface that centre is far
     off-screen, so at half past eight in the evening India was painted in full
     afternoon. The observer's own solar altitude and azimuth fix it: the
     terminator is the ring of points 90 degrees from the subsolar point, which
     from the observer lies -sunAlt away along the Sun's azimuth. Exact under
     the observer, and it degrades gently toward the limb. */
  if(sun&&sun.alt!=null&&sun.az!=null&&spot){
    const o=proj(spot.lat,spot.lon);
    const A=sun.az*D2R;
    let ux=Math.sin(A), uy=-Math.cos(A)*Math.cos(tilt);
    const ul=Math.hypot(ux,uy)||1; ux/=ul; uy/=ul;
    const off=R*Math.sin(clamp(-sun.alt,-89,89)*D2R);
    const tx=o.x+ux*off, ty=o.y+uy*off, w=Math.max(6,R*0.16);
    const tg=c.createLinearGradient(tx-ux*w,ty-uy*w,tx+ux*w,ty+uy*w);
    tg.addColorStop(0,"rgba(2,4,16,.90)"); tg.addColorStop(0.5,"rgba(2,4,16,.5)"); tg.addColorStop(1,"rgba(2,4,16,0)");
    c.fillStyle=tg; c.fillRect(cx-R,cy-R,2*R,2*R);
  } else {
    const tg=c.createLinearGradient(cx+light.x*R,cy+light.y*R,cx-light.x*R,cy-light.y*R);
    tg.addColorStop(0,"rgba(2,4,16,0)"); tg.addColorStop(0.40,"rgba(2,4,16,0)"); tg.addColorStop(0.58,"rgba(2,4,16,.62)"); tg.addColorStop(1,"rgba(2,4,16,.90)");
    c.fillStyle=tg; c.fillRect(cx-R,cy-R,2*R,2*R);
  }
  /* limb darkening + a bright edge on the day side */
  const lg=c.createRadialGradient(cx,cy,R*0.72,cx,cy,R);
  lg.addColorStop(0,"rgba(0,0,0,0)"); lg.addColorStop(1,"rgba(0,4,20,.45)");
  c.fillStyle=lg; c.fillRect(cx-R,cy-R,2*R,2*R);
  c.restore();
  const la=Math.atan2(light.y,light.x);
  c.strokeStyle="rgba(190,225,255,.55)"; c.lineWidth=Math.max(1,R*0.012);
  c.beginPath(); c.arc(cx,cy,R-c.lineWidth/2,la-1.55,la+1.55); c.stroke();
}

/* ---- the scene ------------------------------------------------------ */
export function drawOrrery(c,W,H,k,env){
  const e=smooth(k); if(k<=0.002) return;
  earthTexture();
  /* PACING (5 Sep). Sangram: "when you zoom out of the Earth, it directly
     starts showing the Earth." It did: space reached full opacity a fifth of
     the way through the pinch and the globe had already shrunk a third of the
     way, so the first moment of pulling back was also the moment the sky
     disappeared. The four curves below now describe an ascent — ground, then
     altitude, then orbit — and each one starts only once the previous has
     given the eye something to hold. */
  const cover=smooth(clamp((k-0.30)/0.36,0,1));            /* space arrives after you leave the ground */
  /* the ground itself is opaque almost at once: at k=0 this disc's upper edge
     sits exactly where the flat horizon does, so the handover is a flat ground
     BECOMING a curved one rather than a globe fading in over the sky */
  const earthA=smooth(clamp((k-0.26)/0.16,0,1));      /* after twelve more degrees of plain sky */
  const sc=smooth(clamp((k-0.50)/0.50,0,1));               /* ring + bodies, once there is sky to hang them in */
  const texA=smooth(clamp((k-0.36)/0.26,0,1));             /* photography, once the magnification is sane */
  const landA=smooth(clamp((k-0.60)/0.30,0,1));            /* continents only once it is a globe */
  const {grahas,layers,target,names,reduced,now}=env;
  const spin=env.spin||0, pitch=env.pitch||0;   /* dragged yaw and elevation */
  /* THE EARTH TURNS, THE RING DOES NOT (Sangram, 7 Sep: "I only see the lit and shadowed part
     of the Earth moving without the Earth or Sun or other planets moving"). The camera is fixed
     in space: the globe rotates by the sidereal angle since the pull-out began (env.sidereal),
     the zodiac ring keeps the orientation it had at that moment (its zero, env.ascAnchor, is the
     longitude that was rising then, placed at the observer's east), and the planets walk the
     ring at their own pace — the Moon visibly, the rest slowly. A drag turns the camera, so
     the globe and the ring turn together. */
  const sid=env.sidereal||0;
  const lat0=env.spot?.lat||0;
  /* the ring lies in the equatorial plane and is seen with the globe's own tilt: from a little
     above the observer's latitude, plus a climb as the pull-out completes, never flatter than
     18° so the names stay readable — the same tilt is handed to the globe below */
  const tiltEff=clamp(lat0-26+34+pitch,28,80), pitchEff=tiltEff-(lat0-26);
  const st=Math.sin(tiltEff*D2R), ct=Math.cos(tiltEff*D2R);
  const S=clamp(Math.min(W,H)/390,0.9,1.5);                /* phone → tablet scale */
  const sunG=grahas.find(g=>g.g==="Sun"), moonG=grahas.find(g=>g.g==="Moon");
  const ascL=env.asc!=null?env.asc:risingLongitude(env.ecl);
  const asc=(ascL!=null?ascL:(sunG?sunG.L+90:0))-spin;

  /* geometry: the globe shrinks from underfoot to the centre; the ring
     opens from edge-on around you to the tilted zodiac */
  /* Distance is a real dimension, not two states. The globe shrinks along an eased curve so
     the middle of the pinch is a usable low orbit — a whole Earth you can turn — rather than
     a giant arc on its way to a small disc. The ring rides the same curve so the two never
     cut through each other. */
  const R1=Math.min(W,H)*0.175, cy1=H*0.47, BIG=Math.max(W,H)*1.15;
  /* the globe leaves slowly and then quickly: near the surface a small change
     in altitude barely changes what you see, which is what standing feels like */
  const eR=Math.pow(e,1.5);
  /* the disc begins ON the sky's own horizon circle (env.horizon, from the stereographic
     camera) so a flat-looking ground becomes a curved one without a seam; without one it
     begins where the old flat horizon sat */
  const h0=env.horizon||null;
  const R0=h0?h0.R:BIG, top0=h0?h0.cy-h0.R:H*0.66, cx0=h0?h0.cx:W/2;
  const RE=lerp(R0,R1,eR);
  const topY=lerp(top0,cy1-R1,eR);
  const ecx=lerp(cx0,W/2,eR), ecy=topY+RE;
  const L0=env.ascAnchor!=null?env.ascAnchor:(ascL!=null?ascL:(sunG?sunG.L+90:0));   /* the ring's zero: rising at the pull-out, at the east */
  const geo={cx:W/2, cy:lerp(H*0.64,cy1,eR), R:lerp(Math.max(W,H)*1.6,Math.min(W,H)*0.43,eR),   /* 0.47 ran under the seeker column */
    sy:lerp(0.05,st,e), ct, L0, asc};
  const geoM={...geo,R:geo.R*0.60};
  /* THE RING'S ZERO. This carried a half turn, which put the ascendant at the
     observer's WEST while the globe puts his east at screen right — so the
     zodiac ran backwards against the Earth underneath it. Sangram's screenshot,
     4:09 PM IST in Pune: the Sun sits at azimuth 264.7deg, due WEST, and the
     globe is correctly lit from screen left; the ring drew its Sun marker at
     the upper RIGHT. Measured across 584 samples through 2026 the disagreement
     was a median 155.6deg with the half turn and 24.4deg without it — the
     residual being the ring's fixed ellipse standing in for a real ecliptic,
     which is diagram slop rather than a sign error. */
  /* a ring point: l is the angle around the Earth's axis from the front (screen right = east,
     the way the globe is drawn); the ring's zero sits at the east, a drag turns the camera.
     Depth d > 0 is the far side, behind the globe. */
  const ang=(L,g=geo)=>(90+(L-g.L0)-spin)*D2R;
  const at=(L,r,g=geo)=>{ const l=ang(L,g); return {x:g.cx+r*Math.sin(l), y:g.cy+r*g.sy*Math.cos(l), d:-Math.cos(l)*g.ct, th:l}; };
  const pt=(L,g=geo)=>at(L,g.R,g);
  const ringPath=(r,g=geo)=>{ c.beginPath(); for(let L=0;L<=360;L+=4){ const p=at(L,r,g); L?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y); } c.closePath(); };
  const band=clamp(geo.R*0.16,14,48);

  c.save();
  c.globalAlpha=cover;
  /* space */
  const bg=c.createRadialGradient(W/2,H*0.45,0,W/2,H*0.45,Math.max(W,H)*0.9);
  /* near-black with a breath of indigo at the centre — the Earth reads against
     it (Sangram's Apple Maps reference, 5 Sep); a lit blue globe on a blue
     ground was the complaint */
  bg.addColorStop(0,"#070a1d"); bg.addColorStop(0.55,"#03051a"); bg.addColorStop(1,"#010208");
  c.fillStyle=bg; c.fillRect(0,0,W,H);
  for(const s of starField(W,H)){ c.fillStyle=`rgba(226,232,255,${s.a})`; c.beginPath(); c.arc(s.x,s.y,s.r,0,7); c.fill(); }
  c.globalAlpha=sc;

  /* light: from the Earth toward the Sun on the ring */
  const sp=sunG?pt(sunG.L):{x:ecx+1,y:ecy-1};
  let lx=sp.x-ecx, ly=sp.y-ecy; const ll=Math.hypot(lx,ly)||1; lx/=ll; ly/=ll;
  const light={x:lx,y:ly};

  /* the ring, drawn twice: the far half behind the Earth, the near half in front */
  const ringSamples=[]; for(let L=0;L<360;L+=5){ const p=pt(L); ringSamples.push({L,x:p.x,y:p.y}); }
  const focusSign=target?.t==="graha"?sgOf(grahas.find(x=>x.g===target.g)?.L??0):target?.t==="rashi"?target.i:null;
  const sector=(i,inner,outer)=>{ c.beginPath();
    for(let j=0;j<=6;j++){ const p=at(i*30+j*5,outer); c.lineTo(p.x,p.y); }
    for(let j=6;j>=0;j--){ const p=at(i*30+j*5,inner); c.lineTo(p.x,p.y); }
    c.closePath(); };
  const drawRing=far=>{
    c.save(); c.beginPath(); c.rect(0,far?-10:geo.cy,W+20,far?geo.cy+10:H-geo.cy+10); c.clip();
    if(layers.rashis!==false){
      for(let i=0;i<12;i++){ sector(i,geo.R-band/2,geo.R+band/2);
        c.fillStyle=focusSign===i?"rgba(232,204,146,.30)":(i%2?"rgba(122,134,196,.17)":"rgba(122,134,196,.11)"); c.fill();
        c.strokeStyle="rgba(200,210,244,.28)"; c.lineWidth=0.8; c.stroke(); }
      ringPath(geo.R+band/2); c.strokeStyle="rgba(230,236,255,.42)"; c.lineWidth=1; c.stroke();
      ringPath(geo.R-band/2); c.strokeStyle="rgba(0,2,12,.45)"; c.lineWidth=1; c.stroke();
      /* nakshatra ticks on the inner edge */
      if(layers.naks!==false&&e>0.5){ c.strokeStyle="rgba(200,210,244,.5)"; c.lineWidth=0.8;
        for(let n=0;n<27;n++){ const L=n*NSPAN, r0=geo.R-band/2, r1=r0+band*0.22; const a=at(L,r0), b=at(L,r1);
          c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); } }
      /* engraved names along the band */
      if(band>=18) for(let i=0;i<12;i++){ const m=pt(i*30+15); if(far?m.d<=0:m.d>0) continue;
        const a=pt(i*30+11), b=pt(i*30+19); let ang=Math.atan2(b.y-a.y,b.x-a.x); if(ang>Math.PI/2) ang-=Math.PI; else if(ang<-Math.PI/2) ang+=Math.PI;
        const depth=lerp(0.72,1.1,(1-m.d)/2)*(focusSign===i?1.08:1);
        const two=band>=26;
        c.save(); c.translate(m.x,m.y); c.rotate(ang); c.textAlign="center"; c.textBaseline="middle";
        const dev=names.SIGNS_DEV[i], lat=(layers.sanskrit?names.SIGNS_SK:names.SIGNS_EN)[i];
        const fz=clamp(band*0.40,9,14)*depth;
        c.font=devF(fz); c.fillStyle="rgba(18,14,8,.6)"; c.fillText(dev,0.7,(two?-band*0.20:0)+0.9);
        c.fillStyle=focusSign===i?"rgba(255,246,222,.98)":"rgba(236,238,250,.88)"; c.fillText(dev,0,two?-band*0.20:0);
        if(two){ c.font=sysF(clamp(band*0.29,8,11)*depth,600); c.fillStyle="rgba(18,14,8,.5)"; c.fillText(lat,0.6,band*0.22+0.8);
          c.fillStyle=focusSign===i?"rgba(255,246,222,.9)":"rgba(210,216,240,.8)"; c.fillText(lat,0,band*0.22); }
        c.restore(); }
    }
    /* the Moon's ring */
    c.setLineDash([3,5]); c.strokeStyle="rgba(214,226,255,.32)"; c.lineWidth=1;
    ringPath(geoM.R,geoM); c.stroke(); c.setLineDash([]);
    c.restore();
  };
  drawRing(true);

  /* the bodies, sorted back to front */
  const bodies=[];
  const elong=sunG&&moonG?norm(moonG.L-sunG.L):0;
  const phase={illum:(1-Math.cos(elong*D2R))/2,waxing:elong<180};
  for(const g of grahas){
    if(layers.planets===false) continue;
    const onMoonRing=g.g==="Moon"||g.g==="Rahu"||g.g==="Ketu";
    const p=pt(g.L,onMoonRing?geoM:geo);
    const r=(RING_R[g.g]||9)*S*lerp(0.55,1,e);
    const hidden=p.d>0&&Math.hypot(p.x-ecx,p.y-ecy)<RE*(onMoonRing?0.98:1);
    bodies.push({g:g.g,L:g.L,retro:g.retro,x:p.x,y:p.y,d:p.d,r,hidden,onMoonRing});
  }
  bodies.sort((a,b)=>b.d-a.d);
  const drawBody=b=>{
    if(b.hidden) return;
    const isT=target?.t==="graha"&&target.g===b.g;
    let vx=sp.x-b.x, vy=sp.y-b.y; const vl=Math.hypot(vx,vy)||1;
    const lightB=b.g==="Sun"?{x:-0.55,y:-0.6}:{x:vx/vl,y:vy/vl};
    if(b.g==="Sun"){ const sg=c.createRadialGradient(b.x,b.y,b.r*0.8,b.x,b.y,b.r*4.2);
      sg.addColorStop(0,"rgba(255,222,160,.34)"); sg.addColorStop(0.4,"rgba(255,210,140,.10)"); sg.addColorStop(1,"rgba(255,200,130,0)");
      c.fillStyle=sg; c.beginPath(); c.arc(b.x,b.y,b.r*4.2,0,7); c.fill(); }
    if(isT){ const tone=GRAHA_BASE[b.g]?.token||"241,231,201";
      const hg=c.createRadialGradient(b.x,b.y,b.r*0.9,b.x,b.y,b.r*2.8);
      hg.addColorStop(0,`rgba(${tone},.22)`); hg.addColorStop(1,`rgba(${tone},0)`);
      c.fillStyle=hg; c.beginPath(); c.arc(b.x,b.y,b.r*2.8,0,7); c.fill();
      c.strokeStyle="rgba(241,231,201,.65)"; c.lineWidth=1.2; c.beginPath(); c.arc(b.x,b.y,b.r+6,0,7); c.stroke(); }
    drawGraha(c,b.g,b.x,b.y,b.r,{light:lightB,phase:b.g==="Moon"?phase:undefined,quality:b.r>=13?"high":"low",focus:isT});
  };
  for(const b of bodies) if(b.d>0) drawBody(b);

  /* the rising sign: a line from the Earth's edge to the ring */
  if(ascL!=null&&e>0.3){ const a=pt(ascL); const dx=a.x-ecx, dy=a.y-ecy, dl=Math.hypot(dx,dy)||1;
    const sx=ecx+dx/dl*RE*1.02, sy2=ecy+dy/dl*RE*1.02;
    if(dl>RE*1.1){ c.save(); c.strokeStyle="rgba(226,190,100,.55)"; c.lineWidth=1; c.setLineDash([2,4]);
      c.beginPath(); c.moveTo(sx,sy2); c.lineTo(a.x-dx/dl*band*0.55,a.y-dy/dl*band*0.55); c.stroke(); c.setLineDash([]); c.restore(); }
  }

  c.globalAlpha=earthA; drawEarth(c,ecx,ecy,RE,light,env.spot,e,now,reduced,landA,spin-sid,pitchEff,texA,{alt:env.sunAlt,az:env.sunAz},W,H); c.globalAlpha=sc;
  drawRing(false);
  for(const b of bodies) if(b.d<=0) drawBody(b);

  /* the rising-sign marker sits on the ring, over everything */
  if(ascL!=null&&e>0.3){ const a=pt(ascL); const isT=target?.t==="asc";
    c.save(); c.translate(a.x,a.y); c.rotate(Math.PI/4); c.fillStyle=`rgba(226,190,100,${isT?1:.92})`; c.strokeStyle="rgba(255,240,200,.9)"; c.lineWidth=1.1;
    c.beginPath(); c.rect(-5,-5,10,10); c.fill(); c.stroke(); c.restore(); }

  /* labels */
  const LABELS=[];
  if(k>0.6){
    const la=smooth((k-0.6)/0.4);
    const Ld=ledger(W,H,96,env.padBottom||150);
    for(const b of bodies) if(!b.hidden) Ld.claim(b.x,b.y,2*b.r+8,2*b.r+8);
    Ld.claim(ecx,ecy,1.3*RE,1.3*RE);
    const ordered=[...bodies].filter(b=>!b.hidden).sort((a,b)=>((target?.t==="graha"&&target.g===b.g)?1:0)-((target?.t==="graha"&&target.g===a.g)?1:0));
    for(const b of ordered){
      const isT=target?.t==="graha"&&target.g===b.g;
      const txt=b.g+(b.retro&&b.g!=="Rahu"&&b.g!=="Ketu"?" ℞":"");
      const font=sysF(isT?13.5:11.5,isT?700:600); c.font=font; const w=c.measureText(txt).width+4;
      const pos=Ld.place(b.x,b.y,w,14,[[0,b.r+14],[0,-b.r-13],[b.r+w/2+9,0],[-b.r-w/2-9,0]]);
      if(!pos) continue;
      LABELS.push(txt);
      const dimA=target&&!isT?0.6:1;
      text(c,txt,pos[0],pos[1],`rgba(245,246,252,${la*dimA})`,font);
      if(isT){ const s=sgOf(b.L), n=nkOf(b.L); const sub=`${names.SIGNS_DEV[s]} ${layers.sanskrit?names.SIGNS_SK[s]:names.SIGNS_EN[s]} · ${names.NAKS[n]}`;
        c.font=devF(10.5); const w2=c.measureText(sub).width+4; const below=pos[1]>b.y;
        const p2=Ld.place(pos[0],pos[1],w2,13,[[0,below?14:-14]]);
        if(p2) text(c,sub,p2[0],p2[1],`rgba(224,206,160,${la})`,devF(10.5)); }
    }
    if(ascL!=null){ const a=pt(ascL); const s=sgOf(ascL);
      const t=env.mode==="birth"?`${names.SIGNS_EN[s]} Lagna`:`${names.SIGNS_EN[s]} rising`;
      c.font=sysF(11,700); const w=c.measureText(t).width+4;
      const pos=Ld.place(a.x,a.y,w,14,[[0,-band*0.5-12],[0,band*0.5+12],[w/2+12,0],[-w/2-12,0]]);
      if(pos) text(c,t,pos[0],pos[1],`rgba(241,231,201,${la})`,sysF(11,700)); }
    /* caption: what this is, and how to leave */
    const capY=Math.min(H-(env.padBottom||150)+14, geo.cy+geo.R*geo.sy+band+34);
    text(c,"The zodiac from above the Earth · not to scale",W/2,capY,`rgba(200,206,236,${0.85*la})`,sysF(11,500));
    if(!target) text(c,"Spread two fingers to return to the sky",W/2,capY+16,`rgba(160,168,208,${0.8*la})`,sysF(10.5,500));
  }
  c.restore();
  LAST={planets:bodies.filter(b=>!b.hidden),ring:ringSamples,band,names,e,labels:LABELS};
}

/* the object under a tap: a graha first, then the ring's rashi */
export function orreryHit(x,y){
  let best=null,bd=26;
  for(const b of LAST.planets){ const d=Math.hypot(b.x-x,b.y-y)-b.r*0.4; if(d<bd){ bd=d; best={t:"graha",g:b.g,label:b.g,kind:"graha"}; } }
  if(best) return best;
  let bi=-1,bdd=1e9;
  for(const s of LAST.ring){ const d=Math.hypot(s.x-x,s.y-y); if(d<bdd){ bdd=d; bi=s.L; } }
  if(bi>=0&&bdd<LAST.band/2+14&&LAST.names){ const i=sgOf(bi); return {t:"rashi",i,label:`${LAST.names.SIGNS_EN[i]} · ${LAST.names.SIGNS_SK[i]}`,kind:"rashi"}; }
  return null;
}

/* for the phase gates: what the last frame laid out */
export function orreryDebug(){ return {labels:LAST.labels||[],planets:(LAST.planets||[]).map(b=>b.g),at:(LAST.planets||[]).map(b=>({g:b.g,x:Math.round(b.x),y:Math.round(b.y)})),band:LAST.band,e:LAST.e}; }
