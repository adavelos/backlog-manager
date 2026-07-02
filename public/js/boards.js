// ============================================
// Backlog Manager — Boards Page Logic
// ============================================

// --- Boards-specific state ---
let view = "state";         // "state" | "release"
let quickEditMode = false;
let qeEditingCell = null;
let showArchivePanel = false;

// DOM refs
const filtersPanelEl = document.getElementById("filtersPanel");
const projectChipsEl = document.getElementById("projectChips");
const tagChipsEl = document.getElementById("tagChips");
const viewButtons = document.querySelectorAll(".view-button");
const archiveToggleCheckbox = document.getElementById("archiveToggleCheckbox");
const archivePanelEl = document.getElementById("archivePanel");
const archiveListEl = document.getElementById("archiveList");
const boardColumnsEl = document.getElementById("boardColumns");
const qeModeNormalBtn = document.getElementById("qeModeNormal");
const qeModeQuickBtn = document.getElementById("qeModeQuick");
const qeToggleHint = document.getElementById("qeToggleHint");
const qeViewEl = document.getElementById("qeView");

// --- URL state (boards-specific params) ---

function serializeState() {
  const params = new URLSearchParams();
  if (view !== "state") params.set("view", view);
  if (currentProjectId !== "ALL") params.set("project", currentProjectId);
  if (activeProjectType !== "work") params.set("type", activeProjectType);
  if (activeTags.size > 0) params.set("tags", Array.from(activeTags).join(","));
  if (quickEditMode) params.set("qe", "1");
  if (showArchivePanel) params.set("archive", "1");
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
  if (params.has("view")) view = params.get("view");
  if (params.has("project")) currentProjectId = params.get("project");
  if (params.has("type")) activeProjectType = params.get("type");
  if (params.has("tags")) activeTags = new Set(params.get("tags").split(",").filter(Boolean));
  if (params.has("qe")) quickEditMode = true;
  if (params.has("archive")) showArchivePanel = true;
}

window.addEventListener("popstate", () => {
  if (_suppressPopstate) return;
  loadStateFromUrl();
  renderAll();
});

// --- Rendering: chips & views ---

function renderProjectChips() {
  projectChipsEl.innerHTML = "";
  const scopeProjects = data.projects.filter(p => p.type === activeProjectType);

  const allChip = document.createElement("button");
  allChip.className = "chip chip-project" + (currentProjectId === "ALL" ? " active" : "");
  allChip.textContent = "All projects";
  allChip.addEventListener("click", () => {
    currentProjectId = "ALL";
    renderAll();
  });
  projectChipsEl.appendChild(allChip);

  scopeProjects.forEach(project => {
    const chip = document.createElement("button");
    chip.className = "chip chip-project" + (currentProjectId === project.id ? " active" : "");
    chip.textContent = project.name;
    chip.addEventListener("click", () => {
      currentProjectId = project.id;
      renderAll();
    });
    projectChipsEl.appendChild(chip);
  });
}

function renderTagChips() {
  tagChipsEl.innerHTML = "";
  const tags = new Set();
  data.items.forEach(item => (item.tags || []).forEach(t => tags.add(t)));
  Array.from(tags).sort().forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "chip" + (activeTags.has(tag) ? " active" : "");
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      if (activeTags.has(tag)) activeTags.delete(tag);
      else activeTags.add(tag);
      renderAll();
    });
    tagChipsEl.appendChild(chip);
  });
}

