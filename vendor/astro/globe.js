const p=Math.PI/180,v=1.1,se=1024,O=64,G=48,Ae=.4,we=new Set(["day_2048.jpg","bluemarble_1024.jpg","night_2048.jpg","clouds_1024.png","specular_1024.jpg"]),le={day:["day_2048.jpg","bluemarble_1024.jpg"],night:["night_2048.jpg"],clouds:["clouds_1024.png"],spec:["specular_1024.jpg"]},b={day:null,night:null,clouds:null,spec:null};let ue=!1,k=!1;function Te(){if(ue)return;ue=!0;const t=new URL("../../assets/earth/",import.meta.url).href;for(const a of Object.keys(le))le[a].filter(s=>we.has(s)).forEach((s,o)=>{const r=new Image;r.decoding="async";const i=()=>{const h=b[a];h&&h.rank<o||(b[a]={img:r,rank:o,name:s,w:r.naturalWidth,h:r.naturalHeight,dirty:!0},k=!0)};r.onload=()=>{r.decode?r.decode().then(i,i):i()},r.onerror=()=>{},r.src=t+s})}let _=null,e=null,q=!1,I=!1,z=!1,X=null,ce=1,he=null,fe=null,de=null,D=null,V=null,K=null;const m={},x={size:[0,0],msLast:0,msAvg:0,renders:0,skipped:0,gl:null,tex:{}},_e=`
attribute vec3 a_pos; attribute vec2 a_uv;
uniform mat3 u_rot; uniform vec4 u_win; uniform float u_radius;
varying highp vec2 v_uv; varying vec2 v_p;
void main(){
  vec3 n=u_rot*a_pos; v_uv=a_uv;
  vec2 p=n.xy*u_radius; v_p=p;
  gl_Position=vec4((p-u_win.xy)/u_win.zw,0.0,1.0);
}`,Q=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif`,ye=Q+`
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
}`,be=Q+`
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
}`,Re=`
attribute vec2 a_q; uniform vec4 u_win; varying vec2 v_p;
void main(){ v_p=u_win.xy+a_q*u_win.zw; gl_Position=vec4(a_q,0.0,1.0); }`,Le=Q+`
varying vec2 v_p;
uniform vec3 u_light; uniform float u_haze;
const float M=${v.toFixed(3)};
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
}`;function $(t,a){const s=(l,u)=>{const c=e.createShader(l);if(e.shaderSource(c,u),e.compileShader(c),!e.getShaderParameter(c,e.COMPILE_STATUS))throw new Error("globe shader: "+e.getShaderInfoLog(c));return c},o=e.createProgram();if(e.attachShader(o,s(e.VERTEX_SHADER,t)),e.attachShader(o,s(e.FRAGMENT_SHADER,a)),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw new Error("globe program: "+e.getProgramInfoLog(o));const r={},i=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let l=0;l<i;l++){const u=e.getActiveUniform(o,l);r[u.name]=e.getUniformLocation(o,u.name)}const h={},f=e.getProgramParameter(o,e.ACTIVE_ATTRIBUTES);for(let l=0;l<f;l++){const u=e.getActiveAttrib(o,l);h[u.name]=e.getAttribLocation(o,u.name)}return{p:o,u:r,a:h}}function Me(){const t=[],a=[],s=[];for(let i=0;i<=G;i++){const h=-Math.PI/2+Math.PI*i/G,f=Math.cos(h),l=Math.sin(h);for(let u=0;u<=O;u++){const c=-Math.PI+2*Math.PI*u/O;t.push(f*Math.sin(c),l,f*Math.cos(c)),a.push(u/O,1-i/G)}}const o=O+1;for(let i=0;i<G;i++)for(let h=0;h<O;h++){const f=i*o+h,l=f+1,u=f+o,c=u+1;s.push(f,l,u,l,c,u)}const r=(i,h)=>{const f=e.createBuffer();return e.bindBuffer(i,f),e.bufferData(i,h,e.STATIC_DRAW),f};return{pos:r(e.ARRAY_BUFFER,new Float32Array(t)),uv:r(e.ARRAY_BUFFER,new Float32Array(a)),idx:r(e.ELEMENT_ARRAY_BUFFER,new Uint16Array(s)),n:s.length}}function me(){he=$(_e,ye),fe=$(_e,be),de=$(Re,Le),D=Me(),V=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,V),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),K=e.createTexture(),e.bindTexture(e.TEXTURE_2D,K),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),X=e.getExtension("EXT_texture_filter_anisotropic")||e.getExtension("WEBKIT_EXT_texture_filter_anisotropic"),ce=X?e.getParameter(X.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;for(const t of Object.keys(m))delete m[t];for(const t of Object.keys(b))b[t]&&(b[t].dirty=!0);k=!0,e.disable(e.DEPTH_TEST),e.enable(e.CULL_FACE),e.cullFace(e.BACK),e.frontFace(e.CCW),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.clearColor(0,0,0,0)}function Se(){if(e||I)return!!e;if(typeof document>"u")return I=!0,!1;try{_=document.createElement("canvas"),_.width=64,_.height=64;const t={alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1};if(e=_.getContext("webgl2",t),q=!!e,e||(e=_.getContext("webgl",t)||_.getContext("experimental-webgl",t)),!e)return I=!0,!1;_.addEventListener("webglcontextlost",a=>{a.preventDefault(),z=!0},!1),_.addEventListener("webglcontextrestored",()=>{try{me(),z=!1}catch(a){I=!0,console.warn(a.message)}},!1),me(),x.gl=q?"webgl2":"webgl"}catch(t){return console.warn("globe: falling back to the software sprite — "+(t&&t.message)),I=!0,e=null,!1}return!0}const ge=t=>t>0&&(t&t-1)===0;function Fe(){if(k){k=!1;for(const t of Object.keys(b)){const a=b[t];if(!a||!a.dirty)continue;const s=m[t]||(m[t]=e.createTexture());e.bindTexture(e.TEXTURE_2D,s),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1);const o=t==="clouds"?e.RGBA:e.RGB;try{e.texImage2D(e.TEXTURE_2D,0,o,o,e.UNSIGNED_BYTE,a.img)}catch(i){delete m[t],a.dirty=!1,console.warn("globe: "+t+" imagery could not be uploaded — "+(i&&i.message));continue}q||ge(a.w)&&ge(a.h)?(e.generateMipmap(e.TEXTURE_2D),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT)):(e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE)),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),X&&e.texParameterf(e.TEXTURE_2D,X.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,ce)),a.dirty=!1,x.tex[t]=a.name}}}function Pe(t,a){const s=Math.cos(t),o=Math.sin(t),r=Math.cos(a),i=Math.sin(a);return new Float32Array([s,-i*o,r*o,0,r,i,-o,-i*s,r*s])}const pe=(t,a,s)=>{const o=Math.hypot(t,a,s)||1;return[t/o,a/o,s/o]};function Ue(t,a,s,o){const r=t.sun;if(r&&Number.isFinite(r.alt)&&Number.isFinite(r.az)){const h=r.alt*p,f=r.az*p,l=Math.cos(h)*Math.sin(f),u=Math.cos(h)*Math.cos(f),c=Math.sin(h),g=-s,R=Math.cos(g),L=Math.sin(g),A=Math.cos(a),P=Math.sin(a),y=l*R+u*(-P*L)+c*(A*L),E=u*A+c*P,M=l*-L+u*(-P*R)+c*(A*R),S=Math.cos(o),N=Math.sin(o);return pe(y,E*S-M*N,E*N+M*S)}const i=t.light||{x:-.6,y:-.5};return pe(i.x,-i.y,.35)}let d=null,J=-1e9,ve=0;const T=(t,a,s)=>Math.abs(t-a)<=s;function Ie(){return!!(e&&!z&&!I&&b.day&&m.day)}function De(){return{...x,size:x.size.slice(),tex:{...x.tex},ready:Ie()}}typeof window<"u"&&(window.__globeStats=De);function Ne(t){if(!t||!(t.R>0)||!Se()||z||(Te(),!b.day)||(Fe(),!m.day))return null;const a=typeof performance<"u"?performance.now():Date.now(),s=t.dpr||1,o=t.R,r=(t.lat0||0)*p,i=(t.spin||0)*p,h=(t.lon0||0)*p+i,f=r-26*p+(t.pitch||0)*p,l=Ue(t,r,i,f),u=t.win||{x0:-v,y0:-v,x1:v,y1:v},c=Math.max(-v,u.x0),g=Math.max(-v,u.y0),R=Math.min(v,u.x1),L=Math.min(v,u.y1);if(!(R>c&&L>g))return null;let A=o*s;const P=Math.max(R-c,L-g);P*A>se&&(A=se/P);const y=Math.max(8,Math.ceil((R-c)*A)),E=Math.max(8,Math.ceil((L-g)*A)),M=c+y/A,S=g+E/A,N=c>-v+1e-6||g>-v+1e-6||R<v-1e-6||L<v-1e-6,F=t.texA==null?1:Math.max(0,Math.min(1,t.texA)),U=(t.cloudsA==null?F:t.cloudsA)*(m.clouds?1:0),j=(t.lightsA==null?F:t.lightsA)*(m.night?1:0),B=(t.t||0)/6e4*Ae/360%1,Z={pw:y,ph:E,x0:c,y0:g,X1:M,Y1:S,lat0:r,lon0:h,tilt:f,L:l,texA:F,cloudsA:U,lightsA:j,cloudOff:B,tex:Object.keys(m).join()};if(d){const w=d.pw===y&&d.ph===E&&T(d.x0,c,.002)&&T(d.y0,g,.002)&&T(d.X1,M,.002)&&T(d.Y1,S,.002)&&T(d.lat0,r,.1*p)&&T(d.lon0,h,.1*p)&&T(d.tilt,f,.1*p)&&d.L[0]*l[0]+d.L[1]*l[1]+d.L[2]*l[2]>.99999&&T(d.texA,F,.004)&&T(d.cloudsA,U,.004)&&T(d.lightsA,j,.004)&&d.tex===Z.tex,W=U>.002&&!T(d.cloudOff,B,1e-6);if(w){if(!W||a-J<1e3)return x.skipped++,_}else if(!N&&a-J<30)return x.skipped++,_}const xe=a,ee=Math.ceil(y/64)*64,te=Math.ceil(E/64)*64;(_.width!==ee||_.height!==te)&&(_.width=ee,_.height=te);const ae=_.height-E;e.viewport(0,ae,y,E),e.enable(e.SCISSOR_TEST),e.scissor(0,ae,y,E),e.clear(e.COLOR_BUFFER_BIT);const Y=[(c+M)/2,-(g+S)/2,(M-c)/2,(S-g)/2],ne=Pe(h,f),H=1/A,oe=1-F,C=(w,W,Ee)=>{e.activeTexture(e.TEXTURE0+w),e.bindTexture(e.TEXTURE_2D,m[W]||K),e.uniform1i(Ee,w)},re=w=>{e.bindBuffer(e.ARRAY_BUFFER,D.pos),e.enableVertexAttribArray(w.a.a_pos),e.vertexAttribPointer(w.a.a_pos,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,D.uv),e.enableVertexAttribArray(w.a.a_uv),e.vertexAttribPointer(w.a.a_uv,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,D.idx)};let n=de;e.useProgram(n.p),e.bindBuffer(e.ARRAY_BUFFER,V),e.enableVertexAttribArray(n.a.a_q),e.vertexAttribPointer(n.a.a_q,2,e.FLOAT,!1,0,0),e.uniform4fv(n.u.u_win,Y),e.uniform3fv(n.u.u_light,l),e.uniform1f(n.u.u_haze,oe),e.disable(e.CULL_FACE),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.enable(e.CULL_FACE),n=he,e.useProgram(n.p),re(n),e.uniformMatrix3fv(n.u.u_rot,!1,ne),e.uniform4fv(n.u.u_win,Y),e.uniform1f(n.u.u_radius,1.004),e.uniform3fv(n.u.u_light,l),e.uniform1f(n.u.u_texA,F),e.uniform1f(n.u.u_lightsA,j),e.uniform1f(n.u.u_cloudsA,U),e.uniform1f(n.u.u_cloudOff,B),e.uniform1f(n.u.u_px,H),e.uniform1f(n.u.u_haze,oe),e.uniform1f(n.u.u_hasNight,m.night?1:0),e.uniform1f(n.u.u_hasClouds,m.clouds?1:0),e.uniform1f(n.u.u_hasSpec,m.spec?1:0),C(0,"day",n.u.u_day),C(1,"night",n.u.u_night),C(2,"clouds",n.u.u_clouds),C(3,"spec",n.u.u_spec),e.drawElements(e.TRIANGLES,D.n,e.UNSIGNED_SHORT,0),U>.002&&(n=fe,e.useProgram(n.p),re(n),e.uniformMatrix3fv(n.u.u_rot,!1,ne),e.uniform4fv(n.u.u_win,Y),e.uniform1f(n.u.u_radius,1.008),e.uniform3fv(n.u.u_light,l),e.uniform1f(n.u.u_cloudsA,U),e.uniform1f(n.u.u_cloudOff,B),e.uniform1f(n.u.u_px,H),C(0,"clouds",n.u.u_clouds),e.drawElements(e.TRIANGLES,D.n,e.UNSIGNED_SHORT,0)),e.disable(e.SCISSOR_TEST);const ie=(typeof performance<"u"?performance.now():Date.now())-xe;return x.msLast=ie,ve++,x.msAvg+=(ie-x.msAvg)/Math.min(ve,60),x.renders++,x.size=[y,E],x.last={L:l.map(w=>+w.toFixed(3)),lat0:+(r/p).toFixed(2),lon0:+(h/p).toFixed(2),tilt:+(f/p).toFixed(2),sun:t.sun&&Number.isFinite(t.sun.alt)?{alt:+t.sun.alt.toFixed(1),az:+t.sun.az.toFixed(1)}:null,texA:+F.toFixed(3),clipped:N,px:+H.toFixed(5)},d=Z,J=a,_.view={x0:c,y0:g,x1:M,y1:S,pw:y,ph:E},_}export{Ie as globeReady,De as globeStats,Ne as renderGlobe};
