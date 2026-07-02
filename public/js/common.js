// ============================================
// Backlog Manager — Common / Shared Logic
// ============================================

// --- Global state ---
let data = { projects: [], items: [], notes: [] };
let config = { dataDir: "", dataFile: "" };
let lastSyncAt = null;
let activeProjectType = "work";  // "work" | "argonath"
let currentProjectId = "ALL";
let activeTags = new Set();
let _suppressPopstate = false;

// Modal resolve
let modalResolve = null;

// DOM refs (status bar)
const statusDataFileEl = document.getElementById("statusDataFile");
const statusLastSyncEl = document.getElementById("statusLastSync");
const syncNowBtn = document.getElementById("syncNowBtn");

// DOM refs (header type toggle)
const headerTypeToggle = document.getElementById("headerTypeToggle");
const toggleKnob = document.getElementById("toggleKnob");
const toggleLabels = document.querySelectorAll(".toggle-label");

// --- API ---

async function loadConfig() {
  try {
    const resp = await fetch("/api/config");
    if (resp.ok) {
      config = await resp.json();
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
}

async function loadDataFromServer() {
  try {
    const resp = await fetch("/api/backlog");
    if (!resp.ok) {
      console.error("Server error loading backlog:", resp.status, resp.statusText);
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 500) {
        alert(
          "ERROR: Data file corruption detected.\n\n" +
          (err.message || "The backlog data file could not be read. A backup may exist at backlog.json.bak") +
          "\n\nPlease check the server logs and restore from backup if needed."
        );
      }
      return;
    }
    data = await resp.json();
    // Backwards compatibility: ensure all releases and projects have a description field
    for (const project of data.projects) {
      if (project.description === undefined) {
        project.description = "";
      }
      if (project.releases) {
        for (const release of project.releases) {
          if (release.description === undefined) {
            release.description = "";
          }
        }
      }
    }
    // Backwards compatibility: ensure notes array exists
    if (!data.notes) {
      data.notes = [];
    }
  } catch (e) {
    console.error("Failed to load backlog", e);
  }
}

async function saveDataToServer() {
  try {
    const resp = await fetch("/api/backlog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      console.error("Failed to save backlog", resp.status);
      return;
    }
    lastSyncAt = new Date();
    sessionStorage.setItem("lastSyncAt", lastSyncAt.toISOString());
    renderStatusBar();
  } catch (e) {
    console.error("Error saving backlog", e);
  }
}

// --- Helpers ---

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function buildItemPrompt(item) {
  const filesLines = (item.filesAffected && item.filesAffected.length > 0)
    ? item.filesAffected.map(f => `- ${f}`).join("\n")
    : "(none)";
  return `# ${item.title}

## Analysis
${item.analysis && item.analysis.trim() ? item.analysis : "(none)"}

## Files Affected
${filesLines}

## Prompt
${item.prompt && item.prompt.trim() ? item.prompt : "(none)"}`;
}

let _toastEl = null;
let _toastTimer = null;

function showToast(message) {
  if (!_toastEl) {
    _toastEl = document.createElement("div");
    _toastEl.className = "toast";
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = message;
  _toastEl.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    _toastEl.classList.remove("show");
  }, 2000);
}

function copyItemPromptToClipboard(item) {
  const text = buildItemPrompt(item);
  const onSuccess = () => showToast("Prompt copied to clipboard");
  const onFailure = () => showToast("Failed to copy prompt");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      copyViaFallback(text) ? onSuccess() : onFailure();
    });
  } else {
    copyViaFallback(text) ? onSuccess() : onFailure();
  }
}

function copyViaFallback(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    return false;
  }
}

function isArchivedDone(item) {
  if (item.state !== "DONE" || !item.completedAt) return false;
  const ageDays = Math.floor((Date.now() - item.completedAt) / (24 * 3600 * 1000));
  return ageDays > 7;
}

