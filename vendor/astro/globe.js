/* ====================================================================
   GLOBE — the Earth as a lit sphere, drawn on the GPU
   --------------------------------------------------------------------
   The orrery's Earth used to be one Blue Marble JPEG projected in
   software onto a disc and dressed with 2D gradients: a flat ball. This
   is the same globe on WebGL — real imagery on a lit sphere, a wrapped
   terminator, city lights where it is night, a slowly drifting cloud
   deck that shades the ground under it, the Sun's glint on the oceans,
   and an atmosphere held to the limb: a thin band of blue air, a narrow
   bright rim on it, and a short soft glow outside the silhouette. The day
   side is the photograph's own colours, its sea lifted from Blue Marble's
   near-black navy to the cobalt a camera in orbit sees through the air.

   It renders to its own transparent canvas and hands that back; the
   orrery composites it into its 2D frame with one drawImage, so the
   2D frame stays cheap. Nothing here is required: if WebGL is missing,
   a shader fails or the imagery never arrives, renderGlobe returns
   null and the orrery keeps its software sprite.

   THE CAMERA IS THE SPRITE'S CAMERA. drawEarth's proj() puts the
   observer's mark on the disc with tilt = lat0 - 26deg + pitch and the
   facing longitude lon0 = spot.lon + spin; the rotation below is that
   same matrix, so the mark lands on the city it should.

   renderGlobe({R, dpr, win, lat0, lon0, spin, pitch, sun|light,
                texA, cloudsA, lightsA, t})  -> canvas (with .view) or null
   globeReady()                              -> imagery on the GPU?
   globeStats()  /  window.__globeStats()    -> {size, msLast, renders, ...}

   Imagery (assets/earth/, loaded on first use, each layer optional):
     day     day_2048.jpg      preferred; bluemarble_1024.jpg stands in
     night   night_2048.jpg    absent -> no city lights
     clouds  clouds_1024.png   absent -> no cloud deck, no cloud shadow
     spec    specular_1024.jpg absent -> ocean mask derived from the day
                                          texture's blue dominance
   ==================================================================== */
const D2R=Math.PI/180;
const MARGIN=1.10;              /* the outer glow reaches this far, in Earth radii (6 Sep:
                                   1.22 — it read as a grey fog; the reference globes are
                                   gone into black by ~1.06) */
const CAP=1024;                 /* longest side of a render, device pixels */
const SEG_LON=64, SEG_LAT=48;   /* the polygon edge sits 0.1% inside a true circle; the
                                   silhouette itself is cut analytically per pixel */
const CLOUD_DEG_PER_MIN=0.4;    /* the deck drifts this much per minute of real time */
/* the files actually present in assets/earth — absent optional layers are
   skipped instead of probed, so the console stays clean. 6 Sep: the NASA day,
   night, cloud and water layers landed (SOURCE.txt); the 1024 Blue Marble
   stays as the quick first paint and the software fallback's map */
const EARTH_SHIPPED=new Set(["day_2048.jpg","bluemarble_1024.jpg","night_2048.jpg","clouds_1024.png","specular_1024.jpg"]);
const FILES={
  day:["day_2048.jpg","bluemarble_1024.jpg"],   /* both load; the better one wins when it lands */
  night:["night_2048.jpg"],
  clouds:["clouds_1024.png"],
  spec:["specular_1024.jpg"],
};

/* ---- imagery ------------------------------------------------------- */
const TEX={day:null,night:null,clouds:null,spec:null};   /* {img,rank,name,w,h,dirty} */
let loading=false, TEX_DIRTY=false;
function loadTextures(){
  if(loading) return; loading=true;
  const base=new URL("../../assets/earth/",import.meta.url).href;
  for(const key of Object.keys(FILES)){
    FILES[key].filter(f=>EARTH_SHIPPED.has(f)).forEach((name,rank)=>{
      const img=new Image(); img.decoding="async";
      const land=()=>{ const cur=TEX[key]; if(cur&&cur.rank<rank) return;   /* a better one already landed */
        TEX[key]={img,rank,name,w:img.naturalWidth,h:img.naturalHeight,dirty:true}; TEX_DIRTY=true; };
      img.onload=()=>{ if(img.decode) img.decode().then(land,land); else land(); };
      img.onerror=()=>{};   /* an optional layer that is not there: the shader takes the fallback */
      img.src=base+name;
    });
  }
}

