import type { NewsItem } from './types'

// Recent headlines from Google News RSS. Free, fast, no API key.
export async function fetchNews(company: string, limit = 5): Promise<NewsItem[]> {
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
      if (items.length >= limit) break
    }
    return items
  } catch {
    return []
  }
}
