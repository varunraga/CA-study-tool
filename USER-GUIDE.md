# CA Study — User Guide

Everything below describes how to actually *use* the app day to day. (For architecture, tech stack and known limitations, see `README.md` instead — this file is the "how do I..." companion to that one.)

---

## 1. Opening the app & how saving works

Open `index.html` in a browser (double-click it, or host the folder on a static server — see README). No login, no account, no internet required after the first load.

**Everything autosaves.** There is no "Save" button anywhere in the app, because you don't need one:

- **Notes** save automatically ~600ms after you stop typing. Look at the bottom of the editor — it says "Saving…" then "Saved · [time]" once it's done. If you switch away, close the tab, or the app gets backgrounded before that 600ms is up, whatever you just typed still saves immediately at that moment — this used to be a real gap (a few hundred milliseconds of edits could be lost on mobile in particular, since backgrounded tabs can be suspended with no further warning), and it's fixed.
- **Every other thing you create** (a mnemonic, a question, a highlight, a bookmark, a timer session) saves the instant you confirm it — there's no separate save step.
- All of this is written to **IndexedDB**, a real database built into your browser, not just memory. Close the tab, restart your computer, come back next week — it's all still there.
- The only thing that *doesn't* survive is if you clear your browser's site data for this page, or open it in a private/incognito window and then close it. For anything you can't afford to lose, use **Settings → Export backup** regularly (see §14).

**The very first time you open the app**, with no courses set up yet, you'll get a choice: **Create Your First Course** to start from scratch, or **Explore With an Example** to load one small worked example (a GST topic with a note, mnemonic, question, and flashcards already filled in) so you can see how everything fits together before building your own. The example is completely optional and safe to delete once you've had a look — it's just there to help you get oriented, not something you're required to keep or build on.

---

## 2. Building your course structure — the Subjects hub

Everything else in the app (notes, questions, mnemonics) hangs off this structure:

```
Course  →  Subject  →  Chapter  →  Topic  →  (your notes, questions, mnemonics live here)
```

Example: `CA Intermediate → GST → Input Tax Credit → Section 16 — Eligibility`

**This is the heart of the app**, so it gets its own dedicated page — **sidebar → 📚 Subjects** (also reachable via the "Browse" button on mobile). It's a visual drill-down, not a nested list:

1. **Overview**: your courses, each showing its subjects as a full-width card grid — a single subject spans the whole row rather than sitting in a small box. Click **"+ Course"** (top right) to add a course; click **"+ Subject"** under a course to add one. Every subject gets an in-app modal to name it and **pick a color** from an 8-swatch palette. That color follows the subject everywhere as a subtle full-card tint (not just a thin strip) — its card, its progress ring, its detail page.
2. Each subject card shows a live **progress ring** (% of its notes marked "mastered") plus quick counts (chapters, topics, notes, and PDFs once you have any). **Click a card** to open that subject.
3. **Subject page**: a bigger version of the same ring, full stats, and its list of chapters. **"+ Chapter"** adds one; **"🎨 Color"** lets you change the subject's color anytime.
4. **Click a chapter** to see its topics (note/mnemonic/question/PDF counts per topic). **"+ Topic"** adds one.
5. **Click a topic** to open it — that's where you'll add notes, mnemonics, questions, **and now PDFs** for it (§9 below). Its breadcrumb at the top is clickable, so you can jump straight back to the subject or chapter without retracing your steps — and the same clickable breadcrumb now appears when you're inside an individual note or PDF too, so you're never more than one click from any level (topic, chapter, subject, or the Subjects hub itself).

**Reordering**: click and drag any subject card, chapter row, topic row, or note (within its topic) to reorder it — or use the small **▲▼** buttons on each one if you'd rather not drag (grayed out at the top/bottom of its list). Either way, it remembers the order permanently.

**Deleting**: a small **✕** sits on every card and row. Deleting a subject/chapter/topic asks you to confirm first, and tells you exactly how much is inside it. Anything with real content (notes, mnemonics, questions, jargons) is moved to **Trash**, not destroyed — you can restore it later. See §14.

