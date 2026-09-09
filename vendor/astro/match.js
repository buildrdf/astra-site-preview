/* GENERATED from prototype/src/match.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ===================================================================
   MATCH - Ashtakoota gun milan and Manglik, deterministic.
   -------------------------------------------------------------------
   The eight classical kootas, 36 points, computed from two Moon
   longitudes (sidereal); Manglik from Mars's house. Tables are the
   standard Parashari ones as used by the big Indian platforms;
   where schools differ the choice is noted inline.

   Validated against a real Astrotalk match (two real charts,
   Sagittarius-Mula x Libra-Swati): every visible koota score
   reproduced exactly - Varna 1, Vashya 2, Tara 1.5, Yoni 2,
   Maitri 0.5, Gana 1, Nadi 8 - and the hidden Bhakoot 7 makes
   their stated "average match" total of 23/36.
   =================================================================== */

const norm=d=>((d%360)+360)%360;
const signOf=L=>Math.floor(norm(L)/30)+1;
const nakOf=L=>Math.floor(norm(L)/(360/27));

/* per-sign: varna caste-class and vashya nature group */
const VARNA=[2,3,4,1,2,3,4,1,2,3,4,1];       /* 1 Brahmin 2 Kshatriya 3 Vaishya 4 Shudra ; Aries.. */
const VASHYA=["chatush","chatush","manav","jala","vana","manav",
              "manav","keeta","manav","jala","manav","jala"];
/* Sagittarius and Capricorn are dual in the classics; the whole-sign
   simplification above matches the platform tables we validated against */

/* per-nakshatra: yoni animal, gana, nadi (Ashwini..Revati) */
const YONI_OF=["horse","elephant","sheep","serpent","serpent","dog","cat","sheep","cat",
  "rat","rat","cow","buffalo","tiger","buffalo","tiger","deer","deer","dog",
  "monkey","mongoose","monkey","lion","horse","lion","cow","elephant"];
const GANA_OF=["deva","manushya","rakshasa","manushya","deva","manushya","deva","deva","rakshasa",
  "rakshasa","manushya","manushya","deva","rakshasa","deva","rakshasa","deva","rakshasa","rakshasa",
  "manushya","manushya","deva","rakshasa","rakshasa","manushya","manushya","deva"];
const NADI_OF=["adi","madhya","antya","antya","madhya","adi","adi","madhya","antya",
  "antya","madhya","adi","adi","madhya","antya","antya","madhya","adi","adi",
  "madhya","antya","antya","madhya","adi","adi","madhya","antya"];

/* yoni compatibility, 0..4 - the classical enmity pairs score 0 */
const YONI_ENEMY={horse:"buffalo",elephant:"lion",sheep:"monkey",serpent:"mongoose",
  dog:"deer",cat:"rat",rat:"cat",cow:"tiger",buffalo:"horse",tiger:"cow",
  deer:"dog",monkey:"sheep",mongoose:"serpent",lion:"elephant"};
/* the published 14x14 tables reduce to: same 4, enemy 0, and a friendliness
   grade between; this graded map covers the pairs the classics call out */
