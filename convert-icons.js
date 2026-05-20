/**
 * PitchShuffle icon converter — no C++ required
 * Uses @resvg/resvg-js (pure WebAssembly)
 *
 * Usage:
 *   1. Copy this file to your project root
 *   2. npm install @resvg/resvg-js
 *   3. node convert-icons.js
 *
 * Output (all written to public/images/):
 *   icon-512.png    Android / PWA large
 *   icon-192.png    Android / PWA standard  ← manifest.json already references this
 *   icon-180.png    Apple touch icon iPhone
 *   icon-167.png    Apple touch icon iPad Pro
 *   icon-152.png    Apple touch icon iPad
 *   favicon-32.png  Browser tab
 *   favicon-16.png  Browser tab small
 */

const { Resvg } = require('@resvg/resvg-js');
const fs        = require('fs');
const path      = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── SVG builder ─────────────────────────────────────────────────────────────
// All coordinates based on a 512x512 canvas, scaled per size.
function buildSVG(size) {
  const s    = size / 512;
  const rnd  = (n) => Math.round(n * s);

  const sqRadius  = rnd(115);   // squircle corner
  const cellW     = rnd(84);
  const cellH     = rnd(84);
  const cellR     = rnd(12);
  const gap       = rnd(18);

  // Grid top-left origin
  const gx = rnd(54);
  const gy = rnd(172);

  const col = (n) => gx + n * (cellW + gap);
  const row = (n) => gy + n * (cellH + gap);

  const bx  = rnd(406);  // ball centre
  const by  = rnd(74);
  const br  = rnd(58);
  const bsw = Math.max(3, rnd(12));

  const tsw = Math.max(2, rnd(10));
  const da  = `${Math.max(4, rnd(18))} ${Math.max(3, rnd(15))}`;

  // Trajectory cubic: starts near ball bottom, sweeps to highlighted cell
  const t1x = rnd(352); const t1y = rnd(128);
  const tcx = rnd(200); const tcy = rnd(300);
  const t2x = rnd(96);  const t2y = rnd(368);

  // Arrowhead triangle
  const p1 = `${col(0)},${row(2) + cellH}`;
  const p2 = `${rnd(30)},${rnd(412)}`;
  const p3 = `${rnd(78)},${rnd(408)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${sqRadius}" fill="#1D2B45"/>

  <rect x="${col(0)}" y="${row(0)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(1)}" y="${row(0)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(2)}" y="${row(0)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(0)}" y="${row(1)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(1)}" y="${row(1)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(2)}" y="${row(1)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(0)}" y="${row(2)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8"/>
  <rect x="${col(1)}" y="${row(2)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>
  <rect x="${col(2)}" y="${row(2)}" width="${cellW}" height="${cellH}" rx="${cellR}" fill="#F0EEE8" opacity="0.22"/>

  <circle cx="${bx}" cy="${by}" r="${br}" fill="none" stroke="#F0EEE8" stroke-width="${bsw}"/>

  <path d="M${t1x} ${t1y} Q${tcx} ${tcy} ${t2x} ${t2y}"
    fill="none" stroke="#F0EEE8" stroke-width="${tsw}"
    stroke-linecap="round" stroke-dasharray="${da}" opacity="0.85"/>

  <polygon points="${p1} ${p2} ${p3}" fill="#F0EEE8"/>
</svg>`;
}

// ─── Sizes ───────────────────────────────────────────────────────────────────
const targets = [
  { size: 512, file: 'icon-512.png',    desc: 'PWA / Android large'      },
  { size: 192, file: 'icon-192.png',    desc: 'PWA / Android standard'   },
  { size: 180, file: 'icon-180.png',    desc: 'Apple touch — iPhone'     },
  { size: 167, file: 'icon-167.png',    desc: 'Apple touch — iPad Pro'   },
  { size: 152, file: 'icon-152.png',    desc: 'Apple touch — iPad'       },
  { size: 32,  file: 'favicon-32.png',  desc: 'Browser favicon'          },
  { size: 16,  file: 'favicon-16.png',  desc: 'Browser favicon small'    },
];

// ─── Convert ─────────────────────────────────────────────────────────────────
console.log('\nPitchShuffle icon converter\n' + '─'.repeat(44));

let ok = 0;
for (const { size, file, desc } of targets) {
  try {
    const svg    = buildSVG(size);
    const resvg  = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
    const png    = resvg.render().asPng();
    fs.writeFileSync(path.join(OUT_DIR, file), png);
    console.log(`  ✓  ${file.padEnd(22)} ${String(size).padStart(4)}px  ${desc}`);
    ok++;
  } catch (err) {
    console.error(`  ✗  ${file}: ${err.message}`);
  }
}

console.log(`\n  ${ok}/${targets.length} icons written to public/images/\n`);

if (ok === targets.length) {
  console.log('Add these to your boilerplate.ejs <head> for full coverage:');
  console.log('');
  console.log('  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">');
  console.log('  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16.png">');
  console.log('  <link rel="apple-touch-icon" sizes="180x180" href="/images/icon-180.png">');
  console.log('  <link rel="apple-touch-icon" sizes="167x167" href="/images/icon-167.png">');
  console.log('  <link rel="apple-touch-icon" sizes="152x152" href="/images/icon-152.png">');
  console.log('');
}
