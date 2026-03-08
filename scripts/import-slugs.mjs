#!/usr/bin/env node
/**
 * Import company slugs from a CSV file into the database.
 *
 * Usage:
 *   node scripts/import-slugs.mjs <path-to-csv>                      # imports into greenhouse_slugs (default)
 *   node scripts/import-slugs.mjs --table ashby_slugs <path-to-csv>  # imports into ashby_slugs
 *
 * The CSV must have one slug per line (with or without a header row).
 * Re-running is safe — existing slugs are left untouched (ON CONFLICT DO NOTHING).
 *
 * Requires .env.local (or environment variables):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

// Parse .env.local manually (no dotenv dependency needed)
function loadEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // .env.local not found — rely on real env vars
  }
}
loadEnv(resolve(process.cwd(), '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Parse CLI args: optional --table <name> followed by <path-to-csv>
const VALID_TABLES = ['greenhouse_slugs', 'ashby_slugs']
let tableName = 'greenhouse_slugs'
let csvPath = null

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--table') {
    tableName = args[++i]
    if (!VALID_TABLES.includes(tableName)) {
      console.error(`Invalid table "${tableName}". Must be one of: ${VALID_TABLES.join(', ')}`)
      process.exit(1)
    }
  } else {
    csvPath = args[i]
  }
}

if (!csvPath) {
  console.error('Usage: node scripts/import-slugs.mjs [--table greenhouse_slugs|ashby_slugs] <path-to-csv>')
  process.exit(1)
}

const raw = readFileSync(csvPath, 'utf8')
const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

// Filter out header rows and blank lines; allow uppercase and spaces (Ashby slugs can have both)
const slugPattern = /^[a-zA-Z0-9 _-]+$/
const slugs = lines.filter(l => slugPattern.test(l))

if (slugs.length === 0) {
  console.error('No valid slugs found in the CSV.')
  process.exit(1)
}

console.log(`Found ${slugs.length} slugs. Upserting into ${tableName}...`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Batch upsert in chunks of 500 to stay within request limits
const BATCH = 500
let inserted = 0
for (let i = 0; i < slugs.length; i += BATCH) {
  const batch = slugs.slice(i, i + BATCH).map(slug => ({ slug }))
  const { error } = await supabase
    .from(tableName)
    .upsert(batch, { onConflict: 'slug', ignoreDuplicates: true })
  if (error) {
    console.error(`Batch ${i}–${i + BATCH} failed:`, error.message)
    process.exit(1)
  }
  inserted += batch.length
  console.log(`  ${inserted}/${slugs.length} processed`)
}

console.log('Done. All slugs imported (duplicates skipped).')
