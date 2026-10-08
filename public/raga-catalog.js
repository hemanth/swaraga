import { MELAKARTA_NAMES, MELAKARTA_ALIASES, JANYA_ROWS, CORE_ALIASES } from './raga-lexicon.js';
import { WIKI_RAGA_ROWS, WIKI_MELAKARTA_ALIASES } from './raga-wiki-lexicon.js';

/**
 * Canonical 12 Swarasthanas of Indian Classical Music (Hindustani & Carnatic)
 * Indexed by semitone (0 to 11) and cent offset from Shadja (Sa = 0 cents).
 */
export const SWARA_TABLE = [
  { index: 0, id: 'S', hindustani: 'Shadja (Sa)', carnatic: 'Shadjam (Sa)', cents: 0, short: 'Sa', variant: 'achala' },
  { index: 1, id: 'r1', hindustani: 'Komal Rishabh (re)', carnatic: 'Shuddha Rishabham (R1)', cents: 100, short: 're', variant: 'komal' },
  { index: 2, id: 'R2', hindustani: 'Shuddha Rishabh (Re)', carnatic: 'Chatushruti Rishabham (R2)', cents: 200, short: 'Re', variant: 'shuddha' },
  { index: 3, id: 'g2', hindustani: 'Komal Gandhar (ga)', carnatic: 'Sadharana Gandharam (G2)', cents: 300, short: 'ga', variant: 'komal' },
  { index: 4, id: 'G3', hindustani: 'Shuddha Gandhar (Ga)', carnatic: 'Antara Gandharam (G3)', cents: 400, short: 'Ga', variant: 'shuddha' },
  { index: 5, id: 'M1', hindustani: 'Shuddha Madhyam (Ma)', carnatic: 'Shuddha Madhyamam (M1)', cents: 500, short: 'Ma', variant: 'shuddha' },
  { index: 6, id: 'M2', hindustani: 'Teevra Madhyam (Ma#)', carnatic: 'Prati Madhyamam (M2)', cents: 600, short: 'Ma#', variant: 'teevra' },
  { index: 7, id: 'P', hindustani: 'Pancham (Pa)', carnatic: 'Panchamam (Pa)', cents: 700, short: 'Pa', variant: 'achala' },
  { index: 8, id: 'd1', hindustani: 'Komal Dhaivat (dha)', carnatic: 'Shuddha Dhaivatam (D1)', cents: 800, short: 'dha', variant: 'komal' },
  { index: 9, id: 'D2', hindustani: 'Shuddha Dhaivat (Dha)', carnatic: 'Chatushruti Dhaivatam (D2)', cents: 900, short: 'Dha', variant: 'shuddha' },
  { index: 10, id: 'n2', hindustani: 'Komal Nishad (ni)', carnatic: 'Kaisiki Nishadam (N2)', cents: 1000, short: 'ni', variant: 'komal' },
  { index: 11, id: 'N3', hindustani: 'Shuddha Nishad (Ni)', carnatic: 'Kakali Nishadam (N3)', cents: 1100, short: 'Ni', variant: 'shuddha' }
];

export const THAAT_FAMILIES = {
  Kalyan: 'All shuddha swaras except Teevra Madhyam (M2): S R2 G3 M2 P D2 N3',
  Bilawal: 'All shuddha swaras (major diatonic equivalent): S R2 G3 M1 P D2 N3',
  Khamaj: 'Komal Nishad (n2) in descent with Shuddha Nishad (N3) in ascent: S R2 G3 M1 P D2 n2/N3',
  Bhairav: 'Komal Rishabh (r1) and Komal Dhaivat (d1) with Shuddha Gandhar (G3) and Shuddha Nishad (N3): S r1 G3 M1 P d1 N3',
  Poorvi: 'Komal Rishabh (r1), Komal Dhaivat (d1), and Teevra Madhyam (M2): S r1 G3 M2 P d1 N3',
  Kafi: 'Komal Gandhar (g2) and Komal Nishad (n2) with Shuddha Re and Dha: S R2 g2 M1 P D2 n2',
  Asavari: 'Komal Gandhar (g2), Komal Dhaivat (d1), and Komal Nishad (n2): S R2 g2 M1 P d1 n2',
  Bhairavi: 'All four komal swaras (r1, g2, d1, n2) with Shuddha Madhyam (M1): S r1 g2 M1 P d1 n2',
  Todi: 'Komal Rishabh (r1), Komal Gandhar (g2), Teevra Madhyam (M2), Komal Dhaivat (d1), Shuddha Nishad (N3): S r1 g2 M2 P d1 N3',
  Marwa: 'Komal Rishabh (r1) and Teevra Madhyam (M2) with Shuddha Dhaivat (D2) and Shuddha Nishad (N3): S r1 G3 M2 P D2 N3'
};

