import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, extractCompanySection } from '@/lib/coaching-state'
import type { CheatSheet, PrepRequest, PrepResult } from '@/lib/types'

export const maxDuration = 300

const MODEL = 'claude-opus-5-5'
const PREP_DIR = path.join(process.cwd(), 'data', 'prep')
const MAX_CONTINUATIONS = 4

function prepPath(company: string) {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return path.join(PREP_DIR, `${slug}.json`)
}

// Shared rules for both calls. Kept static so the prefix caches across runs.
const COACH_RULES = `You are an expert interview coach preparing a candidate for a specific interview.

Evidence rules:
- Never state company culture, interview process, or interviewer details as fact unless you found a real source or the candidate supplied it. When you are inferring, say so plainly.
- A name alone is not enough to identify an interviewer. Only treat a public profile as theirs when the company and role clearly match.
- Map every likely question to a story ID from the candidate's storybank. Prefer stories rated 4 over stories rated 3.

Writing rules (the candidate reads these as AI voice and rejects them):
- No em dashes, no colons, and no hyphens in prose. Use periods and commas, or restructure. Reword compound modifiers so they need no hyphen.
- No synonym doublets, no rule of three padding, no stacked adjectives.
- Plain, direct, confident and warm. Short sentences. Spoken lines should sound like a person talking, not a résumé.`

const CHEAT_SHEET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'company', 'role', 'interviewer', 'interviewDate', 'remember', 'positioning', 'priorities',
    'stories', 'likelyQuestions', 'leadConcern', 'otherConcerns', 'bestQuestion',
    'backupQuestions', 'interviewerRead', 'confidence', 'caveats',
  ],
  properties: {
    company: { type: 'string' },
    role: { type: 'string' },
    interviewer: { type: 'string', description: 'Interviewer name, or empty string if unknown' },
    interviewDate: { type: 'string', description: 'As the candidate gave it, or empty string' },
    remember: { type: 'string', description: 'The single most important thing to keep in mind, two sentences at most' },
    positioning: { type: 'string', description: 'A one or two sentence positioning line the candidate can say out loud, first person' },
    priorities: { type: 'array', items: { type: 'string' }, description: "The role's top three priorities, from the job description" },
    stories: {
      type: 'array',
      description: 'The three stories to lead with, strongest first',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'title', 'hook'],
        properties: {
          id: { type: 'string', description: 'Storybank ID such as S002' },
          title: { type: 'string' },
          hook: { type: 'string', description: 'The numbers and the one detail that makes it land, one or two sentences' },
        },
      },
    },
    likelyQuestions: {
      type: 'array',
      description: 'Six to eight likely questions',
      items: {
        type: 'object', additionalProperties: false, required: ['question', 'storyId'],
        properties: {
          question: { type: 'string' },
          storyId: { type: 'string', description: 'Storybank ID, or "Gap" when no story fits' },
        },
      },
    },
    leadConcern: {
      type: 'object', additionalProperties: false, required: ['concern', 'counter'],
      properties: {
        concern: { type: 'string', description: 'The concern most likely to come up' },
        counter: { type: 'string', description: 'A first person line the candidate can say to name it before the interviewer does' },
      },
    },
    otherConcerns: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['concern', 'counter'],
        properties: { concern: { type: 'string' }, counter: { type: 'string' } },
      },
    },
    bestQuestion: { type: 'string', description: 'The single best question to ask this interviewer' },
    backupQuestions: { type: 'array', items: { type: 'string' } },
    interviewerRead: { type: 'string', description: 'What this interviewer will likely focus on and why, with the basis for the read' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    caveats: { type: 'string', description: 'What this prep is assuming or could not confirm. Empty string if nothing.' },
  },
}

function describeRequest(r: PrepRequest): string {
  return [
    `Company: ${r.company}`,
    r.role && `Role: ${r.role}`,
    r.reqId && `Requisition ID: ${r.reqId}`,
    r.interviewer && `Interviewer: ${r.interviewer}`,
    r.interviewerLinkedin && `Interviewer LinkedIn: ${r.interviewerLinkedin}`,
    r.interviewDate && `Interview date: ${r.interviewDate}`,
    r.notes && `Candidate notes: ${r.notes}`,
    r.jobDescription && `Job description (pasted by the candidate):\n${r.jobDescription}`,
  ].filter(Boolean).join('\n')
}

