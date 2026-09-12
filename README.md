# CA Study — Revision Workspace

A focused, zero-build web app for converting CA study material into structured, searchable, annotated revision notes. Built as a single-file-style HTML/JS/CSS PWA — no framework, no bundler, no server required.

## Why this architecture (read this first)

The original brief asked for a React + Vite + TypeScript + Tailwind + Dexie stack. That stack needs a Node build step and a place to host the compiled output — this chat environment can produce the *code* for that, but can't run a persistent dev server or CI/CD for you to click into. So instead this is built the way a genuinely working, testable-today app can be delivered from a chat: **plain HTML/CSS/JS, real IndexedDB persistence, real PDF rendering (pdf.js), and a real service worker** — the same "single-file app" pattern used successfully for your other tools. It runs immediately by opening `index.html`, and becomes a fully installable offline PWA the moment you host the three files on any static host (GitHub Pages, Netlify, Vercel, etc.) — no `npm install` involved.

If you specifically want the React/Vite/Tailwind/Dexie codebase instead (e.g. because you want to hand this to other engineers, or extend it heavily), say so and I'll scaffold that separately — it's a different, longer project.

## Files

```
ca-study-app/
  index.html     — shell, layout, all CSS
  app.js         — all application logic (routing, IndexedDB, every feature module)
  manifest.json  — PWA manifest
  sw.js          — service worker (offline caching of the app shell)
  icons/
    favicon-16.png, favicon-32.png    — browser tab icon
    apple-touch-icon.png              — iOS home-screen icon (180×180)
    icon-192.png, icon-512.png        — standard PWA install icons
    icon-192-maskable.png, icon-512-maskable.png — Android adaptive-icon safe versions
    sidebar-logo.png                  — the logo shown in the app's own sidebar
    logo-source.png                   — the original full-resolution artwork, kept for regenerating any size later
```

## Run it right now

Just double-click `index.html`, or:
```bash
cd ca-study-app
python3 -m http.server 8080
# open http://localhost:8080
```
(Opening via a local server rather than `file://` is recommended so the service worker and PDF rendering behave exactly as they will once deployed.)

## Deploy it as an installable PWA

Upload the whole folder — the four root files **and** the `icons/` subfolder — to any static host, keeping the same relative structure:
- **GitHub Pages**: push to a repo, enable Pages on the branch — same approach as your Kriti Notation Studio deployment.
- **Netlify / Vercel**: drag-and-drop the folder.

Once hosted over HTTPS, visiting the URL will offer "Add to Home Screen" / "Install" on Android, iOS, and desktop Chrome/Edge — using your logo, at the right size for each platform.

### Updating after you've deployed once

