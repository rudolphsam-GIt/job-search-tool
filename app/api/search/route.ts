import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw } from '@/lib/coaching-state'
import { fetchAllSources, jobMatchesQuery, jobRelevanceScore, capPerCompany, dedupeJobs, isUSEligible, isLikelyRemote } from '@/lib/job-sources'
import type { RemoteJob, SearchPrefs, ProfileOverrides } from '@/lib/types'
import { DEFAULT_SEARCH_PREFS } from '@/lib/types'

const STORE_PATH = path.join(process.cwd(), 'data', 'jobs-store.json')

function readStore(): { prefs: SearchPrefs; overrides: ProfileOverrides } {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
    return {
      prefs: { ...DEFAULT_SEARCH_PREFS, ...(raw.searchPrefs || {}) },
      overrides: raw.profileOverrides || {},
    }
  } catch {
    return { prefs: DEFAULT_SEARCH_PREFS, overrides: {} }
  }
}

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
    if (!isUSEligible(j.candidate_required_location)) return false
    if (!isLikelyRemote(j.candidate_required_location, j.description)) return false
    if (excludePatterns.some(p => p.test(j.title))) return false
    if (requireTerms.length > 0 && !requireTerms.some(t => titleLower.includes(t))) return false
    if (blacklist.some(b => companyLower.includes(b) || b.includes(companyLower))) return false
    if (prefs.minSalary) {
      const salaryMax = parseSalaryMax(j.salary)
      if (salaryMax !== null && salaryMax < prefs.minSalary) return false
    }
    return true
  })
}

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  const coachingState = loadCoachingStateRaw()
  const { prefs, overrides: ov } = readStore()

  let searchQuery = query?.trim()
  if (!searchQuery && coachingState) {
    const match = coachingState.match(/- Target role\(s\): (.+)/)
    if (match) searchQuery = match[1].split(',')[0].replace(/\//g, ' ').trim()
  }
  searchQuery = searchQuery || 'customer success manager'

  const allJobs = await fetchAllSources()

  // Filter by query then apply user prefs
  const filtered = applyPrefilters(
    allJobs.filter(j => jobMatchesQuery(j, searchQuery)),
    prefs
  )

  // Deduplicate by id, then collapse same title+company+location postings under
  // different ids (e.g. a company posting identical headcount reqs twice)
  const seen = new Map<number, RemoteJob>()
  for (const j of filtered) {
    if (!seen.has(j.id)) seen.set(j.id, j)
  }
  const deduped = dedupeJobs(Array.from(seen.values()))
  // Sort by relevance before truncating so the LLM sees the closest titles first,
  // not just whatever the source APIs happened to return first. Cap per-company
  // duplicates so one employer's many near-identical listings can't crowd out
  // other companies and role types (e.g. partnership roles vs. CS roles).
  const sorted = deduped
    .sort((a, b) => jobRelevanceScore(b, searchQuery) - jobRelevanceScore(a, searchQuery))
  const jobs = capPerCompany(sorted, 3).slice(0, 50)

  if (jobs.length === 0) {
    return NextResponse.json({ jobs: [], query: searchQuery })
  }

  const jobSummaries = jobs.map((j, i) => ({
    index: i,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    tags: (j.tags || []).slice(0, 5),
    salary: j.salary || '',
    description: (j.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
  }))

  const excludeLine = prefs.excludeTitleKeywords.length
    ? `EXCLUDE (omit entirely): Roles with these keywords in the title: ${prefs.excludeTitleKeywords.join(', ')}.`
    : 'EXCLUDE: Account Executive, Sales Engineer, Solutions Engineer (pre-sales quota roles).'

  const dreamLine = prefs.dreamCompanies.length
    ? `DREAM COMPANIES: Add +2 to fitScore for any role at: ${prefs.dreamCompanies.join(', ')}.`
    : ''

  const salaryLine = prefs.minSalary
    ? `SALARY FLOOR: $${Math.round(prefs.minSalary / 1000)}k minimum. Score 0 and omit if listed max is explicitly below this.`
    : ''

  const aiContextLine = ov.aiContext?.trim()
    ? `\nAdditional candidate context:\n${ov.aiContext.trim()}\n`
    : ''

  const resumeLine = ov.resumeText?.trim()
    ? `\nCandidate resume (extracted text):\n<resume>\n${ov.resumeText.trim().slice(0, 6000)}\n</resume>\n`
    : ''

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const rankingMessage = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3072,
    messages: [{
      role: 'user',
      content: `Rank these remote job opportunities for this candidate. Only return jobs scoring 4 or above.

${excludeLine}
LOCATION: Candidate is US-based. Score 0 and omit any role restricted to non-US geographies (e.g. Europe Only, UK Only, LATAM, APAC). Remote, Worldwide, Anywhere, and US-specific roles are all fine. If a listing says "remote" but ties that to residency in or near a specific city/metro (e.g. "fully remote in Washington, DC"), don't treat it as unrestricted remote — note the residency requirement explicitly in fitReason and reduce fitScore accordingly.
PRIORITIZE: B2B SaaS companies get +1 to fitScore.
${dreamLine}
${salaryLine}

Candidate profile:
<coaching_state>
${coachingState.slice(0, 3000)}
</coaching_state>
${aiContextLine}${resumeLine}

Jobs:
${JSON.stringify(jobSummaries, null, 2)}

Return ONLY a JSON array sorted by fitScore descending (no markdown):
[{"index": 0, "fitScore": 8, "fitReason": "one sentence", "flag": "strong_match"}]

flag values: "strong_match" (8-10), "good_match" (6-7), "stretch" (4-5). Omit below 4.`,
    }],
  })

  const rankingRaw = rankingMessage.content[0].type === 'text' ? rankingMessage.content[0].text : '[]'
  let rankings: Array<{ index: number; fitScore: number; fitReason: string; flag: string }>
  try {
    const m = rankingRaw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    rankings = JSON.parse(m ? m[1] : rankingRaw)
  } catch {
    rankings = []
  }

  const rankedJobs = rankings
    .filter(r => r.index < jobs.length)
    .map(r => ({
      ...jobs[r.index],
      description: (jobs[r.index].description || '').replace(/<[^>]+>/g, '').slice(0, 350),
      fitScore: r.fitScore,
      fitReason: r.fitReason,
      flag: r.flag,
    }))

  return NextResponse.json({ jobs: rankedJobs, query: searchQuery })
}
