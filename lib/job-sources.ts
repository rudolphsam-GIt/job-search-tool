import fs from 'fs'
import path from 'path'
import type { RemoteJob } from './types'

export const EXCLUDED_TITLE_PATTERNS = [
  /account executive/i,
  /solutions engineer/i,
  /sales engineer/i,
  /\bae\b/,
]

interface RemoteOKJob {
  slug: string
  id: string | number
  date: string
  company: string
  company_logo?: string
  position: string
  tags?: string[]
  description?: string
  location?: string
  apply_url?: string
  url?: string
  salary_min?: number
  salary_max?: number
}

export async function fetchRemoteOK(): Promise<RemoteJob[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    })
    const data: (RemoteOKJob | { legal?: string })[] = await res.json()
    const jobs = data.filter((j): j is RemoteOKJob => typeof j === 'object' && 'position' in j && !!j.position)
    return jobs.map(j => {
      const salary = j.salary_min && j.salary_max
        ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
        : j.salary_min ? `From $${Math.round(j.salary_min / 1000)}k` : ''
      return {
        id: typeof j.id === 'string' ? parseInt(j.id) || 0 : j.id,
        url: j.url || j.apply_url || `https://remoteok.com/remote-jobs/${j.slug}`,
        title: j.position,
        company_name: j.company,
        company_logo: j.company_logo,
        category: 'remote',
        tags: j.tags || [],
        job_type: 'full_time',
        publication_date: j.date || new Date().toISOString(),
        candidate_required_location: j.location || 'Worldwide',
        salary,
        description: (j.description || '').replace(/<[^>]+>/g, ''),
      } as RemoteJob
    })
  } catch { return [] }
}

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  companyLogo?: string
  jobIndustry?: string[]
  jobType?: string[]
  jobGeo?: string
  jobExcerpt?: string
  jobDescription?: string
  pubDate?: string
}

export async function fetchJobicy(): Promise<RemoteJob[]> {
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50&geo=usa', {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const jobs: JobicyJob[] = data.jobs || []
    return jobs.map((j, i) => ({
      id: 9000000 + (j.id || i),
      url: j.url,
      title: j.jobTitle,
      company_name: j.companyName,
      company_logo: j.companyLogo,
      category: (j.jobIndustry || [])[0] || 'remote',
      tags: j.jobIndustry || [],
      job_type: (j.jobType || [])[0] || 'full_time',
      publication_date: j.pubDate || new Date().toISOString(),
      candidate_required_location: j.jobGeo || 'USA Remote',
      salary: '',
      description: (j.jobDescription || j.jobExcerpt || '').replace(/<[^>]+>/g, ''),
    } as RemoteJob))
  } catch { return [] }
}

export async function fetchTheMuse(): Promise<RemoteJob[]> {
  const categories = ['Account+Management', 'Customer+Service', 'Sales', 'Business+Development']
  try {
    const pages = await Promise.all(categories.map(cat =>
      fetch(`https://www.themuse.com/api/public/jobs?category=${cat}&location=Flexible+%2F+Remote&page=1`, {
        signal: AbortSignal.timeout(12000),
      }).then(r => r.json()).catch(() => ({ results: [] }))
    ))
    const jobs: RemoteJob[] = []
    let idCounter = 7000000
    const seen = new Set<string>()
    for (const page of pages) {
      for (const j of (page.results || [])) {
        const url: string = j.refs?.landing_page || ''
        if (!url || seen.has(url)) continue
        seen.add(url)
        const desc = (j.contents || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        const location = (j.locations || []).map((l: { name: string }) => l.name).join(', ') || 'Remote'
        const tags = (j.categories || []).map((c: { name: string }) => c.name)
        jobs.push({
          id: idCounter++,
          url,
          title: j.name || '',
          company_name: j.company?.name || '',
          company_logo: j.company?.refs?.logo_image || '',
          category: tags[0] || 'remote',
          tags,
          job_type: 'full_time',
          publication_date: j.publication_date || new Date().toISOString(),
          candidate_required_location: location,
          salary: '',
          description: desc.slice(0, 500),
        } as RemoteJob)
      }
    }
    return jobs
  } catch { return [] }
}

export async function fetchWWR(): Promise<RemoteJob[]> {
  const categories = ['remote-sales-and-marketing-jobs', 'remote-customer-support-jobs', 'remote-business-jobs']
  try {
    const feeds = await Promise.all(categories.map(cat =>
      fetch(`https://weworkremotely.com/categories/${cat}.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      }).then(r => r.text()).catch(() => '')
    ))
    const jobs: RemoteJob[] = []
    let idCounter = 8000000
    for (const xml of feeds) {
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
      for (const item of items) {
        const titleRaw = item.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() || ''
        const colonIdx = titleRaw.indexOf(': ')
        const company = colonIdx > -1 ? titleRaw.slice(0, colonIdx).trim() : ''
        const title = colonIdx > -1 ? titleRaw.slice(colonIdx + 2).trim() : titleRaw
        const region = item.match(/<region>([^<]*)<\/region>/)?.[1]?.trim() || 'Anywhere'
        const guid = item.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1]?.trim() || ''
        const logo = item.match(/<media:content url="([^"]+)"/)?.[1] || ''
        const desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''
        const descClean = desc.replace(/&lt;[^&]+&gt;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim()
        if (!title || !company) continue
        jobs.push({
          id: idCounter++,
          url: guid.startsWith('http') ? guid : `https://weworkremotely.com${guid}`,
          title, company_name: company, company_logo: logo,
          category: 'remote', tags: [], job_type: 'full_time',
          publication_date: new Date().toISOString(),
          candidate_required_location: region,
          salary: '', description: descClean.slice(0, 500),
        } as RemoteJob)
      }
    }
    return jobs
  } catch { return [] }
}

