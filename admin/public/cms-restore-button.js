(() => {
  const articleCollections = new Set(["published_tr", "published_en", "published_de"]);
  const stockEnabledCollections = new Set(["published_tr", "published_en", "published_de"]);
  const deleteButtonState = { disabled: false };

  function normalizeText(value) {
    return `${value || ""}`.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  }

  function collectionName() {
    const match = location.hash.match(/collections\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function isArticleCollection() {
    return articleCollections.has(collectionName());
  }

  function isEntryPage() {
    return /\/entries\//.test(location.hash);
  }

  function isVisibleElement(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function selectedCountFromBanner() {
    const nodes = Array.from(document.querySelectorAll("body *"));
    for (const node of nodes) {
      const text = `${node.textContent || ""}`.trim();
      const match = text.match(/^(\d+)\s+of\s+\d+\s+selected$/i);
      if (match) {
        return Number(match[1]);
      }
    }
    return null;
  }

  function selectedCountFromCheckboxes() {
    const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
    if (!checked.length) return 0;
    const rows = new Set();
    for (const input of checked) {
      const row = input.closest("li, article, tr, div");
      if (row) {
        rows.add(row);
      }
    }
    return rows.size || checked.length;
  }

  function selectedCount() {
    if (isEntryPage()) return 1;
    const bannerCount = selectedCountFromBanner();
    if (bannerCount !== null) {
      return bannerCount;
    }
    return selectedCountFromCheckboxes();
  }

  function articleDeleteButton() {
    const candidates = Array.from(document.querySelectorAll("button"));
    return candidates.find((button) => {
      const text = normalizeText(`${button.innerText || ""} ${button.getAttribute("aria-label") || ""}`);
      if (!text.includes("delete")) return false;
      if (!isVisibleElement(button)) return false;
      const rect = button.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.45 && rect.left > window.innerWidth * 0.55;
    }) || null;
  }

  function fieldContainerByLabel(labelText) {
    const normalized = normalizeText(labelText);
    const labels = Array.from(document.querySelectorAll("label, legend, div, span"));
    for (const element of labels) {
      if (normalizeText(element.textContent || "") !== normalized) continue;
      const container = element.closest("section, div, fieldset");
      if (container) {
        return container;
      }
    }
    return null;
  }

  function fieldInputByLabel(labelText) {
    const container = fieldContainerByLabel(labelText);
    if (!container) return null;
    return container.querySelector("input, textarea, [contenteditable='true']");
  }

  function setNativeValue(element, value) {
    if (!element) return;
    const prototype = element.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement?.prototype
      : window.HTMLInputElement?.prototype;
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncStockImageSelection() {
    if (!stockEnabledCollections.has(collectionName()) || !isEntryPage()) {
      return;
    }
    const stockInput = fieldInputByLabel("Stok Havuzundan Sec");
    const imageInput = fieldInputByLabel("Gorsel URL / Yukleme Yolu");
    if (!stockInput || !imageInput) {
      return;
    }
    const selectedValue = `${stockInput.value || stockInput.textContent || ""}`.trim();
    if (!selectedValue || stockInput.dataset.mrAppliedValue === selectedValue) {
      return;
    }
    stockInput.dataset.mrAppliedValue = selectedValue;
    if (`${imageInput.value || ""}`.trim() !== selectedValue) {
      setNativeValue(imageInput, selectedValue);
    }
  }

  function applyDeleteGuard() {
    const button = articleDeleteButton();
    if (!button) {
      return;
    }
    if (!button.dataset.mrDeleteTitle) {
      button.dataset.mrDeleteTitle = button.getAttribute("title") || "";
    }

    const canDelete = !isArticleCollection() || isEntryPage() || selectedCount() === 1;
    button.setAttribute("aria-disabled", canDelete ? "false" : "true");

    if (canDelete) {
      if (deleteButtonState.disabled) {
        button.disabled = false;
        button.style.pointerEvents = "";
        button.style.opacity = "";
        button.style.cursor = "";
        button.setAttribute("title", button.dataset.mrDeleteTitle || "Bu haberi kalici olarak sil.");
        deleteButtonState.disabled = false;
      }
      return;
    }

    button.disabled = true;
    button.style.pointerEvents = "none";
    button.style.opacity = "0.45";
    button.style.cursor = "not-allowed";
    button.setAttribute("title", "Delete sadece tek haber seciliyken aktif.");
    deleteButtonState.disabled = true;
  }

  function refreshUiGuards() {
    syncStockImageSelection();
    applyDeleteGuard();
  }

  let lastHash = location.hash;

  window.addEventListener("hashchange", () => {
    lastHash = location.hash;
    window.setTimeout(refreshUiGuards, 120);
  });

  window.setInterval(() => {
    if (location.hash !== lastHash) {
      lastHash = location.hash;
    }
    refreshUiGuards();
  }, 400);

  window.addEventListener("load", () => {
    window.setTimeout(refreshUiGuards, 250);
  });
})();
