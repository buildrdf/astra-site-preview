/* ===================================================================
   ORIENT — the phone's rotation as a camera, without a pole
   -------------------------------------------------------------------
   The sky view used to turn the phone's orientation into an azimuth and
   an altitude, ease those two numbers, and build the camera from them.
   Straight up is a hole in that model: every azimuth names the same
   patch of sky, so the heading was held there ("trust taper") and let go
   below — which is the freeze at the top and the snap on the way down
   that Sangram reported so many times (5 Sep: "it gets frozen at the top
   ... snaps in a weird way when I point my camera towards the very top").

   Here the camera IS the rotation. deviceBasis() turns W3C alpha/beta/
   gamma into the back camera's forward, right and up vectors in the
   world frame (east, north, up); the frame loop eases a quaternion toward
   the latest one with slerp; azimuth and altitude are read OFF the eased
   camera for labels and hand-off, never fed into it. There is no special
   angle anywhere in this file. Roll is honoured: tilt the phone and the
   sky tilts with it, as it does through a window.

   Pure — no DOM — so tools/validate_orientation.mjs can sweep a synthetic
   phone through the zenith and the nadir and fail on the first jump.
   =================================================================== */
const D2R=Math.PI/180;

/* R = Rz(alpha) · Rx(beta) · Ry(gamma), the W3C device rotation; the back
   camera looks along the device -z axis, its right is +x, its up is +y.
   Columns of R are the device axes in the world frame (x east, y north, z up). */
export function deviceBasis(alphaDeg,betaDeg,gammaDeg){
  const a=alphaDeg*D2R, b=betaDeg*D2R, g=gammaDeg*D2R;
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
  /* R = Rz(a) Rx(b) Ry(g) written out */
  const m00=ca*cg-sa*sb*sg, m01=-sa*cb, m02=ca*sg+sa*sb*cg;
  const m10=sa*cg+ca*sb*sg, m11=ca*cb,  m12=sa*sg-ca*sb*cg;
  const m20=-cb*sg,         m21=sb,     m22=cb*cg;
  const x=[m00,m10,m20], y=[m01,m11,m21], z=[m02,m12,m22];
  return { f:[-z[0],-z[1],-z[2]], r:x, u:y };
}

/* ---- quaternions (w,x,y,z), world-from-camera ---------------------- */
export function quatFromBasis({f,r,u}){
  /* columns: r, u, -f  (camera x, y, z in world) */
  const m00=r[0], m01=u[0], m02=-f[0];
  const m10=r[1], m11=u[1], m12=-f[1];
  const m20=r[2], m21=u[2], m22=-f[2];
  const tr=m00+m11+m22; let w,x,y,z;
  if(tr>0){ const s=Math.sqrt(tr+1)*2; w=s/4; x=(m21-m12)/s; y=(m02-m20)/s; z=(m10-m01)/s; }
  else if(m00>m11&&m00>m22){ const s=Math.sqrt(1+m00-m11-m22)*2; w=(m21-m12)/s; x=s/4; y=(m01+m10)/s; z=(m02+m20)/s; }
  else if(m11>m22){ const s=Math.sqrt(1+m11-m00-m22)*2; w=(m02-m20)/s; x=(m01+m10)/s; y=s/4; z=(m12+m21)/s; }
  else { const s=Math.sqrt(1+m22-m00-m11)*2; w=(m10-m01)/s; x=(m02+m20)/s; y=(m12+m21)/s; z=s/4; }
  return norm([w,x,y,z]);
}
export function basisFromQuat(q){
  const [w,x,y,z]=q;
  const m00=1-2*(y*y+z*z), m01=2*(x*y-z*w), m02=2*(x*z+y*w);
  const m10=2*(x*y+z*w),   m11=1-2*(x*x+z*z), m12=2*(y*z-x*w);
  const m20=2*(x*z-y*w),   m21=2*(y*z+x*w), m22=1-2*(x*x+y*y);
  return { r:[m00,m10,m20], u:[m01,m11,m21], f:[-m02,-m12,-m22] };
}
const norm=q=>{ const n=Math.hypot(q[0],q[1],q[2],q[3])||1; return [q[0]/n,q[1]/n,q[2]/n,q[3]/n]; };
/* shortest-arc slerp; t in 0..1 */
export function slerp(a,b,t){
  let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  let bb=b; if(d<0){ d=-d; bb=[-b[0],-b[1],-b[2],-b[3]]; }
  if(d>0.9995){ return norm([a[0]+(bb[0]-a[0])*t, a[1]+(bb[1]-a[1])*t, a[2]+(bb[2]-a[2])*t, a[3]+(bb[3]-a[3])*t]); }
  const th=Math.acos(Math.min(1,d)), s=Math.sin(th);
  const wa=Math.sin((1-t)*th)/s, wb=Math.sin(t*th)/s;
  return [a[0]*wa+bb[0]*wb, a[1]*wa+bb[1]*wb, a[2]*wa+bb[2]*wb, a[3]*wa+bb[3]*wb];
}
/* the angle between two rotations, degrees */
export function quatAngle(a,b){
  const d=Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]);
  return 2*Math.acos(Math.min(1,d))/D2R;
}

