// Generates the PWA / Apple icons from an on-brand SVG.
// Run with: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'public')

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#15123a"/>
      <stop offset="1" stop-color="#07060f"/>
    </linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c6cff"/>
      <stop offset="0.5" stop-color="#ff7eb6"/>
      <stop offset="1" stop-color="#5ad1cd"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="38"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g filter="url(#soft)" opacity="0.55">
    <circle cx="120" cy="110" r="150" fill="#7c6cff"/>
    <circle cx="410" cy="140" r="140" fill="#ff7eb6"/>
    <circle cx="300" cy="470" r="150" fill="#5ad1cd"/>
  </g>
  <g fill="none" stroke="url(#wave)" stroke-linecap="round">
    <path d="M96 196 C 180 126, 250 266, 340 196 S 470 126, 470 196" stroke-width="36" opacity="0.95"/>
    <path d="M96 316 C 180 246, 250 386, 340 316 S 470 246, 470 316" stroke-width="36" opacity="0.7"/>
  </g>
</svg>`

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

const buf = Buffer.from(svg)
for (const t of targets) {
  await sharp(buf, { density: 384 }).resize(t.size, t.size).png().toFile(join(out, t.name))
  console.log('wrote', t.name)
}
