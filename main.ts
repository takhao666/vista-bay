// main.ts — Vista Bay entrypoint (Node 22, standard library only).
//
// The game is plain static files under game/ (game/index.html plus its ES
// modules and a vendored three.js build) and the screenshots under
// screenshots/. This program hands the entry in: it copies both folders
// into the output directory and writes dossier.json with the kit's
// buildDossier helper from vendor/makefun-game.ts.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps the scorer enforces (see the competition's gate rules): the dossier
// text is capped at 160 KiB, at most 4 screenshots of 256 KiB each, and
// game/ holds at most 993 files/directories and 48 MiB in total, with no
// path longer than 1000 bytes. buildDossier throws if any cap is breached,
// so a bad tree fails here instead of at the gate.
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
