// ============================================================
// PointWise — Service Worker
// Manages persistent power state, navigation tracking,
// content-script injection, context re-popup, and AI plans.
// AI calls ONLY run when PointWise power switch is ON.
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
import { generatePlan } from "../lib/ai-planner.js";
import type { ExtMessage } from "../lib/types.js";

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
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url;
      }
      if (!tabId) return { error: "No active tab" };

      await createSession(msg.taskGoal, tabId, tabUrl ?? "", Boolean(msg.resetContext));
      await setIcon("green");

      if (isInjectableUrl(tabUrl)) {
        await ensureContentScriptAndActivate(tabId, msg.taskGoal);
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
      // HARD GATE: never scan or call AI unless power switch is ON
      const session = await loadSession();
      if (!session || !session.on) {
        return { ok: true, skipped: true };
      }

      const tabId = sender.tab?.id;
      const taskGoal = msg.taskGoal || session.taskGoal || "Guide user on this page";

      try {
        const plan = await generatePlan(msg.snapshot, taskGoal, {
          contextProvided: Boolean(session.contextProvided),
        });

        if (plan.needsContext && plan.clarifyingQuestion) {
          await setContextQuestion(plan.clarifyingQuestion);

          // Try to re-popup the extension UI to ask the additional question
          let popupOpened = false;
          if (typeof chrome.action?.openPopup === "function") {
            try {
              const winId = sender.tab?.windowId;
              await chrome.action.openPopup(winId ? { windowId: winId } : undefined);
              popupOpened = true;
            } catch {
              popupOpened = false;
            }
          }

          if (tabId) {
            await chrome.tabs
              .sendMessage(tabId, {
                type: "CONTEXT_REQUIRED",
                question: plan.clarifyingQuestion,
                popupOpened,
              } satisfies ExtMessage)
              .catch(() => {});
          }
          return { ok: true, needsContext: true, popupOpened };
        }

        if (tabId) {
          if (plan.steps.length > 0) {
            await chrome.tabs.sendMessage(tabId, {
              type: "PLAN_READY",
              plan,
            } satisfies ExtMessage);
          } else {
            await chrome.tabs.sendMessage(tabId, {
              type: "PLAN_ERROR",
              message:
                plan.warning ??
                "No actionable elements found on this page yet. Try Re-scan.",
            } satisfies ExtMessage);
          }
        }
      } catch (err) {
        if (tabId) {
          await chrome.tabs
            .sendMessage(tabId, {
              type: "PLAN_ERROR",
              message: err instanceof Error ? err.message : "Failed to analyze page.",
            } satisfies ExtMessage)
            .catch(() => {});
        }
      }

      return { ok: true };
    }

    case "CONTEXT_SUBMITTED": {
      const updated = await applyContextAnswer(msg.answer);
      if (!updated) return { error: "No active session" };

      let tabId = sender.tab?.id;
      let tabUrl = sender.tab?.url;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url;
      }
      if (tabId && isInjectableUrl(tabUrl)) {
        await ensureContentScriptAndActivate(tabId, updated.taskGoal);
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
    await ensureContentScriptAndActivate(details.tabId, session.taskGoal);
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
      await ensureContentScriptAndActivate(details.tabId, latest.taskGoal);
    } catch {
      // Ignore if tab gone
    }
  }, 650);

  spaDebounceTimers.set(details.tabId, timer);
});
