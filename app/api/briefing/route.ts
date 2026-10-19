import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, extractCompanySection } from '@/lib/coaching-state'
import { fetchNews } from '@/lib/news'
import { webResearch, structuredCall, errorResponse, slugify } from '@/lib/research'
import type { Briefing, BriefingResult } from '@/lib/types'

export const maxDuration = 300

const DIR = path.join(process.cwd(), 'data', 'briefing')
const filePath = (company: string) => path.join(DIR, `${slugify(company)}.json`)

function readSaved(company: string): BriefingResult | null {
  try { return JSON.parse(fs.readFileSync(filePath(company), 'utf-8')) } catch { return null }
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['snapshot', 'items', 'talkingPoints', 'watchOuts', 'questionsFromNews'],
  properties: {
    snapshot: { type: 'string', description: 'Two or three sentences on what the company is focused on right now' },
    items: {
      type: 'array',
      description: 'Five to eight of the most interview relevant developments from roughly the last six months, newest first',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'date', 'category', 'summary', 'soWhat', 'howToUse', 'sourceUrl'],
        properties: {
          headline: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD or YYYY-MM if the day is unknown' },
          category: { type: 'string', enum: ['earnings', 'funding', 'leadership', 'product', 'layoffs', 'strategy', 'partnership', 'other'] },
          summary: { type: 'string', description: 'What happened, one or two sentences' },
          soWhat: { type: 'string', description: 'Why it matters for this role and this candidate specifically' },
          howToUse: { type: 'string', description: 'A natural first person line the candidate could say in the interview, or advice not to raise it' },
          sourceUrl: { type: 'string', description: 'The URL this came from. Must be one of the researched pages.' },
        },
      },
    },
    talkingPoints: { type: 'array', items: { type: 'string' }, description: 'Two or three ways to connect company priorities to the candidate stories, naming story IDs' },
    watchOuts: { type: 'array', items: { type: 'string' }, description: 'Sensitive topics to handle carefully, like layoffs or a rough quarter. Empty if none.' },
    questionsFromNews: { type: 'array', items: { type: 'string' }, description: 'Two or three sharp questions to ask that only someone who read this would ask' },
  },
}

// GET — the saved briefing for a loop, if any
export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })
  return NextResponse.json(readSaved(company))
}

// POST — research the company and save a fresh briefing, flagging what's new since the last one
export async function POST(req: NextRequest) {
  const { company } = await req.json() as { company?: string }
  if (!company?.trim()) return NextResponse.json({ error: 'Missing company' }, { status: 400 })

  const coachingState = loadCoachingStateRaw()
  const section = extractCompanySection(coachingState, company)
  const shortName = company.split(' — ')[0].trim()
  const role = company.split(' — ').slice(1).join(' — ')
  const previous = readSaved(company)
  const headlines = await fetchNews(shortName, 10)
  const today = new Date().toISOString().slice(0, 10)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const { notes, sources } = await webResearch(client, `Today is ${today}. Build a current briefing on ${shortName} for a candidate interviewing for ${role || 'a role there'}.

Recent headlines from Google News, as leads to check:
${headlines.map(h => `- ${h.title} (${h.pubDate}) ${h.link}`).join('\n') || '(none found)'}

What the candidate's coaching file says about this company:
${section || '(nothing yet)'}

Find what has happened in roughly the last six months: earnings or funding, leadership changes, layoffs or reorgs, product launches, acquisitions, partnerships, and the priorities executives are stating publicly (earnings calls, shareholder letters, keynotes, company blog). Pay extra attention to anything that touches the team or product area this role sits in. Report notes with a date and source URL for each item, and mark anything you inferred.`)

    const briefing = await structuredCall<Briefing>(client, `Turn this research into an interview briefing on ${shortName} for the ${role || 'role'} loop. Today is ${today}.

Research notes:
${notes || '(no research available)'}

Connect the "so what" lines to the candidate's real background and storybank. Only include items that have a source URL from the research. If something is sensitive, like layoffs, say how to handle it rather than suggesting the candidate bring it up.`, SCHEMA, coachingState)

    // Flag items whose headline didn't appear last time
    if (previous) {
      const seen = new Set(previous.briefing.items.map(i => i.headline.toLowerCase()))
      briefing.items = briefing.items.map(i => ({ ...i, isNew: !seen.has(i.headline.toLowerCase()) }))
    }

    const result: BriefingResult = {
      company,
      briefing,
      sources,
      generatedAt: new Date().toISOString(),
      previousGeneratedAt: previous?.generatedAt,
    }
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(filePath(company), JSON.stringify(result, null, 2), 'utf-8')
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = errorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
