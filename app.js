/* ============================================================
   CA STUDY — single-file app logic. Vanilla JS, no build step.
   Persistence: IndexedDB (db "castudy"). See DB module below.
   ============================================================ */
"use strict";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDateShort = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const esc = (s) => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
const isPastOrToday = (iso) => !iso || new Date(iso) <= new Date(new Date().toDateString() + ' 23:59:59');
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function toast(msg) {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ============================== DB ============================== */
const STORES = ['courses', 'subjects', 'chapters', 'topics', 'notes', 'pdfs', 'pdfBookmarks',
  'annotations', 'mnemonics', 'jargons', 'questions', 'flashcards', 'bookmarks',
  'studySessions', 'settings', 'trash'];

const DB = (() => {
  let db;
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('castudy', 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        STORES.forEach(name => {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }
  function tx(store, mode = 'readonly') { return db.transaction(store, mode).objectStore(store); }
  const all = (store) => new Promise((res, rej) => { const r = tx(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = (store, id) => new Promise((res, rej) => { const r = tx(store).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const put = (store, obj) => new Promise((res, rej) => { const r = tx(store, 'readwrite').put(obj); r.onsuccess = () => res(obj); r.onerror = () => rej(r.error); });
  const del = (store, id) => new Promise((res, rej) => { const r = tx(store, 'readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  const clearStore = (store) => new Promise((res, rej) => { const r = tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  return { open, all, get, put, del, clearStore };
})();

/* In-memory cache mirrors IndexedDB for fast sync rendering. */
const Cache = {};
async function loadAllToCache() {
  for (const s of STORES) Cache[s] = await DB.all(s);
}
async function saveItem(store, obj) {
  obj.updatedAt = nowISO();
  await DB.put(store, obj);
  const arr = Cache[store];
  const i = arr.findIndex(x => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  return obj;
}
async function trashItem(store, id) {
  const obj = Cache[store].find(x => x.id === id);
  if (!obj) return;
  await DB.put('trash', { id: uid(), type: store, data: obj, deletedAt: nowISO() });
  Cache.trash = await DB.all('trash');
  await DB.del(store, id);
  Cache[store] = Cache[store].filter(x => x.id !== id);
}
async function restoreTrash(trashId) {
  const t = Cache.trash.find(x => x.id === trashId);
  if (!t) return;
  await DB.put(t.type, t.data);
  Cache[t.type] = await DB.all(t.type);
  await DB.del('trash', trashId);
  Cache.trash = Cache.trash.filter(x => x.id !== trashId);
  toast('Restored');
}

/* ============================== SETTINGS ============================== */
const Settings = {
  defaults: {
    theme: 'light',
    fontSize: 'md',
    revisionIntervals: [1, 3, 7, 14, 30],
    highlightColors: [
      { key: 'y', label: 'Important', color: '#fde68a' },
      { key: 'g', label: 'Definition', color: '#bbf7d0' },
      { key: 'b', label: 'Concept', color: '#bfdbfe' },
      { key: 'r', label: 'Exam Alert', color: '#fecaca' },
      { key: 'p', label: 'Mnemonic', color: '#e9d5ff' },
      { key: 'o', label: 'Exception', color: '#fed7aa' },
    ],
  },
  get(key) {
    const row = Cache.settings.find(s => s.id === key);
    return row ? row.value : this.defaults[key];
  },
  async set(key, value) {
    await saveItem('settings', { id: key, value });
  }
};

const Theme = {
  apply() {
    const t = Settings.get('theme');
    document.documentElement.classList.toggle('dark', t === 'dark');
  },
  toggle() {
    const cur = Settings.get('theme');
    Settings.set('theme', cur === 'dark' ? 'light' : 'dark').then(() => this.apply());
  }
};

/* ============================== ROUTER / UI ============================== */
const UI = {
  route: 'dashboard',
  params: {},
  nav(route, params = {}) {
    this.route = route; this.params = params;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === route));
    document.querySelectorAll('.bottom-nav button').forEach(n => n.classList.toggle('active', n.dataset.route === route));
    this.closeSidebar();
    Router.render();
    document.getElementById('content').scrollTop = 0;
  },
  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('scrim').classList.toggle('show');
  },
  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('show');
  },
  newQuick() {
    Modal.open('Quick Add', `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn secondary" onclick="Modal.close();Notes.promptNew();">📝 New Note</button>
        <button class="btn secondary" onclick="Modal.close();UI.nav('pdfs');">📄 Import PDF</button>
        <button class="btn secondary" onclick="Modal.close();Mnemonics.promptNew();">🧠 Add Mnemonic</button>
        <button class="btn secondary" onclick="Modal.close();Jargons.promptNew();">🔤 Add Jargon</button>
        <button class="btn secondary" onclick="Modal.close();Questions.promptNew();">❓ Add Question</button>
      </div>`, true);
  }
};

const Modal = {
  open(title, bodyHtml, noFooter) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop'; backdrop.id = 'modalBackdrop';
    backdrop.onclick = (e) => { if (e.target === backdrop) Modal.close(); };
    backdrop.innerHTML = `<div class="modal"><h3>${esc(title)}</h3>${bodyHtml}</div>`;
    document.body.appendChild(backdrop);
  },
  close() { const b = document.getElementById('modalBackdrop'); if (b) b.remove(); }
};

/* ============================== COURSE / SUBJECT / CHAPTER / TOPIC TREE ============================== */
const Courses = {
  promptNew() {
    Modal.open('New Course', `
      <label>Course name</label><input type="text" id="mCourseName" placeholder="e.g. CA Intermediate">
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn" onclick="Courses.create()">Create</button></div>`);
    setTimeout(() => document.getElementById('mCourseName')?.focus(), 50);
  },
  async create() {
    const name = document.getElementById('mCourseName').value.trim();
    if (!name) return;
    await saveItem('courses', { id: uid(), name, createdAt: nowISO() });
    Modal.close(); Tree.render(); toast('Course created');
  },
  async promptNewSubject(courseId) {
    const name = prompt('Subject name?'); if (!name) return;
    await saveItem('subjects', { id: uid(), courseId, name, color: '#6b5b3e', createdAt: nowISO() });
    Tree.render(); toast('Subject added');
  },
  async promptNewChapter(subjectId) {
    const name = prompt('Chapter name?'); if (!name) return;
    await saveItem('chapters', { id: uid(), subjectId, name, createdAt: nowISO() });
    Tree.render(); toast('Chapter added');
  },
  async promptNewTopic(chapterId) {
    const name = prompt('Topic name?'); if (!name) return;
    await saveItem('topics', { id: uid(), chapterId, name, createdAt: nowISO() });
    Tree.render(); toast('Topic added');
  }
};

const Tree = {
  expanded: new Set(),
  render() {
    const el = document.getElementById('courseTree');
    const courses = Cache.courses || [];
    if (!courses.length) { el.innerHTML = `<div class="subtle" style="padding:8px;">No courses yet.</div>`; return; }
    el.innerHTML = courses.map(c => this.renderCourse(c)).join('');
  },
  toggle(id) { this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id); this.render(); },
  renderCourse(c) {
    const open = this.expanded.has(c.id);
    const subjects = (Cache.subjects || []).filter(s => s.courseId === c.id);
    return `<div class="tree-node">
      <div class="tree-row" onclick="Tree.toggle('${c.id}')">
        <span class="caret">${open ? '▾' : '▸'}</span><span>📚 ${esc(c.name)}</span>
        <span class="add-mini" onclick="event.stopPropagation();Courses.promptNewSubject('${c.id}')">+</span>
      </div>
      ${open ? `<div class="tree-children">${subjects.map(s => this.renderSubject(s)).join('') || '<div class="subtle" style="padding:4px 8px;">No subjects</div>'}</div>` : ''}
    </div>`;
  },
  renderSubject(s) {
    const open = this.expanded.has(s.id);
    const chapters = (Cache.chapters || []).filter(c => c.subjectId === s.id);
    return `<div class="tree-node">
      <div class="tree-row" onclick="Tree.toggle('${s.id}')">
        <span class="caret">${open ? '▾' : '▸'}</span><span>${esc(s.name)}</span>
        <span class="add-mini" onclick="event.stopPropagation();Courses.promptNewChapter('${s.id}')">+</span>
      </div>
      ${open ? `<div class="tree-children">${chapters.map(c => this.renderChapter(c)).join('') || '<div class="subtle" style="padding:4px 8px;">No chapters</div>'}</div>` : ''}
    </div>`;
  },
  renderChapter(c) {
    const open = this.expanded.has(c.id);
    const topics = (Cache.topics || []).filter(t => t.chapterId === c.id);
    return `<div class="tree-node">
      <div class="tree-row" onclick="Tree.toggle('${c.id}')">
        <span class="caret">${open ? '▾' : '▸'}</span><span>${esc(c.name)}</span>
        <span class="add-mini" onclick="event.stopPropagation();Courses.promptNewTopic('${c.id}')">+</span>
      </div>
      ${open ? `<div class="tree-children">${topics.map(t => `<div class="tree-row ${UI.route === 'topic' && UI.params.id === t.id ? 'active' : ''}" onclick="UI.nav('topic',{id:'${t.id}'})">📄 ${esc(t.name)}</div>`).join('') || '<div class="subtle" style="padding:4px 8px;">No topics</div>'}</div>` : ''}
    </div>`;
  }
};

function chapterName(id) { return (Cache.chapters || []).find(c => c.id === id)?.name || '—'; }
function subjectName(id) { return (Cache.subjects || []).find(s => s.id === id)?.name || '—'; }
function topicName(id) { return (Cache.topics || []).find(t => t.id === id)?.name || '—'; }
function topicSubjectId(topicId) {
  const t = (Cache.topics || []).find(x => x.id === topicId);
  const c = t ? (Cache.chapters || []).find(x => x.id === t.chapterId) : null;
  return c ? c.subjectId : '';
}
function subjectOptions(selected) {
  return (Cache.subjects || []).map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}
function chapterOptions(selected) {
  return (Cache.chapters || []).map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)} (${esc(subjectName(c.subjectId))})</option>`).join('');
}
function topicOptions(selected) {
  return (Cache.topics || []).map(t => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
}

/* ============================== REVISION ENGINE ============================== */
const Revision = {
  intervals() { return Settings.get('revisionIntervals'); },
  schedule(idx) {
    const iv = this.intervals();
    const i = Math.min(idx, iv.length - 1);
    return { nextDate: daysFromNow(iv[i]), stage: i };
  },
  dueItems() {
    const items = [];
    (Cache.notes || []).forEach(n => { if (n.revision?.nextDate && isPastOrToday(n.revision.nextDate) && n.status !== 'mastered') items.push({ type: 'note', obj: n }); });
    // Flashcards (auto-generated from Questions & Mnemonics) are due once their
    // scheduled date arrives — and also the very first time, since a flashcard
    // has no separate detail page to rate it from the way a note does.
    (Cache.flashcards || []).forEach(f => { if (f.nextDate == null || isPastOrToday(f.nextDate)) items.push({ type: 'flashcard', obj: f }); });
    return items;
  },
  async rate(type, id, rating) {
    // rating: again|hard|good|easy
    const store = type === 'note' ? 'notes' : 'flashcards';
    const obj = Cache[store].find(x => x.id === id);
    if (!obj) return;
    if (type !== 'flashcard') obj.revision = obj.revision || { stage: 0 };
    let stage = (type === 'flashcard' ? obj.stage : obj.revision.stage) || 0;
    if (rating === 'again') stage = 0;
    else if (rating === 'hard') stage = Math.max(0, stage - 1);
    else if (rating === 'good') stage = stage + 1;
    else if (rating === 'easy') stage = stage + 2;
    const sched = this.schedule(stage);
    if (type === 'flashcard') { obj.stage = sched.stage; obj.nextDate = sched.nextDate; }
    else { obj.revision.stage = sched.stage; obj.revision.nextDate = sched.nextDate; obj.revision.history = obj.revision.history || []; obj.revision.history.push({ date: nowISO(), rating }); }
    await saveItem(store, obj);
    updateRevBadge();
  }
};
function updateRevBadge() {
  const n = Revision.dueItems().length;
  const b = document.getElementById('revBadge');
  if (b) { b.textContent = n; b.style.display = n ? 'inline-block' : 'none'; }
}

/* Auto-generated flashcards, kept in sync with their source Question/Mnemonic.
   This is the "front/back" deck the spec asks for — Questions and Mnemonics
   themselves no longer carry their own separate revision schedule. */
const Flashcards = {
  findFor(sourceType, sourceId) {
    return (Cache.flashcards || []).find(f => f.sourceType === sourceType && f.sourceId === sourceId);
  },
  async generateForQuestion(q) {
    const front = q.questionText;
    const back = (q.modelAnswer && q.modelAnswer.trim()) ? q.modelAnswer : '(No model answer recorded)';
    const existing = this.findFor('question', q.id);
    if (existing) { existing.front = front; existing.back = back; return saveItem('flashcards', existing); }
    return saveItem('flashcards', { id: uid(), front, back, sourceType: 'question', sourceId: q.id, stage: -1, nextDate: null, createdAt: nowISO() });
  },
  async generateForMnemonic(m) {
    const front = `Mnemonic for "${m.title}"?`;
    const back = `${m.mnemonicText}${m.meaning ? '\n' + m.meaning : ''}`;
    const existing = this.findFor('mnemonic', m.id);
    if (existing) { existing.front = front; existing.back = back; return saveItem('flashcards', existing); }
    return saveItem('flashcards', { id: uid(), front, back, sourceType: 'mnemonic', sourceId: m.id, stage: -1, nextDate: null, createdAt: nowISO() });
  },
  async removeForSource(sourceType, sourceId) {
    const fc = this.findFor(sourceType, sourceId);
    if (!fc) return;
    await DB.del('flashcards', fc.id);
    Cache.flashcards = Cache.flashcards.filter(f => f.id !== fc.id);
  }
};

/* ============================== NOTES ============================== */
const Notes = {
  promptNew(topicId) {
    const t = topicId || UI.params.id;
    Modal.open('New Note', `
      <label>Title</label><input type="text" id="mNoteTitle" placeholder="e.g. Conditions for ITC">
      <label>Topic</label><select id="mNoteTopic">${topicOptions(t)}</select>
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn" onclick="Notes.create()">Create</button></div>`);
    setTimeout(() => document.getElementById('mNoteTitle')?.focus(), 50);
  },
  async create() {
    const title = document.getElementById('mNoteTitle').value.trim() || 'Untitled note';
    const topicId = document.getElementById('mNoteTopic').value;
    const topic = (Cache.topics || []).find(t => t.id === topicId);
    const chapter = topic ? (Cache.chapters || []).find(c => c.id === topic.chapterId) : null;
    const note = {
      id: uid(), title, topicId, chapterId: chapter?.id, subjectId: chapter?.subjectId,
      content: '<p>Start typing…</p>', tags: [], importance: 3, examFrequency: 'medium', status: 'new',
      createdAt: nowISO(), revision: { stage: -1, nextDate: null }
    };
    await saveItem('notes', note);
    Modal.close();
    UI.nav('note', { id: note.id });
  },
  render(id) {
    const note = Cache.notes.find(n => n.id === id);
    if (!note) return `<div class="empty-state"><h3>Note not found</h3></div>`;
    const annots = (Cache.annotations || []).filter(a => a.targetType === 'note' && a.targetId === id);
    const linkedMnemonics = (Cache.mnemonics || []).filter(m => m.topicId === note.topicId);
    const linkedQuestions = (Cache.questions || []).filter(q => q.topicId === note.topicId);
    const colors = Settings.get('highlightColors');
    return `
    <div class="two-col">
      <div>
        <input class="note-title-input" value="${esc(note.title)}" oninput="Notes.updateTitle('${id}', this.value)">
        <div class="note-meta-row subtle">
          ${subjectName(note.subjectId)} › ${chapterName(note.chapterId)} › ${topicName(note.topicId)}
        </div>
        <div class="note-meta-row" style="margin-top:8px;">
          <span class="pill">Importance <span class="stars">${'★'.repeat(note.importance)}${'☆'.repeat(5 - note.importance)}</span></span>
          <span class="pill ${note.examFrequency === 'high' ? 'warn' : ''}">Exam freq: ${note.examFrequency}</span>
          <span class="pill">${note.status}</span>
          ${(note.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}
        </div>
        <div class="editor-toolbar">
          <button onclick="document.execCommand('bold')"><b>B</b></button>
          <button onclick="document.execCommand('italic')"><i>I</i></button>
          <button onclick="document.execCommand('underline')"><u>U</u></button>
          <button onclick="document.execCommand('strikeThrough')"><s>S</s></button>
          <div class="sep"></div>
          <button onclick="document.execCommand('formatBlock',false,'H2')">H2</button>
          <button onclick="document.execCommand('formatBlock',false,'H3')">H3</button>
          <button onclick="document.execCommand('formatBlock',false,'P')">¶</button>
          <div class="sep"></div>
          <button onclick="document.execCommand('insertUnorderedList')">• List</button>
          <button onclick="document.execCommand('insertOrderedList')">1. List</button>
          <button onclick="document.execCommand('formatBlock',false,'BLOCKQUOTE')">❝ Quote</button>
          <button onclick="document.execCommand('insertHorizontalRule')">―</button>
          <div class="sep"></div>
          <button onclick="Notes.insertTable('${id}')">▦ Table</button>
          <button onclick="Notes.insertLink()">🔗 Link</button>
        </div>
        <div class="editor-body" id="editorBody" contenteditable="true"
             oninput="Notes.onEdit('${id}')" onmouseup="Notes.onSelect(event,'${id}')" onkeyup="Notes.onSelect(event,'${id}')">${note.content}</div>
        <div class="save-status" id="saveStatus">Saved</div>
      </div>
      <div class="inspector">
        <div class="block">
          <h4>Highlight legend</h4>
          ${colors.map(c => `<span class="tag" style="border-color:${c.color}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:4px;"></span>${c.label}</span>`).join('')}
        </div>
        <div class="block">
          <h4>Annotations (${annots.length})</h4>
          ${annots.length ? annots.map(a => `<div class="card" style="padding:8px;margin-bottom:6px;font-size:13px;"><b>${esc(a.type)}</b>: ${esc(a.comment)}
            <div style="text-align:right;"><button class="btn sm secondary" onclick="Notes.deleteAnnotation('${a.id}','${id}')">✕</button></div></div>`).join('') : `<div class="subtle">None yet — select text to annotate.</div>`}
        </div>
        <div class="block">
          <h4>Revision</h4>
          <div class="subtle">Next: ${note.revision?.nextDate ? fmtDate(note.revision.nextDate) : 'Not scheduled'}</div>
          <div class="rate-row" style="margin-top:8px;">
            <button class="btn sm secondary" onclick="Revision.rate('note','${id}','again');Router.render();">Again</button>
            <button class="btn sm secondary" onclick="Revision.rate('note','${id}','good');Router.render();">Good</button>
            <button class="btn sm secondary" onclick="Revision.rate('note','${id}','easy');Router.render();">Easy</button>
          </div>
        </div>
        <div class="block">
          <h4>Linked mnemonics</h4>
          ${linkedMnemonics.length ? linkedMnemonics.map(m => `<div class="subtle">🧠 ${esc(m.title)}</div>`).join('') : `<div class="subtle">None linked.</div>`}
          <button class="btn sm secondary" style="margin-top:6px;" onclick="Mnemonics.promptNew('${note.topicId}')">+ Add mnemonic</button>
        </div>
        <div class="block">
          <h4>Linked questions</h4>
          ${linkedQuestions.length ? linkedQuestions.map(q => `<div class="subtle">❓ ${esc(q.questionText.slice(0, 40))}…</div>`).join('') : `<div class="subtle">None linked.</div>`}
          <button class="btn sm secondary" style="margin-top:6px;" onclick="Questions.promptNew('${note.topicId}')">+ Add question</button>
        </div>
        <div class="block">
          <button class="btn secondary sm" onclick="Bookmarks.add('note','${id}','${esc(note.title)}')">🔖 Bookmark this note</button>
          <button class="btn danger sm" style="margin-top:6px;" onclick="Notes.remove('${id}')">Delete note</button>
        </div>
      </div>
    </div>`;
  },
  updateTitle: debounce(async (id, val) => {
    const n = Cache.notes.find(x => x.id === id); if (!n) return; n.title = val || 'Untitled';
    await saveItem('notes', n);
  }, 400),
  onEdit: debounce(async function (id) {
    const status = document.getElementById('saveStatus');
    if (status) status.textContent = 'Saving…';
    const n = Cache.notes.find(x => x.id === id); if (!n) return;
    n.content = document.getElementById('editorBody').innerHTML;
    await saveItem('notes', n);
    if (status) status.textContent = 'Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 600),
  insertTable() {
    document.execCommand('insertHTML', false, `<table><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></table><p><br></p>`);
  },
  insertLink() {
    const url = prompt('URL?'); if (url) document.execCommand('createLink', false, url);
  },
  onSelect(e, noteId) {
    const sel = window.getSelection();
    const existing = document.getElementById('selToolbar');
    if (existing) existing.remove();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const colors = Settings.get('highlightColors');
    const bar = document.createElement('div');
    bar.id = 'selToolbar'; bar.className = 'sel-toolbar';
    bar.style.top = (rect.top + window.scrollY - 40) + 'px';
    bar.style.left = (rect.left + window.scrollX) + 'px';
    bar.innerHTML = colors.map(c => `<button title="${esc(c.label)}" onmousedown="event.preventDefault();Notes.highlight('${c.key}')">${['🟡','🟢','🔵','🔴','🟣','🟠'][colors.indexOf(c)] || '●'}</button>`).join('')
      + `<button onmousedown="event.preventDefault();Notes.annotate('${noteId}')">💬 Note</button>`;
    document.body.appendChild(bar);
  },
  highlight(colorKey) {
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const mark = document.createElement('mark'); mark.className = colorKey;
    try { range.surroundContents(mark); } catch (e) { mark.appendChild(range.extractContents()); range.insertNode(mark); }
    sel.removeAllRanges();
    document.getElementById('selToolbar')?.remove();
    const id = UI.params.id; Notes.onEdit(id);
  },
  async annotate(noteId) {
    const sel = window.getSelection();
    const text = sel.toString();
    document.getElementById('selToolbar')?.remove();
    const comment = prompt('Annotation (comment / doubt / exam tip):');
    if (!comment) return;
    await saveItem('annotations', { id: uid(), targetType: 'note', targetId: noteId, type: 'comment', text: text.slice(0, 80), comment, createdAt: nowISO() });
    // mark the flag inline
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range) {
      const span = document.createElement('span'); span.className = 'annot-flag'; span.title = comment; span.textContent = '💬';
      try { range.collapse(false); range.insertNode(span); } catch (e) { }
    }
    Notes.onEdit(noteId);
    Router.render();
  },
  async deleteAnnotation(annotId, noteId) {
    await DB.del('annotations', annotId);
    Cache.annotations = Cache.annotations.filter(a => a.id !== annotId);
    Router.render();
  },
  async remove(id) { if (!confirm('Move this note to Trash?')) return; await trashItem('notes', id); UI.nav('dashboard'); toast('Note moved to Trash'); },
  editMeta(id) {
    const n = Cache.notes.find(x => x.id === id);
    Modal.open('Edit note details', `
      <label>Importance (1-5)</label><input type="number" id="mImp" min="1" max="5" value="${n.importance}">
      <label>Exam frequency</label><select id="mFreq"><option ${n.examFrequency === 'low' ? 'selected' : ''}>low</option><option ${n.examFrequency === 'medium' ? 'selected' : ''}>medium</option><option ${n.examFrequency === 'high' ? 'selected' : ''}>high</option></select>
      <label>Status</label><select id="mStatus"><option ${n.status === 'new' ? 'selected' : ''}>new</option><option ${n.status === 'learning' ? 'selected' : ''}>learning</option><option ${n.status === 'difficult' ? 'selected' : ''}>difficult</option><option ${n.status === 'mastered' ? 'selected' : ''}>mastered</option></select>
      <label>Tags (comma separated)</label><input type="text" id="mTags" value="${(n.tags || []).join(', ')}">
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button><button class="btn" onclick="Notes.saveMeta('${id}')">Save</button></div>`);
  },
  async saveMeta(id) {
    const n = Cache.notes.find(x => x.id === id);
    n.importance = parseInt(document.getElementById('mImp').value) || 3;
    n.examFrequency = document.getElementById('mFreq').value;
    n.status = document.getElementById('mStatus').value;
    n.tags = document.getElementById('mTags').value.split(',').map(t => t.trim()).filter(Boolean);
    await saveItem('notes', n); Modal.close(); Router.render();
  }
};

/* ============================== MNEMONICS ============================== */
const Mnemonics = {
  promptNew(topicId) {
    Modal.open('New Mnemonic', `
      <label>Title</label><input type="text" id="mTitle" placeholder="e.g. ITC Conditions">
      <label>Mnemonic</label><input type="text" id="mCode" placeholder="e.g. RITE">
      <label>Meaning (one line per letter)</label><textarea id="mMeaning" rows="4" placeholder="R = Registered person&#10;I = Invoice&#10;T = Tax paid&#10;E = Eligible use"></textarea>
      <label>Topic</label><select id="mTopic">${topicOptions(topicId)}</select>
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button><button class="btn" onclick="Mnemonics.create()">Save</button></div>`);
  },
  async create() {
    const title = document.getElementById('mTitle').value.trim(); if (!title) return;
    const m = await saveItem('mnemonics', {
      id: uid(), title, mnemonicText: document.getElementById('mCode').value.trim(),
      meaning: document.getElementById('mMeaning').value.trim(), topicId: document.getElementById('mTopic').value,
      tags: [], favorite: false, createdAt: nowISO()
    });
    await Flashcards.generateForMnemonic(m);
    Modal.close(); toast('Mnemonic saved · flashcard created'); Router.render();
  },
  async toggleFav(id) {
    const m = Cache.mnemonics.find(x => x.id === id); m.favorite = !m.favorite; await saveItem('mnemonics', m); Router.render();
  },
  async remove(id) {
    if (!confirm('Delete this mnemonic? Its flashcard will be removed too.')) return;
    await Flashcards.removeForSource('mnemonic', id);
    await trashItem('mnemonics', id); Router.render();
  },
  render() {
    const items = Cache.mnemonics || [];
    if (!items.length) return emptyState('🧠', 'Build your memory bank.', 'Create Mnemonic', "Mnemonics.promptNew()");
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;">Mnemonics</h2><button class="btn" onclick="Mnemonics.promptNew()">+ New Mnemonic</button></div>
      <div class="grid cols-3">${items.map(m => { const fc = Flashcards.findFor('mnemonic', m.id); return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;"><b>${esc(m.title)}</b>
        <span style="cursor:pointer;" onclick="Mnemonics.toggleFav('${m.id}')">${m.favorite ? '★' : '☆'}</span></div>
        <div class="pill" style="margin:6px 0;">${esc(m.mnemonicText)}</div>
        <div class="subtle" style="white-space:pre-line;">${esc(m.meaning)}</div>
        <div class="subtle" style="margin-top:8px;">Topic: ${topicName(m.topicId)}</div>
        <div class="subtle">🃏 ${fc && fc.nextDate ? 'Next revision: ' + fmtDateShort(fc.nextDate) : 'Flashcard not yet reviewed'}</div>
        <div style="text-align:right;margin-top:8px;"><button class="btn sm secondary" onclick="Mnemonics.remove('${m.id}')">Delete</button></div>
      </div>`; }).join('')}</div>`;
  }
};

/* ============================== JARGONS ============================== */
const Jargons = {
  promptNew() {
    Modal.open('New Jargon / Term', `
      <label>Term</label><input type="text" id="jTerm" placeholder="e.g. Material Misstatement">
      <label>Meaning</label><textarea id="jMeaning" rows="3"></textarea>
      <label>Memory trick (optional)</label><input type="text" id="jTrick">
      <label>Subject</label><select id="jSubject">${subjectOptions()}</select>
      <label>Importance</label><select id="jImp"><option>Normal</option><option>Important</option><option>Must Memorize</option></select>
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button><button class="btn" onclick="Jargons.create()">Save</button></div>`);
  },
  async create() {
    const term = document.getElementById('jTerm').value.trim(); if (!term) return;
    await saveItem('jargons', {
      id: uid(), term, meaning: document.getElementById('jMeaning').value.trim(),
      memoryTrick: document.getElementById('jTrick').value.trim(), subjectId: document.getElementById('jSubject').value,
      importance: document.getElementById('jImp').value, tags: [], createdAt: nowISO()
    });
    Modal.close(); toast('Jargon saved'); Router.render();
  },
  async remove(id) { if (!confirm('Delete this term?')) return; await trashItem('jargons', id); Router.render(); },
  render() {
    const items = Cache.jargons || [];
    if (!items.length) return emptyState('🔤', 'Track tricky terms, keywords and abbreviations.', 'Add Jargon', "Jargons.promptNew()");
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;">Jargons & Keywords</h2><button class="btn" onclick="Jargons.promptNew()">+ New Term</button></div>
      ${items.map(j => `<div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;"><b>${esc(j.term)}</b><span class="pill ${j.importance === 'Must Memorize' ? 'warn' : ''}">${esc(j.importance)}</span></div>
        <div style="margin:6px 0;">${esc(j.meaning)}</div>
        ${j.memoryTrick ? `<div class="subtle">💡 ${esc(j.memoryTrick)}</div>` : ''}
        <div class="subtle" style="margin-top:4px;">${subjectName(j.subjectId)}</div>
        <div style="text-align:right;"><button class="btn sm secondary" onclick="Jargons.remove('${j.id}')">Delete</button></div>
      </div>`).join('')}`;
  }
};

/* ============================== QUESTIONS ============================== */
const Questions = {
  promptNew(topicId) {
    Modal.open('New Question', `
      <label>Question</label><textarea id="qText" rows="3"></textarea>
      <label>Type</label><select id="qType"><option>Theory</option><option>Practical</option><option>MCQ</option><option>Case Study</option><option>Numerical</option></select>
      <label>Marks</label><input type="number" id="qMarks" value="5">
      <label>Difficulty</label><select id="qDiff"><option>Easy</option><option selected>Medium</option><option>Hard</option></select>
      <label>Model answer (optional)</label><textarea id="qAnswer" rows="3"></textarea>
      <label>Topic</label><select id="qTopic">${topicOptions(topicId)}</select>
      <div class="modal-actions"><button class="btn secondary" onclick="Modal.close()">Cancel</button><button class="btn" onclick="Questions.create()">Save</button></div>`);
  },
  async create() {
    const questionText = document.getElementById('qText').value.trim(); if (!questionText) return;
    const topicId = document.getElementById('qTopic').value;
    const topic = (Cache.topics || []).find(t => t.id === topicId);
    const chapter = topic ? (Cache.chapters || []).find(c => c.id === topic.chapterId) : null;
    const q = await saveItem('questions', {
      id: uid(), questionText, type: document.getElementById('qType').value, marks: parseInt(document.getElementById('qMarks').value) || 0,
      difficulty: document.getElementById('qDiff').value, modelAnswer: document.getElementById('qAnswer').value.trim(),
      topicId, chapterId: chapter?.id, subjectId: chapter?.subjectId, status: 'not-attempted', personalAnswer: '',
      createdAt: nowISO()
    });
    await Flashcards.generateForQuestion(q);
    Modal.close(); toast('Question saved · flashcard created'); Router.render();
  },
  async setStatus(id, status) {
    const q = Cache.questions.find(x => x.id === id); q.status = status;
    await saveItem('questions', q); Router.render();
  },
  async remove(id) {
    if (!confirm('Delete this question? Its flashcard will be removed too.')) return;
    await Flashcards.removeForSource('question', id);
    await trashItem('questions', id); Router.render();
  },
  render() {
    const items = Cache.questions || [];
    if (!items.length) return emptyState('❓', 'Build your question bank from past papers and practice.', 'Add Question', "Questions.promptNew()");
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;">Questions (${items.length})</h2><button class="btn" onclick="Questions.promptNew()">+ New Question</button></div>
      ${items.map(q => { const fc = Flashcards.findFor('question', q.id); return `<div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div>${esc(q.questionText)}</div>
          <span class="pill">${q.marks} marks</span>
        </div>
        <div class="note-meta-row" style="margin-top:8px;">
          <span class="pill">${esc(q.type)}</span><span class="pill">${esc(q.difficulty)}</span>
          <span class="pill ${q.status === 'not-attempted' ? '' : 'warn'}">${esc(q.status)}</span>
          <span class="subtle">${subjectName(q.subjectId)}</span>
        </div>
        <div class="subtle" style="margin-top:4px;">🃏 ${fc && fc.nextDate ? 'Next revision: ' + fmtDateShort(fc.nextDate) : 'Flashcard not yet reviewed'}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn sm secondary" onclick="Questions.toggleAnswer('${q.id}')">Reveal answer</button>
          <button class="btn sm secondary" onclick="Questions.setStatus('${q.id}','correct')">Mark correct</button>
          <button class="btn sm secondary" onclick="Questions.setStatus('${q.id}','incorrect')">Mark incorrect</button>
          <button class="btn sm secondary" onclick="Questions.remove('${q.id}')">Delete</button>
        </div>
        <div id="ans-${q.id}" style="display:none;margin-top:8px;padding:8px;background:var(--bg);border-radius:8px;">${esc(q.modelAnswer) || '<span class="subtle">No model answer recorded.</span>'}</div>
      </div>`; }).join('')}`;
  },
  toggleAnswer(id) { const el = document.getElementById('ans-' + id); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
};

/* ============================== BOOKMARKS ============================== */
const Bookmarks = {
  async add(targetType, targetId, label) {
    await saveItem('bookmarks', { id: uid(), targetType, targetId, label, createdAt: nowISO() });
    toast('Bookmarked');
  },
  async remove(id) { await DB.del('bookmarks', id); Cache.bookmarks = Cache.bookmarks.filter(b => b.id !== id); Router.render(); },
  render() {
    const items = Cache.bookmarks || [];
    if (!items.length) return emptyState('🔖', 'Bookmark notes, PDF pages and questions to find them fast.', null, null);
    return `<h2>Bookmarks</h2>${items.map(b => `
      <div class="list-row" onclick="Bookmarks.open('${b.targetType}','${b.targetId}')">
        <span>🔖</span><div style="flex:1;">${esc(b.label)}<div class="subtle">${b.targetType} · ${fmtDate(b.createdAt)}</div></div>
        <button class="btn sm secondary" onclick="event.stopPropagation();Bookmarks.remove('${b.id}')">✕</button>
      </div>`).join('')}`;
  },
  open(type, id) {
    if (type === 'note') UI.nav('note', { id });
    else if (type === 'pdf') UI.nav('pdf', { id });
  }
};

/* ============================== PDF LIBRARY ============================== */
let pdfDocCache = null, pdfCurrentPage = 1, pdfScale = 1.2, pdfPageObj = null, pdfStickyMode = false;

/* Minimal selectable text layer, built the same way pdf.js's own viewer does:
   one absolutely-positioned, transparent span per text item, sized/rotated
   from its render matrix, so the browser's native text selection works. */
async function renderTextLayer(page, viewport, container) {
  container.innerHTML = '';
  container.style.width = viewport.width + 'px';
  container.style.height = viewport.height + 'px';
  let textContent;
  try { textContent = await page.getTextContent(); } catch (e) { return; }
  const frag = document.createDocumentFragment();
  textContent.items.forEach(item => {
    if (!item.str) return;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeight = Math.hypot(tx[2], tx[3]) || 1;
    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.left = tx[4] + 'px';
    span.style.top = (tx[5] - fontHeight) + 'px';
    span.style.fontSize = fontHeight + 'px';
    span.style.fontFamily = 'sans-serif';
    if (angle !== 0) span.style.transform = `rotate(${angle}rad)`;
    frag.appendChild(span);
  });
  container.appendChild(frag);
}
const Pdfs = {
  upload() { document.getElementById('pdfFileInput').click(); },
  async handleFile(input) {
    const file = input.files[0]; if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
    const buf = await file.arrayBuffer();
    const rec = { id: uid(), filename: file.name, title: file.name.replace(/\.pdf$/i, ''), blob: buf, subjectId: '', pageCount: 0, createdAt: nowISO() };
    try {
      const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      rec.pageCount = doc.numPages;
    } catch (e) { console.warn('pdf parse warning', e); }
    await saveItem('pdfs', rec);
    input.value = '';
    toast('PDF imported'); Router.render();
  },
  async remove(id) { if (!confirm('Move this PDF to Trash?')) return; await trashItem('pdfs', id); Router.render(); },
  renderLibrary() {
    const items = Cache.pdfs || [];
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="margin:0;">PDF Library</h2>
      <div><input type="file" id="pdfFileInput" accept="application/pdf" style="display:none" onchange="Pdfs.handleFile(this)">
      <button class="btn" onclick="Pdfs.upload()">+ Import PDF</button></div></div>
      ${items.length ? `<div class="grid cols-3">${items.map(p => `
      <div class="card" style="cursor:pointer;" onclick="UI.nav('pdf',{id:'${p.id}'})">
        <div style="font-size:32px;">📄</div><b>${esc(p.title)}</b>
        <div class="subtle">${p.pageCount || '?'} pages</div>
        <div style="text-align:right;margin-top:8px;"><button class="btn sm secondary" onclick="event.stopPropagation();Pdfs.remove('${p.id}')">Delete</button></div>
      </div>`).join('')}</div>` : emptyState('📄', 'No PDFs yet.', 'Import PDF', 'Pdfs.upload()')}`;
  },
  async renderViewer(id) {
    const rec = Cache.pdfs.find(p => p.id === id);
    if (!rec) return `<div class="empty-state"><h3>PDF not found</h3></div>`;
    setTimeout(() => Pdfs.load(rec), 30);
    return `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 54px);margin:-24px -28px;">
      <div class="pdf-toolbar">
        <b>${esc(rec.title)}</b>
        <div class="spacer"></div>
        <button class="icon-btn" onclick="Pdfs.prevPage()">‹ Prev</button>
        <span id="pdfPageLabel" class="subtle">Page 1 / ${rec.pageCount || '?'}</span>
        <button class="icon-btn" onclick="Pdfs.nextPage()">Next ›</button>
        <button class="icon-btn" onclick="Pdfs.zoom(-0.15)">−</button>
        <button class="icon-btn" onclick="Pdfs.zoom(0.15)">+</button>
        <button class="icon-btn" onclick="Pdfs.bookmarkPage('${id}')">🔖 Bookmark page</button>
        <button class="icon-btn" id="stickyBtn" onclick="Pdfs.toggleStickyMode()">📌 Sticky note</button>
        <span class="subtle" style="font-size:11.5px;">Select text to highlight/underline</span>
      </div>
      <div style="display:flex;flex:1;overflow:hidden;">
        <div class="pdf-canvas-wrap" id="pdfCanvasWrap">
          <div class="pdf-page-wrap" id="pdfPageWrap" onclick="Pdfs.handlePageClick(event)">
            <canvas id="pdfCanvas"></canvas>
            <div class="pdf-textlayer" id="pdfTextLayer" onmouseup="Pdfs.onTextSelect(event)"></div>
            <div class="pdf-hl-overlay" id="pdfHlOverlay"></div>
          </div>
        </div>
        <div style="width:220px;border-left:1px solid var(--border);padding:12px;overflow-y:auto;background:var(--bg-elev);" id="pdfSidePanel">
          ${Pdfs.sidePanelHTML(id)}
        </div>
      </div>
    </div>`;
  },
  async load(rec) {
    try {
      pdfDocCache = await pdfjsLib.getDocument({ data: rec.blob.slice(0) }).promise;
      pdfCurrentPage = 1; pdfScale = 1.2; pdfStickyMode = false;
      Pdfs.renderPage();
    } catch (e) { toast('Could not render PDF'); console.error(e); }
  },
  async renderPage() {
    if (!pdfDocCache) return;
    const page = await pdfDocCache.getPage(pdfCurrentPage);
    pdfPageObj = page;
    const viewport = page.getViewport({ scale: pdfScale });
    const canvas = document.getElementById('pdfCanvas'); if (!canvas) return;
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const label = document.getElementById('pdfPageLabel');
    if (label) label.textContent = `Page ${pdfCurrentPage} / ${pdfDocCache.numPages}`;
    const wrap = document.getElementById('pdfPageWrap');
    if (wrap) { wrap.style.width = viewport.width + 'px'; wrap.style.height = viewport.height + 'px'; }
    const textLayer = document.getElementById('pdfTextLayer');
    if (textLayer) await renderTextLayer(page, viewport, textLayer);
    Pdfs.renderOverlay(viewport);
    Pdfs.refreshSidePanel();
  },
  prevPage() { if (pdfCurrentPage > 1) { pdfCurrentPage--; Pdfs.renderPage(); } },
  nextPage() { if (pdfDocCache && pdfCurrentPage < pdfDocCache.numPages) { pdfCurrentPage++; Pdfs.renderPage(); } },
  goToPage(n) { pdfCurrentPage = n; Pdfs.renderPage(); },
  zoom(delta) { pdfScale = Math.max(0.4, Math.min(3, pdfScale + delta)); Pdfs.renderPage(); },
  async bookmarkPage(pdfId) {
    const label = prompt('Label for this bookmark (optional):') || '';
    await saveItem('pdfBookmarks', { id: uid(), pdfId, page: pdfCurrentPage, label, createdAt: nowISO() });
    Pdfs.refreshSidePanel();
  },

  /* ---- highlight / underline (selection-driven) ---- */
  onTextSelect(e) {
    document.getElementById('pdfSelToolbar')?.remove();
    if (pdfStickyMode) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    const layer = document.getElementById('pdfTextLayer');
    if (!layer || !layer.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const colors = Settings.get('highlightColors');
    const bar = document.createElement('div');
    bar.id = 'pdfSelToolbar'; bar.className = 'sel-toolbar';
    bar.style.top = (rect.top + window.scrollY - 40) + 'px';
    bar.style.left = (rect.left + window.scrollX) + 'px';
    bar.innerHTML = colors.map((c, i) => `<button title="${esc(c.label)}" onmousedown="event.preventDefault();Pdfs.saveHighlight('${c.color}','${c.key}')">${['🟡', '🟢', '🔵', '🔴', '🟣', '🟠'][i] || '●'}</button>`).join('')
      + `<button title="Underline" onmousedown="event.preventDefault();Pdfs.saveHighlight('','underline')">U̲</button>`;
    document.body.appendChild(bar);
  },
  async saveHighlight(color, kind) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const text = sel.toString();
    const wrap = document.getElementById('pdfPageWrap');
    const wrapRect = wrap.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).map(r => ({
      x: (r.left - wrapRect.left) / pdfScale, y: (r.top - wrapRect.top) / pdfScale,
      w: r.width / pdfScale, h: r.height / pdfScale
    }));
    sel.removeAllRanges();
    document.getElementById('pdfSelToolbar')?.remove();
    if (!rects.length) return;
    await saveItem('annotations', {
      id: uid(), targetType: 'pdf', pdfId: UI.params.id, page: pdfCurrentPage,
      kind: kind === 'underline' ? 'underline' : 'highlight', color: kind === 'underline' ? '' : color,
      rects, text: text.slice(0, 140), comment: '', createdAt: nowISO()
    });
    Pdfs.refreshOverlayAndPanel();
    toast(kind === 'underline' ? 'Underlined' : 'Highlighted');
  },

  /* ---- sticky notes ---- */
  toggleStickyMode() {
    pdfStickyMode = !pdfStickyMode;
    document.getElementById('stickyBtn')?.classList.toggle('active-toggle', pdfStickyMode);
    if (pdfStickyMode) toast('Click anywhere on the page to place a sticky note');
  },
  handlePageClick(e) {
    if (!pdfStickyMode) return;
    if (window.getSelection().toString().trim()) return; // was a text selection, not a placement click
    const wrap = document.getElementById('pdfPageWrap');
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / pdfScale, y = (e.clientY - r.top) / pdfScale;
    pdfStickyMode = false;
    document.getElementById('stickyBtn')?.classList.remove('active-toggle');
    const text = prompt('Sticky note text:');
    if (!text) return;
    saveItem('annotations', { id: uid(), targetType: 'pdf', pdfId: UI.params.id, page: pdfCurrentPage, kind: 'sticky', x, y, comment: text, text: '', createdAt: nowISO() })
      .then(() => Pdfs.refreshOverlayAndPanel());
  },
  openHighlight(id) {
    const a = Cache.annotations.find(x => x.id === id); if (!a) return;
    Modal.open(a.kind === 'underline' ? 'Underline' : 'Highlight', `
      <div class="subtle">"${esc(a.text)}"</div>
      <label>Note (optional)</label><textarea id="pdfAnnotComment" rows="3">${esc(a.comment || '')}</textarea>
      <div class="modal-actions">
        <button class="btn danger sm" onclick="Pdfs.deleteAnnotation('${id}')">Delete</button>
        <button class="btn sm" onclick="Pdfs.saveAnnotComment('${id}')">Save</button>
      </div>`);
  },
  openSticky(id) {
    const a = Cache.annotations.find(x => x.id === id); if (!a) return;
    Modal.open('Sticky note', `
      <textarea id="pdfAnnotComment" rows="4">${esc(a.comment || '')}</textarea>
      <div class="modal-actions">
        <button class="btn danger sm" onclick="Pdfs.deleteAnnotation('${id}')">Delete</button>
        <button class="btn sm" onclick="Pdfs.saveAnnotComment('${id}')">Save</button>
      </div>`);
  },
  async saveAnnotComment(id) {
    const a = Cache.annotations.find(x => x.id === id); if (!a) return;
    a.comment = document.getElementById('pdfAnnotComment').value;
    await saveItem('annotations', a);
    Modal.close();
    Pdfs.refreshOverlayAndPanel();
  },
  async deleteAnnotation(id) {
    await DB.del('annotations', id);
    Cache.annotations = Cache.annotations.filter(a => a.id !== id);
    Modal.close();
    Pdfs.refreshOverlayAndPanel();
  },

  /* ---- overlay + side panel rendering ---- */
  refreshOverlayAndPanel() {
    if (!pdfPageObj) return;
    Pdfs.renderOverlay(pdfPageObj.getViewport({ scale: pdfScale }));
    Pdfs.refreshSidePanel();
  },
  renderOverlay(viewport) {
    const overlay = document.getElementById('pdfHlOverlay');
    if (!overlay) return;
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';
    overlay.innerHTML = '';
    const pdfId = UI.params.id;
    const items = (Cache.annotations || []).filter(a => a.targetType === 'pdf' && a.pdfId === pdfId && a.page === pdfCurrentPage);
    items.forEach(a => {
      if (a.kind === 'sticky') {
        const icon = document.createElement('div');
        icon.className = 'pdf-sticky-icon';
        icon.style.left = (a.x * pdfScale) + 'px'; icon.style.top = (a.y * pdfScale) + 'px';
        icon.textContent = '📝'; icon.title = a.comment;
        icon.onclick = (ev) => { ev.stopPropagation(); Pdfs.openSticky(a.id); };
        overlay.appendChild(icon);
      } else {
        (a.rects || []).forEach(r => {
          const div = document.createElement('div');
          div.className = 'pdf-hl-rect' + (a.kind === 'underline' ? ' underline' : '');
          div.style.left = (r.x * pdfScale) + 'px'; div.style.top = (r.y * pdfScale) + 'px';
          div.style.width = (r.w * pdfScale) + 'px'; div.style.height = (r.h * pdfScale) + 'px';
          if (a.kind !== 'underline') div.style.background = a.color;
          div.title = a.comment || a.text || '';
          div.onclick = (ev) => { ev.stopPropagation(); Pdfs.openHighlight(a.id); };
          overlay.appendChild(div);
        });
      }
    });
  },
  refreshSidePanel() {
    const el = document.getElementById('pdfSidePanel');
    if (el) el.innerHTML = Pdfs.sidePanelHTML(UI.params.id);
  },
  sidePanelHTML(pdfId) {
    const bookmarks = (Cache.pdfBookmarks || []).filter(b => b.pdfId === pdfId);
    const pageAnnots = (Cache.annotations || []).filter(a => a.targetType === 'pdf' && a.pdfId === pdfId && a.page === pdfCurrentPage);
    return `
      <h4 style="font-size:12px;text-transform:uppercase;color:var(--text-dim);margin-top:0;">This page</h4>
      ${pageAnnots.length ? pageAnnots.map(a => `<div class="subtle" style="cursor:pointer;padding:4px 0;" onclick="${a.kind === 'sticky' ? `Pdfs.openSticky('${a.id}')` : `Pdfs.openHighlight('${a.id}')`}">${a.kind === 'sticky' ? '📝' : a.kind === 'underline' ? '‾' : '🖍'} ${esc((a.comment || a.text || '').slice(0, 42))}</div>`).join('') : '<div class="subtle">None on this page yet.</div>'}
      <h4 style="font-size:12px;text-transform:uppercase;color:var(--text-dim);margin-top:14px;">Bookmarked pages</h4>
      ${bookmarks.length ? bookmarks.map(b => `<div class="subtle" style="cursor:pointer;padding:4px 0;" onclick="Pdfs.goToPage(${b.page})">📍 Page ${b.page} ${b.label ? '— ' + esc(b.label) : ''}</div>`).join('') : '<div class="subtle">None yet.</div>'}
    `;
  }
};

/* ============================== SEARCH / COMMAND PALETTE ============================== */
/* Static command list for the palette — actions, not content. Dynamic
   "Go to subject" commands are appended at search time from Cache.subjects. */
const Commands = [
  { label: 'New Note', icon: '📝', kind: 'Create', run: () => { CmdK.close(); Notes.promptNew(); } },
  { label: 'New Course', icon: '📚', kind: 'Create', run: () => { CmdK.close(); Courses.promptNew(); } },
  { label: 'Import PDF', icon: '📄', kind: 'Create', run: () => { CmdK.close(); UI.nav('pdfs'); setTimeout(() => Pdfs.upload(), 250); } },
  { label: 'Add Mnemonic', icon: '🧠', kind: 'Create', run: () => { CmdK.close(); Mnemonics.promptNew(); } },
  { label: 'Add Jargon', icon: '🔤', kind: 'Create', run: () => { CmdK.close(); Jargons.promptNew(); } },
  { label: 'Add Question', icon: '❓', kind: 'Create', run: () => { CmdK.close(); Questions.promptNew(); } },
  { label: 'Start Revision', icon: '🔁', kind: 'Go to', run: () => { CmdK.close(); UI.nav('revision'); } },
  { label: 'Exam Mode', icon: '🎓', kind: 'Go to', run: () => { CmdK.close(); UI.nav('exam'); } },
  { label: 'Last-Minute Revision', icon: '⚡', kind: 'Go to', run: () => { CmdK.close(); UI.nav('lmr'); } },
  { label: 'Focus Mode / Study Timer', icon: '⏱', kind: 'Go to', run: () => { CmdK.close(); UI.nav('focus'); } },
  { label: 'Open Dashboard', icon: '🏠', kind: 'Go to', run: () => { CmdK.close(); UI.nav('dashboard'); } },
  { label: 'Open PDF Library', icon: '📄', kind: 'Go to', run: () => { CmdK.close(); UI.nav('pdfs'); } },
  { label: 'Open Questions', icon: '❓', kind: 'Go to', run: () => { CmdK.close(); UI.nav('questions'); } },
  { label: 'Open Mnemonics', icon: '🧠', kind: 'Go to', run: () => { CmdK.close(); UI.nav('mnemonics'); } },
  { label: 'Open Jargons', icon: '🔤', kind: 'Go to', run: () => { CmdK.close(); UI.nav('jargons'); } },
  { label: 'Open Bookmarks', icon: '🔖', kind: 'Go to', run: () => { CmdK.close(); UI.nav('bookmarks'); } },
  { label: 'Open Trash', icon: '🗑', kind: 'Go to', run: () => { CmdK.close(); UI.nav('trash'); } },
  { label: 'Open Settings', icon: '⚙️', kind: 'Go to', run: () => { CmdK.close(); UI.nav('settings'); } },
  { label: 'Export Backup', icon: '⬇', kind: 'Action', run: () => { CmdK.close(); UI.nav('settings'); setTimeout(() => BackupService.exportJSON(), 250); } },
  { label: 'Toggle Dark Mode', icon: '🌓', kind: 'Action', run: () => { CmdK.close(); Theme.toggle(); } },
];

const CmdK = {
  _results: [],
  open() {
    const backdrop = document.createElement('div');
    backdrop.className = 'cmdk-backdrop'; backdrop.id = 'cmdkBackdrop';
    backdrop.onclick = (e) => { if (e.target === backdrop) CmdK.close(); };
    backdrop.innerHTML = `<div class="cmdk">
      <input id="cmdkInput" placeholder="Search everything, or type a command (New Note, Toggle Dark Mode…)" oninput="CmdK.search(this.value)">
      <div class="cmdk-results" id="cmdkResults"></div>
    </div>`;
    document.body.appendChild(backdrop);
    setTimeout(() => document.getElementById('cmdkInput').focus(), 30);
    CmdK.search('');
  },
  close() { const b = document.getElementById('cmdkBackdrop'); if (b) b.remove(); },
  allCommands() {
    const dynamic = (Cache.subjects || []).map(s => ({
      label: 'Go to subject: ' + s.name, icon: '📘', kind: 'Go to',
      run: () => {
        CmdK.close();
        Tree.expanded.add(s.courseId); Tree.expanded.add(s.id); Tree.render();
        if (window.innerWidth <= 860) UI.toggleSidebar();
      }
    }));
    return Commands.concat(dynamic);
  },
  search(q) {
    const query = (q || '').trim();
    let results;
    if (!query) {
      results = this.allCommands().slice(0, 10).map(c => ({ ...c, isCommand: true }));
    } else {
      const matchedCommands = this.allCommands().filter(c => c.label.toLowerCase().includes(query.toLowerCase())).map(c => ({ ...c, isCommand: true }));
      const contentResults = Search.run(query).slice(0, 20);
      results = [...matchedCommands, ...contentResults];
    }
    this._results = results;
    const el = document.getElementById('cmdkResults'); if (!el) return;
    el.innerHTML = results.length ? results.map((r, i) => r.isCommand
      ? `<div class="cmdk-item" onclick="CmdK.runCommand(${i})"><span>${r.icon} ${esc(r.label)}</span><small>${esc(r.kind)}</small></div>`
      : `<div class="cmdk-item" onclick="CmdK.go('${r.route}','${r.id}')"><span>${r.icon} ${esc(r.title)}</span><small>${r.type}</small></div>`
    ).join('') : `<div class="cmdk-item subtle">No matches</div>`;
  },
  runCommand(i) { const r = this._results[i]; if (r && r.run) r.run(); },
  go(route, id) { CmdK.close(); UI.nav(route, { id }); }
};
const Search = {
  run(q) {
    q = (q || '').toLowerCase().trim();
    const out = [];
    (Cache.notes || []).forEach(n => { if (!q || (n.title + n.content).toLowerCase().includes(q)) out.push({ icon: '📝', title: n.title, type: 'Note', route: 'note', id: n.id }); });
    (Cache.pdfs || []).forEach(p => { if (!q || p.title.toLowerCase().includes(q)) out.push({ icon: '📄', title: p.title, type: 'PDF', route: 'pdf', id: p.id }); });
    (Cache.mnemonics || []).forEach(m => { if (!q || (m.title + m.mnemonicText + m.meaning).toLowerCase().includes(q)) out.push({ icon: '🧠', title: m.title, type: 'Mnemonic', route: 'mnemonics', id: m.id }); });
    (Cache.jargons || []).forEach(j => { if (!q || (j.term + j.meaning).toLowerCase().includes(q)) out.push({ icon: '🔤', title: j.term, type: 'Jargon', route: 'jargons', id: j.id }); });
    (Cache.questions || []).forEach(qq => { if (!q || qq.questionText.toLowerCase().includes(q)) out.push({ icon: '❓', title: qq.questionText.slice(0, 60), type: 'Question', route: 'questions', id: qq.id }); });
    return out;
  }
};

/* ============================== REVISION / FLASHCARDS VIEW ============================== */
const RevisionView = {
  mode: 'list',
  cardIndex: 0,
  showAnswer: false,
  render() {
    const due = Revision.dueItems();
    const kindLabel = (d) => d.type === 'note' ? 'Note' : d.obj.sourceType === 'question' ? 'Question' : 'Mnemonic';
    const kindIcon = (d) => d.type === 'note' ? '📝' : d.obj.sourceType === 'question' ? '❓' : '🧠';
    if (this.mode === 'list' || !due.length) {
      if (!due.length) return emptyState('🎉', 'Nothing due for revision right now.', null, null);
      return `<h2>Revision due today (${due.length})</h2>
      <button class="btn" style="margin-bottom:14px;" onclick="RevisionView.mode='cards';RevisionView.cardIndex=0;Router.render();">▶ Start Revision Session</button>
      ${due.map(d => `<div class="list-row"><span>${kindIcon(d)}</span>
        <div style="flex:1;">${esc(d.type === 'note' ? d.obj.title : d.obj.front)}</div>
        <span class="pill">${kindLabel(d)}</span></div>`).join('')}`;
    }
    // card mode
    if (this.cardIndex >= due.length) { this.mode = 'list'; toast('Revision session complete 🎉'); return this.render(); }
    const d = due[this.cardIndex];
    const front = d.type === 'note' ? d.obj.title : d.obj.front;
    const back = d.type === 'note' ? '(open the note to review in full)' : d.obj.back;
    return `<div class="subtle" style="margin-bottom:10px;">Card ${this.cardIndex + 1} of ${due.length} · ${kindLabel(d)}</div>
      <div class="flash-card" onclick="RevisionView.showAnswer=!RevisionView.showAnswer;Router.render();">
        ${this.showAnswer ? esc(back) : esc(front)}
      </div>
      <div class="subtle" style="text-align:center;margin-top:8px;">Tap card to flip</div>
      <div class="rate-row">
        <button class="again" onclick="RevisionView.rate('${d.type}','${d.obj.id}','again')">Again</button>
        <button class="hard" onclick="RevisionView.rate('${d.type}','${d.obj.id}','hard')">Hard</button>
        <button class="good" onclick="RevisionView.rate('${d.type}','${d.obj.id}','good')">Good</button>
        <button class="easy" onclick="RevisionView.rate('${d.type}','${d.obj.id}','easy')">Easy</button>
      </div>
      <div style="text-align:center;margin-top:16px;"><button class="btn secondary sm" onclick="RevisionView.mode='list';Router.render();">Exit session</button></div>`;
  },
  async rate(type, id, rating) {
    await Revision.rate(type, id, rating);
    this.cardIndex++; this.showAnswer = false; Router.render();
  }
};

/* ============================== EXAM MODE ============================== */
const ExamMode = {
  state: 'setup', // setup | question | summary
  queue: [], index: 0, answer: '', graded: false, timerSeconds: 0, timerInterval: null, results: [], minPerMark: 1.5,
  render() {
    if (this.state === 'summary') return this.renderSummary();
    if (this.state === 'question') return this.renderQuestion();
    return this.renderSetup();
  },
  renderSetup() {
    return `<h2>Exam Mode</h2>
      <p class="subtle">Attempt questions one at a time under a timer, then self-grade against the model answer.</p>
      <div class="card" style="max-width:420px;">
        <label>Subject</label>
        <select id="examSubject"><option value="">All subjects</option>${subjectOptions()}</select>
        <label>Difficulty</label>
        <select id="examDiff"><option value="">Any</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
        <label>Minutes per mark</label>
        <input type="number" id="examMinPerMark" value="1.5" step="0.5" min="0.5">
        <button class="btn" style="margin-top:12px;" onclick="ExamMode.start()">Start Exam</button>
      </div>`;
  },
  start() {
    const subj = document.getElementById('examSubject').value;
    const diff = document.getElementById('examDiff').value;
    this.minPerMark = parseFloat(document.getElementById('examMinPerMark').value) || 1.5;
    this.queue = (Cache.questions || []).filter(q => (!subj || q.subjectId === subj) && (!diff || q.difficulty === diff));
    if (!this.queue.length) { toast('No questions match those filters — add some in the Questions section first.'); return; }
    this.queue = [...this.queue].sort(() => Math.random() - 0.5);
    this.index = 0; this.results = []; this.state = 'question';
    this.beginTimerForCurrent();
    Router.render();
  },
  beginTimerForCurrent() {
    clearInterval(this.timerInterval);
    const q = this.queue[this.index];
    this.timerSeconds = Math.max(30, Math.round((q.marks || 5) * this.minPerMark * 60));
    this.graded = false; this.answer = '';
    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      const d = document.getElementById('examTimerDisplay');
      if (d) d.textContent = ExamMode.fmtTime();
      if (this.timerSeconds <= 0) { clearInterval(this.timerInterval); ExamMode.submit(); }
    }, 1000);
  },
  fmtTime() {
    const s = Math.max(0, this.timerSeconds);
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  },
  renderQuestion() {
    const q = this.queue[this.index];
    if (!q) { this.state = 'summary'; return this.renderSummary(); }
    if (!this.graded) {
      return `<div class="subtle">Question ${this.index + 1} of ${this.queue.length} · ${subjectName(q.subjectId)}</div>
        <div class="timer-display" id="examTimerDisplay" style="font-size:40px;margin:10px 0;">${this.fmtTime()}</div>
        <div class="card" style="max-width:640px;">
          <div style="display:flex;justify-content:space-between;gap:10px;"><b>${esc(q.questionText)}</b><span class="pill">${q.marks} marks</span></div>
          <label>Your answer</label>
          <textarea id="examAnswerBox" rows="6" oninput="ExamMode.answer=this.value">${esc(this.answer)}</textarea>
          <button class="btn" style="margin-top:10px;" onclick="ExamMode.submit()">Submit</button>
        </div>`;
    }
    return `<div class="subtle">Question ${this.index + 1} of ${this.queue.length}</div>
      <div class="card" style="max-width:640px;">
        <b>${esc(q.questionText)}</b>
        <hr class="sep">
        <label>Your answer</label>
        <div class="subtle" style="white-space:pre-wrap;padding:8px;background:var(--bg);border-radius:8px;">${esc(this.answer) || '(No answer given — time ran out or nothing was typed)'}</div>
        <label style="margin-top:12px;">Model answer</label>
        <div class="subtle" style="white-space:pre-wrap;padding:8px;background:var(--bg);border-radius:8px;">${esc(q.modelAnswer) || '(No model answer recorded)'}</div>
        <div class="rate-row" style="margin-top:14px;">
          <button class="good" onclick="ExamMode.grade('correct')">Correct</button>
          <button class="hard" onclick="ExamMode.grade('partial')">Partially correct</button>
          <button class="again" onclick="ExamMode.grade('incorrect')">Incorrect</button>
        </div>
        <div class="subtle" style="text-align:center;margin-top:8px;font-size:11.5px;">Grading also updates this question's flashcard revision schedule.</div>
      </div>`;
  },
  submit() {
    clearInterval(this.timerInterval);
    this.graded = true;
    Router.render();
  },
  grade(verdict) {
    const q = this.queue[this.index];
    q.status = verdict === 'correct' ? 'correct' : 'incorrect';
    saveItem('questions', q);
    const fc = Flashcards.findFor('question', q.id);
    if (fc) Revision.rate('flashcard', fc.id, verdict === 'correct' ? 'good' : verdict === 'partial' ? 'hard' : 'again');
    this.results.push({ questionText: q.questionText, verdict, marks: q.marks });
    this.index++;
    if (this.index >= this.queue.length) { this.state = 'summary'; Router.render(); return; }
    this.beginTimerForCurrent();
    Router.render();
  },
  renderSummary() {
    clearInterval(this.timerInterval);
    const total = this.results.length;
    const correct = this.results.filter(r => r.verdict === 'correct').length;
    const needsWork = total - correct;
    return `<h2>Exam Summary</h2>
      <div class="grid cols-3" style="margin-bottom:18px;">
        <div class="card"><div class="subtle">Attempted</div><h2 style="margin:6px 0;">${total}</h2></div>
        <div class="card"><div class="subtle">Correct</div><h2 style="margin:6px 0;">${correct}</h2></div>
        <div class="card"><div class="subtle">Needs work</div><h2 style="margin:6px 0;">${needsWork}</h2></div>
      </div>
      ${this.results.map(r => `<div class="list-row"><span>${r.verdict === 'correct' ? '✅' : r.verdict === 'partial' ? '🟡' : '🔴'}</span><div style="flex:1;">${esc(r.questionText)}</div><span class="pill">${r.marks} marks</span></div>`).join('')}
      <button class="btn" style="margin-top:16px;" onclick="ExamMode.reset()">Start another exam</button>`;
  },
  reset() { this.state = 'setup'; this.queue = []; this.index = 0; this.results = []; Router.render(); }
};

/* ============================== LAST-MINUTE REVISION MODE ============================== */
const LMR = {
  mode: 'setup', index: 0, items: [],
  gather(subjectId) {
    const items = [];
    (Cache.notes || []).forEach(n => {
      if (subjectId && n.subjectId !== subjectId) return;
      if (n.importance >= 4 || n.examFrequency === 'high' || n.status === 'difficult') {
        items.push({ type: 'Note', icon: '📝', title: n.title, body: stripHtml(n.content).slice(0, 500), tag: n.examFrequency === 'high' ? 'Exam Important' : (n.status === 'difficult' ? 'Difficult' : `★${n.importance}`) });
      }
    });
    (Cache.jargons || []).forEach(j => {
      if (subjectId && j.subjectId !== subjectId) return;
      if (j.importance && j.importance !== 'Normal') {
        items.push({ type: 'Jargon', icon: '🔤', title: j.term, body: j.meaning + (j.memoryTrick ? `\n💡 ${j.memoryTrick}` : ''), tag: j.importance });
      }
    });
    (Cache.questions || []).forEach(q => {
      if (subjectId && q.subjectId !== subjectId) return;
      if (q.difficulty === 'Hard') {
        items.push({ type: 'Question', icon: '❓', title: q.questionText, body: q.modelAnswer || '(No model answer recorded)', tag: 'Hard' });
      }
    });
    (Cache.mnemonics || []).forEach(m => {
      if (subjectId && topicSubjectId(m.topicId) !== subjectId) return;
      if (m.favorite) {
        items.push({ type: 'Mnemonic', icon: '🧠', title: m.title, body: `${m.mnemonicText}\n${m.meaning}`, tag: 'Favorite' });
      }
    });
    return items;
  },
  render() { return this.mode === 'setup' ? this.renderSetup() : this.renderStream(); },
  renderSetup() {
    return `<h2>Last-Minute Revision</h2>
      <p class="subtle">Rapid-fire through only your highest-priority content: ★4–5 notes, exam-important notes, difficult topics, must-memorize jargons, hard questions, and favorited mnemonics.</p>
      <div class="card" style="max-width:420px;">
        <label>Subject</label>
        <select id="lmrSubject"><option value="">All subjects</option>${subjectOptions()}</select>
        <button class="btn" style="margin-top:12px;" onclick="LMR.start()">Start</button>
      </div>`;
  },
  start() {
    const subj = document.getElementById('lmrSubject').value;
    this.items = this.gather(subj);
    if (!this.items.length) { toast('Nothing marked high-importance / exam-critical yet for this selection.'); return; }
    this.index = 0; this.mode = 'stream'; Router.render();
  },
  renderStream() {
    if (this.index >= this.items.length) {
      return `<div class="empty-state"><div style="font-size:38px;">🎉</div><h3>That's everything marked important.</h3>
      <button class="btn" onclick="LMR.reset()">Back to setup</button></div>`;
    }
    const it = this.items[this.index];
    return `<div class="subtle" style="margin-bottom:10px;">${this.index + 1} of ${this.items.length} · ${it.type}</div>
      <div class="card" style="max-width:640px;">
        <div style="display:flex;justify-content:space-between;gap:10px;"><b>${it.icon} ${esc(it.title)}</b><span class="pill warn">${esc(it.tag)}</span></div>
        <div class="subtle" style="white-space:pre-wrap;margin-top:10px;">${esc(it.body)}</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
        <button class="btn secondary" ${this.index === 0 ? 'disabled' : ''} onclick="LMR.index--;Router.render();">‹ Prev</button>
        <button class="btn" onclick="LMR.index++;Router.render();">Next ›</button>
      </div>
      <div style="text-align:center;margin-top:10px;"><button class="btn secondary sm" onclick="LMR.reset()">Exit</button></div>`;
  },
  reset() { this.mode = 'setup'; this.items = []; this.index = 0; Router.render(); }
};

/* ============================== STUDY TIMER / FOCUS MODE ============================== */
const Timer = {
  seconds: 25 * 60, running: false, interval: null, mode: '25/5',
  render() {
    return `<h2>Study Timer</h2>
    <div class="card" style="max-width:420px;">
      <div style="display:flex;gap:8px;">
        <button class="btn sm ${this.mode === '25/5' ? '' : 'secondary'}" onclick="Timer.setMode('25/5')">25 / 5</button>
        <button class="btn sm ${this.mode === '50/10' ? '' : 'secondary'}" onclick="Timer.setMode('50/10')">50 / 10</button>
        <button class="btn sm ${this.mode === 'custom' ? '' : 'secondary'}" onclick="Timer.setMode('custom')">Custom</button>
      </div>
      <div class="timer-display" id="timerDisplay">${Timer.fmt()}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn" onclick="Timer.start()">${this.running ? 'Pause' : 'Start'}</button>
        <button class="btn secondary" onclick="Timer.reset()">Reset</button>
      </div>
    </div>
    <hr class="sep">
    <h3>This week</h3>
    <div class="subtle">${(Cache.studySessions || []).filter(s => new Date(s.date) > new Date(Date.now() - 7 * 864e5)).reduce((a, b) => a + b.duration, 0)} min studied</div>`;
  },
  fmt() { const m = Math.floor(this.seconds / 60).toString().padStart(2, '0'); const s = (this.seconds % 60).toString().padStart(2, '0'); return `${m}:${s}`; },
  setMode(m) { this.mode = m; this.seconds = m === '25/5' ? 1500 : m === '50/10' ? 3000 : 1500; this.running = false; clearInterval(this.interval); Router.render(); },
  start() {
    if (this.running) { this.running = false; clearInterval(this.interval); Router.render(); return; }
    this.running = true;
    this.interval = setInterval(() => {
      this.seconds--;
      const d = document.getElementById('timerDisplay'); if (d) d.textContent = this.fmt();
      if (this.seconds <= 0) { clearInterval(this.interval); this.running = false; toast('Session complete!'); saveItem('studySessions', { id: uid(), duration: (this.mode === '25/5' ? 25 : 50), date: nowISO() }); Router.render(); }
    }, 1000);
    Router.render();
  },
  reset() { clearInterval(this.interval); this.running = false; this.setMode(this.mode); }
};

/* ============================== TRASH ============================== */
const TrashView = {
  render() {
    const items = Cache.trash || [];
    if (!items.length) return emptyState('🗑', 'Trash is empty.', null, null);
    return `<h2>Trash</h2>${items.map(t => `<div class="list-row">
      <span>🗑</span><div style="flex:1;">${esc(t.data.title || t.data.term || t.data.questionText || t.data.name || 'Item')}<div class="subtle">${t.type} · deleted ${fmtDate(t.deletedAt)}</div></div>
      <button class="btn sm secondary" onclick="restoreTrash('${t.id}');Router.render();">Restore</button>
      <button class="btn sm danger" onclick="TrashView.purge('${t.id}')">Delete forever</button>
    </div>`).join('')}
    ${items.length ? `<button class="btn danger sm" style="margin-top:12px;" onclick="TrashView.empty()">Empty Trash</button>` : ''}`;
  },
  async purge(id) { if (!confirm('Permanently delete?')) return; await DB.del('trash', id); Cache.trash = Cache.trash.filter(t => t.id !== id); Router.render(); },
  async empty() { if (!confirm('Empty trash permanently?')) return; await DB.clearStore('trash'); Cache.trash = []; Router.render(); }
};

/* ============================== SETTINGS VIEW ============================== */
const SettingsView = {
  render() {
    return `<h2>Settings</h2>
    <div class="card" style="max-width:520px;margin-bottom:14px;">
      <h4 style="margin-top:0;">Appearance</h4>
      <label>Theme</label>
      <select onchange="Settings.set('theme',this.value).then(()=>Theme.apply())">
        <option value="light" ${Settings.get('theme') === 'light' ? 'selected' : ''}>Light</option>
        <option value="dark" ${Settings.get('theme') === 'dark' ? 'selected' : ''}>Dark</option>
      </select>
    </div>
    <div class="card" style="max-width:520px;margin-bottom:14px;">
      <h4 style="margin-top:0;">Revision intervals (days)</h4>
      <input type="text" id="intervalsInput" value="${Settings.get('revisionIntervals').join(', ')}">
      <button class="btn sm" style="margin-top:8px;" onclick="SettingsView.saveIntervals()">Save intervals</button>
    </div>
    <div class="card" style="max-width:520px;margin-bottom:14px;">
      <h4 style="margin-top:0;">Backup & Restore</h4>
      <p class="subtle">Export everything (notes, subjects, questions, mnemonics, jargons, revision data, settings, annotations, bookmarks) to a JSON file. PDFs are excluded from JSON backup — export them separately below.</p>
      <button class="btn sm" onclick="BackupService.exportJSON()">⬇ Export backup (.json)</button>
      <input type="file" id="restoreInput" accept="application/json" style="display:none" onchange="BackupService.importJSON(this)">
      <button class="btn sm secondary" onclick="document.getElementById('restoreInput').click()">⬆ Restore from backup</button>
    </div>
    <div class="card" style="max-width:520px;">
      <h4 style="margin-top:0;">About</h4>
      <p class="subtle">CA Study — a local-first revision workspace. All data is stored in this browser's IndexedDB; nothing leaves your device unless you export it.</p>
    </div>`;
  },
  async saveIntervals() {
    const arr = document.getElementById('intervalsInput').value.split(',').map(x => parseInt(x.trim())).filter(n => !isNaN(n));
    if (!arr.length) return;
    await Settings.set('revisionIntervals', arr); toast('Intervals updated');
  }
};

const BackupService = {
  async exportJSON() {
    const data = {};
    for (const s of STORES) { if (s === 'pdfs') continue; data[s] = Cache[s]; }
    data.pdfsMeta = (Cache.pdfs || []).map(p => ({ id: p.id, filename: p.filename, title: p.title, pageCount: p.pageCount }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `castudy-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  },
  importJSON(input) {
    const file = input.files[0]; if (!file) return;
    if (!confirm('Restoring will merge this backup into your existing data. Continue?')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        for (const s of STORES) {
          if (s === 'pdfs' || !data[s]) continue;
          for (const obj of data[s]) await DB.put(s, obj);
        }
        await loadAllToCache();
        toast('Backup restored'); Tree.render(); Router.render();
      } catch (e) { toast('Invalid backup file'); }
    };
    reader.readAsText(file);
  }
};

/* ============================== DASHBOARD ============================== */
function subjectProgress() {
  return (Cache.subjects || []).map(s => {
    const chapters = (Cache.chapters || []).filter(c => c.subjectId === s.id);
    const topics = chapters.flatMap(c => (Cache.topics || []).filter(t => t.chapterId === c.id));
    const notes = (Cache.notes || []).filter(n => n.subjectId === s.id);
    const mastered = notes.filter(n => n.status === 'mastered').length;
    const pct = notes.length ? Math.round((mastered / notes.length) * 100) : (topics.length ? 5 : 0);
    return { subject: s, pct, notesCount: notes.length, topicsCount: topics.length };
  });
}
function emptyState(icon, msg, btnLabel, btnAction) {
  return `<div class="empty-state"><div style="font-size:38px;">${icon}</div><h3>${esc(msg)}</h3>
    ${btnLabel ? `<button class="btn" onclick="${btnAction}">${esc(btnLabel)}</button>` : ''}</div>`;
}
const Dashboard = {
  render() {
    const notes = Cache.notes || [];
    const recentNotes = [...notes].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 5);
    const due = Revision.dueItems();
    const todayMins = (Cache.studySessions || []).filter(s => new Date(s.date).toDateString() === new Date().toDateString()).reduce((a, b) => a + b.duration, 0);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const progress = subjectProgress();
    if (!Cache.courses.length) {
      return emptyState('📘', 'Create your first course to start building your CA study workspace.', 'Create Course', 'Courses.promptNew()');
    }
    return `
    <h2 style="margin-bottom:2px;">${greeting}, Varun</h2>
    <p class="subtle" style="margin-top:0;">Let's continue your CA preparation.</p>
    <div class="grid cols-3" style="margin:18px 0;">
      <div class="card"><div class="subtle">Today's study time</div><h2 style="margin:6px 0;">${todayMins} min</h2></div>
      <div class="card"><div class="subtle">Notes created</div><h2 style="margin:6px 0;">${notes.length}</h2></div>
      <div class="card"><div class="subtle">Revision due today</div><h2 style="margin:6px 0;">${due.length}</h2></div>
    </div>
    ${due.length ? `<div class="card" style="margin-bottom:18px;background:var(--accent-soft);border:none;">
      <b>${due.length} topics due for revision</b>
      <div style="margin-top:8px;"><button class="btn sm" onclick="UI.nav('revision')">Start Revision</button></div>
    </div>` : ''}
    <h3>Continue studying</h3>
    ${recentNotes.length ? recentNotes.map(n => `<div class="list-row" onclick="UI.nav('note',{id:'${n.id}'})">
      <span>📝</span><div style="flex:1;">${esc(n.title)}<div class="subtle">${subjectName(n.subjectId)} · updated ${fmtDateShort(n.updatedAt || n.createdAt)}</div></div>
    </div>`).join('') : `<div class="subtle">No notes yet — create your first one.</div>`}
    <h3 style="margin-top:22px;">Subject progress</h3>
    ${progress.length ? progress.map(p => `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:13.5px;"><span>${esc(p.subject.name)}</span><span class="subtle">${p.pct}%</span></div>
      <div class="progress-bar"><div style="width:${p.pct}%"></div></div>
    </div>`).join('') : `<div class="subtle">Add subjects to a course to see progress.</div>`}
    <h3 style="margin-top:22px;">Quick actions</h3>
    <div class="note-meta-row">
      <button class="btn secondary sm" onclick="Notes.promptNew()">+ New Note</button>
      <button class="btn secondary sm" onclick="UI.nav('pdfs')">+ Import PDF</button>
      <button class="btn secondary sm" onclick="Mnemonics.promptNew()">+ Add Mnemonic</button>
      <button class="btn secondary sm" onclick="Questions.promptNew()">+ Add Question</button>
    </div>`;
  }
};

/* ============================== TOPIC VIEW ============================== */
function TopicView(id) {
  const topic = (Cache.topics || []).find(t => t.id === id);
  if (!topic) return `<div class="empty-state"><h3>Topic not found</h3></div>`;
  const chapter = (Cache.chapters || []).find(c => c.id === topic.chapterId);
  const notes = (Cache.notes || []).filter(n => n.topicId === id);
  const mnemonics = (Cache.mnemonics || []).filter(m => m.topicId === id);
  const questions = (Cache.questions || []).filter(q => q.topicId === id);
  return `
  <div class="subtle">${subjectName(chapter?.subjectId)} › ${esc(chapter?.name || '')}</div>
  <h2 style="margin-top:2px;">${esc(topic.name)}</h2>
  <div class="note-meta-row" style="margin-bottom:16px;">
    <button class="btn sm" onclick="Notes.promptNew('${id}')">+ Note</button>
    <button class="btn sm secondary" onclick="Mnemonics.promptNew('${id}')">+ Mnemonic</button>
    <button class="btn sm secondary" onclick="Questions.promptNew('${id}')">+ Question</button>
  </div>
  <h3>Notes</h3>
  ${notes.length ? notes.map(n => `<div class="list-row" onclick="UI.nav('note',{id:'${n.id}'})"><span>📝</span><div style="flex:1;">${esc(n.title)}</div></div>`).join('') : `<div class="subtle">No notes yet.</div>`}
  <h3 style="margin-top:18px;">Mnemonics</h3>
  ${mnemonics.length ? mnemonics.map(m => `<div class="card" style="margin-bottom:8px;"><b>${esc(m.title)}</b> — <span class="pill">${esc(m.mnemonicText)}</span></div>`).join('') : `<div class="subtle">None yet.</div>`}
  <h3 style="margin-top:18px;">Questions</h3>
  ${questions.length ? questions.map(q => `<div class="subtle" style="margin-bottom:6px;">❓ ${esc(q.questionText)}</div>`).join('') : `<div class="subtle">None yet.</div>`}
  `;
}

/* ============================== ROUTER ============================== */
const Router = {
  render() {
    const el = document.getElementById('content');
    let html = '';
    switch (UI.route) {
      case 'dashboard': html = Dashboard.render(); break;
      case 'topic': html = TopicView(UI.params.id); break;
      case 'note': html = Notes.render(UI.params.id); break;
      case 'pdfs': html = Pdfs.renderLibrary(); break;
      case 'pdf': el.innerHTML = ''; Pdfs.renderViewer(UI.params.id).then(h => { el.innerHTML = h; }); return;
      case 'mnemonics': html = Mnemonics.render(); break;
      case 'jargons': html = Jargons.render(); break;
      case 'questions': html = Questions.render(); break;
      case 'revision': html = RevisionView.render(); break;
      case 'exam': html = ExamMode.render(); break;
      case 'lmr': html = LMR.render(); break;
      case 'bookmarks': html = Bookmarks.render(); break;
      case 'focus': html = Timer.render(); break;
      case 'trash': html = TrashView.render(); break;
      case 'settings': html = SettingsView.render(); break;
      default: html = Dashboard.render();
    }
    el.className = 'content' + (['note'].includes(UI.route) ? '' : ' narrow');
    if (UI.route === 'pdf') el.className = 'content';
    el.innerHTML = html;
    updateRevBadge();
  }
};

/* ============================== SEED DEMO DATA ============================== */
async function seedIfEmpty() {
  if (Cache.courses.length) return;
  const courseId = uid();
  await saveItem('courses', { id: courseId, name: 'CA Intermediate', createdAt: nowISO() });
  const subj = { id: uid(), courseId, name: 'GST', color: '#6b5b3e', createdAt: nowISO() };
  await saveItem('subjects', subj);
  const chap = { id: uid(), subjectId: subj.id, name: 'Input Tax Credit', createdAt: nowISO() };
  await saveItem('chapters', chap);
  const topic = { id: uid(), chapterId: chap.id, name: 'Section 16 — Eligibility', createdAt: nowISO() };
  await saveItem('topics', topic);
  const note = {
    id: uid(), title: 'Conditions for claiming ITC', topicId: topic.id, chapterId: chap.id, subjectId: subj.id,
    content: `<h2>Conditions for ITC</h2><p>A registered person can claim <mark class="y">Input Tax Credit</mark> only if all of the following conditions are satisfied:</p>
    <p>1. Possession of a valid <mark class="g">tax invoice</mark></p><p>2. Goods or services have actually been received</p>
    <p>3. Tax on the supply has actually been paid to the government</p><p>4. Return has been filed</p>
    <blockquote>This is a fictional educational example, not reproduced ICAI material.</blockquote>`,
    tags: ['ITC', 'GST'], importance: 5, examFrequency: 'high', status: 'learning', createdAt: nowISO(),
    revision: Revision.schedule(0)
  };
  await saveItem('notes', note);
  const mnem = await saveItem('mnemonics', { id: uid(), title: 'ITC Conditions', mnemonicText: 'RITE', meaning: 'R = Registered person\nI = Invoice\nT = Tax paid\nE = Eligible use', topicId: topic.id, tags: [], favorite: true, createdAt: nowISO() });
  await saveItem('jargons', { id: uid(), term: 'Input Tax Credit', meaning: 'Credit for tax paid on inward supplies, available for set-off against output tax liability.', memoryTrick: 'Think: tax you paid IN, credited back.', subjectId: subj.id, importance: 'Important', tags: [], createdAt: nowISO() });
  const q = await saveItem('questions', { id: uid(), questionText: 'Explain the conditions for claiming Input Tax Credit under GST.', type: 'Theory', marks: 5, difficulty: 'Medium', modelAnswer: 'A registered person must hold a valid tax invoice, have received the goods/services, the supplier must have paid the tax, and the return must be filed. (Illustrative answer.)', topicId: topic.id, chapterId: chap.id, subjectId: subj.id, status: 'not-attempted', personalAnswer: '', createdAt: nowISO() });
  await Flashcards.generateForMnemonic(mnem);
  await Flashcards.generateForQuestion(q);
  await loadAllToCache();
}

/* ============================== KEYBOARD SHORTCUTS ============================== */
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); CmdK.open(); }
  else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); Notes.promptNew(); }
  else if (e.key === 'Escape') { CmdK.close(); Modal.close(); }
});

/* ============================== BOOT ============================== */
async function boot() {
  await DB.open();
  await loadAllToCache();
  STORES.forEach(s => Cache[s] = Cache[s] || []);
  await seedIfEmpty();
  Theme.apply();
  Tree.render();
  UI.nav('dashboard');
  if (window.innerWidth <= 860) document.getElementById('menuBtn').style.display = '';
  document.getElementById('menuBtn').style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none';
  window.addEventListener('resize', () => { document.getElementById('menuBtn').style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none'; });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* fine if not hosted */ });
  }
}
boot();
