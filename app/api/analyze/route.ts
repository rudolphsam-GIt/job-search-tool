import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { loadCoachingStateRaw } from '@/lib/coaching-state'
import type { NewsItem } from '@/lib/types'


async function fetchJobContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch {
    return ''
  }
}

async function fetchNews(company: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`"${company}"`)
    const res = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(5000) }
    )
    const xml = await res.text()
    const items: NewsItem[] = []
    let m: RegExpExecArray | null
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1]
      const title =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title>(.*?)<\/title>/)?.[1] ||
        ''
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
      if (title && link) items.push({ title, link, pubDate })
      if (items.length >= 5) break
    }
    return items
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const { url, description } = await req.json()

  let jobContent = description || ''
  if (url && !description) {
    jobContent = await fetchJobContent(url)
  }

  if (!jobContent && !url) {
    return NextResponse.json({ error: 'Provide a job URL or paste the job description' }, { status: 400 })
  }

  const coachingState = loadCoachingStateRaw()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a job search intelligence assistant helping a specific candidate evaluate job opportunities. The candidate is ONLY interested in REMOTE roles.

Here is the candidate's full coaching profile:

<coaching_state>
${coachingState}
</coaching_state>`,
    messages: [
      {
        role: 'user',
        content: `Analyze this job opportunity for the candidate.

${url ? `Job URL: ${url}` : ''}
${jobContent ? `\nJob content:\n${jobContent}` : ''}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "company": "company name",
  "role": "job title",
  "isRemote": true or false,
  "fitScore": number 1-10,
  "fitSummary": "2-3 sentence summary of overall fit",
  "alignmentPoints": ["specific alignment with candidate profile", ...],
  "concerns": ["potential concern or gap", ...],
  "storiesToDeploy": ["story or experience from their profile to use in this interview, with brief why"],
  "alreadyApplied": true or false (check Outcome Log and Interview Loops in coaching state),
  "linkedinNetworkSearchUrl": "https://www.linkedin.com/search/results/people/?keywords=COMPANY_NAME&network=%5B%22F%22%2C%22S%22%5D",
  "glassdoorUrl": "https://www.glassdoor.com/Search/results.htm?keyword=COMPANY_NAME",
  "recommendation": "apply" or "skip" or "monitor"
}`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  let analysis
  try {
    const jsonMatch = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    analysis = JSON.parse(jsonMatch ? jsonMatch[1] : raw)
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw }, { status: 500 })
  }

  const news = analysis.company ? await fetchNews(analysis.company) : []

  return NextResponse.json({ ...analysis, news })
}
