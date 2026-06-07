(() => {
  const workflowRepo = "hakancet27-dotcom/haber-botu";
  const workflowFile = "restore-single-article.yml";
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
  const buttonId = "mr-restore-button";
  const buttonStyle = "display:inline-flex;align-items:center;margin-left:8px;padding:8px 12px;border:0;border-radius:6px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;line-height:1;cursor:pointer;";
  const disabledButtonStyle = `${buttonStyle}opacity:.55;cursor:not-allowed;`;
  const collectionFolders = {
    public: {
      delete_flow_unpublished: "cms-delete-flow/unpublished",
      delete_flow_archived: "cms-delete-flow/archived",
      delete_flow_trash: "cms-delete-flow/trash",
    },
    newsroom: {
      delete_flow_unpublished: "newsroom/delete-flow/unpublished",
      delete_flow_archived: "newsroom/delete-flow/archived",
      delete_flow_trash: "newsroom/delete-flow/trash",
    },
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
    return marker.replace(/__/g, "/").replace(/\.json$/, ".json");
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

  async function triggerRestore(articlePath, stage) {
    const token = readStoredToken();
    if (!token) {
      throw new Error("GitHub oturumu bulunamadi. Panelden yeniden giris yap.");
    }

    await githubRequest(
      `/repos/${workflowRepo}/actions/workflows/${workflowFile}/dispatches`,
      token,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: branch,
          inputs: {
            article_path: articlePath,
            current_stage: stage,
          },
        }),
      }
    );
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

  function selectedRowTexts() {
    const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
    const texts = [];

    for (const input of checked) {
      const row = input.closest('[role="row"], li, article, div');
      if (!row) continue;
      const text = normalizeText(row.innerText || "");
      if (!text) continue;
      if (text.includes("of 1 selected") || text.includes("selected")) continue;
      if (text === "delete" || text === "new") continue;
      texts.push(text);
    }

    return Array.from(new Set(texts));
  }

  async function selectedArticlePaths() {
    if (isEntryPage()) {
      const marker = markerSlugFromHash();
      const articlePath = markerToArticlePath(marker);
      return articlePath ? [articlePath] : [];
    }

    const folder = collectionFolder();
    if (!folder) return [];

    const selectedTexts = selectedRowTexts();
    if (!selectedTexts.length) return [];

    const entries = await loadFolderEntries(folder);
    const matches = [];

    for (const rowText of selectedTexts) {
      const match = entries.find((entry) => {
        const title = normalizeText(entry.title);
        const slug = normalizeText(entry.slug);
        return (
          (title && rowText.includes(title)) ||
          (title && title.includes(rowText)) ||
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

  function insertButton() {
    const col = collectionName();
    const stage = stageByCollection[col];
    const existing = document.getElementById(buttonId);
    if (!stage) {
      if (existing) existing.remove();
      return;
    }

    const deleteButton = Array.from(document.querySelectorAll("button")).find((button) => {
      const text = `${button.innerText || ""} ${button.getAttribute("aria-label") || ""}`.toLowerCase();
      return text.includes("delete") || text.includes("sil");
    });
    if (!deleteButton) return;

    const canRestoreFromHere = isEntryPage() || selectedRowTexts().length > 0;
    const target = deleteButton.parentElement || document.body;

    let button = existing;
    if (!button) {
      button = document.createElement("button");
      button.id = buttonId;
      button.type = "button";
      target.appendChild(button);
    }

    button.textContent = "Geri Al";
    button.title = canRestoreFromHere
      ? "Bu haberi bir onceki asamaya geri alir."
      : "Once geri alinacak haberi sec.";
    button.disabled = !canRestoreFromHere;
    button.style.cssText = canRestoreFromHere ? buttonStyle : disabledButtonStyle;
    button.onclick = () => {
      if (!button.disabled) {
        handleRestore(button, stage);
      }
    };

    if (deleteButton.nextSibling !== button) {
      target.insertBefore(button, deleteButton.nextSibling);
    }
  }

  function tick() {
    try {
      insertButton();
    } catch (error) {
      console.warn("restore button failed", error);
    }
  }

  setInterval(tick, 1000);
  window.addEventListener("hashchange", () => setTimeout(tick, 300));
})();
