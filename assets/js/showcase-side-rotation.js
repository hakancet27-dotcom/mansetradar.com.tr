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
    allCards = Array.prototype.slice.call(sidebar.querySelectorAll('.side-headline')).slice(0, 10);
  }

  function eligibleCards() {
    var selected = selectedTopic();
    if (selected === 'son-dakika') return allCards.slice();
    return allCards.filter(function (card) {
      return card.dataset.topic === selected;
    });
  }

  function showPage(index) {
    if (!visibleCards.length) {
      allCards.forEach(function (card) {
        card.hidden = true;
        card.setAttribute('aria-hidden', 'true');
        card.setAttribute('tabindex', '-1');
      });
      status.hidden = true;
      return;
    }

    page = (index + pageCount) % pageCount;
    allCards.forEach(function (card) {
      var position = visibleCards.indexOf(card);
      var visible = position >= 0 && Math.floor(position / pageSize) === page;
      card.hidden = !visible;
      card.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!visible) card.setAttribute('tabindex', '-1');
      else card.removeAttribute('tabindex');
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