function collectSources(content: Anthropic.Beta.BetaContentBlock[], into: Map<string, string>) {
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === 'web_search_result') into.set(r.url, r.title)
    }
    if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
      const doc = block.content.content
      into.set(block.content.url, doc.title || block.content.url)
    }
  }
}

// Phase 1: research the posting and the interviewer on the web.
async function research(client: Anthropic, req: PrepRequest, section: string) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: 'user',
    content: `Research this upcoming interview so we can build a day of cheat sheet.

${describeRequest(req)}

What the candidate's coaching file already says about this company:
${section || '(nothing yet)'}

Find, in this order:
1. The job posting for this role. Use the requisition ID and the company careers site first, then job boards. Note the responsibilities, required and preferred qualifications, pay range, and anything the role will be measured on. If you can't find this exact requisition, use the closest public posting and say clearly that it is a likely match, not a confirmed one. Skip this if the candidate pasted the job description.
2. The interviewer's public professional profile, if a name was given. Only use a profile when the company clearly matches. Report title, tenure, career path and any public posts or talks. If you can't confirm a match, say so.
3. Company values or culture signals from the company's own site.

Report what you found as plain notes, each with its source URL. Mark anything you inferred rather than read.`,
  }]

  const sources = new Map<string, string>()
  let notes = ''
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      system: COACH_RULES,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
      ],
      messages,
    }).finalMessage()

    if (response.stop_reason === 'refusal') throw new Error('The model declined the research request.')
    collectSources(response.content, sources)
    notes += response.content.filter(b => b.type === 'text').map(b => b.text).join('')

    if (response.stop_reason !== 'pause_turn') break
    // Server-side tool loop hit its iteration limit. Send the turn back and it resumes.
    messages.push({ role: 'assistant', content: response.content })
  }
  return { notes, sources }
}

// Phase 2: turn research and the coaching file into a structured cheat sheet.
async function buildCheatSheet(client: Anthropic, req: PrepRequest, coachingState: string, notes: string) {
  const response = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: CHEAT_SHEET_SCHEMA },
    },
    system: COACH_RULES,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `The candidate's full coaching file (profile, resume analysis, storybank, past interview loops and coaching notes):\n\n${coachingState}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `Build a one page day of cheat sheet for this interview. The candidate reads it 15 minutes before walking in.

${describeRequest(req)}

Research notes:
${notes || '(no research available)'}

Use the storybank IDs and real numbers from the coaching file. Lean on lessons from past loops (concerns that came up, questions they missed). The lead concern counter should be a line the candidate can say before the interviewer raises it. Put anything assumed or unconfirmed in caveats.`,
        },
      ],
    }],
  }).finalMessage()

  if (response.stop_reason === 'refusal') throw new Error('The model declined to build the cheat sheet.')
  if (response.stop_reason === 'max_tokens') throw new Error('The cheat sheet was cut off. Try again.')
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return JSON.parse(text) as CheatSheet
}

// GET — return the saved cheat sheet for a company, if one exists
export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })
  try {
    return NextResponse.json(JSON.parse(fs.readFileSync(prepPath(company), 'utf-8')))
  } catch {
    return NextResponse.json(null)
  }
}

// POST — research the interview and generate a fresh cheat sheet
export async function POST(req: NextRequest) {
  const body = (await req.json()) as PrepRequest
  if (!body.company?.trim()) return NextResponse.json({ error: 'Missing company' }, { status: 400 })

  const coachingState = loadCoachingStateRaw()
  if (!coachingState) return NextResponse.json({ error: 'coaching_state.md not found' }, { status: 404 })
  const section = extractCompanySection(coachingState, body.company)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const { notes, sources } = await research(client, body, section)
    const cheatSheet = await buildCheatSheet(client, body, coachingState, notes)
    const result: PrepResult = {
      request: body,
      cheatSheet,
      sources: Array.from(sources, ([url, title]) => ({ url, title })),
      generatedAt: new Date().toISOString(),
    }
    fs.mkdirSync(PREP_DIR, { recursive: true })
    fs.writeFileSync(prepPath(body.company), JSON.stringify(result, null, 2), 'utf-8')
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error (${err.status}): ${err.message}` }, { status: 502 })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Prep failed' }, { status: 500 })
  }
}