/* ---- read azimuth / altitude off a camera, for labels and hand-off ---- */
export function azAltOf(f){
  const az=((Math.atan2(f[0],f[1])/D2R)%360+360)%360;
  const alt=Math.asin(Math.max(-1,Math.min(1,f[2])))/D2R;
  return {az,alt};
}
/* a camera from azimuth / altitude with the horizon level — the drag camera */
export function basisFromAzAlt(azDeg,altDeg){
  const A=altDeg*D2R, Z=azDeg*D2R;
  return { f:[Math.cos(A)*Math.sin(Z), Math.cos(A)*Math.cos(Z), Math.sin(A)],
           r:[Math.cos(Z), -Math.sin(Z), 0],
           u:[-Math.sin(A)*Math.sin(Z), -Math.sin(A)*Math.cos(Z), Math.cos(A)] };
}
/* the angle between two look directions, degrees */
export function lookAngle(f1,f2){
  const d=f1[0]*f2[0]+f1[1]*f2[1]+f1[2]*f2[2];
  return Math.acos(Math.max(-1,Math.min(1,d)))/D2R;
}

/* ---- yaw fusion: the gyro carries the view; the compass is consulted, not obeyed ----
   alphaRaw     the W3C alpha of THIS sample: iOS's gyro attitude, smooth and immediate,
                referenced to an arbitrary zero but drift-corrected by iOS itself
                (CoreMotion's xArbitraryCorrectedZVertical), so its offset from north is
                a CONSTANT for the session
   compassAlpha 360 - webkitCompassHeading of the SAME sample, or null
   accuracy     webkitCompassAccuracy (-1 = the magnetometer has no fix)
   st           the state, mutated: fix (the world-yaw offset δ, degrees), timing, the
                previous basis for the turn rate, the pending re-alignment
   Returns alphaRaw + δ, or null until a first fix exists.

   WHAT WENT WRONG BEFORE (7 Sep, tools/validate_ar_motion.mjs): δ was eased toward
   `compass − alpha` on every sample. That difference is not constant. During a pan the
   compass runs 100–300 ms behind the gyro, so δ was pulled the wrong way and unwound
   after the hand stopped — the view kept turning 13–62° with the phone still ("if I
   stop and I'm moving to the right, it's trying to move towards the left"). Past the
   zenith the compass heading follows a different edge of the phone than alpha does, so
   the difference jumps by up to 180° and δ swung the whole sky round ("if I look at the
   top, it immediately snaps"). Chasing the compass was the bug.

   NOW: δ is locked once, then only refined — never while the phone is turning, never
   in a pose where the compass's meaning is ambiguous, and never by more than a slow
   glide. Both heading definitions Apple might use (the top edge's horizontal projection,
   the back camera's) are computed from the raw basis; a correction is taken only where
   they agree (a tilted, unrolled phone below the vertical), or — while the phone is
   held upright, where AR actually happens — only as a small refinement from the
   camera's heading. Everything is representation-free: the offset comes from the
   basis, not from alpha, so the W3C triple's 180° representation flips cannot reach
   it. A step is taken exactly once, at the first lock. */