// Canonical swara sets of each Thaat and its equivalent Melakarta
export const THAAT_SCALES = {
  Kalyan: { swaras: ['S', 'R2', 'G3', 'M2', 'P', 'D2', 'N3'], melakarta: 65 },
  Bilawal: { swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3'], melakarta: 29 },
  Khamaj: { swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'n2'], melakarta: 28 },
  Bhairav: { swaras: ['S', 'r1', 'G3', 'M1', 'P', 'd1', 'N3'], melakarta: 15 },
  Poorvi: { swaras: ['S', 'r1', 'G3', 'M2', 'P', 'd1', 'N3'], melakarta: 51 },
  Kafi: { swaras: ['S', 'R2', 'g2', 'M1', 'P', 'D2', 'n2'], melakarta: 22 },
  Asavari: { swaras: ['S', 'R2', 'g2', 'M1', 'P', 'd1', 'n2'], melakarta: 20 },
  Bhairavi: { swaras: ['S', 'r1', 'g2', 'M1', 'P', 'd1', 'n2'], melakarta: 8 },
  Todi: { swaras: ['S', 'r1', 'g2', 'M2', 'P', 'd1', 'N3'], melakarta: 45 },
  Marwa: { swaras: ['S', 'r1', 'G3', 'M2', 'P', 'D2', 'N3'], melakarta: 53 }
};

