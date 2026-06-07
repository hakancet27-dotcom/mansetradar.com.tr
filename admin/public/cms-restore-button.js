(() => {
  const repo = 'hakancet27-dotcom/haber-botu';
  const workflow = 'restore-single-article.yml';
  const stageByCollection = {
    delete_flow_unpublished: 'unpublished',
    delete_flow_archived: 'archived',
    delete_flow_trash: 'trash',
  };

  function collectionName() {
    const match = location.hash.match(/collections\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function markerSlugFromHash() {
    const match = location.hash.match(/entries\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function markerToArticlePath(marker) {
    if (!marker) return '';
    return marker.replace(/__/g, '/').replace(/\.json$/, '.json');
  }

  function isEntryPage() {
    return /\/entries\//.test(location.hash);
  }

  function insertButton() {
    const col = collectionName();
    const stage = stageByCollection[col];
    if (!stage || !isEntryPage()) return;
    if (document.getElementById('mr-restore-workflow-button')) return;

    const marker = markerSlugFromHash();
    const articlePath = markerToArticlePath(marker);
    if (!articlePath) return;

    const deleteButton = Array.from(document.querySelectorAll('button')).find((button) => {
      const text = `${button.innerText || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
      return text.includes('delete') || text.includes('sil');
    });
    const target = deleteButton && deleteButton.parentElement ? deleteButton.parentElement : document.body;

    const link = document.createElement('a');
    link.id = 'mr-restore-workflow-button';
    link.textContent = 'Geri Al';
    link.href = `https://github.com/${repo}/actions/workflows/${workflow}?article_path=${encodeURIComponent(articlePath)}&current_stage=${encodeURIComponent(stage)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = `Bu haberi geri almak icin workflow ekranini acar: ${articlePath}`;
    link.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px;padding:8px 12px;border-radius:6px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;line-height:1;';

    if (deleteButton && deleteButton.nextSibling) {
      target.insertBefore(link, deleteButton.nextSibling);
    } else {
      target.appendChild(link);
    }
  }

  function tick() {
    try {
      insertButton();
    } catch (error) {
      console.warn('restore button failed', error);
    }
  }

  setInterval(tick, 1000);
  window.addEventListener('hashchange', () => setTimeout(tick, 300));
})();

