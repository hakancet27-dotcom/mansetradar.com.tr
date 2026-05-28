/*
  JSON tabanli haber arama katmani.

  Ne yapar?
  - Mevcut HTML kart filtreleme davranisini bozmadan /data/search-index.json dosyasini okur.
  - Kullanici arama kutusuna yazdiginda ana sayfada gorunmeyen eski haberleri de bulur.
  - Sonuclari header arama kutusunun altinda hafif bir panel olarak gosterir.

  Ne yapmaz?
  - Haber kartlarini, CMS verisini, Supabase uyeliklerini veya yayin akisini degistirmez.
  - Sayfa yuklenirken JSON indirmez; kullanici arama alanina odaklaninca tembel yukleme yapar.
*/
(function () {
  'use strict';

  var searchDataPromise = null;
  var searchItems = [];
  var minLength = 2;
  var maxResults = 8;

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function safeUrl(value) {
    var url = String(value || '');
    if (url.indexOf('/') === 0 || url.indexOf('https://mansetradar.com.tr/') === 0) return url;
    return '/';
  }

  function ensurePanel(shell) {
    var panel = shell.querySelector('.json-search-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'json-search-panel';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', 'Arama sonuçları');
    panel.hidden = true;
    shell.appendChild(panel);
    return panel;
  }

  function injectStyle() {
    if (document.getElementById('json-search-style')) return;
    var style = document.createElement('style');
    style.id = 'json-search-style';
    style.textContent = [
      '.header-search{position:relative;overflow:visible!important}',
      '.json-search-panel{position:absolute;top:calc(100% + 10px);right:0;z-index:700;width:min(430px,92vw);max-height:min(520px,70vh);overflow:auto;background:#fff;border:1px solid #e4e7ec;border-radius:14px;box-shadow:0 22px 50px rgba(15,23,42,.18);padding:8px;color:#111827;text-align:left}',
      '.json-search-panel[hidden]{display:none!important}',
      '.json-search-title{padding:8px 10px 9px;font-size:.76rem;font-weight:900;color:#667085;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #eef0f3}',
      '.json-search-item{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:10px;border-radius:10px;text-decoration:none;color:#111827}',
      '.json-search-item:hover,.json-search-item:focus{background:#fff1f1;outline:0}',
      '.json-search-thumb{width:64px;height:48px;border-radius:8px;object-fit:cover;background:#eef2f7}',
      '.json-search-meta{display:flex;gap:8px;align-items:center;margin-bottom:3px;font-size:.72rem;font-weight:900;color:#e10600}',
      '.json-search-date{color:#667085;font-weight:800}',
      '.json-search-heading{font-size:.9rem;line-height:1.28;font-weight:900;color:#111827}',
      '.json-search-summary{margin-top:3px;font-size:.76rem;line-height:1.35;color:#667085}',
      '.json-search-empty{padding:13px 10px;color:#667085;font-weight:800}',
      '@media(max-width:640px){.json-search-panel{position:fixed;left:10px;right:10px;top:112px;width:auto;max-height:60vh}.json-search-item{grid-template-columns:58px 1fr}.json-search-thumb{width:58px;height:44px}.json-search-summary{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function loadSearchData() {
    if (searchDataPromise) return searchDataPromise;
    searchDataPromise = fetch('/data/search-index.json', { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('search-index failed');
        return response.json();
      })
      .then(function (payload) {
        searchItems = (payload.items || []).map(function (item) {
          var haystack = normalize([
            item.title,
            item.summary,
            item.category,
            item.date_iso
          ].join(' '));
          return Object.assign({}, item, { _search: haystack });
        });
        return searchItems;
      })
      .catch(function () {
        searchItems = [];
        return searchItems;
      });
    return searchDataPromise;
  }

  function scoreItem(item, term) {
    var title = normalize(item.title);
    var category = normalize(item.category);
    var score = 0;
    if (title === term) score += 90;
    if (title.indexOf(term) === 0) score += 60;
    if (title.indexOf(term) > -1) score += 40;
    if (category.indexOf(term) > -1) score += 12;
    if ((item._search || '').indexOf(term) > -1) score += 10;
    return score;
  }

  function render(panel, term) {
    if (!term || term.length < minLength) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var results = searchItems
      .map(function (item) { return { item: item, score: scoreItem(item, term) }; })
      .filter(function (entry) { return entry.score > 0; })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.item.date_iso || '').localeCompare(String(a.item.date_iso || ''));
      })
      .slice(0, maxResults)
      .map(function (entry) { return entry.item; });

    if (!results.length) {
      panel.hidden = false;
      panel.innerHTML = '<div class="json-search-empty">Aramanıza uygun haber bulunamadı.</div>';
      return;
    }

    panel.hidden = false;
    panel.innerHTML = '<div class="json-search-title">JSON arama sonuçları</div>' + results.map(function (item) {
      var image = item.image_url ? '<img class="json-search-thumb" src="' + escapeHtml(item.image_url) + '" alt="" loading="lazy">' : '<span class="json-search-thumb" aria-hidden="true"></span>';
      return '<a class="json-search-item" role="option" href="' + escapeHtml(safeUrl(item.url)) + '">' +
        image +
        '<span>' +
          '<span class="json-search-meta"><span>' + escapeHtml(item.category || 'Haber') + '</span><span class="json-search-date">' + escapeHtml(item.date_iso || '') + '</span></span>' +
          '<span class="json-search-heading">' + escapeHtml(item.title) + '</span>' +
          '<span class="json-search-summary">' + escapeHtml(item.summary || '') + '</span>' +
        '</span>' +
      '</a>';
    }).join('');
  }

  function init() {
    var shell = document.querySelector('.header-search');
    var input = document.getElementById('news-search-input');
    if (!shell || !input) return;
    injectStyle();
    var panel = ensurePanel(shell);
    var timer = null;

    function update() {
      var term = normalize(input.value);
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        loadSearchData().then(function () { render(panel, term); });
      }, 120);
    }

    input.addEventListener('focus', function () {
      loadSearchData().then(update);
    });
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        panel.hidden = true;
        input.blur();
      }
    });
    document.addEventListener('click', function (event) {
      if (!shell.contains(event.target)) panel.hidden = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