function renderViewButtons() {
  viewButtons.forEach(btn => {
    const v = btn.dataset.view;
    btn.classList.toggle("active", v === view);
    if (v === "release" && currentProjectId === "ALL") {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

// --- Rendering: boards & archive ---

function renderBoard() {
  const items = getVisibleBoardItems();

  if (quickEditMode) {
    boardColumnsEl.classList.add("hidden");
    qeViewEl.classList.remove("hidden");
    renderQuickEdit(items);
    return;
  }

  boardColumnsEl.classList.remove("hidden");
  qeViewEl.classList.add("hidden");
  boardColumnsEl.innerHTML = "";

  if (view === "state") {
    renderStateBoard(items);
  } else if (view === "release") {
    renderReleaseBoard(items);
  }
}

function renderStateBoard(items) {
  const states = ["BACKLOG", "TODO", "ONGOING", "DONE"];
  const byState = {};
  states.forEach(s => (byState[s] = []));
  items.forEach(item => {
    if (!byState[item.state]) byState[item.state] = [];
    byState[item.state].push(item);
  });

  states.forEach(state => {
    const columnEl = document.createElement("div");
    columnEl.className = "column";

    const headerEl = document.createElement("div");
    headerEl.className = "column-header";
    const labelEl = document.createElement("span");
    labelEl.textContent = state;
    const headerRight = document.createElement("span");
    headerRight.style.cssText = "display:flex;align-items:center;gap:6px";
    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = byState[state].length ? `${byState[state].length} items` : "";
    headerRight.appendChild(countEl);
    const addBtn = document.createElement("button");
    addBtn.className = "column-add-btn";
    addBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.title = `Add item to ${state}`;
    addBtn.addEventListener("click", e => {
      e.stopPropagation();
      addItem(state);
    });
    headerRight.appendChild(addBtn);
    headerEl.appendChild(labelEl);
    headerEl.appendChild(headerRight);
    columnEl.appendChild(headerEl);

    const dropzone = document.createElement("div");
    dropzone.className = "column-dropzone";
    dropzone.dataset.state = state;
    byState[state].forEach(item => {
      dropzone.appendChild(renderItemCard(item));
    });

    dropzone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      dropzone.classList.add("qe-drag-over");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("qe-drag-over");
    });
    dropzone.addEventListener("drop", (ev) => {
      dropzone.classList.remove("qe-drag-over");
      ev.preventDefault();
      const draggedItemId = ev.dataTransfer.getData("text/plain");
      if (!draggedItemId) return;
      const draggedItem = data.items.find(i => i.id === draggedItemId);
      if (!draggedItem) return;

      const targetState = state;
      if (draggedItem.state !== targetState) {
        draggedItem.state = targetState;
        draggedItem.updatedAt = Date.now();
        if (targetState === "DONE") {
          draggedItem.completedAt = Date.now();
        } else if (draggedItem.state !== "DONE") {
          draggedItem.completedAt = null;
        }
        saveDataToServer();
        renderAll();
      }
    });

    columnEl.appendChild(dropzone);

    boardColumnsEl.appendChild(columnEl);
  });
}

function renderReleaseBoard(items) {
  boardColumnsEl.innerHTML = "";
  if (currentProjectId === "ALL") {
    const msg = document.createElement("div");
    msg.textContent = "Select a specific project to view the Release board.";
    msg.style.cssText = "padding:12px;font-size:12px;color:var(--text-muted);";
    boardColumnsEl.appendChild(msg);
    return;
  }
  const project = data.projects.find(p => p.id === currentProjectId);
  if (!project) return;
  const releases = (project.releases || []).filter(r => r.state !== "ARCHIVED");

  const groups = { NO_RELEASE: [] };
  releases.forEach(r => (groups[r.id] = []));
  items.forEach(item => {
    const key = item.releaseId || "NO_RELEASE";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  ["NO_RELEASE", ...releases.map(r => r.id)].forEach(relId => {
    const columnEl = document.createElement("div");
    columnEl.className = "column";

    const headerEl = document.createElement("div");
    headerEl.className = "column-header";
    const labelEl = document.createElement("span");
    labelEl.textContent = relId === "NO_RELEASE"
      ? "BACKLOG (no release)"
      : releases.find(r => r.id === relId)?.name || relId;
    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = groups[relId].length ? `${groups[relId].length} items` : "";
    headerEl.appendChild(labelEl);
    headerEl.appendChild(countEl);
    columnEl.appendChild(headerEl);

    const dropzone = document.createElement("div");
    dropzone.className = "column-dropzone";
    dropzone.dataset.releaseId = relId;
    groups[relId].forEach(item => {
      dropzone.appendChild(renderItemCard(item));
    });

    dropzone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      dropzone.classList.add("qe-drag-over");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("qe-drag-over");
    });
    dropzone.addEventListener("drop", (ev) => {
      dropzone.classList.remove("qe-drag-over");
      ev.preventDefault();
      const draggedItemId = ev.dataTransfer.getData("text/plain");
      if (!draggedItemId) return;
      const draggedItem = data.items.find(i => i.id === draggedItemId);
      if (!draggedItem) return;

      const targetReleaseId = relId === "NO_RELEASE" ? null : relId;
      if (draggedItem.releaseId !== targetReleaseId) {
        draggedItem.releaseId = targetReleaseId;
        draggedItem.updatedAt = Date.now();
        saveDataToServer();
        renderAll();
      }
    });

    columnEl.appendChild(dropzone);

    boardColumnsEl.appendChild(columnEl);
  });
}

function renderQuickEdit(items) {
  const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  let groups;
  if (view === "state") {
    const states = ["BACKLOG", "TODO", "ONGOING", "DONE"];
    const byState = {};
    states.forEach(s => (byState[s] = []));
    items.forEach(item => {
      if (!byState[item.state]) byState[item.state] = [];
      byState[item.state].push(item);
    });
    states.forEach(s => {
      byState[s].sort((a, b) => {
        const pA = PRIORITIES.indexOf(a.priority);
        const pB = PRIORITIES.indexOf(b.priority);
        if (pA !== pB) return pB - pA;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    });
    groups = states.map(s => ({ id: s, label: s, items: byState[s] }));
  } else {
    if (currentProjectId === "ALL") {
      boardColumnsEl.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--text-muted)">Select a specific project to view the Release board.</div>`;
      return;
    }
    const project = data.projects.find(p => p.id === currentProjectId);
    if (!project) return;
    const releases = (project.releases || []).filter(r => r.state !== "ARCHIVED");
    const byReleaseId = {};
    const releaseIds = ["NO_RELEASE"].concat(releases.map(r => r.id));
    releaseIds.forEach(id => { byReleaseId[id] = []; });
    items.forEach(item => {
      const key = item.releaseId || "NO_RELEASE";
      if (!byReleaseId[key]) byReleaseId[key] = [];
      byReleaseId[key].push(item);
    });
    groups = releaseIds.map(relId => ({
      id: relId,
      label: relId === "NO_RELEASE"
        ? "BACKLOG (no release)"
        : (releases.find(r => r.id === relId)?.name || relId),
      items: byReleaseId[relId]
    }));
  }

  const container = document.createElement("div");
  container.className = "qe-container";

  groups.forEach(group => {
    const groupEl = document.createElement("div");
    groupEl.className = "qe-group";
    groupEl.dataset.groupId = group.id;

    const groupLabel = document.createElement("div");
    groupLabel.className = "qe-group-label";
    groupLabel.textContent = `${group.label} (${group.items.length})`;
    groupEl.appendChild(groupLabel);

    const table = document.createElement("table");
    table.className = "qe-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const columns = view === "state"
      ? ["#", "ID", "Title", "Priority", "Type", "Tags"]
      : ["#", "ID", "Title", "Priority", "Type", "State", "Tags"];
    columns.forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    tbody.className = "qe-tbody";

    if (group.items.length === 0) {
      const placeholderTr = document.createElement("tr");
      placeholderTr.className = "qe-empty-row";
      const placeholderTd = document.createElement("td");
      placeholderTd.colSpan = columns.length;
      placeholderTd.textContent = "\u2014 drop items here \u2014";
      placeholderTd.style.cssText = "text-align:center;color:var(--text-muted);font-style:italic;padding:12px 6px;";
      placeholderTr.appendChild(placeholderTd);
      tbody.appendChild(placeholderTr);
    } else {
      group.items.forEach((item, rowIndex) => {
        const tr = document.createElement("tr");
        tr.dataset.itemId = item.id;
        tr.draggable = true;

        const tdHandle = document.createElement("td");
        tdHandle.style.width = "5%";
        const handleSpan = document.createElement("span");
        handleSpan.className = "qe-row-handle";
        handleSpan.textContent = String(rowIndex + 1);
        tdHandle.appendChild(handleSpan);
        tr.appendChild(tdHandle);

        const tdId = document.createElement("td");
        tdId.style.width = "15%";
        tdId.textContent = item.id;
        tdId.title = item.id;
        tr.appendChild(tdId);

        const tdTitle = document.createElement("td");
        tdTitle.style.width = "30%";
        tdTitle.textContent = item.title;
        tdTitle.title = item.title;
        tdTitle.classList.add("qe-cell-editable");
        tdTitle.dataset.itemId = item.id;
        tr.appendChild(tdTitle);

        const tdPri = document.createElement("td");
        tdPri.style.width = "10%";
        const priSpan = document.createElement("span");
        priSpan.className = `qe-badge badge priority-${item.priority}`;
        priSpan.textContent = item.priority;
        tdPri.appendChild(priSpan);
        tr.appendChild(tdPri);

        const tdType = document.createElement("td");
        tdType.style.width = "10%";
        const typeSpan = document.createElement("span");
        typeSpan.className = `qe-badge badge type-${item.type}`;
        typeSpan.textContent = item.type;
        tdType.appendChild(typeSpan);
        tr.appendChild(tdType);

        if (view !== "state") {
          const tdState = document.createElement("td");
          tdState.style.width = "10%";
          const stateSpan = document.createElement("span");
          stateSpan.className = `qe-badge badge`;
          stateSpan.textContent = item.state;
          tdState.appendChild(stateSpan);
          tr.appendChild(tdState);
        }

        const tdTags = document.createElement("td");
        const tagWidth = view === "state" ? "30%" : "20%";
        tdTags.style.width = tagWidth;
        tdTags.textContent = (item.tags || []).join(", ");
        tdTags.title = (item.tags || []).join(", ");
        tr.appendChild(tdTags);

        tr.addEventListener("dragstart", (ev) => {
          tr.classList.add("qe-row-dragging");
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", item.id);
        });
        tr.addEventListener("dragend", () => {
          tr.classList.remove("qe-row-dragging");
        });

        tbody.appendChild(tr);
      });
    }

    // Drop handling for reorder / cross-group moves
    tbody.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      tbody.classList.add("qe-drag-over");
    });
    tbody.addEventListener("dragleave", () => {
      tbody.classList.remove("qe-drag-over");
    });
    tbody.addEventListener("drop", (ev) => {
      tbody.classList.remove("qe-drag-over");
      ev.preventDefault();
      const draggedItemId = ev.dataTransfer.getData("text/plain");
      if (!draggedItemId) return;
      const draggedItem = data.items.find(i => i.id === draggedItemId);
      if (!draggedItem) return;

      const targetGroupEl = tbody.closest(".qe-group");
      if (!targetGroupEl) return;
      const targetGroupId = targetGroupEl.dataset.groupId;

      const sourceGroupId = view === "state"
        ? draggedItem.state
        : (draggedItem.releaseId || "NO_RELEASE");

      const sameGroup = targetGroupId === sourceGroupId;

      if (sameGroup) {
        const targetTr = ev.target.closest("tr");
        if (!targetTr || draggedItemId === targetTr.dataset.itemId) return;
        const targetItem = data.items.find(i => i.id === targetTr.dataset.itemId);
        if (!targetItem) return;
        const grpItems = group.items;
        const fromIdx = grpItems.indexOf(draggedItem);
        const toIdx = grpItems.indexOf(targetItem);
        if (fromIdx < 0 || toIdx < 0) return;
        const fromActual = data.items.indexOf(draggedItem);
        const toActual = data.items.indexOf(targetItem);
        if (fromActual < 0 || toActual < 0) return;
        const [moved] = data.items.splice(fromActual, 1);
        const adjustedTo = data.items.indexOf(targetItem);
        data.items.splice(adjustedTo, 0, moved);
      } else {
        const now = Date.now();
        if (view === "state") {
          const prevState = draggedItem.state;
          draggedItem.state = targetGroupId;
          draggedItem.updatedAt = now;
          if (targetGroupId === "DONE") {
            draggedItem.completedAt = now;
          } else if (prevState === "DONE") {
            draggedItem.completedAt = null;
          }
        } else {
          draggedItem.releaseId = targetGroupId === "NO_RELEASE" ? null : targetGroupId;
          draggedItem.updatedAt = now;
        }
      }
      saveDataToServer();
      renderAll();
    });

    table.appendChild(tbody);
    groupEl.appendChild(table);
    container.appendChild(groupEl);
  });

  boardColumnsEl.innerHTML = "";
  boardColumnsEl.appendChild(container);
}

// --- Quick Edit inline editing ---

function qeStartEditCell(td) {
  if (qeEditingCell === td) return;
  qeCancelEditCell();

  const itemId = td.dataset.itemId;
  if (!itemId) return;
  const item = data.items.find(i => i.id === itemId);
  if (!item) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "qe-cell-input";
  input.value = item.title || "";
  td.textContent = "";
  td.appendChild(input);
  qeEditingCell = td;

  input.focus();
  input.select();

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      qeCommitEditCell(td, input.value);
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      qeCancelEditCell();
      ev.preventDefault();
    } else if (ev.key === "Tab") {
      qeCommitEditCell(td, input.value);
      ev.preventDefault();
      qeFocusNextRowTitle(td, !ev.shiftKey);
    }
  });

  input.addEventListener("blur", () => {
    qeCommitEditCell(td, input.value);
  });
}

