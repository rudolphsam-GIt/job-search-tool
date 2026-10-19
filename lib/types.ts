export interface Profile {
  name: string
  targetRoles: string[]
  seniorityBand: string
  biggestConcern: string
  strengths: string[]
  activeInterviews: ActiveInterview[]
  pastEmployers: string[]
  hasCoachingState: boolean
}

export interface ActiveInterview {
  company: string      // display name, e.g. "Zoom"
  fullLabel: string   // full ### header, e.g. "Zoom — Partner Success Enablement Manager"
  status: string
  stage: string       // normalized pipeline stage, see lib/status.ts
  nextRound?: string
}

export interface NewsItem {
  title: string
  link: string
  pubDate: string
}

export interface AnalysisResult {
  company: string
  role: string
  isRemote: boolean
  fitScore: number
  fitSummary: string
  alignmentPoints: string[]
  concerns: string[]
  storiesToDeploy: string[]
  alreadyApplied: boolean
  linkedinNetworkSearchUrl: string
  glassdoorUrl: string
  recommendation: 'apply' | 'skip' | 'monitor'
  news: NewsItem[]
}

export interface InterviewRound {
  label: string
  description: string
  status: 'completed' | 'next' | 'upcoming'
}

// One interview round, stored in coaching_state.md as "  - [x] Name | date | interviewer"
export interface RoundItem {
  name: string
  date: string
  who: string
  done: boolean
}

// One next step, stored as "  - [ ] text"
export interface StepItem {
  text: string
  done: boolean
}

export interface InterviewerIntel {
  name: string
  linkedin?: string
  notes: string
}

export interface Concern {
  text: string
  severity?: string
}

export interface CompanyDetail {
  company: string
  role: string
  status: string
  stage: string
  statusNote: string
  statusUpdated?: string
  rounds: InterviewRound[]
  roundItems: RoundItem[]       // editable rounds; falls back to legacy Round formats
  nextSteps: StepItem[]
  postingUrl?: string
  nextRound?: string
  concerns: Concern[]
  questions: string[]
  interviewers: InterviewerIntel[]
  positioningAngle?: string
  fitAssessment?: string
  keySignals?: string
  responsibilities: string[]
  metrics: string[]
  outcome?: string
  rawSection: string
}

export interface ProfileOverrides {
  name?: string
  targetRoles?: string[]        // replaces parsed target roles from coaching_state.md
  seniorityBand?: string        // replaces parsed seniority
  strengths?: string[]          // replaces parsed strengths (sidebar)
  pastEmployers?: string[]      // replaces parsed past employers (connection anchors)
  aiContext?: string            // injected verbatim into every AI ranking prompt
  resumeText?: string           // extracted text from an uploaded resume; injected into every AI ranking prompt
  resumeFileName?: string       // original filename of the uploaded resume, for display
}

export interface SearchPrefs {
  minSalary: number | null            // e.g. 120000 — filters jobs whose listed max is below this
  excludeTitleKeywords: string[]      // case-insensitive; replaces hardcoded EXCLUDED_TITLE_PATTERNS
  requireTitleKeywords: string[]      // at least one must appear in the title (empty = no requirement)
  blacklistCompanies: string[]        // never surface these companies
  dreamCompanies: string[]            // always boost these companies in ranking
  watchlistCompanies: string[]        // always surface roles from these companies, even stretch fits
}

export const DEFAULT_SEARCH_PREFS: SearchPrefs = {
  minSalary: null,
  excludeTitleKeywords: ['account executive', 'solutions engineer', 'sales engineer'],
  requireTitleKeywords: [],
  blacklistCompanies: [],
  dreamCompanies: [],
  watchlistCompanies: [],
}

export interface RemoteJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo?: string
  category: string
  tags: string[]
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
  fitScore?: number
  fitReason?: string
  flag?: 'strong_match' | 'good_match' | 'stretch' | 'watchlist_stretch' | 'skip'
  watchlisted?: boolean
  foundDate?: string
  status?: 'saved' | 'applied' | 'active' | 'archived'
}

export interface PrepRequest {
  company: string               // coaching_state.md loop label, e.g. "Workday — Adaptive Planning"
  role?: string
  reqId?: string
  interviewer?: string
  interviewerLinkedin?: string
  interviewDate?: string
  jobDescription?: string       // pasted JD text, if the posting is no longer public
  notes?: string                // anything else the candidate knows (skill tags, recruiter notes)
}

export interface CheatSheet {
  company: string
  role: string
  interviewer: string
  interviewDate: string
  remember: string
  positioning: string
  priorities: string[]
  stories: { id: string; title: string; hook: string }[]
  likelyQuestions: { question: string; storyId: string }[]
  leadConcern: { concern: string; counter: string }
  otherConcerns: { concern: string; counter: string }[]
  bestQuestion: string
  backupQuestions: string[]
  interviewerRead: string
  confidence: 'high' | 'medium' | 'low'
  caveats: string
}

export interface PrepResult {
  request: PrepRequest
  cheatSheet: CheatSheet
  sources: { title: string; url: string }[]
  generatedAt: string
}