// ── The SaaS Jobs ─────────────────────────────────────────────────────────────
// No public API — listing pages embed a `window.jobsList.concat([...])` JSON
// blob with full job records, including an authoritative `remote` boolean.
// Most listings are NOT remote (general SaaS board, not remote-only), so this
// filters to remote:true at the source rather than relying on text heuristics.
// robots.txt asks for a 1s crawl-delay, so pages are fetched sequentially.

interface SaaSJobsJob {
  id: number
  title: string
  description?: string
  location?: string
  remote: boolean
  min_compensation?: number | null
  max_compensation?: number | null
  posted_at?: string
  job_details_path: string
  employer?: { name: string; logo?: string }
  tags?: { name: string }[]
}

async function fetchSaaSJobsPage(page: number): Promise<SaaSJobsJob[]> {
  try {
    const res = await fetch(`https://www.thesaasjobs.com/jobs?page=${page}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    const match = html.match(/window\.jobsList\.concat\((\[.*?\])\);/s)
    return match ? JSON.parse(match[1]) : []
  } catch { return [] }
}

export async function fetchTheSaaSJobs(pages = 8): Promise<RemoteJob[]> {
  const jobs: RemoteJob[] = []
  for (let page = 1; page <= pages; page++) {
    const pageJobs = await fetchSaaSJobsPage(page)
    if (pageJobs.length === 0) break
    for (const j of pageJobs) {
      if (!j.remote) continue
      const salary = j.min_compensation && j.max_compensation
        ? `$${Math.round(j.min_compensation / 1000)}k–$${Math.round(j.max_compensation / 1000)}k`
        : j.min_compensation ? `From $${Math.round(j.min_compensation / 1000)}k` : ''
      jobs.push({
        id: j.id,
        url: `https://www.thesaasjobs.com${j.job_details_path}`,
        title: j.title,
        company_name: j.employer?.name || '',
        company_logo: j.employer?.logo,
        category: 'remote',
        tags: (j.tags || []).map(t => t.name),
        job_type: 'full_time',
        publication_date: j.posted_at || new Date().toISOString(),
        candidate_required_location: `Remote${j.location ? ` (${j.location})` : ''}`,
        salary,
        description: (j.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
      } as RemoteJob)
    }
    if (page < pages) await new Promise(r => setTimeout(r, 1000))
  }
  return jobs
}

// ── Greenhouse ────────────────────────────────────────────────────────────────
// Public per-company boards — no auth required.
// Add/remove slugs to tune which companies are monitored.
// Only confirmed-working slugs (404s removed).
const GREENHOUSE_COMPANIES = [
  // Sales engagement / revenue intelligence
  'salesloft', 'crossbeam',
  // Partner / channel / ecosystem
  'impact', 'partnerstack',
  // GTM / enablement / revenue
  'showpad', 'workato', 'smartsheet', 'dialpad',
  // CRM / support / customer success
  'intercom', 'asana', 'pendo', 'calendly', 'lattice', 'zuora',
  // Product analytics & data
  'amplitude', 'mixpanel', 'twilio',
  // Marketing automation
  'braze', 'klaviyo', 'hootsuite',
  // Enterprise SaaS / identity / security
  'stripe', 'okta', 'five9',
]

const GREENHOUSE_NAMES: Record<string, string> = {
  salesloft: 'Salesloft', crossbeam: 'Crossbeam', impact: 'Impact.com',
  partnerstack: 'PartnerStack', showpad: 'Showpad', workato: 'Workato',
  smartsheet: 'Smartsheet', dialpad: 'Dialpad', intercom: 'Intercom',
  asana: 'Asana', pendo: 'Pendo', calendly: 'Calendly', lattice: 'Lattice',
  zuora: 'Zuora', amplitude: 'Amplitude', mixpanel: 'Mixpanel', twilio: 'Twilio',
  braze: 'Braze', klaviyo: 'Klaviyo', hootsuite: 'Hootsuite',
  stripe: 'Stripe', okta: 'Okta', five9: 'Five9',
}

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  absolute_url: string
  location: { name: string }
  content?: string
  departments?: { name: string }[]
}