export const CORE_RAGA_CATALOG = [
  {
    id: 'yaman',
    name: 'Raga Yaman',
    carnaticEquivalent: 'Mechakalyani (Melakarta 65)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Kalyan',
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras: ['S', 'R2', 'G3', 'M2', 'P', 'D2', 'N3'],
    varjya: ['r1', 'g2', 'M1', 'd1', 'n2'],
    aroha: 'N3 R2 G3 M2 D2 N3 S',
    avaroha: 'S N3 D2 P M2 G3 R2 S',
    pakad: 'N3 R2 G3, R2 G3 M2 P, M2 D2 N3 S, P R2 G3 R2 S',
    pakadNgrams: ['N3 R2 G3', 'R2 G3 M2', 'G3 M2 P', 'M2 P D2', 'P D2 N3', 'M2 D2 N3', 'P R2 G3', 'G3 R2 S'],
    vadi: 'G3',
    samvadi: 'N3',
    nyasa: ['G3', 'R2', 'N3', 'P'],
    prahar: 'Early Night (1st Prahar of Night, 6 PM – 9 PM)',
    praharKey: 'early_night',
    rasa: 'Shringara & Bhakti — serene, auspicious, luminous evening devotion',
    gamakaProfile: 'Meend glides from P to R2 (P->R2->G3) and lower-octave N3 entry avoiding direct S in ascent',
    sampleFile: '/samples/raga-yaman.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=x9DKjCxzDQg',
    vocalSource: 'Human Vocal (C# / Kali Ek) — Aroh, Avroh & Pakad (0:15–0:40)'
  },
  {
    id: 'bhairav',
    name: 'Raga Bhairav',
    carnaticEquivalent: 'Mayamalavagowla (Melakarta 15)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Bhairav',
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras: ['S', 'r1', 'G3', 'M1', 'P', 'd1', 'N3'],
    varjya: ['R2', 'g2', 'M2', 'D2', 'n2'],
    aroha: 'S r1 G3 M1 P d1 N3 S',
    avaroha: 'S N3 d1 P M1 G3 r1 S',
    pakad: 'G3 M1 d1 d1 P, G3 M1 r1 r1 S, N3 S r1 S',
    pakadNgrams: ['S r1 G3', 'r1 G3 M1', 'G3 M1 P', 'M1 P d1', 'P d1 N3', 'd1 P M1', 'P M1 G3', 'M1 G3 r1', 'G3 r1 S', 'G3 M1 d1', 'M1 d1 P'],
    vadi: 'd1',
    samvadi: 'r1',
    nyasa: ['r1', 'd1', 'M1', 'P'],
    prahar: 'Dawn / Early Morning Sandhiprakash (5 AM – 8 AM)',
    praharKey: 'dawn_sandhiprakash',
    rasa: 'Gambhir, Shanta & Adbhuta — solemn, awe-inspiring, meditative awakening',
    gamakaProfile: 'Signature slow symmetrical Andolan (microtonal oscillation) on Komal Dha (d1) and Komal Re (r1)',
    sampleFile: '/samples/raga-bhairav.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=TSF6FihBCaQ',
    vocalSource: 'Human Vocal (G# / Kali Char) — Aroh & Avroh (0:00–0:28)'
  },
  {
    id: 'bhupali',
    name: 'Raga Bhupali',
    carnaticEquivalent: 'Mohanam (Janya of Harikambhoji / Kalyani)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Kalyan',
    jati: 'Audava-Audava (5-note Pentatonic)',
    swaras: ['S', 'R2', 'G3', 'P', 'D2'],
    varjya: ['r1', 'g2', 'M1', 'M2', 'd1', 'n2', 'N3'],
    aroha: 'S R2 G3 P D2 S',
    avaroha: 'S D2 P G3 R2 S',
    pakad: 'G3 R2 S D2, S R2 G3, P G3 D2 P G3 R2 S',
    pakadNgrams: ['S R2 G3', 'R2 G3 P', 'G3 P D2', 'P D2 S', 'S D2 P', 'D2 P G3', 'P G3 R2', 'G3 R2 S'],
    vadi: 'G3',
    samvadi: 'D2',
    nyasa: ['G3', 'R2', 'P', 'S'],
    prahar: 'Early Night (1st Prahar of Night, 6 PM – 9 PM)',
    praharKey: 'early_night',
    rasa: 'Shanta & Prasanna — tranquil, pure, expansive pentatonic clarity',
    gamakaProfile: 'Clean pentatonic glides (Meend from D2 to G3 and P to G3); strictly omits both Madhyam and Nishad',
    sampleFile: '/samples/raga-bhupali.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=D4jFaFDHa5g',
    vocalSource: 'Human Vocal (B) — Aaroh, Avroh & Pakad (0:16–0:43)'
  },
  {
    id: 'malkauns',
    name: 'Raga Malkauns',
    carnaticEquivalent: 'Hindolam (Janya of Natabhairavi)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Bhairavi',
    jati: 'Audava-Audava (5-note Pentatonic)',
    swaras: ['S', 'g2', 'M1', 'd1', 'n2'],
    varjya: ['r1', 'R2', 'G3', 'M2', 'P', 'D2', 'N3'],
    aroha: 'n2 S g2 M1 d1 n2 S',
    avaroha: 'S n2 d1 M1 g2 M1 g2 S',
    pakad: 'M1 g2 M1 d1 n2 d1, M1 g2 S',
    pakadNgrams: ['S g2 M1', 'g2 M1 d1', 'M1 d1 n2', 'd1 n2 S', 'S n2 d1', 'n2 d1 M1', 'd1 M1 g2', 'M1 g2 S'],
    vadi: 'M1',
    samvadi: 'S',
    nyasa: ['M1', 'g2', 'd1', 'S'],
    prahar: 'Late Night / Midnight (3rd Prahar of Night, 12 AM – 3 AM)',
    praharKey: 'late_night',
    rasa: 'Veera & Gambhir — deep, mystical, fearless midnight introspection',
    gamakaProfile: 'Slow heavy Meend and oscillation on g2, M1, and d1; completely omits Re and Pa (Madhyam acts as central pivot)',
    sampleFile: '/samples/raga-malkauns.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=skkrjRDcwXw',
    vocalSource: 'Human Vocal (C / Safed Ek) — Aroh, Avroh & Pakad (0:00–0:28)'
  },
  {
    id: 'darbari_kanada',
    name: 'Raga Darbari Kanada',
    carnaticEquivalent: 'Darbari Kanada (Adopted in Carnatic)',
    tradition: 'Hindustani Classical',
    thaat: 'Asavari',
    jati: 'Sampurna-Sampurna Vakra (7 notes)',
    swaras: ['S', 'R2', 'g2', 'M1', 'P', 'd1', 'n2'],
    varjya: ['r1', 'G3', 'M2', 'D2', 'N3'],
    aroha: 'S R2 g2 M1 P d1 n2 S',
    avaroha: 'S d1 n2 P, M1 P g2 M1 R2 S',
    pakad: 'R2 g2 R2 S, d1 n2 P, M1 P g2 M1 R2 S',
    pakadNgrams: ['S R2 g2', 'R2 g2 M1', 'R2 g2 R2', 'd1 n2 P', 'g2 M1 R2', 'M1 R2 S', 'n2 P M1', 'P g2 M1'],
    vadi: 'R2',
    samvadi: 'P',
    nyasa: ['R2', 'P', 'S'],
    prahar: 'Late Night / Midnight (3rd Prahar of Night, 11 PM – 2 AM)',
    praharKey: 'late_night',
    rasa: 'Karuna & Gambhir — regal, majestic, deeply contemplative courtly gravity',
    gamakaProfile: 'Wide, slow horizontal Andolan on Komal Gandhar (g2) and Komal Dhaivat (d1), plus Vakra phrase g2-M1-R2-S and d1-n2-P',
    sampleFile: '/samples/raga-darbari-kanada.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=TxORN-ZnBY4',
    vocalSource: 'Human Vocal (C / Safed Ek) — Aroh, Avroh & Pakar (0:32–1:00)'
  },
  {
    id: 'hamsadhwani',
    name: 'Raga Hamsadhwani',
    carnaticEquivalent: 'Hamsadhwani (Created by Ramaswami Dikshitar)',
    tradition: 'Carnatic & Hindustani Dual',
    thaat: 'Bilawal',
    jati: 'Audava-Audava (5-note Pentatonic)',
    swaras: ['S', 'R2', 'G3', 'P', 'N3'],
    varjya: ['r1', 'g2', 'M1', 'M2', 'd1', 'D2', 'n2'],
    aroha: 'S R2 G3 P N3 S',
    avaroha: 'S N3 P G3 R2 S',
    pakad: 'G3 P N3 P G3 R2, G3 R2 N3 P S',
    pakadNgrams: ['S R2 G3', 'R2 G3 P', 'G3 P N3', 'P N3 S', 'S N3 P', 'N3 P G3', 'P G3 R2', 'G3 R2 S'],
    vadi: 'R2',
    samvadi: 'P',
    nyasa: ['R2', 'G3', 'P', 'S'],
    prahar: 'Early Evening / Auspicious Concert Opener (6 PM – 9 PM)',
    praharKey: 'early_night',
    rasa: 'Utsaha & Mangala — bright, celebratory, crisp and uplifting',
    gamakaProfile: 'Sparkling Kampita and Sphurita ornamentations on R2, G3, and N3; strictly omits Madhyam and Dhaivat',
    sampleFile: '/samples/raga-hamsadhwani.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=AgCar9hWWas',
    vocalSource: 'Human Vocal (G / Pancham) — Moorchana & Alapana (0:24–0:49)'
  },
  {
    id: 'bhimpalasi',
    name: 'Raga Bhimpalasi',
    carnaticEquivalent: 'Abheri / Karnataka Devagandhari',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Kafi',
    jati: 'Audava-Sampurna (5 up, 7 down)',
    swaras: ['S', 'R2', 'g2', 'M1', 'P', 'D2', 'n2'],
    varjya: ['r1', 'G3', 'M2', 'd1', 'N3'],
    aroha: 'n2 S g2 M1 P n2 S',
    avaroha: 'S n2 D2 P M1 g2 R2 S',
    pakad: 'n2 S M1, M1 g2 P M1, g2 M1 g2 R2 S',
    pakadNgrams: ['n2 S g2', 'g2 M1 P', 'P M1 g2', 'M1 g2 R2', 'g2 R2 S'],
    vadi: 'M1',
    samvadi: 'S',
    nyasa: ['M1', 'P', 'g2', 'S'],
    prahar: 'Late Afternoon (3rd Prahar of Day, 1 PM – 4 PM)',
    praharKey: 'afternoon',
    rasa: 'Shringara & Viraha — tender, yearning afternoon warmth',
    gamakaProfile: 'Omits Re and Dha in Aroha (ascending n2-S-g2-M1-P-n2-S) while touching D2 and R2 in Avaroha descent with Meend from P to g2',
    sampleFile: null
  },
  {
    id: 'todi',
    name: 'Raga Miyan ki Todi',
    carnaticEquivalent: 'Shubhapantuvarali (Melakarta 45)',
    tradition: 'Hindustani Classical',
    thaat: 'Todi',
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras: ['S', 'r1', 'g2', 'M2', 'P', 'd1', 'N3'],
    varjya: ['R2', 'G3', 'M1', 'D2', 'n2'],
    aroha: 'S r1 g2 M2 P d1 N3 S',
    avaroha: 'S N3 d1 P M2 g2 r1 S',
    pakad: 'd1 P M2 g2 r1 g2 r1 S, r1 g2 M2 d1 N3 S',
    pakadNgrams: ['r1 g2 M2', 'M2 d1 N3', 'M2 g2 r1', 'g2 r1 S', 'd1 P M2'],
    vadi: 'd1',
    samvadi: 'g2',
    nyasa: ['g2', 'r1', 'd1', 'S'],
    prahar: 'Late Morning (2nd Prahar of Day, 9 AM – 12 PM)',
    praharKey: 'late_morning',
    rasa: 'Karuna & Bhakti — poignant, prayerful, intensely expressive humility',
    gamakaProfile: 'Delicate microtonal oscillation on Komal Ga (g2) and Komal Re (r1) paired with Teevra Madhyam (M2)',
    sampleFile: null
  },
  {
    id: 'bhairavi',
    name: 'Raga Bhairavi',
    carnaticEquivalent: 'Hanumatodi (Melakarta 8) / Sindhubhairavi',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Bhairavi',
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras: ['S', 'r1', 'g2', 'M1', 'P', 'd1', 'n2'],
    varjya: ['R2', 'G3', 'M2', 'D2', 'N3'],
    aroha: 'S r1 g2 M1 P d1 n2 S',
    avaroha: 'S n2 d1 P M1 g2 r1 S',
    pakad: 'M1 g2 r1 S, d1 n2 S r1 g2 M1 P',
    pakadNgrams: ['S r1 g2', 'r1 g2 M1', 'M1 g2 r1', 'g2 r1 S', 'P d1 n2'],
    vadi: 'M1',
    samvadi: 'S',
    nyasa: ['M1', 'P', 'r1', 'S'],
    prahar: 'Morning / Concert Finale (Sarva-Kaalik)',
    praharKey: 'dawn_sandhiprakash',
    rasa: 'Bhakti & Karuna — sweet, soulful, devotional culmination',
    gamakaProfile: 'All four komal swaras (r1, g2, d1, n2) with fluid slides across r1-g2-M1 and d1-n2-S',
    sampleFile: null
  },
  {
    id: 'puriya_dhanashri',
    name: 'Raga Puriya Dhanashri',
    carnaticEquivalent: 'Kamavardhini / Pantuvarali (Melakarta 51)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Poorvi',
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras: ['S', 'r1', 'G3', 'M2', 'P', 'd1', 'N3'],
    varjya: ['R2', 'g2', 'M1', 'D2', 'n2'],
    aroha: 'N3 r1 G3 M2 P d1 N3 S',
    avaroha: 'S N3 d1 P M2 G3 M2 r1 G3 r1 S',
    pakad: 'N3 r1 G3, M2 r1 G3, M2 d1 N3 d1 P, M2 G3 M2 r1 G3 r1 S',
    pakadNgrams: ['N3 r1 G3', 'M2 r1 G3', 'M2 d1 N3', 'd1 P M2', 'G3 r1 S'],
    vadi: 'P',
    samvadi: 'r1',
    nyasa: ['P', 'G3', 'r1', 'S'],
    prahar: 'Dusk / Sunset Sandhiprakash (5 PM – 7 PM)',
    praharKey: 'dusk_sandhiprakash',
    rasa: 'Gambhir & Vairagya — twilight intensity, golden dusk reflection',
    gamakaProfile: 'Chromatic tension between r1, G3, M2, and d1 with signature M2-G3-M2-r1-G3-r1-S cadence',
    sampleFile: null
  },
  {
    id: 'desh',
    name: 'Raga Desh',
    carnaticEquivalent: 'Desh / Kedaram-family Janya',
    tradition: 'Hindustani Classical',
    thaat: 'Khamaj',
    jati: 'Audava-Sampurna (5 up, 7 down)',
    swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'n2', 'N3'],
    varjya: ['r1', 'g2', 'M2', 'd1'],
    aroha: 'S R2 M1 P N3 S',
    avaroha: 'S n2 D2 P M1 G3 R2 G3 N3 S',
    pakad: 'R2 M1 P N3 S, R2 n2 D2 P, M1 G3 R2 G3 N3 S',
    pakadNgrams: ['R2 M1 P', 'M1 P N3', 'n2 D2 P', 'M1 G3 R2', 'R2 G3 N3'],
    vadi: 'R2',
    samvadi: 'P',
    nyasa: ['R2', 'P', 'N3', 'S'],
    prahar: 'Late Evening / Night (2nd Prahar of Night, 9 PM – 12 AM)',
    praharKey: 'early_night',
    rasa: 'Shringara & Utsaha — romantic, lyrical, monsoon breeze',
    gamakaProfile: 'Uses Shuddha Nishad (N3) in ascending R2-M1-P-N3-S and Komal Nishad (n2) in descending S-n2-D2-P-M1-G3-R2',
    sampleFile: null
  },
  {
    id: 'bageshri',
    name: 'Raga Bageshri',
    carnaticEquivalent: 'Sriranjani (Janya of Kharaharapriya)',
    tradition: 'Hindustani & Carnatic Dual',
    thaat: 'Kafi',
    jati: 'Audava-Sampurna (5/6 up, 7 down)',
    swaras: ['S', 'R2', 'g2', 'M1', 'P', 'D2', 'n2'],
    varjya: ['r1', 'G3', 'M2', 'd1', 'N3'],
    aroha: 'n2 S g2 M1 D2 n2 S',
    avaroha: 'S n2 D2 M1 P D2 g2 M1 g2 R2 S',
    pakad: 'D2 n2 S, M1 D2 n2 D2, M1 P D2 g2 M1 g2 R2 S',
    pakadNgrams: ['g2 M1 D2', 'M1 D2 n2', 'M1 P D2', 'D2 g2 M1', 'g2 R2 S'],
    vadi: 'M1',
    samvadi: 'S',
    nyasa: ['M1', 'D2', 'g2', 'S'],
    prahar: 'Midnight (2nd/3rd Prahar of Night, 10 PM – 1 AM)',
    praharKey: 'late_night',
    rasa: 'Shringara & Karuna — intimate, nocturnal longing and poise',
    gamakaProfile: 'Skips Pa in ascent (g2-M1-D2-n2-S) and introduces Pa in Vakra descent (M1-P-D2-g2-M1-g2-R2-S)',
    sampleFile: null
  }
];