---

## 3. Adding & writing a note

Three ways to start a new note:
- From a **topic page**: click **"+ Note"**.
- From anywhere: click the **＋** icon in the top bar (Quick Add) → "New Note".
- Press **Ctrl/Cmd+N** anywhere in the app.

You'll be asked for a title and which topic it belongs to, then dropped straight into the editor.

**The toolbar** (hover any button to see exactly what it does):
`B` `I` `U` `S` — bold, italic, underline, strikethrough
`x²` — superscript, for numbering points, footnote markers, or exponents (e.g. "point 1️⃣", "x²")
**5 colored dots + a custom color swatch + "Aa"** — select text, then click a color to change its font color; the custom swatch opens your system's color picker for anything else; "Aa" resets the selection back to the default text color
`↶ Undo` `↷ Redo` — in addition to the standard Ctrl/Cmd+Z keyboard shortcut, these are explicit buttons so undo/redo is always one click away, no keyboard required
`H2` `H3` `¶` — heading, sub-heading, plain paragraph
`• List` `1. List` `❝ Quote` `―` — bullet list, numbered list, quote block, horizontal divider
`☑ Checklist` — inserts a checkbox + text item; click the checkbox to check it off (text gets a strikethrough) — click the button again for more items
`▦ Table` `🔗 Link` — insert a table, turn selected text into a link
`📋 Template` — one-click starting structures for formats you'll actually reuse: a Case Law Summary (citation/facts/issue/holding/ratio), an Amendment Tracker (before/after table), or a Rates/Thresholds Table — inserted at your cursor, so you can drop a second one in later without losing the first
`🕶 Focus` — hide the sidebar, top bar, *and* the note's own inspector panel, so the writing area expands to fill the space (press **Esc** to exit)

**Pasting images**: paste a screenshot, diagram, or photo directly into a note (Ctrl/Cmd+V after copying an image) — it's automatically resized to a reasonable width and compressed before embedding, so a big phone photo doesn't bloat the note's storage.

The same color/superscript/undo/redo toolbar is also available in the PDF "Split with Notes" editor (§10) — it's a real rich-text editor too, not just a plain text box. It's **not** available on PDF sticky notes or text annotations, which are simple one-line text prompts by design.

**Note metadata**: just below the title, click the row of pills (Importance, Exam freq, status, tags) — it's clickable (look for the "✎ edit" tag) and opens a form to set:
- **Importance** (1–5 stars)
- **Exam frequency** (low / medium / high)
- **Status** — five stages, from first study to exam-ready:
  - **learning** — first time studying this (the default for a new note)
  - **familiar** — you've been through it once, but it needs revision to solidify
  - **moderate** — not too hard, just needs a little more attention and revision
  - **difficult** — needs real practice — more time to understand, more revision
  - **mastered** — understood well, practiced enough — just last-minute revision needed
- **Tags** (comma-separated)

These aren't cosmetic — Last-Minute Revision Mode (§9) and the Dashboard use them to decide what's worth showing you.

---

## 4. Highlighting and annotating a note

Select any text inside a note. A small floating toolbar appears above your selection:
- **Six colored dots** = highlight in that color (Important/yellow, Definition/green, Concept/blue, Exam Alert/red, Mnemonic/purple, Exception/orange — shown in the "Highlight legend" on the right)
- **💬 Note** = attach a comment/doubt/exam-tip to that exact selected text, via a small dialog. It leaves a small 💬 flag right after the text; click the flag's entry under "Annotations" in the right panel to see or delete it.

Highlights and annotations are part of the note's content — they're included when you export the note, and they show up if you restore an old version (§6).

**If pasted content ever vanished right after adding an annotation**: this was a genuine bug, now fixed. Adding a "💬 Note" comment used to use a dialog that froze the whole page while open, which could interfere with a save that was already about to happen (the editor waits about half a second after you stop typing or pasting before actually saving, to avoid saving on every keystroke) — closing the dialog could end up re-displaying older content over whatever you'd just pasted. The dialog no longer freezes the page, and the save timing issue that caused this is fixed at the source.

