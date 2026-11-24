// ============================================================
// Service Worker — background coordinator.
// Manages sessions, navigation tracking, and AI plan requests.
// ============================================================

import {
  createSession,
  loadSession,
  pushNavigation,
  advanceStep,
  clearSession,
} from "../lib/session-graph.js";
import type { ExtMessage, ScrubbedSnapshot, Plan } from "../lib/types.js";

const SANDBOX_ORIGIN = chrome.runtime.getURL("sandbox/sandbox.html");

// ── Message handler ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(console.error);
  return true; // keep channel open for async response
});

async function handleMessage(
  msg: ExtMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (msg.type) {
    case "TOGGLE_ON": {
      let tabId = sender.tab?.id;
      let tabUrl = sender.tab?.url;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
        tabUrl = activeTab?.url;
      }
      if (!tabId) return { error: "No tab ID" };
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/content-main.js"],
      });
      await createSession(msg.taskGoal, tabId, tabUrl ?? "");
      await setIcon("green");
      return { ok: true };
    }

    case "TOGGLE_OFF": {
      await clearSession();
      await setIcon("blue");
      return { ok: true };
    }

    case "SNAPSHOT_READY": {
      const plan = await requestPlanFromSandbox(msg.snapshot);
      const tabId = sender.tab?.id;
      if (tabId && plan) {
        await chrome.tabs.sendMessage(tabId, { type: "PLAN_READY", plan } satisfies ExtMessage);
      }
      return { ok: true };
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

// ── Icon helpers ──────────────────────────────────────────────

async function setIcon(state: "green" | "blue"): Promise<void> {
  const suffix = state === "green" ? "-green" : "-blue";
  await chrome.action.setIcon({
    path: {
      "16":  `assets/icons/icon16${suffix}.png`,
      "48":  `assets/icons/icon48${suffix}.png`,
      "128": `assets/icons/icon128${suffix}.png`,
    },
  }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  setIcon("blue");
});
chrome.runtime.onStartup.addListener(() => {
  setIcon("blue");
});

// ── Navigation tracking ───────────────────────────────────────

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // top frame only
  const session = await loadSession();
  if (!session) return;

  const origin = new URL(details.url).origin;
  await pushNavigation(details.tabId, origin);

  // Re-inject content script on new page
  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/content-main.js"],
    });
    await chrome.tabs.sendMessage(details.tabId, {
      type: "TOGGLE_ON",
      taskGoal: session.taskGoal,
    } satisfies ExtMessage);
  } catch {
    // Tab may not be ready yet — harmless
  }
});

// ── Sandbox communication (AI reasoning) ─────────────────────

function requestPlanFromSandbox(snapshot: ScrubbedSnapshot): Promise<Plan | null> {
  return new Promise((resolve) => {
    // Create an offscreen sandbox document if not already open
    const listener = (event: MessageEvent) => {
      if (event.origin !== SANDBOX_ORIGIN) return;
      if (event.data?.type === "PLAN_READY") {
        window.removeEventListener("message", listener);
        resolve(event.data.plan as Plan);
      }
    };
    window.addEventListener("message", listener);

    // Post scrubbed snapshot to sandbox iframe (created by popup or offscreen)
    chrome.runtime.sendMessage({ type: "SNAPSHOT_READY", snapshot }).catch(() => {
      window.removeEventListener("message", listener);
      resolve(null);
    });

    // Timeout after 15s
    setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve(null);
    }, 15_000);
  });
}
