/* GENERATED from prototype/src/asterisms.js by tools/bundle_functions.mjs — edit the source, not this copy */
// asterisms.js — verified star catalog for drawing the 27 nakshatra asterisms
// (traditional Vedic star groups, NOT the 88 IAU constellations).
// ra/dec: J2000 in decimal degrees. m: visual magnitude.
// yogatara: index into stars[] of the junction star.
// lines: [i,j] index pairs sketching the traditional figure.
export const ASTERISMS = [
  { nak: "Ashwini", yogatara: 0, stars: [
      { name: "Sheratan (β Ari)", ra: 28.6600, dec: 20.8080, m: 2.64 },
      { name: "Mesarthim (γ Ari)", ra: 28.3825, dec: 19.2939, m: 3.88 },
      { name: "Hamal (α Ari)", ra: 31.7933, dec: 23.4624, m: 2.01 }
    ], lines: [[1, 0], [0, 2]] },

  { nak: "Bharani", yogatara: 2, stars: [
      { name: "35 Ari", ra: 40.8630, dec: 27.7071, m: 4.65 },
      { name: "Lilii Borea (39 Ari)", ra: 41.9772, dec: 29.2471, m: 4.52 },
      { name: "Bharani (41 Ari)", ra: 42.4959, dec: 27.2605, m: 3.61 }
    ], lines: [[0, 1], [1, 2], [2, 0]] },

  { nak: "Krittika", yogatara: 0, stars: [
      { name: "Alcyone (η Tau)", ra: 56.8712, dec: 24.1051, m: 2.85 },
      { name: "Atlas (27 Tau)", ra: 57.2906, dec: 24.0534, m: 3.62 },
      { name: "Electra (17 Tau)", ra: 56.2189, dec: 24.1133, m: 3.72 },
      { name: "Maia (20 Tau)", ra: 56.4567, dec: 24.3677, m: 3.87 },
      { name: "Merope (23 Tau)", ra: 56.5816, dec: 23.9484, m: 4.14 },
      { name: "Taygeta (19 Tau)", ra: 56.3021, dec: 24.4673, m: 4.30 }
    ], lines: [[1, 0], [0, 4], [4, 2], [2, 3], [3, 5], [3, 0]] },

  { nak: "Rohini", yogatara: 0, stars: [
      { name: "Aldebaran (α Tau)", ra: 68.9802, dec: 16.5093, m: 0.87 },
      { name: "Chamukuy (θ² Tau)", ra: 67.1656, dec: 15.8709, m: 3.40 },
      { name: "Prima Hyadum (γ Tau)", ra: 64.9483, dec: 15.6276, m: 3.65 },
      { name: "Secunda Hyadum (δ¹ Tau)", ra: 65.7337, dec: 17.5425, m: 3.77 },
      { name: "Ain (ε Tau)", ra: 67.1541, dec: 19.1804, m: 3.53 }
    ], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },

  { nak: "Mrigashira", yogatara: 0, stars: [
      { name: "Meissa (λ Ori)", ra: 83.7845, dec: 9.9342, m: 3.39 },
      { name: "φ¹ Ori", ra: 83.7052, dec: 9.4896, m: 4.39 },
      { name: "φ² Ori", ra: 84.2266, dec: 9.2907, m: 4.09 }
    ], lines: [[0, 1], [1, 2], [2, 0]] },

  { nak: "Ardra", yogatara: 0, stars: [
      { name: "Betelgeuse (α Ori)", ra: 88.7929, dec: 7.4071, m: 0.45 }
    ], lines: [] },

  { nak: "Punarvasu", yogatara: 1, stars: [
      { name: "Castor (α Gem)", ra: 113.6495, dec: 31.8883, m: 1.58 },
      { name: "Pollux (β Gem)", ra: 116.3292, dec: 28.0262, m: 1.16 }
    ], lines: [[0, 1]] },

  { nak: "Pushya", yogatara: 1, stars: [
      { name: "Asellus Borealis (γ Cnc)", ra: 130.8215, dec: 21.4685, m: 4.66 },
      { name: "Asellus Australis (δ Cnc)", ra: 131.1712, dec: 18.1543, m: 3.94 },
      { name: "θ Cnc", ra: 127.8989, dec: 18.0944, m: 5.33 }
    ], lines: [[0, 1], [1, 2], [2, 0]] },

  { nak: "Ashlesha", yogatara: 1, stars: [
      { name: "δ Hya", ra: 129.4140, dec: 5.7038, m: 4.14 },
      { name: "Ashlesha (ε Hya)", ra: 131.6938, dec: 6.4188, m: 3.38 },
      { name: "ρ Hya", ra: 132.1082, dec: 5.8378, m: 4.35 },
      { name: "η Hya", ra: 130.8062, dec: 3.3987, m: 4.30 },
      { name: "Minchir (σ Hya)", ra: 129.6893, dec: 3.3414, m: 4.45 }
    ], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },

  { nak: "Magha", yogatara: 0, stars: [
      { name: "Regulus (α Leo)", ra: 152.0930, dec: 11.9672, m: 1.36 },
      { name: "η Leo", ra: 151.8331, dec: 16.7627, m: 3.48 },
      { name: "Algieba (γ¹ Leo)", ra: 154.9931, dec: 19.8415, m: 2.01 },
      { name: "Adhafera (ζ Leo)", ra: 154.1726, dec: 23.4173, m: 3.43 },
      { name: "Rasalas (μ Leo)", ra: 148.1910, dec: 26.0070, m: 3.88 },
      { name: "Ras Elased (ε Leo)", ra: 146.4628, dec: 23.7743, m: 2.97 }
    ], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },

  { nak: "Purva Phalguni", yogatara: 0, stars: [
      { name: "Zosma (δ Leo)", ra: 168.5271, dec: 20.5237, m: 2.56 },
      { name: "Chertan (θ Leo)", ra: 168.5600, dec: 15.4296, m: 3.33 }
    ], lines: [[0, 1]] },

  { nak: "Uttara Phalguni", yogatara: 0, stars: [
      { name: "Denebola (β Leo)", ra: 177.2649, dec: 14.5721, m: 2.14 },
      { name: "93 Leo", ra: 176.9964, dec: 20.2189, m: 4.50 }
    ], lines: [[0, 1]] },

  { nak: "Hasta", yogatara: 3, stars: [
      { name: "Alchiba (α Crv)", ra: 182.1034, dec: -24.7289, m: 4.02 },
      { name: "Kraz (β Crv)", ra: 188.5968, dec: -23.3968, m: 2.65 },
      { name: "Gienah (γ Crv)", ra: 183.9516, dec: -17.5419, m: 2.58 },
      { name: "Algorab (δ Crv)", ra: 187.4661, dec: -16.5154, m: 2.94 },
      { name: "Minkar (ε Crv)", ra: 182.5312, dec: -22.6198, m: 3.02 }
    ], lines: [[2, 3], [3, 1], [1, 4], [4, 2], [4, 0]] },

  { nak: "Chitra", yogatara: 0, stars: [
      { name: "Spica (α Vir)", ra: 201.2982, dec: -11.1613, m: 0.98 }
    ], lines: [] },

  { nak: "Swati", yogatara: 0, stars: [
      { name: "Arcturus (α Boo)", ra: 213.9154, dec: 19.1824, m: -0.05 }
    ], lines: [] },

  { nak: "Vishakha", yogatara: 0, stars: [
      { name: "Zubenelgenubi (α² Lib)", ra: 222.7197, dec: -16.0418, m: 2.75 },
      { name: "Zubeneschamali (β Lib)", ra: 229.2517, dec: -9.3829, m: 2.61 },
      { name: "Zubenelhakrabi (γ Lib)", ra: 233.8816, dec: -14.7895, m: 3.91 },
      { name: "ι¹ Lib", ra: 228.0554, dec: -19.7917, m: 4.54 }
    ], lines: [[0, 1], [1, 2], [2, 3], [3, 0]] },

  { nak: "Anuradha", yogatara: 1, stars: [
      { name: "Acrab (β¹ Sco)", ra: 241.3593, dec: -19.8055, m: 2.56 },
      { name: "Dschubba (δ Sco)", ra: 240.0834, dec: -22.6217, m: 2.29 },
      { name: "Fang (π Sco)", ra: 239.7130, dec: -26.1141, m: 2.89 }
    ], lines: [[0, 1], [1, 2]] },

  { nak: "Jyeshtha", yogatara: 1, stars: [
      { name: "Alniyat (σ Sco)", ra: 245.2971, dec: -25.5928, m: 2.90 },
      { name: "Antares (α Sco)", ra: 247.3519, dec: -26.4320, m: 1.06 },
      { name: "Paikauhale (τ Sco)", ra: 248.9706, dec: -28.2160, m: 2.82 }
    ], lines: [[0, 1], [1, 2]] },

  { nak: "Mula", yogatara: 6, stars: [
      { name: "Larawag (ε Sco)", ra: 252.5412, dec: -34.2932, m: 2.29 },
      { name: "ζ² Sco", ra: 253.6460, dec: -42.3613, m: 3.62 },
      { name: "η Sco", ra: 258.0383, dec: -43.2392, m: 3.32 },
      { name: "Sargas (θ Sco)", ra: 264.3297, dec: -42.9978, m: 1.86 },
      { name: "ι¹ Sco", ra: 266.8962, dec: -40.1270, m: 2.99 },
      { name: "κ Sco", ra: 265.6220, dec: -39.0300, m: 2.39 },
      { name: "Shaula (λ Sco)", ra: 263.4022, dec: -37.1038, m: 1.62 },
      { name: "Lesath (υ Sco)", ra: 262.6910, dec: -37.2958, m: 2.70 }
    ], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },

  { nak: "Purva Ashadha", yogatara: 0, stars: [
      { name: "Kaus Media (δ Sgr)", ra: 275.2485, dec: -29.8281, m: 2.72 },
      { name: "Kaus Australis (ε Sgr)", ra: 276.0430, dec: -34.3846, m: 1.79 }
    ], lines: [[0, 1]] },

  { nak: "Uttara Ashadha", yogatara: 0, stars: [
      { name: "Nunki (σ Sgr)", ra: 283.8163, dec: -26.2967, m: 2.05 },
      { name: "Ascella (ζ Sgr)", ra: 285.6530, dec: -29.8801, m: 2.60 }
    ], lines: [[0, 1]] },

  { nak: "Shravana", yogatara: 1, stars: [
      { name: "Tarazed (γ Aql)", ra: 296.5649, dec: 10.6133, m: 2.72 },
      { name: "Altair (α Aql)", ra: 297.6958, dec: 8.8683, m: 0.76 },
      { name: "Alshain (β Aql)", ra: 298.8283, dec: 6.4068, m: 3.71 }
    ], lines: [[0, 1], [1, 2]] },

  { nak: "Dhanishta", yogatara: 1, stars: [
      { name: "Sualocin (α Del)", ra: 309.9095, dec: 15.9121, m: 3.77 },
      { name: "Rotanev (β Del)", ra: 309.3872, dec: 14.5951, m: 3.64 },
      { name: "γ² Del", ra: 311.6646, dec: 16.1243, m: 4.27 },
      { name: "δ Del", ra: 310.8647, dec: 15.0746, m: 4.43 }
    ], lines: [[1, 0], [0, 2], [2, 3], [3, 1]] },

  { nak: "Shatabhisha", yogatara: 0, stars: [
      { name: "Hydor (λ Aqr)", ra: 343.1536, dec: -7.5796, m: 3.73 },
      { name: "φ Aqr", ra: 348.5807, dec: -6.0490, m: 4.22 },
      { name: "χ Aqr", ra: 349.2123, dec: -7.7265, m: 4.93 },
      { name: "ψ¹ Aqr", ra: 348.9729, dec: -9.0877, m: 4.24 },
      { name: "ψ² Aqr", ra: 349.4759, dec: -9.1825, m: 4.41 },
      { name: "ψ³ Aqr", ra: 349.7403, dec: -9.6107, m: 4.99 }
    ], lines: [[0, 1], [1, 2], [2, 4], [4, 5], [5, 3], [3, 0]] },

  { nak: "Purva Bhadrapada", yogatara: 0, stars: [
      { name: "Markab (α Peg)", ra: 346.1902, dec: 15.2053, m: 2.49 },
      { name: "Scheat (β Peg)", ra: 345.9435, dec: 28.0828, m: 2.44 }
    ], lines: [[0, 1]] },

  { nak: "Uttara Bhadrapada", yogatara: 0, stars: [
      { name: "Algenib (γ Peg)", ra: 3.3090, dec: 15.1836, m: 2.83 },
      { name: "Alpheratz (α And)", ra: 2.0969, dec: 29.0904, m: 2.07 }
    ], lines: [[0, 1]] },

  { nak: "Revati", yogatara: 0, stars: [
      { name: "Revati (ζ Psc)", ra: 18.4329, dec: 7.5754, m: 5.21 },
      { name: "ε Psc", ra: 15.7359, dec: 7.8901, m: 4.27 },
      { name: "δ Psc", ra: 12.1706, dec: 7.5851, m: 4.44 }
    ], lines: [[0, 1], [1, 2]] }
];