async function fetchGreenhouseCompany(slug: string, idOffset: number, displayName?: string): Promise<RemoteJob[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const jobs: GreenhouseJob[] = data.jobs || []
    return jobs.map((j, i) => ({
      id: idOffset + i,
      url: j.absolute_url,
      title: j.title,
      company_name: displayName || GREENHOUSE_NAMES[slug] || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
      company_logo: `https://logo.clearbit.com/${slug}.com`,
      category: (j.departments?.[0]?.name || 'remote').toLowerCase(),
      tags: j.departments?.map(d => d.name) || [],
      job_type: 'full_time',
      publication_date: j.updated_at || new Date().toISOString(),
      candidate_required_location: j.location?.name || 'Remote',
      salary: '',
      description: (j.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500),
    } as RemoteJob))
  } catch { return [] }
}

function loadCustomGreenhouseSlugs(): { slug: string; name: string }[] {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'jobs-store.json'), 'utf-8'))
    return raw.customGreenhouse || []
  } catch { return [] }
}

export async function fetchGreenhouse(): Promise<RemoteJob[]> {
  const custom = loadCustomGreenhouseSlugs()
  const customSlugs = custom.map(c => c.slug)
  const allSlugs = [
    ...GREENHOUSE_COMPANIES,
    ...customSlugs.filter(s => !GREENHOUSE_COMPANIES.includes(s)),
  ]
  // Build name overrides: custom entries override the default name map
  const nameOverrides = Object.fromEntries(custom.map(c => [c.slug, c.name]))
  const results = await Promise.all(
    allSlugs.map((slug, i) => {
      const displayName = nameOverrides[slug] || GREENHOUSE_NAMES[slug]
      return fetchGreenhouseCompany(slug, 3000000 + i * 10000, displayName)
    })
  )
  return results.flat()
}

// ── Lever ─────────────────────────────────────────────────────────────────────
// Public per-company boards via api.lever.co — same model as Greenhouse, but a
// different set of companies use Lever instead. Slugs don't map predictably
// from company name, so each one below was verified to return live postings.
const LEVER_COMPANIES = [
  // Sales engagement / enablement / revenue
  'outreach', 'highspot', 'mindtickle', 'clari',
  // CRM / customer comms
  'pipedrive', 'aircall', 'freshworks',
  // Security / compliance SaaS
  'secureframe',
  // Fintech infra / HR / recruiting SaaS
  'plaid', '15five', 'jobvite',
]

const LEVER_NAMES: Record<string, string> = {
  outreach: 'Outreach', highspot: 'Highspot', mindtickle: 'MindTickle', clari: 'Clari',
  pipedrive: 'Pipedrive', aircall: 'Aircall', freshworks: 'Freshworks',
  secureframe: 'Secureframe', plaid: 'Plaid', '15five': '15Five', jobvite: 'Jobvite',
}

interface LeverJob {
  id: string
  text: string
  hostedUrl: string
  createdAt: number
  descriptionPlain?: string
  workplaceType?: string
  country?: string
  categories?: { location?: string; allLocations?: string[]; team?: string; department?: string }
}

async function fetchLeverCompany(slug: string, idOffset: number, displayName?: string): Promise<RemoteJob[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const jobs: LeverJob[] = await res.json()
    return jobs.map((j, i) => {
      const isRemote = j.workplaceType === 'remote'
      const location = j.categories?.location || j.categories?.allLocations?.join(', ') || j.country || ''
      return {
        id: idOffset + i,
        url: j.hostedUrl,
        title: j.text,
        company_name: displayName || LEVER_NAMES[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
        company_logo: `https://logo.clearbit.com/${slug}.com`,
        category: (j.categories?.team || j.categories?.department || 'remote').toLowerCase(),
        tags: [j.categories?.team, j.categories?.department].filter(Boolean) as string[],
        job_type: 'full_time',
        publication_date: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
        candidate_required_location: isRemote ? `Remote${location ? ` (${location})` : ''}` : (location || 'Unspecified'),
        salary: '',
        description: (j.descriptionPlain || '').replace(/\s+/g, ' ').trim().slice(0, 500),
      } as RemoteJob
    })
  } catch { return [] }
}

export async function fetchLever(): Promise<RemoteJob[]> {
  const results = await Promise.all(
    LEVER_COMPANIES.map((slug, i) => fetchLeverCompany(slug, 4000000 + i * 1000, LEVER_NAMES[slug]))
  )
  return results.flat()
}

