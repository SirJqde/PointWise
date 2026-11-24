// ============================================================
// Popup — prompt box, start/stop, search, result box
// ============================================================

import { resolveIntent, type DetailedVerificationResult } from "../lib/router.js";

// ── Refs ──────────────────────────────────────────────────────
const toggleBtn   = q("toggle-btn") as HTMLButtonElement;
const taskInput   = q("task-input") as HTMLTextAreaElement;
const searchBtn   = q("search-btn") as HTMLButtonElement;
const resultBox   = q("result-box")!;
const resultBadge = q("result-badge")!;
const scoreFill   = q("score-fill") as HTMLElement;
const scoreNum    = q("score-num")!;
const resultLink  = q("result-link") as HTMLAnchorElement;
const resultDomain = q("result-domain")!;
const goBtn       = q("go-btn") as HTMLButtonElement;
const statusIndicator = q("status-indicator")!;
const statusBar   = q("status-bar")!;
const statusText  = q("status-text")!;
const keyBtn      = q("key-btn") as HTMLButtonElement;
const keyRow      = q("key-row")!;
const apiKeyInput = q("api-key") as HTMLInputElement;
const saveKeyBtn  = q("save-key") as HTMLButtonElement;

function q(id: string): HTMLElement { return document.getElementById(id) as HTMLElement; }

async function setActionIcon(state: "green" | "blue"): Promise<void> {
  const suffix = state === "green" ? "-green" : "-blue";
  await chrome.action.setIcon({
    path: {
      "16":  `assets/icons/icon16${suffix}.png`,
      "48":  `assets/icons/icon48${suffix}.png`,
      "128": `assets/icons/icon128${suffix}.png`,
    },
  }).catch(() => {});
}

// ── State ─────────────────────────────────────────────────────
let isActive = false;
let resolved: DetailedVerificationResult | null = null;

// ── Init — restore session / saved key ───────────────────────
chrome.storage.local.get("gc_api_key", (r) => {
  if (r["gc_api_key"]) apiKeyInput.value = r["gc_api_key"] as string;
});

chrome.storage.session.get("guidecursor_session", (r) => {
  if (r["guidecursor_session"]) {
    const s = r["guidecursor_session"] as { taskGoal?: string };
    setActive(true, s.taskGoal ?? "");
  } else {
    setActive(false, "");
  }
});

// ── Toggle start / stop ───────────────────────────────────────
toggleBtn.addEventListener("click", async () => {
  if (isActive) {
    await stopSession();
  } else {
    await startSession();
  }
});

async function startSession(): Promise<void> {
  if (resolved?.canonical) {
    await launchGuidance();
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url && !tab.url.startsWith("chrome://")) {
      setActive(true, tab.url);
      await chrome.runtime.sendMessage({
        type: "TOGGLE_ON",
        taskGoal: taskInput.value.trim() || "Guide current page",
      }).catch(() => {});
    } else {
      setActive(true, "");
    }
  }
}

async function stopSession(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "TOGGLE_OFF" });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OFF" }).catch(() => {});
  } catch { /* SW may not be ready */ }
  setActive(false, "");
}

// ── Search ────────────────────────────────────────────────────
searchBtn.addEventListener("click", doSearch);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSearch(); }
});

async function doSearch(): Promise<void> {
  const task = taskInput.value.trim();
  if (!task) { taskInput.classList.add("error"); taskInput.focus(); return; }
  taskInput.classList.remove("error");

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";

  resolved = await resolveIntent(task);

  searchBtn.disabled = false;
  searchBtn.textContent = "Search";

  if (!resolved.canonical) {
    taskInput.classList.add("error");
    resultBox.classList.add("hidden");
    return;
  }

  renderResult(resolved);
}

// ── Render result box ─────────────────────────────────────────
function renderResult(r: DetailedVerificationResult): void {
  const score = r.trustScore;
  const url   = r.canonical;                          // e.g. https://www.redbus.in
  const host  = url.replace(/^https?:\/\//, "");      // e.g. www.redbus.in

  // Badge
  if (score >= 70) {
    resultBadge.textContent = "✅ Verified";
    resultBadge.className = "result-badge";
  } else if (score >= 45) {
    resultBadge.textContent = "⚠️ Unconfirmed";
    resultBadge.className = "result-badge warn";
  } else {
    resultBadge.textContent = "🚫 Low trust";
    resultBadge.className = "result-badge block";
  }

  // Score bar colour
  const color = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  scoreFill.style.width   = `${score}%`;
  scoreFill.style.background = color;
  scoreNum.textContent    = `${score}%`;
  scoreNum.style.color    = color;

  // Clickable link — opens in new tab via chrome.tabs.create
  // so the popup's sandboxed context doesn't block it
  resultDomain.textContent = host;
  resultLink.href = url;
  resultLink.onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url });
  };

  // Open & guide button
  goBtn.disabled = score < 25;
  resultBox.classList.remove("hidden");
}

// ── Open & guide ──────────────────────────────────────────────
goBtn.addEventListener("click", launchGuidance);

async function launchGuidance(): Promise<void> {
  if (!resolved?.canonical || resolved.trustScore < 25) return;

  setActive(true, resolved.canonical);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.tabs.update(tab.id, { url: resolved.canonical });

  chrome.tabs.onUpdated.addListener(async function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(listener);
    await chrome.runtime.sendMessage({
      type: "TOGGLE_ON",
      taskGoal: taskInput.value.trim(),
    }).catch(() => {});
    statusText.textContent = `Guiding: ${resolved?.canonical?.replace(/^https?:\/\//, "") ?? ""}`;
  });
}

// ── Active state ──────────────────────────────────────────────
function setActive(active: boolean, site: string): void {
  isActive = active;
  toggleBtn.textContent = active ? "Stop" : "Start";
  toggleBtn.classList.toggle("active", active);
  statusBar.classList.toggle("hidden", !active);

  // Update top-right indicator in popup UI
  statusIndicator.className = active ? "status-indicator active" : "status-indicator dormant";
  statusIndicator.title = active ? "Active" : "Dormant";

  // Update Chrome browser action toolbar icon (green = active, blue = dormant)
  setActionIcon(active ? "green" : "blue");

  if (active) {
    statusText.textContent = site
      ? `Guiding: ${site.replace(/^https?:\/\//, "")}`
      : "Ready";
  }
}

// ── API key ───────────────────────────────────────────────────
keyBtn.addEventListener("click", () => keyRow.classList.toggle("hidden"));

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ gc_api_key: key });
  keyRow.classList.add("hidden");
});
