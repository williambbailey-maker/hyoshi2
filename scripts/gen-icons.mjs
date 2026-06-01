// Generates the PWA / Apple icons from an on-brand SVG.
// Run with: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'public')

// Ensure the output folder exists (it's empty in git, so it won't exist on a
// fresh checkout such as Vercel's build environment).
mkdirSync(out, { recursive: true })

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#2a4cf4"/>
  <g fill="none" stroke-linecap="round">
    <path d="M88 188 C 176 112, 256 268, 344 188 S 470 112, 470 188" stroke="#c8f531" stroke-width="40"/>
    <path d="M88 322 C 176 246, 256 402, 344 322 S 470 246, 470 322" stroke="#ffffff" stroke-width="40"/>
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
