// Windward: Cinder Coast hands its game to the grader.
//
// The playable build is game/: plain static files a desktop browser loads offline. This program
// checks that the hand-in is complete, copies game/ and screenshots/ beside it into the output
// directory, and writes dossier.json with the vendored make.fun library, exactly as the scorer
// reads it. Outside the grader's container MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
const library = join(here, 'vendor', 'makefun-game.ts');

function fail(message) {
  console.error(`windward: ${message}`);
  process.exit(1);
}

// The two things a broken checkout loses first: the entry page and the vendored library.
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(library)) fail('vendor/makefun-game.ts is missing');

// The gate wants three or four real screenshots, the first by name being the cover.
const images = existsSync(shotsDir)
  ? readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.') && /\.(png|jpe?g|webp)$/i.test(name))
    .sort()
  : [];
if (images.length < 3 || images.length > 4) {
  fail(`screenshots/ must hold 3 or 4 images, found ${images.length}`);
}
for (const name of images) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) fail(`screenshots/${name} is over 256 KiB (${size} bytes)`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than
// 993 files in game/ or 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`windward: ${images.length} screenshots, ${readdirSync(join(out, 'game')).length} game entries, dossier written to ${join(out, 'dossier.json')}`);
