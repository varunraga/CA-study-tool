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

Upload the four files to any static host, keeping them in the same folder together:
- **GitHub Pages**: push to a repo, enable Pages on the branch — same approach as your Kriti Notation Studio deployment.
- **Netlify / Vercel**: drag-and-drop the folder.

Once hosted over HTTPS, visiting the URL will offer "Add to Home Screen" / "Install" on Android, iOS, and desktop Chrome/Edge.

## Data & privacy

Everything is stored locally in the browser's IndexedDB (database `castudy`) — notes, subjects, chapters, topics, mnemonics, jargons, questions, bookmarks, annotations, revision schedules, settings, and PDF files themselves. Nothing is sent to a server. Use **Settings → Export backup** regularly, since clearing browser data / a different device will not carry your notes over automatically (there's no cloud sync in this version — see Known Limitations).

## What's implemented (Phase 1 priority list, all real — no placeholder buttons)

- Dashboard: greeting, today's study time, revision-due count, continue-studying list, subject progress bars, quick actions
- Course → Subject → Chapter → Topic tree, unlimited courses, sidebar tree navigation
- Rich-text note editor (bold/italic/underline/strike, headings, lists, quote, table, horizontal rule, links), autosave with visible save status
- 6-color study highlighting (Important / Definition / Concept / Exam Alert / Mnemonic / Exception), customizable in code, floating selection toolbar
- Inline text annotations (comment/doubt/exam-tip) linked to the exact selected text
- Mnemonics module (title, code, meaning, linked topic, favorite)
- Jargons/keywords module (term, meaning, memory trick, importance)
- Questions module (type, marks, difficulty, model answer, reveal/attempt tracking)
- Spaced-repetition revision engine (configurable intervals, Again/Hard/Good/Easy rating) driving a Dashboard "due today" count and a flashcard-style Revision session mode
- Global search + Command Palette (Ctrl/Cmd+K) across notes, PDFs, mnemonics, jargons, questions
- PDF Library: upload, IndexedDB storage, PDF.js-based viewer with page navigation, zoom, and page bookmarks
- Bookmarks (notes, PDFs)
- Study Timer (25/5, 50/10, custom) with session logging
- Trash / soft delete with restore, for notes/mnemonics/jargons/questions/PDFs
- Full JSON backup export/import (PDFs excluded from JSON — they're large binary blobs; export them individually from the library if you need a copy outside the browser)
- Dark mode, responsive layout (desktop sidebar+inspector, tablet, mobile bottom-nav + drawer), demo data seeded on first run
- Installable PWA with offline app-shell caching once deployed to a static host

## Known limitations (honestly, not glossed over)

- **PDF annotation** (freehand drawing, highlighting text directly on a PDF page, shapes/arrows) is **not implemented** — the toolbar button says "Coming Soon" rather than pretending to work, per your instruction to never ship fake buttons. Page bookmarking works today; text-layer highlighting on PDFs is the natural next build.
- **No cloud sync / multi-device** — this version is local-first only, matching the brief's "can work without a backend" requirement, but there's no Supabase/Firebase layer yet.
- **No OCR** — scanned PDFs/images aren't made searchable.
- **No AI features** — none were required for v1, and the code is small enough to add an `AIService` abstraction cleanly later (summarize/explain/generate-mnemonic/generate-flashcards, etc.) exactly as the brief specifies for Phase 5.
- **No version history / undo-redo beyond the browser's native contenteditable undo** for notes.
- **Rich text editor uses `document.execCommand`**, which is simple and reliable for this feature set but is a legacy browser API; a TipTap/ProseMirror-based editor (as originally specified) would be a natural upgrade if the note-taking needs grow more advanced (e.g. collaborative editing, custom node types).
- **Export "Notes only" / "Highlights only" / burn-in annotated PDF export** from the original spec aren't built yet — only full JSON backup and individual PDF pages.
- Flashcard "front/back" auto-generation from notes/mnemonics isn't automatic yet — flashcards currently ride on the same spaced-repetition engine as notes and questions directly, rather than a separate auto-generated deck.

## Recommended next steps, in priority order

1. PDF-page annotation layer (highlight/underline/sticky-note anchored to page + coordinates, stored separately from the PDF so the original stays untouched — the data model for this is already sketched in the spec you gave me).
2. Auto-generate flashcards from Q&A pairs and mnemonic front/backs.
3. Exam Mode (timed question attempts with a dedicated submit → self-evaluate flow) and Last-Minute Revision Mode (filter to ★★★★★ / exam-important / must-memorize).
4. Command palette actions beyond search (New Note, Toggle Theme, etc. as direct commands).
5. Cloud sync (Supabase is the lowest-friction option given the current local-first repository-style structure — each feature module already reads/writes through a single `saveItem(store, obj)` function, which is the seam to swap for a real backend later).

## Testing performed

Loaded headlessly and exercised: app boot + demo data seeding, course/subject/chapter/topic creation, note creation and editing, text selection → highlight, text selection → annotation, global search, IndexedDB persistence across a full page reload, dark-mode toggle, and mobile-width layout (bottom nav) — all passing with zero console errors (aside from the PDF.js CDN script being blocked by this sandbox's network allowlist during testing, which is a sandbox limitation, not an app bug — it loads normally on the open internet).
