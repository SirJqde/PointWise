// ============================================================
// PointWise — Types shared across all modules
// ============================================================

export type SensitivityClass = "normal" | "captcha" | "otp" | "payment" | "legal";

export interface Step {
  /** CSS / ARIA selector pointing to the target element */
  targetSelector: string;
  /** Optional fallback label/text to locate element if selector shifts */
  fallbackLabel?: string;
  action: "click" | "focus" | "scroll" | "file-upload" | "pause";
  /** Human-readable hint shown in the dialogue box */
  hint: string;
  /** Shown if the target element cannot be found */
  errorRecovery?: string;
  sensitivityClass: SensitivityClass;
}

export interface Plan {
  taskGoal: string;
  steps: Step[];
  needsContext?: boolean;
  clarifyingQuestion?: string;
  error?: string;
  recovery?: GuidanceRecovery;
}

export type GuidanceRecovery = "api-key" | "retry" | "rescan";

export interface GuidanceFailure {
  message: string;
  recovery: GuidanceRecovery;
}

export interface SessionNode {
  tabId: number;
  origin: string;
  stepIndex: number;
  timestamp: number;
}

export interface VerificationSignal {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DomainVerificationResult {
  canonical: string;
  trustScore: number;   // 0–100 validity score
  warnings: string[];
  signals?: VerificationSignal[];
  label?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  matchedKeywords: string[];
  keywordScore: number;     // 0–100 prompt relevance
  validityScore: number;    // 0–100 website validity
  signals: VerificationSignal[];
  warnings: string[];
}

export interface WebSearchResponse {
  query: string;
  keywords: string[];
  results: SearchResultItem[];
  warnings: string[];
}

export interface GuidanceRequest {
  id: string;
  tabId: number;
  pageUrl: string;
}

export interface SessionGraph {
  id: string;
  on: boolean;
  guiding: boolean;
  tabId?: number;
  request?: GuidanceRequest;
  guidanceFailure?: GuidanceFailure;
  taskGoal: string;
  contextProvided?: boolean;
  contextQuestion?: string;
  contextRequestId?: string;
  lastQuery?: string;
  lastResults?: SearchResultItem[];
  nodes: SessionNode[];
  createdAt: number;
}

export interface ScrubbedSnapshot {
  url: string;
  title: string;
  elements: SnapshotElement[];
}

export interface SnapshotElement {
  selector: string;
  role: string;
  label: string;
  tagName: string;
  inputType?: string;
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  inViewport?: boolean;
  disabled: boolean;
  hasFileInput?: boolean;
}

// Messages between popup / content script / service worker
export type ExtMessage =
  | { type: "PING" }
  | { type: "GET_SESSION_STATE" }
  | { type: "ENABLE_SEARCH" }
  | { type: "SAVE_SEARCH_RESULTS"; query: string; results: SearchResultItem[] }
  | { type: "TOGGLE_ON"; taskGoal: string; targetUrl?: string }
  | { type: "TOGGLE_OFF" }
  | { type: "GUIDANCE_START"; requestId: string; pageUrl: string }
  | { type: "COLLECT_SNAPSHOT"; requestId: string }
  | { type: "RESCAN"; requestId: string }
  | { type: "CONTEXT_REQUIRED"; requestId: string; question: string; popupOpened: boolean }
  | { type: "CONTEXT_SUBMITTED"; answer: string; requestId: string }
  | { type: "PLAN_READY"; requestId: string; plan: Plan }
  | ({ type: "PLAN_ERROR"; requestId: string } & GuidanceFailure)
  | { type: "STEP_COMPLETE"; requestId: string; stepIndex: number };
