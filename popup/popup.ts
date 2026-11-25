// ============================================================
// PointWise — Popup Controller
//
import {
  searchWebIntent,
  type SearchResultItem,
} from "../lib/router.js";
import { loadSession } from "../lib/session-graph.js";
import { getStoredApiKey } from "../lib/ai-planner.js";
import type { ExtMessage } from "../lib/types.js";

// ── Refs ──────────────────────────────────────────────────────
const appHeader        = q("app-header");
const powerSwitch      = q("power-switch") as HTMLButtonElement;
const statusIndicator  = q("status-indicator");
const contextPanel     = q("context-panel");
const contextQuestion  = q("context-question");
const contextAnswer    = q("context-answer") as HTMLTextAreaElement;
const contextSubmitBtn = q("context-submit-btn") as HTMLButtonElement;
const contextSkipBtn   = q("context-skip-btn") as HTMLButtonElement;
const activePanel      = q("active-panel");
const taskInput        = q("task-input") as HTMLTextAreaElement;
const guideBtn         = q("guide-btn") as HTMLButtonElement;
const actionStatus     = q("action-status");
const retryBtn         = q("retry-btn") as HTMLButtonElement;
const searchBtn        = q("search-btn") as HTMLButtonElement;
const resultsContainer = q("results-container");
const keyBtn           = q("key-btn") as HTMLButtonElement;
const keyRow           = q("key-row");
const apiKeyInput      = q("api-key") as HTMLInputElement;
const saveKeyBtn       = q("save-key") as HTMLButtonElement;

function q(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

// ── State ─────────────────────────────────────────────────────
let isOn = false;
let contextRequestId: string | undefined;
let retryRequestId: string | undefined;
let busy = false;
let powerChanging = false;

// ── Init — restore API key + persistent power session ────────
chrome.storage.local.get("gc_api_key", (r) => {
  if (r["gc_api_key"]) apiKeyInput.value = r["gc_api_key"] as string;
});

void restoreSession().catch(() => renderOffState());

async function restoreSession(): Promise<void> {
  const session = await loadSession();
  if (session?.on) {
    isOn = true;
    const restoredPrompt = session.taskGoal || session.lastQuery || "";
    if (restoredPrompt) {
      taskInput.value = restoredPrompt;
    }
    if (session.lastResults && session.lastResults.length > 0) {
      renderResults(session.lastResults, session.lastQuery ?? restoredPrompt);
    }

    if (session.contextQuestion && session.contextRequestId) {
      contextRequestId = session.contextRequestId;
      renderContextPromptState(session.contextQuestion);
      return;
    }

    renderOnState(false);
    if (session.guidanceFailure && session.request) {
      retryRequestId = session.request.id;
      setStatus(session.guidanceFailure.message);
      retryBtn.textContent = session.guidanceFailure.recovery === "rescan"
        ? "Re-scan this page" : "Try again";
      retryBtn.classList.remove("hidden");
      if (session.guidanceFailure.recovery === "api-key") openKeySettings();
    }
  } else {
    isOn = false;
    renderOffState();
  }
}

// ── Standard Power Switch ─────────────────────────────────────
powerSwitch.addEventListener("click", async () => {
  if (busy || powerChanging) return;
  powerChanging = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: isOn ? "TOGGLE_OFF" : "ENABLE_SEARCH",
    } satisfies ExtMessage);
    if (!response?.ok) throw new Error();
    isOn = !isOn;
    if (isOn) renderOnState(true);
    else renderOffState();
  } catch {
    setStatus("Could not change PointWise power. Try again.");
  } finally {
    powerChanging = false;
  }
});

// ── UI State Renderers ────────────────────────────────────────

function renderOnState(focusInput: boolean): void {
  powerSwitch.classList.add("on");
  powerSwitch.setAttribute("aria-checked", "true");
  powerSwitch.title = "Turn PointWise OFF";

  statusIndicator.className = "status-indicator active";
  statusIndicator.title = "PointWise is ON";

  appHeader.classList.add("expanded");
  contextPanel.classList.add("hidden");
  activePanel.classList.remove("hidden");

  if (focusInput) {
    taskInput.focus();
  }
}

