// ============================================
// Backlog Manager — Projects Page Logic
// ============================================

// --- Projects-specific state ---
let selectedProjectId = null;

// DOM refs
const addProjectBtn = document.getElementById("addProjectBtn");
const addReleaseBtn = document.getElementById("addReleaseBtn");
const projectsManageListEl = document.getElementById("projectsManageList");
const releasesManageListEl = document.getElementById("releasesManageList");
const releasesManageTitleEl = document.getElementById("releasesManageTitle");

// --- URL state ---

function serializeState() {
  const params = new URLSearchParams();
  if (activeProjectType !== "work") params.set("type", activeProjectType);
  if (selectedProjectId) params.set("sel", selectedProjectId);
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
  if (params.has("sel")) selectedProjectId = params.get("sel");
}

window.addEventListener("popstate", () => {
  if (_suppressPopstate) return;
  loadStateFromUrl();
  renderAll();
});

// --- Rendering: manage view ---

function renderManageView() {
  renderProjectsManageList();
  renderReleasesManageList();
}

function renderProjectsManageList() {
  projectsManageListEl.innerHTML = "";
  const scopeProjects = data.projects.filter(p => p.type === activeProjectType);

  if (scopeProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
      <div class="empty-state-text">No ${activeProjectType} projects yet</div>
      <div class="empty-state-sub">Click "Add project" to create one</div>
    `;
    projectsManageListEl.appendChild(empty);
    return;
  }

  scopeProjects.forEach(project => {
    const itemEl = document.createElement("div");
    itemEl.className = "manage-item" + (selectedProjectId === project.id ? " selected" : "");

    const contentEl = document.createElement("div");
    contentEl.className = "manage-item-content";

    const titleEl = document.createElement("div");
    titleEl.className = "manage-item-title";
    titleEl.textContent = project.name;
    contentEl.appendChild(titleEl);

    if (project.description) {
      const descEl = document.createElement("div");
      descEl.className = "manage-item-desc";
      descEl.textContent = project.description;
      contentEl.appendChild(descEl);
    }

    itemEl.appendChild(contentEl);

    if (project.type === "argonath") {
      const typeBadge = document.createElement("span");
      typeBadge.className = "badge type-argonath";
      typeBadge.textContent = "Argonath";
      itemEl.appendChild(typeBadge);
    }

    const actionsEl = document.createElement("span");
    actionsEl.className = "manage-item-actions";

    // Board link
    const boardLink = document.createElement("button");
    boardLink.className = "manage-item-action";
    boardLink.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
    </svg>`;
    boardLink.title = "Go to board";
    boardLink.addEventListener("click", e => {
      e.stopPropagation();
      currentProjectId = project.id;
      window.location.href = "boards.html?project=" + encodeURIComponent(project.id);
    });
    actionsEl.appendChild(boardLink);

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "manage-item-action";
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
    editBtn.title = "Edit project";
    editBtn.addEventListener("click", e => {
      e.stopPropagation();
      openProjectDetail(project.id);
    });
    actionsEl.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "manage-item-action danger";
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`;
    deleteBtn.title = "Delete project";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteProject(project.id);
    });
    actionsEl.appendChild(deleteBtn);

    itemEl.appendChild(actionsEl);

    itemEl.addEventListener("click", () => {
      selectedProjectId = project.id;
      renderManageView();
    });

    projectsManageListEl.appendChild(itemEl);
  });
}

function renderReleasesManageList() {
  releasesManageListEl.innerHTML = "";

  if (!selectedProjectId) {
    releasesManageTitleEl.textContent = "Releases";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2H2v10l9.29 9.29a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83L12 2z"/>
        <circle cx="7" cy="7" r="1" fill="currentColor"/>
      </svg>
      <div class="empty-state-text">Select a project</div>
      <div class="empty-state-sub">Choose a project to see its releases</div>
    `;
    releasesManageListEl.appendChild(empty);
    return;
  }

  const project = data.projects.find(p => p.id === selectedProjectId);
  if (!project) {
    selectedProjectId = null;
    renderManageView();
    return;
  }

  releasesManageTitleEl.textContent = `Releases \u2014 ${project.name}`;
  const releases = project.releases || [];

  if (releases.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2H2v10l9.29 9.29a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83L12 2z"/>
        <circle cx="7" cy="7" r="1" fill="currentColor"/>
      </svg>
      <div class="empty-state-text">No releases</div>
      <div class="empty-state-sub">Click "Add release" to create one</div>
    `;
    releasesManageListEl.appendChild(empty);
    return;
  }

  releases.forEach(release => {
    const itemEl = document.createElement("div");
    itemEl.className = "manage-item";

    const contentEl = document.createElement("div");
    contentEl.className = "manage-item-content";

    const titleEl = document.createElement("div");
    titleEl.className = "manage-item-title";
    const stateLabel = release.state === "ACTIVE" ? "\u25CF" : release.state === "PLANNED" ? "\u25CB" : "\u00D7";
    titleEl.textContent = `${release.name}  ${stateLabel}`;
    contentEl.appendChild(titleEl);

    if (release.description) {
      const descEl = document.createElement("div");
      descEl.className = "manage-item-desc";
      descEl.textContent = release.description;
      contentEl.appendChild(descEl);
    }

    itemEl.appendChild(contentEl);

    const actionsEl = document.createElement("span");
    actionsEl.className = "manage-item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "manage-item-action";
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
    editBtn.title = "Edit release";
    editBtn.addEventListener("click", e => {
      e.stopPropagation();
      openReleaseDetail(project.id, release.id);
    });
    actionsEl.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "manage-item-action danger";
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`;
    deleteBtn.title = "Delete release";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteRelease(project.id, release.id);
    });
    actionsEl.appendChild(deleteBtn);

    itemEl.appendChild(actionsEl);

    itemEl.addEventListener("click", (e) => {
      if (!e.target.closest(".manage-item-actions")) {
        openReleaseDetail(project.id, release.id);
      }
    });

    releasesManageListEl.appendChild(itemEl);
  });
}

