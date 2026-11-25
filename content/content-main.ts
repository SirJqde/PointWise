// ============================================================
// PointWise — Content Script
// Responds to AI `COLLECT_SNAPSHOT` calls (via guide_page),
// presents Plan of Action confirmation, highlights elements,
// and attaches action guidance to the user's cursor.
// ============================================================

import { buildSnapshot } from "../lib/snapshot.js";
import { detectSensitivity } from "../lib/sensitivity.js";
import { CursorOverlay, type DialogueOptions } from "./overlay.js";
import { hookFileInputs, ValidationConstraints } from "./file-validator.js";
import type { ExtMessage, Plan, ScrubbedSnapshot, Step } from "../lib/types.js";

const GLOBAL_FLAG = "__pointwiseContentInitialized";

if (!(globalThis as Record<string, unknown>)[GLOBAL_FLAG]) {
  (globalThis as Record<string, unknown>)[GLOBAL_FLAG] = true;
  initPointWiseContent();
}

function initPointWiseContent(): void {
  let overlay: CursorOverlay | null = null;
  let currentPlan: Plan | null = null;
  let currentStepIndex = 0;
  let requestId: string | undefined;
  let pageUrl: string | undefined;

  function isCurrent(id = requestId): boolean {
    return id !== undefined && id === requestId && location.href === pageUrl;
  }
  let cleanupFileHooks: (() => void) | null = null;
  let cleanupStepWatch: (() => void) | null = null;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Message listener ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
    switch (msg.type) {
      case "PING":
        sendResponse({ ok: true });
        return false;

      case "GUIDANCE_START":
        if (location.href !== msg.pageUrl) return false;
        teardown();
        requestId = msg.requestId;
        pageUrl = msg.pageUrl;
        whenDomReady(() => {
          if (isCurrent(msg.requestId)) activateCursorOverlay();
        });
        sendResponse({ ok: true });
        return false;

      case "TOGGLE_OFF":
        teardown();
        sendResponse({ ok: true });
        return false;

      case "COLLECT_SNAPSHOT":
        // Invoked ONLY when the AI calls `guide_page` for page context
        if (!isCurrent(msg.requestId)) {
          sendResponse({ snapshot: null });
          return false;
        }
        collectSnapshotWithHydration()
          .then((snapshot) => sendResponse({ snapshot: isCurrent(msg.requestId) ? snapshot : null }))
          .catch(() => sendResponse({ snapshot: null }));
        return true; // keep channel open for async response

      case "CONTEXT_REQUIRED":
        if (!isCurrent(msg.requestId) || !overlay) return false;
        overlay.showContextWaiting(msg.question, msg.popupOpened);
        sendResponse({ ok: true });
        return false;

      case "PLAN_READY":
        if (!isCurrent(msg.requestId) || !overlay) return false;
        currentPlan = msg.plan;
        currentStepIndex = 0;
        overlay.showPlanConfirmation(msg.plan);
        sendResponse({ ok: true });
        return false;

      case "PLAN_ERROR":
        if (!isCurrent(msg.requestId) || !overlay) return false;
        overlay.showNotice(
          msg.message, true, false, msg.recovery === "rescan" ? "Re-scan this page" : "Try again"
        );
        sendResponse({ ok: true });
        return false;

      default:
        return false;
    }
  });

  // ── Lifecycle helpers ────────────────────────────────────────

  function whenDomReady(fn: () => void): void {
    if (document.body && document.readyState !== "loading") {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    }
  }

  function activateCursorOverlay(): void {
    if (!isCurrent() || !document.body) return;

    if (!overlay) {
      overlay = new CursorOverlay();

      overlay.onConfirm(() => {
        if (!isCurrent() || !currentPlan) return;
        currentStepIndex = 0;
        executeStep(0);
      });

      overlay.onCancel(() => {
        cleanupStepWatch?.();
        cleanupStepWatch = null;
      });

      overlay.onContextSubmit((answer) => {
        if (!requestId || !isCurrent()) return;
        chrome.runtime
          .sendMessage({ type: "CONTEXT_SUBMITTED", answer, requestId } satisfies ExtMessage)
          .catch(() => {});
      });

      overlay.onNext(() => advanceOrRescan());
      overlay.onRescan(() => requestAiRescan());
      overlay.onDismiss(() => {
        cleanupStepWatch?.();
        cleanupStepWatch = null;
      });
    }

    if (!cleanupFileHooks) {
      const fileHookRequest = requestId;
      cleanupFileHooks = hookFileInputs(inferConstraints, (input, result) => {
        if (!isCurrent(fileHookRequest)) return;
        const selector = input.id ? `#${CSS.escape(input.id)}` : "input[type=file]";
        if (!result.ok) {
          void overlay?.pointAt(selector, {
            hint: "⚠️ File issue detected before upload",
            error: result.errors.join(" "),
          });
        } else {
          void overlay?.pointAt(selector, {
            hint: "✅ File validated locally — safe to submit.",
          });
        }
      });
    }

    overlay.showScanning();
  }

  function collectSnapshotWithHydration(): Promise<ScrubbedSnapshot> {
    return new Promise((resolve) => {
      whenDomReady(() => {
        const first = buildSnapshot();
        if (first.elements.length >= 3) {
          resolve(first);
          return;
        }
        setTimeout(() => {
          resolve(buildSnapshot());
        }, 550);
      });
    });
  }

  function requestAiRescan(): void {
    if (!requestId || !isCurrent() || !overlay) return;
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
    cleanupStepWatch?.();
    cleanupStepWatch = null;
    chrome.runtime
      .sendMessage({ type: "RESCAN", requestId } satisfies ExtMessage)
      .catch(() => {});
  }

  function teardown(): void {
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
    requestId = undefined;
    pageUrl = undefined;
    cleanupStepWatch?.();
    cleanupStepWatch = null;
    cleanupFileHooks?.();
    cleanupFileHooks = null;
    overlay?.destroy();
    overlay = null;
    currentPlan = null;
    currentStepIndex = 0;
  }

  function advanceOrRescan(delay = 0): void {
    if (!requestId || !isCurrent() || !overlay || advanceTimer !== undefined) return;
    if (!currentPlan?.steps[currentStepIndex]) {
      requestAiRescan();
      return;
    }
    chrome.runtime
      .sendMessage({
        type: "STEP_COMPLETE", requestId, stepIndex: currentStepIndex,
      } satisfies ExtMessage)
      .catch(() => {});

    cleanupStepWatch?.();
    cleanupStepWatch = null;
    const nextIndex = ++currentStepIndex;
    const completedRequest = requestId;
    const continueGuidance = () => {
      advanceTimer = undefined;
      if (!isCurrent(completedRequest) || currentStepIndex !== nextIndex) return;
      if (currentPlan?.steps[nextIndex]) executeStep(nextIndex);
      else requestAiRescan();
    };
    if (delay) advanceTimer = setTimeout(continueGuidance, delay);
    else continueGuidance();
  }

  // ── Element resolution & step execution ──────────────────────

  function executeStep(index: number): void {
    if (!currentPlan || !overlay || !isCurrent()) return;
    cleanupStepWatch?.();
    cleanupStepWatch = null;

    const step: Step | undefined = currentPlan.steps[index];
    if (!step) {
      overlay.showNotice("✅ All visible steps complete! Click Re-scan if the page updated.");
      return;
    }

    const target = resolveTargetElement(step);
    if (!target) {
      overlay.showNotice(
        step.errorRecovery ?? "Target element is not visible right now. Try Re-scan.",
        true,
        true
      );
      return;
    }

    const iframeSrcs = Array.from(document.querySelectorAll("iframe"))
      .map((f) => f.src)
      .filter(Boolean);
    const nearbyText = target.parentElement?.textContent ?? "";
    const sensitivity = detectSensitivity(
      `${step.hint} ${target.textContent ?? ""}`,
      nearbyText,
      iframeSrcs
    );

    if (sensitivity !== "normal" || step.sensitivityClass !== "normal") {
      const cls = sensitivity !== "normal" ? sensitivity : step.sensitivityClass;
      overlay.showPauseBanner(pauseMessage(cls));
      return;
    }

    if (step.action === "pause") {
      overlay.showPauseBanner(step.hint);
      return;
    }

    const dialogueOpts: DialogueOptions = {
      hint: step.hint,
      stepIndex: index,
      totalSteps: currentPlan.steps.length,
      action: step.action,
    };
    if (step.errorRecovery !== undefined) {
      dialogueOpts.error = step.errorRecovery;
    }

    void overlay.pointAtElement(target, dialogueOpts);
    attachTargetCompletionWatcher(target, step, index);
  }

  function attachTargetCompletionWatcher(
    target: HTMLElement,
    step: Step,
    index: number
  ): void {
    const tag = target.tagName.toLowerCase();
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    const isTextEntry =
      (tag === "input" &&
        inputType !== "submit" &&
        inputType !== "button" &&
        inputType !== "checkbox" &&
        inputType !== "radio") ||
      tag === "textarea";

    const watchedRequest = requestId;
    const advanceAfterAction = () => {
      if (!isCurrent(watchedRequest) || currentStepIndex !== index) return;
      advanceOrRescan(350);
    };

    if (isTextEntry || step.action === "focus") {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter") advanceAfterAction();
      };
      const onChange = () => advanceAfterAction();
      target.addEventListener("keydown", onKey);
      target.addEventListener("change", onChange);
      cleanupStepWatch = () => {
        target.removeEventListener("keydown", onKey);
        target.removeEventListener("change", onChange);
      };
    } else {
      const onClick = () => advanceAfterAction();
      target.addEventListener("click", onClick, { capture: true, once: true });
      cleanupStepWatch = () => {
        target.removeEventListener("click", onClick, { capture: true });
      };
    }
  }

  function resolveTargetElement(step: Step): HTMLElement | null {
    try {
      const matches = document.querySelectorAll<HTMLElement>(step.targetSelector);
      for (const el of matches) {
        if (isElementVisible(el)) return el;
      }
    } catch {
      // Invalid selector — fall back to label lookup
    }

    if (step.fallbackLabel) {
      const needle = step.fallbackLabel.toLowerCase().trim();
      if (needle.length >= 2) {
        const candidates = document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [role="button"], [role="link"]'
        );
        for (const el of candidates) {
          if (el.closest("#pointwise-host") || !isElementVisible(el)) continue;
          const hay = [
            el.getAttribute("aria-label"),
            el.getAttribute("placeholder"),
            el.getAttribute("title"),
            el.textContent,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (hay.includes(needle)) return el;
        }
      }
    }

    return null;
  }

  function isElementVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function pauseMessage(cls: string): string {
    const messages: Record<string, string> = {
      captcha: "CAPTCHA detected — please complete it yourself.",
      otp: "OTP or verification code required — please enter it yourself.",
      payment: "Payment field detected — please enter your details yourself.",
      legal: "Legal declaration or agreement — please read and check it yourself.",
    };
    return messages[cls] ?? "Sensitive step detected — PointWise has stepped back.";
  }

  function inferConstraints(input: HTMLInputElement): ValidationConstraints | null {
    const accept = input.accept;
    if (!accept) return null;

    const allowedMimes = accept
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("/"));

    const nearby = input.closest("form, section, div")?.textContent ?? "";
    const sizeMatch = nearby.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);
    let maxBytes: number | undefined;
    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
      const n = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      maxBytes = unit === "KB" ? n * 1024 : unit === "MB" ? n * 1024 ** 2 : n * 1024 ** 3;
    }

    const constraints: ValidationConstraints = { allowedMimes };
    if (maxBytes !== undefined) constraints.maxBytes = maxBytes;
    return constraints;
  }
}
