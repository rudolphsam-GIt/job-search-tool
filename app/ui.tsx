'use client'

// Small shared pieces used by the main page and the company page
import { STAGES, stageInfo } from '@/lib/status'

export function IconLinkedIn() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function IconExternal() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

export function IconChevronDown() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'
  return (
    <svg className={`animate-spin ${cls} text-blue-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export function StatusBadge({ stage }: { stage: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${stageInfo(stage).cls}`}>{stage}</span>
}

export function StatusSelect({ stage, saving, onChange }: { stage: string; saving: boolean; onChange: (s: string) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={stage}
        disabled={saving}
        onChange={e => onChange(e.target.value)}
        aria-label="Application status"
        className={`appearance-none cursor-pointer text-xs font-medium border rounded-full pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${stageInfo(stage).cls}`}
      >
        <optgroup label="Active">
          {STAGES.filter(s => !s.closed).map(s => <option key={s.stage} value={s.stage}>{s.stage}</option>)}
        </optgroup>
        <optgroup label="Closed">
          {STAGES.filter(s => s.closed).map(s => <option key={s.stage} value={s.stage}>{s.stage}</option>)}
        </optgroup>
      </select>
      <span className="pointer-events-none absolute right-2 text-current opacity-70"><IconChevronDown /></span>
    </div>
  )
}

export function SeverityDot({ severity }: { severity?: string }) {
  const cls = severity === 'high' ? 'bg-red-400' : severity === 'medium' ? 'bg-amber-400' : 'bg-zinc-500'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cls}`} />
}
