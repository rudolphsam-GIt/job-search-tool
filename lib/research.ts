import Anthropic from '@anthropic-ai/sdk'
import { COACH_RULES } from './coach-rules'

export const MODEL = 'claude-opus-5-5'
const MAX_CONTINUATIONS = 4

export function collectSources(content: Anthropic.Beta.BetaContentBlock[], into: Map<string, string>) {
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === 'web_search_result') into.set(r.url, r.title)
    }
    if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
      const doc = block.content.content
      into.set(block.content.url, doc.title || block.content.url)
    }
  }
}

// Let Claude search and read the web, then return its notes plus every page it touched
export async function webResearch(client: Anthropic, prompt: string, { searches = 8, fetches = 6 } = {}) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }]
  const sources = new Map<string, string>()
  let notes = ''
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      system: COACH_RULES,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: searches },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: fetches },
      ],
      messages,
    }).finalMessage()

    if (response.stop_reason === 'refusal') throw new Error('The model declined the research request.')
    collectSources(response.content, sources)
    notes += response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    if (response.stop_reason !== 'pause_turn') break
    // The server side tool loop hit its limit. Sending the turn back resumes it.
    messages.push({ role: 'assistant', content: response.content })
  }
  return { notes, sources: Array.from(sources, ([url, title]) => ({ url, title })) }
}

// One call that must answer in the given JSON schema. Pass the coaching file as cacheable context when it's needed.
export async function structuredCall<T>(client: Anthropic, task: string, schema: Record<string, unknown>, coachingState?: string): Promise<T> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (coachingState) {
    content.push({
      type: 'text',
      text: `The candidate's full coaching file (profile, resume analysis, storybank, past interview loops and coaching notes):\n\n${coachingState}`,
      cache_control: { type: 'ephemeral' },
    })
  }
  content.push({ type: 'text', text: task })

  const response = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: COACH_RULES,
    messages: [{ role: 'user', content }],
  }).finalMessage()

  if (response.stop_reason === 'refusal') throw new Error('The model declined this request.')
  if (response.stop_reason === 'max_tokens') throw new Error('The response was cut off. Try again.')
  return JSON.parse(response.content.filter(b => b.type === 'text').map(b => b.text).join('')) as T
}

export function errorResponse(err: unknown): { error: string; status: number } {
  if (err instanceof Anthropic.APIError) {
    // Errors raised mid stream carry no HTTP status, and their message is the raw JSON body
    const body = err.error as { error?: { message?: string } } | undefined
    const message = body?.error?.message || err.message
    if (/credit balance/i.test(message)) {
      return { error: 'Your Anthropic API credit balance is too low. Add credits at console.anthropic.com under Plans & Billing, then try again.', status: 402 }
    }
    return { error: `Claude API error${err.status ? ` (${err.status})` : ''}: ${message}`, status: 502 }
  }
  return { error: err instanceof Error ? err.message : 'Request failed', status: 500 }
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