const SWARA_ORDER = SWARA_TABLE.map((s) => s.id);

export const PRAHAR_LABELS = {
  dawn_sandhiprakash: 'Dawn / Early Morning Sandhiprakash (4 AM – 8 AM)',
  late_morning: 'Late Morning (2nd Prahar of Day, 9 AM – 12 PM)',
  afternoon: 'Afternoon (3rd Prahar of Day, 12 PM – 4 PM)',
  dusk_sandhiprakash: 'Dusk / Sunset Sandhiprakash (4 PM – 7 PM)',
  early_night: 'Early Night (1st Prahar of Night, 6 PM – 9 PM)',
  late_night: 'Late Night (9 PM – 3 AM)',
  sarva_kaalik: 'Sarva-Kaalik — not bound to a Samay Chakra window'
};

// Melakarta chakra grammar: R/G pair by chakra, D/N pair by position within chakra
const RG_PAIRS = [['r1', 'R2'], ['r1', 'g2'], ['r1', 'G3'], ['R2', 'g2'], ['R2', 'G3'], ['g2', 'G3']];
const DN_PAIRS = [['d1', 'D2'], ['d1', 'n2'], ['d1', 'N3'], ['D2', 'n2'], ['D2', 'N3'], ['n2', 'N3']];
const RG_LABELS = [['R1', 'G1'], ['R1', 'G2'], ['R1', 'G3'], ['R2', 'G2'], ['R2', 'G3'], ['R3', 'G3']];
const DN_LABELS = [['D1', 'N1'], ['D1', 'N2'], ['D1', 'N3'], ['D2', 'N2'], ['D2', 'N3'], ['D3', 'N3']];

