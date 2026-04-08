// Creates bamboo-job-tracker.zip ready for Chrome Web Store upload
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const EXT = path.join(ROOT, 'chrome-extension')
const OUT = path.join(ROOT, 'bamboo-job-tracker.zip')

if (fs.existsSync(OUT)) fs.unlinkSync(OUT)

// Files to include in the zip
const files = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'icon-16.png',
  'icon-48.png',
  'icon-128.png',
]

// Verify all files exist
for (const f of files) {
  const p = path.join(EXT, f)
  if (!fs.existsSync(p)) {
    console.error(`Missing required file: ${f}`)
    process.exit(1)
  }
}

const fileArgs = files.join(' ')
execSync(`cd "${EXT}" && zip "${OUT}" ${fileArgs}`, { stdio: 'inherit' })
console.log(`\nCreated: ${OUT}`)
console.log('\nBefore submitting to Chrome Web Store, you still need:')
console.log('  1. Privacy policy URL (required — extension collects user auth data)')
console.log('  2. At least 1 screenshot: 1280x800 or 640x400 PNG/JPEG')
console.log('  3. Promotional tile: 440x280 PNG')
console.log('  4. Google developer account ($5 one-time fee, 2-step verification enabled)')
console.log('  5. Upload at: https://chrome.google.com/webstore/devconsole')
