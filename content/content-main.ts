// ============================================================
// PointWise — Content Script
// Orchestrates DOM snapshotting, context prompt fallback,
// Plan of Action confirmation, cursor-attached action guide,
// element highlighting, and pre-flight file checks.
// ============================================================

import { buildSnapshot } from "../lib/snapshot.js";
import { detectSensitivity } from "../lib/sensitivity.js";
import { CursorOverlay, type DialogueOptions } from "./overlay.js";
import { hookFileInputs, ValidationConstraints } from "./file-validator.js";
import type { ExtMessage, Plan, Step } from "../lib/types.js";

const GLOBAL_FLAG = "__pointwiseContentInitialized";

if (!(globalThis as Record<string, unknown>)[GLOBAL_FLAG]) {
  (globalThis as Record<string, unknown>)[GLOBAL_FLAG] = true;
  initPointWiseContent();
}

function initPointWiseContent(): void {
  let overlay: CursorOverlay | null = null;
  let currentPlan: Plan | null = null;
  let currentStepIndex = 0;
  let activeTaskGoal = "";
  let sessionOn = false;
  let cleanupFileHooks: (() => void) | null = null;
  let cleanupStepWatch: (() => void) | null = null;

  // ── Message listener ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
    switch (msg.type) {
      case "PING":
        sendResponse({ ok: true });
        return false;

      case "TOGGLE_ON":
        sessionOn = true;
        activeTaskGoal = msg.taskGoal || activeTaskGoal;
        whenDomReady(() => startOrRescanSession(activeTaskGoal));
        sendResponse({ ok: true });
        return false;

      case "TOGGLE_OFF":
        sessionOn = false;
        teardown();
        sendResponse({ ok: true });
        return false;

      case "CONTEXT_REQUIRED":
        if (!sessionOn || !overlay) return false;
        overlay.showContextWaiting(msg.question, msg.popupOpened);
        sendResponse({ ok: true });
        return false;

      case "PLAN_READY":
        if (!sessionOn || !overlay) return false;
        currentPlan = msg.plan;
        currentStepIndex = 0;
        // Present the Plan of Action and ask for user confirmation first
        overlay.showPlanConfirmation(msg.plan);
        sendResponse({ ok: true });
        return false;

      case "PLAN_ERROR":
        if (!sessionOn || !overlay) return false;
        overlay.showNotice(msg.message, true);
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

  function startOrRescanSession(taskGoal: string): void {
    if (!sessionOn || !document.body) return;

    if (!overlay) {
      overlay = new CursorOverlay();

      // Once user confirms the Plan of Action, highlight Step 1 & attach action dialogue to cursor
      overlay.onConfirm(() => {
        if (!sessionOn || !currentPlan) return;
        currentStepIndex = 0;
        void executeStep(0);
      });

      overlay.onCancel(() => {
        cleanupStepWatch?.();
        cleanupStepWatch = null;
      });

      overlay.onContextSubmit((answer) => {
        chrome.runtime
          .sendMessage({ type: "CONTEXT_SUBMITTED", answer } satisfies ExtMessage)
          .catch(() => {});
      });

      overlay.onNext(() => advanceOrRescan());
      overlay.onRescan(() => triggerScan(activeTaskGoal));
      overlay.onDismiss(() => {
        cleanupStepWatch?.();
        cleanupStepWatch = null;
      });
    }

    if (!cleanupFileHooks) {
      cleanupFileHooks = hookFileInputs(inferConstraints, (input, result) => {
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

    triggerScan(taskGoal);
  }

  function triggerScan(taskGoal: string): void {
    if (!sessionOn || !overlay) return;
    cleanupStepWatch?.();
    cleanupStepWatch = null;
    overlay.showScanning();

    let snapshot = buildSnapshot();

    // Give SPAs a brief moment to hydrate if DOM currently looks sparse
    if (snapshot.elements.length < 3) {
      setTimeout(() => {
        if (!sessionOn) return;
        snapshot = buildSnapshot();
        chrome.runtime.sendMessage({
          type: "SNAPSHOT_READY",
          snapshot,
          taskGoal,
        } satisfies ExtMessage);
      }, 600);
      return;
    }

    chrome.runtime.sendMessage({
      type: "SNAPSHOT_READY",
      snapshot,
      taskGoal,
    } satisfies ExtMessage);
  }

  function teardown(): void {
    cleanupStepWatch?.();
    cleanupStepWatch = null;
    cleanupFileHooks?.();
    cleanupFileHooks = null;
    overlay?.destroy();
    overlay = null;
    currentPlan = null;
    currentStepIndex = 0;
  }

  function advanceOrRescan(): void {
    if (!sessionOn || !overlay) return;
    if (!currentPlan) {
      triggerScan(activeTaskGoal);
      return;
    }
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < currentPlan.steps.length) {
      currentStepIndex = nextIdx;
      void executeStep(nextIdx);
    } else {
      triggerScan(activeTaskGoal);
    }
  }

  // ── Element resolution & step execution ──────────────────────

  async function executeStep(index: number): Promise<void> {
    if (!currentPlan || !overlay || !sessionOn) return;
    cleanupStepWatch?.();
    cleanupStepWatch = null;

    const step: Step | undefined = currentPlan.steps[index];
    if (!step) {
      overlay.showNotice("✅ All visible steps complete! Click Re-scan if the page updated.");
      return;
    }

    const target = resolveTargetElement(step);
    if (!target) {
      if (index + 1 < currentPlan.steps.length) {
        currentStepIndex = index + 1;
        await executeStep(index + 1);
      } else {
        overlay.showNotice(
          step.errorRecovery ?? "Target element is not visible right now. Try Re-scan.",
          true
        );
      }
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
    if (index === 0 && currentPlan.warning !== undefined) {
      dialogueOpts.warning = currentPlan.warning;
    }
    if (step.errorRecovery !== undefined) {
      dialogueOpts.error = step.errorRecovery;
    }
    if (currentPlan.source !== undefined) {
      dialogueOpts.source = currentPlan.source;
    }

    await overlay.pointAtElement(target, dialogueOpts);

    chrome.runtime
      .sendMessage({ type: "STEP_COMPLETE", stepIndex: index } satisfies ExtMessage)
      .catch(() => {});

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

    const advanceAfterAction = () => {
      if (!sessionOn || currentStepIndex !== index) return;
      setTimeout(() => {
        if (!sessionOn || currentStepIndex !== index) return;
        advanceOrRescan();
      }, 350);
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
      // Invalid selector from AI — fall back to label lookup
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
