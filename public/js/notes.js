// ============================================
// Backlog Manager — Notes Page Logic
// ============================================

// --- Notes-specific state ---
let selectedNoteId = null;
let selectedScratchpad = false;  // true when scratchpad is selected

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

// DOM refs (scratchpad editor)
const notesScratchpadEditor = document.getElementById("notesScratchpadEditor");
const scratchpadInput = document.getElementById("scratchpadInput");
const scratchpadTimestampBtn = document.getElementById("scratchpadTimestampBtn");
const scratchpadConvertBtn = document.getElementById("scratchpadConvertBtn");
const scratchpadClearBtn = document.getElementById("scratchpadClearBtn");

// --- URL state ---

function serializeState() {
  const params = new URLSearchParams();
  if (activeProjectType !== "work") params.set("type", activeProjectType);
  if (selectedScratchpad) {
    params.set("scratchpad", "1");
  } else if (selectedNoteId) {
    params.set("note", selectedNoteId);
  }
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
  if (params.has("scratchpad")) {
    selectedScratchpad = true;
    selectedNoteId = null;
  } else if (params.has("note")) {
    selectedNoteId = params.get("note");
    selectedScratchpad = false;
  }
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

  // Scratchpad pinned entry at top
  const scratchpadEntry = document.createElement("div");
  scratchpadEntry.className = "notes-scratchpad-entry";
  const scratchpadBtn = document.createElement("button");
  scratchpadBtn.className = "scratchpad-btn" + (selectedScratchpad ? " active" : "");
  scratchpadBtn.textContent = "📝 Scratchpad";
  scratchpadBtn.addEventListener("click", selectScratchpad);
  scratchpadEntry.appendChild(scratchpadBtn);
  notesTreeEl.appendChild(scratchpadEntry);

  const scopeProjects = data.projects.filter(p => p.type === activeProjectType)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

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
    // Get all notes for this project (regardless of releaseId for backwards compatibility)
    const projectNotes = data.notes.filter(n => n.projectId === project.id);

    const projDiv = document.createElement("div");
    projDiv.className = "notes-tree-project";

    const projHeader = document.createElement("div");
    projHeader.className = "notes-tree-project-header";
    const projNameSpan = document.createElement("span");
    projNameSpan.textContent = project.name;
    projNameSpan.addEventListener("click", () => {
      projDiv.classList.toggle("collapsed");
    });
    projHeader.appendChild(projNameSpan);

    const addProjNoteBtn = document.createElement("button");
    addProjNoteBtn.className = "btn-inline-sm";
    addProjNoteBtn.textContent = "+ Note";
    addProjNoteBtn.addEventListener("click", e => {
      e.stopPropagation();
      createNoteForProject(project.id);
    });
    projHeader.appendChild(addProjNoteBtn);

    projDiv.appendChild(projHeader);

    // Display all notes for this project directly under the project (no release hierarchy)
    if (projectNotes.length > 0) {
      const notesDiv = document.createElement("div");
      notesDiv.className = "notes-tree-notes";
      projectNotes.forEach(n => {
        notesDiv.appendChild(createNoteLeafButton(n));
      });
      projDiv.appendChild(notesDiv);
    }

    notesTreeEl.appendChild(projDiv);
  });

  // Maintain selection state after re-render
  if (selectedScratchpad) {
    document.querySelectorAll(".scratchpad-btn").forEach(btn => {
      btn.classList.toggle("active", true);
    });
    showScratchpadEditor();
  } else if (selectedNoteId && data.notes.find(n => n.id === selectedNoteId)) {
    document.querySelectorAll(".notes-tree-note").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.noteId === selectedNoteId);
    });
    showNotesEditorContent();
  } else {
    selectedNoteId = null;
    selectedScratchpad = false;
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
    renderNotesTree();
    syncMutation(() => apiDeleteNote(note.id), {
      errorMessage: "Failed to delete note"
    });
  });
  row.appendChild(delBtn);

  return row;
}

// --- Note selection & editor ---

function selectNote(noteId) {
  selectedNoteId = noteId;
  selectedScratchpad = false;
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
  const projectName = project ? project.name : note.projectId;
  if (noteContextLabel) {
    noteContextLabel.textContent = projectName;
  }

  document.querySelectorAll(".notes-tree-note").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.noteId === noteId);
  });
}

