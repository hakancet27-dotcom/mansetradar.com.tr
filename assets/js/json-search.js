/*
  Header icin hafif JSON arama paneli.
  Ana sayfada global-search.js grid sonucunu yonetir; bu panel daha cok
  news/nachrichten gibi liste sayfalarinda eski haberleri hizli buldurur.
*/
(function () {
  'use strict';

  var searchDataPromise = null;
  var searchItems = [];
  var minLength = 2;
  var maxResults = 10;

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Ã§/g, 'c')
      .replace(/ÄŸ/g, 'g')
      .replace(/Ä±/g, 'i')
      .replace(/Ã¶/g, 'o')
      .replace(/ÅŸ/g, 's')
      .replace(/Ã¼/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    return normalize(value).split(' ').filter(function (token) {
      return token.length > 1 || /^\d+$/.test(token);
    });
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

  function tagsText(item) {
    return Array.isArray(item.tags) ? item.tags.join(' ') : (item.tags || '');
  }

  function dateText(item) {
    var iso = String(item.date_iso || '');
    var pretty = String(item.date || '');
    if (!iso) return pretty;
    var match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return [pretty, iso, match ? match[3] + '.' + match[2] + '.' + match[1] : ''].join(' ');
  }

  function enrich(item) {
    var haystack = normalize([
      item.title,
      item.summary,
      item.category,
      item.category_slug,
      item.topic_label,
      item.topic_slug,
      item.source_name,
      tagsText(item),
      dateText(item),
      item.slug,
      item.url
    ].join(' '));
    return Object.assign({}, item, {
      _title: normalize(item.title),
      _summary: normalize(item.summary),
      _category: normalize([item.category, item.category_slug].join(' ')),
      _topic: normalize([item.topic_label, item.topic_slug].join(' ')),
      _tags: normalize(tagsText(item)),
      _date: normalize(dateText(item)),
      _haystack: haystack
    });
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
      '.json-search-panel{position:absolute;top:calc(100% + 10px);right:0;z-index:700;width:min(460px,92vw);max-height:min(540px,70vh);overflow:auto;background:#fff;border:1px solid #e4e7ec;border-radius:12px;box-shadow:0 22px 50px rgba(15,23,42,.18);padding:8px;color:#111827;text-align:left}',
      '.json-search-panel[hidden]{display:none!important}',
      '.json-search-title{padding:8px 10px 9px;font-size:.76rem;font-weight:900;color:#667085;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #eef0f3}',
      '.json-search-item{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:10px;border-radius:10px;text-decoration:none;color:#111827}',
      '.json-search-item:hover,.json-search-item:focus{background:#fff1f1;outline:0}',
      '.json-search-thumb{width:64px;height:48px;border-radius:8px;object-fit:cover;background:#eef2f7}',
      '.json-search-meta{display:flex;gap:8px;align-items:center;margin-bottom:3px;font-size:.72rem;font-weight:900;color:#e10600}',
      '.json-search-date{color:#667085;font-weight:800}',
      '.json-search-heading{display:block;font-size:.9rem;line-height:1.28;font-weight:900;color:#111827}',
      '.json-search-summary{display:block;margin-top:3px;font-size:.76rem;line-height:1.35;color:#667085}',
      '.json-search-empty{padding:13px 10px;color:#667085;font-weight:800}',
      '@media(max-width:640px){.json-search-panel{position:fixed;left:10px;right:10px;top:112px;width:auto;max-height:60vh}.json-search-item{grid-template-columns:58px 1fr}.json-search-thumb{width:58px;height:44px}.json-search-summary{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function loadSearchData() {
    if (searchDataPromise) return searchDataPromise;
    searchDataPromise = fetch('/data/search-index.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('search-index failed');
        return response.json();
      })
      .then(function (payload) {
        searchItems = (payload.items || payload.articles || []).map(enrich);
        return searchItems;
      })
      .catch(function () {
        searchItems = [];
        return searchItems;
      });
    return searchDataPromise;
  }

  function scoreItem(item, query, words) {
    if (!words.every(function (word) { return item._haystack.indexOf(word) > -1; })) return 0;
    var score = 1;
    if (item._title === query) score += 160;
    if (item._title.indexOf(query) === 0) score += 100;
    if (item._title.indexOf(query) > -1) score += 80;
    if (item._category.indexOf(query) > -1 || item._topic.indexOf(query) > -1) score += 44;
    if (item._tags.indexOf(query) > -1) score += 28;
    if (item._summary.indexOf(query) > -1) score += 22;
    if (item._date.indexOf(query) > -1) score += 24;
    words.forEach(function (word) {
      if (item._title.indexOf(word) > -1) score += 24;
      if (item._category.indexOf(word) > -1 || item._topic.indexOf(word) > -1) score += 14;
      if (item._tags.indexOf(word) > -1) score += 10;
      if (item._summary.indexOf(word) > -1) score += 5;
    });
    return score;
  }

  function render(panel, rawTerm) {
    var query = normalize(rawTerm);
    var words = tokenize(query);
    if (!query || query.length < minLength || !words.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var results = searchItems
      .map(function (item) { return { item: item, score: scoreItem(item, query, words) }; })
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
    panel.innerHTML = '<div class="json-search-title">Arama sonuçları</div>' + results.map(function (item) {
      var image = item.image_url ? '<img class="json-search-thumb" src="' + escapeHtml(item.image_url) + '" alt="" loading="lazy">' : '<span class="json-search-thumb" aria-hidden="true"></span>';
      return '<a class="json-search-item" role="option" href="' + escapeHtml(safeUrl(item.url)) + '">' +
        image +
        '<span>' +
          '<span class="json-search-meta"><span>' + escapeHtml(item.topic_label || item.category || 'Haber') + '</span><span class="json-search-date">' + escapeHtml(item.date_iso || '') + '</span></span>' +
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
    if (document.getElementById('news-search-clear') || document.getElementById('news-search-status')) return;
    injectStyle();
    var panel = ensurePanel(shell);
    var timer = null;

    function update() {
      var term = input.value;
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
