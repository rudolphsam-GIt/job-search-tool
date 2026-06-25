import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw } from '@/lib/coaching-state'
import { fetchAllSources, jobMatchesQuery, jobRelevanceScore, capPerCompany, isUSEligible } from '@/lib/job-sources'
import type { RemoteJob, SearchPrefs, ProfileOverrides } from '@/lib/types'
import { DEFAULT_SEARCH_PREFS } from '@/lib/types'

const STORE_PATH = path.join(process.cwd(), 'data', 'jobs-store.json')

interface JobStore {
  saved: RemoteJob[]
  skipped: number[]
  seen: Record<string, string>
  lastSearched: string | null
  newJobs: RemoteJob[]
  searchPrefs?: SearchPrefs
  profileOverrides?: ProfileOverrides
}

function readStore(): JobStore {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
  } catch {
    return { saved: [], skipped: [], seen: {}, lastSearched: null, newJobs: [] }
  }
}

function writeStore(store: JobStore) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

/** Parse a max salary from strings like "$120k–$180k" or "$150k". Returns null if indeterminate. */
function parseSalaryMax(s: string): number | null {
  if (!s) return null
  const range = s.match(/\$(\d+)k[–\-]\$(\d+)k/i)
  if (range) return parseInt(range[2]) * 1000
  const single = s.match(/^\$(\d+)k$/i)
  if (single) return parseInt(single[1]) * 1000
  return null
}