function qeCommitEditCell(td, value) {
  if (!qeEditingCell || qeEditingCell !== td) return;
  const itemId = td.dataset.itemId;
  if (!itemId) return;
  const item = data.items.find(i => i.id === itemId);
  if (!item) return;

  item.title = value;
  td.textContent = value;
  td.title = value;
  qeEditingCell = null;
  saveDataToServer();
}

function qeCancelEditCell() {
  if (!qeEditingCell) return;
  const td = qeEditingCell;
  const itemId = td.dataset.itemId;
  const item = itemId ? data.items.find(i => i.id === itemId) : null;
  const value = item ? item.title : "";
  td.textContent = value || "";
  td.title = value || "";
  qeEditingCell = null;
}

function qeFocusNextRowTitle(currentTd, forward) {
  const currentTr = currentTd.closest("tr");
  if (!currentTr) return;
  const currentTbody = currentTr.closest("tbody");
  if (!currentTbody) return;
  const currentItemId = currentTd.dataset.itemId;
  const rows = Array.from(currentTbody.querySelectorAll("tr"));
  const currentIdx = rows.findIndex(tr =>
    tr.querySelector("td[data-item-id]")?.dataset.itemId === currentItemId
  );
  if (currentIdx < 0) return;
  const nextIdx = forward ? currentIdx + 1 : currentIdx - 1;
  if (nextIdx < 0 || nextIdx >= rows.length) return;
  const nextTitleCell = rows[nextIdx].querySelector("td[data-item-id].qe-cell-editable");
  if (nextTitleCell) qeStartEditCell(nextTitleCell);
}

