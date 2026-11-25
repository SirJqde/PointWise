import {
  advanceStep,
  applyContextAnswer,
  clearSession,
  createSession,
  loadSession,
  pushNavigation,
  saveGuidanceFailure,
  saveGuidanceRequest,
  saveSearchResults,
  setContextQuestion,
  setPowerOn,
} from "../lib/session-graph.js";
import { runAiPlanner } from "../lib/ai-planner.js";
import type { ExtMessage, GuidanceFailure, GuidanceRequest, ScrubbedSnapshot } from "../lib/types.js";

let activeRequest: GuidanceRequest | undefined;
let commandQueue: Promise<unknown> = loadSession().then((session) => {
  activeRequest = session?.request;
}).catch(console.error);

function enqueue<T>(command: () => Promise<T>): Promise<T> {
  const next = commandQueue.then(command);
  commandQueue = next.catch(() => {});
  return next;
}

chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  void enqueue(() => handleMessage(msg, sender))
    .then(sendResponse)
    .catch((err) => {
      console.error("[PointWise SW]", err);
      sendResponse({ error: "PointWise couldn’t complete that action. Try again." });
    });
  return true;
});

async function handleMessage(msg: ExtMessage, sender: chrome.runtime.MessageSender) {
  const session = await loadSession();
  switch (msg.type) {
    case "ENABLE_SEARCH":
      if (sender.tab) return { skipped: true };
      await setPowerOn();
      await setIcon("green");
      return { ok: true };

    case "SAVE_SEARCH_RESULTS":
      if (sender.tab) return { skipped: true };
      await saveSearchResults(msg.query, msg.results);
      return { ok: true };

    case "GET_SESSION_STATE":
      return {
        on: Boolean(session?.on),
        guiding: Boolean(session?.guiding),
        taskGoal: session?.taskGoal ?? "",
      };

    case "TOGGLE_ON": {
      if (!session?.on || sender.tab || !msg.taskGoal.trim()) {
        return { error: "Turn PointWise on and enter a task." };
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const requestedUrl = msg.targetUrl ?? tab?.url;
      if (!requestedUrl || !isInjectableUrl(requestedUrl)) {
        return { error: "Open a website in this tab, then choose Guide this page." };
      }
      if (!msg.targetUrl && (tab?.status !== "complete" || tab.pendingUrl)) {
        return { error: "Wait for this page to finish loading, then try again." };
      }
      const targetUrl = new URL(requestedUrl).href;
      const previousTab = session.tabId;
      activeRequest = undefined;
      if (previousTab !== undefined) await stopOverlay(previousTab);

      const selectedTab = tab?.id === undefined
        ? await chrome.tabs.create({ active: true })
        : tab;
      const tabId = selectedTab.id;
      if (tabId === undefined) return { error: "Could not open a tab for guidance." };

      await createSession(msg.taskGoal, tabId, new URL(targetUrl).origin);
      if (selectedTab.url === targetUrl && selectedTab.status === "complete") {
        await startGuidance(tabId, targetUrl, msg.taskGoal, false);
      } else {
        await chrome.tabs.update(tabId, { url: targetUrl });
      }
      return { ok: true };
    }

    case "TOGGLE_OFF":
      activeRequest = undefined;
      await clearSession();
      await setIcon("blue");
      if (session?.tabId !== undefined) await stopOverlay(session.tabId);
      return { ok: true };

    case "RESCAN":
    case "STEP_COMPLETE":
    case "CONTEXT_SUBMITTED": {
      const request = activeRequest;
      if (!session?.on || !session.guiding || !request || request.id !== msg.requestId ||
          session.tabId !== request.tabId ||
          (sender.tab && (sender.tab.id !== request.tabId || sender.frameId !== 0 ||
            sender.url !== request.pageUrl))) {
        return { skipped: true };
      }
      if (msg.type === "STEP_COMPLETE") {
        if (sender.tab) await advanceStep(msg.stepIndex + 1);
      } else if (msg.type === "RESCAN") {
        if (!sender.tab) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id !== request.tabId || tab.url !== request.pageUrl || tab.pendingUrl ||
              activeRequest !== request) {
            return { error: "Return to the tab you were guiding, then try again." };
          }
        }
        await startGuidance(request.tabId, request.pageUrl, session.taskGoal,
          Boolean(session.contextProvided));
      } else {
        if (session.contextRequestId !== request.id) return { skipped: true };
        const updated = await applyContextAnswer(msg.answer);
        if (updated && activeRequest === request) {
          await startGuidance(request.tabId, request.pageUrl, updated.taskGoal, true);
        }
      }
      return { ok: true };
    }

    default:
      return { error: "Unknown message type" };
  }
}

async function startGuidance(tabId: number, pageUrl: string, taskGoal: string, contextProvided: boolean) {
  const request = { id: crypto.randomUUID(), tabId, pageUrl };
  activeRequest = request;
  await saveGuidanceRequest(request);
  if (activeRequest !== request) return;
  void runGuidance(request, taskGoal, contextProvided).catch((error) => {
    console.error("[PointWise guidance]", error);
    return enqueue(() => publishFailure(request, {
      message: "PointWise couldn’t start guidance on this page. Reload the page and try again.",
      recovery: "retry",
    }));
  }).catch(console.error);
}

