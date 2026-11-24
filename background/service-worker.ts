// ============================================================
// PointWise — Service Worker
// Manages persistent power state, navigation tracking,
// content-script injection, context re-popup, and AI plans.
// `guidePage()` is ONLY invoked by the AI planner when it needs
// live website context to make decisions.
// ============================================================

import {
  advanceStep,
  applyContextAnswer,
  clearSession,
  createSession,
  loadSession,
  pushNavigation,
  setContextQuestion,
} from "../lib/session-graph.js";
import { runAiPlanner } from "../lib/ai-planner.js";
import type { ExtMessage, ScrubbedSnapshot } from "../lib/types.js";

const CONTENT_SCRIPT_PATH = "content/content-main.js";
const spaDebounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

// ── Message handler ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error("[PointWise SW]", err);
      sendResponse({ error: String(err) });
    });
  return true;
});

async function handleMessage(
  msg: ExtMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (msg.type) {
    case "GET_SESSION_STATE": {
      const session = await loadSession();
      return {
        on: Boolean(session?.on),
        guiding: Boolean(session?.guiding),
        taskGoal: session?.taskGoal ?? "",
      };
    }

    case "TOGGLE_ON": {
      let tabId = sender.tab?.id;
      let tabUrl = sender.tab?.url;
      let windowId = sender.tab?.windowId;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url;
        windowId = activeTab?.windowId;
      }
      if (!tabId) return { error: "No active tab" };

      await createSession(msg.taskGoal, tabId, tabUrl ?? "", Boolean(msg.resetContext));
      await setIcon("green");

      if (isInjectableUrl(tabUrl)) {
        await startAiGuidanceOnTab(tabId, tabUrl ?? "", msg.taskGoal, windowId);
      }

      return { ok: true };
    }

    case "TOGGLE_OFF": {
      await clearSession();
      await setIcon("blue");

      const tabs = await chrome.tabs.query({});
      await Promise.allSettled(
        tabs
          .filter((t) => typeof t.id === "number")
          .map((t) =>
            chrome.tabs.sendMessage(t.id!, { type: "TOGGLE_OFF" } satisfies ExtMessage)
          )
      );

      return { ok: true };
    }

    case "SNAPSHOT_READY": {
      // Used when user clicks Re-scan on the page overlay — still gated by session.on
      const session = await loadSession();
      if (!session || !session.on) return { ok: true, skipped: true };

      const tabId = sender.tab?.id;
      const tabUrl = sender.tab?.url ?? "";
      if (!tabId) return { error: "No sender tab" };

      const taskGoal = msg.taskGoal || session.taskGoal || "";
      await startAiGuidanceOnTab(tabId, tabUrl, taskGoal, sender.tab?.windowId);
      return { ok: true };
    }

    case "CONTEXT_SUBMITTED": {
      const updated = await applyContextAnswer(msg.answer);
      if (!updated) return { error: "No active session" };

      let tabId = sender.tab?.id;
      let tabUrl = sender.tab?.url;
      let windowId = sender.tab?.windowId;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url;
        windowId = activeTab?.windowId;
      }
      if (tabId && isInjectableUrl(tabUrl)) {
        await startAiGuidanceOnTab(tabId, tabUrl ?? "", updated.taskGoal, windowId);
      }
      return { ok: true, taskGoal: updated.taskGoal };
    }

    case "STEP_COMPLETE": {
      await advanceStep(msg.stepIndex + 1);
      return { ok: true };
    }

    case "SESSION_NAV": {
      const tabId = sender.tab?.id;
      if (tabId) await pushNavigation(tabId, msg.origin);
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

// ── AI Orchestrator (guidePage ONLY called by the AI) ─────────

async function startAiGuidanceOnTab(
  tabId: number,
  tabUrl: string,
  taskGoal: string,
  windowId?: number
): Promise<void> {
  const session = await loadSession();
  if (!session || !session.on) return;

  await ensureContentScriptAndActivate(tabId, taskGoal);

  const plan = await runAiPlanner({
    taskGoal,
    pageUrl: tabUrl,
    contextProvided: Boolean(session.contextProvided),
    // `guidePage` is ONLY invoked when the AI requests page context via tool call
    guidePage: () => guidePage(tabId, taskGoal),
  });

  // Verify session wasn't turned OFF while AI was thinking
  const latest = await loadSession();
  if (!latest || !latest.on) return;

  if (plan.needsContext && plan.clarifyingQuestion) {
    await setContextQuestion(plan.clarifyingQuestion);

    let popupOpened = false;
    if (typeof chrome.action?.openPopup === "function") {
      try {
        await chrome.action.openPopup(windowId ? { windowId } : undefined);
        popupOpened = true;
      } catch {
        popupOpened = false;
      }
    }

    await chrome.tabs
      .sendMessage(tabId, {
        type: "CONTEXT_REQUIRED",
        question: plan.clarifyingQuestion,
        popupOpened,
      } satisfies ExtMessage)
      .catch(() => {});
    return;
  }

  if (plan.error) {
    await chrome.tabs
      .sendMessage(tabId, {
        type: "PLAN_ERROR",
        message: plan.error,
      } satisfies ExtMessage)
      .catch(() => {});
    return;
  }

  if (plan.steps.length > 0) {
    await chrome.tabs
      .sendMessage(tabId, {
        type: "PLAN_READY",
        plan,
      } satisfies ExtMessage)
      .catch(() => {});
  } else {
    await chrome.tabs
      .sendMessage(tabId, {
        type: "PLAN_ERROR",
        message: "No matching actionable steps found on this page.",
      } satisfies ExtMessage)
      .catch(() => {});
  }
}

/**
 * Private helper invoked ONLY by the AI planner tool (`guide_page`)
 * to collect a scrubbed DOM snapshot of the active website for context.
 */
async function guidePage(
  tabId: number,
  taskGoal: string
): Promise<ScrubbedSnapshot | null> {
  try {
    await ensureContentScriptAndActivate(tabId, taskGoal);
    const res = (await chrome.tabs.sendMessage(tabId, {
      type: "COLLECT_SNAPSHOT",
      taskGoal,
    } satisfies ExtMessage)) as { snapshot?: ScrubbedSnapshot } | undefined;
    return res?.snapshot ?? null;
  } catch {
    return null;
  }
}

// ── Content script injection helper ───────────────────────────

function isInjectableUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

async function ensureContentScriptAndActivate(
  tabId: number,
  taskGoal: string
): Promise<void> {
  let alreadyLoaded = false;
  try {
    const pong = (await chrome.tabs.sendMessage(tabId, {
      type: "PING",
    } satisfies ExtMessage)) as { ok?: boolean } | undefined;
    alreadyLoaded = Boolean(pong?.ok);
  } catch {
    alreadyLoaded = false;
  }

  if (!alreadyLoaded) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
  }

  await chrome.tabs.sendMessage(tabId, {
    type: "TOGGLE_ON",
    taskGoal,
  } satisfies ExtMessage);
}