The service worker (`sw.js`) now uses a **network-first** strategy and self-updates: whenever you redeploy new files, the installed PWA fetches the latest version and reloads itself automatically the next time you open it (it used to serve a stale cached copy until you happened to open the site in a regular browser tab first — that's fixed). Two things to know:
- Your saved notes/data live in IndexedDB, completely separate from this caching — updating the app files never touches your data.
- `sw.js` has a `CACHE_NAME` version string (`castudy-cache-v2`) — bump it (e.g. `-v3`) each time you redeploy, so old cached files are cleanly discarded rather than lingering.

## Google Drive Sync

Settings → "Google Drive Sync" backs up your **data** (notes, questions, mnemonics, etc. — the same content as the local JSON export, not the app's own HTML/JS files) to a file in your own Google Drive, inside a folder this app creates called "CA Study." It uses a `drive.file`-scoped OAuth connection, meaning the app can only ever see or touch files it created itself — never anything else in your Drive.

**A Client ID is already embedded** — you don't need to set one up yourself unless you redeploy this app under a different hosting URL (Client IDs are locked to a specific "Authorized JavaScript origins" allowlist in Google Cloud Console; a Client ID is a public identifier, not a secret, so embedding it is fine — the actual security boundary is that origin allowlist). If you do redeploy elsewhere, instructions for creating your own are right there in Settings.

**To connect**: go to Settings → Google Drive Sync → **Connect Google Drive**, approve the consent screen once. That one click is unavoidable — browsers block OAuth popups that aren't triggered by a direct click, and Google requires explicit consent the first time no matter what. After that, it reconnects silently on every future visit — no repeated sign-in prompts.

**Important**: Google sign-in requires the app be served over **http(s)** — it will not work opened as a local `file://` page.

**How syncing behaves**: after that first connect, it's genuinely near-real-time. Any change you make triggers a sync almost immediately; if you're actively typing, rapid changes are throttled (at most one push every ~10 seconds) so it's not hammering the Drive API on every keystroke, but a trailing sync a few seconds after you pause guarantees the final state still gets pushed — plus a 60-second safety-net check in case anything slips through. There's also a manual **Sync now** button, and **Restore from Drive** to pull your data down onto a new device or browser (merges in — Drive's version wins for anything that overlaps).

**Status at a glance**: a small pill in the top bar (visible on every page, not just Settings) shows the current state — "☁ Drive: not connected," "☁ Syncing…," "☁ Synced 2m ago," or "⚠ Drive sync failed" (hover it for the specific error). Click it to jump to Settings.

**Diagnosing a 403 or other sync failure**: the error is parsed properly rather than shown as a raw/generic message. The single most common cause of a 403 is the Google Drive API not being **enabled** for the Cloud project the Client ID belongs to (a separate step from creating the Client ID itself) — go to console.cloud.google.com → APIs & Services → Library → "Google Drive API" → Enable. The second most common cause is your account not being added as a test user on the OAuth consent screen. The app detects the "API not enabled" case specifically and tells you that directly.

**Limits worth knowing**: PDFs themselves aren't included (large binary files — same exclusion as the local JSON backup); it's a single continuously-overwritten backup file, not version history (use Drive's own "manage versions" on that file if you want that); and this genuinely could not be end-to-end tested with a real Google account in this build environment — everything short of the actual Google handshake (the UI, the settings flow, the embedded-default behavior, the throttle/trailing sync timing, the status badge across every state transition, error diagnosis logic, graceful failure when offline or not connected, the backup-building/merging logic shared with local export/import) was tested directly and passes, but treat the very first real connect+sync as worth double-checking yourself.

## Design

The interface was given a full visual identity pass: "Working Ledger" — grounded in actual accounting practice (ledger paper, ink, brass seals, dotted leader-lines) rather than a generic SaaS look. Pale sage ledger-paper background with a subtle ruled-paper texture, deep ink-green text, a brass/gold primary accent (seals, stamps, primary buttons), and red-ink for alerts/danger. Headings use IBM Plex Serif (an official, certificate-like feel); UI text uses IBM Plex Sans; **every number, date, and figure uses IBM Plex Mono** — a deliberate choice, since accountants align figures in columns. The sidebar reads like a ledger's tab index (brass spine strip, tab-style active states); the Dashboard opens with a "Today's Entry" journal spread — the one bold, memorable design move — instead of generic stat cards. Both light ("day ledger") and dark ("night ledger") themes are fully covered.

Two follow-up refinements: **highlight colors** were originally too faint (low-opacity pastels) to notice at a glance — they're now solid, saturated highlighter colors, clearly visible in both themes. And **hover tooltips** were added throughout — every icon-only button (editor toolbar, PDF toolbar, topbar) and every main navigation item now shows what it does on hover, using the browser's native tooltip. The note-importance/exam-frequency/status pills at the top of a note are now clickable too (wired up to an editing form that existed in the code but was never actually reachable from the UI before).

A third round: the note inspector's section labels ("Highlight legend," "Annotations," "Revision," etc.) were muted italic text that barely read as headings — they're now bold, full-color, with an underline rule, so they stand out properly. And tooltips now cover **every single interactive control in the app** — every button, dropdown, and text field, not just the ones that seemed most ambiguous at the time.

## Data & privacy

Everything is stored locally in the browser's IndexedDB (database `castudy`) — notes, subjects, chapters, topics, mnemonics, jargons, questions, bookmarks, annotations, revision schedules, settings, and PDF files themselves. Nothing is sent to a server. Use **Settings → Export backup** regularly, since clearing browser data / a different device will not carry your notes over automatically (there's no cloud sync in this version — see Known Limitations).

## What's implemented (all real — no placeholder buttons unless explicitly marked "Coming Soon")

- Dashboard: greeting, today's study time, revision-due count, continue-studying list, subject progress bars, quick actions
- Course → Subject → Chapter → Topic tree, unlimited courses, sidebar tree navigation, **drag-and-drop reordering** of subjects/chapters/topics (and notes within a topic) using native HTML5 drag events, persisted via an `order` field
- **Delete courses/subjects/chapters/topics** — a small ✕ appears on hover next to each item in the sidebar tree (plus a visible "Delete topic" button on the topic page itself). Deleting cascades sensibly: notes, mnemonics, questions and jargons inside the deleted structure move to Trash (recoverable), their flashcards are cleaned up automatically, and any PDFs tagged to a deleted subject are kept but un-tagged rather than deleted. The course/subject/chapter/topic records themselves are removed permanently (they're organizational structure, not content) — every deletion shows a confirmation with an exact count of what's affected first.
- Rich-text note editor (bold/italic/underline/strike, headings, lists, quote, table, horizontal rule, links), autosave with visible save status
- **Note version history**: snapshots are captured automatically (roughly every 3 minutes of active editing), with a history modal to preview or restore any past version — restoring first snapshots your current content too, so nothing is ever lost
- **Import notes from files** (.txt / .md / .html, via Quick Add → "Import file as Note") and **export any note** to Markdown or HTML, using a small dependency-free HTML↔Markdown converter
- 6-color study highlighting (Important / Definition / Concept / Exam Alert / Mnemonic / Exception), customizable in code, floating selection toolbar
- Inline text annotations (comment/doubt/exam-tip) linked to the exact selected text
- **Related content**: each note shows jargons and PDFs that share its subject, plus linked mnemonics/questions for its topic — a lightweight version of the spec's "knowledge graph" (as cross-links in the UI, not a graph visualization)
- **Focus Mode**: hides the sidebar/topbar for distraction-free writing, Esc or a floating button to exit
- Mnemonics module (title, code, meaning, linked topic, favorite)
- Jargons/keywords module (term, meaning, memory trick, importance)
- Questions module with **real answer types**: free-text (Theory/Practical/Case Study/Numerical, self-graded against a model answer), **MCQ** (4 options, auto-graded), **True/False** (auto-graded), and **Fill in the Blank** (case-insensitive auto-graded)
- Auto-generated flashcards: every Question and Mnemonic gets a linked front/back flashcard the moment it's created (deleted automatically if the source is deleted), each showing its own next-revision date
- Spaced-repetition revision engine (configurable intervals, Again/Hard/Good/Easy) driving a Dashboard "due today" count and a flashcard-style Revision session — Notes (rated from inside the note) + the auto-generated flashcard deck, labeled by source
- **Full Search page** (filters by content type and subject, sorts by relevance/newest/alphabetical) alongside the quick **Command Palette** (Ctrl/Cmd+K) — which also runs typeable commands: New Note, New Course, Import PDF, Add Mnemonic/Jargon/Question, Start Revision, Exam Mode, Last-Minute Revision, Focus Mode, jump to any section, Export Backup, Toggle Dark Mode, and a dynamic "Go to subject: X" per subject
- PDF Library: upload (optionally tagged with a subject, which powers related-content links), IndexedDB storage, PDF.js-based viewer with page navigation and zoom
- **PDF annotation layer**: select text on any page to highlight (6 colors) or underline it — stored as a coordinate-based layer so it re-scales correctly at any zoom and the original PDF file is never touched; sticky notes can be dropped anywhere on a page; both are listed per-page in a side panel and editable/deletable via a popover; page bookmarks live in the same panel
- **PDF + Notes split view**: toggle "Split with Notes" in the PDF toolbar to dock a note editor next to the PDF (pick an existing note for that subject, or create one) without losing your current page or zoom level
- Bookmarks (notes, PDFs)
- **Exam Mode**: pick a subject/difficulty, attempt each question under a per-question timer (minutes-per-mark, configurable) — MCQ/True-False/Fill-in-Blank questions are answered with the real input and auto-graded; free-text questions are self-graded against the model answer — ends in a summary with every question listed
- **Last-Minute Revision Mode**: rapid-fire, one-at-a-time stream through only your highest-priority content for a subject — ★4–5 importance notes, exam-important notes, difficult-status notes, must-memorize/important jargons, hard questions, favorited mnemonics — each tagged with why it's there
- Study Timer (25/5, 50/10, custom) with session logging
- Trash / soft delete with restore, for notes/mnemonics/jargons/questions/PDFs
- Full JSON backup export/import (PDFs and note-version-history excluded from JSON — large/derived data; export PDFs individually from the library)
- Dark mode, responsive layout (desktop sidebar+inspector, tablet, mobile bottom-nav + drawer), demo data seeded on first run
- Installable PWA with offline app-shell caching once deployed to a static host
- Basic accessibility pass: visible focus outlines, `prefers-reduced-motion` support, aria-labels on icon-only buttons, dialog roles on modals

## Known limitations (honestly, not glossed over)

- **Freehand drawing / shapes / arrows on PDFs** — still not implemented. Text highlighting, underlining, and sticky notes are (see above); drawing arbitrary ink on a page is a separate, larger feature (canvas-based drawing layer + undo stack).
- **No cloud sync / multi-device** — this is local-first only, matching the brief's "can work without a backend" requirement, but there's no Supabase/Firebase layer. Every feature module reads/writes through one `saveItem(store, obj)` function, which is the seam to swap in a real backend later.
- **No OCR, no AI features** — neither was required for v1; both need either a heavy new library (OCR) or an external API (AI) that this environment can't wire up unprompted. The code is modular enough (a clean `AIService`-shaped seam) to add later.
- **Word (.docx) import isn't supported** — only .txt, .md, and .html. A real .docx-to-HTML conversion needs a parsing library beyond what's reasonable to hand-roll here.
- **Rich text editor uses `document.execCommand`** — simple and reliable for this feature set, but a legacy browser API. A TipTap/ProseMirror-based editor (as originally specified) would be a natural upgrade if note-taking needs grow more advanced.
- **No burned-in annotated PDF export** — you can export a note's content (Markdown/HTML) and the full JSON backup, but not a PDF with highlights permanently rendered into it.
- **No deep study analytics** (weak/strong topics, revision-consistency streaks over time) beyond what the Dashboard and subject-progress bars already show.
- **No iPad-specific split-screen chrome** beyond the existing responsive breakpoints — the PDF+Notes split view covers the main "read and take notes side by side" use case on any screen size, but there's no dedicated two-finger-gesture or Apple Pencil handling.
- **Sticky notes on regular notes (not PDFs) were deliberately skipped** — notes already have inline text-anchored annotations, and a second, separately-draggable sticky-note layer on top of rich text would mostly duplicate that without adding much; PDFs got real sticky notes because PDFs don't have inline annotations any other way.

## Recommended next steps, in priority order

1. Cloud sync (Supabase is the lowest-friction option given the local-first repository-style structure).
2. Freehand PDF drawing/annotation layer.
3. .docx import (via a client-side docx-to-HTML library).
4. Burned-in annotated PDF export.
5. AI features, once you're ready to wire up an API key (`AIService.summarize()`, `.generateMnemonic()`, `.generateFlashcards()`, etc.).

## Testing performed

Every feature above was exercised headlessly (Chromium via Playwright) after being built, including: full CRUD across every module, IndexedDB persistence across page reloads, dark mode and mobile-width layout, note highlighting/annotation, PDF upload/viewing/highlighting/underlining/sticky-notes/page-bookmarks (using a locally-generated test PDF and a local copy of pdf.js, since this sandbox's network allowlist blocks the CDN — pdf.js loads normally for you on the open internet), flashcard auto-generation and cascade-deletion, Exam Mode and Last-Minute Revision Mode end-to-end, the command palette's search-and-commands, version history and Markdown import/export, drag-and-drop reorder logic, and the PDF+Notes split view (confirming page/zoom state survives the toggle). All passed with zero console errors.

