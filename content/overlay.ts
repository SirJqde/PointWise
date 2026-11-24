// ============================================================
// Virtual Cursor Overlay — Shadow DOM, pointer-events: none
// Renders the animated cursor SVG + contextual dialogue box.
// ============================================================

type OverlayState = "idle" | "active" | "paused" | "withdrawn";

interface DialogueOptions {
  hint: string;
  error?: string;
  pauseReason?: string;
}

export class CursorOverlay {
  private shadow: ShadowRoot;
  private cursor: SVGSVGElement;
  private dialogue: HTMLDivElement;
  private state: OverlayState = "idle";
  private withdrawalHandlers: (() => void)[] = [];

  constructor() {
    const host = document.createElement("div");
    host.setAttribute("id", "guidecursor-host");
    host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;";
    document.body.appendChild(host);

    this.shadow = host.attachShadow({ mode: "closed" });
    this.shadow.innerHTML = SHADOW_TEMPLATE;
    this.cursor = this.shadow.querySelector<SVGSVGElement>("#gc-cursor")!;
    this.dialogue = this.shadow.querySelector<HTMLDivElement>("#gc-dialogue")!;

    this.attachWithdrawalListeners();
  }

  /** Animate the cursor to a DOM element and show a dialogue hint */
  async pointAt(selector: string, options: DialogueOptions): Promise<void> {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      this.showError(options.error ?? "Could not locate the expected element.");
      return;
    }
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    this.moveCursorTo(cx, cy);
    this.showDialogue(options);
    this.state = "active";
  }

  showPauseBanner(reason: string): void {
    this.cursor.style.display = "none";
    this.dialogue.innerHTML = PAUSE_BANNER_HTML(reason);
    this.dialogue.style.display = "flex";
    this.state = "paused";
  }

  hidePauseBanner(): void {
    this.cursor.style.display = "";
    this.state = "active";
  }

  withdraw(): void {
    this.cursor.style.opacity = "0";
    this.dialogue.style.display = "none";
    this.state = "withdrawn";
  }

  resume(): void {
    this.cursor.style.opacity = "1";
    this.state = "active";
  }

  destroy(): void {
    this.shadow.host.remove();
    this.detachWithdrawalListeners();
  }

  onWithdraw(cb: () => void): void {
    this.withdrawalHandlers.push(cb);
  }

  // ── Private ───────────────────────────────────────────────

  private moveCursorTo(x: number, y: number): void {
    this.cursor.style.transform = `translate(${x}px, ${y}px)`;
    this.cursor.style.display = "block";
    this.cursor.style.opacity = "1";
  }

  private showDialogue(options: DialogueOptions): void {
    this.dialogue.innerHTML = `
      <p class="hint">${escapeHtml(options.hint)}</p>
      ${options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : ""}
    `;
    this.dialogue.style.display = "block";
  }

  private showError(msg: string): void {
    this.dialogue.innerHTML = `<p class="error">${escapeHtml(msg)}</p>`;
    this.dialogue.style.display = "block";
  }

  private attachWithdrawalListeners(): void {
    const handler = () => {
      if (this.state === "active") {
        this.withdraw();
        this.withdrawalHandlers.forEach((h) => h());
      }
    };
    ["mousemove", "mousedown", "keydown", "touchstart"].forEach((evt) =>
      document.addEventListener(evt, handler, { capture: true, passive: true })
    );
    // Store for cleanup
    (this as unknown as Record<string, unknown>)["_handler"] = handler;
  }

  private detachWithdrawalListeners(): void {
    const handler = (this as unknown as Record<string, unknown>)["_handler"] as EventListener;
    if (!handler) return;
    ["mousemove", "mousedown", "keydown", "touchstart"].forEach((evt) =>
      document.removeEventListener(evt, handler, { capture: true })
    );
  }
}

// ── Templates ─────────────────────────────────────────────────

const SHADOW_TEMPLATE = `
<style>
  :host { all: initial; }
  #gc-cursor {
    position: fixed;
    top: 0; left: 0;
    width: 28px; height: 28px;
    pointer-events: none;
    transition: transform 400ms cubic-bezier(.4,0,.2,1), opacity 200ms;
    z-index: 2147483647;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.4));
  }
  #gc-dialogue {
    position: fixed;
    bottom: 24px; right: 24px;
    max-width: 340px;
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 12px;
    padding: 14px 18px;
    font: 14px/1.5 system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,.35);
    display: none;
    z-index: 2147483647;
    pointer-events: none;
  }
  .hint { margin: 0; }
  .error { margin: 8px 0 0; color: #f87171; font-size: 12px; }
  .pause-banner {
    background: #0f172a;
    border: 1.5px solid #3b82f6;
    border-radius: 12px;
    padding: 14px 18px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .pause-icon { font-size: 20px; }
  .pause-text { font-size: 13px; line-height: 1.5; }
</style>

<svg id="gc-cursor" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:none">
  <path d="M5 3L23 13.5L13.5 15.5L9 25L5 3Z" fill="#6366f1" stroke="white" stroke-width="1.5"/>
</svg>

<div id="gc-dialogue"></div>
`;

function PAUSE_BANNER_HTML(reason: string): string {
  return `<div class="pause-banner">
    <span class="pause-icon">🔒</span>
    <span class="pause-text">${escapeHtml(reason)}<br>GuideCursor has stepped back. Continue when ready.</span>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
