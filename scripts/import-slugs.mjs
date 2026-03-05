#!/usr/bin/env node
/**
 * Import Greenhouse slugs from a CSV file into the database.
 *
 * Usage:
 *   node scripts/import-slugs.mjs <path-to-csv>
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
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/import-slugs.mjs <path-to-csv>')
  process.exit(1)
}

const raw = readFileSync(csvPath, 'utf8')
const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

// Skip header row if it looks like a column name (non-slug string)
const slugPattern = /^[a-z0-9_-]+$/
const slugs = lines.filter(l => slugPattern.test(l))

if (slugs.length === 0) {
  console.error('No valid slugs found in the CSV.')
  process.exit(1)
}

console.log(`Found ${slugs.length} slugs. Upserting into greenhouse_slugs...`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Batch upsert in chunks of 500 to stay within request limits
const BATCH = 500
let inserted = 0
for (let i = 0; i < slugs.length; i += BATCH) {
  const batch = slugs.slice(i, i + BATCH).map(slug => ({ slug }))
  const { error } = await supabase
    .from('greenhouse_slugs')
    .upsert(batch, { onConflict: 'slug', ignoreDuplicates: true })
  if (error) {
    console.error(`Batch ${i}–${i + BATCH} failed:`, error.message)
    process.exit(1)
  }
  inserted += batch.length
  console.log(`  ${inserted}/${slugs.length} processed`)
}

console.log('Done. All slugs imported (duplicates skipped).')
