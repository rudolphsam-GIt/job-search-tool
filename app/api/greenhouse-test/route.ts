import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { slug } = await req.json()
  if (!slug) return NextResponse.json({ error: 'No slug provided' }, { status: 400 })

  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return NextResponse.json({ valid: false, error: `Board not found (${res.status})` })
    const data = await res.json()
    const jobs: { title: string }[] = data.jobs || []
    const relevant = jobs.filter(j =>
      /partner|success|channel|enablement|customer|alliance|ecosystem/i.test(j.title)
    )
    return NextResponse.json({
      valid: true,
      total: jobs.length,
      relevant: relevant.length,
      sample: relevant.slice(0, 3).map(j => j.title),
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Request timed out or failed' })
  }
}
