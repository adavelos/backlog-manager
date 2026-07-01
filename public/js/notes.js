// ============================================
// Backlog Manager — Notes Page Logic
// ============================================

// --- Notes-specific state ---
let selectedNoteId = null;

// DOM refs (notes tree)
const notesTreeEl = document.getElementById("notesTree");

// DOM refs (notes editor)
const notesEditorEmpty = document.getElementById("notesEditorEmpty");
const notesEditorContent = document.getElementById("notesEditorContent");
const noteTitleInput = document.getElementById("noteTitleInput");
const noteContentInput = document.getElementById("noteContentInput");
const notePreview = document.getElementById("notePreview");
const noteContextLabel = document.getElementById("noteContextLabel");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const deleteNoteBtn = document.getElementById("deleteNoteBtn");

// --- URL state ---

function serializeState() {
  const params = new URLSearchParams();
  if (activeProjectType !== "work") params.set("type", activeProjectType);
  if (selectedNoteId) params.set("note", selectedNoteId);
  return params.toString();
}

function saveStateToUrl() {
  const qs = serializeState();
  const url = qs ? window.location.pathname + "?" + qs : window.location.pathname;
  _suppressPopstate = true;
  history.pushState(null, "", url);
  _suppressPopstate = false;
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("type")) activeProjectType = params.get("type");
  if (params.has("note")) selectedNoteId = params.get("note");
}

window.addEventListener("popstate", () => {
  if (_suppressPopstate) return;
  loadStateFromUrl();
  renderAll();
});

// --- Notes tree rendering ---