// ── Icon helpers ──────────────────────────────────────────────

async function setIcon(state: "green" | "blue"): Promise<void> {
  const suffix = state === "green" ? "-green" : "-blue";
  await chrome.action
    .setIcon({
      path: {
        "16": `assets/icons/icon16${suffix}.png`,
        "48": `assets/icons/icon48${suffix}.png`,
        "128": `assets/icons/icon128${suffix}.png`,
      },
    })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  void setIcon("blue");
});

chrome.runtime.onStartup.addListener(async () => {
  await clearSession();
  await setIcon("blue");
});

// ── Navigation tracking (only when ON + guiding) ──────────────

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!isInjectableUrl(details.url)) return;

  const session = await loadSession();
  if (!session || !session.on || !session.guiding) return;

  try {
    const origin = new URL(details.url).origin;
    await pushNavigation(details.tabId, origin);
    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    await startAiGuidanceOnTab(
      details.tabId,
      details.url,
      session.taskGoal,
      tab?.windowId
    );
  } catch {
    // Tab may have closed or restricted
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!isInjectableUrl(details.url)) return;

  const session = await loadSession();
  if (!session || !session.on || !session.guiding) return;

  const prev = spaDebounceTimers.get(details.tabId);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(async () => {
    spaDebounceTimers.delete(details.tabId);
    const latest = await loadSession();
    if (!latest || !latest.on || !latest.guiding) return;
    try {
      const tab = await chrome.tabs.get(details.tabId).catch(() => null);
      await startAiGuidanceOnTab(
        details.tabId,
        details.url,
        latest.taskGoal,
        tab?.windowId
      );
    } catch {
      // Ignore if tab gone
    }
  }, 650);

  spaDebounceTimers.set(details.tabId, timer);
});