// --- Render item card ---

function renderItemCard(item) {
  const card = document.createElement("div");
  card.className = "item";

  const titleEl = document.createElement("div");
  titleEl.className = "item-title";

  const titleTextEl = document.createElement("span");
  titleTextEl.className = "item-title-text";
  titleTextEl.textContent = item.title;
  titleEl.appendChild(titleTextEl);

  const promptBtn = document.createElement("button");
  promptBtn.className = "item-prompt-btn";
  promptBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
  promptBtn.title = "Copy AI prompt to clipboard";
  promptBtn.addEventListener("click", e => {
    e.stopPropagation();
    copyItemPromptToClipboard(item);
  });
  titleEl.appendChild(promptBtn);

  card.appendChild(titleEl);

  const metaEl = document.createElement("div");
  metaEl.className = "item-meta";

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `badge priority-${item.priority}`;
  priorityBadge.textContent = item.priority;
  metaEl.appendChild(priorityBadge);

  const typeBadge = document.createElement("span");
  typeBadge.className = `badge type-${item.type}`;
  typeBadge.textContent = item.type === "FEATURE" ? "Feature" : "Bug";
  metaEl.appendChild(typeBadge);

  if (item.releaseId) {
    const relBadge = document.createElement("span");
    relBadge.className = "badge";
    relBadge.style.cssText = "background:var(--cyan-50);color:var(--cyan-500);border-color:var(--cyan-100)";
    relBadge.textContent = "Release";
    metaEl.appendChild(relBadge);
  }

  card.appendChild(metaEl);

  if (item.tags && item.tags.length > 0) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "item-tags";
    item.tags.slice(0, 3).forEach(t => {
      const tag = document.createElement("span");
      tag.className = "tag-badge";
      tag.textContent = t;
      tagsEl.appendChild(tag);
    });
    if (item.tags.length > 3) {
      const more = document.createElement("span");
      more.className = "tag-badge";
      more.textContent = `+${item.tags.length - 3}`;
      tagsEl.appendChild(more);
    }
    card.appendChild(tagsEl);
  }

  card.addEventListener("click", e => {
    e.stopPropagation();
    openItemDetail(item.id);
  });

  card.draggable = true;
  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", item.id);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  return card;
}