/* ---- the GL side --------------------------------------------------- */
let CV=null, gl=null, isGL2=false, FAILED=false, lost=false, ANISO=null, MAXANISO=1;
let P_SURF=null, P_CLOUD=null, P_GLOW=null, GEO=null, QUAD=null, BLANK=null;
const GLTEX={};
const STATS={size:[0,0],msLast:0,msAvg:0,renders:0,skipped:0,gl:null,tex:{}};

const VS_SPHERE=`
attribute vec3 a_pos; attribute vec2 a_uv;
uniform mat3 u_rot; uniform vec4 u_win; uniform float u_radius;
varying highp vec2 v_uv; varying vec2 v_p;
void main(){
  vec3 n=u_rot*a_pos; v_uv=a_uv;
  vec2 p=n.xy*u_radius; v_p=p;
  gl_Position=vec4((p-u_win.xy)/u_win.zw,0.0,1.0);
}`;
const PREC=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif`;
/* the ground: day imagery under a wrapped Lambert terminator, city lights where it
   is night, the cloud deck's shadow, the Sun's glint on water, and a Fresnel rim.
   Coverage at the silhouette is analytic (1 - smoothstep over one pixel of r), so
   the edge is smooth whatever the polygon count. u_texA mixes the photograph in
   over a plain blue-grey ball: close to the ground a magnified JPEG is a picture
   of its own pixels, so the climb starts on the plain sphere. */
const FS_SURF=PREC+`
varying highp vec2 v_uv; varying vec2 v_p;
uniform sampler2D u_day, u_night, u_clouds, u_spec;
uniform vec3 u_light;
uniform float u_texA, u_lightsA, u_cloudsA, u_cloudOff, u_px, u_haze, u_hasNight, u_hasClouds, u_hasSpec;
const vec3 FLAT=vec3(0.24,0.47,0.66);
void main(){
  float r=length(v_p);
  float cov=1.0-smoothstep(1.0-1.5*u_px,1.0,r);
  if(cov<=0.0) discard;
  /* the normal from the pixel's own place on the disc, not interpolated across a
     triangle: under orthographic projection it is exact, so the rim and the
     terminator carry no trace of the polygon (64 facets showed as notches in
     the limb light at the near view) */
  vec3 n=vec3(v_p,sqrt(max(0.0,1.0-r*r)));
  vec3 L=u_light;
  float ndl=dot(n,L);
  float lit=smoothstep(-0.10,0.12,ndl);                 /* the terminator, ~12 degrees wide */
  vec3 day=texture2D(u_day,v_uv).rgb;
  /* water: a specular map when one ships, else where blue outweighs red and green
     in the day imagery (open sea ~0.9, shallows less, land and ice 0) */
  float water=mix(clamp((day.b-max(day.r,day.g))*6.0,0.0,1.0),texture2D(u_spec,v_uv).r,u_hasSpec);
  /* THE SEA (6 Sep). The day imagery paints the ocean a flat dark navy — (24,36,60)
     in the 2048 map, (11,10,50) in the 1024 Blue Marble — the water's own colour
     with no air over it. The globes this one is judged against show it as
     cobalt: the same sea under a column of blue sky. Lift water toward that
     (tuned to the 2048 map, whose sea already carries a little green — the old
     1.5x green lift turned it teal) and leave the land its own colours; then a
     little more colour everywhere and, on land only, a little more contrast. */
  day=mix(day,day*vec3(1.0,1.25,1.40)+vec3(0.01,0.04,0.10),water);
  float y=dot(day,vec3(0.2126,0.7152,0.0722));
  day=clamp(mix(vec3(y),day,mix(1.1,1.2,water)),0.0,1.0);
  day=mix(day,day*day*(3.0-2.0*day),0.22*(1.0-water));
  vec3 alb=mix(FLAT,day,u_texA);
  /* dusk warms the ground a little, either side of the line */
  float twi=lit*(1.0-lit)*4.0;
  alb=mix(alb,alb*vec3(1.08,0.92,0.78),0.35*twi);
  /* the cloud deck's shadow: the same texture, nudged a few texels */
  vec2 cuv=vec2(v_uv.x+u_cloudOff,v_uv.y);
  vec4 cs=texture2D(u_clouds,cuv+vec2(0.0035,-0.0025));
  float shadow=cs.r*cs.a*u_cloudsA*u_hasClouds;
  vec3 col=alb*(0.03+0.97*lit)*(1.0-0.45*shadow);
  /* the night side: a faint blue, the sky's own light on the ground — never black,
     never grey */
  col+=(alb*vec3(0.045,0.07,0.12)+vec3(0.016,0.024,0.062))*(1.0-lit);
  /* city lights, fading out across the terminator */
  vec3 nl=texture2D(u_night,v_uv).rgb;
  float night=1.0-smoothstep(-0.16,0.06,ndl);
  col+=nl*night*u_lightsA*u_hasNight*0.95;
  /* the Sun on water: one soft glint, no sheen (the broad pow-18 term laid a
     grey wash across half the ocean) */
  vec3 H=normalize(L+vec3(0.0,0.0,1.0));
  float ndh=max(dot(n,H),0.0);
  float glint=pow(ndh,320.0)*0.22;
  col+=vec3(1.0,0.95,0.85)*glint*water*u_texA*lit;
  /* the air: a thin band of blue at the limb, not a wash over the disc (the
     pow-1.5 term that was here greyed the whole lit side), and on it the rim
     itself — a narrow bright edge, warm-white where the Sun strikes the limb,
     cooler elsewhere. Close to the ground (u_haze) the band thickens: from
     there, most of what you see is air. */
  float nz=max(n.z,0.0);
  float limbLit=smoothstep(-0.35,0.35,ndl);
  float band=pow(1.0-nz,mix(4.0,1.8,u_haze));
  col+=vec3(0.30,0.52,0.90)*band*mix(0.30,0.55,u_haze)*mix(0.10,1.0,limbLit);
  float rim=pow(1.0-nz,9.0);
  vec3 rimC=mix(vec3(0.50,0.74,1.0),vec3(1.0,0.96,0.88),0.6*smoothstep(0.2,0.9,ndl));
  col+=rimC*rim*0.65*(0.28+0.72*limbLit);
  /* premultiplied, and never brighter than its alpha: a colour above alpha is not a
     valid premultiplied pixel, and the 2D canvas's resampling of one showed as dark
     bars along the anti-aliased limb */
  gl_FragColor=vec4(min(col,vec3(1.0))*cov,cov);
}`;
/* the cloud deck: a second, slightly larger sphere, lit by the same Sun; nearly
   invisible at night, where it only dims the lights beneath it */
const FS_CLOUD=PREC+`
varying highp vec2 v_uv; varying vec2 v_p;
uniform sampler2D u_clouds;
uniform vec3 u_light;
uniform float u_cloudsA, u_cloudOff, u_px;
void main(){
  float r=length(v_p);
  float cov=1.0-smoothstep(1.0-1.5*u_px,1.0,r);
  if(cov<=0.0) discard;
  vec2 q=v_p/1.008;
  vec3 n=vec3(q,sqrt(max(0.0,1.0-dot(q,q))));
  float ndl=dot(n,u_light);
  float lit=smoothstep(-0.12,0.14,ndl);
  vec4 c=texture2D(u_clouds,vec2(v_uv.x+u_cloudOff,v_uv.y));
  float a=c.r*c.a*u_cloudsA*cov;
  a*=mix(0.12,1.0,lit);
  a*=1.0-0.5*pow(1.0-max(n.z,0.0),3.0);                 /* thinner at the limb, where the texture stretches */
  float twi=lit*(1.0-lit)*4.0;
  vec3 col=mix(vec3(0.02,0.03,0.07),vec3(1.0,0.99,0.97),lit);
  col=mix(col,col*vec3(1.0,0.86,0.72),0.5*twi);
  gl_FragColor=vec4(col*a,a);
}`;
/* the atmosphere outside the silhouette: a short soft glow, most of it gone within
   ~6% of the radius, cyan-blue where the limb is lit and dim where it is turning to
   night. It starts a little inside the disc so rim and glow meet without a hairline. */
const VS_QUAD=`
attribute vec2 a_q; uniform vec4 u_win; varying vec2 v_p;
void main(){ v_p=u_win.xy+a_q*u_win.zw; gl_Position=vec4(a_q,0.0,1.0); }`;
const FS_GLOW=PREC+`
varying vec2 v_p;
uniform vec3 u_light; uniform float u_haze;
const float M=${MARGIN.toFixed(3)};
void main(){
  float r=length(v_p);
  if(r<0.97||r>M) discard;
  vec2 d=v_p/max(r,1e-4);
  float ndl=dot(vec3(d,0.0),u_light);
  float t=clamp((r-1.0)/(M-1.0),0.0,1.0);
  /* full strength at the silhouette and inside it: this pass is drawn UNDER the
     ground, so inside the disc it only shows through the anti-aliased edge pixels —
     which is what makes that edge a clean mix of ground and air. (A weaker inner
     band left those pixels thinner than the glow beside them: a dark hairline.) */
  float g=mix(1.0,pow(1.0-t,mix(3.4,2.2,u_haze)),step(1.0,r));
  float litK=smoothstep(-0.45,0.4,ndl);
  /* cyan-white where the limb is lit, a dim cool blue where it is not: the warm
     grey that was here read as fog against the near-black sky */
  vec3 col=mix(vec3(0.30,0.40,0.62),vec3(0.55,0.78,1.0),smoothstep(-0.2,0.35,ndl));
  float a=min(1.0,g*mix(0.07,0.48,litK)*mix(1.0,1.5,u_haze));
  gl_FragColor=vec4(col*a,a);
}`;

function compile(vs,fs){
  const mk=(type,src)=>{ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error("globe shader: "+gl.getShaderInfoLog(s)); return s; };
  const p=gl.createProgram(); gl.attachShader(p,mk(gl.VERTEX_SHADER,vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error("globe program: "+gl.getProgramInfoLog(p));
  const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){ const info=gl.getActiveUniform(p,i); u[info.name]=gl.getUniformLocation(p,info.name); }
  const a={}; const m=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);
  for(let i=0;i<m;i++){ const info=gl.getActiveAttrib(p,i); a[info.name]=gl.getAttribLocation(p,info.name); }
  return {p,u,a};
}
/* a UV sphere with the seam column duplicated, so u runs 0..1 with no wrap inside a
   triangle: no seam at the antimeridian. u = lon/360 + 0.5, v = 0.5 - lat/180 — the
   same equirectangular mapping the software sprite samples. */
function sphere(){
  const pos=[], uv=[], idx=[];
  for(let i=0;i<=SEG_LAT;i++){ const lat=-Math.PI/2+Math.PI*i/SEG_LAT, cf=Math.cos(lat), sf=Math.sin(lat);
    for(let j=0;j<=SEG_LON;j++){ const lon=-Math.PI+2*Math.PI*j/SEG_LON;
      pos.push(cf*Math.sin(lon),sf,cf*Math.cos(lon)); uv.push(j/SEG_LON,1-i/SEG_LAT); } }
  const W=SEG_LON+1;
  for(let i=0;i<SEG_LAT;i++) for(let j=0;j<SEG_LON;j++){ const a=i*W+j, b=a+1, c=a+W, d=c+1;
    idx.push(a,b,c, b,d,c); }   /* counter-clockwise seen from outside */
  const buf=(target,data)=>{ const b=gl.createBuffer(); gl.bindBuffer(target,b); gl.bufferData(target,data,gl.STATIC_DRAW); return b; };
  return {pos:buf(gl.ARRAY_BUFFER,new Float32Array(pos)), uv:buf(gl.ARRAY_BUFFER,new Float32Array(uv)),
    idx:buf(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx)), n:idx.length};
}
function build(){
  P_SURF=compile(VS_SPHERE,FS_SURF); P_CLOUD=compile(VS_SPHERE,FS_CLOUD); P_GLOW=compile(VS_QUAD,FS_GLOW);
  GEO=sphere();
  QUAD=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,QUAD); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  BLANK=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,BLANK);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
  ANISO=gl.getExtension("EXT_texture_filter_anisotropic")||gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  MAXANISO=ANISO?gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;
  for(const k of Object.keys(GLTEX)) delete GLTEX[k];
  for(const k of Object.keys(TEX)) if(TEX[k]) TEX[k].dirty=true;   /* after a context loss, everything goes back up */
  TEX_DIRTY=true;
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,0);
}
function init(){
  if(gl||FAILED) return !!gl;
  if(typeof document==="undefined") { FAILED=true; return false; }
  try{
    CV=document.createElement("canvas"); CV.width=64; CV.height=64;
    const attrs={alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,
      preserveDrawingBuffer:true,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false};
    gl=CV.getContext("webgl2",attrs); isGL2=!!gl;
    if(!gl) gl=CV.getContext("webgl",attrs)||CV.getContext("experimental-webgl",attrs);
    if(!gl){ FAILED=true; return false; }
    CV.addEventListener("webglcontextlost",e=>{ e.preventDefault(); lost=true; },false);
    CV.addEventListener("webglcontextrestored",()=>{ try{ build(); lost=false; }catch(err){ FAILED=true; console.warn(err.message); } },false);
    build();
    STATS.gl=isGL2?"webgl2":"webgl";
  }catch(err){ console.warn("globe: falling back to the software sprite — "+(err&&err.message)); FAILED=true; gl=null; return false; }
  return true;
}
const pow2=n=>n>0&&(n&(n-1))===0;
function upload(){
  if(!TEX_DIRTY) return; TEX_DIRTY=false;
  for(const key of Object.keys(TEX)){
    const t=TEX[key]; if(!t||!t.dirty) continue;
    const tex=GLTEX[key]||(GLTEX[key]=gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    const fmt=key==="clouds"?gl.RGBA:gl.RGB;
    try{ gl.texImage2D(gl.TEXTURE_2D,0,fmt,fmt,gl.UNSIGNED_BYTE,t.img); }
    catch(err){ delete GLTEX[key]; t.dirty=false; console.warn("globe: "+key+" imagery could not be uploaded — "+(err&&err.message)); continue; }
    const mips=isGL2||(pow2(t.w)&&pow2(t.h));
    if(mips){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); }
    else { gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); }
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(ANISO) gl.texParameterf(gl.TEXTURE_2D,ANISO.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,MAXANISO));
    t.dirty=false; STATS.tex[key]=t.name;
  }
}

/* ---- the camera and the Sun ---------------------------------------- */
/* globe-fixed (facing lon0) -> screen (x right, y up, z toward the eye): a turn about the
   pole by lon0, then the observer's tilt about the screen's x axis. Column-major. */
function rotation(lon0,tilt){
  const c=Math.cos(lon0), s=Math.sin(lon0), ct=Math.cos(tilt), st=Math.sin(tilt);
  return new Float32Array([ c,-st*s,ct*s,  0,ct,st,  -s,-st*c,ct*c ]);
}
const norm3=(x,y,z)=>{ const n=Math.hypot(x,y,z)||1; return [x/n,y/n,z/n]; };
/* the Sun as a unit vector in the screen frame. With alt/az at the observer it is exact
   everywhere on the globe: the observer's east/north/up in the globe frame carry the Sun
   into geography, and the same rotation as the ground carries it to the screen — so a
   turn of the globe keeps the night attached to the countries it is night in. Without
   alt/az, the ring's 2D direction with a little lift toward the eye. */
function sunVector(o,lat0,spinR,tilt){
  const sun=o.sun;
  if(sun&&Number.isFinite(sun.alt)&&Number.isFinite(sun.az)){
    const alt=sun.alt*D2R, az=sun.az*D2R;
    const E=Math.cos(alt)*Math.sin(az), N=Math.cos(alt)*Math.cos(az), U=Math.sin(alt);
    const l=-spinR, cl=Math.cos(l), sl=Math.sin(l), cf=Math.cos(lat0), sf=Math.sin(lat0);
    const gx=E*cl      + N*(-sf*sl) + U*(cf*sl);
    const gy=           N*cf       + U*sf;
    const gz=E*(-sl)   + N*(-sf*cl) + U*(cf*cl);
    const ct=Math.cos(tilt), st=Math.sin(tilt);
    return norm3(gx, gy*ct-gz*st, gy*st+gz*ct);
  }
  const f=o.light||{x:-0.6,y:-0.5};
  return norm3(f.x,-f.y,0.35);
}

/* ---- rendering ----------------------------------------------------- */
let LAST=null, lastAt=-1e9, avgN=0;
const near=(a,b,eps)=>Math.abs(a-b)<=eps;
export function globeReady(){ return !!(gl&&!lost&&!FAILED&&TEX.day&&GLTEX.day); }
export function globeStats(){ return {...STATS,size:STATS.size.slice(),tex:{...STATS.tex},ready:globeReady()}; }
if(typeof window!=="undefined") window.__globeStats=globeStats;

export function renderGlobe(o){
  if(!o||!(o.R>0)) return null;
  if(!init()||lost) return null;
  loadTextures();
  if(!TEX.day) return null;                    /* nothing to show yet: the sprite stands in */
  upload();
  if(!GLTEX.day) return null;
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  const dpr=o.dpr||1, R=o.R;
  const lat0=(o.lat0||0)*D2R, spinR=(o.spin||0)*D2R, lon0=(o.lon0||0)*D2R+spinR;
  const tilt=lat0-26*D2R+(o.pitch||0)*D2R;
  const L=sunVector(o,lat0,spinR,tilt);
  /* the window: only what is on screen, in Earth radii about the centre, y down */
  const w=o.win||{x0:-MARGIN,y0:-MARGIN,x1:MARGIN,y1:MARGIN};
  const x0=Math.max(-MARGIN,w.x0), y0=Math.max(-MARGIN,w.y0);
  const x1=Math.min(MARGIN,w.x1), y1=Math.min(MARGIN,w.y1);
  if(!(x1>x0&&y1>y0)) return null;
  let s=R*dpr; const ext=Math.max(x1-x0,y1-y0); if(ext*s>CAP) s=CAP/ext;
  const pw=Math.max(8,Math.ceil((x1-x0)*s)), ph=Math.max(8,Math.ceil((y1-y0)*s));
  const X1=x0+pw/s, Y1=y0+ph/s;                /* the pixel grid's true extent */
  const clipped=x0>-MARGIN+1e-6||y0>-MARGIN+1e-6||x1<MARGIN-1e-6||y1<MARGIN-1e-6;
  const texA=o.texA==null?1:Math.max(0,Math.min(1,o.texA));
  const cloudsA=(o.cloudsA==null?texA:o.cloudsA)*(GLTEX.clouds?1:0);
  const lightsA=(o.lightsA==null?texA:o.lightsA)*(GLTEX.night?1:0);
  const cloudOff=(((o.t||0)/60000)*CLOUD_DEG_PER_MIN/360)%1;
  const state={pw,ph,x0,y0,X1,Y1,lat0,lon0,tilt,L,texA,cloudsA,lightsA,cloudOff,tex:Object.keys(GLTEX).join()};
  if(LAST){
    const same=LAST.pw===pw&&LAST.ph===ph&&near(LAST.x0,x0,2e-3)&&near(LAST.y0,y0,2e-3)&&near(LAST.X1,X1,2e-3)&&near(LAST.Y1,Y1,2e-3)
      &&near(LAST.lat0,lat0,0.1*D2R)&&near(LAST.lon0,lon0,0.1*D2R)&&near(LAST.tilt,tilt,0.1*D2R)
      &&(LAST.L[0]*L[0]+LAST.L[1]*L[1]+LAST.L[2]*L[2])>0.99999&&near(LAST.texA,texA,0.004)
      &&near(LAST.cloudsA,cloudsA,0.004)&&near(LAST.lightsA,lightsA,0.004)&&LAST.tex===state.tex;
    const cloudsMoved=cloudsA>0.002&&!near(LAST.cloudOff,cloudOff,1e-6);   /* no deck, nothing drifts */
    if(same){ if(!cloudsMoved||now-lastAt<1000){ STATS.skipped++; return CV; } }   /* idle: the deck drifts at ~1 fps */
    else if(!clipped&&now-lastAt<30){ STATS.skipped++; return CV; }   /* dragging: ~30 fps; the blit maps the last frame onto the current radius exactly, whatever it was rendered at */
  }
  const t0=now;
  /* the drawing buffer grows in steps of 64 so a pull-out does not reallocate it every frame */
  const needW=Math.ceil(pw/64)*64, needH=Math.ceil(ph/64)*64;
  if(CV.width!==needW||CV.height!==needH){ CV.width=needW; CV.height=needH; }
  const vy=CV.height-ph;                       /* the render sits at the canvas's top-left as an image */
  gl.viewport(0,vy,pw,ph); gl.enable(gl.SCISSOR_TEST); gl.scissor(0,vy,pw,ph);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const win=[(x0+X1)/2, -(y0+Y1)/2, (X1-x0)/2, (Y1-y0)/2];   /* centre and half-extents, y up */
  const rot=rotation(lon0,tilt);
  const px=1/s, haze=1-texA;
  const bindTex=(unit,key,loc)=>{ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,GLTEX[key]||BLANK); gl.uniform1i(loc,unit); };
  const sphereAttrs=P=>{ gl.bindBuffer(gl.ARRAY_BUFFER,GEO.pos); gl.enableVertexAttribArray(P.a.a_pos); gl.vertexAttribPointer(P.a.a_pos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,GEO.uv); gl.enableVertexAttribArray(P.a.a_uv); gl.vertexAttribPointer(P.a.a_uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,GEO.idx); };
  /* 1. the air, first: outside the silhouette it is the glow; inside, it is what the
     ground's anti-aliased edge blends into */
  let P=P_GLOW; gl.useProgram(P.p);
  gl.bindBuffer(gl.ARRAY_BUFFER,QUAD); gl.enableVertexAttribArray(P.a.a_q); gl.vertexAttribPointer(P.a.a_q,2,gl.FLOAT,false,0,0);
  gl.uniform4fv(P.u.u_win,win); gl.uniform3fv(P.u.u_light,L); gl.uniform1f(P.u.u_haze,haze);
  gl.disable(gl.CULL_FACE); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.enable(gl.CULL_FACE);
  /* 2. the ground */
  P=P_SURF; gl.useProgram(P.p); sphereAttrs(P);
  gl.uniformMatrix3fv(P.u.u_rot,false,rot); gl.uniform4fv(P.u.u_win,win); gl.uniform1f(P.u.u_radius,1.004);
  gl.uniform3fv(P.u.u_light,L); gl.uniform1f(P.u.u_texA,texA); gl.uniform1f(P.u.u_lightsA,lightsA); gl.uniform1f(P.u.u_cloudsA,cloudsA);
  gl.uniform1f(P.u.u_cloudOff,cloudOff); gl.uniform1f(P.u.u_px,px); gl.uniform1f(P.u.u_haze,haze);
  gl.uniform1f(P.u.u_hasNight,GLTEX.night?1:0); gl.uniform1f(P.u.u_hasClouds,GLTEX.clouds?1:0); gl.uniform1f(P.u.u_hasSpec,GLTEX.spec?1:0);
  bindTex(0,"day",P.u.u_day); bindTex(1,"night",P.u.u_night); bindTex(2,"clouds",P.u.u_clouds); bindTex(3,"spec",P.u.u_spec);
  gl.drawElements(gl.TRIANGLES,GEO.n,gl.UNSIGNED_SHORT,0);
  /* 3. the cloud deck, a touch above the ground */
  if(cloudsA>0.002){
    P=P_CLOUD; gl.useProgram(P.p); sphereAttrs(P);
    gl.uniformMatrix3fv(P.u.u_rot,false,rot); gl.uniform4fv(P.u.u_win,win); gl.uniform1f(P.u.u_radius,1.008);
    gl.uniform3fv(P.u.u_light,L); gl.uniform1f(P.u.u_cloudsA,cloudsA); gl.uniform1f(P.u.u_cloudOff,cloudOff); gl.uniform1f(P.u.u_px,px);
    bindTex(0,"clouds",P.u.u_clouds);
    gl.drawElements(gl.TRIANGLES,GEO.n,gl.UNSIGNED_SHORT,0);
  }
  gl.disable(gl.SCISSOR_TEST);
  const ms=(typeof performance!=="undefined"?performance.now():Date.now())-t0;
  STATS.msLast=ms; avgN++; STATS.msAvg+=(ms-STATS.msAvg)/Math.min(avgN,60); STATS.renders++; STATS.size=[pw,ph];
  STATS.last={L:L.map(v=>+v.toFixed(3)),lat0:+(lat0/D2R).toFixed(2),lon0:+(lon0/D2R).toFixed(2),tilt:+(tilt/D2R).toFixed(2),
    sun:o.sun&&Number.isFinite(o.sun.alt)?{alt:+o.sun.alt.toFixed(1),az:+o.sun.az.toFixed(1)}:null,texA:+texA.toFixed(3),clipped,px:+px.toFixed(5)};
  LAST=state; lastAt=now;
  CV.view={x0,y0,x1:X1,y1:Y1,pw,ph};
  return CV;
}