/*
SOURCES & VERIFICATION (compiled 2026-08-30)

Coordinates and magnitudes
- Primary: HYG database v4.1 (github.com/astronexus/HYG-Database,
  hygdata_v41.csv, Hipparcos-derived J2000 positions). Every star above was
  extracted from this catalog by Bayer/Flamsteed designation + constellation.
- Cross-check 1: compiled literature/SIMBAD J2000 values for all 90 stars;
  agreement within ~0.01 deg everywhere.
- Cross-check 2 (independent spot checks, SIMBAD CDS ASCII service,
  ICRS ep=J2000): theta Cnc, phi-1 Ori, gamma Aqr — all matched HYG to the
  4th decimal place.
- Betelgeuse and Antares are variable; the listed magnitudes are catalog
  means (0.45, 1.06).

Nakshatra star compositions
- Wikipedia "Nakshatra" (list-of-27 table) confirmed the composition used for
  every entry: Ashwini beta+gamma Ari (alpha Ari added here — the classical
  3-star horse-head count per Colebrooke/Burgess), Bharani 35+39+41 Ari,
  Krittika Pleiades, Rohini Aldebaran+Hyades, Mrigashira lambda+phi Ori,
  Ardra Betelgeuse, Punarvasu Castor+Pollux, Pushya gamma+delta+theta Cnc,
  Ashlesha delta+epsilon+eta+rho+sigma Hya, Magha Regulus (drawn here with
  the full Leo sickle), Purva Phalguni delta+theta Leo, Uttara Phalguni
  Denebola (+93 Leo, the traditional 2nd star), Hasta the 5 Corvi stars,
  Chitra Spica, Swati Arcturus, Vishakha alpha+beta+gamma+iota Lib,
  Anuradha beta+delta+pi Sco, Jyeshtha alpha+sigma+tau Sco, Mula the
  Scorpius tail, Purva Ashadha delta+epsilon Sgr, Uttara Ashadha
  zeta+sigma Sgr, Shravana alpha+beta+gamma Aql, Dhanishta the Delphinus
  kite, Shatabhisha lambda Aqr region, Purva Bhadrapada alpha+beta Peg,
  Uttara Bhadrapada gamma Peg + alpha And, Revati zeta Psc.
- IAU proper names independently confirm three yogataras: 41 Ari is
  officially named "Bharani", epsilon Hya "Ashlesha", zeta Psc "Revati"
  (WGSN names, present in HYG v4.1).

Editorial choices (documented, one school followed where schools differ)
- Vishakha yogatara: alpha-2 Lib (common modern jyotisha usage); Burgess's
  Surya Siddhanta identifies iota Lib instead. Both stars included.
- Shatabhisha: the "hundred physicians" are ~100 faint stars with no
  canonical member list; yogatara lambda Aqr (Surya Siddhanta school; some
  modern lists use gamma Aqr/Sadachbia). Drawn here as lambda plus a
  representative ring of the neighboring water-stream stars
  (phi, chi, psi-1, psi-2, psi-3 Aqr).
- Mula: classical counts give 9-11 tail stars; drawn with 8 (mu-1 Sco
  omitted to stay within the 2-8 star budget), yogatara Shaula.
- Revati: classically 32 faint stars; drawn as the zeta-epsilon-delta Psc
  cord with yogatara zeta Psc.
- Uttara Ashadha yogatara: sigma Sgr (Nunki); a minority school uses
  zeta Sgr.
- Ashwini yogatara: beta Ari (Sheratan); some lists use alpha Ari.
*/
