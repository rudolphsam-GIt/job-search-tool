import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, extractCompanySection, getStatePath } from '@/lib/coaching-state'
import { syncPipelineToStage } from '@/lib/pipeline-sync'
import { normalizeStatus, STAGES } from '@/lib/status'
import type { CompanyDetail, InterviewRound, InterviewerIntel, Concern, RoundItem, StepItem } from '@/lib/types'


function parseRounds(section: string): InterviewRound[] {
  const rounds: InterviewRound[] = []
  const formatsBlock = section.match(/- Round formats:([\s\S]*?)(?=\n- [A-Z]|\n## |\n### |$)/)?.[1] || ''
  const completedRaw = section.match(/- Rounds completed: \[(.+?)\]/)?.[1] || ''
  const completedLabels = completedRaw.split(',').map(s => s.trim().toLowerCase())

  const roundLines = formatsBlock.match(/^\s+- (Round \d+.*)/gm) || []
  for (const line of roundLines) {
    const text = line.replace(/^\s+- /, '')
    const label = text.match(/^(Round \d+)/)?.[1] || text.split(':')[0].trim()
    const desc = text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text

    const isCompleted =
      completedLabels.some(c => c.includes(label.toLowerCase())) ||
      desc.toLowerCase().includes('completed') ||
      desc.toLowerCase().includes('passed') ||
      desc.toLowerCase().includes('advanced')

    const isFinal =
      desc.toLowerCase().includes('final') ||
      desc.toLowerCase().includes('panel') ||
      label.toLowerCase().includes('final')

    const isNext =
      !isCompleted &&
      (section.match(/- Next round:/i) !== null) &&
      rounds.filter(r => r.status === 'next').length === 0

    rounds.push({
      label,
      description: desc,
      status: isCompleted ? 'completed' : isNext || isFinal ? 'next' : 'upcoming',
    })
  }
  return rounds
}

function parseInterviewers(section: string): InterviewerIntel[] {
  const interviewers: InterviewerIntel[] = []
  const block = section.match(/- Interviewer intel:([\s\S]*?)(?=\n- [A-Za-z]|\n## |\n### |$)/)?.[1] || ''
  const entries = block.split(/\n\s+- /).filter(Boolean)
  for (const entry of entries) {
    const nameMatch = entry.match(/^(.+?)(?: \(|\:)/)
    const linkedinMatch = entry.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+/)
    if (nameMatch) {
      interviewers.push({
        name: nameMatch[1].trim().replace(/^\s*-\s*/, ''),
        linkedin: linkedinMatch?.[0],
        notes: entry.replace(/^.+?—\s*/, '').replace(/https?:\/\/\S+/g, '').trim(),
      })
    }
  }
  return interviewers
}

function parseConcerns(section: string): Concern[] {
  const block = section.match(/- Concerns surfaced:([\s\S]*?)(?=\n- [A-Za-z]|\n## |\n### |$)/)?.[1] || ''
  return block
    .split(/\n\s+\d+\./)
    .filter(Boolean)
    .map(line => {
      const severityMatch = line.match(/[Ss]everity:\s*(\w+)/i)
      return {
        text: line.replace(/—\s*[Ss]everity:.+/i, '').trim(),
        severity: severityMatch?.[1]?.toLowerCase(),
      }
    })
}

function parseQuestions(section: string): string[] {
  const block = section.match(/- Prepared questions:([\s\S]*?)(?=\n- [A-Za-z]|\n## |\n### |$)/)?.[1] || ''
  return block
    .split(/\n\s+\d+\./)
    .filter(Boolean)
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(s => s.length > 5)
}

function parseListField(section: string, field: string): string[] {
  const block = section.match(new RegExp(`- ${field}:[\\s\\S]*?(?=\\n- [A-Za-z]|\\n## |\\n### |$)`))?.[0] || ''
  return block
    .split('\n')
    .slice(1)
    .map(l => l.replace(/^\s+- /, '').trim())
    .filter(Boolean)
}


// ── Checklist fields ("- Rounds:" and "- Next steps:") ──────────────────────

function parseChecklist(section: string, field: string): { text: string; done: boolean }[] | null {
  const lines = section.split('\n')
  const i = lines.findIndex(l => l.startsWith(`- ${field}:`))
  if (i < 0) return null
  const items: { text: string; done: boolean }[] = []
  for (let j = i + 1; j < lines.length && /^\s+-/.test(lines[j]); j++) {
    const m = lines[j].match(/^\s+- \[( |x|X)\]\s*(.*)$/)
    if (m) items.push({ done: m[1] !== ' ', text: m[2].trim() })
  }
  return items
}

// Replace a "- Field:" line and its indented children, or add it after the status lines
function setListField(section: string, field: string, children: string[]): string {
  const lines = section.split('\n')
  const block = [`- ${field}:`, ...children.map(c => `  - ${c}`)]
  const i = lines.findIndex(l => l.startsWith(`- ${field}:`))
  if (i >= 0) {
    let j = i + 1
    while (j < lines.length && /^\s+-/.test(lines[j])) j++
    lines.splice(i, j - i, ...block)
  } else {
    let at = lines.findIndex(l => l.startsWith('- Status updated:'))
    if (at < 0) at = lines.findIndex(l => l.startsWith('- Status:'))
    lines.splice(at < 0 ? 1 : at + 1, 0, ...block)
  }
  return lines.join('\n')
}

function setScalarField(section: string, field: string, value: string): string {
  const re = new RegExp(`^- ${field}: .*$`, 'm')
  return re.test(section) ? section.replace(re, `- ${field}: ${value}`) : `${section.trimEnd()}\n- ${field}: ${value}`
}

// "Name | date | who". Tolerates empty or trailing fields and "/" left over from older saves.
function parseRoundLine(text: string, done: boolean): RoundItem {
  const tidy = (v = '') => v.replace(/^[\s/]+|[\s/]+$/g, '')
  const [name, date, who] = text.split(/\s*\|\s*/)
  return { name: tidy(name), date: tidy(date), who: tidy(who), done }
}

// Checklist rounds filed under "Rounds completed" (the coach and the update box sometimes put them there)
function completedChecklist(section: string) {
  return (parseChecklist(section, 'Rounds completed') || []).filter(r => r.text)
}

function parseRoundItems(section: string): RoundItem[] {
  const stored = parseChecklist(section, 'Rounds')
  if (stored) {
    const inTracker = new Set(stored.map(r => parseRoundLine(r.text, r.done).name.toLowerCase()))
    const extra = completedChecklist(section)
      .map(r => parseRoundLine(r.text, true))
      .filter(r => !inTracker.has(r.name.toLowerCase()))
    return [...extra, ...stored.map(r => parseRoundLine(r.text, r.done))]
  }
  // Older loops only have free text "Round formats", so show those until the first edit
  return parseRounds(section).map(r => ({
    name: `${r.label}: ${r.description}`, date: '', who: '', done: r.status === 'completed',
  }))
}

// First job posting link in the section, skipping people profiles
function findPostingUrl(section: string): string | undefined {
  const urls = section.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s)\],]+/gi) || []
  const url = urls.find(u => !/linkedin\.com|zoominfo\.com/i.test(u) && /job|career|lever|greenhouse|ashby|workday|posting/i.test(u))
  if (!url) return undefined
  return /^https?:\/\//.test(url) ? url.replace(/[.;]$/, '') : `https://${url.replace(/[.;]$/, '')}`
}

function describeRound(r: RoundItem) {
  return [r.date, r.name, r.who && `with ${r.who}`].filter(Boolean).join(' · ')
}

function parseCompanyDetail(section: string, company: string): CompanyDetail {
  const headerLine = section.match(/^### (.+)/m)?.[1] || company
  const rolePart = headerLine.includes(' — ') ? headerLine.split(' — ')[1].trim() : ''

  const status = section.match(/^- Status: (.+)/m)?.[1]?.trim() || ''
  const { stage, note: statusNote } = normalizeStatus(status)
  const statusUpdated = section.match(/^- Status updated: (.+)/m)?.[1]?.trim()
  const nextRound = section.match(/^- Next round: (.+)/m)?.[1]?.trim()
  const fitAssessment = section.match(/^- Fit assessment: (.+)/m)?.[1]?.trim()
  const keySignals = section.match(/^- Key signals: (.+)/m)?.[1]?.trim()
  const positioningAngle = section.match(/- Positioning angle[^:]*:\n([\s\S]*?)(?=\n- [A-Za-z]|\n## |\n### |$)/)?.[1]?.trim()

  const responsibilities = parseListField(section, 'Build Partner Success Enablement Strategy|Key responsibilities|Responsibilities')
  const metrics = parseListField(section, 'Performance metrics')

  // For Zoom specifically, grab the role block
  const roleBlock = section.match(/- Role: ([\s\S]+?)(?=\n- [A-Z]|\n## |\n### |$)/)?.[1] || ''
  const roleLines = roleBlock.split('\n').map(l => l.replace(/^\s+- /, '').trim()).filter(Boolean)

  return {
    company: headerLine.split(' — ')[0].trim(),
    role: rolePart || section.match(/- Role: ([^\n]+)/)?.[1]?.trim() || '',
    status,
    stage,
    statusNote,
    statusUpdated,
    rounds: parseRounds(section),
    roundItems: parseRoundItems(section),
    nextSteps: (parseChecklist(section, 'Next steps') || []) as StepItem[],
    postingUrl: findPostingUrl(section),
    nextRound,
    concerns: parseConcerns(section),
    questions: parseQuestions(section),
    interviewers: parseInterviewers(section),
    positioningAngle,
    fitAssessment,
    keySignals,
    responsibilities: roleLines.length > 0 ? roleLines.slice(0, 8) : [],
    metrics: metrics.length > 0 ? metrics : [],
    rawSection: section,
  }
}

// GET — return parsed company detail
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })

  const content = loadCoachingStateRaw()
  if (!content) return NextResponse.json({ error: 'coaching_state.md not found' }, { status: 404 })

  const section = extractCompanySection(content, company)
  if (!section) return NextResponse.json({ error: `No data found for ${company}` }, { status: 404 })

  const detail = parseCompanyDetail(section, company)
  return NextResponse.json(detail)
}

// POST — natural language update, Claude rewrites the section, saves to file
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })

  const { update } = await req.json()
  if (!update?.trim()) return NextResponse.json({ error: 'Missing update text' }, { status: 400 })

  const content = loadCoachingStateRaw()
  const section = extractCompanySection(content, company)
  if (!section) return NextResponse.json({ error: `No data found for ${company}` }, { status: 404 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `You are updating an interview coaching state file. Here is the current company section in markdown:

${section}

The candidate just provided this update:
"${update}"

Rewrite this company section incorporating the new information. Rules:
- Keep the exact same markdown structure and field names
- Update Status if a round outcome was shared (e.g. "passed" → mark round as completed, advance status)
- Rounds live in a "- Rounds:" checklist, one line per round in the form "  - [x] Round name | date | interviewer" ([x] done, [ ] not yet). Mark finished rounds [x] and add newly scheduled rounds as [ ]. Leave a field empty rather than writing TBD, and never add rounds to "Rounds completed"
- Next steps live in a "- Next steps:" checklist in the form "  - [ ] step". Add any new follow ups the update implies
- Set "Next round" to the first unfinished round as "date · name · with interviewer", or "None scheduled"
- If an offer or rejection was mentioned, update Status accordingly
- Preserve all existing data not contradicted by the update
- Today's date is ${new Date().toISOString().slice(0, 10)}

Return ONLY the updated markdown section starting with "###", nothing else.`,
      },
    ],
  })

  const updatedSection = message.content[0].type === 'text' ? message.content[0].text.trim() : section

  // Replace old section in the full file
  const newContent = content.replace(section.trim(), updatedSection)
  fs.writeFileSync(getStatePath(), newContent, 'utf-8')

  const detail = parseCompanyDetail(updatedSection, company)
  return NextResponse.json(detail)
}

// PATCH — set the pipeline stage from the status dropdown. Keeps any note after the dash and stamps the date.
export async function PATCH(req: NextRequest) {
  const company = new URL(req.url).searchParams.get('name')
  if (!company) return NextResponse.json({ error: 'Missing company name' }, { status: 400 })

  const body = await req.json() as { stage?: string; rounds?: RoundItem[]; nextSteps?: StepItem[] }
  if (body.stage && !STAGES.some(s => s.stage === body.stage)) {
    return NextResponse.json({ error: `Unknown stage: ${body.stage}` }, { status: 400 })
  }

  const content = loadCoachingStateRaw()
  const section = extractCompanySection(content, company)
  if (!section) return NextResponse.json({ error: `No data found for ${company}` }, { status: 404 })

  let updated = section
  const today = new Date().toISOString().slice(0, 10)

  if (body.stage) {
    const current = section.match(/^- Status: (.+)/m)?.[1]?.trim() || ''
    const { note } = normalizeStatus(current)
    const statusLine = `- Status: ${body.stage}${note ? ` — ${note}` : ''}`
    updated = /^- Status: .+$/m.test(updated)
      ? updated.replace(/^- Status: .+$/m, statusLine)
      : updated.replace(/^(### .+)$/m, `$1\n${statusLine}`)
    updated = /^- Status updated: .+$/m.test(updated)
      ? updated.replace(/^- Status updated: .+$/m, `- Status updated: ${today}`)
      : updated.replace(statusLine, `${statusLine}\n- Status updated: ${today}`)
  }

  if (body.rounds) {
    const clean = (t: string) => t.replace(/\|/g, '/').replace(/\n/g, ' ').trim()
    updated = setListField(updated, 'Rounds', body.rounds.map(r =>
      `[${r.done ? 'x' : ' '}] ${[clean(r.name), clean(r.date), clean(r.who)].join(' | ')}`))
    // Rounds shown from "Rounds completed" now live in the tracker, so drop those checklist copies
    if (completedChecklist(updated).length) {
      const lines = updated.split('\n')
      const at = lines.findIndex(l => l.startsWith('- Rounds completed:'))
      let end = at + 1
      while (end < lines.length && /^\s+-/.test(lines[end])) end++
      const kept = lines.slice(at + 1, end).filter(l => !/^\s+- \[[ xX]\]/.test(l))
      lines.splice(at, end - at, ...(kept.length ? [lines[at], ...kept] : []))
      updated = lines.join('\n')
    }
    // Keep "Next round" (read by the sidebar and the interview coach) pointing at the first open round
    const next = body.rounds.find(r => !r.done)
    updated = setScalarField(updated, 'Next round', next ? describeRound(next) : 'None scheduled')
  }

  if (body.nextSteps) {
    updated = setListField(updated, 'Next steps', body.nextSteps.map(st =>
      `[${st.done ? 'x' : ' '}] ${st.text.replace(/\n/g, ' ').trim()}`))
  }

  fs.writeFileSync(getStatePath(), content.replace(section, updated), 'utf-8')
  if (body.stage) syncPipelineToStage(company.split(' — ')[0], body.stage)
  return NextResponse.json(parseCompanyDetail(updated, company))
}
