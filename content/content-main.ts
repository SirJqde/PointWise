// ============================================================
// Content Script — main entry point injected per tab.
// Orchestrates: snapshot, overlay, file validation, messages.
// ============================================================

import { buildSnapshot } from "../lib/snapshot.js";
import { detectSensitivity } from "../lib/sensitivity.js";
import { CursorOverlay } from "./overlay.js";
import { hookFileInputs, ValidationConstraints } from "./file-validator.js";
import type { ExtMessage, Plan, Step } from "../lib/types.js";

let overlay: CursorOverlay | null = null;
let currentPlan: Plan | null = null;
let currentStepIndex = 0;
let cleanupFileHooks: (() => void) | null = null;

// ── Bootstrap ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  switch (msg.type) {
    case "TOGGLE_ON":
      startSession();
      sendResponse({ ok: true });
      break;

    case "TOGGLE_OFF":
      teardown();
      sendResponse({ ok: true });
      break;

    case "PLAN_READY":
      currentPlan = msg.plan;
      currentStepIndex = 0;
      executeStep(currentStepIndex);
      break;

    default:
      break;
  }
});

// ── Session lifecycle ─────────────────────────────────────────

function startSession(): void {
  if (overlay) return; // already active
  overlay = new CursorOverlay();

  overlay.onWithdraw(() => {
    chrome.runtime.sendMessage({ type: "USER_WITHDREW" } satisfies ExtMessage);
  });

  // Observe and send snapshot
  sendSnapshot();

  // Hook file inputs
  cleanupFileHooks = hookFileInputs(inferConstraints, (input, result) => {
    if (!result.ok) {
      overlay?.pointAt(`#${input.id || ""}`, {
        hint: "⚠️ File issue detected before upload:",
        error: result.errors.join(" "),
      });
    } else {
      overlay?.pointAt(`#${input.id || ""}`, { hint: "✅ File looks good — safe to submit." });
    }
  });
}

function teardown(): void {
  overlay?.destroy();
  overlay = null;
  cleanupFileHooks?.();
  cleanupFileHooks = null;
  currentPlan = null;
  currentStepIndex = 0;
}

function sendSnapshot(): void {
  const snapshot = buildSnapshot();
  chrome.runtime.sendMessage({ type: "SNAPSHOT_READY", snapshot } satisfies ExtMessage);
}

// ── Step execution ────────────────────────────────────────────

async function executeStep(index: number): Promise<void> {
  if (!currentPlan || !overlay) return;
  const step: Step | undefined = currentPlan.steps[index];
  if (!step) {
    // All steps done
    overlay.pointAt("body", { hint: "✅ Task complete! Well done." });
    return;
  }

  // Collect iframe srcs for sensitivity detection
  const iframeSrcs = Array.from(document.querySelectorAll("iframe"))
    .map((f) => f.src)
    .filter(Boolean);

  const nearbyText = document.querySelector(step.targetSelector)?.parentElement?.textContent ?? "";
  const sensitivity = detectSensitivity(step.hint, nearbyText, iframeSrcs);

  if (sensitivity !== "normal") {
    overlay.showPauseBanner(pauseMessage(sensitivity));
    // Will resume when user sends USER_RESUMED from popup
    return;
  }

  if (step.action === "pause") {
    overlay.showPauseBanner(step.hint);
    return;
  }

  await overlay.pointAt(step.targetSelector, {
    hint: step.hint,
    error: step.errorRecovery,
  });

  chrome.runtime.sendMessage({ type: "STEP_COMPLETE", stepIndex: index } satisfies ExtMessage);
}

function pauseMessage(cls: string): string {
  const messages: Record<string, string> = {
    captcha: "CAPTCHA detected — please complete it yourself.",
    otp: "OTP or verification code required — please enter it yourself.",
    payment: "Payment field detected — please enter your details yourself.",
    legal: "Legal declaration or agreement — please read and check it yourself.",
  };
  return messages[cls] ?? "Sensitive step detected — GuideCursor has stepped back.";
}

// ── File constraint inference ──────────────────────────────────

/**
 * Infers upload constraints from surrounding DOM text / attributes.
 * Returns null if no constraints can be detected.
 */
function inferConstraints(input: HTMLInputElement): ValidationConstraints | null {
  const accept = input.accept;
  if (!accept) return null;

  const allowedMimes = accept
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("/"));

  // Try to find a size hint in nearby text (e.g. "Max 2MB" or "up to 500KB")
  const nearby = input.closest("form, section, div")?.textContent ?? "";
  const sizeMatch = nearby.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);
  let maxBytes: number | undefined;
  if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
    const n = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    maxBytes = unit === "KB" ? n * 1024 : unit === "MB" ? n * 1024 ** 2 : n * 1024 ** 3;
  }

  return { allowedMimes, maxBytes };
}
