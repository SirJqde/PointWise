// ============================================================
// PointWise — Popup Controller
//
// UX Flow:
//   Power OFF → ONLY PointWise title + power switch visible
//   Power ON  → prompt dialogue, keyword-matched web search &
//               Google-style result cards with validity scores
//   Guide     → minimizes extension UI (window.close()), opens
//               chosen URL, activates cursor & checks context
// ============================================================

import {
  analyzePromptKeywords,
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
const statusText       = q("status-text");
const taskInput        = q("task-input") as HTMLTextAreaElement;
const searchBtn        = q("search-btn") as HTMLButtonElement;
const guideCurrentBtn  = q("guide-current-btn") as HTMLButtonElement;
const keywordsRow      = q("keywords-row");
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
      const analysis = analyzePromptKeywords(restoredPrompt);
      renderKeywords([...analysis.keywords, ...analysis.actionWords]);
    }
    if (session.lastResults && session.lastResults.length > 0) {
      renderResults(session.lastResults);
    }

    if (session.contextQuestion) {
      renderContextPromptState(session.contextQuestion);
      return;
    }

    const label = session.guiding
      ? `Guiding: ${(session.taskGoal || "Active page").slice(0, 34)}`
      : "Active — enter a task or website";
    renderOnState(label, false);
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

  renderOnState(
    existingTask
      ? `Active — ready for "${existingTask.slice(0, 26)}"`
      : "Active — enter a task or website",
    true
  );
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

function renderOnState(statusMsg: string, focusInput: boolean): void {
  powerSwitch.classList.add("on");
  powerSwitch.setAttribute("aria-checked", "true");
  powerSwitch.title = "Turn PointWise OFF";

  statusIndicator.className = "status-indicator active";
  statusIndicator.title = "PointWise is ON";

  appHeader.classList.add("expanded");
  contextPanel.classList.add("hidden");
  activePanel.classList.remove("hidden");
  statusText.textContent = statusMsg;

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
  keywordsRow.classList.add("hidden");
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

  const analysis = analyzePromptKeywords(task);
  renderKeywords([...analysis.keywords, ...analysis.actionWords]);

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";
  statusText.textContent = `Searching web & checking site validity…`;

  const response = await searchWebIntent(task);

  searchBtn.disabled = false;
  searchBtn.textContent = "Search Web";

  await saveSearchResults(task, response.results);

  if (response.results.length === 0) {
    renderNoResults(
      response.warnings[0] ??
        "No web results matched. Try refining your keywords or entering a domain."
    );
    statusText.textContent = "No results matched — try another query";
    return;
  }

  renderResults(response.results);
  statusText.textContent = `Found ${response.results.length} checked result${response.results.length > 1 ? "s" : ""}`;
}

function renderKeywords(keywords: string[]): void {
  keywordsRow.innerHTML = "";
  if (keywords.length === 0) {
    keywordsRow.classList.add("hidden");
    return;
  }

  const label = document.createElement("span");
  label.textContent = "Keywords:";
  keywordsRow.appendChild(label);

  for (const kw of keywords.slice(0, 6)) {
    const chip = document.createElement("span");
    chip.className = "kw-chip";
    chip.textContent = kw;
    keywordsRow.appendChild(chip);
  }
  keywordsRow.classList.remove("hidden");
}

function renderNoResults(msg: string): void {
  resultsContainer.innerHTML = `<div class="no-results-card">${escapeHtml(msg)}</div>`;
  resultsContainer.classList.remove("hidden");
}

// ── Render Google-style Results with Validity Scores ──────────
function renderResults(items: SearchResultItem[]): void {
  resultsContainer.innerHTML = "";

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "result-card";

    const score = item.validityScore;
    const badgeText =
      score >= 70 ? "✅ Valid Site" : score >= 45 ? "⚠️ Unconfirmed" : "🚫 Low Validity";
    const badgeCls = score >= 70 ? "" : score >= 45 ? " warn" : " block";
    const scoreColor =
      score >= 70 ? "var(--verified)" : score >= 45 ? "var(--warn)" : "var(--danger)";

    const header = document.createElement("div");
    header.className = "result-header";
    header.innerHTML = `
      <span class="result-badge${badgeCls}">${badgeText}</span>
      <div class="score-wrap" title="Website Validity Score">
        <div class="score-track">
          <div class="score-fill" style="width:${score}%;background:${scoreColor}"></div>
        </div>
        <span class="score-num" style="color:${scoreColor}">${score}%</span>
      </div>
    `;
    card.appendChild(header);

    // Clickable Google-style title + URL link
    const link = document.createElement("a");
    link.className = "result-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = `
      <div class="result-title-row">
        <span class="result-title">${escapeHtml(item.title)}</span>
        <span class="ext-icon">↗</span>
      </div>
      <span class="result-url">${escapeHtml(item.url.replace(/^https?:\/\//, ""))}</span>
    `;
    link.onclick = async (e) => {
      e.preventDefault();
      if (!isOn) return;
      const goal = taskInput.value.trim() || `Complete task on ${item.domain}`;
      await setPowerOn(goal, true, true);
      await chrome.tabs.create({ url: item.url });
      window.close();
    };
    card.appendChild(link);

    // Snippet
    if (item.snippet) {
      const snip = document.createElement("p");
      snip.className = "result-snippet";
      snip.textContent = item.snippet;
      card.appendChild(snip);
    }

    // Signal breakdown + matched keywords
    const pills = document.createElement("div");
    pills.className = "signal-pills";
    for (const sig of item.signals) {
      if (sig.name === "Domain Match") continue;
      const pill = document.createElement("span");
      pill.className = `sig-pill ${sig.passed ? "pass" : ""}`;
      pill.title = sig.detail;
      pill.textContent = `${sig.passed ? "✓" : "·"} ${sig.name}`;
      pills.appendChild(pill);
    }
    if (item.matchedKeywords.length > 0) {
      const kwPill = document.createElement("span");
      kwPill.className = "sig-pill kw";
      kwPill.textContent = `Match: ${item.matchedKeywords.slice(0, 3).join(", ")}`;
      pills.appendChild(kwPill);
    }
    card.appendChild(pills);

    // Warning if non-official or low score
    if (item.warnings.length > 0 && score < 75) {
      const warn = document.createElement("p");
      warn.className = "result-warning";
      warn.textContent = item.warnings[0] ?? "";
      card.appendChild(warn);
    }

    // Open & Start Guiding button
    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "go-btn";
    goBtn.textContent = "Open & Start Guiding ▶";
    goBtn.disabled = score < 20;
    goBtn.onclick = () => void launchGuidanceOnUrl(item.url);
    card.appendChild(goBtn);

    resultsContainer.appendChild(card);
  }

  resultsContainer.classList.remove("hidden");
}

// ── Open Site & Start Guiding (minimizes UI + activates cursor) ─
async function launchGuidanceOnUrl(targetUrl: string): Promise<void> {
  if (!isOn) return;

  const task = taskInput.value.trim() || `Complete task on ${targetUrl}`;
  await setPowerOn(task, true, true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

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

  window.close();
}

// ── Guide Currently Open Tab Directly ─────────────────────────
guideCurrentBtn.addEventListener("click", guideCurrentPage);

async function guideCurrentPage(): Promise<void> {
  if (!isOn) return;

  const task = taskInput.value.trim();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
    statusText.textContent = "Open a website tab (http/https) first";
    return;
  }

  await setPowerOn(task, true, true);

  await chrome.runtime
    .sendMessage({
      type: "TOGGLE_ON",
      taskGoal: task,
      resetContext: true,
    } satisfies ExtMessage)
    .catch(() => {});

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
