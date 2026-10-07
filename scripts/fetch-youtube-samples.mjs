import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../public/samples');

/**
 * Curated YouTube clips of real human Indian classical vocalists singing
 * Aroha, Avaroha, Pakad, and Alaap across our 6 reference ragas.
 */
const YOUTUBE_VOCAL_CLIPS = [
  {
    raga: 'yaman',
    filename: 'raga-yaman.mp3',
    videoId: 'x9DKjCxzDQg',
    url: 'https://www.youtube.com/watch?v=x9DKjCxzDQg',
    startSec: 15,
    durationSec: 25,
    description: 'Raag Yaman ke aroh avroh pakad Bandish (Human Vocal in C#)'
  },
  {
    raga: 'bhairav',
    filename: 'raga-bhairav.mp3',
    videoId: 'TSF6FihBCaQ',
    url: 'https://www.youtube.com/watch?v=TSF6FihBCaQ',
    startSec: 0,
    durationSec: 28,
    description: 'Learn Raag Bhairav aroh avroh (Human Vocal in G#)'
  },
  {
    raga: 'bhupali',
    filename: 'raga-bhupali.mp3',
    videoId: 'D4jFaFDHa5g',
    url: 'https://www.youtube.com/watch?v=D4jFaFDHa5g',
    startSec: 16,
    durationSec: 27,
    description: 'Raag Bhupali Aaroh-Avroh-Pakad (Human Vocal in B)'
  },
  {
    raga: 'malkauns',
    filename: 'raga-malkauns.mp3',
    videoId: 'skkrjRDcwXw',
    url: 'https://www.youtube.com/watch?v=skkrjRDcwXw',
    startSec: 0,
    durationSec: 28,
    description: 'Raag Malkauns Aroh, Avroh, Pakad by Vinod Pandir (Human Vocal in C)'
  },
  {
    raga: 'darbari_kanada',
    filename: 'raga-darbari-kanada.mp3',
    videoId: 'TxORN-ZnBY4',
    url: 'https://www.youtube.com/watch?v=TxORN-ZnBY4',
    startSec: 32,
    durationSec: 28,
    description: 'Raag Darbari Kanada Aroh - Avroh - Pakar (Human Vocal in C)'
  },
  {
    raga: 'hamsadhwani',
    filename: 'raga-hamsadhwani.mp3',
    videoId: 'AgCar9hWWas',
    url: 'https://www.youtube.com/watch?v=AgCar9hWWas',
    startSec: 24,
    durationSec: 25,
    description: 'Raga Hamsadhwani Moorchana (Human Vocal in G)'
  }
];

for (const clip of YOUTUBE_VOCAL_CLIPS) {
  const tmpPath = `/tmp/yt-${clip.videoId}.mp3`;
  const outPath = path.join(SAMPLES_DIR, clip.filename);
  console.log(`Fetching ${clip.filename} from ${clip.url} (${clip.startSec}s + ${clip.durationSec}s)...`);

  spawnSync(
    'yt-dlp',
    [
      '--no-playlist',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--download-sections', '*0:00-1:40',
      '-o', tmpPath,
      clip.url
    ],
    { stdio: 'inherit' }
  );

  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-ss', String(clip.startSec),
      '-t', String(clip.durationSec),
      '-i', tmpPath,
      '-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${clip.durationSec - 0.6}:d=0.6,loudnorm=I=-16:TP=-1.5:LRA=11`,
      '-ac', '1',
      '-ar', '44100',
      '-b:a', '128k',
      outPath
    ],
    { stdio: 'inherit' }
  );
  console.log(`Saved -> ${outPath}\n`);
}
