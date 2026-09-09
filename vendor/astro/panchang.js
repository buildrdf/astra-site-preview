/* GENERATED from prototype/src/panchang.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ===================================================================
   PANCHANG AND DAILY GOCHARA
   -------------------------------------------------------------------
   The five limbs of the Vedic day, plus the two classical techniques
   that make a daily reading personal rather than sun-sign generic:

     Tara Bala  - the relationship between today's Moon nakshatra and
                  the nakshatra the Moon occupied at your birth
     Gochara    - where each of the nine grahas is transiting relative
                  to your Moon and your lagna

   Everything here is arithmetic on longitudes the ephemeris produced.
   Nothing is generated, and no interpretation is invented: the gochara
   tables are the standard Parashari ones. Schools differ, most visibly
   over Rahu and Ketu; where they do, that is stated in the app rather
   than hidden.
   =================================================================== */

const TITHI_NAME=["Pratipada","Dvitiya","Tritiya","Chaturthi","Panchami","Shashthi",
  "Saptami","Ashtami","Navami","Dashami","Ekadashi","Dvadashi","Trayodashi","Chaturdashi"];

const YOGA_NAME=["Vishkambha","Priti","Ayushman","Saubhagya","Shobhana","Atiganda",
  "Sukarman","Dhriti","Shula","Ganda","Vriddhi","Dhruva","Vyaghata","Harshana","Vajra",
  "Siddhi","Vyatipata","Variyana","Parigha","Shiva","Siddha","Sadhya","Shubha","Shukla",
  "Brahma","Indra","Vaidhriti"];

const KARANA_MOVABLE=["Bava","Balava","Kaulava","Taitila","Gara","Vanija","Vishti"];

const VARA=[["Sunday","Sun"],["Monday","Moon"],["Tuesday","Mars"],["Wednesday","Mercury"],
            ["Thursday","Jupiter"],["Friday","Venus"],["Saturday","Saturn"]];

/* the nine taras, counted from the birth nakshatra to today's */
const TARA=[
  ["Janma","mixed","Your own birth star. Traditionally a day to keep your own counsel rather than push."],
  ["Sampat","good","Traditionally associated with gain and things arriving."],
  ["Vipat","testing","Traditionally a day for care rather than new commitments."],
  ["Kshema","good","Traditionally associated with stability and ease."],
  ["Pratyari","testing","Traditionally a day where resistance is expected; go slowly."],
  ["Sadhaka","good","Traditionally the day for accomplishing what you set out to do."],
  ["Vadha","testing","Traditionally the most guarded of the nine. Avoid confrontation."],
  ["Mitra","good","Traditionally friendly; people tend to meet you halfway."],
  ["Ati Mitra","good","Traditionally the most supportive of the nine."]];

/* Classical gochara phala: the houses, counted from the natal Moon, in
   which each graha's transit is read as favourable. */
const GOCHARA_GOOD={
  Sun:[3,6,10,11], Moon:[1,3,6,7,10,11], Mars:[3,6,11],
  Mercury:[2,4,6,8,10,11], Jupiter:[2,5,7,9,11],
  Venus:[1,2,3,4,5,8,9,11,12], Saturn:[3,6,11],
  Rahu:[3,6,10,11], Ketu:[3,6,11]};

const norm=d=>((d%360)+360)%360;

/* Sun-Moon elongation drives four of the five limbs */
export function limbs(sunSid, moonSid){
  const e=norm(moonSid-sunSid);
  const ti=Math.floor(e/12);                 /* 0..29 */
  const paksha = ti<15 ? "Shukla" : "Krishna";
  const inPaksha = ti%15;                    /* 0..14 */
  const tithiName = inPaksha===14
    ? (paksha==="Shukla" ? "Purnima" : "Amavasya")
    : TITHI_NAME[inPaksha];
  const y=norm(sunSid+moonSid);
  const ki=Math.floor(e/6);                  /* 0..59 half-tithis */
  const karana = ki===0 ? "Kimstughna"
    : ki<=56 ? KARANA_MOVABLE[(ki-1)%7]
    : ["Shakuni","Chatushpada","Naga"][ki-57];
  return {
    tithi:{n:ti+1, inPaksha:inPaksha+1, paksha, name:tithiName,
           pct:(e%12)/12},
    yoga:{n:Math.floor(y/(360/27))+1, name:YOGA_NAME[Math.floor(y/(360/27))%27]},
    karana:{name:karana, vishti:karana==="Vishti"},
    elongation:e
  };
}

export function vara(date){
  const [name,lord]=VARA[date.getDay()];
  return {name, lord};
}

/* Count inclusively from the birth nakshatra to today's, then take the
   position in the nine-fold cycle. */
export function taraBala(natalNak, todayNak){
  const count=((todayNak-natalNak)%27+27)%27+1;
  const i=(count-1)%9;
  const [name,tone,note]=TARA[i];
  return {count, n:i+1, name, tone, note};
}

/* House of a transiting sign counted from a reference sign (1-12) */
export const houseFrom=(refSign,sign)=>((sign-refSign)%12+12)%12+1;

export const gocharaFavourable=(graha,houseFromMoon)=>
  (GOCHARA_GOOD[graha]||[]).includes(houseFromMoon);

/* Moon in the 8th from the natal Moon. A named low day in the tradition,
   not a catastrophe - the app should say so in those words. */
export const chandrashtama=houseFromMoon=>houseFromMoon===8;

export { GOCHARA_GOOD };
