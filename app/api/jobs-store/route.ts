import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { RemoteJob, SearchPrefs, ProfileOverrides } from '@/lib/types'
import { DEFAULT_SEARCH_PREFS } from '@/lib/types'

const STORE_PATH = path.join(process.cwd(), 'data', 'jobs-store.json')

export interface GreenhouseBoard { slug: string; name: string }

interface JobStore {
  saved: RemoteJob[]
  applied: RemoteJob[]
  active: RemoteJob[]
  archived: RemoteJob[]
  skipped: number[]
  seen: Record<string, string>  // jobId → date first seen
  lastSearched: string | null
  newJobs: RemoteJob[]
  customGreenhouse: GreenhouseBoard[]
  searchPrefs: SearchPrefs
  profileOverrides: ProfileOverrides
}

function readStore(): JobStore {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
    return {
      saved: raw.saved || [],
      applied: raw.applied || [],
      active: raw.active || [],
      archived: raw.archived || [],
      skipped: raw.skipped || [],
      seen: raw.seen || {},
      lastSearched: raw.lastSearched || null,
      newJobs: raw.newJobs || [],
      customGreenhouse: raw.customGreenhouse || [],
      searchPrefs: { ...DEFAULT_SEARCH_PREFS, ...(raw.searchPrefs || {}) },
      profileOverrides: raw.profileOverrides || {},
    }
  } catch {
    return { saved: [], applied: [], active: [], archived: [], skipped: [], seen: {}, lastSearched: null, newJobs: [], customGreenhouse: [], searchPrefs: DEFAULT_SEARCH_PREFS, profileOverrides: {} }
  }
}

function writeStore(store: JobStore) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export async function GET() {
  return NextResponse.json(readStore())
}

export async function POST(req: NextRequest) {
  const { action, job, newStatus, slug, name, prefs, profileOverrides } = await req.json()
  const store = readStore()
  const today = new Date().toISOString().slice(0, 10)

  if (action === 'save' && job) {
    if (!store.saved.find(s => s.id === job.id)) {
      store.saved.unshift({ ...job, savedAt: today } as RemoteJob & { savedAt: string })
    }
    store.seen[job.id] = store.seen[job.id] || today
    store.newJobs = store.newJobs.filter(j => j.id !== job.id)
  }

  if (action === 'skip' && job) {
    if (!store.skipped.includes(job.id)) store.skipped.push(job.id)
    store.seen[job.id] = store.seen[job.id] || today
    store.newJobs = store.newJobs.filter(j => j.id !== job.id)
  }

  if (action === 'unsave' && job) {
    store.saved = store.saved.filter(s => s.id !== job.id)
  }

  if (action === 'setStatus' && job) {
    if (newStatus) {
      store.saved = store.saved.filter(s => s.id !== job.id)
      store.applied = store.applied.filter(s => s.id !== job.id)
      store.active = store.active.filter(s => s.id !== job.id)
      store.archived = store.archived.filter(s => s.id !== job.id)
      const updated = { ...job, status: newStatus as RemoteJob['status'] }
      if (newStatus === 'saved') store.saved.unshift(updated)
      else if (newStatus === 'applied') store.applied.unshift(updated)
      else if (newStatus === 'active') store.active.unshift(updated)
      else if (newStatus === 'archived') store.archived.unshift(updated)
    }
  }

  if (action === 'addGreenhouse' && slug) {
    if (!store.customGreenhouse.find(b => b.slug === slug)) {
      store.customGreenhouse.push({ slug, name: name || slug })
    }
  }

  if (action === 'removeGreenhouse' && slug) {
    store.customGreenhouse = store.customGreenhouse.filter(b => b.slug !== slug)
  }

  if (action === 'savePrefs' && prefs) {
    store.searchPrefs = { ...DEFAULT_SEARCH_PREFS, ...prefs }
    // Changing prefs should force a fresh search next time
    store.lastSearched = null
  }

  if (action === 'saveProfile' && profileOverrides !== undefined) {
    store.profileOverrides = profileOverrides
    // Profile change affects search keywords — force a fresh search next time
    store.lastSearched = null
  }

  writeStore(store)
  return NextResponse.json(store)
}