export function melakartaSwaras(number) {
  const idx = (number - 1) % 36;
  const [r, g] = RG_PAIRS[Math.floor(idx / 6)];
  const [d, n] = DN_PAIRS[idx % 6];
  return ['S', r, g, number <= 36 ? 'M1' : 'M2', 'P', d, n];
}

const MELAKARTA_SCALES = Array.from({ length: 72 }, (_, i) => melakartaSwaras(i + 1));

function melakartaLabel(number) {
  const idx = (number - 1) % 36;
  const [r, g] = RG_LABELS[Math.floor(idx / 6)];
  const [d, n] = DN_LABELS[idx % 6];
  return `S ${r} ${g} ${number <= 36 ? 'M1' : 'M2'} P ${d} ${n}`;
}

const sameSet = (a, b) => a.length === b.length && a.every((s) => b.includes(s));

/** Exact Melakarta number for a 7-swara set, or null if the set is not a Melakarta. */
export function melakartaForSwaras(swaras) {
  for (let n = 1; n <= 72; n++) {
    if (sameSet(MELAKARTA_SCALES[n - 1], swaras)) return n;
  }
  return null;
}

/** Parent Melakarta for any swara set: exact match, else the Thaat-equivalent or first containing scale. */
export function parentMelakartaFor(swaras, preferredThaat = null) {
  const exact = melakartaForSwaras(swaras);
  if (exact) return { number: exact, name: MELAKARTA_NAMES[exact - 1], exact: true };
  const supersets = [];
  for (let n = 1; n <= 72; n++) {
    if (swaras.every((s) => MELAKARTA_SCALES[n - 1].includes(s))) supersets.push(n);
  }
  if (supersets.length === 0) return null;
  const preferred = THAAT_SCALES[preferredThaat]?.melakarta;
  const number = supersets.includes(preferred) ? preferred : supersets[0];
  return { number, name: MELAKARTA_NAMES[number - 1], exact: false };
}

