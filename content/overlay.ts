// ============================================================
// PointWise — Cursor Overlay (Magenta & Navy Blue Theme)
//
// Modes:
//   • Scanning: compact status pill near cursor while AI reads DOM
//   • Plan Confirmation: displays numbered Plan of Action & asks
//     user to confirm before highlighting elements
//   • Active Guidance: highlights target web element with pulsing
//     magenta ring + ghost pointer, AND attaches the action
//     dialogue box directly to the user's live mouse cursor
// ============================================================

import type { Plan } from "../lib/types.js";

type OverlayState =
  | "idle"
  | "scanning"
  | "context"
  | "confirm"
  | "active"
  | "paused"
  | "withdrawn";

export interface DialogueOptions {
  hint: string;
  stepIndex?: number;
  totalSteps?: number;
  action?: string;
  warning?: string;
  error?: string;
  source?: "ai" | "local";
}

export class CursorOverlay {
  private shadow: ShadowRoot;
  private cursor: SVGSVGElement;
  private cursorDialogue: HTMLDivElement;
  private card: HTMLDivElement;
  private miniDock: HTMLDivElement;
  private highlight: HTMLDivElement;
  private tag: HTMLDivElement;

  private state: OverlayState = "idle";
  private currentTarget: HTMLElement | null = null;
  private hasPlacedCursor = false;
  private resizeObserver: ResizeObserver;
  private scrollRafId: number | null = null;

  // Live user cursor coordinates
  private userMouseX: number;
  private userMouseY: number;

  private confirmHandlers: (() => void)[] = [];
  private cancelHandlers: (() => void)[] = [];
  private nextHandlers: (() => void)[] = [];
  private rescanHandlers: (() => void)[] = [];
  private dismissHandlers: (() => void)[] = [];
  private contextHandlers: ((answer: string) => void)[] = [];

  private boundSyncPosition: () => void;
  private boundMouseTrack: (e: MouseEvent) => void;