// --- Item detail / edit modal ---

async function openItemDetail(itemId) {
  const item = data.items.find(i => i.id === itemId);
  if (!item) return;

  const project = data.projects.find(p => p.id === item.projectId);
  const releases = project ? project.releases || [] : [];

  const stateOpts = ["BACKLOG", "TODO", "ONGOING", "DONE"]
    .map(s => `<option value="${s}"${s === item.state ? " selected" : ""}>${s}</option>`).join("");

  const releaseOpts = `<option value="">(no release)</option>`
    + releases.map(r => `<option value="${r.id}"${r.id === item.releaseId ? " selected" : ""}>${r.name}</option>`).join("");

  const priorityRadios = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    .map(v => `<label class="fp-opt ${`opt-${v.toLowerCase()}`}"><input type="radio" name="idfp" value="${v}"${v === item.priority ? " checked" : ""}><span>${v.charAt(0) + v.slice(1).toLowerCase()}</span></label>`).join("");

  const typeRadios = ["FEATURE", "BUG"]
    .map(v => `<label class="fp-opt ${v === "FEATURE" ? "opt-feat" : "opt-bug"}"><input type="radio" name="idft" value="${v}"${v === item.type ? " checked" : ""}><span>${v === "FEATURE" ? "Feature" : "Bug"}</span></label>`).join("");

  const tagsVal = (item.tags || []).join(", ");
  const filesVal = (item.filesAffected || []).join(", ");

  const subitemsHtml = (item.subitems || []).map((si, idx) =>
    `<div class="subitem-row${si.done ? " done" : ""}">
      <input type="checkbox" class="si-check" data-idx="${idx}"${si.done ? " checked" : ""}>
      <span class="subitem-title">${si.title}</span>
      <button class="manage-item-action danger si-del" data-idx="${idx}" style="opacity:0.3">&times;</button>
    </div>`
  ).join("");

  const bodyHtml = `
    <div class="item-detail-form">
      <div class="item-detail-id">${item.id}</div>

      <div class="if-row if-project" style="gap:8px;align-items:center">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted)">${project ? project.name : "\u2014"}</span>
      </div>

      <div class="if-row" style="gap:8px">
        <div class="if-field" style="flex:1">
          <div class="if-label">State</div>
          <select class="if-input if-select" id="idState">${stateOpts}</select>
        </div>
        <div class="if-field" style="flex:1">
          <div class="if-label">Release</div>
          <select class="if-input if-select" id="idRelease">${releaseOpts}</select>
        </div>
      </div>

      <div class="if-field">
        <div class="if-label">Title</div>
        <input class="if-input" id="idTitle" type="text" value="${item.title.replace(/"/g, "&quot;")}">
      </div>

      <div class="if-row">
        <div class="if-field">
          <div class="if-label">Priority</div>
          <div class="if-opts">${priorityRadios}</div>
        </div>
        <div class="if-field">
          <div class="if-label">Type</div>
          <div class="if-opts">${typeRadios}</div>
        </div>
      </div>

      <div class="if-field">
        <div class="if-label">Tags (comma-separated)</div>
        <div class="tag-input-wrapper">
          <input class="if-input" id="idTags" type="text" value="${tagsVal.replace(/"/g, "&quot;")}" autocomplete="off">
          <div class="tag-suggestions" id="idTagSuggestions"></div>
        </div>
      </div>

      <div class="if-field">
        <div class="if-label">Analysis</div>
        <textarea class="if-input if-textarea" id="idAnalysis" rows="3">${(item.analysis || "").replace(/"/g, "&quot;")}</textarea>
      </div>

      <div class="if-field">
        <div class="if-label">Prompt</div>
        <textarea class="if-input if-textarea" id="idPrompt" rows="3">${(item.prompt || "").replace(/"/g, "&quot;")}</textarea>
      </div>

      <div class="if-field">
        <div class="if-label">Report</div>
        <textarea class="if-input if-textarea" id="idReport" rows="3">${(item.report || "").replace(/"/g, "&quot;")}</textarea>
      </div>

      <div class="if-field">
        <div class="if-label">Files affected (comma-separated)</div>
        <input class="if-input" id="idFiles" type="text" value="${filesVal.replace(/"/g, "&quot;")}">
      </div>

      <div class="if-field">
        <div class="if-label">Subitems <span style="font-weight:400;color:var(--text-muted);font-size:10px">(check to mark done, click \u00d7 to delete)</span></div>
        <div id="idSubitems">${subitemsHtml}</div>
        <div style="display:flex;gap:4px;margin-top:4px">
          <input class="if-input" id="idNewSubitem" type="text" placeholder="Add subitem\u2026" style="flex:1;margin-top:0">
          <button class="modal-btn modal-btn-primary" id="idAddSubitemBtn" style="padding:7px 12px;font-size:12px">+</button>
        </div>
      </div>
    </div>`;

  const result = await openModal({
    title: "Edit item",
    bodyHtml,
    onOpen: () => {
      const modalHeaderEl = document.querySelector(".modal-header");
      if (modalHeaderEl && !modalHeaderEl.querySelector(".modal-prompt-btn")) {
        const promptBtn = document.createElement("button");
        promptBtn.className = "modal-prompt-btn";
        promptBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
        promptBtn.title = "Copy AI prompt to clipboard";
        promptBtn.addEventListener("click", () => copyItemPromptToClipboard(item));
        const maximizeBtn = modalHeaderEl.querySelector(".modal-maximize-btn");
        if (maximizeBtn) {
          modalHeaderEl.insertBefore(promptBtn, maximizeBtn);
        } else {
          modalHeaderEl.appendChild(promptBtn);
        }
      }
      document.querySelectorAll("#idSubitems .si-check").forEach(cb => {
        cb.addEventListener("change", () => {
          const row = cb.closest(".subitem-row");
          if (row) row.classList.toggle("done", cb.checked);
        });
      });
      document.querySelectorAll("#idSubitems .si-del").forEach(btn => {
        btn.addEventListener("click", () => {
          const row = btn.closest(".subitem-row");
          if (row) row.remove();
        });
      });
      const addBtn = document.getElementById("idAddSubitemBtn");
      const newInput = document.getElementById("idNewSubitem");
      if (addBtn && newInput) {
        const addSubitem = () => {
          const title = newInput.value.trim();
          if (!title) return;
          const container = document.getElementById("idSubitems");
          const div = document.createElement("div");
          div.className = "subitem-row";
          div.innerHTML = `
            <input type="checkbox" class="si-check">
            <span class="subitem-title">${title.replace(/"/g, "&quot;")}</span>
            <button class="manage-item-action danger si-del" style="opacity:0.3">&times;</button>
          `;
          div.querySelector(".si-check").addEventListener("change", () => {
            div.classList.toggle("done", div.querySelector(".si-check").checked);
          });
          div.querySelector(".si-del").addEventListener("click", () => div.remove());
          container.appendChild(div);
          newInput.value = "";
          newInput.focus();
        };
        addBtn.addEventListener("click", addSubitem);
        newInput.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            addSubitem();
          }
        });
      }
      setupTagSuggestions("idTags", "idTagSuggestions");
    },
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      { label: "Delete", className: "modal-btn-danger", value: "__delete__" },
      { label: "Save", className: "modal-btn-primary", focused: true, getValues: () => "__save__" }
    ]
  });

  if (!result || result === "__cancel__") return;

  const titleEl = document.getElementById("idTitle");
  const stateEl = document.getElementById("idState");
  const releaseEl = document.getElementById("idRelease");
  const priorityRadio = document.querySelector('input[name="idfp"]:checked');
  const typeRadio = document.querySelector('input[name="idft"]:checked');
  const tagsEl = document.getElementById("idTags");
  const analysisEl = document.getElementById("idAnalysis");
  const promptEl = document.getElementById("idPrompt");
  const reportEl = document.getElementById("idReport");
  const filesEl = document.getElementById("idFiles");

  if (result === "__save__") {
    const subitemRows = document.querySelectorAll("#idSubitems .subitem-row");
    const subitems = [];
    subitemRows.forEach(row => {
      const checkbox = row.querySelector(".si-check");
      const titleSpan = row.querySelector(".subitem-title");
      if (checkbox && titleSpan) {
        subitems.push({
          id: "si-" + generateId(),
          title: titleSpan.textContent,
          done: checkbox.checked
        });
      }
    });

    item.title = titleEl ? titleEl.value.trim() : item.title;
    item.state = stateEl ? stateEl.value : item.state;
    item.releaseId = releaseEl ? releaseEl.value || null : item.releaseId;
    item.priority = priorityRadio ? priorityRadio.value : item.priority;
    item.type = typeRadio ? typeRadio.value : item.type;
    item.tags = tagsEl ? tagsEl.value.split(",").map(s => s.trim()).filter(Boolean) : item.tags;
    item.analysis = analysisEl ? analysisEl.value.trim() : item.analysis;
    item.prompt = promptEl ? promptEl.value.trim() : item.prompt;
    item.report = reportEl ? reportEl.value.trim() : item.report;
    item.filesAffected = filesEl ? filesEl.value.split(",").map(s => s.trim()).filter(Boolean) : item.filesAffected;
    if (item.state === "DONE" && !item.completedAt) {
      item.completedAt = Date.now();
    } else if (item.state !== "DONE") {
      item.completedAt = null;
    }
    item.subitems = subitems;
    item.updatedAt = Date.now();

    saveDataToServer();
    renderAll();
    return;
  }

  if (result === "__delete__") {
    const ok = await showConfirm("Delete item", `Delete "${item.title}"? This cannot be undone.`);
    if (!ok) return;
    data.items = data.items.filter(i => i.id !== itemId);
    saveDataToServer();
    renderAll();
  }
}