// --- Project CRUD ---

async function addProject() {
  const result = await openModal({
    title: "New project",
    bodyHtml: `
      <div class="item-form">
        <div class="if-field">
          <div class="if-label">Name</div>
          <input class="if-input" id="modalInput" type="text" placeholder="Project name">
        </div>
        <div class="if-field">
          <div class="if-label">Description</div>
          <textarea class="if-input if-textarea" id="projDesc" rows="2" placeholder="Optional description\u2026"></textarea>
        </div>
      </div>`,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      {
        label: "Create",
        className: "modal-btn-primary",
        focused: true,
        getValues: () => {
          const name = document.getElementById("modalInput").value.trim();
          if (!name) return "__cancel__";
          const desc = document.getElementById("projDesc").value.trim();
          return { name, description: desc };
        }
      }
    ]
  });

  if (!result || result === "__cancel__") return;

  const project = {
    id: "proj-" + generateId(),
    name: result.name,
    description: result.description || "",
    type: activeProjectType,
    repoPath: "",
    releases: []
  };

  data.projects.push(project);
  selectedProjectId = project.id;
  saveDataToServer();
  renderAll();
}

async function openProjectDetail(projectId) {
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;

  const bodyHtml = `
    <div class="item-detail-form">
      <div class="item-detail-id">${project.id}</div>

      <div class="if-field">
        <div class="if-label">Name</div>
        <input class="if-input" id="pdName" type="text" value="${escapeHtml(project.name || "")}">
      </div>

      <div class="if-field">
        <div class="if-label">Description</div>
        <textarea class="if-input if-textarea" id="pdDesc" rows="3">${escapeHtml(project.description || "")}</textarea>
      </div>

      <div class="if-field">
        <div class="if-label">Repo path</div>
        <input class="if-input" id="pdRepoPath" type="text" value="${escapeHtml(project.repoPath || "")}" placeholder="e.g. my-org/my-repo">
      </div>
    </div>`;

  const result = await openModal({
    title: "Edit project",
    bodyHtml,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      { label: "Delete", className: "modal-btn-danger", value: "__delete__" },
      { label: "Save", className: "modal-btn-primary", focused: true, getValues: () => "__save__" }
    ]
  });

  if (!result || result === "__cancel__") return;

  if (result === "__save__") {
    const nameEl = document.getElementById("pdName");
    const descEl = document.getElementById("pdDesc");
    const repoEl = document.getElementById("pdRepoPath");

    project.name = nameEl ? nameEl.value.trim() || project.name : project.name;
    project.description = descEl ? descEl.value.trim() : project.description;
    project.repoPath = repoEl ? repoEl.value.trim() : project.repoPath;

    saveDataToServer();
    renderAll();
    return;
  }

  if (result === "__delete__") {
    await deleteProject(projectId);
  }
}

async function deleteProject(projectId) {
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  const ok = await showConfirm("Delete project", `Delete "${project.name}" and all its items? This cannot be undone.`);
  if (!ok) return;

  data.projects = data.projects.filter(p => p.id !== projectId);
  data.items = data.items.filter(item => item.projectId !== projectId);
  data.notes = data.notes.filter(note => note.projectId !== projectId);

  if (selectedProjectId === projectId) {
    selectedProjectId = null;
  }
  if (currentProjectId === projectId) {
    currentProjectId = "ALL";
  }

  saveDataToServer();
  renderAll();
}