function getVisibleBoardItems() {
  return data.items.filter(item => {
    // project filter
    if (currentProjectId !== "ALL" && item.projectId !== currentProjectId) return false;
    // project type filter
    const project = data.projects.find(p => p.id === item.projectId);
    if (!project || project.type !== activeProjectType) return false;
    // tag filter
    if (activeTags.size > 0) {
      const tagsSet = new Set(item.tags || []);
      for (const t of activeTags) {
        if (!tagsSet.has(t)) return false;
      }
    }
    // hide archived DONE from board
    if (isArchivedDone(item)) return false;
    return true;
  });
}

function getArchivedItems() {
  return data.items.filter(isArchivedDone);
}

// --- Rendering: status bar ---

function renderStatusBar() {
  if (statusDataFileEl) {
    statusDataFileEl.textContent = config.dataFile
      ? `Data file: ${config.dataFile}`
      : "Data file: (unknown)";
  }
  if (statusLastSyncEl) {
    statusLastSyncEl.textContent = lastSyncAt
      ? `Last sync: ${lastSyncAt.toLocaleTimeString()}`
      : "Last sync: \u2014";
  }
}

// --- Header type toggle ---

function renderHeaderTypeToggle() {
  const isArgonath = activeProjectType === "argonath";
  toggleLabels.forEach(lbl => {
    lbl.classList.toggle("active", lbl.dataset.type === activeProjectType);
  });
  toggleKnob.classList.toggle("argonath", isArgonath);
}

function toggleProjectType() {
  activeProjectType = activeProjectType === "argonath" ? "work" : "argonath";
  renderHeaderTypeToggle();
  // Each page defines its own renderAll
  if (typeof window.renderAll === "function") {
    window.renderAll();
  }
}

// --- Tag suggestions (search-as-you-type) ---

function setupTagSuggestions(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(suggestionsId);
  if (!input || !container) return;

  const getAllTags = () => {
    const tags = new Set();
    data.items.forEach(item => (item.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  };

  const showSuggestions = (filter) => {
    const allTags = getAllTags();
    const lower = filter.toLowerCase();
    const matches = allTags.filter(t => t.toLowerCase().includes(lower) && lower.length > 0);
    if (matches.length === 0) {
      container.classList.add("hidden");
      return;
    }
    container.innerHTML = "";
    container.classList.remove("hidden");
    matches.forEach(tag => {
      const el = document.createElement("div");
      el.className = "tag-suggestion-item";
      el.textContent = tag;
      el.addEventListener("click", () => {
        const parts = input.value.split(",").map(s => s.trim());
        if (parts.length > 0 && parts[parts.length - 1] !== "") {
          parts[parts.length - 1] = tag;
        } else {
          parts.push(tag);
        }
        input.value = parts.join(", ") + ", ";
        container.classList.add("hidden");
        input.focus();
      });
      container.appendChild(el);
    });
  };

  input.addEventListener("input", () => {
    const parts = input.value.split(",");
    const lastPart = parts[parts.length - 1].trim();
    showSuggestions(lastPart);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => container.classList.add("hidden"), 200);
  });

  input.addEventListener("focus", () => {
    const parts = input.value.split(",");
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) showSuggestions(lastPart);
  });
}

// --- Maximize modal ---

function setupMaximizeButton(modalDialogEl) {
  const existing = modalDialogEl.querySelector(".modal-maximize-btn");
  if (existing) return;

  const btn = document.createElement("button");
  btn.className = "modal-maximize-btn";
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>
  </svg>`;
  btn.title = "Maximize / restore";
  btn.addEventListener("click", () => {
    modalDialogEl.classList.toggle("maximized");
    const isMax = modalDialogEl.classList.contains("maximized");
    btn.innerHTML = isMax
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
          <line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/>
        </svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>
        </svg>`;
  });

  modalDialogEl.querySelector(".modal-header").appendChild(btn);
}

// --- Custom modal ---

const modalOverlay = document.getElementById("modalOverlay");
const modalDialog = document.getElementById("modalDialog");
const modalHeader = document.getElementById("modalHeader");
const modalBody = document.querySelector(".modal-body");
const modalMessage = document.getElementById("modalMessage");
const modalInput = document.getElementById("modalInput");
const modalFooter = document.getElementById("modalFooter");

