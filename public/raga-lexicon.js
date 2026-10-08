/**
 * Extended raga lexicon: the 72 Melakarta parent scales plus widely performed
 * Hindustani and Carnatic janya ragas. Rows are compact; raga-catalog.js expands
 * them into full catalog entries (swaras, varjya, jati, derived n-grams, parent scale).
 *
 * Swara tokens use the 12-swarasthana ids from SWARA_TABLE (pitch-based), so Carnatic
 * R3 is written g2, G1 is written R2, D3 is written n2, and N1 is written D2.
 */

// Melakarta names in Katapayadi order (1..72)
export const MELAKARTA_NAMES = [
  'Kanakangi', 'Ratnangi', 'Ganamurthi', 'Vanaspathi', 'Manavathi', 'Tanarupi',
  'Senavathi', 'Hanumatodi', 'Dhenuka', 'Natakapriya', 'Kokilapriya', 'Rupavathi',
  'Gayakapriya', 'Vakulabharanam', 'Mayamalavagowla', 'Chakravakam', 'Suryakantham', 'Hatakambari',
  'Jhankaradhwani', 'Natabhairavi', 'Keeravani', 'Kharaharapriya', 'Gourimanohari', 'Varunapriya',
  'Mararanjani', 'Charukesi', 'Sarasangi', 'Harikambhoji', 'Dheerasankarabharanam', 'Naganandini',
  'Yagapriya', 'Ragavardhini', 'Gangeyabhushani', 'Vagadheeswari', 'Shulini', 'Chalanata',
  'Salagam', 'Jalarnavam', 'Jhalavarali', 'Navaneetham', 'Pavani', 'Raghupriya',
  'Gavambhodi', 'Bhavapriya', 'Shubhapantuvarali', 'Shadvidamargini', 'Suvarnangi', 'Divyamani',
  'Dhavalambari', 'Namanarayani', 'Kamavardhini', 'Ramapriya', 'Gamanashrama', 'Vishwambari',
  'Shamalangi', 'Shanmukhapriya', 'Simhendramadhyamam', 'Hemavathi', 'Dharmavathi', 'Neethimathi',
  'Kanthamani', 'Rishabhapriya', 'Latangi', 'Vachaspathi', 'Mechakalyani', 'Chitrambari',
  'Sucharitra', 'Jyotiswarupini', 'Dhatuvardhani', 'Nasikabhushani', 'Kosalam', 'Rasikapriya'
];

export const MELAKARTA_ALIASES = {
  8: ['Todi (Carnatic)'],
  21: ['Kirwani'],
  26: ['Charukeshi'],
  29: ['Shankarabharanam'],
  51: ['Pantuvarali'],
  65: ['Kalyani']
};

/**
 * Janya / Hindustani rows:
 * [id, name, tradition ('H' | 'C' | 'HC'), parent (thaat name, melakarta number, or null),
 *  aroha, avaroha, vadi, samvadi, praharKey, aliases]
 */
