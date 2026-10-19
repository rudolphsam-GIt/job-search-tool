'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CompanyDetail, RoundItem, StepItem } from '@/lib/types'
import { isClosedStage } from '@/lib/status'
import { PrepPanel } from './prep-panel'
import { Spinner, IconChevronDown, IconExternal, IconLinkedIn, StatusSelect, SeverityDot } from './ui'

const inputCls =
  'bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Building blocks ───────────────────────────────────────────────────────────

function Card({ title, accent = 'text-zinc-500', action, children }: {
  title: string
  accent?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function CheckButton({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-emerald-400'
      }`}>
      {done && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-zinc-600 hover:text-red-400 transition-all shrink-0 text-sm px-1">
      ✕
    </button>
  )
}

function describeRound(r: RoundItem) {
  return [r.date, r.name, r.who && `with ${r.who}`].filter(Boolean).join(' · ')
}

// ── Interview process ─────────────────────────────────────────────────────────

function RoundsCard({ rounds, closed, onSave }: { rounds: RoundItem[]; closed: boolean; onSave: (r: RoundItem[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<RoundItem>({ name: '', date: '', who: '', done: false })
  const nextIndex = closed ? -1 : rounds.findIndex(r => !r.done)

  const add = () => {
    if (!draft.name.trim()) return
    onSave([...rounds, { ...draft, name: draft.name.trim() }])
    setDraft({ name: '', date: '', who: '', done: false })
    setAdding(false)
  }

  return (
    <Card title="Interview Process" accent="text-blue-400"
      action={!adding && (
        <button onClick={() => setAdding(true)} className="text-xs font-semibold text-blue-400 hover:text-blue-300">+ Add round</button>
      )}>
      {rounds.length === 0 && !adding && (
        <p className="text-sm text-zinc-500">
          No rounds logged yet. Add each round as it&apos;s scheduled, then check it off when it&apos;s done.
        </p>
      )}

      <ol className="space-y-0">
        {rounds.map((r, i) => {
          const isNext = i === nextIndex
          return (
            <li key={i} className="group flex gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <CheckButton done={r.done} label={r.done ? 'Mark round not done' : 'Mark round done'}
                  onClick={() => onSave(rounds.map((x, j) => j === i ? { ...x, done: !x.done } : x))} />
                {i < rounds.length - 1 && <div className={`w-0.5 flex-1 min-h-3 my-1 ${r.done ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${r.done ? 'text-zinc-400' : isNext ? 'text-white font-medium' : 'text-zinc-300'}`}>
                    {r.name}
                    {isNext && <span className="ml-2 text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-normal">Up next</span>}
                  </p>
                  <RemoveButton label="Remove round" onClick={() => onSave(rounds.filter((_, j) => j !== i))} />
                </div>
                {(r.date || r.who) && (
                  <p className="text-xs text-zinc-500 mt-0.5">{[r.date, r.who && `with ${r.who}`].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {adding && (
        <div className="space-y-2 mt-1">
          <input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Round, e.g. Hiring manager interview" className={`${inputCls} w-full`} />
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && add()} placeholder="When, e.g. 2026-10-22" className={inputCls} />
            <input value={draft.who} onChange={e => setDraft({ ...draft, who: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && add()} placeholder="With whom" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={draft.done} onChange={e => setDraft({ ...draft, done: e.target.checked })} />
            Already done
          </label>
          <div className="flex gap-2">
            <button onClick={add} disabled={!draft.name.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Add round</button>
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2">Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Next steps ────────────────────────────────────────────────────────────────

function suggestionsFor(stage: string, company: string): string[] {
  switch (stage) {
    case 'Researching':
    case 'Applying':
      return [`Find a referral at ${company}`, 'Tailor resume to the posting', 'Submit the application']
    case 'Applied':
      return ['Follow up with the recruiter in a week', `Find a referral at ${company}`]
    case 'Interviewing':
    case 'Final Round':
      return ['Build the day of cheat sheet', 'Send thank you notes within 24 hours', 'Run debrief with the coach after each round']
    case 'Offer':
      return ['Run negotiate with the coach', 'Get the offer in writing', 'Ask for the decision deadline']
    default:
      return ['Run reflect with the coach to capture lessons']
  }
}

function NextStepsCard({ steps, stage, company, onSave }: {
  steps: StepItem[]
  stage: string
  company: string
  onSave: (s: StepItem[]) => void
}) {
  const [text, setText] = useState('')
  const add = (t: string) => {
    if (!t.trim()) return
    onSave([...steps, { text: t.trim(), done: false }])
    setText('')
  }
  const open = steps.filter(s => !s.done).length
  const suggestions = suggestionsFor(stage, company).filter(s => !steps.some(x => x.text === s))

  return (
    <Card title="Next Steps" accent="text-emerald-400"
      action={steps.length > 0 && <span className="text-xs text-zinc-600">{open} open</span>}>
      {steps.length > 0 && (
        <ul className="space-y-2 mb-3">
          {steps.map((st, i) => (
            <li key={i} className="group flex items-start gap-2.5">
              <CheckButton done={st.done} label={st.done ? 'Mark step not done' : 'Mark step done'}
                onClick={() => onSave(steps.map((x, j) => j === i ? { ...x, done: !x.done } : x))} />
              <span className={`flex-1 text-sm leading-snug ${st.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{st.text}</span>
              <RemoveButton label="Remove step" onClick={() => onSave(steps.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add(text)}
        placeholder="Add a step and press Enter" className={`${inputCls} w-full`} />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => add(s)}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 px-2 py-1 rounded-full transition-colors text-left">
              + {s}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Interviewers ──────────────────────────────────────────────────────────────

function InterviewerRow({ iv }: { iv: CompanyDetail['interviewers'][number] }) {
  const [expanded, setExpanded] = useState(false)
  const long = iv.notes.length > 220
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-400">
        {iv.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-white">{iv.name}</span>
          {iv.linkedin && (
            <a href={iv.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${iv.name} on LinkedIn`}
              className="text-blue-400 hover:text-blue-300 transition-colors"><IconLinkedIn /></a>
          )}
        </div>
        {iv.notes && (
          <>
            <p className={`text-xs text-zinc-400 leading-relaxed ${long && !expanded ? 'line-clamp-3' : ''}`}>{iv.notes}</p>
            {long && (
              <button onClick={() => setExpanded(v => !v)} className="text-xs text-zinc-500 hover:text-zinc-300 mt-0.5">
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Role details ──────────────────────────────────────────────────────────────

function RoleCard({ detail }: { detail: CompanyDetail }) {
  const [open, setOpen] = useState(false)
  const items = detail.responsibilities
  if (!items.length && !detail.metrics.length) return null
  // A single long note reads better as a paragraph than a one item list
  const asParagraph = items.length === 1

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Role Details</h3>
        <span className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}><IconChevronDown /></span>
      </button>
      {open && (
        <div className="px-5 pb-5 -mt-1">
          {asParagraph ? (
            <p className="text-sm text-zinc-300 leading-relaxed">{items[0]}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                  <span className="text-zinc-600 shrink-0">•</span>{r}
                </li>
              ))}
            </ul>
          )}
          {detail.metrics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">They&apos;ll measure you on</p>
              <ul className="space-y-1.5">
                {detail.metrics.map((m, i) => (
                  <li key={i} className="flex gap-2 text-xs text-zinc-400"><span className="text-blue-500 shrink-0">→</span>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Update log ────────────────────────────────────────────────────────────────

function UpdateCard({ company, onUpdated }: { company: string; onUpdated: (d: CompanyDetail) => void }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async () => {
    if (!text.trim()) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/company?name=${encodeURIComponent(company)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update: text }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Update failed' }); return }
      onUpdated(data)
      setText('')
      setMsg({ ok: true, text: 'Saved to your coaching file' })
    } catch { setMsg({ ok: false, text: 'Network error' }) }
    finally { setSaving(false) }
  }

  return (
    <Card title="Log an Update">
      <p className="text-xs text-zinc-500 -mt-1 mb-3">Tell it what happened in plain words, like a round result, new date or feedback, and it updates the record.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
        placeholder="e.g. Finished the hiring manager round with Lisa. Next is a panel on Thursday with two directors."
        className={`${inputCls} w-full resize-none`} />
      <div className="flex items-center gap-3 mt-2">
        <button onClick={submit} disabled={saving || !text.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          {saving ? <><Spinner /> Updating…</> : 'Save update'}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CompanyDetailPanel({ company, onBack, onProfileRefresh }: {
  company: string
  onBack: () => void
  onProfileRefresh: () => void
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const res = await fetch(`/api/company?name=${encodeURIComponent(company)}`)
      const data = await res.json()
      if (!res.ok) { setLoadError(data.error || 'Failed to load company data'); return }
      setDetail(data)
    } catch { setLoadError('Network error') }
    finally { setLoading(false) }
  }, [company])

  useEffect(() => { load() }, [load])

  // Status, rounds and next steps all save through PATCH. Show the change right away, then take the server's copy.
  const patch = async (body: Record<string, unknown>, optimistic: Partial<CompanyDetail>) => {
    if (!detail) return
    const previous = detail
    setDetail({ ...detail, ...optimistic })
    setSaving(true); setSaveError('')
    try {
      const res = await fetch(`/api/company?name=${encodeURIComponent(company)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setDetail(previous); setSaveError(data.error || 'Save failed'); return }
      setDetail(data)
      onProfileRefresh()
    } catch { setDetail(previous); setSaveError('Network error, change not saved') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-zinc-400">Loading {company.split(' — ')[0]}…</p>
      </div>
    </div>
  )

  if (loadError || !detail) return (
    <div className="flex-1 flex items-center justify-center py-24">
      <div className="text-center">
        <p className="text-zinc-400 mb-2">{loadError || 'No data found'}</p>
        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">← Back</button>
      </div>
    </div>
  )

  const closed = isClosedStage(detail.stage)
  const nextRound = detail.roundItems.find(r => !r.done)
  const upNext = nextRound ? describeRound(nextRound)
    : detail.nextRound && !/none scheduled/i.test(detail.nextRound) ? detail.nextRound : ''

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <header className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">{detail.company}</h2>
              {detail.postingUrl && (
                <a href={detail.postingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-300 transition-colors">
                  View posting <IconExternal />
                </a>
              )}
            </div>
            {detail.role && <p className="text-zinc-400 text-sm mt-0.5">{detail.role}</p>}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <StatusSelect stage={detail.stage} saving={saving} onChange={stage => patch({ stage }, { stage })} />
              {saving && <Spinner />}
              {detail.statusUpdated && !saving && <span className="text-xs text-zinc-600">updated {detail.statusUpdated}</span>}
              {saveError && <span className="text-xs text-red-400">{saveError}</span>}
            </div>
            {detail.statusNote && <p className="text-xs text-zinc-500 mt-2 max-w-2xl leading-relaxed">{detail.statusNote}</p>}
          </div>
          {detail.fitAssessment && (
            <div className="text-right shrink-0 max-w-[12rem]">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Fit</p>
              <p className="text-sm text-zinc-300">{detail.fitAssessment.split('—')[0].trim()}</p>
            </div>
          )}
        </div>

        {upNext && !closed && (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 text-sm text-blue-200">
            <span className="font-semibold text-blue-300">Up next </span>{upNext}
          </div>
        )}
        {detail.stage === 'Offer' && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2.5 text-sm text-emerald-300 font-medium">
            Offer in hand. Run negotiate with the coach before you respond.
          </div>
        )}
      </header>

      {/* Body: main column plus a right rail. Both always have a card, so neither side sits empty. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <RoundsCard rounds={detail.roundItems} closed={closed} onSave={rounds => patch({ rounds }, { roundItems: rounds })} />
          {!closed && <PrepPanel company={company} detail={detail} />}
          {detail.interviewers.length > 0 && (
            <Card title="Interviewers">
              <div className="space-y-4">{detail.interviewers.map((iv, i) => <InterviewerRow key={i} iv={iv} />)}</div>
            </Card>
          )}
          <RoleCard detail={detail} />
        </div>

        <aside className="space-y-4 min-w-0">
          <NextStepsCard steps={detail.nextSteps} stage={detail.stage} company={detail.company}
            onSave={nextSteps => patch({ nextSteps }, { nextSteps })} />

          {detail.concerns.length > 0 && (
            <Card title="Concerns to Address" accent="text-amber-500">
              <ul className="space-y-3">
                {detail.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <SeverityDot severity={c.severity} />
                    <div className="min-w-0 text-sm text-zinc-300 leading-snug">
                      {c.text}
                      {c.severity && (
                        <span className={`ml-1.5 text-xs ${c.severity === 'high' ? 'text-red-400' : c.severity === 'medium' ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {c.severity}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detail.questions.length > 0 && (
            <Card title="Questions to Ask">
              <ol className="space-y-2.5">
                {detail.questions.map((q, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                    <span className="text-zinc-600 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span>&ldquo;{q}&rdquo;</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {(detail.positioningAngle || detail.keySignals) && (
            <Card title="Your Angle" accent="text-violet-400">
              {detail.positioningAngle && <p className="text-sm text-zinc-300 leading-relaxed">{detail.positioningAngle}</p>}
              {detail.keySignals && (
                <p className={`text-xs text-zinc-500 leading-relaxed ${detail.positioningAngle ? 'mt-3 pt-3 border-t border-zinc-800' : ''}`}>
                  {detail.keySignals}
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>

      <UpdateCard company={company} onUpdated={d => { setDetail(d); onProfileRefresh() }} />
    </div>
  )
}