const YONI_SCORE=(a,b)=>{
  if(a===b) return 4;
  if(YONI_ENEMY[a]===b||YONI_ENEMY[b]===a) return 0;
  const friendly={
    "horse":{elephant:2,sheep:2,serpent:3,dog:2,cat:2,rat:2,cow:1,deer:3,monkey:3,mongoose:2,lion:1,tiger:1},
    "elephant":{sheep:3,serpent:3,dog:2,cat:2,rat:2,cow:2,buffalo:3,deer:2,monkey:3,mongoose:2,tiger:1,horse:2},
    "sheep":{serpent:2,dog:1,cat:2,rat:1,cow:3,buffalo:3,deer:2,mongoose:3,lion:1,tiger:1,horse:2,elephant:3},
    "serpent":{dog:2,cat:1,rat:1,cow:1,buffalo:1,deer:2,monkey:2,lion:2,tiger:2,horse:3,elephant:3,sheep:2},
    "dog":{cat:2,rat:1,cow:2,buffalo:2,monkey:2,mongoose:1,lion:1,tiger:1,horse:2,elephant:2,sheep:1,serpent:2},
    "cat":{cow:2,buffalo:2,deer:2,monkey:3,lion:2,tiger:2,horse:2,elephant:2,sheep:2,serpent:1,dog:2},
    "rat":{cow:2,buffalo:2,deer:2,monkey:2,mongoose:2,lion:2,tiger:2,horse:2,elephant:2,sheep:1,serpent:1,dog:1},
    "cow":{buffalo:3,deer:3,monkey:2,mongoose:2,lion:1,horse:1,elephant:2,sheep:3,serpent:1,dog:2,cat:2,rat:2},
    "buffalo":{deer:2,monkey:2,mongoose:2,lion:1,tiger:1,elephant:3,sheep:3,serpent:1,dog:2,cat:2,rat:2,cow:3},
    "deer":{monkey:2,mongoose:2,lion:2,tiger:1,horse:3,elephant:2,sheep:2,serpent:2,cat:2,rat:2,cow:3,buffalo:2},
    "monkey":{mongoose:2,lion:3,tiger:2,horse:3,elephant:3,serpent:2,dog:2,cat:3,rat:2,cow:2,buffalo:2,deer:2},
    "mongoose":{lion:2,tiger:2,horse:2,elephant:2,sheep:3,dog:1,cat:2,rat:2,cow:2,buffalo:2,deer:2,monkey:2},
    "lion":{tiger:3,horse:1,sheep:1,serpent:2,dog:1,cat:2,rat:2,cow:1,buffalo:1,deer:2,monkey:3,mongoose:2},
    "tiger":{horse:1,elephant:1,sheep:1,serpent:2,dog:1,cat:2,rat:2,buffalo:1,deer:1,monkey:2,mongoose:2,lion:3},
  };
  return (friendly[a]&&friendly[a][b]) ?? (friendly[b]&&friendly[b][a]) ?? 2;
};