---

## 5. Mnemonics, Jargons, and Questions

These live in their own sections (sidebar) but can also be added directly from a topic page or the note inspector.

**Mnemonics** (sidebar → Mnemonics, or "+ Add mnemonic" from a note/topic): give it a title, the memory code (e.g. "RITE"), and what each letter means. Star (★) any mnemonic to favorite it — favorites show up in Last-Minute Revision Mode.

**Jargons** (sidebar → Jargons): term, meaning, an optional memory trick, and an importance level (Normal / Important / Must Memorize). "Must Memorize" jargons also surface in Last-Minute Revision Mode.

**Questions** (sidebar → Questions, or "+ Add question" from a topic): pick a **type** when creating one — the form changes depending on what you pick:
- **Theory / Practical / Case Study / Numerical** → free-text; you'll self-grade later by comparing to a model answer you write.
- **MCQ** → type up to 4 options and mark the correct one with the radio button.
- **True/False** → pick the correct answer from a dropdown.
- **Fill in the Blank** → type the exact expected answer (checked case-insensitively).

In the Questions list, MCQ/True-False/Fill-in-the-Blank are answered directly and **auto-graded** the moment you click "Check"/select an option. Free-text questions have a "Reveal answer" button plus manual "Mark correct/incorrect".

**Every Mnemonic and Question you create automatically gets a linked flashcard** — you don't do anything extra for this; it's how they get pulled into spaced-repetition revision (§8).

**Working on several at once**: on the Questions page, and on a topic's Notes list, click **"Select"** to turn on checkboxes. Pick several, then **move them all to a different topic, tag them all at once** (notes only), or **delete them all** — one action instead of repeating it one at a time. Click "Select" again (or finish the action) to exit.

**Compact vs. comfortable views**: on the Questions page and the PDF Library, a density toggle switches between the full card layout and a denser list that fits more on screen — useful once either list gets long. Your choice is remembered.

---

## 6. Note version history

The app quietly snapshots a note roughly every 3 minutes while you're actively editing it. To use this:
1. Open a note → in the right panel, under "Export & history", click **"🕘 Version history"**.
2. You'll see a list of past versions with a timestamp. **Preview** shows you that version's content without touching your current note. **Restore** replaces your current content with that version — but first it automatically snapshots what you currently have, so nothing is ever lost even if you restore by mistake.

---

## 6a. Quick Capture & Inbox

For a stray thought mid-PDF-read that doesn't belong to a specific topic yet — press **Ctrl/Cmd+J** from anywhere in the app for a small floating box, type it, and it's saved instantly. No need to stop what you're doing to pick a topic first.

Everything you jot down this way lands in **sidebar → Inbox**, with a badge showing how many are waiting. From there, click **"File into topic"** on any capture to turn it into a real note (the title is pre-filled from what you typed, just pick a topic), or **Discard** it if it turned out not to matter. Filed captures disappear from the Inbox; discarded ones are gone for good — this isn't a Trash-style safety net, so only discard what you're sure about.

---

## 7. Importing and exporting notes

**Import a file as a note**: click the **＋** Quick Add icon → "Import file as Note" → choose a `.txt`, `.md`, or `.html` file. You'll be asked for a title and topic, then it's converted into a normal editable note (Markdown headings/bold/lists/quotes are converted properly; plain text is wrapped into paragraphs).

**Export a single note**: open it → right panel → "Export & history" → **⬇ Markdown** or **⬇ HTML** downloads that note as a standalone file.

**Export everything**: see §14 (Settings → Backup).

---

## 8. Revision (spaced repetition), Cloze Review, and Quiz Me

The **Revision** section (sidebar, with a badge showing how many are due) is where notes and flashcards you've studied before come back to you on a schedule.

