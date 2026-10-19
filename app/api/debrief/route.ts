import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, extractCompanySection, getStatePath } from '@/lib/coaching-state'
import { structuredCall, errorResponse, slugify } from '@/lib/research'
import type { DebriefInput, DebriefResult } from '@/lib/types'

export const maxDuration = 300

const DIR = path.join(process.cwd(), 'data', 'debriefs')
const filePath = (company: string) => path.join(DIR, `${slugify(company)}.json`)

function readAll(company: string): DebriefResult[] {
  try { return JSON.parse(fs.readFileSync(filePath(company), 'utf-8')) } catch { return [] }
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'followUps', 'storyNotes', 'thankYouNotes'],
  properties: {
    summary: { type: 'string', description: 'Two or three sentence read of how the round went and what it signals, honest, not cheerleading' },
    followUps: { type: 'array', items: { type: 'string' }, description: 'Two to four concrete next steps, short imperative phrases' },
    storyNotes: { type: 'array', items: { type: 'string' }, description: 'Which storybank stories this round used or needed, and any gap to work on with the coach' },
    thankYouNotes: {
      type: 'array',
      description: 'One per interviewer. Empty if the candidate did not ask for notes.',
      items: {
        type: 'object', additionalProperties: false, required: ['to', 'subject', 'body'],
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Under 120 words. References one specific moment from the conversation. Signed with the first name from the coaching file.' },
        },
      },
    },
  },
}

// Replace "|" and newlines so a value can sit in a markdown table cell or one list line
const oneLine = (s: string) => s.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim()

function writeToCoachingFile(input: DebriefInput, r: DebriefResult) {
  let content = loadCoachingStateRaw()
  const section = extractCompanySection(content, input.company)
  const date = r.createdAt.slice(0, 10)
  const who = input.interviewers.filter(Boolean).join(', ')
  const roundName = oneLine(input.round.name)

  if (section) {
    const entry = `  - ${date}, ${roundName}${who ? ` with ${who}` : ''}. Felt ${input.feel}. ${oneLine(r.summary)}` +
      (input.questions ? ` Asked: ${oneLine(input.questions)}.` : '') +
      (input.signals ? ` Signals: ${oneLine(input.signals)}.` : '') +
      (input.redo ? ` Would redo: ${oneLine(input.redo)}.` : '') +
      (r.storyNotes.length ? ` Stories: ${oneLine(r.storyNotes.join(' '))}` : '')
    const lines = section.split('\n')
    const at = lines.findIndex(l => l.startsWith('- Debriefs:'))
    if (at >= 0) {
      let end = at + 1
      while (end < lines.length && /^\s+- /.test(lines[end])) end++
      lines.splice(end, 0, entry)
    } else {
      lines.push('- Debriefs:', entry)
    }

    // Follow ups join Next Steps as open items, skipping any already listed
    const stepsAt = lines.findIndex(l => l.startsWith('- Next steps:'))
    const existing = new Set(lines.filter(l => /^\s+- \[[ x]\]/.test(l)).map(l => l.replace(/^\s+- \[[ x]\]\s*/, '').trim()))
    const newSteps = r.followUps.filter(f => !existing.has(f)).map(f => `  - [ ] ${oneLine(f)}`)
    if (newSteps.length) {
      if (stepsAt >= 0) {
        let end = stepsAt + 1
        while (end < lines.length && /^\s+- /.test(lines[end])) end++
        lines.splice(end, 0, ...newSteps)
      } else {
        lines.splice(2, 0, '- Next steps:', ...newSteps)
      }
    }
    content = content.replace(section, lines.join('\n'))
  }

  // Same shape the coach's debrief command uses: a pending row in the Outcome Log
  const company = input.company.split(' — ')[0].trim()
  const role = input.company.split(' — ').slice(1).join(' — ')
  const row = `| ${date} | ${oneLine(company)} | ${oneLine(role)} | ${roundName} | pending | Felt ${input.feel}. ${oneLine(r.summary)} |`
  const logAt = content.indexOf('## Outcome Log')
  if (logAt >= 0) {
    const tableEnd = content.indexOf('\n\n', logAt)
    content = tableEnd >= 0 ? `${content.slice(0, tableEnd)}\n${row}${content.slice(tableEnd)}` : `${content}\n${row}`
  }
  fs.writeFileSync(getStatePath(), content, 'utf-8')
}

// GET — past debriefs for a loop, newest first
export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })
  return NextResponse.json(readAll(company))
}

// POST — save a round debrief, add follow ups, and draft thank you notes
export async function POST(req: NextRequest) {
  const input = await req.json() as DebriefInput
  if (!input.company?.trim() || !input.round?.name) return NextResponse.json({ error: 'Missing company or round' }, { status: 400 })

  const coachingState = loadCoachingStateRaw()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const out = await structuredCall<Omit<DebriefResult, 'input' | 'createdAt'>>(client, `The candidate just finished a round in the ${input.company} loop. Debrief it.

Round: ${input.round.name}${input.round.date ? `, ${input.round.date}` : ''}
Interviewers: ${input.interviewers.join(', ') || '(not given)'}
How it felt: ${input.feel}
Questions they asked: ${input.questions || '(not given)'}
Signals from the interviewer: ${input.signals || '(not given)'}
What the candidate would redo: ${input.redo || '(not given)'}

Give an honest read, concrete follow ups, and story notes tied to storybank IDs. ${input.draftNotes
      ? "Draft one thank you note per interviewer in the candidate's own plain, warm voice. Each one references something specific from this round, and none of them oversell."
      : 'The candidate did not ask for thank you notes, so return an empty list.'}`, SCHEMA, coachingState)

    const result: DebriefResult = { input, ...out, createdAt: new Date().toISOString() }
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(filePath(input.company), JSON.stringify([result, ...readAll(input.company)], null, 2), 'utf-8')
    writeToCoachingFile(input, result)
    return NextResponse.json(result)
  } catch (err) {
    const { error, status } = errorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