/** Thaat whose canonical scale has the smallest symmetric difference with the swara set. */
export function nearestThaat(swaras) {
  let best = 'Bilawal';
  let bestDist = Infinity;
  for (const [thaat, { swaras: scale }] of Object.entries(THAAT_SCALES)) {
    const dist =
      scale.filter((s) => !swaras.includes(s)).length + swaras.filter((s) => !scale.includes(s)).length;
    if (dist < bestDist) {
      bestDist = dist;
      best = thaat;
    }
  }
  return best;
}

/**
 * Structural identity of any linear (non-vakra) janya: its aroha/avaroha jati and every Melakarta that
 * contains it. Covers the full theoretical space of 72 × 483 = 34,776 linear janya ragas, named or not.
 */
export function classifyJanyaScale(arohaSwaras, avarohaSwaras) {
  const swaras = orderedSwaras([...arohaSwaras, ...avarohaSwaras].join(' '));
  const parentMelakartas = [];
  for (let n = 1; n <= 72; n++) {
    if (swaras.every((s) => MELAKARTA_SCALES[n - 1].includes(s))) parentMelakartas.push(n);
  }
  const up = orderedSwaras(arohaSwaras.join(' ')).length;
  const down = orderedSwaras(avarohaSwaras.join(' ')).length;
  return {
    swaras,
    jati: `${jatiName(up)}-${jatiName(down)}`,
    isMelakarta: up === 7 && down === 7 && parentMelakartas.length === 1,
    parentMelakartas
  };
}

