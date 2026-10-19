import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, extractCompanySection, getStatePath } from '@/lib/coaching-state'
import { webResearch, structuredCall, errorResponse, slugify } from '@/lib/research'
import type { InterviewerDossier, InterviewerResult } from '@/lib/types'

export const maxDuration = 300

const DIR = path.join(process.cwd(), 'data', 'interviewers')
const filePath = (company: string, name: string) => path.join(DIR, `${slugify(company)}--${slugify(name)}.json`)

const list = (description: string) => ({ type: 'array', items: { type: 'string' }, description })

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'title', 'identityConfidence', 'identityBasis', 'careerPath', 'publicActivity',
    'likelyFocus', 'sharedBackground', 'rapportHooks', 'questionsForThem', 'avoid'],
  properties: {
    summary: { type: 'string', description: 'Two sentences on who this person is and what they will care about in this interview' },
    title: { type: 'string', description: 'Current title, or empty string if unconfirmed' },
    identityConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    identityBasis: { type: 'string', description: 'Why we believe the profile found is this interviewer' },
    careerPath: list('Roles newest first, like "Sr. Director of CS, Workday, 2018 to now". Mark third party sources.'),
    publicActivity: {
      type: 'array',
      description: 'Posts, talks, podcasts or articles. Empty if none found.',
      items: {
        type: 'object', additionalProperties: false, required: ['what', 'date', 'url'],
        properties: { what: { type: 'string' }, date: { type: 'string' }, url: { type: 'string' } },
      },
    },
    likelyFocus: list('What they will probe and why, each with its basis'),
    sharedBackground: list('Real overlap with the candidate, like past companies, schools, industries or mutual communities. Empty if none found.'),
    rapportHooks: list('One or two natural openers grounded in their public work. Nothing personal.'),
    questionsForThem: list('Three questions tailored to this person'),
    avoid: list('Things that would land badly with this person, with the reason'),
  },
}

// Add or replace a dated deep dive summary on this person's Interviewer intel line in coaching_state.md
function saveToCoachingFile(company: string, name: string, linkedin: string | undefined, d: InterviewerDossier) {
  const content = loadCoachingStateRaw()
  const section = extractCompanySection(content, company)
  if (!section) return
  const today = new Date().toISOString().slice(0, 10)
  const note = `Deep dive ${today} (${d.identityConfidence} confidence): ${d.summary}`
  const lines = section.split('\n')
  const intelAt = lines.findIndex(l => l.startsWith('- Interviewer intel:'))
  const first = name.split(' ')[0].toLowerCase()

  let updated: string[]
  const personAt = intelAt < 0 ? -1 : lines.findIndex((l, i) => i > intelAt && /^\s+- /.test(l) && l.toLowerCase().includes(first))
  if (personAt >= 0) {
    updated = [...lines]
    updated[personAt] = lines[personAt].replace(/ Deep dive \d{4}-\d{2}-\d{2} \([a-z]+ confidence\): .*$/, '') + ' ' + note
  } else if (intelAt >= 0) {
    let end = intelAt + 1
    while (end < lines.length && /^\s+- /.test(lines[end])) end++
    updated = [...lines.slice(0, end), `  - ${name}: ${linkedin ? linkedin + ' ' : ''}${note}`, ...lines.slice(end)]
  } else {
    updated = [...lines, '- Interviewer intel:', `  - ${name}: ${linkedin ? linkedin + ' ' : ''}${note}`]
  }
  fs.writeFileSync(getStatePath(), content.replace(section, updated.join('\n')), 'utf-8')
}

// GET — saved dossier for one interviewer
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const company = p.get('company'), name = p.get('name')
  if (!company || !name) return NextResponse.json({ error: 'Missing company or name' }, { status: 400 })
  try { return NextResponse.json(JSON.parse(fs.readFileSync(filePath(company, name), 'utf-8'))) } catch { return NextResponse.json(null) }
}

// POST — research one interviewer and save the dossier
export async function POST(req: NextRequest) {
  const { company, name, linkedin, notes } = await req.json() as { company?: string; name?: string; linkedin?: string; notes?: string }
  if (!company?.trim() || !name?.trim()) return NextResponse.json({ error: 'Missing company or name' }, { status: 400 })

  const coachingState = loadCoachingStateRaw()
  const shortName = company.split(' — ')[0].trim()
  const role = company.split(' — ').slice(1).join(' — ')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const { notes: research, sources } = await webResearch(client, `Research ${name}, who is interviewing a candidate for ${role || 'a role'} at ${shortName}.
${linkedin ? `Their LinkedIn: ${linkedin}` : 'No LinkedIn URL was given, so confirm identity carefully.'}
What the candidate already knows: ${notes || '(nothing)'}

Find their current title and tenure, career path, and public activity (LinkedIn posts, talks, podcasts, articles, quotes in press). Only use a profile when the company clearly matches. Report each fact with its source URL and say which sources are third party (ZoomInfo, RocketReach and the like). Do not look into anything personal or outside professional life.`, { searches: 6, fetches: 5 })

    const dossier = await structuredCall<InterviewerDossier>(client, `Build an interviewer dossier on ${name} for the candidate's ${shortName} ${role} loop.

Research notes:
${research || '(no research available)'}

Compare their background with the candidate's coaching file to find real shared background, and tailor the questions and rapport hooks to this person. If the research could not confirm who they are, set identityConfidence to low and keep the rest general.`, SCHEMA, coachingState)

    const result: InterviewerResult = { company, name, dossier, sources, generatedAt: new Date().toISOString() }
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(filePath(company, name), JSON.stringify(result, null, 2), 'utf-8')
    saveToCoachingFile(company, name, linkedin, dossier)
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = errorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
