// ============================================================
// PointWise — Popup Controller
//
// UX Flow:
//   Power OFF → ONLY PointWise title + power switch visible
//   Power ON  → prompt dialogue + Search button open
//   Results   → ONLY clickable link + validity score per card
//   Click link→ opens website, minimizes UI, and triggers AI flow
// ============================================================

import {
  searchWebIntent,
  type SearchResultItem,
} from "../lib/router.js";
import {
  clearSession,
  loadSession,
  saveSearchResults,
  setPowerOn,
} from "../lib/session-graph.js";
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

// ── Init — restore API key + persistent power session ────────
chrome.storage.local.get("gc_api_key", (r) => {
  if (r["gc_api_key"]) apiKeyInput.value = r["gc_api_key"] as string;
});

void restoreSession();

async function restoreSession(): Promise<void> {
  const session = await loadSession();
  if (session?.on) {
    isOn = true;
    const restoredPrompt = session.lastQuery || session.taskGoal;
    if (restoredPrompt) {
      taskInput.value = restoredPrompt;
    }
    if (session.lastResults && session.lastResults.length > 0) {
      renderResults(session.lastResults);
    }

    if (session.contextQuestion) {
      renderContextPromptState(session.contextQuestion);
      return;
    }

    renderOnState(false);
  } else {
    isOn = false;
    renderOffState();
  }
}

// ── Standard Power Switch ─────────────────────────────────────
powerSwitch.addEventListener("click", async () => {
  if (isOn) {
    await turnOff();
  } else {
    await turnOn();
  }
});

async function turnOn(): Promise<void> {
  isOn = true;
  const existingTask = taskInput.value.trim();

  await setPowerOn(existingTask, false);
  await setActionIcon("green");

  renderOnState(true);
}

async function turnOff(): Promise<void> {
  isOn = false;

  await clearSession();
  await setActionIcon("blue");

  try {
    await chrome.runtime.sendMessage({ type: "TOGGLE_OFF" } satisfies ExtMessage);
  } catch {
    /* SW wakes automatically */
  }

  renderOffState();
}

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
  if (!isOn) return;
  const answer = skip ? "" : contextAnswer.value.trim();
  if (!skip && !answer) {
    contextAnswer.classList.add("error");
    contextAnswer.focus();
    return;
  }
  contextAnswer.classList.remove("error");

  contextSubmitBtn.disabled = true;
  await chrome.runtime
    .sendMessage({ type: "CONTEXT_SUBMITTED", answer } satisfies ExtMessage)
    .catch(() => {});

  window.close();
}

// ── Web Search Bar (only available when ON) ───────────────────
searchBtn.addEventListener("click", doSearch);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void doSearch();
  }
});

async function doSearch(): Promise<void> {
  if (!isOn) return;

  const task = taskInput.value.trim();
  if (!task) {
    taskInput.classList.add("error");
    taskInput.focus();
    return;
  }
  taskInput.classList.remove("error");

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";

  const response = await searchWebIntent(task);

  searchBtn.disabled = false;
  searchBtn.textContent = "Search";

  await saveSearchResults(task, response.results);

  if (response.results.length === 0) {
    renderNoResults(
      response.warnings[0] ??
        "No results found. Try clearer keywords or a website domain."
    );
    return;
  }

  renderResults(response.results);
}

function renderNoResults(msg: string): void {
  resultsContainer.innerHTML = `<div class="no-results-card">${escapeHtml(msg)}</div>`;
  resultsContainer.classList.remove("hidden");
}

// ── Render Minimal Search Results (Link + Validity ONLY) ──────
function renderResults(items: SearchResultItem[]): void {
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
      if (!isOn) return;
      void openAndStartGuidance(item.url);
    };
    card.appendChild(link);

    // 2. Validity score + badge
    const score = item.validityScore;
    const badgeText =
      score >= 70 ? "✅ Valid" : score >= 45 ? "⚠️ Unconfirmed" : "🚫 Low Trust";
    const badgeCls = score >= 70 ? "" : score >= 45 ? " warn" : " block";
    const scoreColor =
      score >= 70 ? "var(--verified)" : score >= 45 ? "var(--warn)" : "var(--danger)";

    const validityRow = document.createElement("div");
    validityRow.className = "result-validity";
    validityRow.innerHTML = `
      <span class="result-badge${badgeCls}">${badgeText}</span>
      <div class="score-wrap" title="Website Validity Score">
        <div class="score-track">
          <div class="score-fill" style="width:${score}%;background:${scoreColor}"></div>
        </div>
        <span class="score-num" style="color:${scoreColor}">${score}%</span>
      </div>
    `;
    card.appendChild(validityRow);

    resultsContainer.appendChild(card);
  }

  resultsContainer.classList.remove("hidden");
}

// ── Open Chosen Link, Minimize UI & Trigger AI Flow ───────────
async function openAndStartGuidance(targetUrl: string): Promise<void> {
  if (!isOn) return;

  const task = taskInput.value.trim() || `Complete task on ${targetUrl}`;
  await setPowerOn(task, true, true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const targetNorm = targetUrl.replace(/\/$/, "");
    const currentNorm = (tab.url ?? "").replace(/\/$/, "");
    if (currentNorm === targetNorm) {
      await chrome.runtime
        .sendMessage({
          type: "TOGGLE_ON",
          taskGoal: task,
          resetContext: true,
        } satisfies ExtMessage)
        .catch(() => {});
    } else {
      await chrome.tabs.update(tab.id, { url: targetUrl });
    }
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }

  window.close();
}

// ── Icon helper ───────────────────────────────────────────────
async function setActionIcon(state: "green" | "blue"): Promise<void> {
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

// ── API key settings ──────────────────────────────────────────
keyBtn.addEventListener("click", () => keyRow.classList.toggle("hidden"));

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    await chrome.storage.local.remove("gc_api_key");
  } else {
    await chrome.storage.local.set({ gc_api_key: key });
  }
  keyRow.classList.add("hidden");
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