// --- Add item modal ---

async function addItem(targetState) {
  const filteredProjects = data.projects.filter(p => p.type === activeProjectType);

  if (filteredProjects.length === 0) {
    await showPrompt("No projects", "Create a project first in Projects & Releases.", "");
    return;
  }

  let chosenProjectId = currentProjectId !== "ALL" ? currentProjectId : null;
  if (!chosenProjectId || !filteredProjects.find(p => p.id === chosenProjectId)) {
    chosenProjectId = filteredProjects[0].id;
  }

  const project = data.projects.find(p => p.id === chosenProjectId);
  const projectName = project ? project.name : "Unknown";
  const releases = project ? project.releases || [] : [];

  const projectOpts = filteredProjects.map(p =>
    `<option value="${p.id}"${p.id === chosenProjectId ? " selected" : ""}>${p.name}</option>`
  ).join("");

  const releaseOpts = `<option value="">(no release)</option>`
    + releases.map(r => `<option value="${r.id}">${r.name}</option>`).join("");

  const priorityRadios = [
    { v: "LOW", l: "Low", c: "opt-low" },
    { v: "MEDIUM", l: "Medium", c: "opt-medium", ch: true },
    { v: "HIGH", l: "High", c: "opt-high" },
    { v: "CRITICAL", l: "Critical", c: "opt-critical" }
  ].map(o => `<label class="fp-opt ${o.c}"><input type="radio" name="fp" value="${o.v}"${o.ch ? " checked" : ""}><span>${o.l}</span></label>`).join("");

  const typeRadios = [
    { v: "FEATURE", l: "Feature", c: "opt-feat", ch: true },
    { v: "BUG", l: "Bug", c: "opt-bug" }
  ].map(o => `<label class="fp-opt ${o.c}"><input type="radio" name="ft" value="${o.v}"${o.ch ? " checked" : ""}><span>${o.l}</span></label>`).join("");

  const result = await openModal({
    title: `New ${targetState} item`,
    bodyHtml: `
      <div class="item-form">
        <div class="if-row" style="gap:8px">
          <div class="if-field" style="flex:1">
            <div class="if-label">Project</div>
            <select class="if-input if-select" id="ifProject">${projectOpts}</select>
          </div>
          <div class="if-field" style="flex:1">
            <div class="if-label">Release</div>
            <select class="if-input if-select" id="ifRelease">${releaseOpts}</select>
          </div>
        </div>
        <div class="if-field">
          <input class="if-input" id="modalInput" type="text" placeholder="What needs to be done?">
        </div>
        <div class="if-row">
          <div class="if-field">
            <div class="if-label">Priority</div>
            <div class="if-opts">${priorityRadios}</div>
          </div>
          <div class="if-field">
            <div class="if-label">Type</div>
            <div class="if-opts">${typeRadios}</div>
          </div>
        </div>
        <div class="if-field">
          <div class="if-label">Tags (comma-separated)</div>
          <div class="tag-input-wrapper">
            <input class="if-input" id="ifTags" type="text" placeholder="e.g. frontend, auth, refactor" autocomplete="off">
            <div class="tag-suggestions" id="tagSuggestions"></div>
          </div>
        </div>
        <details class="if-details">
          <summary class="if-details-summary">Additional fields</summary>
          <div class="if-details-body">
            <div class="if-field">
              <div class="if-label">Analysis</div>
              <textarea class="if-input if-textarea" id="ifAnalysis" rows="3" placeholder="Notes, analysis, context\u2026"></textarea>
            </div>
            <div class="if-field">
              <div class="if-label">Prompt</div>
              <textarea class="if-input if-textarea" id="ifPrompt" rows="3" placeholder="AI prompt / instructions\u2026"></textarea>
            </div>
            <div class="if-field">
              <div class="if-label">Files affected (comma-separated)</div>
              <input class="if-input" id="ifFiles" type="text" placeholder="e.g. src/main.ts, src/utils.ts">
            </div>
          </div>
        </details>
      </div>`,
    onOpen: () => {
      const projSelect = document.getElementById("ifProject");
      const relSelect = document.getElementById("ifRelease");
      if (projSelect && relSelect) {
        const updateReleases = () => {
          const pid = projSelect.value;
          const p = data.projects.find(pr => pr.id === pid);
          const rels = p ? p.releases || [] : [];
          relSelect.innerHTML = `<option value="">(no release)</option>`
            + rels.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
        };
        projSelect.addEventListener("change", updateReleases);
      }
      setupTagSuggestions("ifTags", "tagSuggestions");
    },
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      {
        label: "Create",
        className: "modal-btn-primary",
        focused: true,
        getValues: () => {
          const title = document.getElementById("modalInput").value.trim();
          if (!title) return "__cancel__";
          const priority = document.querySelector('input[name="fp"]:checked');
          const type = document.querySelector('input[name="ft"]:checked');
          const projectEl = document.getElementById("ifProject");
          const releaseEl = document.getElementById("ifRelease");
          const tagsEl = document.getElementById("ifTags");
          const analysisEl = document.getElementById("ifAnalysis");
          const promptEl = document.getElementById("ifPrompt");
          const filesEl = document.getElementById("ifFiles");
          return {
            title,
            projectId: projectEl ? projectEl.value : filteredProjects[0].id,
            priority: priority ? priority.value : "MEDIUM",
            type: type ? type.value : "FEATURE",
            releaseId: releaseEl ? releaseEl.value : null,
            tags: tagsEl ? tagsEl.value.split(",").map(s => s.trim()).filter(Boolean) : [],
            analysis: analysisEl ? analysisEl.value.trim() : "",
            prompt: promptEl ? promptEl.value.trim() : "",
            filesAffected: filesEl ? filesEl.value.split(",").map(s => s.trim()).filter(Boolean) : []
          };
        }
      }
    ]
  });

  if (!result || result === "__cancel__") return;

  const item = {
    id: "item-" + generateId(),
    projectId: result.projectId,
    releaseId: result.releaseId || null,
    title: result.title,
    tags: result.tags || [],
    priority: result.priority,
    type: result.type,
    state: targetState,
    analysis: result.analysis || "",
    filesAffected: result.filesAffected || [],
    prompt: result.prompt || "",
    report: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    subitems: []
  };

  data.items.push(item);
  saveDataToServer();
  renderAll();
}

