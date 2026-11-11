// Generates the PWA icons with node stdlib only: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const ACCENT = [0x2b, 0x7a, 0x4b]
const WHITE = [255, 255, 255]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const png = (size, rgb) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = rgb[y * size + x][0]; raw[o + 1] = rgb[y * size + x][1]; raw[o + 2] = rgb[y * size + x][2]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

// Balance scale glyph on a 100x100 design grid, centred and scaled by `glyph` (fraction of the canvas).
const inGlyph = (u, v) => {
  const rect = (x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1
  const pan = (cx) => { // half disc hanging from the beam
    const dx = u - cx, dy = v - 52
    return dy >= 0 && dx * dx + dy * dy <= 16 * 16
  }
  const beam = rect(14, 26, 86, 31)
  const post = rect(47, 18, 53, 80)
  const base = rect(30, 80, 70, 86)
  const strings = [rect(19, 31, 21, 52), rect(29, 31, 31, 52), rect(69, 31, 71, 52), rect(79, 31, 81, 52)]
  return beam || post || base || strings.some(Boolean) || pan(25) || pan(75)
}
const render = (size, glyph) => {
  const px = new Array(size * size)
  const margin = (1 - glyph) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size - margin) / glyph * 100
      const v = ((y + 0.5) / size - margin) / glyph * 100
      px[y * size + x] = inGlyph(u, v) ? WHITE : ACCENT
    }
  }
  return png(size, px)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', render(192, 0.84))
writeFileSync('public/icons/icon-512.png', render(512, 0.84))
// Maskable: the whole glyph stays inside the central 80% safe zone.
writeFileSync('public/icons/maskable-512.png', render(512, 0.6))
