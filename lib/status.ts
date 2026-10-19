// Fixed pipeline stages for interview loops in coaching_state.md.
// The file stores "- Status: <Stage> — <optional note>"; older free-text statuses are mapped by normalizeStatus.

export const STAGES = [
  { stage: 'Researching', closed: false, cls: 'bg-zinc-700/40 text-zinc-300 border-zinc-600' },
  { stage: 'Applying', closed: false, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { stage: 'Applied', closed: false, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { stage: 'Interviewing', closed: false, cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { stage: 'Final Round', closed: false, cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { stage: 'Offer', closed: false, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { stage: 'Accepted', closed: true, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { stage: 'Rejected', closed: true, cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  { stage: 'Withdrawn', closed: true, cls: 'bg-zinc-700/50 text-zinc-400 border-zinc-700' },
  { stage: 'Inactive', closed: true, cls: 'bg-zinc-700/50 text-zinc-500 border-zinc-700' },
] as const

export type Stage = (typeof STAGES)[number]['stage']

export function stageInfo(stage: string) {
  return STAGES.find(s => s.stage === stage) ?? STAGES[0]
}

export function isClosedStage(stage: string) {
  return stageInfo(stage).closed
}

// Split a raw Status value into a known stage plus whatever note follows it
export function normalizeStatus(raw: string): { stage: Stage; note: string } {
  const text = raw.trim()
  const dash = text.search(/\s[—–-]\s/)
  const head = (dash >= 0 ? text.slice(0, dash) : text).trim().replace(/[.:]$/, '')
  const rest = dash >= 0 ? text.slice(dash).replace(/^\s[—–-]\s/, '').trim() : ''

  const exact = STAGES.find(s => s.stage.toLowerCase() === head.toLowerCase())
  if (exact) return { stage: exact.stage, note: rest }

  // Legacy free text, e.g. "CLOSED — REJECTED. Final round..." or "Interviewing. Candidate said..."
  const t = text.toLowerCase()
  const stage: Stage =
    /accepted/.test(t) ? 'Accepted'
    : /reject|no longer being considered|not selected|did not receive offer/.test(t) ? 'Rejected'
    : /withdr|turned down|declined/.test(t) ? 'Withdrawn'
    : /closed|inactive/.test(t) ? 'Inactive'
    : /offer/.test(t) ? 'Offer'
    : /final/.test(t) ? 'Final Round'
    : /interview/.test(t) ? 'Interviewing'
    : /applying/.test(t) ? 'Applying'
    : /applied/.test(t) ? 'Applied'
    : 'Researching'
  // Keep only the useful part of the note, e.g. "CLOSED — REJECTED. Final round..." → "Final round..."
  const stageWords = STAGES.map(s => s.stage.toLowerCase()).join('|')
  const note = (dash >= 0 ? rest : text)
    .replace(new RegExp(`^(closed|${stageWords})\\b[.:,]?\\s*`, 'i'), '')
    .trim()
  return { stage, note }
}
