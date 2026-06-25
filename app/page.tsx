'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import type { Profile, AnalysisResult, RemoteJob, CompanyDetail, SearchPrefs, ProfileOverrides } from '@/lib/types'
import { DEFAULT_SEARCH_PREFS } from '@/lib/types'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconBriefcase() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function IconBookmark({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'
  return (
    <svg className={`animate-spin ${cls} text-blue-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isSaved,
  isNew,
  onSave,
  onSkip,
  onUnsave,
  onAnalyze,
  hideActions,
}: {
  job: RemoteJob & { foundDate?: string; savedAt?: string }
  isSaved?: boolean
  isNew?: boolean
  onSave?: (job: RemoteJob) => void
  onSkip?: (job: RemoteJob) => void
  onUnsave?: (job: RemoteJob) => void
  onAnalyze?: (url: string) => void
  hideActions?: boolean
}) {
  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 transition-colors group ${
      isNew ? 'border-blue-500/40 hover:border-blue-500/60' : 'border-zinc-800 hover:border-zinc-700'
    }`}>
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
          {job.company_logo
            ? <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-zinc-500">{job.company_name?.charAt(0)}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-white hover:text-blue-300 transition-colors leading-snug flex items-center gap-1.5">
                {job.title}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity"><IconExternal /></span>
              </a>
              {isNew && (
                <span className="text-xs bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-semibold">New</span>
              )}
              {isSaved && (
                <span className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Saved</span>
              )}
            </div>
            {job.fitScore && <FitBadge score={job.fitScore} flag={job.flag} />}
          </div>

          <p className="text-sm text-zinc-400 mb-2">{job.company_name}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.salary && (
              <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">{job.salary}</span>
            )}
            {job.candidate_required_location && (
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {job.candidate_required_location}
              </span>
            )}
            {job.tags?.slice(0, 4).map(t => (
              <span key={t} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>

          {job.fitReason && (
            <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg leading-relaxed mb-3">
              {job.fitReason}
            </p>
          )}

          {/* Actions */}
          {!hideActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {isSaved ? (
                <button onClick={() => onUnsave?.(job)}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium">
                  <IconBookmark filled />
                  Saved
                </button>
              ) : (
                <button onClick={() => onSave?.(job)}
                  className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
                  <IconBookmark />
                  Save
                </button>
              )}
              {onAnalyze && job.url && (
                <button onClick={() => onAnalyze(job.url)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Analyze
                </button>
              )}
              {!isSaved && (
                <button onClick={() => onSkip?.(job)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                  <IconX />
                  Not interested
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 8 ? '#34d399' : score >= 6 ? '#60a5fa' : score >= 5 ? '#fbbf24' : '#f87171'
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 10) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute text-center">
          <span className="text-xl font-bold text-white">{score}</span>
          <span className="text-xs text-zinc-500">/10</span>
        </div>
      </div>
      <span className="text-xs text-zinc-600 uppercase tracking-widest">Fit Score</span>
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

function FitBadge({ score, flag }: { score: number; flag?: string }) {
  const cls = score >= 8 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
    : score >= 6 ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
  const label = flag === 'strong_match' ? 'Strong match' : flag === 'good_match' ? 'Good match' : flag === 'stretch' ? 'Stretch' : `${score}/10`
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>{score}/10 · {label}</span>
}

function RecBadge({ rec }: { rec: string }) {
  const map: Record<string, string> = {
    apply: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    monitor: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    skip: 'bg-red-500/20 border-red-500/40 text-red-300',
  }
  const labels: Record<string, string> = { apply: 'Apply', monitor: 'Monitor', skip: 'Pass' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${map[rec] || map.monitor}`}>
      <span className="text-xs font-normal opacity-50">AI rec:</span>
      {labels[rec] || rec}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const cls = s.includes('final') ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    : s.includes('closed') ? 'bg-zinc-700/50 text-zinc-500 border-zinc-700'
    : s.includes('offer') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cls}`}>{status}</span>
}

function SeverityDot({ severity }: { severity?: string }) {
  const cls = severity === 'high' ? 'bg-red-400' : severity === 'medium' ? 'bg-amber-400' : 'bg-zinc-500'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cls}`} />
}

// ── Interview Timeline ────────────────────────────────────────────────────────

function Timeline({ rounds }: { rounds: CompanyDetail['rounds'] }) {
  if (!rounds.length) return null
  return (
    <div className="space-y-0">
      {rounds.map((r, i) => (
        <div key={i} className="flex gap-4">
          {/* Track */}
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 z-10 ${
              r.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white'
              : r.status === 'next' ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}>
              {r.status === 'completed' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : r.status === 'next' ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" />
                </svg>
              ) : (
                <span className="text-xs font-bold">{i + 1}</span>
              )}
            </div>
            {i < rounds.length - 1 && (
              <div className={`w-0.5 flex-1 min-h-4 my-1 ${r.status === 'completed' ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
            )}
          </div>
          {/* Content */}
          <div className={`pb-4 flex-1 min-w-0 ${i === rounds.length - 1 ? '' : ''}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-sm font-semibold ${
                r.status === 'completed' ? 'text-emerald-400'
                : r.status === 'next' ? 'text-blue-300'
                : 'text-zinc-500'
              }`}>{r.label}</span>
              {r.status === 'next' && <span className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">Up next</span>}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{r.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Company Detail Panel ──────────────────────────────────────────────────────

function CompanyDetailPanel({
  company,
  onBack,
  onProfileRefresh,
}: {
  company: string
  onBack: () => void
  onProfileRefresh: () => void
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [update, setUpdate] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [expandedJD, setExpandedJD] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/company?name=${encodeURIComponent(company)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to load company data'); return }
      setDetail(data)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [company])

  useEffect(() => { load() }, [load])

  const submitUpdate = async () => {
    if (!update.trim()) return
    setUpdating(true); setUpdateSuccess(false)
    try {
      const res = await fetch(`/api/company?name=${encodeURIComponent(company)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Update failed'); return }
      setDetail(data)
      setUpdate('')
      setUpdateSuccess(true)
      onProfileRefresh()
      setTimeout(() => setUpdateSuccess(false), 3000)
    } catch { setError('Network error during update') }
    finally { setUpdating(false) }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-zinc-400">Loading {company} details…</p>
      </div>
    </div>
  )

  if (error || !detail) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-400 mb-2">{error || 'No data found'}</p>
        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">← Back</button>
      </div>
    </div>
  )

  const statusLower = detail.status.toLowerCase()
  const isClosed = statusLower.includes('closed')
  const hasOffer = statusLower.includes('offer')
  const isRejected = statusLower.includes('rejected') || statusLower.includes('no longer')

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-0.5">{detail.company}</h2>
            {detail.role && <p className="text-zinc-400 text-sm mb-3">{detail.role}</p>}
            <StatusBadge status={detail.status.split('—')[0].trim()} />
          </div>
          {detail.fitAssessment && (
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Fit</p>
              <p className="text-sm text-zinc-300 max-w-48">{detail.fitAssessment.split('—')[0].trim()}</p>
            </div>
          )}
        </div>

        {/* Outcome banner */}
        {hasOffer && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2.5 text-sm text-emerald-300 font-medium">
            Offer received
          </div>
        )}
        {isRejected && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-sm text-red-300 font-medium">
            Not selected
          </div>
        )}
        {detail.nextRound && !isClosed && (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 text-sm text-blue-300">
            <span className="font-semibold">Next: </span>{detail.nextRound}
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left: timeline + positioning + interviewers */}
        <div className="col-span-2 space-y-4">
          {/* Interview process */}
          {detail.rounds.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Interview Process</p>
              <Timeline rounds={detail.rounds} />
            </div>
          )}

          {/* Positioning */}
          {detail.positioningAngle && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Your Angle</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{detail.positioningAngle}</p>
            </div>
          )}

          {/* Key signals */}
          {detail.keySignals && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Company Signals</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{detail.keySignals}</p>
            </div>
          )}
        </div>

        {/* Right: JD, concerns, questions, interviewers */}
        <div className="col-span-3 space-y-4">
          {/* Job description */}
          {detail.responsibilities.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Job Description</p>
                {detail.responsibilities.length > 3 && (
                  <button onClick={() => setExpandedJD(v => !v)} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                    {expandedJD ? 'Show less' : 'Show all'}
                    <span className={`transition-transform ${expandedJD ? 'rotate-180' : ''}`}><IconChevronDown /></span>
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {(expandedJD ? detail.responsibilities : detail.responsibilities.slice(0, 4)).map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                    <span className="text-zinc-600 shrink-0 mt-0.5">·</span>
                    {r}
                  </li>
                ))}
              </ul>
              {detail.metrics.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">They&apos;ll measure you on</p>
                  <ul className="space-y-1.5">
                    {detail.metrics.map((m, i) => (
                      <li key={i} className="flex gap-2 text-xs text-zinc-400">
                        <span className="text-blue-500 shrink-0">→</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Interviewers */}
          {detail.interviewers.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Interviewer Intel</p>
              <div className="space-y-4">
                {detail.interviewers.map((iv, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-400">
                      {iv.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white">{iv.name}</span>
                        {iv.linkedin && (
                          <a href={iv.linkedin} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors">
                            <IconLinkedIn />
                          </a>
                        )}
                      </div>
                      {iv.notes && (
                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{iv.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {detail.concerns.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Concerns to Address</p>
              <ul className="space-y-3">
                {detail.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <SeverityDot severity={c.severity} />
                    <div className="min-w-0">
                      <span className="text-sm text-zinc-300 leading-snug">{c.text}</span>
                      {c.severity && (
                        <span className={`ml-2 text-xs ${
                          c.severity === 'high' ? 'text-red-400' : c.severity === 'medium' ? 'text-amber-400' : 'text-zinc-500'
                        }`}>{c.severity}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions */}
          {detail.questions.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Questions to Ask</p>
              <ol className="space-y-3">
                {detail.questions.map((q, i) => (
                  <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-snug">
                    <span className="text-zinc-600 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span>&ldquo;{q}&rdquo;</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Update panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Add an Update</p>
        <p className="text-xs text-zinc-600 mb-3">Tell me what happened — round result, scheduling, feedback, offer. I&apos;ll update the record.</p>
        <div className="space-y-2">
          <textarea
            value={update}
            onChange={e => setUpdate(e.target.value)}
            placeholder="e.g. Just finished the final panel with Melissa and Ben. It went really well — they said they'd follow up by Friday. Ben asked a lot about measurement frameworks."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={submitUpdate}
              disabled={updating || !update.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {updating ? <><Spinner /> Updating…</> : 'Save Update'}
            </button>
            {updateSuccess && (
              <span className="text-sm text-emerald-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved to coaching state
              </span>
            )}
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Analyze Tab ───────────────────────────────────────────────────────────────

function AnalyzeTab({ savedIds, initialUrl, onStoreChange }: {
  savedIds: Set<number>
  initialUrl?: string
  onStoreChange: (store: StoreUpdate) => void
}) {
  const [url, setUrl] = useState(initialUrl || '')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [showDesc, setShowDesc] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [markedApplied, setMarkedApplied] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Sync if parent passes a new URL (cross-tab shortcut)
  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl)
      setResult(null)
      setSavedId(null)
      setMarkedApplied(false)
    }
  }, [initialUrl])

  const resultJobId = result ? Math.abs((url + result.company + result.role).split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)) % 6999999 + 1000000 : null
  const isSaved = resultJobId !== null && (savedIds.has(resultJobId) || savedId === resultJobId)

  const buildJob = (): RemoteJob | null => {
    if (!result || !resultJobId) return null
    return {
      id: resultJobId,
      url: url || '',
      title: result.role,
      company_name: result.company,
      company_logo: '',
      category: 'manual',
      tags: [],
      job_type: 'full_time',
      publication_date: new Date().toISOString(),
      candidate_required_location: result.isRemote ? 'Remote' : 'On-site',
      salary: '',
      description: result.fitSummary,
      fitScore: result.fitScore,
      fitReason: result.fitSummary,
      flag: result.fitScore >= 8 ? 'strong_match' : result.fitScore >= 6 ? 'good_match' : 'stretch',
      foundDate: new Date().toISOString().slice(0, 10),
    }
  }

  const saveResult = async () => {
    const job = buildJob()
    if (!job || !resultJobId) return
    const res = await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', job }),
    })
    const store = await res.json()
    onStoreChange(store)
    setSavedId(resultJobId)
    setMarkedApplied(false)
  }

  const markApplied = async () => {
    const job = buildJob()
    if (!job || !resultJobId) return
    // Ensure saved first, then set status to applied
    await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', job }),
    })
    const res = await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setStatus', job: { ...job, status: 'saved' }, newStatus: 'applied' }),
    })
    const store = await res.json()
    onStoreChange(store)
    setSavedId(resultJobId)
    setMarkedApplied(true)
  }

  const analyze = async () => {
    if (!url && !description) { setError('Enter a job URL or paste the description'); return }
    setLoading(true); setError(''); setResult(null); setSavedId(null); setMarkedApplied(false)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url || undefined, description: description || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Analysis failed'); return }
      setResult(data)
      // Auto-select the URL input so the user can quickly paste the next job
      setTimeout(() => urlInputRef.current?.select(), 50)
    } catch { setError('Network error — check your connection') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Paste a job posting URL</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !showDesc && analyze()}
              placeholder="https://jobs.lever.co/company/role"
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <button onClick={analyze} disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
              {loading ? <><Spinner /> Analyzing…</> : 'Analyze'}
            </button>
          </div>
          {!showDesc ? (
            <button onClick={() => setShowDesc(true)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              + Paste description instead (for paywalled pages)
            </button>
          ) : (
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Paste the full job description here…" rows={5}
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              <span>⚠</span> {error}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-400">Fetching job details and analyzing fit…</p>
          <p className="text-xs text-zinc-600">This takes about 10–15 seconds</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-lg font-bold text-white hover:text-blue-300 transition-colors flex items-center gap-1.5 group">
                      {result.role}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity"><IconExternal /></span>
                    </a>
                  ) : (
                    <h3 className="text-lg font-bold text-white">{result.role}</h3>
                  )}
                  {result.isRemote
                    ? <span className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">Remote</span>
                    : <span className="text-xs bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full">Not Remote</span>
                  }
                  {result.alreadyApplied && (
                    <span className="text-xs bg-violet-500/15 border border-violet-500/30 text-violet-400 px-2 py-0.5 rounded-full">Already in pipeline</span>
                  )}
                </div>
                <p className="text-zinc-400 mb-3">{result.company}</p>

                {/* Actions row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <RecBadge rec={result.recommendation} />
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors">
                      Apply <IconExternal />
                    </a>
                  )}
                  {markedApplied ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                      <span>✓</span> Marked as Applied
                    </span>
                  ) : isSaved ? (
                    <button onClick={markApplied}
                      className="flex items-center gap-1.5 text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Mark Applied
                    </button>
                  ) : (
                    <button onClick={saveResult}
                      className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Save to list
                    </button>
                  )}
                </div>
              </div>
              <ScoreRing score={result.fitScore} />
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed mt-4 pt-4 border-t border-zinc-800">{result.fitSummary}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-3">Why It Fits</p>
              <ul className="space-y-2.5">
                {result.alignmentPoints.map((pt, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>{pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Watch Out For</p>
              {result.concerns.length > 0 ? (
                <ul className="space-y-2.5">
                  {result.concerns.map((c, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                      <span className="text-amber-400 shrink-0 mt-0.5">!</span>{c}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-zinc-500">No major concerns flagged</p>}
            </div>
          </div>

          {result.storiesToDeploy.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Stories to Deploy</p>
              <ul className="space-y-2.5">
                {result.storiesToDeploy.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                    <span className="text-blue-400 shrink-0 mt-0.5">→</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Research</p>
              <div className="space-y-2.5">
                <a href={result.linkedinNetworkSearchUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-blue-400 hover:text-blue-300 transition-colors group">
                  <span className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors"><IconLinkedIn /></span>
                  1st &amp; 2nd degree connections
                </a>
                <a href={result.glassdoorUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-blue-400 hover:text-blue-300 transition-colors group">
                  <span className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </span>
                  Glassdoor reviews
                </a>
                <a href={`https://news.google.com/search?q=${encodeURIComponent(result.company)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-blue-400 hover:text-blue-300 transition-colors group">
                  <span className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </span>
                  Google News
                </a>
              </div>
            </div>
            {result.news.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Recent News</p>
                <ul className="space-y-2.5">
                  {result.news.map((n, i) => (
                    <li key={i}>
                      <a href={n.link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-zinc-400 hover:text-blue-300 transition-colors line-clamp-2 leading-snug block">
                        {n.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared job action hook ────────────────────────────────────────────────────

type StoreUpdate = { saved: RemoteJob[]; applied?: RemoteJob[]; active?: RemoteJob[]; archived?: RemoteJob[]; newJobs: RemoteJob[] }

function useJobActions(onStoreChange: (store: StoreUpdate) => void) {
  const act = useCallback(async (action: string, job: RemoteJob, extra?: Record<string, unknown>) => {
    const res = await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, job, ...extra }),
    })
    const store = await res.json()
    onStoreChange(store)
  }, [onStoreChange])

  return {
    save: (job: RemoteJob) => act('save', job),
    skip: (job: RemoteJob) => act('skip', job),
    unsave: (job: RemoteJob) => act('unsave', job),
    setStatus: (job: RemoteJob, newStatus: RemoteJob['status']) => act('setStatus', job, { newStatus }),
  }
}

// ── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab({
  defaultQuery,
  savedIds,
  newJobIds,
  onStoreChange,
  onAnalyze,
}: {
  defaultQuery: string
  savedIds: Set<number>
  newJobIds: Set<number>
  onStoreChange: (store: StoreUpdate) => void
  onAnalyze?: (url: string) => void
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [dailyJobs, setDailyJobs] = useState<RemoteJob[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyRan, setDailyRan] = useState(false)
  const [lastSearched, setLastSearched] = useState<string | null>(null)
  const [searchJobs, setSearchJobs] = useState<RemoteJob[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [usedQuery, setUsedQuery] = useState('')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const { save, skip, unsave } = useJobActions(store => {
    setDailyJobs(store.newJobs)
    onStoreChange(store)
  })

  // Load existing daily jobs from store + auto-trigger if stale
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    fetch('/api/jobs-store').then(r => r.json()).then(store => {
      setDailyJobs(store.newJobs || [])
      setLastSearched(store.lastSearched)
      // Auto-trigger daily search if not run today
      if (store.lastSearched !== today) runDailySearch(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runDailySearch = async (force: boolean) => {
    setDailyLoading(true)
    setError('')
    try {
      const res = await fetch('/api/daily-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Search failed (${res.status}) — check your ANTHROPIC_API_KEY in .env.local`)
        return
      }
      setDailyJobs(data.newJobs || [])
      setLastSearched(new Date().toISOString().slice(0, 10))
      setDailyRan(true)
      onStoreChange({ saved: [], newJobs: data.newJobs || [] })
    } catch (e) {
      setError(`Search error — ${e instanceof Error ? e.message : 'check your ANTHROPIC_API_KEY in .env.local'}`)
    }
    finally { setDailyLoading(false) }
  }

  const search = async () => {
    if (!query.trim()) return
    setSearchLoading(true); setError(''); setSearched(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Search failed'); return }
      setSearchJobs(data.jobs || [])
      setUsedQuery(data.query)
    } catch { setError('Network error') }
    finally { setSearchLoading(false) }
  }

  const today = new Date().toISOString().slice(0, 10)
  const isStale = lastSearched !== today

  return (
    <div className="space-y-5">
      {/* Daily feed */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-sm font-semibold text-white">Today&apos;s Matches</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {lastSearched === today
                ? `Last refreshed today · ${dailyJobs.length} new roles to review`
                : isStale ? 'Scanning for new roles…' : 'Not yet searched today'}
            </p>
          </div>
          <button
            onClick={() => runDailySearch(true)}
            disabled={dailyLoading}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <IconRefresh spinning={dailyLoading} />
            {dailyLoading ? 'Scanning…' : 'Refresh'}
          </button>
        </div>
      </div>

      {dailyLoading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-400">Scanning remote job boards across your target roles…</p>
          <p className="text-xs text-zinc-600">Ranking matches against your profile · this takes ~20 seconds</p>
        </div>
      )}

      {!dailyLoading && dailyJobs.length > 0 && (
        <div className="space-y-3">
          {dailyJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              isSaved={savedIds.has(job.id)}
              isNew
              onSave={save}
              onSkip={skip}
              onUnsave={unsave}
              onAnalyze={onAnalyze}
            />
          ))}
        </div>
      )}

      {!dailyLoading && dailyRan && dailyJobs.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm mb-1">No new matches today</p>
          <p className="text-xs text-zinc-600">All new postings have already been seen or don&apos;t clear the fit bar</p>
        </div>
      )}

      {/* Manual search */}
      <div className="border-t border-zinc-800/60 pt-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Custom Search</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><IconSearch /></div>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Partner Success Manager, CS Director…"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" />
          </div>
          <button onClick={search} disabled={searchLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
            {searchLoading ? <><Spinner /> Searching…</> : 'Search'}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Remote only · ranked by profile fit · RemoteOK, Jobicy, WWR, The Muse</p>
      </div>

      {error && <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl"><span>⚠</span> {error}</div>}

      {searchLoading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-400">Searching and ranking…</p>
        </div>
      )}

      {!searchLoading && searchJobs.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-3 px-1">
            <span className="text-white font-medium">{searchJobs.length}</span> results for &ldquo;{usedQuery}&rdquo;
          </p>
          <div className="space-y-3">
            {searchJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                isNew={newJobIds.has(job.id)}
                onSave={save}
                onSkip={skip}
                onUnsave={unsave}
                onAnalyze={onAnalyze}
              />
            ))}
          </div>
        </div>
      )}

      {!searchLoading && searched && searchJobs.length === 0 && !error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400 mb-1">No strong matches for &ldquo;{usedQuery}&rdquo;</p>
          <p className="text-sm text-zinc-600">Try a broader term</p>
        </div>
      )}
    </div>
  )
}

// ── Pipeline Job Card ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: RemoteJob['status']; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied — Pending' },
  { value: 'active', label: 'Active — In Process' },
  { value: 'archived', label: 'Archived' },
]

function PipelineCard({
  job,
  currentStatus,
  onSetStatus,
}: {
  job: RemoteJob & { savedAt?: string }
  currentStatus: RemoteJob['status']
  onSetStatus: (job: RemoteJob, status: RemoteJob['status']) => void
}) {
  const [expandFit, setExpandFit] = useState(false)
  const statusColor = currentStatus === 'active' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : currentStatus === 'applied' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : currentStatus === 'archived' ? 'text-zinc-500 border-zinc-700 bg-zinc-800/50'
    : 'text-zinc-300 border-zinc-700 bg-zinc-800'

  const dateLabel = (job as RemoteJob & { savedAt?: string }).savedAt
    ? `Saved ${(job as RemoteJob & { savedAt?: string }).savedAt}`
    : job.foundDate ? `Found ${job.foundDate}` : null
  const fitTruncate = job.fitReason && job.fitReason.length > 120

  return (
    <div className={`bg-zinc-900 border rounded-xl p-4 transition-colors group ${
      currentStatus === 'archived' ? 'border-zinc-800/60 opacity-60' : 'border-zinc-800 hover:border-zinc-700'
    }`}>
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
          {job.company_logo
            ? <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-zinc-500">{job.company_name?.charAt(0)}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-white hover:text-blue-300 transition-colors text-sm leading-snug flex items-center gap-1.5">
              {job.title}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity"><IconExternal /></span>
            </a>
            {job.fitScore && <FitBadge score={job.fitScore} flag={job.flag} />}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-zinc-400">{job.company_name}</p>
            {dateLabel && <span className="text-xs text-zinc-600">· {dateLabel}</span>}
          </div>

          {job.fitReason && (
            <div className="mb-3">
              <p className={`text-xs text-blue-300/80 leading-relaxed ${fitTruncate && !expandFit ? 'line-clamp-2' : ''}`}>
                {job.fitReason}
              </p>
              {fitTruncate && (
                <button onClick={() => setExpandFit(v => !v)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-0.5">
                  {expandFit ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Status dropdown */}
          <select
            value={currentStatus}
            onChange={e => onSetStatus(job, e.target.value as RemoteJob['status'])}
            className={`text-xs border px-2.5 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${statusColor}`}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-300">{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Saved Tab ─────────────────────────────────────────────────────────────────

function SavedTab({
  saved,
  applied,
  active,
  archived,
  onStoreChange,
}: {
  saved: RemoteJob[]
  applied: RemoteJob[]
  active: RemoteJob[]
  archived: RemoteJob[]
  onStoreChange: (store: StoreUpdate) => void
}) {
  const { setStatus } = useJobActions(onStoreChange)
  const [showArchived, setShowArchived] = useState(false)

  const total = saved.length + applied.length + active.length + archived.length

  if (total === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-16 text-center">
        <div className="text-zinc-600 text-3xl mb-3">☆</div>
        <p className="text-zinc-400 text-sm mb-1">No saved jobs yet</p>
        <p className="text-xs text-zinc-600">Hit Save on any job in the Find Jobs or Analyze tabs to track it here</p>
      </div>
    )
  }

  type Section = { status: RemoteJob['status']; jobs: RemoteJob[]; label: string; sublabel: string; labelCls: string }
  const sections: Section[] = [
    { status: 'saved', jobs: saved, label: 'Saved', sublabel: 'haven\'t applied yet', labelCls: 'text-zinc-400' },
    { status: 'applied', jobs: applied, label: 'Applied — Pending', sublabel: 'waiting to hear back', labelCls: 'text-amber-400' },
    { status: 'active', jobs: active, label: 'Active — In Process', sublabel: 'in interview process', labelCls: 'text-emerald-400' },
  ]

  return (
    <div className="space-y-6">
      {sections.map(s => s.jobs.length > 0 && (
        <div key={s.status}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className={`text-xs font-semibold uppercase tracking-widest ${s.labelCls}`}>{s.label}</span>
            <span className="text-xs text-zinc-700">·</span>
            <span className="text-xs text-zinc-600">{s.jobs.length} role{s.jobs.length !== 1 ? 's' : ''} · {s.sublabel}</span>
          </div>
          <div className="space-y-3">
            {s.jobs.map(job => (
              <PipelineCard key={job.id} job={job} currentStatus={s.status} onSetStatus={setStatus} />
            ))}
          </div>
        </div>
      ))}

      {/* Archived — collapsible */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 mb-3 px-1 text-left w-full group"
          >
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">Archived</span>
            <span className="text-xs text-zinc-700">·</span>
            <span className="text-xs text-zinc-600">{archived.length}</span>
            <span className={`ml-auto text-zinc-600 group-hover:text-zinc-400 transition-all ${showArchived ? 'rotate-180' : ''}`}><IconChevronDown /></span>
          </button>
          {showArchived && (
            <div className="space-y-3">
              {archived.map(job => (
                <PipelineCard key={job.id} job={job} currentStatus="archived" onSetStatus={setStatus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
  addOnComma = true,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
  addOnComma?: boolean
}) {
  const [input, setInput] = useState('')

  const add = (raw: string) => {
    const val = raw.trim().toLowerCase()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(input) }
    if (addOnComma && e.key === ',') { e.preventDefault(); add(input) }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-colors">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs px-2 py-0.5 rounded-full">
          {t}
          <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-zinc-500 hover:text-zinc-200 transition-colors leading-none">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input && add(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
      />
    </div>
  )
}

// ── Profile Edit Section ──────────────────────────────────────────────────────

function ProfileSection({ profile, overrides, onSave }: {
  profile: Profile | null
  overrides: ProfileOverrides
  onSave: (ov: ProfileOverrides) => void
}) {
  const [draft, setDraft] = useState<ProfileOverrides>(overrides)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')

  useEffect(() => { setDraft(overrides) }, [overrides])

  const set = <K extends keyof ProfileOverrides>(key: K, val: ProfileOverrides[K]) =>
    setDraft(d => ({ ...d, [key]: val }))

  const handleResumeUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResumeUploading(true); setResumeError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/resume', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) { setResumeError(data.error || 'Upload failed'); return }
      setDraft(d => ({ ...d, resumeText: data.text, resumeFileName: data.fileName }))
    } catch {
      setResumeError('Upload failed — try again')
    } finally {
      setResumeUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/jobs-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveProfile', profileOverrides: draft }),
      })
      const store = await res.json()
      onSave(store.profileOverrides || {})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(overrides)

  // Effective (shown) values: override wins, else parsed from coaching state
  const effectiveRoles = draft.targetRoles?.length ? draft.targetRoles : profile?.targetRoles || []
  const effectiveSeniority = draft.seniorityBand?.trim() || profile?.seniorityBand || ''

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white mb-0.5">Profile</h2>
        <p className="text-xs text-zinc-500">
          These override values from your coaching file for job search purposes. The coaching file itself is unchanged.
          {profile && <span className="text-zinc-600"> Loaded from coaching state — edit below to customise.</span>}
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Name</label>
        <input
          value={draft.name ?? (profile?.name || '')}
          onChange={e => set('name', e.target.value)}
          placeholder={profile?.name || 'Your name'}
          className="w-64 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Target roles */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Target Roles</label>
        <p className="text-xs text-zinc-600 mb-2">These drive the keywords extracted for your daily job feed. Add every title variant you&apos;d consider.</p>
        <TagInput
          tags={effectiveRoles}
          onChange={v => set('targetRoles', v)}
          placeholder="Partner Success Manager, CS Director — type and press Enter"
        />
      </div>

      {/* Seniority band */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Seniority Band</label>
        <input
          value={draft.seniorityBand ?? effectiveSeniority}
          onChange={e => set('seniorityBand', e.target.value)}
          placeholder={effectiveSeniority || 'e.g. Senior / Director'}
          className="w-64 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Strengths */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Strengths</label>
        <p className="text-xs text-zinc-600 mb-2">Shown in your sidebar. Also visible to the AI ranker.</p>
        <TagInput
          tags={draft.strengths?.length ? draft.strengths : (profile?.strengths || [])}
          onChange={v => set('strengths', v)}
          placeholder="ecosystem partnerships, executive relationships — type and press Enter"
        />
      </div>

      {/* Past employers */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Past Employers</label>
        <p className="text-xs text-zinc-600 mb-2">Used as LinkedIn connection anchors in the sidebar.</p>
        <TagInput
          tags={draft.pastEmployers?.length ? draft.pastEmployers : (profile?.pastEmployers || [])}
          onChange={v => set('pastEmployers', v)}
          placeholder="Salesforce, HubSpot — type and press Enter"
        />
      </div>

      {/* Resume upload */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Resume</label>
        <p className="text-xs text-zinc-600 mb-2">
          Upload your resume (.pdf or .txt) for sharper job matching. The extracted text is injected into every ranking prompt alongside your coaching file.
        </p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            {resumeUploading ? <><Spinner /> Parsing…</> : 'Choose File'}
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleResumeUpload}
              disabled={resumeUploading}
              className="hidden"
            />
          </label>
          {draft.resumeFileName && (
            <span className="text-sm text-zinc-400 flex items-center gap-2">
              {draft.resumeFileName}
              <button
                onClick={() => setDraft(d => ({ ...d, resumeText: undefined, resumeFileName: undefined }))}
                className="text-zinc-600 hover:text-red-400 text-xs underline"
              >
                Remove
              </button>
            </span>
          )}
        </div>
        {resumeError && <p className="text-xs text-red-400 mt-1.5">{resumeError}</p>}
        {draft.resumeText && !resumeError && (
          <p className="text-xs text-zinc-600 mt-1.5">{draft.resumeText.split(/\s+/).length} words extracted — not saved until you click Save Profile below</p>
        )}
      </div>

      {/* AI context */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Additional Context for AI Ranker</label>
        <p className="text-xs text-zinc-600 mb-2">
          Injected verbatim into every ranking prompt. Use this to specify things not in your coaching file — deal-breakers, preferences, industry focus, comp expectations, or anything else that should affect how jobs get scored.
        </p>
        <textarea
          value={draft.aiContext ?? ''}
          onChange={e => set('aiContext', e.target.value)}
          placeholder={`e.g. I have 7 years in B2B SaaS partner ecosystems, specialising in channel, GSI, and technology partnerships. I'm not interested in SMB-focused roles or roles requiring significant outbound prospecting. I prefer product-led companies over legacy enterprise software. I'm open to individual contributor roles at the right company but targeting Director-level and above.`}
          rows={5}
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        {draft.aiContext && (
          <p className="text-xs text-zinc-600 mt-1">{draft.aiContext.trim().split(/\s+/).length} words — injected into every search</p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {saving ? <><Spinner /> Saving…</> : 'Save Profile'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved — sidebar and next search updated
          </span>
        )}
        {!isDirty && !saved && (
          <span className="text-xs text-zinc-600">No unsaved changes</span>
        )}
      </div>
    </div>
  )
}

// ── Search Preferences Section ────────────────────────────────────────────────

function SearchPrefsSection({ prefs, onSave }: {
  prefs: SearchPrefs
  onSave: (prefs: SearchPrefs) => void
}) {
  const [draft, setDraft] = useState<SearchPrefs>(prefs)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync if parent changes (e.g. on initial load)
  useEffect(() => { setDraft(prefs) }, [prefs])

  const set = <K extends keyof SearchPrefs>(key: K, val: SearchPrefs[K]) =>
    setDraft(d => ({ ...d, [key]: val }))

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/jobs-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'savePrefs', prefs: draft }),
      })
      const store = await res.json()
      onSave(store.searchPrefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(prefs)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white mb-0.5">Search Criteria</h2>
        <p className="text-xs text-zinc-500">These preferences are applied to every daily feed and custom search. Saving resets today&apos;s search so you see fresh results.</p>
      </div>

      {/* Salary floor */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Minimum Salary</label>
        <p className="text-xs text-zinc-600 mb-2">Only filters jobs that explicitly list a max salary below this. Jobs with no salary listed are still shown.</p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">$</span>
          <input
            type="number"
            min={0}
            step={5000}
            value={draft.minSalary ?? ''}
            onChange={e => set('minSalary', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 130000"
            className="w-40 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-zinc-500 text-sm">per year</span>
          {draft.minSalary && (
            <span className="text-xs text-zinc-500">(${Math.round(draft.minSalary / 1000)}k)</span>
          )}
          {draft.minSalary && (
            <button onClick={() => set('minSalary', null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Clear</button>
          )}
        </div>
      </div>

      {/* Require title keywords */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Title Must Include</label>
        <p className="text-xs text-zinc-600 mb-2">At least one of these must appear in the job title. Leave empty to show all titles.</p>
        <TagInput
          tags={draft.requireTitleKeywords}
          onChange={v => set('requireTitleKeywords', v)}
          placeholder="partner, success, alliances — type and press Enter"
        />
      </div>

      {/* Exclude title keywords */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Title Exclude List</label>
        <p className="text-xs text-zinc-600 mb-2">Jobs with any of these in the title are filtered before reaching the AI ranker.</p>
        <TagInput
          tags={draft.excludeTitleKeywords}
          onChange={v => set('excludeTitleKeywords', v)}
          placeholder="account executive, sales engineer — type and press Enter"
        />
      </div>

      {/* Company blacklist */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Company Blacklist</label>
        <p className="text-xs text-zinc-600 mb-2">These companies never appear in results, regardless of fit score.</p>
        <TagInput
          tags={draft.blacklistCompanies}
          onChange={v => set('blacklistCompanies', v)}
          placeholder="company name — type and press Enter"
        />
      </div>

      {/* Dream companies */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Dream Companies</label>
        <p className="text-xs text-zinc-600 mb-2">Roles at these companies get a +2 boost to fit score — they&apos;ll always rise to the top.</p>
        <TagInput
          tags={draft.dreamCompanies}
          onChange={v => set('dreamCompanies', v)}
          placeholder="stripe, notion, figma — type and press Enter"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {saving ? <><Spinner /> Saving…</> : 'Save Preferences'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved — next search will use these criteria
          </span>
        )}
        {!isDirty && !saved && (
          <span className="text-xs text-zinc-600">No unsaved changes</span>
        )}
      </div>
    </div>
  )
}

// ── Greenhouse Settings Tab ───────────────────────────────────────────────────

interface GreenhouseBoard { slug: string; name: string }

function GreenhouseTab({ boards, onBoardsChange }: {
  boards: GreenhouseBoard[]
  onBoardsChange: (boards: GreenhouseBoard[]) => void
}) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ valid: boolean; total?: number; relevant?: number; sample?: string[]; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const slugClean = slug.trim().toLowerCase().replace(/\s+/g, '-')

  const test = async () => {
    if (!slugClean) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/greenhouse-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugClean }),
      })
      setTestResult(await res.json())
    } catch { setTestResult({ valid: false, error: 'Network error' }) }
    finally { setTesting(false) }
  }

  const add = async () => {
    if (!slugClean || !testResult?.valid) return
    setSaving(true)
    const displayName = name.trim() || testResult?.sample?.[0]?.split(' ').slice(0, 1).join('') || slugClean
    const res = await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addGreenhouse', slug: slugClean, name: name.trim() || slugClean }),
    })
    const store = await res.json()
    onBoardsChange(store.customGreenhouse || [])
    setSlug(''); setName(''); setTestResult(null)
    setSaving(false)
    void displayName
  }

  const remove = async (s: string) => {
    const res = await fetch('/api/jobs-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeGreenhouse', slug: s }),
    })
    const store = await res.json()
    onBoardsChange(store.customGreenhouse || [])
  }

  return (
    <div className="space-y-5">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Watch a Greenhouse Board</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Every company on Greenhouse has a public board at{' '}
          <code className="text-zinc-400 bg-zinc-800 px-1 rounded">boards.greenhouse.io/[slug]</code>.
          Find the slug in the URL, paste it here, and it&apos;ll be included in every search.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Greenhouse slug</label>
              <input
                value={slug}
                onChange={e => { setSlug(e.target.value); setTestResult(null) }}
                onKeyDown={e => e.key === 'Enter' && test()}
                placeholder="e.g. stripe, gong-io, my-company"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Display name (optional)</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Stripe"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={test} disabled={!slugClean || testing}
              className="flex items-center gap-2 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-lg font-medium transition-colors">
              {testing ? <><Spinner /> Testing…</> : 'Test board'}
            </button>
            {testResult?.valid && (
              <button onClick={add} disabled={saving}
                className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg font-semibold transition-colors">
                {saving ? <><Spinner /> Adding…</> : '+ Add to watchlist'}
              </button>
            )}
          </div>

          {testResult && (
            <div className={`text-xs px-3 py-2.5 rounded-lg border ${
              testResult.valid
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              {testResult.valid ? (
                <div>
                  <span className="font-semibold">✓ Board found</span>
                  {' · '}{testResult.total} total jobs · {testResult.relevant} match your target roles
                  {testResult.sample && testResult.sample.length > 0 && (
                    <div className="mt-1.5 text-emerald-400/80">
                      Sample: {testResult.sample.join(' · ')}
                    </div>
                  )}
                </div>
              ) : (
                <span>✗ {testResult.error || 'Board not found'} — double-check the slug</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom boards list */}
      {boards.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Your Watchlist</p>
          <div className="space-y-2">
            {boards.map(b => (
              <div key={b.slug} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">{b.name}</p>
                  <a href={`https://boards.greenhouse.io/${b.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-zinc-500 hover:text-blue-400 transition-colors">
                    boards.greenhouse.io/{b.slug}
                  </a>
                </div>
                <button onClick={() => remove(b.slug)}
                  className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded">
                  <IconX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Built-in Boards</p>
        <p className="text-xs text-zinc-600 mb-3">These are always monitored. Add companies above to extend the list.</p>
        <div className="flex flex-wrap gap-1.5">
          {['Salesloft','Crossbeam','Impact.com','PartnerStack','Showpad','Workato','Smartsheet',
            'Dialpad','Intercom','Asana','Pendo','Calendly','Lattice','Zuora','Amplitude',
            'Mixpanel','Twilio','Braze','Klaviyo','Hootsuite','Stripe','Okta','Five9'].map(n => (
            <span key={n} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">{n}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  profile,
  appliedJobs,
  selectedCompany,
  onSelectCompany,
}: {
  profile: Profile
  appliedJobs: RemoteJob[]
  selectedCompany: string | null
  onSelectCompany: (c: string | null) => void
}) {
  const activeInterviews = profile.activeInterviews.filter(i => !i.status.toLowerCase().includes('closed'))
  const closedInterviews = profile.activeInterviews.filter(i => i.status.toLowerCase().includes('closed'))
  const [showClosed, setShowClosed] = useState(false)

  return (
    <aside className="w-64 shrink-0 space-y-3">
      {/* Profile card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shrink-0">
            {profile.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm leading-tight">{profile.name}</p>
            <p className="text-xs text-zinc-500">{profile.seniorityBand}</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-3">
          {profile.targetRoles.map(r => (
            <div key={r} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg font-medium truncate">{r}</div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          Remote only
        </div>
      </div>

      {/* Active interviews — clickable */}
      {activeInterviews.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Active</p>
          <div className="space-y-1">
            {activeInterviews.map(i => (
              <button
                key={i.fullLabel}
                onClick={() => onSelectCompany(selectedCompany === i.fullLabel ? null : i.fullLabel)}
                className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors group ${
                  selectedCompany === i.fullLabel
                    ? 'bg-blue-500/15 border border-blue-500/30'
                    : 'hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-sm font-medium truncate ${selectedCompany === i.fullLabel ? 'text-blue-200' : 'text-white group-hover:text-blue-200'} transition-colors`}>
                    {i.company}
                  </span>
                  <StatusBadge status={i.status.split('—')[0].trim()} />
                </div>
                {i.nextRound && (
                  <p className="text-xs text-zinc-500 truncate">{i.nextRound}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Applied — pending */}
      {appliedJobs.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-500/80 uppercase tracking-widest mb-3">Applied</p>
          <div className="space-y-1">
            {appliedJobs.map(job => (
              <a
                key={job.id}
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate group-hover:text-amber-200 transition-colors">{job.company_name}</p>
                  <p className="text-xs text-zinc-500 truncate">{job.title}</p>
                </div>
                <span className="shrink-0 text-zinc-700 group-hover:text-zinc-500 transition-colors"><IconExternal /></span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Closed — collapsible */}
      {closedInterviews.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowClosed(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest hover:text-zinc-400 transition-colors"
          >
            Closed ({closedInterviews.length})
            <span className={`transition-transform ${showClosed ? 'rotate-180' : ''}`}><IconChevronDown /></span>
          </button>
          {showClosed && (
            <div className="px-4 pb-4 space-y-1 border-t border-zinc-800 pt-3">
              {closedInterviews.map(i => (
                <button
                  key={i.fullLabel}
                  onClick={() => onSelectCompany(selectedCompany === i.fullLabel ? null : i.fullLabel)}
                  className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                    selectedCompany === i.fullLabel ? 'bg-zinc-800' : 'hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-500 truncate">{i.company}</span>
                    <StatusBadge status="Closed" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Strengths */}
      {profile.strengths.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Strengths</p>
          <ul className="space-y-2">
            {profile.strengths.map(s => (
              <li key={s} className="flex gap-2 text-xs text-zinc-300 leading-relaxed">
                <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connection anchors */}
      {profile.pastEmployers.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Connection Anchors</p>
          <p className="text-xs text-zinc-600 mb-2">LinkedIn surfaces shared connections via:</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.pastEmployers.map(e => (
              <span key={e} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">{e}</span>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState('')
  const [tab, setTab] = useState<'analyze' | 'search' | 'saved' | 'boards'>('analyze')
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [savedJobs, setSavedJobs] = useState<RemoteJob[]>([])
  const [appliedJobs, setAppliedJobs] = useState<RemoteJob[]>([])
  const [activeJobs, setActiveJobs] = useState<RemoteJob[]>([])
  const [archivedJobs, setArchivedJobs] = useState<RemoteJob[]>([])
  const [newJobs, setNewJobs] = useState<RemoteJob[]>([])
  const [customBoards, setCustomBoards] = useState<GreenhouseBoard[]>([])
  const [searchPrefs, setSearchPrefs] = useState<SearchPrefs>(DEFAULT_SEARCH_PREFS)
  const [profileOverrides, setProfileOverrides] = useState<ProfileOverrides>({})
  const [analyzeUrl, setAnalyzeUrl] = useState<string | undefined>(undefined)

  const handleAnalyzeShortcut = useCallback((url: string) => {
    setAnalyzeUrl(url)
    setTab('analyze')
  }, [])

  const loadProfile = useCallback(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) setProfile(data.profile)
        else setProfileError(data.error || 'Could not load profile')
      })
      .catch(() => setProfileError('Could not reach profile API'))
  }, [])

  const handleProfileSave = useCallback((ov: ProfileOverrides) => {
    setProfileOverrides(ov)
    // Refresh sidebar — profile API now returns merged values
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    loadProfile()
    // Load saved jobs on mount
    fetch('/api/jobs-store').then(r => r.json()).then(store => {
      setSavedJobs(store.saved || [])
      setAppliedJobs(store.applied || [])
      setActiveJobs(store.active || [])
      setArchivedJobs(store.archived || [])
      setNewJobs(store.newJobs || [])
      setCustomBoards(store.customGreenhouse || [])
      setSearchPrefs({ ...DEFAULT_SEARCH_PREFS, ...(store.searchPrefs || {}) })
      setProfileOverrides(store.profileOverrides || {})
    })
  }, [loadProfile])

  const handleStoreChange = useCallback((store: StoreUpdate) => {
    if (store.saved) setSavedJobs(store.saved)
    if (store.applied) setAppliedJobs(store.applied)
    if (store.active) setActiveJobs(store.active)
    if (store.archived) setArchivedJobs(store.archived)
    if (store.newJobs) setNewJobs(store.newJobs)
  }, [])

  const savedIds = new Set(savedJobs.map(j => j.id))
  const newJobIds = new Set(newJobs.map(j => j.id))
  const defaultSearchQuery = profile?.targetRoles?.[0]?.split('/')[0]?.trim() || ''
  const pipelineCount = savedJobs.length + appliedJobs.length + activeJobs.length

  const tabs = [
    { id: 'analyze' as const, label: 'Analyze Job' },
    { id: 'search' as const, label: 'Find Jobs', badge: newJobs.length > 0 ? newJobs.length : undefined },
    { id: 'saved' as const, label: 'Pipeline', badge: pipelineCount > 0 ? pipelineCount : undefined },
    { id: 'boards' as const, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-800/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
              <IconBriefcase />
            </div>
            <span className="font-semibold text-white text-sm">Job Search</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">Powered by your coaching profile</span>
          </div>

          {selectedCompany ? (
            <button onClick={() => setSelectedCompany(null)}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
              <IconBack />
              Back to {tab === 'analyze' ? 'Analyze' : tab === 'search' ? 'Find Jobs' : tab === 'boards' ? 'Settings' : 'Pipeline'}
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    tab === t.id ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {t.label}
                  {t.badge !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      tab === t.id ? 'bg-zinc-600 text-zinc-300' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {profileError && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300">
            <strong>Profile not loaded:</strong> {profileError}
            {' '}— Set <code className="bg-amber-500/20 px-1 rounded">ANTHROPIC_API_KEY</code> in <code className="bg-amber-500/20 px-1 rounded">.env.local</code> and restart.
          </div>
        )}

        <div className="flex gap-5 items-start">
          {profile && (
            <Sidebar profile={profile} appliedJobs={appliedJobs} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} />
          )}

          {selectedCompany ? (
            <CompanyDetailPanel company={selectedCompany} onBack={() => setSelectedCompany(null)} onProfileRefresh={loadProfile} />
          ) : (
            <div className="flex-1 min-w-0">
              {tab === 'analyze' && <AnalyzeTab savedIds={savedIds} initialUrl={analyzeUrl} onStoreChange={handleStoreChange} />}
              {tab === 'search' && (
                <SearchTab
                  defaultQuery={defaultSearchQuery}
                  savedIds={savedIds}
                  newJobIds={newJobIds}
                  onStoreChange={handleStoreChange}
                  onAnalyze={handleAnalyzeShortcut}
                />
              )}
              {tab === 'saved' && (
                <SavedTab
                  saved={savedJobs}
                  applied={appliedJobs}
                  active={activeJobs}
                  archived={archivedJobs}
                  onStoreChange={handleStoreChange}
                />
              )}
              {tab === 'boards' && (
                <div className="space-y-5">
                  <ProfileSection
                    profile={profile}
                    overrides={profileOverrides}
                    onSave={handleProfileSave}
                  />
                  <SearchPrefsSection prefs={searchPrefs} onSave={setSearchPrefs} />
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-1">Greenhouse Job Boards</p>
                    <GreenhouseTab boards={customBoards} onBoardsChange={setCustomBoards} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
