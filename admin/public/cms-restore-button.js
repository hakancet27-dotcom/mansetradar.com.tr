(() => {
  const repo = "hakancet27-dotcom/haber-botu";
  const workflowFile = "restore-single-article.yml";
  const branch = "main";
  const stageByCollection = {
    delete_flow_unpublished: "unpublished",
    delete_flow_archived: "archived",
    delete_flow_trash: "trash",
  };
  const buttonId = "mr-restore-button";

  function collectionName() {
    const match = location.hash.match(/collections\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
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
      `/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
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

  async function handleRestore(button, articlePath, stage) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Geri Aliniyor...";

    try {
      await triggerRestore(articlePath, stage);
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
    if (!stage || !isEntryPage()) return;
    if (document.getElementById(buttonId)) return;

    const marker = markerSlugFromHash();
    const articlePath = markerToArticlePath(marker);
    if (!articlePath) return;

    const deleteButton = Array.from(document.querySelectorAll("button")).find((button) => {
      const text = `${button.innerText || ""} ${button.getAttribute("aria-label") || ""}`.toLowerCase();
      return text.includes("delete") || text.includes("sil");
    });

    const target = deleteButton && deleteButton.parentElement ? deleteButton.parentElement : document.body;
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Geri Al";
    button.title = `Bu haberi bir onceki asamaya geri alir: ${articlePath}`;
    button.style.cssText = "display:inline-flex;align-items:center;margin-left:8px;padding:8px 12px;border:0;border-radius:6px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;line-height:1;cursor:pointer;";
    button.onclick = () => handleRestore(button, articlePath, stage);

    if (deleteButton && deleteButton.nextSibling) {
      target.insertBefore(button, deleteButton.nextSibling);
    } else {
      target.appendChild(button);
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
