(function () {
  'use strict';

  var cache = null;
  var timer = null;
  var savedCards = null;
  var savedSections = null;
  var activeRequest = 0;
  var MAX_RESULTS = 120;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }
    fn();
  }

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

  function unique(values) {
    var seen = Object.create(null);
    return values.filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function dateText(item) {
    var iso = String(item.date_iso || '');
    var pretty = String(item.date || '');
    var parts = [];
    if (pretty) parts.push(pretty);
    if (iso) {
      parts.push(iso);
      var match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        parts.push(match[3] + '.' + match[2] + '.' + match[1]);
        parts.push(match[3] + ' ' + match[2] + ' ' + match[1]);
        parts.push(match[3] + match[2] + match[1]);
      }
    }
    return parts.join(' ');
  }

  function tagsText(item) {
    if (Array.isArray(item.tags)) return item.tags.join(' ');
    return item.tags || '';
  }

  function enrich(item) {
    var title = item.title || '';
    var summary = item.summary || '';
    var category = [item.category, item.category_slug].join(' ');
    var topic = [item.topic_label, item.topic_slug].join(' ');
    var source = [item.source_name, item.source_url].join(' ');
    var tags = tagsText(item);
    var dates = dateText(item);
    var slug = [item.slug, item.id, item.url, item.canonical_url].join(' ');
    var haystack = normalize([
      title,
      summary,
      category,
      topic,
      source,
      tags,
      dates,
      slug
    ].join(' '));

    return Object.assign({}, item, {
      _title: normalize(title),
      _summary: normalize(summary),
      _category: normalize(category),
      _topic: normalize(topic),
      _source: normalize(source),
      _tags: normalize(tags),
      _date: normalize(dates),
      _slug: normalize(slug),
      _haystack: haystack,
      _tokens: haystack.split(' ')
    });
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch('/data/articles.json', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('articles failed');
        return response.json();
      })
      .then(function (payload) {
        var items = Array.isArray(payload) ? payload : (payload.articles || payload.items || []);
        cache = items.map(enrich);
        return cache;
      })
      .catch(function () {
        return fetch('/data/search-index.json', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) return { items: [] };
            return response.json();
          })
          .then(function (payload) {
            var items = Array.isArray(payload) ? payload : (payload.items || payload.articles || []);
            cache = items.map(enrich);
            return cache;
          })
          .catch(function () {
            cache = [];
            return cache;
          });
      });
  }

  function containsAll(item, words) {
    return words.every(function (word) {
      if (item._haystack.indexOf(word) > -1) return true;
      return item._tokens.some(function (token) {
        return token.indexOf(word) === 0 || word.indexOf(token) === 0;
      });
    });
  }

  function termScore(field, word, exactWeight, prefixWeight, containsWeight) {
    if (!field) return 0;
    if (field === word) return exactWeight;
    if (field.indexOf(word + ' ') === 0) return prefixWeight;
    if (field.indexOf(' ' + word + ' ') > -1 || field.indexOf(' ' + word) === field.length - word.length - 1) {
      return containsWeight;
    }
    if (field.indexOf(word) > -1) return Math.max(1, Math.floor(containsWeight / 2));
    return 0;
  }

  function score(item, query, words) {
    if (!containsAll(item, words)) return 0;

    var scoreValue = 1;
    if (item._title === query) scoreValue += 180;
    if (item._title.indexOf(query) === 0) scoreValue += 120;
    if (item._title.indexOf(query) > -1) scoreValue += 95;
    if (item._summary.indexOf(query) > -1) scoreValue += 28;
    if (item._category === query || item._topic === query) scoreValue += 70;
    if (item._category.indexOf(query) > -1 || item._topic.indexOf(query) > -1) scoreValue += 45;
    if (item._tags.indexOf(query) > -1) scoreValue += 34;
    if (item._source.indexOf(query) > -1) scoreValue += 20;
    if (item._date.indexOf(query) > -1) scoreValue += 30;

    words.forEach(function (word) {
      scoreValue += termScore(item._title, word, 45, 32, 22);
      scoreValue += termScore(item._category, word, 28, 20, 16);
      scoreValue += termScore(item._topic, word, 28, 20, 16);
      scoreValue += termScore(item._tags, word, 20, 14, 10);
      scoreValue += termScore(item._source, word, 14, 10, 7);
      scoreValue += termScore(item._summary, word, 9, 7, 5);
      scoreValue += termScore(item._date, word, 16, 12, 10);
      scoreValue += termScore(item._slug, word, 8, 6, 4);
    });

    if (String(item.section || '') === 'articles') scoreValue += 4;
    if (String(item.date_iso || '').indexOf('2026-06-13') === 0) scoreValue += 2;
    return scoreValue;
  }

  function search(items, rawQuery) {
    var query = normalize(rawQuery);
    var words = unique(tokenize(query));
    if (!words.length) return [];

    var seen = Object.create(null);
    return items
      .map(function (item) {
        return { item: item, score: score(item, query, words) };
      })
      .filter(function (entry) {
        if (entry.score <= 0) return false;
        var key = entry.item.slug || entry.item.url || entry.item.canonical_url || entry.item.id || entry.item.title;
        key = normalize(key);
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        var dateCompare = String(b.item.date_iso || '').localeCompare(String(a.item.date_iso || ''));
        if (dateCompare) return dateCompare;
        return String(a.item.title || '').localeCompare(String(b.item.title || ''), 'tr');
      })
      .slice(0, MAX_RESULTS)
      .map(function (entry) {
        return entry.item;
      });
  }

  function empty(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function appendText(parent, tag, className, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value || '';
    parent.appendChild(element);
    return element;
  }

  function saveState(grid) {
    if (!savedCards) savedCards = Array.prototype.slice.call(grid.children);
    if (!savedSections) {
      savedSections = Array.prototype.slice.call(document.querySelectorAll('[data-news-section]')).map(function (section) {
        return { section: section, hidden: section.hidden };
      });
    }
  }

  function restore(grid, status) {
    document.body.dataset.searchActive = 'false';
    empty(grid);
    (savedCards || []).forEach(function (card) {
      grid.appendChild(card);
    });
    (savedSections || []).forEach(function (entry) {
      entry.section.hidden = entry.hidden;
    });
    if (status) status.textContent = '';
    if (window.countCards) window.countCards();
    if (window.refreshSideHeadlineRotation) window.refreshSideHeadlineRotation();
  }

  function countryLabel(country) {
    if (country === 'USA') return 'US Amerika';
    if (country === 'Germany') return 'DE Almanya';
    return 'TR Türkiye';
  }

  function itemUrl(item) {
    var url = item.url || item.canonical_url || '#';
    if (url.indexOf('https://mansetradar.com.tr/') === 0) {
      return url.replace('https://mansetradar.com.tr', '');
    }
    return url;
  }

  function itemImage(item) {
    if (item.image && item.image.url) return item.image.url;
    return item.image_url || '';
  }

  function card(item) {
    var title = item.title || 'Haber';
    var href = itemUrl(item);
    var image = itemImage(item);
    var topic = item.topic_slug || item.category_slug || normalize(item.category || 'gundem').replace(/\s+/g, '-');
    var article = document.createElement('article');
    var imageLink;
    var body;
    var meta;
    var heading;
    var headingLink;
    var footer;
    var readMore;

    article.className = 'news-card topic-card is-global-search-card';
    article.dataset.topic = topic;
    article.dataset.globalSearch = 'true';

    if (image) {
      imageLink = document.createElement('a');
      imageLink.className = 'card-image-link';
      imageLink.href = href;
      imageLink.setAttribute('aria-label', title);
      var imageWrap = document.createElement('div');
      imageWrap.className = 'card-image';
      var img = document.createElement('img');
      img.src = image;
      img.alt = item.image_alt || (item.image && item.image.alt) || title;
      img.loading = 'lazy';
      img.width = 1080;
      img.height = 720;
      imageWrap.appendChild(img);
      imageLink.appendChild(imageWrap);
      article.appendChild(imageLink);
    }

    body = document.createElement('div');
    body.className = 'card-body';
    meta = document.createElement('div');
    meta.className = 'card-meta';
    appendText(meta, 'span', 'card-category', countryLabel(item.country));
    appendText(meta, 'span', 'card-topic', item.topic_label || item.category || 'Gündem');
    appendText(meta, 'time', 'card-date', item.date || item.date_iso || '');
    body.appendChild(meta);

    heading = document.createElement('h3');
    heading.className = 'card-title';
    headingLink = document.createElement('a');
    headingLink.href = href;
    headingLink.textContent = title;
    heading.appendChild(headingLink);
    body.appendChild(heading);
    if (item.summary) appendText(body, 'p', 'card-excerpt', item.summary);

    footer = document.createElement('div');
    footer.className = 'card-footer';
    readMore = appendText(footer, 'a', 'read-more', 'Devamını Oku →');
    readMore.href = href;
    readMore.setAttribute('aria-label', title + ' haberini oku');
    body.appendChild(footer);
    article.appendChild(body);
    return article;
  }

  function render(grid, status, query, items) {
    var owner = grid.closest('[data-news-section]');
    empty(grid);
    items.forEach(function (item) {
      grid.appendChild(card(item));
    });
    document.body.dataset.searchActive = 'true';
    document.querySelectorAll('[data-news-section]').forEach(function (section) {
      section.hidden = owner ? section !== owner : false;
    });
    if (status) {
      status.textContent = items.length
        ? items.length + ' sonuç bulundu. En alakalı haberler önce gösteriliyor.'
        : '"' + query + '" için haber bulunamadı.';
    }
    if (window.countCards) window.countCards();
    if (window.refreshSideHeadlineRotation) window.refreshSideHeadlineRotation();
  }

  function updateUrl(query) {
    if (!window.history || !window.history.replaceState) return;
    var url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function install() {
    var input = document.getElementById('news-search-input');
    var clear = document.getElementById('news-search-clear');
    var grid = document.getElementById('grid-turkey') || document.querySelector('.news-grid');
    var status = document.getElementById('news-search-status');
    var shell = document.querySelector('.header-search');
    if (!input || !grid) return;

    function run(options) {
      var query = input.value.trim();
      var requestId = ++activeRequest;
      if (clear) clear.hidden = !query;
      if (!query) {
        restore(grid, status);
        if (!options || options.url !== false) updateUrl('');
        return;
      }
      saveState(grid);
      if (status) status.textContent = 'Aranıyor...';
      load().then(function (items) {
        if (requestId !== activeRequest) return;
        var results = search(items, query);
        render(grid, status, query, results);
        if (!options || options.url !== false) updateUrl(query);
      });
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 140);
    }

    if (shell) {
      shell.addEventListener('click', function () {
        shell.classList.add('is-open');
        input.focus();
      });
      input.addEventListener('focus', function () {
        shell.classList.add('is-open');
      });
      input.addEventListener('blur', function () {
        if (!input.value.trim()) shell.classList.remove('is-open');
      });
    }

    input.addEventListener('input', function (event) {
      event.stopImmediatePropagation();
      schedule();
    }, true);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        if (clear) clear.hidden = true;
        restore(grid, status);
        updateUrl('');
        input.blur();
      }
    }, true);
    if (clear) {
      clear.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        input.value = '';
        clear.hidden = true;
        restore(grid, status);
        updateUrl('');
        input.focus();
      }, true);
    }

    var initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery && !input.value) {
      input.value = initialQuery;
      if (clear) clear.hidden = false;
      if (shell) shell.classList.add('is-open');
      run({ url: false });
    }
  }

  ready(install);
  window.MansetRadarSearch = {
    normalize: normalize,
    tokenize: tokenize,
    search: search,
    enrich: enrich
  };
})();