function openModal({ title, message, showInput, inputPlaceholder, inputValue, buttons, bodyHtml, onOpen }) {
  return new Promise(resolve => {
    modalResolve = resolve;
    modalHeader.textContent = title || "";
    if (bodyHtml) {
      modalBody.innerHTML = bodyHtml;
    } else {
      modalBody.innerHTML = `<p class="modal-message">${message || ""}</p>
        <input class="modal-input ${showInput ? "" : "hidden"}" id="modalInput" type="text" placeholder="${inputPlaceholder || ""}" value="${inputValue || ""}">`;
    }
    const inputField = document.getElementById("modalInput");
    if (showInput && inputField) {
      setTimeout(() => inputField.focus(), 50);
    }
    modalFooter.innerHTML = "";
    let keyHandler = null;
    let focusedBtnEl = null;
    const cleanup = () => {
      if (keyHandler) {
        document.removeEventListener("keydown", keyHandler);
        keyHandler = null;
      }
    };
    buttons.forEach((btn) => {
      const el = document.createElement("button");
      el.className = "modal-btn " + (btn.className || "modal-btn-primary");
      el.textContent = btn.label;
      el.addEventListener("click", () => {
        cleanup();
        closeModal();
        if (btn.getValues) {
          resolve(btn.getValues());
        } else {
          const inp = document.getElementById("modalInput");
          resolve(btn.value !== undefined ? btn.value : (inp ? inp.value.trim() : true));
        }
      });
      modalFooter.appendChild(el);
      if (btn.focused) {
        focusedBtnEl = el;
        setTimeout(() => el.focus(), 50);
      }
    });
    modalOverlay.classList.remove("hidden");
    setupMaximizeButton(modalDialog);
    keyHandler = e => {
      if (e.key === "Escape") {
        cleanup();
        closeModal();
        resolve(null);
      }
      if (e.key === "Enter") {
        // If Shift+Enter is pressed, let the browser insert a newline
        if (e.shiftKey) return;
        // If focus is in a textarea, let the browser handle Enter (newline)
        if (e.target && e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (focusedBtnEl) {
          focusedBtnEl.click();
        } else {
          const inp = document.getElementById("modalInput");
          if (inp && inp.value.trim()) {
            cleanup();
            closeModal();
            resolve(inp.value.trim());
          }
        }
      }
    };
    document.addEventListener("keydown", keyHandler);
    if (onOpen) setTimeout(onOpen, 50);
  });
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

async function showPrompt(title, message, placeholder) {
  const val = await openModal({
    title,
    message,
    showInput: true,
    inputPlaceholder: placeholder || "",
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      { label: "OK", className: "modal-btn-primary" }
    ]
  });
  if (val === "__cancel__" || val === null) return null;
  return val;
}

async function showConfirm(title, message) {
  const val = await openModal({
    title,
    message,
    showInput: false,
    buttons: [
      { label: "Cancel", value: "__cancel__", className: "modal-btn-cancel" },
      { label: "Confirm", value: "__confirm__", className: "modal-btn-danger", focused: true }
    ]
  });
  return val === "__confirm__";
}

// --- Event wiring (common) ---

if (headerTypeToggle) {
  headerTypeToggle.addEventListener("click", toggleProjectType);
}

if (syncNowBtn) {
  syncNowBtn.addEventListener("click", () => {
    saveDataToServer();
  });
}

// --- Init (auto-load) ---

(async function init() {
  await loadConfig();
  await loadDataFromServer();
  // Restore lastSyncAt across page navigations (survives full page reloads within the tab)
  try {
    const stored = sessionStorage.getItem("lastSyncAt");
    if (stored) {
      lastSyncAt = new Date(stored);
    }
  } catch (_) { /* sessionStorage may be unavailable */ }
  renderStatusBar();
  renderHeaderTypeToggle();
  setInterval(saveDataToServer, 60_000); // periodic sync
  // Dispatch event so page-specific scripts can render
  document.dispatchEvent(new CustomEvent("app:ready"));
})();
