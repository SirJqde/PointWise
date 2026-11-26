import { getStoredApiKey } from "../lib/ai-planner.js";
import { searchWebIntent, type SearchResultItem } from "../lib/router.js";
import { loadSession } from "../lib/session-graph.js";
import type { ExtMessage, GuidanceFailure } from "../lib/types.js";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const power = element<HTMLButtonElement>("power-switch");
const settings = element<HTMLButtonElement>("settings-btn");
const settingsBack = element<HTMLButtonElement>("settings-back");
const taskPanel = element("task-panel");
const contextPanel = element<HTMLFormElement>("context-panel");
const contextQuestion = element("context-question");
const contextAnswer = element<HTMLTextAreaElement>("context-answer");
const task = element<HTMLTextAreaElement>("task-input");
const pageMode = element<HTMLButtonElement>("page-mode");
const searchMode = element<HTMLButtonElement>("search-mode");
const start = element<HTMLButtonElement>("start-btn");
const resultsSection = element("results-section");
const resultsList = element("results-list");
const statusRow = element("status-row");
const statusAction = element<HTMLButtonElement>("status-action");
const key = element<HTMLInputElement>("api-key");

type Mode = "page" | "search";
type Notice = { message: string; error?: boolean; action?: { label: string; run: () => void } };
type StartMessage = Extract<ExtMessage, { type: "TOGGLE_ON" | "RESCAN" }>;

let mode: Mode = "page";
let on = false;
let busy = false;
let settingsOpen = false;
let contextRequestId: string | undefined;
let activeTab: chrome.tabs.Tab | undefined;
let pageNotice: Notice | undefined;
let searchNotice: Notice | undefined;
let settingsNotice: Notice | undefined;
let contextNotice: Notice | undefined;
let powerNotice: Notice | undefined;
let resultCount = 0;
let retryAfterKey: StartMessage | undefined;

function pageSite(): string {
  const url = activeTab?.url;
  return url && /^https?:\/\//.test(url) ? new URL(url).hostname : "";
}

function showNotice(notice?: Notice): void {
  const message = element("status-message");
  if (message.textContent !== (notice?.message ?? "")) message.textContent = notice?.message ?? "";
  statusRow.hidden = !notice;
  statusRow.dataset.error = String(Boolean(notice?.error));
  statusAction.hidden = !notice?.action;
  statusAction.textContent = notice?.action?.label ?? "";
  statusAction.onclick = notice?.action?.run ?? null;
}

function render(): void {
  const asking = on && Boolean(contextRequestId);
  power.setAttribute("aria-checked", String(on));
  settings.setAttribute("aria-expanded", String(settingsOpen));
  element("off-panel").hidden = on || settingsOpen;
  element("settings-panel").hidden = !settingsOpen;
  taskPanel.hidden = !on || asking || settingsOpen;
  contextPanel.hidden = !asking || settingsOpen;
  resultsSection.hidden = taskPanel.hidden || mode !== "search" || resultCount === 0;
  pageMode.setAttribute("aria-pressed", String(mode === "page"));
  searchMode.setAttribute("aria-pressed", String(mode === "search"));

  const site = pageSite();
  element("page-context").textContent = mode === "search"
    ? "Search the web for a site that fits your task."
    : site ? `Guiding on ${site}` : "Open a website in this tab to start guidance.";
  task.placeholder = mode === "search" ? "e.g. Find the official site to renew my licence"
    : "e.g. Find the search box and look up Bengaluru";
  start.textContent = busy
    ? mode === "search" ? "Searching…" : "Starting…"
    : mode === "search" ? "Find websites" : "Guide this page";
  showNotice(settingsOpen ? settingsNotice : !on ? powerNotice : asking ? contextNotice
    : mode === "page" ? pageNotice : searchNotice);
}

function selectMode(next: Mode): void {
  if (busy) return;
  mode = next;
  task.removeAttribute("aria-invalid");
  render();
}

function openSettings(): void {
  settingsOpen = true;
  settingsNotice = undefined;
  render();
  key.focus();
}

function closeSettings(): void {
  settingsOpen = false;
  render();
  settings.focus();
}

