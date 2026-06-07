(() => {
  const branch = "main";
  const dataRepoByPanel = {
    public: "hakancet27-dotcom/mansetradar.com.tr",
    newsroom: "hakancet27-dotcom/haber-botu",
  };
  const stageByCollection = {
    delete_flow_unpublished: "unpublished",
    delete_flow_archived: "archived",
    delete_flow_trash: "trash",
  };
  const deleteFlowCollections = new Set([
    "delete_flow_published",
    "delete_flow_unpublished",
    "delete_flow_archived",
    "delete_flow_trash",
  ]);
  const stockEnabledCollections = new Set([
    "published_tr",
    "published_en",
    "published_de",
  ]);
  const buttonId = "mr-restore-button";
  const buttonStyle = "display:inline-flex;align-items:center;padding:8px 12px;border:0;border-radius:6px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;line-height:1;cursor:pointer;position:fixed;z-index:2147483647;box-shadow:0 2px 10px rgba(0,0,0,.18);";
  const disabledButtonStyle = `${buttonStyle}opacity:.55;cursor:not-allowed;`;
  const collectionFolders = {
    public: {
      delete_flow_published: "cms-delete-flow/published",
      delete_flow_unpublished: "cms-delete-flow/unpublished",
      delete_flow_archived: "cms-delete-flow/archived",
      delete_flow_trash: "cms-delete-flow/trash",
    },
    newsroom: {
      delete_flow_published: "newsroom/delete-flow/published",
      delete_flow_unpublished: "newsroom/delete-flow/unpublished",
      delete_flow_archived: "newsroom/delete-flow/archived",
      delete_flow_trash: "newsroom/delete-flow/trash",
    },
  };
  const restoreStageMap = {
    unpublished: "published",
    archived: "unpublished",
    trash: "archived",
  };
  const entryCache = new Map();

  function collectionName() {
    const match = location.hash.match(/collections\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function panelKind() {
    return location.pathname.includes("/admin/newsroom/") ? "newsroom" : "public";
  }

  function dataRepo() {
    return dataRepoByPanel[panelKind()];
  }

  function collectionFolder() {
    const panel = panelKind();
    const name = collectionName();
    return collectionFolders[panel]?.[name] || "";
  }

  function markerSlugFromHash() {
    const match = location.hash.match(/entries\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function markerToArticlePath(marker) {
    if (!marker) return "";
    const path = marker.replace(/__/g, "/");
    return path.endsWith(".json") ? path : `${path}.json`;
  }

  function isEntryPage() {
    return /\/entries\//.test(location.hash);
  }

  function pickTokenFromObject(value) {
    if (!value || typeof value !== "object") return "";
    const queue = [value];
    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== "object") continue;
      for (const [key, nested] of Object.entries(current)) {
        if (typeof nested === "string") {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("token") || lowerKey.includes("access")) {
            return nested;
          }
        } else if (nested && typeof nested === "object") {
          queue.push(nested);
        }
      }
    }
    return "";
  }

  function readStoredToken() {
    const storages = [window.localStorage, window.sessionStorage];
    for (const storage of storages) {
      if (!storage) continue;
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        const raw = storage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const token = pickTokenFromObject(parsed);
          if (token) return token;
        } catch (_error) {
          if (/(ghp_|github_pat_|ghu_|gho_)/.test(raw)) {
            return raw;
          }
        }
      }
    }
    return "";
  }

  async function githubRequest(path, token, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${text}`.trim());
    }

    return response.status === 204 ? null : response.json();
  }

  function utf8ToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function base64ToUtf8(text) {
    return decodeURIComponent(escape(atob(text)));
  }

  function markerFileName(articlePath) {
    return articlePath.replace(/\//g, "__").replace(/\.json$/i, "") + ".json";
  }

  function nextDeleteAction(stage) {
    return {
      published: "Delete = Yayindan Kaldir",
      unpublished: "Delete = Arsive Tasi",
      archived: "Delete = Cop Kutusuna Gonder",
      trash: "Delete = Kalici Sil",
    }[stage] || "";
  }

  async function fetchContentFile(repo, path, token) {
    return githubRequest(
      `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`,
      token
    );
  }

  async function putContentFile(repo, path, payload, token, sha = "") {
    const body = {
      message: payload.message,
      content: utf8ToBase64(payload.content),
      branch,
    };
    if (sha) body.sha = sha;
    return githubRequest(
      `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
      token,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  }

  async function deleteContentFile(repo, path, token, message) {
    const current = await fetchContentFile(repo, path, token);
    return githubRequest(
      `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
      token,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sha: current.sha,
          branch,
        }),
      }
    );
  }

  async function upsertMarker(repo, articlePath, stage, articlePayload, token) {
    const folder = collectionFolders.public[`delete_flow_${stage}`];
    const path = `${folder}/${markerFileName(articlePath)}`;
    const marker = {
      title: articlePayload.title || articlePayload.slug || articlePath,
      slug: articlePayload.slug || "",
      date: articlePayload.date || "",
      category: articlePayload.category || "",
      language: articlePayload.language || "",
      article_path: articlePath,
      current_stage: stage,
      next_delete_action: nextDeleteAction(stage),
      publication_lifecycle: articlePayload.publication_lifecycle || stage,
    };
    let sha = "";
    try {
      const existing = await fetchContentFile(repo, path, token);
      sha = existing.sha || "";
    } catch (_error) {
      sha = "";
    }
    await putContentFile(
      repo,
      path,
      {
        message: `Sync delete flow marker for ${articlePath}`,
        content: `${JSON.stringify(marker, null, 2)}\n`,
      },
      token,
      sha
    );
  }

  async function restoreViaPublicRepo(articlePath, stage, token) {
    const repo = dataRepo();
    const nextStage = restoreStageMap[stage];
    if (!nextStage) {
      throw new Error(`Desteklenmeyen asama: ${stage}`);
    }

    const articleFile = await fetchContentFile(repo, articlePath, token);
    const articlePayload = JSON.parse(base64ToUtf8((articleFile.content || "").replace(/\n/g, "")));
    const now = new Date().toISOString();
    articlePayload.publication_lifecycle = nextStage;
    articlePayload.publication_changed_at = now;
    articlePayload.publication_changed_by = "cms_restore_button_public";
    articlePayload.manual_noindex = nextStage !== "published";
    articlePayload.indexed_on_home = nextStage === "published";
    articlePayload.publication_note = `CMS restore button applied: ${stage} -> ${nextStage}`;
    if (nextStage !== "trash") {
      delete articlePayload.trashed_at;
      delete articlePayload.trash_delete_after;
    }

    await putContentFile(
      repo,
      articlePath,
      {
        message: `Restore article to ${nextStage}: ${articlePath}`,
        content: `${JSON.stringify(articlePayload, null, 2)}\n`,
      },
      token,
      articleFile.sha
    );

    const currentMarkerPath = `${collectionFolders.public[`delete_flow_${stage}`]}/${markerFileName(articlePath)}`;
    await deleteContentFile(repo, currentMarkerPath, token, `Remove ${stage} marker for ${articlePath}`);
    await upsertMarker(repo, articlePath, nextStage, articlePayload, token);
    entryCache.clear();
  }

  async function triggerRestore(articlePath, stage) {
    const token = readStoredToken();
    if (!token) {
      throw new Error("GitHub oturumu bulunamadi. Panelden yeniden giris yap.");
    }

    if (panelKind() === "public") {
      await restoreViaPublicRepo(articlePath, stage, token);
      return;
    }

    throw new Error("Newsroom geri al akisi henuz public kadar sade degil. Simdilik public panelden geri al.");
  }

  async function loadFolderEntries(folder) {
    const cacheKey = `${dataRepo()}::${folder}`;
    if (entryCache.has(cacheKey)) {
      return entryCache.get(cacheKey);
    }

    const token = readStoredToken();
    if (!token) {
      throw new Error("GitHub oturumu bulunamadi. Panelden yeniden giris yap.");
    }

    const files = await githubRequest(
      `/repos/${dataRepo()}/contents/${folder}?ref=${encodeURIComponent(branch)}`,
      token
    );

    const jsonFiles = Array.isArray(files)
      ? files.filter((item) => item && item.type === "file" && item.name.endsWith(".json"))
      : [];

    const entries = [];
    for (const file of jsonFiles) {
      try {
        const filePayload = await githubRequest(
          `/repos/${dataRepo()}/contents/${folder}/${encodeURIComponent(file.name)}?ref=${encodeURIComponent(branch)}`,
          token
        );
        const raw = atob((filePayload.content || "").replace(/\n/g, ""));
        const parsed = JSON.parse(raw);
        entries.push({
          fileName: file.name,
          title: parsed.title || "",
          slug: parsed.slug || "",
          articlePath: parsed.article_path || markerToArticlePath(file.name),
        });
      } catch (error) {
        console.warn("restore button entry load failed", file?.name, error);
      }
    }

    entryCache.set(cacheKey, entries);
    return entries;
  }

  function normalizeText(value) {
    return `${value || ""}`
      .toLocaleLowerCase("tr")
      .replace(/\s+/g, " ")
      .trim();
  }

  function deleteFlowRowForCheckbox(input) {
    let current = input?.parentElement || null;
    while (current && current !== document.body) {
      const text = `${current.innerText || ""}`.trim();
      if (/\|\s*delete\s*=/i.test(text)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function rawRowTitle(text) {
    return `${text || ""}`
      .replace(/\s+/g, " ")
      .replace(/\|\s*Delete\s*=.*/i, "")
      .trim();
  }

  function selectedDeleteFlowRows() {
    if (!deleteFlowCollections.has(collectionName()) || isEntryPage()) return [];
    const seen = new Set();
    const rows = [];
    const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
    for (const input of checked) {
      const row = deleteFlowRowForCheckbox(input);
      if (!row || seen.has(row)) continue;
      seen.add(row);
      rows.push(row);
    }
    return rows;
  }

  function selectedTitles() {
    if (isEntryPage()) {
      return [];
    }
    return selectedDeleteFlowRows()
      .map((row) => rawRowTitle(row.innerText || ""))
      .filter(Boolean);
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

  function selectedCount() {
    if (isEntryPage()) return 1;
    const bannerCount = selectedCountFromBanner();
    if (bannerCount !== null) return bannerCount;
    return selectedDeleteFlowRows().length;
  }

  function isVisibleElement(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function actionDeleteButton() {
    const candidates = Array.from(document.querySelectorAll("button"));
    return candidates.find((button) => {
      const text = normalizeText(`${button.innerText || ""} ${button.getAttribute("aria-label") || ""}`);
      if (!text.includes("delete")) return false;
      if (!isVisibleElement(button)) return false;
      const rect = button.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.45 && rect.left > window.innerWidth * 0.55;
    });
  }

  async function selectedArticlePaths() {
    if (isEntryPage()) {
      const marker = markerSlugFromHash();
      const articlePath = markerToArticlePath(marker);
      return articlePath ? [articlePath] : [];
    }

    const folder = collectionFolder();
    if (!folder) return [];

    const selectedTexts = selectedTitles();
    if (!selectedTexts.length) {
      const entries = await loadFolderEntries(folder);
      return entries.length === 1 ? [entries[0].articlePath].filter(Boolean) : [];
    }

    const entries = await loadFolderEntries(folder);
    const matches = [];

    for (const rowText of selectedTexts) {
      const match = entries.find((entry) => {
        const title = normalizeText(entry.title);
        const slug = normalizeText(entry.slug);
        return (
          (title && rowText === title) ||
          (title && rowText.includes(title)) ||
          (slug && rowText.includes(slug))
        );
      });
      if (match?.articlePath) {
        matches.push(match.articlePath);
      }
    }

    return Array.from(new Set(matches));
  }

  async function handleRestore(button, stage) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Geri Aliniyor...";

    try {
      const articlePaths = await selectedArticlePaths();
      if (!articlePaths.length) {
        throw new Error("Once tek bir haber sec veya kaydin detayini ac.");
      }

      for (const articlePath of articlePaths) {
        await triggerRestore(articlePath, stage);
      }
      button.textContent = "Geri Al Baslatildi";
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      window.alert(`Geri al baslatilamadi: ${error.message}`);
    }
  }

  function fieldInputByNameOrLabel(name, label) {
    const direct = document.querySelector(`[name="${name}"]`);
    if (direct) return direct;

    const labelledBlocks = Array.from(document.querySelectorAll("body *")).filter((node) => {
      const text = normalizeText(node.textContent || "");
      return text === normalizeText(label || "");
    });

    for (const block of labelledBlocks) {
      let current = block.parentElement;
      while (current && current !== document.body) {
        const candidate = current.querySelector('input, textarea');
        if (candidate) return candidate;
        current = current.parentElement;
      }
    }
    return null;
  }

  function stockSourceInput() {
    return fieldInputByNameOrLabel("stock_image_pick", "Stok Havuzundan Sec");
  }

  function imageUrlInput() {
    return fieldInputByNameOrLabel("image_url", "Gorsel URL / Yukleme Yolu");
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncStockImageSelection() {
    if (!stockEnabledCollections.has(collectionName()) || !isEntryPage()) return;
    const source = stockSourceInput();
    const target = imageUrlInput();
    if (!source || !target) return;
    const value = `${source.value || ""}`.trim();
    if (!value || source.dataset.mrAppliedValue === value) return;
    source.dataset.mrAppliedValue = value;
    if (`${target.value || ""}`.trim() !== value) {
      setNativeValue(target, value);
    }
  }

  function updateDeleteButton(deleteButton) {
    if (!deleteButton || !deleteFlowCollections.has(collectionName()) || isEntryPage()) return;
    const canDelete = selectedCount() === 1;
    deleteButton.disabled = !canDelete;
    deleteButton.style.opacity = canDelete ? "1" : "0.55";
    deleteButton.style.cursor = canDelete ? "pointer" : "not-allowed";
    deleteButton.title = canDelete
      ? "Secili haberi bir sonraki asamaya tasir."
      : "Delete yalnizca tek haber seciliyken calisir.";
  }

  function insertButton() {
    const col = collectionName();
    const stage = stageByCollection[col];
    const existing = document.getElementById(buttonId);
    if (!stage) {
      if (existing) existing.remove();
      return;
    }

    const deleteButton = actionDeleteButton();
    if (!deleteButton) return;

    updateDeleteButton(deleteButton);
    const canRestoreFromHere = selectedCount() === 1;

    let button = existing;
    if (!button) {
      button = document.createElement("button");
      button.id = buttonId;
      button.type = "button";
      document.body.appendChild(button);
    }

    const rect = deleteButton.getBoundingClientRect();
    button.textContent = "Geri Al";
    button.title = canRestoreFromHere
      ? "Bu haberi bir onceki asamaya geri alir."
      : "Once geri alinacak haberi sec.";
    button.disabled = !canRestoreFromHere;
    button.style.cssText = canRestoreFromHere ? buttonStyle : disabledButtonStyle;
    button.style.top = `${Math.max(12, rect.top)}px`;
    button.style.left = `${Math.max(12, rect.left - 120)}px`;
    button.onclick = () => {
      if (!button.disabled) {
        handleRestore(button, stage);
      }
    };
  }

  function tick() {
    try {
      syncStockImageSelection();
      insertButton();
    } catch (error) {
      console.warn("restore button failed", error);
    }
  }

  setInterval(tick, 1000);
  window.addEventListener("hashchange", () => setTimeout(tick, 300));
})();
