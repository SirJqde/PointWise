# GuideCursor 🧭

> **Privacy-first, human-in-the-loop cursor co-pilot** — a toggleable browser extension that guides users through complex online tasks by spotlighting the next required step, without ever clicking, typing, or hijacking input.

---

## Core Guarantees

| Property | How |
|---|---|
| ✋ You always drive | The agent only *points*. Any mouse move or keystroke instantly withdraws cursor guidance. |
| 🔒 Zero PII to AI | All form values are scrubbed locally before the page snapshot leaves your browser. |
| 🛑 Anti-bot compliant | CAPTCHAs, OTPs, payments, and legal declarations trigger a mandatory pause gate. |
| 🌐 Phishing-resistant | Sessions start with a verified, intent-driven domain resolution — no raw URL typing required. |
| 📄 Client-side files | File validation (MIME, size, dimensions, resize) runs entirely in browser memory. |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Chrome ≥ 120 (MV3 support)

### Install & Build

```bash
cd guidecursor
npm install
npm run build        # outputs to dist/
```

### Load the extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

### Add your Gemini API key
In Chrome DevTools console (on any page):
```js
chrome.storage.local.set({ gc_api_key: "YOUR_KEY_HERE" })
```

### Run tests
```bash
npm test
```

---

## Architecture

See [`GuideCursor_Architecture.md`](../brain/GuideCursor_Architecture.md) for the full design document with system diagrams, module breakdown, threat model, and roadmap.

### Key modules

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest — minimal permissions, no `<all_urls>` |
| `lib/types.ts` | Shared TypeScript types across all modules |
| `lib/scrubber.ts` | PII regex scrubber — runs before any snapshot leaves the tab |
| `lib/sensitivity.ts` | Classifies elements into sensitivity classes for pause gate |
| `lib/router.ts` | Intent → verified canonical domain resolver (DNS-over-HTTPS) |
| `lib/snapshot.ts` | Builds scrubbed AXTree JSON snapshot |
| `lib/session-graph.ts` | Multi-domain session persistence (`chrome.storage.session`) |
| `content/content-main.ts` | Per-tab content script — orchestrates all content-side logic |
| `content/overlay.ts` | Shadow DOM virtual cursor + dialogue box |
| `content/file-validator.ts` | Pre-flight file validator (magic bytes, size, dims, local resize) |
| `background/service-worker.ts` | Background coordinator — session, navigation, AI bridge |
| `popup/popup.ts` | Extension popup — intent capture, trust UI, session controls |
| `sandbox/sandbox.ts` | Isolated iframe — calls AI model with scrubbed snapshots |

---

## Privacy Model

```
User input → Content Script (PII scrubbed) → Sandbox iframe → Gemini API
                                ↑ Nothing typed by user ever reaches here
```

- `input[type=password]` and all sensitive fields are excluded from snapshots at collection time.
- File bytes are read by `FileReader` into renderer memory only — never uploaded anywhere.
- Session state lives in `chrome.storage.session` (memory-only, cleared on browser close).

---

## Roadmap

- **v0.1** — Core overlay + withdrawal logic
- **v0.2** — Intent router + domain verification
- **v0.3** — Observe-Reason-Act engine + Gemini Flash integration
- **v0.4** — Sensitivity pause gate + multi-domain session
- **v0.5** — Pre-flight file validator (MIME + size + dims + resize)
- **v1.0** — Firefox port + full E2E test suite (Playwright)

---

## Contributing

This project enforces the following invariants by code review policy:
- No `element.click()`, `element.dispatchEvent()`, or any simulated user input
- No `fetch()` or `XMLHttpRequest` with user-typed form values
- No `chrome.storage.local` writes containing file bytes or typed passwords
- No `<all_urls>` host permissions
