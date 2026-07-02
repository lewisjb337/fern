import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'assets', 'logo.svg'))

const sizes = [16, 32, 48, 64, 128, 256, 512]

// Generate PNG for each size
for (const size of sizes) {
  const out = join(root, 'assets', `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`Generated ${out}`)
}

// Generate main icon.png at 256
await sharp(svg).resize(256, 256).png().toFile(join(root, 'assets', 'icon.png'))
console.log('Generated icon.png')

// Build a minimal .ico file (multi-size: 16, 32, 48, 256)
// ICO format: header + directory + image data (as PNG for sizes >= 64, BMP-style otherwise)
// Easiest: just use the PNG embedding format (Vista+ ICO)
const icoSizes = [16, 32, 48, 256]
const pngBuffers = await Promise.all(
  icoSizes.map(s => sharp(svg).resize(s, s).png().toBuffer())
)

// ICO header
const numImages = icoSizes.length
const headerSize = 6
const dirEntrySize = 16
const dirSize = numImages * dirEntrySize

let offset = headerSize + dirSize

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)   // reserved
header.writeUInt16LE(1, 2)   // type: 1 = ICO
header.writeUInt16LE(numImages, 4)

const dirEntries = []
for (let i = 0; i < icoSizes.length; i++) {
  const s = icoSizes[i]
  const entry = Buffer.alloc(16)
  entry.writeUInt8(s === 256 ? 0 : s, 0)  // width (0 = 256)
  entry.writeUInt8(s === 256 ? 0 : s, 1)  // height
  entry.writeUInt8(0, 2)  // color count
  entry.writeUInt8(0, 3)  // reserved
  entry.writeUInt16LE(1, 4)  // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngBuffers[i].length, 8) // size of image data
  entry.writeUInt32LE(offset, 12) // offset of image data
  offset += pngBuffers[i].length
  dirEntries.push(entry)
}

const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers])
const icoPath = join(root, 'assets', 'icon.ico')
writeFileSync(icoPath, ico)
console.log(`Generated ${icoPath}`)