export function orderedSwaras(...phrases) {
  const present = new Set(phrases.join(' ').split(/\s+/).filter(Boolean));
  return SWARA_ORDER.filter((id) => present.has(id));
}

function jatiName(count) {
  if (count >= 7) return 'Sampurna';
  if (count === 6) return 'Shadava';
  if (count === 5) return 'Audava';
  return 'Svarantara';
}

// Directional trigrams of the aroha/avaroha stand in for an uncatalogued pakad
function deriveNgrams(...phrases) {
  const grams = new Set();
  for (const phrase of phrases) {
    const tokens = phrase.split(/\s+/).filter(Boolean);
    for (let i = 2; i < tokens.length; i++) {
      const tri = tokens.slice(i - 2, i + 1);
      if (new Set(tri).size === 3) grams.add(tri.join(' '));
    }
  }
  return [...grams];
}

function describeParent(parent) {
  if (!parent) return 'Bhashanga / mixed scale (no single Melakarta parent)';
  return parent.exact
    ? `${parent.name} (Melakarta ${parent.number})`
    : `Janya of ${parent.name} (Melakarta ${parent.number})`;
}

function buildMelakartaEntry(number) {
  const name = MELAKARTA_NAMES[number - 1];
  const swaras = melakartaSwaras(number);
  const aroha = `${swaras.join(' ')} S`;
  const avaroha = `S ${[...swaras].reverse().join(' ')}`;
  const aliases = [...(MELAKARTA_ALIASES[number] || [])];
  return {
    id: name.toLowerCase(),
    name: `Raga ${name}`,
    carnaticEquivalent: `Melakarta ${number} (${melakartaLabel(number)})${aliases.length ? ` — also ${aliases.join(', ')}` : ''}`,
    tradition: 'Carnatic Melakarta',
    thaat: nearestThaat(swaras),
    jati: 'Sampurna-Sampurna (7 notes)',
    swaras,
    varjya: SWARA_ORDER.filter((id) => !swaras.includes(id)),
    aroha,
    avaroha,
    pakad: '— (parent scale; scored on aroha/avaroha contour)',
    pakadNgrams: deriveNgrams(aroha, avaroha),
    vadi: '—',
    samvadi: '—',
    nyasa: [],
    prahar: PRAHAR_LABELS.sarva_kaalik,
    praharKey: 'sarva_kaalik',
    rasa: '—',
    gamakaProfile: 'Carnatic parent (Melakarta) scale — gamaka idiom depends on the janya rendered',
    sampleFile: null,
    melakarta: { number, name, exact: true },
    aliases,
    source: 'melakarta'
  };
}

function buildJanyaEntry(
  [id, name, trad, parent, aroha, avaroha, vadi = null, samvadi = null, praharKey = null, aliases = []],
  source = 'lexicon'
) {
  const swaras = orderedSwaras(aroha, avaroha);
  const thaat =
    typeof parent === 'string'
      ? parent
      : nearestThaat(typeof parent === 'number' ? melakartaSwaras(parent) : swaras);
  const mela =
    typeof parent === 'number'
      ? { number: parent, name: MELAKARTA_NAMES[parent - 1], exact: sameSet(melakartaSwaras(parent), swaras) }
      : parentMelakartaFor(swaras, thaat);
  const up = orderedSwaras(aroha).length;
  const down = orderedSwaras(avaroha).length;
  const key = praharKey || (trad === 'C' ? 'sarva_kaalik' : 'early_night');
  const tradition = { H: 'Hindustani Classical', C: 'Carnatic Classical', HC: 'Hindustani & Carnatic Dual' }[trad];
  return {
    id,
    name,
    carnaticEquivalent: `${describeParent(mela)}${aliases.length ? ` — also ${aliases.join(', ')}` : ''}`,
    tradition,
    thaat,
    jati: `${jatiName(up)}-${jatiName(down)} (${up} up, ${down} down)`,
    swaras,
    varjya: SWARA_ORDER.filter((s) => !swaras.includes(s)),
    aroha,
    avaroha,
    pakad: '— (scored on aroha/avaroha contour)',
    pakadNgrams: deriveNgrams(aroha, avaroha),
    vadi: vadi || '—',
    samvadi: samvadi || '—',
    nyasa: [vadi, samvadi].filter(Boolean),
    prahar: PRAHAR_LABELS[key],
    praharKey: key,
    rasa: '—',
    gamakaProfile: `${tradition} raga — characteristic phrasing follows its aroha/avaroha (${aroha} / ${avaroha})`,
    sampleFile: null,
    melakarta: mela,
    aliases: [...aliases],
    source
  };
}

