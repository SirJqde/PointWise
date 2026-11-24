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

export interface SessionGraph {
  id: string;
  on: boolean;
  guiding: boolean;
  taskGoal: string;
  contextProvided?: boolean;
  contextQuestion?: string;
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
  | { type: "TOGGLE_ON"; taskGoal: string; resetContext?: boolean }
  | { type: "TOGGLE_OFF" }
  | { type: "COLLECT_SNAPSHOT"; taskGoal: string }
  | { type: "SNAPSHOT_READY"; snapshot: ScrubbedSnapshot; taskGoal?: string }
  | { type: "CONTEXT_REQUIRED"; question: string; popupOpened: boolean }
  | { type: "CONTEXT_SUBMITTED"; answer: string }
  | { type: "PLAN_READY"; plan: Plan }
  | { type: "PLAN_ERROR"; message: string }
  | { type: "STEP_COMPLETE"; stepIndex: number }
  | { type: "USER_WITHDREW" }
  | { type: "USER_RESUMED" }
  | { type: "SESSION_NAV"; origin: string };