- **Notes**: rate yourself Again/Good/Easy from inside the note (right panel → "Revision"). This is the *only* way a note enters the revision queue — a brand-new note won't nag you until you've rated it once.
- **Flashcards** (from Questions and Mnemonics, or created manually — see below): these *do* show up immediately the first time, since there's no separate "note page" to rate them from first.
- Click **"Start Revision Session"** on the Revision page to go through everything due, one card at a time, front-then-flip-to-answer, rating each Again/Hard/Good/Easy.
- **Mixed across subjects, not blocked by one**: a session interleaves items from different subjects instead of running through one subject's due items in a block before moving to the next — mixing subjects during practice is more effective for retention than studying one at a time. Last-Minute Revision Mode (§9) does the same.
- The interval schedule (how many days until the next review) is configurable in **Settings** — defaults to 1, 3, 7, 14, 30 days, getting easier or harder based on how you rate each card.

**Manual flashcards**: not every fact fits neatly under a mnemonic or a question. Click **"+ Flashcard"** on any topic page to create a standalone flashcard directly — it joins the same revision queue as everything else.

**Cloze Review** — turning your own highlights into recall practice: open any note that has highlighted text and click **"Cloze Review"**. Each highlight becomes a fill-in-the-blank card: the sentence it's in, with that word blanked out (any other highlights in the same sentence are shown as plain text, so they don't give the answer away). Reading a highlight is recognition; being asked to recall the blanked word is retrieval, which sticks much better. Click through, mark yourself right or wrong, see your score at the end.

**Quiz Me** — a mixed self-test for one topic: click **"Quiz me"** on any topic page to get a shuffled session pulling together that topic's mnemonics and questions, plus jargon terms from the same subject, all in one flip-card session with a score at the end. Good for a quick "do I actually know this topic" check without setting up a full revision session.

---

## 9. Exam Mode & Last-Minute Revision Mode

**Exam Mode** (sidebar): pick a subject and/or difficulty, set minutes-per-mark (how much time per question), and start. Each question gets its own countdown timer. MCQ/True-False/Fill-in-the-Blank are answered with the real input and graded automatically the instant you submit; free-text questions show your answer next to the model answer and you self-grade — and while you write, a live word count and rough page estimate (~100 words per handwritten page) sits under the box, since writing a full descriptive answer under time pressure is its own skill worth practicing. Ends with a summary of everything attempted.

**Last-Minute Revision Mode** (sidebar): pick a subject (or "All"), and it streams through *only* your highest-priority material, one item at a time — ★4–5 notes, exam-important notes, anything marked "difficult," must-memorize jargons, hard questions, and favorited mnemonics — mixed across subjects the same way Revision is (§8). Use Next/Prev to move through it. This is meant for the night before an exam, not day-to-day study.

---

## 10. PDFs — in your topics, and in the PDF Library

**Two ways to upload**: click **"+ Import PDF"** either from **sidebar → PDF Library**, or right from inside a **Topic page** (§2 above), which pre-fills that topic (and its chapter and subject) for you. Either way, you'll be asked for a title and, optionally, a **subject → chapter → topic** (each dropdown narrows the next one down). Tagging it all the way to a topic means the PDF shows up right there on that topic's page, alongside its notes — not just in the separate library. Tagging is optional at every level; an untagged PDF just lives in the library.

**Reading**: click any PDF (from its topic, or from the Library) to open the viewer. Prev/Next page, zoom in/out (−/+), and the page counter are in the toolbar. A breadcrumb at the top lets you jump straight back to its subject.

**True full-screen by default**: opening a PDF automatically hides both the sidebar and the top bar, giving it the entire browser window for a genuinely full-screen reading view — you don't need to turn this on, it's just how PDFs open now. Click the **☰** button next to the breadcrumb if you want to peek at the sidebar without leaving the PDF; it stays open across page turns until you click it again. Leaving the PDF automatically restores the normal layout.