function renderNotesTree() {
  if (!notesTreeEl) return;
  notesTreeEl.innerHTML = "";

  const scopeProjects = data.projects.filter(p => p.type === activeProjectType);

  if (scopeProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <div class="empty-state-text">No projects yet</div>
      <div class="empty-state-sub">Create a ${activeProjectType} project to add notes</div>
    `;
    notesTreeEl.appendChild(empty);
    return;
  }

  scopeProjects.forEach(project => {
    const releases = project.releases || [];
    const projectNotes = data.notes.filter(n => n.projectId === project.id);

    const projDiv = document.createElement("div");
    projDiv.className = "notes-tree-project";

    const projHeader = document.createElement("div");
    projHeader.className = "notes-tree-project-header";
    projHeader.textContent = project.name;
    projHeader.addEventListener("click", () => {
      projDiv.classList.toggle("collapsed");
    });
    projDiv.appendChild(projHeader);

    if (releases.length === 0) {
      const orphanNotes = projectNotes.filter(n => !n.releaseId);
      if (orphanNotes.length > 0) {
        const orphanDiv = document.createElement("div");
        orphanDiv.className = "notes-tree-release";
        const orphanHdr = document.createElement("div");
        orphanHdr.className = "notes-tree-release-header";
        const orphanHdrSpan = document.createElement("span");
        orphanHdrSpan.textContent = "(no release)";
        orphanHdr.appendChild(orphanHdrSpan);
        orphanDiv.appendChild(orphanHdr);

        const notesDiv = document.createElement("div");
        notesDiv.className = "notes-tree-notes";
        orphanNotes.forEach(n => {
          notesDiv.appendChild(createNoteLeafButton(n));
        });
        orphanDiv.appendChild(notesDiv);
        projDiv.appendChild(orphanDiv);
      }
    }

    releases.forEach(release => {
      const releaseNotes = projectNotes.filter(n => n.releaseId === release.id);

      const relDiv = document.createElement("div");
      relDiv.className = "notes-tree-release";

      const relHeader = document.createElement("div");
      relHeader.className = "notes-tree-release-header";

      const relNameSpan = document.createElement("span");
      relNameSpan.textContent = release.name;
      relHeader.appendChild(relNameSpan);

      const addNoteBtn = document.createElement("button");
      addNoteBtn.className = "btn-inline-sm";
      addNoteBtn.dataset.releaseId = release.id;
      addNoteBtn.textContent = "+ Note";
      addNoteBtn.addEventListener("click", e => {
        e.stopPropagation();
        createNoteForRelease(project.id, release.id);
      });
      relHeader.appendChild(addNoteBtn);

      relDiv.appendChild(relHeader);

      const notesDiv = document.createElement("div");
      notesDiv.className = "notes-tree-notes";
      releaseNotes.forEach(n => {
        notesDiv.appendChild(createNoteLeafButton(n));
      });
      relDiv.appendChild(notesDiv);
      projDiv.appendChild(relDiv);
    });

    notesTreeEl.appendChild(projDiv);
  });

  // Maintain selection state after re-render
  if (selectedNoteId && data.notes.find(n => n.id === selectedNoteId)) {
    document.querySelectorAll(".notes-tree-note").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.noteId === selectedNoteId);
    });
    showNotesEditorContent();
  } else {
    selectedNoteId = null;
    showNotesEmptyState();
  }
}

function createNoteLeafButton(note) {
  const row = document.createElement("div");
  row.className = "notes-tree-note-row";

  const btn = document.createElement("button");
  btn.className = "notes-tree-note";
  btn.dataset.noteId = note.id;
  btn.textContent = note.title || "Untitled note";
  if (note.id === selectedNoteId) {
    btn.classList.add("active");
  }
  btn.addEventListener("click", () => selectNote(note.id));
  row.appendChild(btn);

  const delBtn = document.createElement("button");
  delBtn.className = "notes-tree-note-delete";
  delBtn.innerHTML = "&times;";
  delBtn.title = "Delete note";
  delBtn.addEventListener("click", async e => {
    e.stopPropagation();
    const ok = await showConfirm("Delete note", `Delete "${note.title}"? This cannot be undone.`);
    if (!ok) return;
    if (note.id === selectedNoteId) {
      selectedNoteId = null;
      if (noteTitleInput) noteTitleInput.value = "";
      if (noteContentInput) noteContentInput.value = "";
      if (notePreview) notePreview.innerHTML = "";
      if (noteContextLabel) noteContextLabel.textContent = "";
      showNotesEmptyState();
    }
    data.notes = data.notes.filter(n => n.id !== note.id);
    saveDataToServer();
    renderNotesTree();
  });
  row.appendChild(delBtn);

  return row;
}

// --- Note selection & editor ---

function selectNote(noteId) {
  selectedNoteId = noteId;
  const note = data.notes.find(n => n.id === noteId);
  if (!note) {
    if (noteTitleInput) noteTitleInput.value = "";
    if (noteContentInput) noteContentInput.value = "";
    if (notePreview) notePreview.innerHTML = "";
    if (noteContextLabel) noteContextLabel.textContent = "";
    showNotesEmptyState();
    return;
  }

  showNotesEditorContent();

  if (noteTitleInput) noteTitleInput.value = note.title || "";
  if (noteContentInput) noteContentInput.value = note.content || "";
  renderNotePreview();

  const project = data.projects.find(p => p.id === note.projectId);
  const release = project ? (project.releases || []).find(r => r.id === note.releaseId) : null;
  const projectName = project ? project.name : note.projectId;
  const releaseName = release ? release.name : (note.releaseId || "(no release)");
  if (noteContextLabel) {
    noteContextLabel.textContent = `${projectName} / ${releaseName}`;
  }

  document.querySelectorAll(".notes-tree-note").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.noteId === noteId);
  });
}

function showNotesEmptyState() {
  if (notesEditorEmpty) notesEditorEmpty.classList.remove("hidden");
  if (notesEditorContent) notesEditorContent.classList.add("hidden");
}

function showNotesEditorContent() {
  if (notesEditorEmpty) notesEditorEmpty.classList.add("hidden");
  if (notesEditorContent) notesEditorContent.classList.remove("hidden");
}

function createNoteForRelease(projectId, releaseId) {
  const note = {
    id: "note-" + generateId(),
    projectId: projectId,
    releaseId: releaseId,
    title: "Untitled note",
    content: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  data.notes.push(note);
  selectedNoteId = note.id;
  saveDataToServer();
  renderNotesTree();
  selectNote(note.id);
}

function renderNotePreview() {
  if (!noteContentInput || !notePreview) return;
  const md = noteContentInput.value || "";
  if (typeof marked !== "undefined") {
    notePreview.innerHTML = marked.parse(md);
  } else {
    notePreview.innerHTML = md.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  }
}

// --- Main render orchestrator ---

function renderAll() {
  renderHeaderTypeToggle();
  renderNotesTree();
  saveStateToUrl();
}

// --- Event wiring (editor) ---

if (saveNoteBtn) {
  saveNoteBtn.addEventListener("click", () => {
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    note.title = noteTitleInput ? (noteTitleInput.value || "Untitled note") : "Untitled note";
    note.content = noteContentInput ? (noteContentInput.value || "") : "";
    note.updatedAt = Date.now();
    renderNotesTree();
    saveDataToServer();
  });
}

if (deleteNoteBtn) {
  deleteNoteBtn.addEventListener("click", async () => {
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    const ok = await showConfirm("Delete note", `Delete "${note.title}"? This cannot be undone.`);
    if (!ok) return;
    data.notes = data.notes.filter(n => n.id !== selectedNoteId);
    selectedNoteId = null;
    if (noteTitleInput) noteTitleInput.value = "";
    if (noteContentInput) noteContentInput.value = "";
    if (notePreview) notePreview.innerHTML = "";
    if (noteContextLabel) noteContextLabel.textContent = "";
    showNotesEmptyState();
    renderNotesTree();
    saveDataToServer();
  });
}

// Live Markdown preview as user types
if (noteContentInput) {
  noteContentInput.addEventListener("input", renderNotePreview);
}

// --- Init (wait for common.js, then render) ---

document.addEventListener("app:ready", () => {
  loadStateFromUrl();
  renderAll();
});