export const JANYA_ROWS = [
  // Kalyan thaat
  ['yaman_kalyan', 'Raga Yaman Kalyan', 'H', 'Kalyan', 'N3 R2 G3 M2 P D2 N3 S', 'S N3 D2 P M2 G3 M1 G3 R2 S', 'G3', 'N3', 'early_night'],
  ['shuddha_kalyan', 'Raga Shuddha Kalyan', 'H', 'Kalyan', 'S R2 G3 P D2 S', 'S N3 D2 P M2 G3 R2 S', 'G3', 'D2', 'early_night'],
  ['hameer', 'Raga Hameer', 'H', 'Kalyan', 'S R2 S G3 M1 D2 N3 D2 S', 'S N3 D2 P M2 P D2 P G3 M1 R2 S', 'D2', 'G3', 'early_night'],
  ['kedar', 'Raga Kedar', 'H', 'Kalyan', 'S M1 G3 P M2 P D2 P N3 D2 S', 'S N3 D2 P M2 P D2 P M1 P G3 M1 R2 S', 'M1', 'S', 'early_night'],
  ['kamod', 'Raga Kamod', 'H', 'Kalyan', 'S M1 R2 P M2 P D2 P N3 D2 S', 'S N3 D2 P M2 P D2 P G3 M1 P G3 M1 R2 S', 'P', 'R2', 'early_night'],
  ['chhayanat', 'Raga Chhayanat', 'H', 'Kalyan', 'S R2 G3 M1 P N3 D2 S', 'S N3 D2 P M2 P D2 P G3 M1 R2 S', 'R2', 'P', 'early_night'],
  ['shyam_kalyan', 'Raga Shyam Kalyan', 'H', 'Kalyan', 'N3 S R2 M2 P N3 S', 'S N3 D2 P M2 P G3 M1 R2 N3 S', 'R2', 'P', 'early_night'],
  ['shuddha_sarang', 'Raga Shuddha Sarang', 'H', 'Kalyan', 'N3 S R2 M2 P N3 S', 'S N3 D2 P M2 P M1 R2 S', 'R2', 'P', 'afternoon'],
  ['gaud_sarang', 'Raga Gaud Sarang', 'H', 'Kalyan', 'S G3 R2 M1 G3 P M1 D2 P S', 'S D2 N3 P D2 M2 P G3 M1 R2 S', 'G3', 'D2', 'afternoon'],
  ['hindol', 'Raga Hindol', 'HC', 'Kalyan', 'S G3 M2 D2 S', 'S N3 D2 M2 G3 S', 'D2', 'G3', 'dawn_sandhiprakash', ['Sunadavinodini']],
  ['maru_bihag', 'Raga Maru Bihag', 'H', 'Kalyan', 'N3 S G3 M2 P N3 S', 'S N3 D2 P M2 G3 M2 G3 R2 S', 'G3', 'N3', 'late_night'],

  // Bilawal thaat
  ['alhaiya_bilawal', 'Raga Alhaiya Bilawal', 'H', 'Bilawal', 'S R2 G3 P D2 N3 S', 'S N3 D2 n2 D2 P M1 G3 M1 R2 S', 'D2', 'G3', 'late_morning', ['Bilawal']],
  ['bihag', 'Raga Bihag', 'HC', 'Bilawal', 'N3 S G3 M1 P N3 S', 'S N3 D2 P M2 P G3 M1 G3 R2 S', 'G3', 'N3', 'late_night', ['Behag']],
  ['durga', 'Raga Durga', 'HC', 'Bilawal', 'S R2 M1 P D2 S', 'S D2 P M1 R2 S', 'M1', 'S', 'early_night', ['Shuddha Saveri']],
  ['shankara', 'Raga Shankara', 'H', 'Bilawal', 'S G3 P N3 D2 S', 'S N3 P G3 P R2 G3 S', 'G3', 'N3', 'late_night'],
  ['deshkar', 'Raga Deshkar', 'H', 'Bilawal', 'S R2 G3 P D2 S', 'S D2 P G3 R2 S', 'D2', 'G3', 'late_morning'],
  ['bhinna_shadja', 'Raga Bhinna Shadja', 'H', 'Bilawal', 'S G3 M1 D2 N3 S', 'S N3 D2 M1 G3 S', 'M1', 'S', 'late_night', ['Kaushikdhwani']],
  ['pahadi', 'Raga Pahadi', 'H', 'Bilawal', 'S R2 G3 P D2 S', 'S D2 P G3 R2 S N3 D2 P', null, null, 'sarva_kaalik'],
  ['mand', 'Raga Mand', 'H', 'Bilawal', 'S G3 M1 P D2 N3 S', 'S N3 D2 P M1 G3 R2 S', null, null, 'sarva_kaalik'],

  // Khamaj thaat
  ['khamaj', 'Raga Khamaj', 'H', 'Khamaj', 'S G3 M1 P D2 N3 S', 'S n2 D2 P M1 G3 R2 S', 'G3', 'N3', 'late_night'],
  ['jhinjhoti', 'Raga Jhinjhoti', 'H', 'Khamaj', 'S R2 M1 P D2 S', 'S n2 D2 P M1 G3 R2 S', 'G3', 'n2', 'late_night'],
  ['tilak_kamod', 'Raga Tilak Kamod', 'H', 'Khamaj', 'N3 S R2 G3 S R2 M1 P N3 S', 'S P D2 M1 G3 S R2 G3 N3 S', null, null, 'late_night'],
  ['kalavati', 'Raga Kalavati', 'HC', 'Khamaj', 'S G3 P D2 n2 S', 'S n2 D2 P G3 S', null, null, 'late_night', ['Valaji']],
  ['rageshree', 'Raga Rageshree', 'H', 'Khamaj', 'S G3 M1 D2 n2 S', 'S n2 D2 M1 G3 R2 S', 'G3', 'n2', 'late_night'],
  ['jog', 'Raga Jog', 'H', 'Khamaj', 'S G3 M1 P n2 S', 'S n2 P M1 G3 M1 g2 S', 'M1', 'S', 'late_night'],
  ['tilang', 'Raga Tilang', 'H', 'Khamaj', 'S G3 M1 P N3 S', 'S n2 P M1 G3 S', 'G3', 'N3', 'late_night'],
  ['gorakh_kalyan', 'Raga Gorakh Kalyan', 'H', 'Khamaj', 'S R2 M1 D2 n2 D2 S', 'S n2 D2 M1 R2 S', 'M1', 'S', 'late_night'],
  ['jaijaiwanti', 'Raga Jaijaiwanti', 'HC', 'Khamaj', 'S R2 G3 M1 P N3 S', 'S n2 D2 P M1 G3 R2 g2 R2 S', 'R2', 'P', 'late_night', ['Dwijavanti']],
  ['sorath', 'Raga Sorath', 'H', 'Khamaj', 'S R2 M1 P N3 S', 'S n2 D2 M1 P D2 M1 G3 R2 S', 'R2', 'D2', 'late_night'],

  // Kafi thaat
  ['kafi', 'Raga Kafi', 'H', 'Kafi', 'S R2 g2 M1 P D2 n2 S', 'S n2 D2 P M1 g2 R2 S', 'P', 'S', 'late_night'],
  ['bahar', 'Raga Bahar', 'H', 'Kafi', 'S M1 P g2 M1 n2 D2 N3 S', 'S n2 P M1 P g2 M1 R2 S', 'M1', 'S', 'late_night'],
  ['pilu', 'Raga Pilu', 'H', 'Kafi', 'N3 S g2 M1 P N3 S', 'S n2 D2 P M1 g2 R2 S', 'g2', 'N3', 'afternoon'],
  ['dhani', 'Raga Dhani', 'HC', 'Kafi', 'S g2 M1 P n2 S', 'S n2 P M1 g2 S', 'g2', 'n2', 'afternoon', ['Shuddha Dhanyasi', 'Udayaravichandrika']],
  ['patdeep', 'Raga Patdeep', 'H', 'Kafi', 'S g2 M1 P N3 S', 'S N3 D2 P M1 g2 R2 S', 'P', 'S', 'afternoon'],
  ['brindavani_sarang', 'Raga Brindavani Sarang', 'HC', 'Kafi', 'N3 S R2 M1 P N3 S', 'S n2 P M1 R2 S', 'R2', 'P', 'afternoon', ['Brindavana Saranga']],
  ['madhmad_sarang', 'Raga Madhmad Sarang', 'H', 'Kafi', 'S R2 M1 P n2 S', 'S n2 P M1 R2 S', 'R2', 'P', 'afternoon'],
  ['megh', 'Raga Megh', 'H', 'Kafi', 'S R2 M1 P n2 S', 'S n2 P M1 R2 S', 'S', 'P', 'late_night', ['Megh Malhar']],
  ['miyan_malhar', 'Raga Miyan ki Malhar', 'H', 'Kafi', 'S R2 P M1 P n2 D2 N3 S', 'S n2 P M1 P g2 M1 R2 S', 'M1', 'S', 'late_night'],
  ['abhogi', 'Raga Abhogi', 'HC', 'Kafi', 'S R2 g2 M1 D2 S', 'S D2 M1 g2 R2 S', 'M1', 'S', 'late_night'],
  ['shivranjani', 'Raga Shivranjani', 'HC', 'Kafi', 'S R2 g2 P D2 S', 'S D2 P g2 R2 S', null, null, 'sarva_kaalik', ['Shivaranjani']],

  // Todi / Marwa / Poorvi thaats
  ['madhuvanti', 'Raga Madhuvanti', 'H', 'Todi', 'N3 S g2 M2 P N3 S', 'S N3 D2 P M2 g2 R2 S', 'P', 'S', 'afternoon'],
  ['multani', 'Raga Multani', 'H', 'Todi', 'N3 S g2 M2 P N3 S', 'S N3 d1 P M2 g2 r1 S', 'P', 'S', 'afternoon'],
  ['gurjari_todi', 'Raga Gurjari Todi', 'H', 'Todi', 'S r1 g2 M2 d1 N3 S', 'S N3 d1 M2 g2 r1 S', 'd1', 'g2', 'late_morning'],
  ['puriya_kalyan', 'Raga Puriya Kalyan', 'H', 'Marwa', 'N3 r1 G3 M2 P D2 N3 S', 'S N3 D2 P M2 G3 r1 S', 'G3', 'N3', 'dusk_sandhiprakash'],
  ['puriya', 'Raga Puriya', 'H', 'Marwa', 'N3 r1 G3 M2 D2 N3 S', 'S N3 D2 M2 G3 r1 S', 'G3', 'N3', 'dusk_sandhiprakash'],
  ['marwa', 'Raga Marwa', 'H', 'Marwa', 'S r1 G3 M2 D2 N3 D2 S', 'S N3 D2 M2 G3 r1 S', 'r1', 'D2', 'dusk_sandhiprakash'],
  ['sohini', 'Raga Sohini', 'H', 'Marwa', 'S G3 M2 D2 N3 S', 'S N3 D2 G3 M2 D2 G3 M2 G3 r1 S', 'D2', 'G3', 'dawn_sandhiprakash'],
  ['lalit', 'Raga Lalit', 'H', 'Marwa', 'N3 r1 G3 M1 M2 M1 G3 M2 d1 N3 S', 'S N3 d1 M2 d1 M2 M1 G3 r1 S', 'M1', 'S', 'dawn_sandhiprakash'],
  ['poorvi', 'Raga Poorvi', 'H', 'Poorvi', 'S r1 G3 M2 P d1 N3 S', 'S N3 d1 P M2 G3 M1 G3 r1 S', 'G3', 'N3', 'dusk_sandhiprakash'],
  ['shree', 'Raga Shree', 'H', 'Poorvi', 'S r1 M2 P N3 S', 'S N3 d1 P M2 G3 r1 S', 'r1', 'P', 'dusk_sandhiprakash'],
  ['basant', 'Raga Basant', 'H', 'Poorvi', 'S G3 M2 d1 N3 S', 'S N3 d1 P M2 G3 M2 d1 M2 G3 r1 S', 'S', 'P', 'dawn_sandhiprakash'],

  // Asavari thaat
  ['jaunpuri', 'Raga Jaunpuri', 'H', 'Asavari', 'S R2 M1 P d1 n2 S', 'S n2 d1 P M1 g2 R2 S', 'd1', 'g2', 'late_morning'],
  ['asavari', 'Raga Asavari', 'H', 'Asavari', 'S R2 M1 P d1 S', 'S n2 d1 P M1 g2 R2 S', 'd1', 'g2', 'late_morning'],
  ['adana', 'Raga Adana', 'H', 'Asavari', 'S R2 M1 P d1 n2 S', 'S d1 n2 P M1 P g2 M1 R2 S', 'S', 'P', 'late_night'],

  // Bhairav thaat
  ['ahir_bhairav', 'Raga Ahir Bhairav', 'H', 'Bhairav', 'S r1 G3 M1 P D2 n2 S', 'S n2 D2 P M1 G3 r1 S', 'M1', 'S', 'dawn_sandhiprakash'],
  ['ramkali', 'Raga Ramkali', 'H', 'Bhairav', 'S r1 G3 M1 P d1 N3 S', 'S N3 d1 P M2 P d1 n2 d1 P G3 M1 r1 S', 'P', 'S', 'dawn_sandhiprakash'],
  ['kalingda', 'Raga Kalingda', 'HC', 'Bhairav', 'S r1 G3 M1 P d1 N3 S', 'S N3 d1 P M1 G3 r1 S', 'P', 'S', 'dawn_sandhiprakash', ['Nadanamakriya']],
  ['jogiya', 'Raga Jogiya', 'H', 'Bhairav', 'S r1 M1 P d1 S', 'S N3 d1 P d1 M1 r1 S', 'M1', 'S', 'dawn_sandhiprakash'],
  ['gunkali', 'Raga Gunkali', 'H', 'Bhairav', 'S r1 M1 P d1 S', 'S d1 P M1 r1 S', 'd1', 'r1', 'dawn_sandhiprakash', ['Gunakri']],
  ['vibhas', 'Raga Vibhas', 'HC', 'Bhairav', 'S r1 G3 P d1 S', 'S d1 P G3 r1 S', 'd1', 'r1', 'dawn_sandhiprakash', ['Revagupti']],
  ['nat_bhairav', 'Raga Nat Bhairav', 'H', 'Bhairav', 'S R2 G3 M1 P d1 N3 S', 'S N3 d1 P M1 G3 R2 S', null, null, 'dawn_sandhiprakash'],
  ['bairagi', 'Raga Bairagi', 'HC', 'Bhairav', 'S r1 M1 P n2 S', 'S n2 P M1 r1 S', 'r1', 'P', 'dawn_sandhiprakash', ['Revati']],

  // Bhairavi thaat and thaat-less Hindustani ragas
  ['bhupal_todi', 'Raga Bhupal Todi', 'HC', 'Bhairavi', 'S r1 g2 P d1 S', 'S d1 P g2 r1 S', 'd1', 'g2', 'late_morning', ['Bhupalam']],
  ['bilaskhani_todi', 'Raga Bilaskhani Todi', 'H', 'Bhairavi', 'S r1 g2 P d1 S', 'S r1 n2 d1 M1 g2 r1 S', 'd1', 'g2', 'late_morning'],
  ['komal_rishabh_asavari', 'Raga Komal Rishabh Asavari', 'H', 'Bhairavi', 'S r1 M1 P d1 S', 'S n2 d1 P M1 g2 r1 S', 'd1', 'g2', 'late_morning'],
  ['chandrakauns', 'Raga Chandrakauns', 'H', null, 'S g2 M1 d1 N3 S', 'S N3 d1 M1 g2 S', 'M1', 'S', 'late_night'],
  ['madhukauns', 'Raga Madhukauns', 'H', null, 'S g2 M2 P n2 S', 'S n2 P M2 g2 S', null, null, 'late_night'],

  // Carnatic janyas (parent = melakarta number)
  ['bowli', 'Raga Bowli', 'C', 15, 'S r1 G3 P d1 S', 'S N3 d1 P G3 r1 S'],
  ['saveri', 'Raga Saveri', 'C', 15, 'S r1 M1 P d1 S', 'S N3 d1 P M1 G3 r1 S'],
  ['malahari', 'Raga Malahari', 'C', 15, 'S r1 M1 P d1 S', 'S d1 P M1 G3 r1 S'],
  ['lalitha', 'Raga Lalitha', 'C', 15, 'S r1 G3 M1 d1 N3 S', 'S N3 d1 M1 G3 r1 S'],
  ['vasantha', 'Raga Vasantha', 'C', 17, 'S M1 G3 M1 D2 N3 S', 'S N3 D2 M1 G3 r1 S'],
  ['hamsanandi', 'Raga Hamsanandi', 'C', 53, 'S r1 G3 M2 D2 N3 S', 'S N3 D2 M2 G3 r1 S'],
  ['kambhoji', 'Raga Kambhoji', 'C', 28, 'S R2 G3 M1 P D2 S', 'S n2 D2 P M1 G3 R2 S N3 P D2 S'],
  ['kedaragowla', 'Raga Kedaragowla', 'C', 28, 'S R2 M1 P n2 S', 'S n2 D2 P M1 G3 R2 S'],
  ['sahana', 'Raga Sahana', 'C', 28, 'S R2 G3 M1 P M1 D2 n2 S', 'S n2 D2 P M1 G3 M1 R2 G3 R2 S'],
  ['yadukula_kambhoji', 'Raga Yadukula Kambhoji', 'C', 28, 'S R2 M1 P D2 S', 'S n2 D2 P M1 G3 R2 S'],
  ['natakurinji', 'Raga Natakurinji', 'C', 28, 'S R2 G3 M1 n2 D2 n2 P D2 n2 S', 'S n2 D2 M1 G3 M1 P G3 R2 S'],
  ['kuntalavarali', 'Raga Kuntalavarali', 'C', 28, 'S M1 P D2 n2 D2 S', 'S n2 D2 P M1 S'],
  ['nagaswaravali', 'Raga Nagaswaravali', 'C', 28, 'S G3 M1 P D2 S', 'S D2 P M1 G3 S'],
  ['darbar', 'Raga Darbar', 'C', 22, 'S R2 M1 P D2 n2 S', 'S n2 D2 P M1 R2 g2 R2 S'],
  ['kanada', 'Raga Kanada', 'C', 22, 'S R2 g2 M1 D2 n2 S', 'S n2 P M1 g2 M1 R2 S'],
  ['mukhari', 'Raga Mukhari', 'C', 22, 'S R2 M1 P n2 D2 S', 'S n2 d1 P M1 g2 R2 S'],
  ['ritigowla', 'Raga Ritigowla', 'C', 22, 'S g2 R2 g2 M1 n2 D2 M1 n2 S', 'S n2 D2 M1 g2 M1 P M1 g2 R2 S'],
  ['sriranjani', 'Raga Sriranjani', 'C', 22, 'S R2 g2 M1 D2 n2 S', 'S n2 D2 M1 g2 R2 S'],
  ['madhyamavati', 'Raga Madhyamavati', 'C', 22, 'S R2 M1 P n2 S', 'S n2 P M1 R2 S'],
  ['kapi', 'Raga Kapi', 'C', 22, 'S R2 M1 P N3 S', 'S n2 D2 n2 P M1 g2 R2 S'],
  ['sri', 'Raga Sri', 'C', 22, 'S R2 M1 P n2 S', 'S n2 P D2 n2 P M1 R2 g2 R2 S'],
  ['anandabhairavi', 'Raga Anandabhairavi', 'C', 20, 'S g2 R2 g2 M1 P D2 P S', 'S n2 D2 P M1 g2 R2 S'],
  ['sindhubhairavi', 'Raga Sindhubhairavi', 'C', 20, 'S R2 g2 M1 P d1 n2 S', 'S n2 d1 P M1 g2 r1 S', null, null, null, ['Sindhu Bhairavi']],
  ['saramati', 'Raga Saramati', 'C', 20, 'S R2 g2 M1 P d1 n2 S', 'S n2 d1 M1 g2 S'],
  ['begada', 'Raga Begada', 'C', 29, 'S G3 R2 G3 M1 P D2 P S', 'S N3 D2 P M1 G3 R2 S'],
  ['bilahari', 'Raga Bilahari', 'C', 29, 'S R2 G3 P D2 S', 'S N3 D2 P M1 G3 R2 S'],
  ['arabhi', 'Raga Arabhi', 'C', 29, 'S R2 M1 P D2 S', 'S N3 D2 P M1 G3 R2 S'],
  ['atana', 'Raga Atana', 'C', 29, 'S R2 M1 P N3 S', 'S N3 D2 P M1 P G3 R2 S'],
  ['kedaram', 'Raga Kedaram', 'C', 29, 'S M1 G3 M1 P N3 S', 'S N3 P M1 G3 R2 S'],
  ['kadanakuthuhalam', 'Raga Kadanakuthuhalam', 'C', 29, 'S R2 M1 D2 N3 G3 P S', 'S N3 D2 P M1 G3 R2 S'],
  ['hamir_kalyani', 'Raga Hamir Kalyani', 'C', 65, 'S P M2 P D2 N3 S', 'S N3 D2 P M2 D2 P M1 G3 R2 S'],
  ['mohanakalyani', 'Raga Mohanakalyani', 'C', 65, 'S R2 G3 M2 P D2 S', 'S D2 P G3 R2 S'],
  ['amritavarshini', 'Raga Amritavarshini', 'C', 66, 'S G3 M2 P N3 S', 'S N3 P M2 G3 S'],
  ['ranjani', 'Raga Ranjani', 'C', 59, 'S R2 g2 M2 D2 S', 'S N3 D2 M2 g2 S R2 g2 S'],
  ['nata', 'Raga Nata', 'C', 36, 'S g2 G3 M1 P n2 N3 S', 'S N3 P M1 g2 S'],
  ['gambhiranata', 'Raga Gambhiranata', 'C', 36, 'S G3 M1 P N3 S', 'S N3 P M1 G3 S'],
  ['kalyanavasantham', 'Raga Kalyanavasantham', 'C', 21, 'S g2 M1 d1 N3 S', 'S N3 d1 P M1 g2 R2 S']
];

// Aliases attached to the 12 hand-curated core ragas
export const CORE_ALIASES = {
  yaman: ['Kalyani', 'Eman'],
  bhupali: ['Mohanam', 'Bhoop'],
  malkauns: ['Hindolam'],
  bhimpalasi: ['Abheri'],
  todi: ['Todi'],
  darbari_kanada: ['Darbari']
};