**Two PDF views, one click apart** — the **Full Screen** toggle in the toolbar switches between them:
- **Editor view** (default): everything — draw, sticky notes, split-with-notes, export, undo/redo, bookmark, extract/merge, in-PDF search, and the right-hand panel (highlight legend, this page's marks, bookmarked pages).
- **Reading view**: the toolbar strips down to just Prev/Next, zoom, and Find, the side panel disappears, and the page widens to use the freed-up space. You can still select text and highlight/underline it here — that's core reading, not an "extra." If Draw, Split with Notes, or Sticky Note mode was active, it turns itself off automatically when you switch.

**Highlighting text on a PDF**: select text on the page exactly like you would in a note — a floating toolbar appears with 6 real color swatches (matching your actual configured highlight colors, not a fixed set), an underline option, and a comment button. These are stored as a separate layer keyed to the page, so **your original PDF file is never modified**, and everything re-scales correctly at any zoom level.

**Notes written right on the page**: when you add a comment to selected text, it doesn't just sit in a side panel — it appears as a small handwritten-style note in red, directly above the line it's attached to, like a note pencilled into a textbook's margin. Short comments show in full; longer ones truncate to a few words and **expand right in place when you tap them** — no popup, no navigating away. Tap Edit or Delete right there in the expanded note, press **Esc**, or tap anywhere else on the page to close it again. Sticky notes (below) get the same treatment: a small pin plus its text, right on the page.

**Sticky notes on a PDF**: click **Sticky note** in the toolbar (it highlights to show it's armed), then tap anywhere on the page — you'll be prompted for the note text, and it appears right there, same as a margin note.

**Drawing on a PDF**: click **Draw** in the toolbar to open the drawing tools — Pen (freehand), Arrow, or Rect, plus 5 color dots. Draw with your mouse or finger directly on the page. "Clear page" removes everything drawn on the current page (asks to confirm). Every drawing is listed in the "This page" panel too. Drawings are stored separately from the PDF and re-scale correctly at any zoom. Click "Done" to exit drawing mode.

**Undo / Redo**: covers every kind of mark on a page — highlights, underlines, sticky notes, drawings — including deletions (delete a highlight, hit Undo, it's back).

**Finding text in a PDF**: click **Find** in the toolbar to search every page of the current PDF at once — not just the one you're on. Jump straight to the first match, then step through others with the arrows.

**Splitting and merging PDFs**: click **"Extract Pages"** in the viewer toolbar to pull a page range out of the current PDF into a brand-new PDF in your library — handy for splitting one huge combined study-material file into per-chapter files that map to your topic structure. From the PDF Library page, **"Merge PDFs"** combines two existing PDFs into one new one, pages from the first followed by the second. Both create a new library entry; your originals are never touched.

**Exporting an annotated copy**: click **"Export PDF"** to download a copy with every highlight, underline, and drawing permanently burned into the pages — a real PDF you can open anywhere, with text still selectable. Your library copy is never modified.

**Page bookmarks**: click **"Bookmark page"** to save your current page for quick return. All of a PDF's highlights, sticky notes, and bookmarks for the *current page* are listed in the right-hand panel.

**"Split with Notes"**: docks a note editor right beside the PDF, so you can take notes while reading without losing your page or zoom level.

---

## 11. Bookmarks

Any note or PDF can be bookmarked (look for the Bookmark button on the note page, or bookmark a PDF page as above). All your bookmarks live under **sidebar → Bookmarks**, click any to jump straight there.

---

## 12. Search & the Command Palette

Press **Ctrl/Cmd+K** anywhere, or click the search bar in the top bar. This one box does two things:

- **Type a command** — "New Note", "Toggle Dark Mode", "Exam Mode", "Export Backup", or a dynamic **"Go to subject: [name]"** for each subject you've created — and press Enter/click it to run it immediately.
- **Type anything else** and it searches notes, PDFs, mnemonics, jargons, and questions live as you type.

For more control — filtering by content type or subject, sorting by newest/alphabetical — use **sidebar → Search & Filters** instead, which is a full page rather than a quick popup.

---

## 13. Analytics

Sidebar → Analytics. This doesn't need any separate setup — it's entirely built from things you're already doing:

- **Streaks**: current and longest consecutive-day streaks, based on any day you either logged a Study Timer session or rated a note/flashcard during revision. A **30-day heatmap** shows which of the last 30 days had activity (filled square) or didn't.
- **Weak topics**: topics ranked by how many notes you've marked "difficult" plus how many questions in that topic you got wrong — the more of both, the higher it ranks. Click any topic card to jump straight to it.
- **Strong topics**: the mirror image — ranked by mastered notes plus correctly-answered questions.
- **Accuracy by difficulty**: a bar for Easy/Medium/Hard showing what % of attempted questions at that level you got right.
- **Time by subject**: a donut chart of Study Timer minutes per subject — only fills in once you start tagging a subject when you use the timer (§16), since a session doesn't have to be tagged to count.
- **Subject breakdown**: for each subject, what % of its notes are "mastered" and what % of attempted questions you got correct.

Since this relies on your Note status (learning/familiar/moderate/difficult/mastered) and Question status (correct/incorrect), the more consistently you keep those updated as you actually study, the more useful this page gets.

---

## 14. Trash

Sidebar → Trash. Anything deleted (a note, mnemonic, jargon, question, or PDF, including everything swept up by a subject/chapter/topic cascade-delete) lands here first. **Restore** brings it back exactly as it was; **Delete forever** removes it permanently; **Empty Trash** clears everything at once. Nothing is ever silently destroyed without passing through here first (except the course/subject/chapter/topic structural records themselves, which are organizational, not content).

---

## 15. Settings — theme, revision intervals, backup

Sidebar → Settings:

- **Theme**: dark (the default), light, or sepia — a warm-paper option made for long PDF reading sessions, easier on the eyes than pure dark or pure white over hours. Toggle dark/light instantly from the 🌓 icon in the top bar; pick sepia from this dropdown.
- **Revision intervals**: the spaced-repetition day-gaps (default `1, 3, 7, 14, 30`) — edit as a comma-separated list.
- **Backup & Restore**:
  - **⬇ Export backup (.json)** downloads everything — notes, subjects, questions, mnemonics, jargons, revision data, settings, annotations, bookmarks. Do this regularly; it's your safety net.
  - **⬆ Restore from backup** merges a previously exported JSON file back in.
  - Note: PDFs themselves aren't included in this JSON file (they're large binary files, and one huge file isn't a great single-download format) — export a PDF individually from its viewer if you need a copy outside the browser. **Google Drive Sync, below, is different — it does carry your PDFs.**
- **Readable Exports**: unlike the JSON backup (meant for restoring back into this app), these are plain Markdown files meant for reading, printing, or sharing:
  - **⬇ All notes (Markdown)** — every note in one file, organized by subject then chapter.
  - **⬇ All highlights & annotations (Markdown)** — every note highlight and comment, every PDF highlight/underline/sticky note, and a count of drawings per PDF, grouped by type in one file.
- **Google Drive Sync**: an alternative (or addition) to manual export/import — keeps your data automatically backed up to your own Google Drive, **PDFs included** (each one as its own file in your Drive folder, not squeezed into the JSON). A Client ID is already built in, so just click **Connect Google Drive** and approve the one-time consent screen (that single click is unavoidable — Google requires it). After that, it stays connected automatically on every future visit and syncs near-real-time: any change pushes within seconds, with light throttling during rapid typing so it's not hammering the API on every keystroke. A small status pill in the top bar — visible on every page — always shows the current state ("Synced 2m ago," "Syncing…," "not connected," or a failure warning you can hover for details); click it to jump to Settings. Manual **Sync now** and **Restore from Drive** buttons are also there for immediate control or pulling your data onto a different device. It only ever touches files it creates itself, inside a "CA Study" folder — never the rest of your Drive. Note: this needs the app to be hosted (http/https), not just opened as a local file — Google's sign-in won't work otherwise.
  - **If a PDF you uploaded didn't show up after reopening on another device**: this was a real, significant bug, now properly fixed. PDFs previously weren't included in Drive sync at all — only their titles made it across, never the actual file. Each PDF now uploads as its own file in your Drive folder the first time it syncs, and downloads automatically on any other device that has the listing but not yet the file itself, verified byte-for-byte. This covers PDFs in Trash too, even one trashed on its very first sync before another device ever saw it live.
  - **If you've ever had content disappear after syncing**: this was a real bug, now fixed. If you have the app open in more than one place at once — the installed app plus a regular browser tab is the easy way this happens without realizing it — each one used to push its own copy straight over whatever was on Drive, with no check for whether the other one had added something newer first. Every sync now pulls Drive's current content in first and merges it, so a sync can only add to what's there, never erase it, regardless of which tab or device syncs last.
  - **If a deleted highlight, underline, sticky note, or anything else ever came back on its own a moment after you deleted it**: this was the direct cost of the fix above, and it's fixed too — and this now correctly removes the item everywhere it's synced, not just on the device you deleted it from. That "pull before push" behavior had no way to tell Drive about a deletion, so the very next sync would just pull the old copy back down and undo it. Deletions now leave a record behind (invisibly, not something you manage) that every future sync checks first, so something you delete stays deleted — synced or not, no matter how many tabs or devices are involved.
  - **If a PDF ever jumped back to page 1 while you were reading or annotating it**: that was a side effect of the fix above, caught and fixed in the same round. Background syncs fire automatically after almost any edit, and the merge step was forcing the whole screen to redraw — including, if you happened to be on a PDF, resetting it to page 1. Background syncs are now silent about it; only the explicit "Restore from Drive" button (where you're deliberately asking to see new data) still refreshes the screen right away.
  - **If your storage ever failed to open at all** (some private/incognito modes block it, or storage is full): you'll now see a plain explanation of what happened and what to try, instead of a blank page with no clue why.

---

## 16. Study Timer & Focus Mode

**Study Timer** (sidebar): Pomodoro-style — 25/5, 50/10, or a custom duration. Start/Reset. Completed sessions are logged and feed into the Dashboard's "study time today" figure.

**Focus Mode**: from inside a note, click **"🕶 Focus"** in the editor toolbar. This hides the sidebar, top bar, and the note's own right-hand inspector panel — the writing area expands to use the freed-up space, rather than just floating in a narrower page. Press **Esc** or click the floating "✕ Exit Focus" button to come back.

---

## 17. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Open search / command palette |
| `Ctrl/Cmd + N` | New note |
| `Ctrl/Cmd + J` | Quick Capture — jot a stray thought from anywhere, file it into a topic later (§7a) |
| `?` | Show this shortcuts list in-app (ignored while you're typing, so it doesn't interfere with typing a literal "?") |
| `Esc` | Close whatever's open — a modal, the command palette, Quick Capture, an expanded PDF margin note, or exit Focus Mode |

All of these work from anywhere in the app, including while a PDF is open. There's also a **"?" button in the top bar** if you'd rather click than remember the key.

(Formatting shortcuts like Ctrl/Cmd+B for bold work naturally inside the note editor via the browser's own text-editing behavior.)

---

## 18. Installing it as an app (PWA)

Opened as a plain file, it works, but a couple of things (installing to your home screen, full offline caching) need it to be **hosted**, not just opened locally. Upload the four files (`index.html`, `app.js`, `manifest.json`, `sw.js`) together to any static host — GitHub Pages, Netlify, Vercel — and once you visit it over HTTPS, your browser will offer "Install" or "Add to Home Screen".

---

## A typical day, end to end

1. Open the app → Dashboard shows today's entry (study time, notes in the ledger, revision due).
2. Click "Start Revision" if anything's due, or go straight to a topic.
3. Open a PDF of your study material, tag it with the right subject on upload.
4. Highlight key lines as you read; drop a sticky note on anything you want to come back to.
5. Toggle "Split with Notes" and write your own structured note alongside it — or switch to the note editor directly and type it up, highlighting important lines and attaching a mnemonic for anything memory-heavy.
6. Add a question or two based on what you just read (mark it MCQ if it's objective, Theory if it needs a written answer) — its flashcard is created automatically.
7. Before an exam: switch to Last-Minute Revision for that subject, or run a full Exam Mode session under a timer.
8. Periodically: Settings → Export backup.