  constructor() {
    document.getElementById("pointwise-host")?.remove();

    this.userMouseX = Math.round((window.innerWidth || 1000) * 0.5);
    this.userMouseY = Math.round((window.innerHeight || 700) * 0.35);

    const host = document.createElement("div");
    host.setAttribute("id", "pointwise-host");
    host.style.cssText =
      "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);

    this.shadow = host.attachShadow({ mode: "closed" });
    this.shadow.innerHTML = SHADOW_TEMPLATE;

    this.cursor         = this.shadow.querySelector<SVGSVGElement>("#pw-cursor")!;
    this.cursorDialogue = this.shadow.querySelector<HTMLDivElement>("#pw-cursor-dialogue")!;
    this.card           = this.shadow.querySelector<HTMLDivElement>("#pw-card")!;
    this.miniDock       = this.shadow.querySelector<HTMLDivElement>("#pw-mini-dock")!;
    this.highlight      = this.shadow.querySelector<HTMLDivElement>("#pw-highlight")!;
    this.tag            = this.shadow.querySelector<HTMLDivElement>("#pw-tag")!;

    this.boundSyncPosition = () => this.syncPosition();
    this.boundMouseTrack = (e: MouseEvent) => this.handleMouseTrack(e);

    window.addEventListener("scroll", this.boundSyncPosition, { capture: true, passive: true });
    window.addEventListener("resize", this.boundSyncPosition, { passive: true });
    document.addEventListener("mousemove", this.boundMouseTrack, { capture: true, passive: true });
    document.addEventListener("mousedown", this.boundMouseTrack, { capture: true, passive: true });

    this.resizeObserver = new ResizeObserver(() => this.syncPosition());

    // Interactive card actions (plan confirmation / context fallback / notice)
    this.card.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-pw-action]");
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset["pwAction"];
      if (action === "confirm") {
        this.userMouseX = e.clientX;
        this.userMouseY = e.clientY;
        this.card.style.display = "none";
        this.confirmHandlers.forEach((fn) => fn());
      } else if (action === "cancel") {
        this.withdraw();
        this.cancelHandlers.forEach((fn) => fn());
      } else if (action === "rescan") {
        this.rescanHandlers.forEach((fn) => fn());
      } else if (action === "dismiss") {
        this.withdraw();
        this.dismissHandlers.forEach((fn) => fn());
      } else if (action === "next") {
        this.card.style.display = "none";
        this.nextHandlers.forEach((fn) => fn());
      } else if (action === "submit-context") {
        const input = this.card.querySelector<HTMLInputElement>("#pw-inline-context");
        const val = input?.value.trim() ?? "";
        this.contextHandlers.forEach((fn) => fn(val));
      }
    });

    this.card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = (e.target as HTMLElement).closest<HTMLInputElement>("#pw-inline-context");
        if (input) {
          e.preventDefault();
          this.contextHandlers.forEach((fn) => fn(input.value.trim()));
        }
      }
    });

    // Mini dock actions during active step guidance
    this.miniDock.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-pw-action]");
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset["pwAction"];
      if (action === "next") this.nextHandlers.forEach((fn) => fn());
      if (action === "rescan") this.rescanHandlers.forEach((fn) => fn());
      if (action === "dismiss") {
        this.withdraw();
        this.dismissHandlers.forEach((fn) => fn());
      }
    });
  }

  // ── Event registrations ─────────────────────────────────────

  onConfirm(cb: () => void): void { this.confirmHandlers.push(cb); }
  onCancel(cb: () => void): void { this.cancelHandlers.push(cb); }
  onNext(cb: () => void): void { this.nextHandlers.push(cb); }
  onRescan(cb: () => void): void { this.rescanHandlers.push(cb); }
  onDismiss(cb: () => void): void { this.dismissHandlers.push(cb); }
  onContextSubmit(cb: (answer: string) => void): void { this.contextHandlers.push(cb); }

  // ── State 1: Scanning ───────────────────────────────────────

  showScanning(): void {
    this.clearTargetVisuals();
    this.card.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "scanning";

    // Show cursor + attached scanning dialogue right at the user's cursor
    this.cursorDialogue.innerHTML = `
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">ANALYSING</span>
      </div>
      <div class="pw-scanning">
        <span class="pw-scan-dot"></span>
        Checking prompt &amp; scanning site…
      </div>
    `;
    this.cursorDialogue.style.display = "block";
    this.positionCursorDialogue(this.userMouseX, this.userMouseY);
  }

  // ── State 2: Additional Context Required ────────────────────

  showContextWaiting(question: string, popupOpened: boolean): void {
    this.clearTargetVisuals();
    this.cursorDialogue.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "context";

    if (popupOpened) {
      this.card.innerHTML = `
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">CONTEXT NEEDED</span>
        </div>
        <div class="pw-hint">Please answer the quick question in the PointWise popup to build your plan:</div>
        <div class="pw-warn">${escapeHtml(question)}</div>
      `;
    } else {
      // Fallback inline context input if browser blocked programmatic popup opening
      this.card.innerHTML = `
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">MORE DETAILS</span>
        </div>
        <div class="pw-hint">${escapeHtml(question)}</div>
        <input id="pw-inline-context" class="pw-input" type="text" placeholder="Type details and press Enter…" />
        <div class="pw-actions">
          <button class="pw-btn pw-btn-primary" data-pw-action="submit-context">Continue ▶</button>
          <button class="pw-btn" data-pw-action="cancel">Cancel</button>
        </div>
      `;
    }

    this.card.style.display = "block";
    this.positionCardAtCursor();

    if (!popupOpened) {
      setTimeout(() => {
        this.card.querySelector<HTMLInputElement>("#pw-inline-context")?.focus();
      }, 30);
    }
  }

  // ── State 3: Plan of Action Confirmation ────────────────────

  showPlanConfirmation(plan: Plan): void {
    this.clearTargetVisuals();
    this.cursorDialogue.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "confirm";

    const stepsHtml = plan.steps
      .map(
        (s, i) => `
        <li class="pw-plan-item">
          <span class="pw-plan-num">${i + 1}</span>
          <span class="pw-plan-text">${escapeHtml(s.hint)}</span>
        </li>`
      )
      .join("");

    const sourceLabel = plan.source === "local" ? "LOCAL PLAN" : "AI PLAN";

    this.card.innerHTML = `
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">${sourceLabel}</span>
      </div>
      <div class="pw-plan-title">Plan of Action</div>
      <div class="pw-plan-goal">${escapeHtml(plan.taskGoal || "Complete task on this page")}</div>
      <ol class="pw-plan-list">${stepsHtml}</ol>
      ${plan.warning ? `<div class="pw-warn">${escapeHtml(plan.warning)}</div>` : ""}
      <div class="pw-confirm-ask">Confirm to start highlighting and guiding?</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="confirm">Confirm &amp; Continue ▶</button>
        <button class="pw-btn" data-pw-action="cancel">Cancel</button>
      </div>
    `;

    this.card.style.display = "block";
    this.positionCardAtCursor();
  }

  // ── State 4: Confirmed Guidance (Element Highlight + Cursor Dialogue) ─

  async pointAtElement(target: HTMLElement, options: DialogueOptions): Promise<void> {
    if (this.currentTarget) {
      this.resizeObserver.unobserve(this.currentTarget);
    }
    this.currentTarget = target;
    this.resizeObserver.observe(target);

    this.card.style.display = "none";

    const preRect = target.getBoundingClientRect();
    const outOfView =
      preRect.top < 40 ||
      preRect.bottom > window.innerHeight - 40 ||
      preRect.left < 0 ||
      preRect.right > window.innerWidth;

    if (outOfView) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    this.state = "active";
    this.renderCursorDialogue(options);
    this.renderMiniDock(options);
    this.renderTargetVisuals(target, options);

    if (outOfView) {
      this.startSmoothScrollTracking();
    }
  }

  /** Backwards-compatible selector-based pointAt */
  async pointAt(selector: string, options: DialogueOptions): Promise<void> {
    let target: HTMLElement | null = null;
    try {
      target = document.querySelector<HTMLElement>(selector);
    } catch {
      target = null;
    }
    if (!target) {
      this.showNotice(options.error ?? "Could not locate the expected element.", true);
      return;
    }
    await this.pointAtElement(target, options);
  }

  showNotice(message: string, isError = false): void {
    this.clearTargetVisuals();
    this.cursorDialogue.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "idle";

    this.card.innerHTML = `
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill ${isError ? "pw-pill-err" : ""}">${isError ? "NOTICE" : "DONE"}</span>
      </div>
      <div class="${isError ? "pw-error" : "pw-hint"}">${escapeHtml(message)}</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="rescan">Re-scan ↻</button>
        <button class="pw-btn" data-pw-action="dismiss">Hide</button>
      </div>
    `;
    this.card.style.display = "block";
    this.positionCardAtCursor();
  }

  showPauseBanner(reason: string): void {
    this.clearTargetVisuals();
    this.cursorDialogue.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "paused";

    this.card.innerHTML = PAUSE_BANNER_HTML(reason);
    this.card.style.display = "block";
    this.positionCardAtCursor();
  }

  withdraw(): void {
    this.clearTargetVisuals();
    this.cursorDialogue.style.display = "none";
    this.card.style.display = "none";
    this.miniDock.style.display = "none";
    this.state = "withdrawn";
  }

  destroy(): void {
    if (this.scrollRafId !== null) cancelAnimationFrame(this.scrollRafId);
    this.resizeObserver.disconnect();
    window.removeEventListener("scroll", this.boundSyncPosition, { capture: true });
    window.removeEventListener("resize", this.boundSyncPosition);
    document.removeEventListener("mousemove", this.boundMouseTrack, { capture: true });
    document.removeEventListener("mousedown", this.boundMouseTrack, { capture: true });
    this.shadow.host.remove();
  }

  // ── Visual positioning internals ──────────────────────────

  private clearTargetVisuals(): void {
    if (this.currentTarget) {
      this.resizeObserver.unobserve(this.currentTarget);
      this.currentTarget = null;
    }
    this.cursor.style.display = "none";
    this.highlight.style.display = "none";
    this.tag.style.display = "none";
  }

  private renderTargetVisuals(target: HTMLElement, options?: DialogueOptions): void {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pad = 5;
    const left   = Math.max(2, rect.left - pad);
    const top    = Math.max(2, rect.top - pad);
    const width  = rect.width + pad * 2;
    const height = rect.height + pad * 2;

    this.highlight.style.left    = `${left}px`;
    this.highlight.style.top     = `${top}px`;
    this.highlight.style.width   = `${width}px`;
    this.highlight.style.height  = `${height}px`;
    this.highlight.style.display = "block";

    if (options) {
      const stepNum = (options.stepIndex ?? 0) + 1;
      const actionLabel = formatActionLabel(options.action);
      this.tag.textContent = `STEP ${stepNum} • ${actionLabel}`;
    }
    const tagTop = top > 28 ? top - 24 : top + height + 6;
    this.tag.style.left    = `${Math.min(left, Math.max(8, window.innerWidth - 160))}px`;
    this.tag.style.top     = `${tagTop}px`;
    this.tag.style.display = "block";

    const targetX = rect.left + Math.min(rect.width * 0.72, Math.max(rect.width - 14, rect.width * 0.5));
    const targetY = rect.top + Math.min(rect.height * 0.68, Math.max(rect.height - 8, rect.height * 0.5));
    this.moveGhostCursorTo(targetX, targetY);
  }

  private moveGhostCursorTo(tipX: number, tipY: number): void {
    const tx = Math.round(tipX - 5);
    const ty = Math.round(tipY - 3);

    if (!this.hasPlacedCursor) {
      const startX = Math.max(24, this.userMouseX);
      const startY = Math.max(24, this.userMouseY);
      this.cursor.style.display = "block";
      this.cursor.style.transform = `translate(${startX}px, ${startY}px)`;
      this.cursor.style.opacity = "0";
      void this.cursor.getBoundingClientRect();
      this.hasPlacedCursor = true;
    }

    this.cursor.style.display = "block";
    this.cursor.style.opacity = "1";
    this.cursor.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  private renderCursorDialogue(options: DialogueOptions): void {
    const stepNum = (options.stepIndex ?? 0) + 1;
    const total = options.totalSteps ?? 1;
    const actionLabel = formatActionLabel(options.action);

    this.cursorDialogue.innerHTML = `
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">STEP ${stepNum}/${total} · ${actionLabel}</span>
      </div>
      <div class="pw-cd-hint">${escapeHtml(options.hint)}</div>
      <div class="pw-cd-sub">Act on the highlighted element to continue</div>
    `;
    this.cursorDialogue.style.display = "block";
    this.positionCursorDialogue(this.userMouseX, this.userMouseY);
  }

  private renderMiniDock(options: DialogueOptions): void {
    const stepNum = (options.stepIndex ?? 0) + 1;
    const total = options.totalSteps ?? 1;
    const isLast = stepNum >= total;

    this.miniDock.innerHTML = `
      <span class="pw-dock-label">Step ${stepNum}/${total}</span>
      <button class="pw-btn pw-btn-primary pw-btn-sm" data-pw-action="next">${isLast ? "Done ↻" : "Next →"}</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="rescan">Re-scan</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="dismiss">Hide</button>
    `;
    this.miniDock.style.display = "flex";
  }

  private positionCursorDialogue(mx: number, my: number): void {
    const boxW = this.cursorDialogue.offsetWidth || 268;
    const boxH = this.cursorDialogue.offsetHeight || 86;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;

    let x = mx + 18;
    let y = my + 20;

    if (x + boxW + 12 > vw) x = Math.max(8, mx - boxW - 14);
    if (y + boxH + 12 > vh) y = Math.max(8, my - boxH - 14);

    this.cursorDialogue.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  private positionCardAtCursor(): void {
    const cardW = this.card.offsetWidth || 336;
    const cardH = this.card.offsetHeight || 220;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;

    let x = this.userMouseX + 16;
    let y = this.userMouseY + 16;

    if (x + cardW + 16 > vw) x = Math.max(12, vw - cardW - 18);
    if (y + cardH + 16 > vh) y = Math.max(12, vh - cardH - 18);

    this.card.style.left = `${Math.round(x)}px`;
    this.card.style.top  = `${Math.round(y)}px`;
  }

  private handleMouseTrack(e: MouseEvent): void {
    this.userMouseX = e.clientX;
    this.userMouseY = e.clientY;

    if (this.state === "scanning" || this.state === "active") {
      this.positionCursorDialogue(e.clientX, e.clientY);
    }
  }

  private syncPosition(): void {
    if (this.state !== "active" || !this.currentTarget) return;
    if (!document.contains(this.currentTarget)) return;
    this.renderTargetVisuals(this.currentTarget);
  }

  private startSmoothScrollTracking(): void {
    if (this.scrollRafId !== null) cancelAnimationFrame(this.scrollRafId);
    const start = performance.now();
    const tick = () => {
      this.syncPosition();
      if (performance.now() - start < 650 && this.state === "active") {
        this.scrollRafId = requestAnimationFrame(tick);
      } else {
        this.scrollRafId = null;
      }
    };
    this.scrollRafId = requestAnimationFrame(tick);
  }
}

function formatActionLabel(action?: string): string {
  if (action === "focus") return "ENTER";
  if (action === "file-upload") return "UPLOAD";
  if (action === "scroll") return "SCROLL";
  return "CLICK";
}

// ── Shadow DOM Template (Magenta & Navy Blue Palette) ──────────

const SHADOW_TEMPLATE = `
<style>
  :host { all: initial; }

  /* ── Ghost Cursor ─────────────────────────────────────────── */
  #pw-cursor {
    position: fixed;
    top: 0; left: 0;
    width: 30px; height: 30px;
    pointer-events: none;
    transition: transform 460ms cubic-bezier(.22,1,.36,1), opacity 180ms ease;
    z-index: 2147483647;
    filter: drop-shadow(0 0 8px rgba(240, 22, 136, 0.9)) drop-shadow(0 2px 4px rgba(7, 11, 26, 0.7));
    display: none;
    opacity: 0;
    will-change: transform, opacity;
  }

  /* ── Element Highlight Ring ───────────────────────────────── */
  #pw-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 2147483644;
    border-radius: 8px;
    display: none;
    border: 2.5px solid #f01688;
    background: rgba(240, 22, 136, 0.09);
    box-shadow:
      0 0 0 3px rgba(14, 22, 48, 0.55),
      0 0 16px 3px rgba(240, 22, 136, 0.65),
      inset 0 0 12px rgba(240, 22, 136, 0.14);
    animation: pw-ring-pulse 1.5s ease-in-out infinite;
  }
  @keyframes pw-ring-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 2px rgba(14, 22, 48, 0.55),
        0 0 14px 2px rgba(240, 22, 136, 0.55),
        inset 0 0 10px rgba(240, 22, 136, 0.12);
    }
    50% {
      box-shadow:
        0 0 0 4px rgba(240, 22, 136, 0.25),
        0 0 24px 5px rgba(240, 22, 136, 0.88),
        inset 0 0 16px rgba(240, 22, 136, 0.2);
    }
  }

  /* ── Floating Step Tag over Target Element ────────────────── */
  #pw-tag {
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    display: none;
    background: linear-gradient(135deg, #f01688, #b80d6b);
    color: #ffffff;
    font: 700 10px/1.2 system-ui, -apple-system, sans-serif;
    letter-spacing: 0.08em;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 2px 10px rgba(240, 22, 136, 0.5);
    white-space: nowrap;
  }

  /* ── Cursor-Attached Action Dialogue Box ──────────────────── */
  #pw-cursor-dialogue {
    position: fixed;
    top: 0; left: 0;
    width: 268px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, rgba(14, 22, 48, 0.97) 0%, rgba(7, 11, 26, 0.98) 100%);
    border: 1.5px solid #f01688;
    border-radius: 10px;
    padding: 10px 12px;
    font: 12.5px/1.45 system-ui, -apple-system, sans-serif;
    color: #f8fafc;
    box-shadow:
      0 0 18px rgba(240, 22, 136, 0.4),
      0 8px 24px rgba(4, 8, 22, 0.85);
    display: none;
    z-index: 2147483647;
    pointer-events: none;
    will-change: transform;
  }
  .pw-cd-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 6px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(240, 22, 136, 0.25);
  }
  .pw-cd-hint {
    font-size: 12.5px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.4;
  }
  .pw-cd-sub {
    margin-top: 5px;
    font-size: 10.5px;
    color: #93a7d1;
  }

  /* ── Anchored Plan / Context Card (interactive) ───────────── */
  #pw-card {
    position: fixed;
    top: 80px; left: 80px;
    width: 336px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, #0e1630 0%, #070b1a 100%);
    border: 1.5px solid #f01688;
    border-radius: 12px;
    padding: 13px 15px;
    font: 13px/1.5 system-ui, -apple-system, sans-serif;
    color: #f1f5ff;
    box-shadow:
      0 0 22px rgba(240, 22, 136, 0.38),
      0 12px 32px rgba(4, 8, 22, 0.9);
    display: none;
    z-index: 2147483647;
    pointer-events: auto;
  }

  /* ── Corner Mini Dock (Next / Re-scan / Hide) ─────────────── */
  #pw-mini-dock {
    position: fixed;
    bottom: 16px; right: 16px;
    display: none;
    align-items: center;
    gap: 6px;
    background: rgba(11, 17, 38, 0.95);
    border: 1px solid #293c75;
    border-radius: 10px;
    padding: 6px 8px;
    box-shadow: 0 4px 18px rgba(4, 8, 22, 0.8);
    z-index: 2147483646;
    pointer-events: auto;
    font: 11px/1 system-ui, -apple-system, sans-serif;
  }
  .pw-dock-label {
    color: #ff79c6;
    font-weight: 700;
    font-size: 11px;
    padding: 0 4px;
  }

  /* ── Shared typography & buttons ──────────────────────────── */
  .pw-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 7px;
    border-bottom: 1px solid rgba(240, 22, 136, 0.25);
  }
  .pw-brand {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #ff4db8;
    text-shadow: 0 0 8px rgba(240, 22, 136, 0.65);
  }
  .pw-pill {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #c7d2fe;
    background: #16224a;
    border: 1px solid #2b3f7d;
    padding: 2px 7px;
    border-radius: 99px;
  }
  .pw-pill-err {
    color: #fecdd3;
    background: rgba(244, 63, 94, 0.18);
    border-color: rgba(244, 63, 94, 0.5);
  }

  .pw-plan-title {
    font-size: 13px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 2px;
  }
  .pw-plan-goal {
    font-size: 11.5px;
    color: #93a7d1;
    margin-bottom: 9px;
  }
  .pw-plan-list {
    list-style: none;
    margin: 0 0 10px 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pw-plan-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(21, 32, 66, 0.72);
    border: 1px solid #24356b;
    border-radius: 8px;
    padding: 7px 9px;
  }
  .pw-plan-num {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #f01688;
    color: #ffffff;
    font-size: 10.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .pw-plan-text {
    font-size: 12px;
    line-height: 1.4;
    color: #f1f5ff;
  }
  .pw-confirm-ask {
    font-size: 11.5px;
    font-weight: 600;
    color: #ff79c6;
    margin-bottom: 2px;
  }

  .pw-hint {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: #f8fafc;
  }
  .pw-warn {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: #f9a8d4;
  }
  .pw-error {
    margin-top: 6px;
    color: #fda4af;
    font-size: 12px;
    line-height: 1.45;
  }

  .pw-input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    background: #091024;
    border: 1.5px solid #2a3e78;
    border-radius: 8px;
    color: #f8fafc;
    font: 12.5px/1.4 system-ui, -apple-system, sans-serif;
    padding: 8px 10px;
    outline: none;
  }
  .pw-input:focus {
    border-color: #f01688;
  }

  .pw-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .pw-btn {
    font: 600 11px/1 system-ui, -apple-system, sans-serif;
    padding: 8px 11px;
    border-radius: 7px;
    cursor: pointer;
    border: 1px solid #293c75;
    background: #152042;
    color: #cbd5e1;
    transition: all 140ms ease;
  }
  .pw-btn:hover {
    border-color: #f01688;
    color: #ffffff;
  }
  .pw-btn-sm {
    padding: 6px 8px;
    font-size: 10.5px;
  }
  .pw-btn-primary {
    flex: 1;
    background: #f01688;
    border-color: #f01688;
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 0 10px rgba(240, 22, 136, 0.45);
  }
  .pw-btn-primary:hover {
    background: #ff3da3;
    border-color: #ff3da3;
  }

  .pw-scanning {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #ff79c6;
    font-weight: 600;
  }
  .pw-scan-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #f01688;
    box-shadow: 0 0 10px rgba(240, 22, 136, 0.9);
    animation: pw-scan-blink 0.9s ease infinite;
    flex-shrink: 0;
  }
  @keyframes pw-scan-blink {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .35; transform: scale(.65); }
  }

  .pw-pause {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .pw-pause-icon { font-size: 20px; flex-shrink: 0; }
  .pw-pause-body { font-size: 12.5px; line-height: 1.5; color: #e2e8f0; }
  .pw-pause-title {
    color: #ff4db8;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
</style>

<!-- Ghost cursor SVG (Navy + Magenta pointer, tip at 5,3) -->
<svg id="pw-cursor" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3L27 14.5L15.8 17.2L10.5 28L5 3Z" fill="rgba(240, 22, 136, 0.25)"/>
  <path d="M5 3L25.5 14L15.3 16.5L10.5 26.5L5 3Z" fill="#0b132b" stroke="#f01688" stroke-width="2" stroke-linejoin="round"/>
  <path d="M8.5 7.5L20.5 14L14.2 15.8L11 22.5L8.5 7.5Z" fill="#f01688" fill-opacity="0.5"/>
</svg>

<!-- Highlight ring around target element -->
<div id="pw-highlight"></div>
<div id="pw-tag"></div>

<!-- Dialogue box attached to the user's cursor -->
<div id="pw-cursor-dialogue"></div>

<!-- Interactive confirmation / context card -->
<div id="pw-card"></div>

<!-- Minimal corner controls while guiding -->
<div id="pw-mini-dock"></div>
`;

function PAUSE_BANNER_HTML(reason: string): string {
  return `
  <div class="pw-head">
    <span class="pw-brand">⬡ POINTWISE</span>
    <span class="pw-pill pw-pill-err">PAUSED</span>
  </div>
  <div class="pw-pause">
    <span class="pw-pause-icon">🔒</span>
    <div class="pw-pause-body">
      <div class="pw-pause-title">Sensitive Step Detected</div>
      ${escapeHtml(reason)}<br>
      <small style="color:#8a9bc2;font-size:11px">PointWise stepped back. Resume when ready.</small>
    </div>
  </div>
  <div class="pw-actions">
    <button class="pw-btn pw-btn-primary" data-pw-action="next">Continue Next →</button>
    <button class="pw-btn" data-pw-action="rescan">Re-scan</button>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