function recoveryNotice(failure: GuidanceFailure, requestId: string): Notice {
  return {
    message: failure.message,
    error: true,
    action: failure.recovery === "api-key"
      ? { label: "Open settings", run: openSettings }
      : {
        label: failure.recovery === "rescan" ? "Re-scan" : "Try again",
        run: () => void startGuidance({ type: "RESCAN", requestId }, "page"),
      },
  };
}

async function initialize(): Promise<void> {
  const [session, tabs, savedKey] = await Promise.all([
    loadSession(),
    chrome.tabs.query({ active: true, currentWindow: true }),
    getStoredApiKey(),
  ]);
  activeTab = tabs[0];
  key.value = savedKey;
  if (!session?.on) return;
  on = true;
  task.value = session.taskGoal || session.lastQuery || "";
  if (session.lastResults?.length) renderResults(session.lastResults, session.lastQuery ?? task.value);
  if (session.tabId === activeTab?.id && session.request?.pageUrl === activeTab?.url) {
    if (session.guidanceFailure && session.request) {
      pageNotice = recoveryNotice(session.guidanceFailure, session.request.id);
      if (session.guidanceFailure.recovery === "api-key") {
        retryAfterKey = { type: "RESCAN", requestId: session.request.id };
      }
    }
    if (session.contextQuestion && session.contextRequestId) {
      contextRequestId = session.contextRequestId;
      contextQuestion.textContent = session.contextQuestion;
    }
  }
}

function setBusy(value: boolean): void {
  busy = value;
  for (const button of [power, settings, pageMode, searchMode, start, statusAction]) button.disabled = value;
  task.readOnly = value;
  render();
}

function taskNotice(origin: Mode, notice?: Notice): void {
  if (origin === "page") pageNotice = notice;
  else searchNotice = notice;
  render();
}

power.addEventListener("click", async () => {
  if (busy) return;
  power.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: on ? "TOGGLE_OFF" : "ENABLE_SEARCH",
    } satisfies ExtMessage);
    if (!response?.ok) throw new Error();
    on = !on;
    powerNotice = undefined;
    if (!on) {
      contextRequestId = undefined;
      resultCount = 0;
      resultsList.replaceChildren();
      pageNotice = undefined;
      searchNotice = undefined;
      retryAfterKey = undefined;
      mode = "page";
    }
    render();
    if (on && !settingsOpen) task.focus();
  } catch {
    const notice = { message: "Could not change PointWise power. Try again.", error: true };
    powerNotice = notice;
    if (contextRequestId) contextNotice = notice;
    if (settingsOpen) settingsNotice = notice;
    if (on) taskNotice(mode, notice);
    else render();
  } finally {
    power.disabled = false;
  }
});

pageMode.addEventListener("click", () => selectMode("page"));
searchMode.addEventListener("click", () => selectMode("search"));
settings.addEventListener("click", () => settingsOpen ? closeSettings() : openSettings());
settingsBack.addEventListener("click", closeSettings);

element("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!on || busy) return;
  const taskGoal = task.value.trim();
  if (!taskGoal) {
    task.setAttribute("aria-invalid", "true");
    taskNotice(mode, { message: "Enter what you want to do.", error: true });
    task.focus();
    return;
  }
  if (mode === "search") {
    void findWebsites(taskGoal);
  } else if (!pageSite()) {
    taskNotice("page", {
      message: "Open a website first, or find one for this task.",
      action: { label: "Find a website", run: () => selectMode("search") },
    });
  } else {
    void startGuidance({ type: "TOGGLE_ON", taskGoal }, "page");
  }
});

task.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  element<HTMLFormElement>("task-form").requestSubmit();
});
task.addEventListener("input", () => {
  task.removeAttribute("aria-invalid");
  taskNotice(mode);
});

async function findWebsites(taskGoal: string): Promise<void> {
  resultCount = 0;
  resultsList.replaceChildren();
  taskNotice("search");
  setBusy(true);
  try {
    const response = await searchWebIntent(taskGoal);
    await chrome.runtime.sendMessage({
      type: "SAVE_SEARCH_RESULTS", query: taskGoal, results: response.results,
    } satisfies ExtMessage).catch(() => {});
    if (response.results.length) renderResults(response.results, taskGoal);
    else taskNotice("search", { message: response.warnings[0] ?? "No sites found. Try different keywords." });
  } catch {
    taskNotice("search", { message: "Search couldn’t finish. Try again.", error: true });
  } finally {
    setBusy(false);
  }
}

