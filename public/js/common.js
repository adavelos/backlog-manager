// ============================================
// Backlog Manager — Common / Shared Logic
// ============================================

// --- Global state ---
let data = { projects: [], items: [], notes: [], scratchpads: { work: { content: "", createdAt: 0, updatedAt: 0 }, argonath: { content: "", createdAt: 0, updatedAt: 0 } } };
let config = { dataDir: "", dataFile: "" };
let activeProjectType = "work";  // "work" | "argonath"
let currentProjectId = "ALL";
let activeTags = new Set();
let _suppressPopstate = false;

// Modal resolve
let modalResolve = null;

// DOM refs (status bar)
const statusDataFileEl = document.getElementById("statusDataFile");

// DOM refs (header type toggle)
const headerTypeToggle = document.getElementById("headerTypeToggle");
const toggleKnob = document.getElementById("toggleKnob");
const toggleLabels = document.querySelectorAll(".toggle-label");

// --- API ---

async function loadConfig() {
  try {
    const resp = await fetch("/api/config");
    if (resp.ok) {
      const result = await resp.json();
      config = result;
      return result;
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
  return null;
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
    // Invalidate page-specific render caches (e.g., tag/project chip cache in boards.js)
    if (typeof window.invalidateRenderCaches === 'function') {
      window.invalidateRenderCaches();
    }
    // Backwards compatibility: ensure missing fields exist
    for (const project of data.projects) {
      if (project.description === undefined) project.description = "";
      if (project.sortOrder === undefined) project.sortOrder = 0;
      if (project.releases) {
        for (const release of project.releases) {
          if (release.description === undefined) release.description = "";
          if (release.sortOrder === undefined) release.sortOrder = 0;
        }
      }
    }
    // Backwards compatibility: ensure notes array exists
    if (!data.notes) {
      data.notes = [];
    }
    // Scratchpads stored separately from structured notes: each project type
    // (work/argonath) gets a single persistent scratchpad for ultra-fast capture
    // without requiring title/project/release selection. Stored in data root,
    // not in data.notes, to keep them independent from the note hierarchy.
    if (!data.scratchpads) {
      data.scratchpads = {};
    }
    ["work", "argonath"].forEach(type => {
      if (!data.scratchpads[type]) {
        const now = Date.now();
        data.scratchpads[type] = { content: "", createdAt: now, updatedAt: now };
      }
    });
  } catch (e) {
    console.error("Failed to load backlog", e);
  }
}

// Wraps a scoped api.js call (apiUpdateItem, apiCreateNote, etc). Callers
// apply their optimistic local mutation + renderAll() *before* invoking this;
// on failure we pull the authoritative state back from the server so a
// dropped request can't leave the local copy silently diverged from disk.
async function syncMutation(promiseFn, { onSuccess, errorMessage } = {}) {
  try {
    const result = await promiseFn();
    if (onSuccess) onSuccess(result);
    return result;
  } catch (e) {
    console.error(errorMessage || "Save failed", e);
    showToast(errorMessage || "Save failed — reloading latest data");
    await loadDataFromServer();
    if (typeof window.renderAll === "function") window.renderAll();
    throw e;
  }
}

// Coalesces rapid-fire changes (e.g. typing) into a single call ~1s after
// the last change, instead of firing a request per keystroke.
function debounce(fn, delayMs = 1000) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
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
  let result = `# ${item.title}`;

  if (item.analysis && item.analysis.trim()) {
    result += `\n\n## Analysis\n${item.analysis}`;
  }

  if (item.filesAffected && item.filesAffected.length > 0) {
    result += `\n\n## Files Affected\n${item.filesAffected.map(f => `- ${f}`).join("\n")}`;
  }

  if (item.prompt && item.prompt.trim()) {
    result += `\n\n## Prompt\n${item.prompt}`;
  }

  return result;
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

function matchesActiveFilters(item) {
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
  return true;
}

function getVisibleBoardItems() {
  return data.items.filter(item => {
    if (!matchesActiveFilters(item)) return false;
    // hide archived DONE from board
    if (isArchivedDone(item)) return false;
    return true;
  });
}

function getArchivedItems() {
  return data.items.filter(item => isArchivedDone(item) && matchesActiveFilters(item));
}

// --- Rendering: status bar ---

function renderStatusBar() {
  if (statusDataFileEl) {
    statusDataFileEl.textContent = config.dataFile
      ? `Data file: ${config.dataFile}`
      : "Data file: (unknown)";
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
      modalOverlay.removeEventListener("click", overlayClickHandler);
    };
    const overlayClickHandler = (e) => {
      if (e.target === modalOverlay) {
        cleanup();
        closeModal();
        resolve(null);
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
    modalOverlay.addEventListener("click", overlayClickHandler);
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

// --- SessionStorage cache (instant navigation) ---

const CACHE_KEY = 'backlog_cache_v2';

function saveCache(data, config) {
  try {
    const payload = JSON.stringify({ data, config, ts: Date.now() });
    // sessionStorage quota is ~5MB; our data is usually <50KB, safe
    sessionStorage.setItem(CACHE_KEY, payload);
  } catch (e) {
    // sessionStorage full or unavailable — silently ignore
  }
}

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Check if the cached data is stale by comparing dataTimestamps.
 * Can compare against a provided serverConfig to avoid re-fetching.
 */
function isCacheStale(cached, serverConfig) {
  if (!cached || !cached.config || !cached.config.dataTimestamp) return false;
  // Use provided serverConfig if available, otherwise use global config
  const cfg = serverConfig || config;
  if (!cfg || !cfg.dataTimestamp) return false;
  return cfg.dataTimestamp !== cached.config.dataTimestamp;
}

// --- Init (auto-load) ---

// Page scripts (boards.js, projects.js, notes.js) await window.appReady instead
// of listening for an "app:ready" event. An event's delivery depends on the
// listener already being registered at the moment it fires, which is not
// guaranteed across separate <script> tags (a microtask can fire before the
// next script has even been fetched, and a macrotask can race the same fetch).
// A promise has no such race: .then() runs immediately if already resolved,
// or later if not—correct regardless of which script finishes loading first.
window.appReady = (async function init() {
  const t0 = performance.now();
  const cached = loadCache();
  const t1 = performance.now();

  // If we have cached data, check staleness using the cached config timestamp.
  // Only fetch server config if cache is missing—this avoids an API call on every navigation.
  let serverConfig = null;
  let configFetchTime = 0;

  if (!cached) {
    // No cache—must fetch both config and data from server
    const t2 = performance.now();
    serverConfig = await loadConfig();
    configFetchTime = performance.now() - t2;
  }

  if (cached && !isCacheStale(cached, serverConfig)) {
    // ── Instant render from cache (no need to check server) ──
    config = cached.config;
    data = cached.data;
    // Invalidate page-specific render caches when loading from cache
    if (typeof window.invalidateRenderCaches === 'function') {
      window.invalidateRenderCaches();
    }
    renderStatusBar();
    renderHeaderTypeToggle();
    const t2 = performance.now();
    console.log(`[PERF] Cache hit: ${(t2-t0).toFixed(0)}ms`);
  } else {
    // ── Fresh load from server (no cache, or cache is stale) ──
    if (cached) {
      console.log('Cache stale — loading fresh data from server');
    }
    if (!serverConfig) {
      // We skipped loadConfig because cache existed; fetch it now that we know cache is stale
      const t2 = performance.now();
      serverConfig = await loadConfig();
      configFetchTime = performance.now() - t2;
    }
    config = serverConfig || {};
    const t2 = performance.now();
    await loadDataFromServer();
    const t3 = performance.now();
    saveCache(data, config);
    const t4 = performance.now();
    renderStatusBar();
    renderHeaderTypeToggle();
    const t5 = performance.now();
    console.log(`[PERF] Fresh load: ${(t5-t0).toFixed(0)}ms`);
  }
})();

// Cache data on unload so the next page in this tab gets the latest state
// (including any in-memory edits that haven't been saved to the server yet).
window.addEventListener('beforeunload', () => {
  saveCache(data, config);
});