export const wrapDeg=d=>((d+180)%360+360)%360-180;
const headingOf=v=>{ const h=Math.hypot(v[0],v[1]); return h<0.30?null:((Math.atan2(v[0],v[1])/D2R)%360+360)%360; };
export function fuseYaw(st, alphaRaw, beta, gamma, compassAlpha, accuracy, tMs){
  const B=deviceBasis(alphaRaw,beta,gamma);
  if(st.firstT==null) st.firstT=tMs;
  /* the turn rate, from the raw basis: degrees per second of look and of roll */
  let rate=0;
  if(st.pf&&st.pt!=null){ const dt=Math.max(1,tMs-st.pt);
    rate=Math.max(lookAngle(B.f,st.pf),lookAngle(B.u,st.pu))*1000/dt; }
  st.pf=B.f; st.pu=B.u; st.pt=tMs;
  if(rate>20) st.movingT=tMs;                                  /* the last moment the phone was turning */
  const still=st.movingT==null||tMs-st.movingT>500;             /* half a second of calm: the compass has caught up */
  const poor=!(accuracy==null||accuracy<0)&&accuracy>30;
  if(compassAlpha!=null && !(accuracy<0)){
    const C=((360-compassAlpha)%360+360)%360;                   /* the heading iOS reported */
    const hu=headingOf(B.u), hf=headingOf(B.f);                  /* the top edge's heading, the camera's */
    const agree=hu!=null&&hf!=null&&Math.abs(wrapDeg(hu-hf))<6;
    /* the offset that would put THIS sample's heading on the compass's */
    const cand=agree?wrapDeg(hu-C):(hf!=null?wrapDeg(hf-C):null);
    if(cand!=null){
      if(st.fix==null){                                         /* the only step ever taken: the first lock, from any
                                                                   compass at all — a poor one is refined later, and
                                                                   the view follows the phone from the first frame */
        if(agree||rate<60||tMs-st.firstT>700){ st.fix=cand; st.fixT0=tMs; st.fixT=tMs; st.avg=cand; st.poorLock=poor; }
      } else if(!poor||st.poorLock){
        /* the compass is averaged while the phone is calm (τ 1 s), so noise never moves
           the sky; the average is acted on only past a 4° dead band */
        const gap=Math.min(100,tMs-(st.fixT||tMs));
        if(still){
          st.avg=st.avg==null?cand:wrapDeg(st.avg+wrapDeg(cand-st.avg)*(1-Math.exp(-gap/1000)));
          const d=wrapDeg(st.avg-st.fix), young=tMs-st.fixT0<2000;
          if(young||st.poorLock){                               /* the first two seconds: settle onto the average quickly */
            st.fix=wrapDeg(st.fix+d*(1-Math.exp(-gap/600))); if(!poor) st.poorLock=false;
          } else if(Math.abs(d)>4&&Math.abs(d)<12){             /* a refinement: a 4 s glide, from either regime */
            st.fix=wrapDeg(st.fix+d*(1-Math.exp(-gap/4000))); st.big=null;
          } else if(Math.abs(d)>=12&&agree){                    /* a real disagreement: only where the compass is unambiguous,
                                                                   only after it has persisted 3 s, then a 2 s glide */
            if(st.big==null) st.big=tMs;
            if(tMs-st.big>3000) st.fix=wrapDeg(st.fix+d*(1-Math.exp(-gap/2000)));
          } else st.big=null;
        } else { st.avg=null; st.big=null; }
        st.fixT=tMs;
      }
    }
  }
  /* no compass at all for 1.5 s (a desktop, an emulator, a phone whose magnetometer never
     answers): follow the phone anyway, relative to wherever it woke up */
  if(st.fix==null&&tMs-st.firstT>1500){ st.fix=0; st.fixT0=tMs; st.fixT=tMs; st.avg=0; st.poorLock=true; }
  return st.fix==null?null:alphaRaw+st.fix;
}
/* W3C alpha/beta/gamma back out of a device basis (for tools) */
export function eulerFromBasis({f,r,u}){
  return eulerFromColumns(r,u,[-f[0],-f[1],-f[2]]);   /* device z = -forward */
}
function eulerFromColumns(x,y,z){
  /* R = [x y z] columns; R = Rz(a)Rx(b)Ry(g): m21=sin b, m01=-sin a cos b, m11=cos a cos b, m20=-cos b sin g, m22=cos b cos g.
     Two solutions exist; browsers report the one with gamma in [-90,90) and beta in [-180,180). */
  const m21=y[2], m01=y[0], m11=y[1], m20=x[2], m22=z[2];
  let b=Math.asin(Math.max(-1,Math.min(1,m21)))/D2R;
  let a,g;
  if(Math.abs(m21)>1-1e-9){                    /* exactly upright or inverted: alpha and gamma are one angle; give it all to alpha */
    const m00=x[0], m10=x[1]; a=Math.atan2(m10,m00)/D2R; g=0;
    if(m21<0) a=-a;                             /* at beta -90 the matrix carries a-g */
  } else {
    a=Math.atan2(-m01,m11)/D2R; g=Math.atan2(-m20,m22)/D2R;
    if(g>=90||g<-90){ a+=180; b=180-b; g+=180; }
  }
  const w=v=>((v+180)%360+360)%360-180;
  return {alpha:((a%360)+360)%360, beta:w(b), gamma:w(g)};
}