// --- Archive panel ---

function renderArchivePanel() {
  if (!showArchivePanel) {
    archivePanelEl.classList.add("hidden");
    boardColumnsEl.classList.remove("hidden");
    return;
  }
  const archived = getArchivedItems();
  archivePanelEl.classList.remove("hidden");
  boardColumnsEl.classList.add("hidden");
  archiveListEl.innerHTML = "";

  archived.forEach(item => {
    const row = document.createElement("div");
    row.className = "archive-list-row";

    const projectName = data.projects.find(p => p.id === item.projectId)?.name || item.projectId;
    const projectSpan = document.createElement("span");
    projectSpan.textContent = projectName;
    projectSpan.style.minWidth = "120px";
    row.appendChild(projectSpan);

    const releaseName = (() => {
      if (!item.releaseId) return "(no release)";
      const proj = data.projects.find(p => p.id === item.projectId);
      if (!proj) return "(unknown)";
      const rel = (proj.releases || []).find(r => r.id === item.releaseId);
      return rel ? rel.name : item.releaseId;
    })();
    const releaseSpan = document.createElement("span");
    releaseSpan.textContent = releaseName;
    releaseSpan.style.minWidth = "100px";
    row.appendChild(releaseSpan);

    const titleSpan = document.createElement("span");
    titleSpan.className = "archive-title";
    titleSpan.textContent = item.title;
    titleSpan.title = item.title;
    row.appendChild(titleSpan);

    const dateSpan = document.createElement("span");
    dateSpan.textContent = item.completedAt
      ? new Date(item.completedAt).toLocaleDateString()
      : "";
    dateSpan.style.minWidth = "90px";
    row.appendChild(dateSpan);

    archiveListEl.appendChild(row);
  });
}