// --- Release CRUD ---

async function addRelease() {
  if (!selectedProjectId) {
    await showPrompt("No project selected", "Select a project first, then add a release.", "");
    return;
  }

  const project = data.projects.find(p => p.id === selectedProjectId);
  if (!project) return;

  const result = await openModal({
    title: "New release",
    bodyHtml: `
      <div class="item-form">
        <div class="if-field">
          <div class="if-label">Name</div>
          <input class="if-input" id="modalInput" type="text" placeholder="Release name">
        </div>
      </div>`,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      {
        label: "Create",
        className: "modal-btn-primary",
        focused: true,
        getValues: () => {
          const name = document.getElementById("modalInput").value.trim();
          if (!name) return "__cancel__";
          return { name };
        }
      }
    ]
  });

  if (!result || result === "__cancel__") return;

  const release = {
    id: "rel-" + generateId(),
    name: result.name,
    state: "PLANNED",
    description: "",
    startDate: null,
    endDate: null,
    note: ""
  };

  if (!project.releases) project.releases = [];
  project.releases.push(release);

  saveDataToServer();
  renderAll();
}

async function openReleaseDetail(projectId, releaseId) {
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  const release = (project.releases || []).find(r => r.id === releaseId);
  if (!release) return;

  const stateOpts = ["PLANNED", "ACTIVE", "ARCHIVED"]
    .map(s => `<option value="${s}"${s === release.state ? " selected" : ""}>${s}</option>`).join("");

  const bodyHtml = `
    <div class="item-detail-form">
      <div class="item-detail-id">${release.id}</div>

      <div class="if-row" style="gap:8px">
        <div class="if-field" style="flex:1">
          <div class="if-label">Name</div>
          <input class="if-input" id="rdName" type="text" value="${escapeHtml(release.name || "")}">
        </div>
        <div class="if-field" style="flex:0.6">
          <div class="if-label">State</div>
          <select class="if-input if-select" id="rdState">${stateOpts}</select>
        </div>
      </div>

      <div class="if-field">
        <div class="if-label">Description</div>
        <textarea class="if-input if-textarea" id="rdDesc" rows="3">${escapeHtml(release.description || "")}</textarea>
      </div>
    </div>`;

  const result = await openModal({
    title: "Edit release",
    bodyHtml,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      { label: "Delete", className: "modal-btn-danger", value: "__delete__" },
      { label: "Save", className: "modal-btn-primary", focused: true, getValues: () => "__save__" }
    ]
  });

  if (!result || result === "__cancel__") return;

  if (result === "__save__") {
    const nameEl = document.getElementById("rdName");
    const stateEl = document.getElementById("rdState");
    const descEl = document.getElementById("rdDesc");

    release.name = nameEl ? nameEl.value.trim() || release.name : release.name;
    release.state = stateEl ? stateEl.value : release.state;
    release.description = descEl ? descEl.value.trim() : release.description;

    saveDataToServer();
    renderAll();
    return;
  }

  if (result === "__delete__") {
    await deleteRelease(projectId, releaseId);
  }
}

async function deleteRelease(projectId, releaseId) {
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;

  const release = (project.releases || []).find(r => r.id === releaseId);
  if (!release) return;
  const ok = await showConfirm("Delete release", `Delete release "${release.name}"? Items in it will become unreleased.`);
  if (!ok) return;

  project.releases = project.releases.filter(r => r.id !== releaseId);
  data.items.forEach(item => {
    if (item.projectId === projectId && item.releaseId === releaseId) {
      item.releaseId = null;
    }
  });
  data.notes = data.notes.filter(note => !(note.projectId === projectId && note.releaseId === releaseId));

  saveDataToServer();
  renderAll();
}

// --- Main render orchestrator ---

function renderAll() {
  // If current project is out of scope, reset
  if (selectedProjectId) {
    const project = data.projects.find(p => p.id === selectedProjectId);
    if (!project || project.type !== activeProjectType) {
      selectedProjectId = null;
    }
  }

  renderHeaderTypeToggle();
  renderManageView();
  saveStateToUrl();
}

// --- Event wiring ---

if (addProjectBtn) {
  addProjectBtn.addEventListener("click", addProject);
}

if (addReleaseBtn) {
  addReleaseBtn.addEventListener("click", addRelease);
}

// --- Init (wait for common.js, then render) ---

document.addEventListener("app:ready", () => {
  loadStateFromUrl();
  renderAll();
});