function enrichCoreEntry(raga) {
  return {
    ...raga,
    melakarta: parentMelakartaFor(raga.swaras, raga.thaat),
    aliases: [...(CORE_ALIASES[raga.id] || [])],
    source: 'curated'
  };
}

// Spelling-tolerant name key: Kedaragowla ~ Kedaragaula, Mohanam ~ Mohana, Sohini ~ Sohni
function nameKey(name) {
  return name
    .toLowerCase()
    .replace(/^raga\s+/, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/h/g, '')
    .replace(/w/g, 'v')
    .replace(/o[vu]/g, 'au')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/m$/, '');
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

const sameTradition = (a, b) =>
  a.tradition.includes('Dual') || b.tradition.includes('Dual') || a.tradition.split(' ')[0] === b.tradition.split(' ')[0];

const scaleDistance = (a, b) => a.filter((s) => !b.includes(s)).length + b.filter((s) => !a.includes(s)).length;

/**
 * Merge Wikipedia-sourced ragas into the hand-built catalog. A row naming an already-catalogued raga
 * (spelling-tolerant name, scale within one swara — exact across traditions) becomes an alias; a row whose id collides with a
 * different raga (e.g. Carnatic vs Hindustani Poorvi) gets a tradition-suffixed id.
 */
function mergeWikiRagas(catalog) {
  const byId = new Map(catalog.map((r) => [r.id, r]));
  const melakartas = catalog.filter((r) => r.source === 'melakarta');
  const keyIndex = [];
  const indexEntry = (raga) => {
    for (const label of [raga.name, ...raga.aliases]) keyIndex.push({ key: nameKey(label), raga });
  };
  catalog.forEach(indexEntry);

  const findDuplicate = (entry) => {
    const key = nameKey(entry.name);
    return keyIndex.find(
      (k) =>
        k.key[0] === key[0] &&
        (k.key === key || editDistance(k.key, key) <= 2) &&
        // Same-named ragas across traditions (Carnatic vs Hindustani Poorvi) must share the exact scale
        scaleDistance(k.raga.swaras, entry.swaras) <= (sameTradition(k.raga, entry) ? 1 : 0)
    )?.raga;
  };

  const merged = [];
  for (const row of WIKI_RAGA_ROWS) {
    const entry = buildJanyaEntry([row[0], `Raga ${row[1]}`, ...row.slice(2)], 'wikipedia');
    // Asampurna-system names sung as the plain parent scale (Janatodi, Chamaram) are Melakarta aliases
    const mela = typeof row[3] === 'number' ? melakartas[row[3] - 1] : null;
    const duplicate =
      mela && entry.aroha === mela.aroha && entry.avaroha === mela.avaroha ? mela : findDuplicate(entry);
    if (duplicate) {
      const alias = row[1];
      if (nameKey(alias) !== nameKey(duplicate.name) && !duplicate.aliases.includes(alias)) duplicate.aliases.push(alias);
      continue;
    }
    if (byId.has(entry.id)) {
      const suffix = row[2] === 'H' ? 'hindustani' : 'carnatic';
      entry.id = `${entry.id}_${suffix}`;
      entry.name = `${entry.name} (${suffix[0].toUpperCase()}${suffix.slice(1)})`;
      if (byId.has(entry.id)) continue;
    }
    byId.set(entry.id, entry);
    indexEntry(entry);
    merged.push(entry);
  }
  return merged;
}

function buildCatalog() {
  const melakartas = MELAKARTA_NAMES.map((_, i) => buildMelakartaEntry(i + 1));
  for (const mela of melakartas) {
    for (const alias of WIKI_MELAKARTA_ALIASES[mela.melakarta.number] || []) {
      if (nameKey(alias) !== nameKey(mela.name) && !mela.aliases.includes(alias)) mela.aliases.push(alias);
    }
  }
  const curated = [...CORE_RAGA_CATALOG.map(enrichCoreEntry), ...JANYA_ROWS.map((row) => buildJanyaEntry(row))];
  const wiki = mergeWikiRagas([...curated, ...melakartas]);
  return [...curated, ...wiki, ...melakartas];
}

/**
 * Full searchable raga universe: 12 hand-curated ragas, the janya lexicon, Wikipedia-sourced named ragas,
 * and all 72 Melakartas.
 */
export const RAGA_CATALOG = buildCatalog();

// Scale templates used to stabilize tonic (Sa) detection: curated ragas plus the 10 Thaats
export const TONIC_TEMPLATE_SCALES = [
  ...CORE_RAGA_CATALOG.map((r) => r.swaras),
  ...Object.values(THAAT_SCALES).map((t) => t.swaras)
];

export function getRagaById(id) {
  return RAGA_CATALOG.find(r => r.id === id) || null;
}
