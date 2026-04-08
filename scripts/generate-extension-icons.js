// Generates icon-16.png, icon-48.png, icon-128.png from the SVG source
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SRC = path.join(__dirname, '../chrome-extension/icon.svg')
const OUT = path.join(__dirname, '../chrome-extension')

const sizes = [16, 48, 128]

;(async () => {
  const svg = fs.readFileSync(SRC)
  for (const size of sizes) {
    const dest = path.join(OUT, `icon-${size}.png`)
    await sharp(svg).resize(size, size).png().toFile(dest)
    console.log(`Generated ${dest}`)
  }
})()
