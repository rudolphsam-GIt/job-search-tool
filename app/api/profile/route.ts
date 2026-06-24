import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, parseProfile } from '@/lib/coaching-state'
import type { ProfileOverrides } from '@/lib/types'

const STORE_PATH = path.join(process.cwd(), 'data', 'jobs-store.json')

function readOverrides(): ProfileOverrides {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
    return raw.profileOverrides || {}
  } catch {
    return {}
  }
}

export async function GET() {
  const content = loadCoachingStateRaw()
  if (!content) {
    return NextResponse.json(
      { profile: null, error: 'coaching_state.md not found' },
      { status: 404 }
    )
  }
  const parsed = parseProfile(content)
  const ov = readOverrides()

  // Overrides win when non-empty; otherwise fall back to parsed coaching state
  const profile = {
    ...parsed,
    name: ov.name?.trim() || parsed.name,
    targetRoles: ov.targetRoles?.length ? ov.targetRoles : parsed.targetRoles,
    seniorityBand: ov.seniorityBand?.trim() || parsed.seniorityBand,
    strengths: ov.strengths?.length ? ov.strengths : parsed.strengths,
    pastEmployers: ov.pastEmployers?.length ? ov.pastEmployers : parsed.pastEmployers,
  }

  return NextResponse.json({ profile })
}