function renderContextPromptState(question: string): void {
  powerSwitch.classList.add("on");
  powerSwitch.setAttribute("aria-checked", "true");
  powerSwitch.title = "Turn PointWise OFF";

  statusIndicator.className = "status-indicator active";
  statusIndicator.title = "PointWise needs context";

  appHeader.classList.add("expanded");
  activePanel.classList.add("hidden");
  contextQuestion.textContent = question;
  contextAnswer.value = "";
  contextPanel.classList.remove("hidden");
  contextAnswer.focus();
}

function renderOffState(): void {
  powerSwitch.classList.remove("on");
  powerSwitch.setAttribute("aria-checked", "false");
  powerSwitch.title = "Turn PointWise ON";

  statusIndicator.className = "status-indicator dormant";
  statusIndicator.title = "PointWise is OFF";

  appHeader.classList.remove("expanded");
  contextPanel.classList.add("hidden");
  activePanel.classList.add("hidden");
  resultsContainer.classList.add("hidden");
  retryBtn.classList.add("hidden");
  retryRequestId = undefined;
  setStatus("");
}

// ── Additional Context Submission ─────────────────────────────
contextSubmitBtn.addEventListener("click", () => void submitContext(false));
contextSkipBtn.addEventListener("click", () => void submitContext(true));
contextAnswer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void submitContext(false);
  }
});

async function submitContext(skip: boolean): Promise<void> {
  if (!isOn || !contextRequestId) return;
  const answer = skip ? "" : contextAnswer.value.trim();
  if (!skip && !answer) {
    contextAnswer.classList.add("error");
    contextAnswer.focus();
    return;
  }
  contextAnswer.classList.remove("error");

  contextSubmitBtn.disabled = true;
  contextSkipBtn.disabled = true;
  const response = await chrome.runtime
    .sendMessage({ type: "CONTEXT_SUBMITTED", answer, requestId: contextRequestId } satisfies ExtMessage)
    .catch(() => null);
  if (response?.ok) {
    window.close();
  } else if (response?.skipped) {
    renderOnState(false);
    setStatus("The page changed. Choose Guide this page to start again.");
  } else {
    contextQuestion.textContent = "Could not send your answer. Try again.";
  }
  contextSubmitBtn.disabled = false;
  contextSkipBtn.disabled = false;
}

guideBtn.addEventListener("click", () => void startOnCurrentPage());
searchBtn.addEventListener("click", () => void doSearch());
retryBtn.addEventListener("click", () => {
  if (retryRequestId) void startGuidance({ type: "RESCAN", requestId: retryRequestId });
});
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void doSearch();
  }
});
taskInput.addEventListener("input", () => taskInput.classList.remove("error"));

function readTask(): string {
  const task = taskInput.value.trim();
  taskInput.classList.toggle("error", !task);
  if (!task) {
    setStatus("Enter what you want to do.");
    taskInput.focus();
  }
  return task;
}

function setBusy(value: boolean): void {
  busy = value;
  guideBtn.disabled = value;
  searchBtn.disabled = value;
  powerSwitch.disabled = value;
  retryBtn.disabled = value;
}

function setStatus(message: string): void {
  actionStatus.textContent = message;
  actionStatus.classList.toggle("hidden", !message);
}

async function startOnCurrentPage(): Promise<void> {
  if (!isOn || busy || powerChanging) return;
  const taskGoal = readTask();
  if (taskGoal) await startGuidance({ type: "TOGGLE_ON", taskGoal });
}

async function doSearch(): Promise<void> {
  if (!isOn || busy || powerChanging) return;
  const task = readTask();
  if (!task) return;

  setBusy(true);
  searchBtn.textContent = "Searching…";
  setStatus("");
  resultsContainer.classList.add("hidden");
  try {
    const response = await searchWebIntent(task);
    await chrome.runtime.sendMessage({
      type: "SAVE_SEARCH_RESULTS", query: task, results: response.results,
    } satisfies ExtMessage).catch(() => {});
    if (response.results.length > 0) renderResults(response.results, task);
    else renderNoResults(response.warnings[0] ?? "No results found. Try different keywords.");
  } catch {
    renderNoResults("Search couldn’t finish. Try again, or open a website and choose Guide this page.");
  } finally {
    searchBtn.textContent = "Search for a site";
    setBusy(false);
  }
}