function selectScratchpad() {
  selectedScratchpad = true;
  selectedNoteId = null;
  showScratchpadEditor();
  document.querySelectorAll(".scratchpad-btn").forEach(btn => {
    btn.classList.add("active");
  });
  if (scratchpadInput) {
    setTimeout(() => scratchpadInput.focus(), 50);
  }
  saveStateToUrl();
}

function showNotesEmptyState() {
  if (notesEditorEmpty) notesEditorEmpty.classList.remove("hidden");
  if (notesEditorContent) notesEditorContent.classList.add("hidden");
  if (notesScratchpadEditor) notesScratchpadEditor.classList.add("hidden");
}

function showNotesEditorContent() {
  if (notesEditorEmpty) notesEditorEmpty.classList.add("hidden");
  if (notesEditorContent) notesEditorContent.classList.remove("hidden");
  if (notesScratchpadEditor) notesScratchpadEditor.classList.add("hidden");
}

function showScratchpadEditor() {
  if (notesEditorEmpty) notesEditorEmpty.classList.add("hidden");
  if (notesEditorContent) notesEditorContent.classList.add("hidden");
  if (notesScratchpadEditor) notesScratchpadEditor.classList.remove("hidden");
  if (scratchpadInput) {
    scratchpadInput.value = data.scratchpads[activeProjectType].content || "";
  }
}

