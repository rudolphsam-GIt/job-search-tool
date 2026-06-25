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
  rounds: InterviewRound[]
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
}

export const DEFAULT_SEARCH_PREFS: SearchPrefs = {
  minSalary: null,
  excludeTitleKeywords: ['account executive', 'solutions engineer', 'sales engineer'],
  requireTitleKeywords: [],
  blacklistCompanies: [],
  dreamCompanies: [],
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
  flag?: 'strong_match' | 'good_match' | 'stretch' | 'skip'
  foundDate?: string
  status?: 'saved' | 'applied' | 'active' | 'archived'
}