function renderNoResults(msg: string): void {
  resultsContainer.innerHTML = `<div class="no-results-card">${escapeHtml(msg)}</div>`;
  resultsContainer.classList.remove("hidden");
}

// ── Search results ──────────────────────────────────────────
function renderResults(items: SearchResultItem[], taskGoal: string): void {
  resultsContainer.innerHTML = "";

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "result-card";

    // 1. Clickable link (opens site, minimizes popup, activates AI guide)
    const link = document.createElement("a");
    link.className = "result-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = item.url;
    link.innerHTML = `
      <span class="result-url">${escapeHtml(item.url.replace(/^https?:\/\//, ""))}</span>
      <span class="ext-icon">↗</span>
    `;
    link.onclick = (e) => {
      e.preventDefault();
      void startGuidance({ type: "TOGGLE_ON", taskGoal: taskGoal || "Complete my task on this site", targetUrl: item.url });
    };
    card.appendChild(link);

    // 2. Validity score + badge
    const score = item.validityScore;
    const badgeText =
      score >= 70 ? "Strong signals" : score >= 45 ? "Mixed signals" : "Weak signals";
    const badgeCls = score >= 70 ? "" : score >= 45 ? " warn" : " block";
    const scoreColor =
      score >= 70 ? "var(--verified)" : score >= 45 ? "var(--warn)" : "var(--danger)";

    const validityRow = document.createElement("div");
    validityRow.className = "result-validity";
    validityRow.innerHTML = `
      <span class="result-badge${badgeCls}">${badgeText}</span>
      <div class="score-wrap" title="Estimated site rating">
        <div class="score-track">
          <div class="score-fill" style="width:${score}%;background:${scoreColor}"></div>
        </div>
        <span class="score-num" style="color:${scoreColor}">${score}%</span>
      </div>
    `;
    card.appendChild(validityRow);

    const reason = document.createElement("p");
    reason.className = "result-reason";
    const checks = [
      ["Live HTTPS", "Site responded over HTTPS."],
      ["DNS", "Domain resolved."],
      ["TLS / CT", "Certificate check passed."],
    ];
    const passedChecks = checks
      .filter(([name]) => item.signals?.some((signal) => signal.name === name && signal.passed))
      .map(([, label]) => label);
    const warning = item.warnings?.[0];
    reason.textContent = [warning, ...passedChecks.slice(0, 2)]
      .filter(Boolean).join(" ") || "Few verification signals were available.";
    card.appendChild(reason);

    resultsContainer.appendChild(card);
  }

  resultsContainer.classList.remove("hidden");
}

async function startGuidance(message: Extract<ExtMessage, { type: "TOGGLE_ON" | "RESCAN" }>): Promise<void> {
  if (!isOn || busy || powerChanging) return;
  setBusy(true);
  try {
    if (!(await getStoredApiKey())) {
      setStatus("Add a Gemini API key to start guidance.");
      openKeySettings();
      return;
    }
    const response = await chrome.runtime.sendMessage(message);
    if (response?.ok) window.close();
    else setStatus(response?.error ?? "The page changed. Choose Guide this page to start again.");
  } catch {
    setStatus("Could not start guidance. Try again.");
  } finally {
    setBusy(false);
  }
}

function openKeySettings(): void {
  keyRow.classList.remove("hidden");
  apiKeyInput.focus();
}

// ── API key settings ──────────────────────────────────────────
keyBtn.addEventListener("click", () => keyRow.classList.toggle("hidden"));

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  try {
    if (!key) {
      await chrome.storage.local.remove("gc_api_key");
    } else {
      await chrome.storage.local.set({ gc_api_key: key });
    }
    keyRow.classList.add("hidden");
    setStatus(key ? "API key saved. You can start or retry guidance." : "API key removed.");
  } catch {
    setStatus("Could not save the API key change. Try again.");
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