function renderResults(items: SearchResultItem[], taskGoal: string): void {
  resultsList.replaceChildren();
  resultCount = items.length;
  element("results-heading").textContent = resultCount === 1 ? "1 website" : `${resultCount} websites`;

  for (const item of items) {
    const row = document.createElement("li");
    const link = document.createElement("button");
    link.type = "button";
    link.className = "result-link";
    link.title = item.url;
    link.addEventListener("click", () => void startGuidance({
      type: "TOGGLE_ON", taskGoal: taskGoal || "Complete my task on this site", targetUrl: item.url,
    }, "search"));

    const verification = item.warnings?.[0] ??
      (item.validityScore >= 70 ? "Strong verification signals"
        : item.validityScore >= 45 ? "Mixed verification signals" : "Limited verification signals");
    const details = [
      ["result-name", item.title || item.domain || item.url],
      ["result-domain", item.title !== item.domain ? item.domain : ""],
      ["result-description", item.snippet?.trim() ||
        (item.matchedKeywords?.length ? `Matches ${item.matchedKeywords.slice(0, 3).join(", ")}.` : "")],
      ["result-relevance", `${item.keywordScore}% relevance`],
      ["result-verification", verification],
    ];
    for (const [className, value] of details) {
      if (!className || !value) continue;
      const line = document.createElement("span");
      line.className = className;
      line.textContent = value;
      link.append(line);
    }
    row.append(link);
    resultsList.append(row);
  }
}

async function startGuidance(message: StartMessage, origin: Mode): Promise<void> {
  if (!on || busy) return;
  setBusy(true);
  try {
    if (!(await getStoredApiKey())) {
      taskNotice(origin, {
        message: "Add a Gemini API key to start guidance.",
        action: { label: "Open settings", run: openSettings },
      });
      return;
    }
    const response = await chrome.runtime.sendMessage(message);
    if (response?.ok) window.close();
    else throw new Error(response?.error ?? "The page changed. Start guidance again.");
  } catch (error) {
    taskNotice(origin, {
      message: error instanceof Error && error.message ? error.message : "Could not start guidance.",
      error: true,
      action: { label: "Try again", run: () => void startGuidance(message, origin) },
    });
  } finally {
    setBusy(false);
  }
}

contextPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitContext(false);
});
element("context-skip").addEventListener("click", () => void submitContext(true));
contextAnswer.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  contextPanel.requestSubmit();
});

async function submitContext(skip: boolean): Promise<void> {
  if (!contextRequestId || busy) return;
  const answer = skip ? "" : contextAnswer.value.trim();
  if (!skip && !answer) {
    contextAnswer.setAttribute("aria-invalid", "true");
    contextAnswer.focus();
    return;
  }
  contextAnswer.removeAttribute("aria-invalid");
  setBusy(true);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "CONTEXT_SUBMITTED", answer, requestId: contextRequestId,
    } satisfies ExtMessage);
    if (response?.ok) window.close();
    else if (response?.skipped) {
      contextRequestId = undefined;
      pageNotice = { message: "The page changed. Start guidance again." };
    } else throw new Error();
  } catch {
    contextNotice = { message: "Could not send your answer. Try again.", error: true };
  } finally {
    setBusy(false);
  }
}

element("key-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = key.value.trim();
  try {
    if (value) await chrome.storage.local.set({ gc_api_key: value });
    else await chrome.storage.local.remove("gc_api_key");
    settingsNotice = { message: value ? "API key saved." : "API key removed." };
    if (value) {
      if (pageNotice?.action?.run === openSettings) pageNotice = undefined;
      if (searchNotice?.action?.run === openSettings) searchNotice = undefined;
      if (retryAfterKey) {
        const message = retryAfterKey;
        retryAfterKey = undefined;
        pageNotice = { message: "API key updated.", action: {
          label: "Try again", run: () => void startGuidance(message, "page"),
        } };
      }
    }
  } catch {
    settingsNotice = { message: "Could not save the API key. Try again.", error: true };
  }
  render();
});

power.disabled = true;
void initialize().catch(() => {
  powerNotice = { message: "Could not load PointWise. Reopen the popup to try again.", error: true };
}).finally(() => {
  power.disabled = false;
  render();
  if (contextRequestId) contextAnswer.focus();
});
