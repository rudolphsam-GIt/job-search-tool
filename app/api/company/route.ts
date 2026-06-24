import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw } from '@/lib/coaching-state'
import type { CompanyDetail, InterviewRound, InterviewerIntel, Concern } from '@/lib/types'


function getStatePath() {
  return (
    process.env.COACHING_STATE_PATH ||
    path.join(process.cwd(), '..', 'interview-coach-skill-main', 'coaching_state.md')
  )
}

function extractCompanySection(content: string, label: string): string {
  // Split on ### headers and find the block matching the full label exactly
  const parts = content.split(/(?=^### )/m)
  const match = parts.find(p => {
    const header = p.match(/^### (.+)/m)?.[1]?.trim() || ''
    // Exact match first, then fallback to includes
    return header === label || header.toLowerCase().includes(label.toLowerCase())
  })
  return match?.trim() || ''
}

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

function parseCompanyDetail(section: string, company: string): CompanyDetail {
  const headerLine = section.match(/^### (.+)/m)?.[1] || company
  const rolePart = headerLine.includes(' — ') ? headerLine.split(' — ')[1].trim() : ''

  const status = section.match(/^- Status: (.+)/m)?.[1]?.trim() || ''
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
    rounds: parseRounds(section),
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
- Add the new round to "Rounds completed" if applicable
- Update "Next round" if new scheduling info was given
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