export async function fetchAllSources(): Promise<RemoteJob[]> {
  const [remoteOK, jobicy, wwr, muse, greenhouse, saasJobs, lever] = await Promise.all([
    fetchRemoteOK(), fetchJobicy(), fetchWWR(), fetchTheMuse(), fetchGreenhouse(), fetchTheSaaSJobs(), fetchLever(),
  ])
  return [...remoteOK, ...jobicy, ...wwr, ...muse, ...greenhouse, ...saasJobs, ...lever]
}

export function jobMatchesQuery(job: RemoteJob, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/)
  const haystack = `${job.title} ${job.company_name} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase()
  return terms.some(t => haystack.includes(t))
}

const RELEVANCE_STOPWORDS = new Set(['of', 'and', 'the', 'a', 'for', 'in', 'on', 'at', 'to'])

/**
 * Scores how relevant a job is to a query — title matches weigh far more than
 * tag/description matches, so a broad OR-match query can still be sorted to put
 * the closest titles first before truncating the pool sent to the LLM ranker.
 *
 * Terms are deduplicated before scoring. Without this, a query built from several
 * synonymous target-role phrases (e.g. "customer success" and "success" both present
 * as separate keywords) repeats common words multiple times, which inflated matching
 * titles' scores far beyond titles matching an equally relevant but less-repeated term
 * (e.g. "partner") — silently crowding partnership roles out of the truncated pool.
 */
export function jobRelevanceScore(job: RemoteJob, query: string): number {
  const terms = new Set(
    query.toLowerCase().split(/\s+/).filter(t => t && !RELEVANCE_STOPWORDS.has(t))
  )
  const titleLower = job.title.toLowerCase()
  const tagsLower = (job.tags || []).join(' ').toLowerCase()
  const descLower = (job.description || '').toLowerCase()

  let score = 0
  for (const t of terms) {
    if (titleLower.includes(t)) score += 5
    if (tagsLower.includes(t)) score += 2
    if (descLower.includes(t)) score += 1
  }
  return score
}

/**
 * Caps how many listings from the same company can appear in a relevance-sorted
 * pool, preserving order. A company with many near-duplicate openings (e.g. the
 * same CSM role posted per-region) would otherwise monopolize the truncated slots
 * sent to the LLM ranker, crowding out roles from other companies and other titles.
 */
export function capPerCompany(jobs: RemoteJob[], maxPerCompany: number): RemoteJob[] {
  const counts = new Map<string, number>()
  const result: RemoteJob[] = []
  for (const job of jobs) {
    const key = job.company_name.toLowerCase()
    const count = counts.get(key) || 0
    if (count >= maxPerCompany) continue
    counts.set(key, count + 1)
    result.push(job)
  }
  return result
}

/**
 * Returns false for jobs explicitly restricted to non-US geographies.
 * Keeps "Worldwide", "Anywhere", "Remote", US-specific, and ambiguous locations.
 */
export function isUSEligible(location: string): boolean {
  if (!location || location.trim() === '') return true
  const loc = location.toLowerCase()

  // Explicitly US-friendly — always keep
  if (/\b(us|usa|united states?|north america)\b/.test(loc)) return true
  // Worldwide / unrestricted remote — keep
  if (/\b(worldwide|anywhere|global|remote)\b/.test(loc)) return true

  // Explicitly non-US geographic restrictions — drop
  const nonUS = [
    'uk', 'u\\.k\\.', 'united kingdom', 'great britain',
    'europe', 'european union', 'emea',
    'apac', 'asia', 'asia pacific',
    'latin america', 'latam', 'south america',
    'africa', 'middle east',
    'canada', 'australia', 'new zealand',
    'india', 'germany', 'france', 'spain', 'netherlands',
    'brazil', 'mexico', 'singapore', 'japan',
  ]
  if (nonUS.some(r => new RegExp(`\\b${r}\\b`).test(loc))) return false

  // Ambiguous or unknown — keep (err on the side of showing)
  return true
}

/**
 * Returns false for jobs with no remote signal anywhere — i.e. likely office-required.
 * RemoteOK, Jobicy, We Work Remotely, and The Muse are remote-curated boards by
 * construction, so this mainly filters Greenhouse listings, which pull a company's
 * full job board (sales, ops, on-site roles included) with no remote filtering at the
 * source. Checking the description as a fallback catches postings where the location
 * field just lists an office city but the body confirms remote eligibility.
 */
export function isLikelyRemote(location: string, description?: string): boolean {
  if (/\b(remote|anywhere|worldwide|distributed)\b/i.test(location || '')) return true
  if (description && /\bremote\b/i.test(description)) return true
  return false
}
