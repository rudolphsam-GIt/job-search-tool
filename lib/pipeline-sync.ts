// Keeps the two trackers in step: Pipeline jobs (data/jobs-store.json) and
// interview loops (### sections under "## Interview Loops" in coaching_state.md).
import fs from 'fs'
import path from 'path'
import { loadCoachingStateRaw, getStatePath } from './coaching-state'
import { isClosedStage } from './status'
import { sameCompany } from './company-match'
import type { RemoteJob } from './types'

const STORE_PATH = path.join(process.cwd(), 'data', 'jobs-store.json')

function loopHeaders(content: string) {
  const loopsStart = content.indexOf('## Interview Loops')
  if (loopsStart < 0) return []
  const loopsEnd = content.indexOf('\n## ', loopsStart + 1)
  const block = content.slice(loopsStart, loopsEnd < 0 ? undefined : loopsEnd)
  return Array.from(block.matchAll(/^### (.+)$/gm), m => m[1].trim())
}

// Create a loop for a job that just moved into the interview process, unless one already exists.
// Returns true when the coaching file changed.
export function ensureLoop(job: RemoteJob): boolean {
  const content = loadCoachingStateRaw()
  if (!content) return false
  if (loopHeaders(content).some(h => sameCompany(h.split(' — ')[0], job.company_name))) return false

  const today = new Date().toISOString().slice(0, 10)
  const entry = [
    `### ${job.company_name} — ${job.title}`,
    '- Status: Interviewing',
    `- Status updated: ${today}`,
    `- Role: ${job.title}. Posting: ${job.url}`,
    '- Rounds completed: []',
    `- Date added: ${today} (moved to Interviewing in the job search app)`,
    '',
  ].join('\n')

  // Insert at the end of the Interview Loops section, before the next "## " heading
  const loopsStart = content.indexOf('## Interview Loops')
  let updated: string
  if (loopsStart < 0) {
    updated = `${content.trimEnd()}\n\n## Interview Loops (active)\n\n${entry}`
  } else {
    const next = content.indexOf('\n## ', loopsStart + 1)
    const at = next < 0 ? content.length : next + 1
    updated = `${content.slice(0, at).trimEnd()}\n\n${entry}\n${content.slice(at)}`
  }
  fs.writeFileSync(getStatePath(), updated, 'utf-8')
  return true
}

// Mirror a loop's stage onto matching Pipeline jobs: closed stages archive them,
// interview stages move them to active. Saved and Applied stages leave the Pipeline alone.
export function syncPipelineToStage(company: string, stage: string) {
  const target: RemoteJob['status'] = isClosedStage(stage) ? 'archived'
    : ['Interviewing', 'Final Round', 'Offer'].includes(stage) ? 'active'
    : undefined
  if (!target) return

  let store: Record<string, RemoteJob[]>
  try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) } catch { return }

  const lists = ['saved', 'applied', 'active', 'archived'] as const
  const moving: RemoteJob[] = []
  for (const l of lists) {
    if (l === target) continue
    const keep: RemoteJob[] = []
    for (const j of store[l] || []) (sameCompany(j.company_name, company) ? moving : keep).push(j)
    store[l] = keep
  }
  if (!moving.length) return
  store[target] = [...moving.map(j => ({ ...j, status: target })), ...(store[target] || [])]
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}