async function publishFailure(request: GuidanceRequest, failure: GuidanceFailure): Promise<void> {
  if (activeRequest !== request) return;
  const tab = await chrome.tabs.get(request.tabId).catch(() => null);
  if (activeRequest !== request || tab?.url !== request.pageUrl || tab.pendingUrl) return;

  await saveGuidanceFailure(failure);
  if (activeRequest === request) {
    await chrome.tabs.sendMessage(request.tabId, {
      type: "PLAN_ERROR", requestId: request.id, ...failure,
    } satisfies ExtMessage, { frameId: 0 }).catch(() => {});
  }
}

async function runGuidance(
  request: GuidanceRequest,
  taskGoal: string,
  contextProvided: boolean
): Promise<void> {
  const { id: requestId, tabId, pageUrl } = request;
  const target = { frameId: 0 };
  const loaded = await chrome.tabs.sendMessage(tabId, { type: "PING" }, target)
    .then((reply) => Boolean(reply?.ok), () => false);
  if (activeRequest !== request) return;
  if (!loaded) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content/content-main.js"] });
  }
  if (activeRequest !== request) return;

  const activated = await chrome.tabs.sendMessage(tabId, {
    type: "GUIDANCE_START", requestId, pageUrl,
  } satisfies ExtMessage, target);
  if (activeRequest !== request) return;
  if (!activated?.ok) throw new Error("The page did not activate the guidance overlay.");

  const plan = await runAiPlanner({
    taskGoal,
    pageUrl,
    contextProvided,
    guidePage: async () => {
      if (activeRequest !== request) return null;
      const reply = await chrome.tabs.sendMessage(tabId, {
        type: "COLLECT_SNAPSHOT", requestId,
      } satisfies ExtMessage, target).catch(() => null) as { snapshot?: ScrubbedSnapshot } | null;
      return activeRequest === request ? reply?.snapshot ?? null : null;
    },
  });

  await enqueue(async () => {
    if (activeRequest !== request) return;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (activeRequest !== request || tab?.url !== pageUrl || tab.pendingUrl) return;

    let message: ExtMessage;
    if (plan.needsContext && plan.clarifyingQuestion) {
      await setContextQuestion(plan.clarifyingQuestion, requestId);
      if (activeRequest !== request) return;
      let popupOpened = false;
      if (tab.active && typeof chrome.action.openPopup === "function") {
        popupOpened = await chrome.action.openPopup({ windowId: tab.windowId })
          .then(() => true, () => false);
      }
      message = { type: "CONTEXT_REQUIRED", requestId, question: plan.clarifyingQuestion, popupOpened };
    } else if (plan.error || plan.steps.length === 0) {
      await publishFailure(request, {
        message: plan.error ?? "No matching actionable steps found on this page.",
        recovery: plan.recovery ?? "rescan",
      });
      return;
    } else {
      message = { type: "PLAN_READY", requestId, plan };
    }
    if (activeRequest === request) {
      await chrome.tabs.sendMessage(tabId, message, target).catch(() => {});
    }
  });
}

function stopOverlay(tabId: number): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { type: "TOGGLE_OFF" }, { frameId: 0 }).catch(() => {});
}

function isInjectableUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function setIcon(state: "green" | "blue"): Promise<void> {
  await chrome.action.setIcon({
    path: {
      "16": `assets/icons/icon16-${state}.png`,
      "48": `assets/icons/icon48-${state}.png`,
      "128": `assets/icons/icon128-${state}.png`,
    },
  }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => void setIcon("blue"));
chrome.runtime.onStartup.addListener(() => {
  void enqueue(async () => {
    await clearSession();
    await setIcon("blue");
  });
});

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) return;
  if (activeRequest?.tabId === tabId) activeRequest = undefined;
  void enqueue(async () => {
    const session = await loadSession();
    if (session?.tabId !== tabId) return;
    activeRequest = undefined;
    await saveGuidanceRequest();
  }).catch(console.error);
});

function handleNavigation({ tabId, frameId, url }: chrome.webNavigation.WebNavigationFramedCallbackDetails) {
  if (frameId !== 0 || !isInjectableUrl(url)) return;
  if (activeRequest?.tabId === tabId && activeRequest.pageUrl !== url) activeRequest = undefined;

  void enqueue(async () => {
    const session = await loadSession();
    if (!session?.on || !session.guiding || session.tabId !== tabId) return;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.url !== url || (tab.pendingUrl && tab.pendingUrl !== url)) return;
    if (activeRequest?.tabId === tabId && activeRequest.pageUrl === url) return;
    await pushNavigation(tabId, new URL(url).origin);
    await startGuidance(tabId, url, session.taskGoal, Boolean(session.contextProvided));
  }).catch(console.error);
}

chrome.webNavigation.onCompleted.addListener(handleNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(handleNavigation);

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeRequest?.tabId === tabId) activeRequest = undefined;
  void enqueue(async () => {
    const session = await loadSession();
    if (session?.tabId !== tabId) return;
    await clearSession();
    await setIcon("blue");
  }).catch(console.error);
});
