'use client'

import { useState, useEffect } from 'react'
import type { CompanyDetail, PrepRequest, PrepResult, CheatSheet } from '@/lib/types'

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// A standalone light page for printing or saving as PDF, independent of the app's dark theme
function printableHtml(cs: CheatSheet, sources: PrepResult['sources']) {
  const li = (items: string[]) => items.map(i => `<li>${esc(i)}</li>`).join('')
  const sub = [cs.interviewer && `Interview with ${cs.interviewer}`, cs.interviewDate].filter(Boolean).join(' · ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cs.company)} Cheat Sheet</title>
<style>
body{font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#1d1d1b;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0 0 2px}.sub{color:#5f5d57;margin:0 0 16px}
h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#0b5cad;margin:16px 0 6px}
.say{background:#e8f0fa;border-left:3px solid #0b5cad;padding:8px 10px;border-radius:4px}
.warn{background:#fdf1e3;border-left-color:#9a4b00}
ul,ol{margin:0;padding-left:20px}li{margin:0 0 4px}b.id{color:#0b5cad}
.muted{color:#5f5d57;font-size:12px}section{break-inside:avoid}
</style></head><body>
<h1>${esc(cs.company)}, ${esc(cs.role)}</h1><p class="sub">${esc(sub)}</p>
<section><h2>Remember</h2><p>${esc(cs.remember)}</p></section>
<section><h2>Your positioning</h2><p class="say">${esc(cs.positioning)}</p></section>
<section><h2>Their top priorities</h2><ol>${li(cs.priorities)}</ol></section>
<section><h2>Your stories</h2><ul>${cs.stories.map(s => `<li><b class="id">${esc(s.id)}</b> ${esc(s.title)}. ${esc(s.hook)}</li>`).join('')}</ul></section>
<section><h2>Likely questions</h2><ul>${cs.likelyQuestions.map(q => `<li><b class="id">${esc(q.storyId)}</b> ${esc(q.question)}</li>`).join('')}</ul></section>
<section><h2>Concern to be ready for</h2><p class="say warn"><b>${esc(cs.leadConcern.concern)}</b> ${esc(cs.leadConcern.counter)}</p>
<ul style="margin-top:8px">${cs.otherConcerns.map(c => `<li><b>${esc(c.concern)}</b> ${esc(c.counter)}</li>`).join('')}</ul></section>
<section><h2>Your best question</h2><p class="say">${esc(cs.bestQuestion)}</p><ul style="margin-top:8px">${li(cs.backupQuestions)}</ul></section>
<section><h2>Interviewer read</h2><p>${esc(cs.interviewerRead)}</p></section>
${cs.caveats ? `<p class="muted">${esc(cs.caveats)}</p>` : ''}
${sources.length ? `<p class="muted">Pages searched. ${sources.map(s => esc(s.title || s.url)).join(' · ')}</p>` : ''}
</body></html>`
}

function Label({ children, color = 'text-zinc-500' }: { children: React.ReactNode; color?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${color}`}>{children}</p>
}

function CheatSheetView({ result, onRegenerate }: { result: PrepResult; onRegenerate: () => void }) {
  const cs = result.cheatSheet
  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(printableHtml(cs, result.sources))
    w.document.close()
    w.focus()
    w.print()
  }
  const confCls = cs.confidence === 'high' ? 'text-emerald-400' : cs.confidence === 'medium' ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white font-medium">{cs.role}</p>
          <p className="text-xs text-zinc-500">
            {[cs.interviewer && `with ${cs.interviewer}`, cs.interviewDate].filter(Boolean).join(' · ')}
            {' · '}<span className={confCls}>{cs.confidence} confidence</span>
            {' · '}generated {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={print} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            Print / PDF
          </button>
          <button onClick={onRegenerate} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 transition-colors">
            Redo
          </button>
        </div>
      </div>

      <div>
        <Label color="text-blue-400">Remember</Label>
        <p className="text-sm text-zinc-300 leading-relaxed">{cs.remember}</p>
      </div>

      <div className="bg-blue-500/10 border-l-2 border-blue-500 rounded px-3 py-2.5">
        <Label color="text-blue-400">Your positioning</Label>
        <p className="text-sm text-zinc-200 leading-relaxed">&ldquo;{cs.positioning}&rdquo;</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Their top priorities</Label>
          <ol className="space-y-1.5 list-decimal pl-4">
            {cs.priorities.map((p, i) => <li key={i} className="text-sm text-zinc-300 leading-snug">{p}</li>)}
          </ol>
        </div>
        <div>
          <Label>Your stories</Label>
          <ul className="space-y-2">
            {cs.stories.map(s => (
              <li key={s.id} className="text-sm text-zinc-300 leading-snug">
                <span className="text-blue-400 font-semibold font-mono text-xs mr-1.5">{s.id}</span>
                <span className="text-white">{s.title}.</span> {s.hook}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <Label>Likely questions</Label>
        <ul className="space-y-1.5">
          {cs.likelyQuestions.map((q, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-snug">
              <span className={`font-mono text-xs w-10 shrink-0 mt-0.5 ${q.storyId === 'Gap' ? 'text-red-400' : 'text-blue-400'}`}>{q.storyId}</span>
              {q.question}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-amber-500/10 border-l-2 border-amber-500 rounded px-3 py-2.5">
        <Label color="text-amber-500">Concern to be ready for</Label>
        <p className="text-sm text-white font-medium mb-1">{cs.leadConcern.concern}</p>
        <p className="text-sm text-zinc-300 leading-relaxed">&ldquo;{cs.leadConcern.counter}&rdquo;</p>
      </div>
      {cs.otherConcerns.length > 0 && (
        <ul className="space-y-1.5">
          {cs.otherConcerns.map((c, i) => (
            <li key={i} className="text-sm text-zinc-400 leading-snug">
              <span className="text-zinc-200 font-medium">{c.concern}.</span> {c.counter}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Your best question</Label>
          <p className="text-sm text-zinc-200 leading-snug mb-2">&ldquo;{cs.bestQuestion}&rdquo;</p>
          <ul className="space-y-1">
            {cs.backupQuestions.map((q, i) => <li key={i} className="text-xs text-zinc-500 leading-snug">{q}</li>)}
          </ul>
        </div>
        <div>
          <Label>Interviewer read</Label>
          <p className="text-sm text-zinc-400 leading-relaxed">{cs.interviewerRead}</p>
        </div>
      </div>

      {cs.caveats && <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">{cs.caveats}</p>}
      {result.sources.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer hover:text-zinc-300">{result.sources.length} pages searched</summary>
          <ul className="mt-2 space-y-1">
            {result.sources.map(s => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{s.title || s.url}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function PrepPanel({ company, detail }: { company: string; detail: CompanyDetail }) {
  const [result, setResult] = useState<PrepResult | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<PrepRequest>({
    company,
    role: detail.role,
    interviewer: detail.interviewers[0]?.name || '',
    interviewerLinkedin: detail.interviewers[0]?.linkedin || '',
  })

  useEffect(() => {
    fetch(`/api/prep?name=${encodeURIComponent(company)}`)
      .then(r => r.json())
      .then((saved: PrepResult | null) => {
        if (!saved) return
        setResult(saved)
        setForm(f => ({ ...f, ...saved.request }))
      })
      .catch(() => {})
  }, [company])

  const set = (k: keyof PrepRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const generate = async () => {
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Prep failed'); return }
      setResult(data)
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setGenerating(false) }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Day Of Cheat Sheet</p>
        {!result && !showForm && (
          <button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            Prep for an interview
          </button>
        )}
      </div>

      {!result && !showForm && (
        <p className="text-xs text-zinc-600">
          Researches the posting and your interviewer on the web, then builds a one page cheat sheet from your storybank and past loops.
        </p>
      )}

      {showForm && (
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.role || ''} onChange={set('role')} placeholder="Role title" className={inputCls} />
            <input value={form.reqId || ''} onChange={set('reqId')} placeholder="Requisition ID (e.g. JR-0107329)" className={inputCls} />
            <input value={form.interviewer || ''} onChange={set('interviewer')} placeholder="Interviewer name" className={inputCls} />
            <input value={form.interviewerLinkedin || ''} onChange={set('interviewerLinkedin')} placeholder="Interviewer LinkedIn URL" className={inputCls} />
            <input value={form.interviewDate || ''} onChange={set('interviewDate')} placeholder="When (e.g. today 2pm)" className={inputCls} />
            <input value={form.notes || ''} onChange={set('notes')} placeholder="Anything else you know" className={inputCls} />
          </div>
          <textarea value={form.jobDescription || ''} onChange={set('jobDescription')} rows={3}
            placeholder="Paste the job description if the posting is no longer public (optional)"
            className={`${inputCls} resize-none`} />
          <div className="flex items-center gap-3">
            <button onClick={generate} disabled={generating}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              {generating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Researching, this takes a minute or two…</> : 'Build cheat sheet'}
            </button>
            {!generating && (
              <button onClick={() => setShowForm(false)} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {result && !showForm && <CheatSheetView result={result} onRegenerate={() => setShowForm(true)} />}
    </div>
  )
}
