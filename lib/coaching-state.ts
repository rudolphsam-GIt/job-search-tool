import fs from 'fs'
import path from 'path'
import type { Profile, ActiveInterview } from './types'

export function loadCoachingStateRaw(): string {
  const stateFilePath = process.env.COACHING_STATE_PATH ||
    path.join(process.cwd(), '..', 'interview-coach-skill-main', 'coaching_state.md')
  try {
    return fs.readFileSync(stateFilePath, 'utf-8')
  } catch {
    return ''
  }
}

export function parseProfile(content: string): Profile {
  const nameMatch = content.match(/# Coaching State — (.+)/)
  const targetRolesMatch = content.match(/- Target role\(s\): (.+)/)
  const seniorityMatch = content.match(/- Seniority band: (.+)/)
  const concernMatch = content.match(/- Biggest concern: (.+)/)

  // Extract numbered positioning strengths
  const strengths: string[] = []
  const strengthsSection = content.match(/- Positioning strengths:\n([\s\S]*?)(?=\n- Likely|\n##)/m)
  if (strengthsSection) {
    const lines = strengthsSection[1].split('\n').filter(l => /^\s+\d+\./.test(l))
    for (const l of lines) {
      const m = l.match(/\d+\.\s+(.+)/)
      if (m) strengths.push(m[1].split(' — ')[0].trim())
    }
  }

  // Extract active interview loops
  const activeInterviews: ActiveInterview[] = []
  const loopRegex = /### (.+?)\n- Status: (.+)/g
  let loopMatch
  while ((loopMatch = loopRegex.exec(content)) !== null) {
    const chunk = content.slice(loopMatch.index, loopMatch.index + 800)
    const nextRoundMatch = chunk.match(/- Next round: (.+)/)
    activeInterviews.push({
      company: loopMatch[1].split(' — ')[0].trim(),
      fullLabel: loopMatch[1].trim(),
      status: loopMatch[2].trim(),
      nextRound: nextRoundMatch?.[1]?.trim(),
    })
  }

  // Known past employers (referenced throughout the state)
  const pastEmployers: string[] = []
  if (content.includes('Sisense')) pastEmployers.push('Sisense')

  return {
    name: nameMatch?.[1]?.trim() || 'Candidate',
    targetRoles: targetRolesMatch?.[1]?.split(',').map(r => r.trim()) || [],
    seniorityBand: seniorityMatch?.[1]?.trim() || '',
    biggestConcern: concernMatch?.[1]?.trim() || '',
    strengths,
    activeInterviews,
    pastEmployers,
    hasCoachingState: true,
  }
}