// --- Main render orchestrator ---

function renderAll() {
  // If current project is out of scope, reset to ALL
  if (currentProjectId !== "ALL") {
    const project = data.projects.find(p => p.id === currentProjectId);
    if (!project || project.type !== activeProjectType) {
      currentProjectId = "ALL";
    }
  }

  renderHeaderTypeToggle();
  renderProjectChips();
  renderTagChips();
  renderViewButtons();
  renderBoard();
  renderArchivePanel();
  saveStateToUrl();
}

// --- Event wiring ---

viewButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    view = btn.dataset.view;
    // Exit Quick Edit when switching views
    if (quickEditMode) {
      quickEditMode = false;
      qeModeNormalBtn.classList.add("active");
      qeModeQuickBtn.classList.remove("active");
      qeToggleHint.classList.add("hidden");
    }
    renderAll();
  });
});

if (archiveToggleCheckbox) {
  archiveToggleCheckbox.addEventListener("change", () => {
    showArchivePanel = archiveToggleCheckbox.checked;
    renderArchivePanel();
  });
}

if (qeModeNormalBtn) {
  qeModeNormalBtn.addEventListener("click", () => {
    quickEditMode = false;
    qeModeNormalBtn.classList.add("active");
    qeModeQuickBtn.classList.remove("active");
    qeToggleHint.classList.add("hidden");
    renderAll();
  });
}

if (qeModeQuickBtn) {
  qeModeQuickBtn.addEventListener("click", () => {
    quickEditMode = true;
    qeModeNormalBtn.classList.remove("active");
    qeModeQuickBtn.classList.add("active");
    qeToggleHint.classList.remove("hidden");
    renderAll();
  });
}

// Double-click for inline editing in Quick Edit
document.addEventListener("dblclick", (ev) => {
  const td = ev.target.closest("td");
  if (!td || !td.classList.contains("qe-cell-editable")) return;
  qeStartEditCell(td);
});

// --- Init (wait for common.js, then render) ---

document.addEventListener("app:ready", () => {
  loadStateFromUrl();
  renderAll();
});