function applyPrefilters(jobs: RemoteJob[], prefs: SearchPrefs): RemoteJob[] {
  const excludePatterns = prefs.excludeTitleKeywords.map(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  const requireTerms = prefs.requireTitleKeywords.map(k => k.toLowerCase())
  const blacklist = prefs.blacklistCompanies.map(c => c.toLowerCase())

  return jobs.filter(j => {
    const titleLower = j.title.toLowerCase()
    const companyLower = j.company_name.toLowerCase()

    // US-only: drop jobs restricted to non-US geographies
    if (!isUSEligible(j.candidate_required_location)) return false

    // Exclude title patterns
    if (excludePatterns.some(p => p.test(j.title))) return false

    // Require at least one title keyword (if list is non-empty)
    if (requireTerms.length > 0 && !requireTerms.some(t => titleLower.includes(t))) return false

    // Company blacklist
    if (blacklist.some(b => companyLower.includes(b) || b.includes(companyLower))) return false

    // Salary floor — only filter if a max is explicitly listed and is below the floor
    if (prefs.minSalary) {
      const salaryMax = parseSalaryMax(j.salary)
      if (salaryMax !== null && salaryMax < prefs.minSalary) return false
    }

    return true
  })
}

function keywordsFromRoles(roles: string[]): string[] {
  const keywords = new Set<string>()
  for (const role of roles) {
    const clean = role.trim().toLowerCase().replace(/[()]/g, '').replace(/\//g, ' ')
    keywords.add(clean)
    if (clean.includes('partner')) keywords.add('partner')
    if (clean.includes('customer success')) keywords.add('customer success')
    if (clean.includes('channel')) keywords.add('channel')
    if (clean.includes('alliance')) keywords.add('alliances')
    if (clean.includes('ecosystem')) keywords.add('ecosystem')
    if (clean.includes('success')) keywords.add('success')
  }
  keywords.add('partner')
  keywords.add('partnerships')
  keywords.add('customer success')
  return Array.from(keywords).slice(0, 10)
}

function extractKeywords(coachingState: string): string[] {
  const match = coachingState.match(/- Target role\(s\): (.+)/)
  if (!match) return ['customer success', 'partner success', 'partnerships']
  return keywordsFromRoles(match[1].split(','))
}


export async function POST(req: NextRequest) {
  const { force } = await req.json().catch(() => ({ force: false }))
  const today = new Date().toISOString().slice(0, 10)
  const store = readStore()

  if (!force && store.lastSearched === today) {
    return NextResponse.json({ newJobs: store.newJobs, alreadyRan: true })
  }

  const coachingState = loadCoachingStateRaw()
  const ov: ProfileOverrides = store.profileOverrides || {}
  const keywords = ov.targetRoles?.length
    ? keywordsFromRoles(ov.targetRoles)
    : extractKeywords(coachingState)
  const prefs: SearchPrefs = { ...DEFAULT_SEARCH_PREFS, ...(store.searchPrefs || {}) }

  const allJobs = await fetchAllSources()

  // Pre-filter by keyword relevance before sending to Claude
  const relevant = allJobs.filter(j => jobMatchesQuery(j, keywords.join(' ')))
  const pool = relevant.length >= 10 ? relevant : allJobs // fallback to all if too few

  // Deduplicate by ID
  const seenMap = new Map<number, RemoteJob>()
  for (const job of pool) {
    if (!seenMap.has(job.id)) seenMap.set(job.id, job)
  }

  const skippedSet = new Set(store.skipped)
  const seenIds = new Set(Object.keys(store.seen).map(Number))
  const savedIds = new Set(store.saved.map(j => j.id))

  // Apply user prefs (title filters, blacklist, salary floor) before handing to Claude
  const candidates = applyPrefilters(
    Array.from(seenMap.values()).filter(
      j => !seenIds.has(j.id) && !skippedSet.has(j.id) && !savedIds.has(j.id)
    ),
    prefs
  )

  if (candidates.length === 0) {
    store.lastSearched = today
    writeStore(store)
    // No new candidates today — keep whatever was already surfaced and not yet reviewed,
    // rather than reporting an empty feed when good matches are still sitting there.
    return NextResponse.json({ newJobs: store.newJobs, alreadyRan: false, keywordsUsed: keywords })
  }

  const keywordQuery = keywords.join(' ')
  // Sort by relevance before truncating so the LLM sees the closest titles first,
  // not just whatever the source APIs happened to return first. Cap per-company
  // duplicates so one employer's many near-identical listings can't crowd out
  // other companies and role types (e.g. partnership roles vs. CS roles).
  const sortedCandidates = [...candidates].sort(
    (a, b) => jobRelevanceScore(b, keywordQuery) - jobRelevanceScore(a, keywordQuery)
  )
  const rankedCandidates = capPerCompany(sortedCandidates, 3)

  const summaries = rankedCandidates.slice(0, 50).map((j, i) => ({
    index: i,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    tags: (j.tags || []).slice(0, 6),
    salary: j.salary || '',
    description: (j.description || '').slice(0, 300),
  }))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const excludeLine = prefs.excludeTitleKeywords.length
    ? `EXCLUDE (omit entirely): Roles with these keywords in the title: ${prefs.excludeTitleKeywords.join(', ')}.`
    : 'EXCLUDE (omit entirely): Account Executive, Sales Engineer, Solutions Engineer (pre-sales quota roles).'

  const dreamLine = prefs.dreamCompanies.length
    ? `DREAM COMPANIES: The candidate especially wants to work at these companies — add +2 to fitScore for any role at: ${prefs.dreamCompanies.join(', ')}.`
    : ''

  const salaryLine = prefs.minSalary
    ? `SALARY FLOOR: Candidate's minimum is $${Math.round(prefs.minSalary / 1000)}k. If a job's listed salary max is explicitly below this, score it 0 and omit.`
    : ''

  const aiContextLine = ov.aiContext?.trim()
    ? `\nAdditional candidate context:\n${ov.aiContext.trim()}\n`
    : ''

  const resumeLine = ov.resumeText?.trim()
    ? `\nCandidate resume (extracted text):\n<resume>\n${ov.resumeText.trim().slice(0, 6000)}\n</resume>\n`
    : ''

  const rankMsg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3072,
    messages: [{
      role: 'user',
      content: `Rank these remote job listings for this candidate. Return any job scoring 4 or above.

${excludeLine}
LOCATION: Candidate is US-based. Score 0 and omit any role restricted to non-US geographies (e.g. Europe Only, UK Only, LATAM, APAC). Roles listed as Remote, Worldwide, Anywhere, or US are all fine.
INCLUDE: Partner, Partnerships, Partner Success, Customer Success, Channel, Enablement, Account Management (post-sale), and similar post-sale or go-to-market roles.
PRIORITIZE: B2B SaaS companies — add +1 to fitScore for any role at a B2B SaaS company vs. equivalent roles in other industries.
${dreamLine}
${salaryLine}

Candidate profile:
<coaching_state>
${coachingState.slice(0, 2500)}
</coaching_state>
${aiContextLine}${resumeLine}

Jobs to rank:
${JSON.stringify(summaries, null, 2)}

Return ONLY a JSON array sorted by fitScore descending (no markdown):
[{"index": 0, "fitScore": 8, "fitReason": "one sentence why this fits", "flag": "strong_match"}]

flag values: "strong_match" (8-10), "good_match" (6-7), "stretch" (4-5). Omit anything below 4.`,
    }],
  })

  const rankRaw = rankMsg.content[0].type === 'text' ? rankMsg.content[0].text : '[]'
  let rankings: Array<{ index: number; fitScore: number; fitReason: string; flag: string }>
  try {
    const m = rankRaw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    rankings = JSON.parse(m ? m[1] : rankRaw)
  } catch {
    rankings = []
  }

  const newJobs: RemoteJob[] = rankings
    .filter(r => r.index < rankedCandidates.length)
    .map(r => ({
      ...rankedCandidates[r.index],
      description: (rankedCandidates[r.index].description || '').replace(/<[^>]+>/g, '').slice(0, 400),
      fitScore: r.fitScore,
      fitReason: r.fitReason,
      flag: r.flag as RemoteJob['flag'],
      foundDate: today,
    } as RemoteJob))

  for (const j of candidates) {
    store.seen[j.id] = today
  }

  // Merge into existing newJobs (instead of replacing) so a same-day re-run that finds
  // nothing new — or fewer matches than before — doesn't erase previously surfaced jobs
  // the candidate hasn't reviewed yet. Drop any that have since been saved/skipped.
  const stillValid = store.newJobs.filter(j => !skippedSet.has(j.id) && !savedIds.has(j.id))
  const merged = new Map<number, RemoteJob>()
  for (const j of stillValid) merged.set(j.id, j)
  for (const j of newJobs) merged.set(j.id, j)

  store.newJobs = Array.from(merged.values()).sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
  store.lastSearched = today
  writeStore(store)

  return NextResponse.json({ newJobs, alreadyRan: false, keywordsUsed: keywords, total: candidates.length, relevant: relevant.length })
}
