(function () {
  'use strict';

  var sidebar = document.querySelector('.side-headlines');
  if (!sidebar) return;

  var allCards = [];

  var pageSize = 2;
  var visibleCards = allCards.slice();
  var pageCount = 1;
  var page = 0;
  var timer = null;
  var paused = false;
  var hiddenClass = 'is-side-rotation-hidden';
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sidebar.classList.add('is-rotating');

  var status = document.createElement('span');
  status.className = 'side-rotation-status';
  status.setAttribute('aria-hidden', 'true');
  sidebar.appendChild(status);

  function selectedTopic() {
    return new URLSearchParams(window.location.search).get('kategori') || 'son-dakika';
  }

  function collectCards() {
    var cards = Array.prototype.slice.call(sidebar.querySelectorAll('.side-headline'));
    allCards = cards.slice(0, 10);
    cards.slice(10).forEach(function (card) {
      setCardVisible(card, false);
    });
  }

  function eligibleCards() {
    var selected = selectedTopic();
    if (selected === 'son-dakika') return allCards.slice();
    return allCards.filter(function (card) {
      return card.dataset.topic === selected;
    });
  }

  function setCardVisible(card, visible) {
    card.hidden = false;
    card.classList.toggle(hiddenClass, !visible);
    card.dataset.sideRotationVisible = visible ? 'true' : 'false';
    card.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) card.setAttribute('tabindex', '-1');
    else card.removeAttribute('tabindex');
  }

  function showPage(index) {
    if (!visibleCards.length) {
      allCards.forEach(function (card) {
        setCardVisible(card, false);
      });
      status.hidden = true;
      return;
    }

    page = (index + pageCount) % pageCount;
    allCards.forEach(function (card) {
      var position = visibleCards.indexOf(card);
      var visible = position >= 0 && Math.floor(position / pageSize) === page;
      setCardVisible(card, visible);
    });
    status.hidden = pageCount <= 1;
    status.textContent = String(page + 1) + ' / ' + String(pageCount);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    if (reducedMotion || pageCount <= 1 || paused) return;
    timer = window.setInterval(function () {
      showPage(page + 1);
    }, 4000);
  }

  function refresh() {
    stop();
    collectCards();
    sidebar.appendChild(status);
    visibleCards = eligibleCards();
    pageCount = Math.max(1, Math.ceil(visibleCards.length / pageSize));
    page = 0;
    showPage(0);
    start();
  }

  sidebar.addEventListener('mouseenter', function () {
    paused = true;
    stop();
  });
  sidebar.addEventListener('mouseleave', function () {
    paused = false;
    start();
  });
  sidebar.addEventListener('focusin', function () {
    paused = true;
    stop();
  });
  sidebar.addEventListener('focusout', function (event) {
    if (sidebar.contains(event.relatedTarget)) return;
    paused = false;
    start();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  window.refreshSideHeadlineRotation = refresh;
  refresh();
})();

(function () {
  'use strict';

  var loadedItems = null;
  var savedCards = null;
  var savedSections = null;
  var timer = null;

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function norm(value) {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
      .replace(/\s+/g, ' ').trim();
  }

  function getItems() {
    if (loadedItems) return Promise.resolve(loadedItems);
    return fetch('/data/articles.json', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : { articles: [] }; })
      .then(function (data) {
        loadedItems = Array.isArray(data) ? data : (data.articles || data.items || []);
        return loadedItems;
      })
      .catch(function () { return []; });
  }

  function saveState(grid) {
    if (!savedCards) savedCards = Array.prototype.slice.call(grid.children);
    if (!savedSections) {
      savedSections = Array.prototype.slice.call(document.querySelectorAll('[data-news-section]')).map(function (node) {
        return { node: node, hidden: node.hidden };
      });
    }
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function restore(grid, state) {
    document.body.dataset.searchActive = 'false';
    clearNode(grid);
    (savedCards || []).forEach(function (card) { grid.appendChild(card); });
    (savedSections || []).forEach(function (entry) { entry.node.hidden = entry.hidden; });
    if (state) state.textContent = '';
    if (typeof window.refreshSideHeadlineRotation === 'function') window.refreshSideHeadlineRotation();
  }

  function match(item, words) {
    var text = norm([
      item.title, item.summary, item.category, item.date, item.date_iso,
      item.source_name, Array.isArray(item.tags) ? item.tags.join(' ') : ''
    ].join(' '));
    return words.every(function (word) { return text.indexOf(word) >= 0; });
  }

  function labelForCountry(country) {
    if (country === 'USA') return 'US Amerika';
    if (country === 'Germany') return 'DE Almanya';
    return 'TR Türkiye';
  }

  function addText(parent, tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text || '';
    parent.appendChild(node);
    return node;
  }

  function makeCard(item) {
    var title = item.title || 'Haber';
    var href = item.url || item.canonical_url || '#';
    var topic = item.category_slug || norm(item.category || 'gundem').replace(/\s+/g, '-');
    var card = document.createElement('article');
    card.className = 'news-card topic-card is-global-search-card';
    card.dataset.topic = topic;
    card.dataset.globalSearch = 'true';

    var imageUrl = item.image_url || (item.image && item.image.url) || '';
    if (imageUrl) {
      var imageLink = document.createElement('a');
      imageLink.className = 'card-image-link';
      imageLink.href = href;
      imageLink.setAttribute('aria-label', title);
      var imageWrap = document.createElement('div');
      imageWrap.className = 'card-image';
      var image = document.createElement('img');
      image.src = imageUrl;
      image.alt = item.image_alt || (item.image && item.image.alt) || title;
      image.loading = 'lazy';
      image.width = 1080;
      image.height = 720;
      imageWrap.appendChild(image);
      imageLink.appendChild(imageWrap);
      card.appendChild(imageLink);
    }

    var body = document.createElement('div');
    body.className = 'card-body';
    var meta = document.createElement('div');
    meta.className = 'card-meta';
    addText(meta, 'span', 'card-category', labelForCountry(item.country));
    addText(meta, 'span', 'card-topic', item.category || 'Gündem');
    addText(meta, 'time', 'card-date', item.date || item.date_iso || '').setAttribute('datetime', item.date_iso || '');
    body.appendChild(meta);

    var h3 = document.createElement('h3');
    h3.className = 'card-title';
    var link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    h3.appendChild(link);
    body.appendChild(h3);
    if (item.summary) addText(body, 'p', 'card-excerpt', item.summary);

    var footer = document.createElement('div');
    footer.className = 'card-footer';
    var read = addText(footer, 'a', 'read-more', 'Devamını Oku →');
    read.href = href;
    read.setAttribute('aria-label', title + ' haberini oku');
    body.appendChild(footer);
    card.appendChild(body);
    return card;
  }

  function showResults(grid, state, items) {
    clearNode(grid);
    items.slice(0, 120).forEach(function (item) { grid.appendChild(makeCard(item)); });
    document.body.dataset.searchActive = 'true';
    document.querySelectorAll('[data-news-section]').forEach(function (section) {
      var owner = grid.closest('[data-news-section]');
      section.hidden = owner ? section !== owner : false;
    });
    if (state) state.textContent = items.length ? items.length + ' sonuç bulundu.' : 'Aramanıza uygun haber bulunamadı.';
  }

  function install() {
    var input = document.getElementById('news-search-input');
    var clear = document.getElementById('news-search-clear');
    var grid = document.getElementById('grid-turkey') || document.querySelector('.news-grid');
    var state = document.getElementById('news-search-status');
    if (!input || !grid) return;

    function run() {
      var words = norm(input.value).split(' ').filter(Boolean);
      if (clear) clear.hidden = !words.length;
      if (!words.length) return restore(grid, state);
      saveState(grid);
      getItems().then(function (items) { showResults(grid, state, items.filter(function (item) { return match(item, words); })); });
    }

    input.addEventListener('input', function (event) {
      event.stopImmediatePropagation();
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, 120);
    }, true);

    if (clear) clear.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      clear.hidden = true;
      restore(grid, state);
      input.focus();
    }, true);
  }

  onReady(install);
})();