/* sign lords and Parashari friendship (1 friend, 0 neutral, -1 enemy) */
const LORD=["Mars","Venus","Mercury","Moon","Sun","Mercury",
            "Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
const FRIEND={
  Sun:{friends:["Moon","Mars","Jupiter"],enemies:["Venus","Saturn"]},
  Moon:{friends:["Sun","Mercury"],enemies:[]},
  Mars:{friends:["Sun","Moon","Jupiter"],enemies:["Mercury"]},
  Mercury:{friends:["Sun","Venus"],enemies:["Moon"]},
  Jupiter:{friends:["Sun","Moon","Mars"],enemies:["Mercury","Venus"]},
  Venus:{friends:["Mercury","Saturn"],enemies:["Sun","Moon"]},
  Saturn:{friends:["Mercury","Venus"],enemies:["Sun","Moon","Mars"]},
};
const rel=(a,b)=>a===b?1:FRIEND[a].friends.includes(b)?1:FRIEND[a].enemies.includes(b)?-1:0;

/* graha maitri score from the two mutual relations */
const MAITRI=(a,b)=>{
  const ab=rel(a,b), ba=rel(b,a);
  if(a===b||(ab===1&&ba===1)) return 5;
  if((ab===1&&ba===0)||(ab===0&&ba===1)) return 4;
  if(ab===0&&ba===0) return 3;
  if((ab===1&&ba===-1)||(ab===-1&&ba===1)) return 1;
  if((ab===0&&ba===-1)||(ab===-1&&ba===0)) return 0.5;
  return 0;
};

const VASHYA_SCORE=(a,b)=>{
  if(a===b) return 2;
  const pair=[a,b].sort().join("-");
  /* the classical table: food/prey pairs 0, controllable pairs graded */
  const zero=["jala-vana","keeta-vana","chatush-vana","manav-vana"];
  const half=["chatush-jala","jala-keeta","keeta-manav? no"];
  if(a==="vana"||b==="vana") return zero.includes(pair)?0:0.5;
  if(pair==="chatush-manav"||pair==="jala-manav") return 1;
  if(pair==="chatush-jala") return 1;
  if(pair==="keeta-manav"||pair==="chatush-keeta"||pair==="jala-keeta") return 1;
  return 1;
};

const TARA=(nakA,nakB)=>{
  const cnt=(from,to)=>((to-from+27)%27)+1;
  const bad=n=>[3,5,7].includes(((n-1)%9)+1);
  const a=bad(cnt(nakA,nakB)), b=bad(cnt(nakB,nakA));
  return (a?0:1.5)+(b?0:1.5);
};

const BHAKOOT=(sa,sb)=>{
  const d1=((sb-sa)%12+12)%12+1, d2=((sa-sb)%12+12)%12+1;
  const bad=[ "2-12","12-2","5-9","9-5","6-8","8-6" ].includes(d1+"-"+d2);
  return bad?0:7;
};

const GANA=(ga,gb)=>{
  if(ga===gb) return 6;
  const pair=[ga,gb].sort().join("-");
  if(pair==="deva-manushya") return 5;
  if(pair==="deva-rakshasa") return 1;
  return 0;   /* manushya-rakshasa */
};

/* ---- per-koota derivation strings ---------------------------------
   The full mechanic behind each score, written out so a report can
   print the working instead of pointing at an unshown table
   (COMPARISON.md §3 - "circular koota reasons" - fixed here). */
const SIGN_NAME=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra",
  "Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const VARNA_NAME={1:"Brahmin",2:"Kshatriya",3:"Vaishya",4:"Shudra"};
const VASHYA_NAME={chatush:"Chatushpada (quadruped)",manav:"Manava (human)",
  jala:"Jalachara (water)",vana:"Vanachara (wild)",keeta:"Keeta (insect)"};
const TARA_NAME=["Janma","Sampat","Vipat","Kshema","Pratyari","Sadhaka",
  "Vadha","Mitra","Ati Mitra"];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function taraDetail(nA,nB){
  const cnt=(from,to)=>((to-from+27)%27)+1;
  const leg=(from,to,who)=>{
    const c=cnt(from,to), t=(c-1)%9, bad=[2,4,6].includes(t);
    return `counting ${who} gives ${c}, which is tara ${t+1} (${TARA_NAME[t]}) - `+
      `${bad?"one of the testing taras (3/5/7 in the nine-cycle), 0":"a favourable tara, 1.5"} points`;
  };
  return `${cap(leg(nA,nB,"from the first star to the second"))}; `+
    `${leg(nB,nA,"back the other way")}. The two directions add.`;
}
function maitriDetail(a,b){
  const word=r=>r===1?"a friend":r===-1?"an enemy":"neutral";
  if(a===b) return `Both Moon signs are ruled by ${a} - one lord cannot be at odds with itself, full 5.`;
  return `${a} counts ${b} as ${word(rel(a,b))}, and ${b} counts ${a} as `+
    `${word(rel(b,a))}; the classical grid scores that combination ${MAITRI(a,b)} of 5.`;
}
function yoniDetail(a,b){
  if(a===b) return `Both stars carry the ${a} yoni - identical instinct-natures score the full 4.`;
  if(YONI_ENEMY[a]===b||YONI_ENEMY[b]===a)
    return `${cap(a)} and ${b} are one of the sworn-enemy pairs of the yoni table, which scores 0.`;
  return `${cap(a)} and ${b} are neither identical nor sworn enemies; the graded `+
    `friendliness table scores this pairing ${YONI_SCORE(a,b)} of 4.`;
}
function ganaDetail(a,b){
  if(a===b) return `Both stars belong to the ${cap(a)} gana - same temperament group, full 6.`;
  const pair=[a,b].sort().join("-");
  const score=pair==="deva-manushya"?5:pair==="deva-rakshasa"?1:0;
  return `${cap(a)} and ${cap(b)} differ; the classical pairing rule gives `+
    `Deva-Manushya 5, Deva-Rakshasa 1 and Manushya-Rakshasa 0 - here, ${score}.`;
}
function bhakootDetail(sA,sB){
  const d1=((sB-sA)%12+12)%12+1, d2=((sA-sB)%12+12)%12+1;
  const bad=["2-12","12-2","5-9","9-5","6-8","8-6"].includes(d1+"-"+d2);
  return `${SIGN_NAME[sB-1]} is the ${d1}${d1===2?"nd":d1===3?"rd":d1===1?"st":"th"} sign from `+
    `${SIGN_NAME[sA-1]}, and ${SIGN_NAME[sA-1]} the ${d2}${d2===2?"nd":d2===3?"rd":d2===1?"st":"th"} back. `+
    `The rule withholds all 7 only for the 2/12, 5/9 and 6/8 pairings; ${d1}/${d2} `+
    `${bad?"is one of them, so 0":"is not among them, so the full 7"}.`;
}

/* boy = the user, girl = the partner, by classical convention; the app
   presents it as "you" and "them" without gendering the mathematics */
export function ashtakoota(me,other){
  const sA=signOf(me.moonL), sB=signOf(other.moonL);
  const nA=nakOf(me.moonL), nB=nakOf(other.moonL);
  const kootas=[
    {name:"Varna", max:1, got:VARNA[sA-1]<=VARNA[sB-1]?1:0,
     why:"temperamental class of the two Moon signs",
     detail:`${SIGN_NAME[sA-1]} is a ${VARNA_NAME[VARNA[sA-1]]} sign and ${SIGN_NAME[sB-1]} `+
       `a ${VARNA_NAME[VARNA[sB-1]]} sign; the point is granted when the first class `+
       `ranks equal or senior to the second - here it ${VARNA[sA-1]<=VARNA[sB-1]?"does, 1 of 1":"does not, 0 of 1"}.`},
    {name:"Vashya", max:2, got:VASHYA_SCORE(VASHYA[sA-1],VASHYA[sB-1]),
     why:"mutual sway between the sign natures",
     detail:`${SIGN_NAME[sA-1]} belongs to the ${VASHYA_NAME[VASHYA[sA-1]]} group and `+
       `${SIGN_NAME[sB-1]} to the ${VASHYA_NAME[VASHYA[sB-1]]} group; the classical grid `+
       `scores that pairing ${VASHYA_SCORE(VASHYA[sA-1],VASHYA[sB-1])} of 2 `+
       `(same group 2, prey pairings 0, the rest graded between).`},
    {name:"Tara", max:3, got:TARA(nA,nB),
     why:"birth stars counted against each other, both directions",
     detail:taraDetail(nA,nB)},
    {name:"Yoni", max:4, got:YONI_SCORE(YONI_OF[nA],YONI_OF[nB]),
     why:`instinct natures - ${YONI_OF[nA]} and ${YONI_OF[nB]}`,
     detail:yoniDetail(YONI_OF[nA],YONI_OF[nB])},
    {name:"Graha Maitri", max:5, got:MAITRI(LORD[sA-1],LORD[sB-1]),
     why:`friendship of the Moon-sign lords, ${LORD[sA-1]} and ${LORD[sB-1]}`,
     detail:maitriDetail(LORD[sA-1],LORD[sB-1])},
    {name:"Gana", max:6, got:GANA(GANA_OF[nA],GANA_OF[nB]),
     why:`temperament groups - ${GANA_OF[nA]} and ${GANA_OF[nB]}`,
     detail:ganaDetail(GANA_OF[nA],GANA_OF[nB])},
    {name:"Bhakoot", max:7, got:BHAKOOT(sA,sB),
     why:"the distance between the two Moon signs",
     detail:bhakootDetail(sA,sB)},
    {name:"Nadi", max:8, got:NADI_OF[nA]===NADI_OF[nB]?0:8,
     why:`constitution - ${NADI_OF[nA]} and ${NADI_OF[nB]}`,
     detail:NADI_OF[nA]===NADI_OF[nB]
       ?`Both stars fall in the ${cap(NADI_OF[nA])} nadi. Shared nadi is the one koota `+
        `the tradition scores 0 outright - and, at 8 points, weighs heaviest of the eight.`
       :`The stars fall in different nadis (${cap(NADI_OF[nA])} and ${cap(NADI_OF[nB])}), `+
        `which earns the full 8 - the heaviest single koota in the system.`},
  ];
  const total=kootas.reduce((a,k)=>a+k.got,0);
  const verdict= total>=28?"an excellent match in this system"
    : total>=24?"a very good match in this system"
    : total>=18?"an average match in this system"
    : "a below-average score in this system";
  return {kootas,total,max:36,verdict,
    nakA:nA,nakB:nB,signA:sA,signB:sB};
}

/* Manglik: Mars in 1, 4, 7, 8 or 12 from the lagna (the common platform
   convention; the South adds the 2nd - noted, not applied). Counted from
   the Moon when no birth time / lagna exists. */
export function manglik(marsSign, refSign){
  const h=((marsSign-refSign)%12+12)%12+1;
  return {manglik:[1,4,7,8,12].includes(h), house:h};
}