function createNoteForProject(projectId) {
  const note = {
    id: "note-" + generateId(),
    projectId: projectId,
    releaseId: null,
    title: "Untitled note",
    content: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  data.notes.push(note);
  selectedNoteId = note.id;
  selectedScratchpad = false;
  renderNotesTree();
  selectNote(note.id);
  syncMutation(() => apiCreateNote(note), {
    errorMessage: "Failed to create note"
  });
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

// --- Scratchpad functions ---

function insertTimestamp() {
  if (!scratchpadInput) return;
  const now = new Date();
  const timestamp = now.toLocaleString();
  const start = scratchpadInput.selectionStart;
  const end = scratchpadInput.selectionEnd;
  const before = scratchpadInput.value.substring(0, start);
  const after = scratchpadInput.value.substring(end);
  scratchpadInput.value = before + `[${timestamp}]` + after;
  scratchpadInput.selectionStart = scratchpadInput.selectionEnd = start + timestamp.length + 2;
  updateScratchpad();
  scratchpadInput.focus();
}

async function convertScratchpadToNote() {
  const scratchpadContent = data.scratchpads[activeProjectType].content || "";
  if (!scratchpadContent.trim()) {
    showToast("Scratchpad is empty");
    return;
  }

  // Build a list of projects for selection
  const scopeProjects = data.projects.filter(p => p.type === activeProjectType);
  if (scopeProjects.length === 0) {
    showToast("No projects available for this type");
    return;
  }

  const projectOptions = scopeProjects.map(p => ({
    value: p.id,
    label: p.name
  }));

  // Modal to select project and title (notes are now 1-1 with projects)
  const result = await openModal({
    title: "Convert scratchpad to note",
    bodyHtml: `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Project</label>
          <select id="convertProjectSelect" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: var(--font); font-size: 13px; background: var(--bg-muted); color: var(--text-primary);">
            ${projectOptions.map(opt => `<option value="${opt.value}">${escapeHtml(opt.label)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Note title</label>
          <input type="text" id="convertNoteTitle" placeholder="e.g., My captured note" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: var(--font); font-size: 13px; background: var(--bg-muted); color: var(--text-primary);">
        </div>
        <div style="display: flex; gap: 6px;">
          <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary);">
            <input type="checkbox" id="convertKeepScratchpad" checked>
            Keep scratchpad after conversion
          </label>
        </div>
      </div>
    `,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      {
        label: "Convert",
        className: "modal-btn-primary",
        getValues: () => {
          const projectSelect = document.getElementById("convertProjectSelect");
          const titleInput = document.getElementById("convertNoteTitle");
          const keepCheckbox = document.getElementById("convertKeepScratchpad");
          return {
            projectId: projectSelect.value,
            title: titleInput.value.trim() || "Untitled note",
            keepScratchpad: keepCheckbox.checked
          };
        },
        focused: true
      }
    ]
  });

  if (!result || result === "__cancel__" || result === null) return;

  // Create the note (no release association - notes are now 1-1 with projects)
  const note = {
    id: "note-" + generateId(),
    projectId: result.projectId,
    releaseId: null,
    title: result.title,
    content: scratchpadContent,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  data.notes.push(note);

  // Clear or keep scratchpad based on checkbox
  if (!result.keepScratchpad) {
    data.scratchpads[activeProjectType].content = "";
  }

  // Save and select new note
  selectedNoteId = note.id;
  selectedScratchpad = false;
  renderNotesTree();
  selectNote(note.id);
  syncMutation(() => apiCreateNote(note), {
    errorMessage: "Failed to create note"
  });
  showToast("Note created from scratchpad");
}

async function clearScratchpad() {
  const ok = await showConfirm("Clear scratchpad", "Are you sure? This will delete all unsaved content.");
  if (!ok) return;
  data.scratchpads[activeProjectType].content = "";
  if (scratchpadInput) scratchpadInput.value = "";
  updateScratchpad();
}

function updateScratchpad() {
  if (!scratchpadInput) return;
  data.scratchpads[activeProjectType].content = scratchpadInput.value || "";
  data.scratchpads[activeProjectType].updatedAt = Date.now();
  debouncedSaveScratchpad();
}

// --- Main render orchestrator ---

function renderAll() {
  renderHeaderTypeToggle();
  renderNotesTree();
  saveStateToUrl();
}

// --- Event wiring (editor) ---

// Debounces rapid typing into a single scoped PATCH per note.
const debouncedSaveNote = debounce((noteId, patch) => {
  syncMutation(() => apiUpdateNote(noteId, patch), {
    errorMessage: "Failed to save note"
  });
}, 1000);

const debouncedSaveScratchpad = debounce(() => {
  syncMutation(() => apiUpdateScratchpad(activeProjectType, data.scratchpads[activeProjectType]), {
    errorMessage: "Failed to save scratchpad"
  });
}, 1000);

if (saveNoteBtn) {
  saveNoteBtn.addEventListener("click", () => {
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    note.title = noteTitleInput ? (noteTitleInput.value || "Untitled note") : "Untitled note";
    note.content = noteContentInput ? (noteContentInput.value || "") : "";
    note.updatedAt = Date.now();
    renderNotesTree();
    syncMutation(() => apiUpdateNote(note.id, { title: note.title, content: note.content }), {
      errorMessage: "Failed to save note"
    });
  });
}

if (deleteNoteBtn) {
  deleteNoteBtn.addEventListener("click", async () => {
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    const ok = await showConfirm("Delete note", `Delete "${note.title}"? This cannot be undone.`);
    if (!ok) return;
    const noteId = selectedNoteId;
    data.notes = data.notes.filter(n => n.id !== selectedNoteId);
    selectedNoteId = null;
    if (noteTitleInput) noteTitleInput.value = "";
    if (noteContentInput) noteContentInput.value = "";
    if (notePreview) notePreview.innerHTML = "";
    if (noteContextLabel) noteContextLabel.textContent = "";
    showNotesEmptyState();
    renderNotesTree();
    syncMutation(() => apiDeleteNote(noteId), {
      errorMessage: "Failed to delete note"
    });
  });
}

// Live Markdown preview + auto-save as user types
if (noteContentInput) {
  noteContentInput.addEventListener("input", () => {
    renderNotePreview();
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    note.content = noteContentInput.value || "";
    note.updatedAt = Date.now();
    debouncedSaveNote(note.id, { title: note.title, content: note.content });
  });
}

if (noteTitleInput) {
  noteTitleInput.addEventListener("input", () => {
    if (!selectedNoteId) return;
    const note = data.notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    note.title = noteTitleInput.value || "Untitled note";
    note.updatedAt = Date.now();
    renderNotesTree();
    debouncedSaveNote(note.id, { title: note.title, content: note.content });
  });
}

// Scratchpad input + auto-save
if (scratchpadInput) {
  scratchpadInput.addEventListener("input", updateScratchpad);
}

if (scratchpadTimestampBtn) {
  scratchpadTimestampBtn.addEventListener("click", insertTimestamp);
}

if (scratchpadConvertBtn) {
  scratchpadConvertBtn.addEventListener("click", convertScratchpadToNote);
}

if (scratchpadClearBtn) {
  scratchpadClearBtn.addEventListener("click", clearScratchpad);
}

// --- Init (wait for common.js, then render) ---

document.addEventListener("app:ready", () => {
  loadStateFromUrl();
  renderAll();
});
