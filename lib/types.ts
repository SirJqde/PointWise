// ============================================================
// GuideCursor — Types shared across all modules
// ============================================================

export type SensitivityClass = "normal" | "captcha" | "otp" | "payment" | "legal";

export interface Step {
  /** CSS / ARIA selector pointing to the target element */
  targetSelector: string;
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
}

export interface SessionNode {
  tabId: number;
  origin: string;
  stepIndex: number;
  timestamp: number;
}

export interface SessionGraph {
  id: string;
  taskGoal: string;
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
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  disabled: boolean;
  hasFileInput?: boolean;
}

export interface DomainVerificationResult {
  canonical: string;
  trustScore: number;   // 0–100 (40=TLD, 25=DNS, 20=CT, 15=HSTS)
  warnings: string[];
}

// Messages between content script ↔ service worker
export type ExtMessage =
  | { type: "TOGGLE_ON"; taskGoal: string }
  | { type: "TOGGLE_OFF" }
  | { type: "SNAPSHOT_READY"; snapshot: ScrubbedSnapshot }
  | { type: "PLAN_READY"; plan: Plan }
  | { type: "STEP_COMPLETE"; stepIndex: number }
  | { type: "USER_WITHDREW" }
  | { type: "USER_RESUMED" }
  | { type: "SESSION_NAV"; origin: string };
