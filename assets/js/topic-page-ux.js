(function () {
  'use strict';

  var topics = {
    'son-dakika': {
      label: 'Son Dakika',
      heading: 'Son Dakika Türkiye Haberleri',
      note: 'Gündem, siyaset, ekonomi ve sıcak gelişmelerden seçilen Türkiye manşetleri.',
      title: 'Son Dakika Haberleri | mansetradar.com.tr'
    },
    'gundem': {
      label: 'Gündem',
      heading: 'Türkiye Gündem Haberleri',
      note: 'Gündem kategorisindeki güncel haberler gösteriliyor.',
      title: 'Gündem Haberleri | mansetradar.com.tr'
    },
    'siyaset': {
      label: 'Siyaset',
      heading: 'Türkiye Siyaset Haberleri',
      note: 'Siyaset kategorisindeki güncel haberler gösteriliyor.',
      title: 'Siyaset Haberleri | mansetradar.com.tr'
    },
    'ekonomi': {
      label: 'Ekonomi',
      heading: 'Türkiye Ekonomi Haberleri',
      note: 'Ekonomi kategorisindeki güncel haberler gösteriliyor.',
      title: 'Ekonomi Haberleri | mansetradar.com.tr'
    },
    'dunya': {
      label: 'Dünya',
      heading: 'Dünya Haberleri',
      note: 'Dünya kategorisindeki güncel haberler gösteriliyor.',
      title: 'Dünya Haberleri | mansetradar.com.tr'
    },
    'spor': {
      label: 'Spor',
      heading: 'Türkiye Spor Haberleri',
      note: 'Spor kategorisindeki güncel haberler gösteriliyor.',
      title: 'Spor Haberleri | mansetradar.com.tr'
    },
    'magazin': {
      label: 'Magazin',
      heading: 'Türkiye Magazin Haberleri',
      note: 'Magazin kategorisindeki güncel haberler gösteriliyor.',
      title: 'Magazin Haberleri | mansetradar.com.tr'
    },
    'teknoloji': {
      label: 'Teknoloji',
      heading: 'Türkiye Teknoloji Haberleri',
      note: 'Teknoloji kategorisindeki güncel haberler gösteriliyor.',
      title: 'Teknoloji Haberleri | mansetradar.com.tr'
    },
    'saglik': {
      label: 'Sağlık',
      heading: 'Türkiye Sağlık Haberleri',
      note: 'Sağlık kategorisindeki güncel haberler gösteriliyor.',
      title: 'Sağlık Haberleri | mansetradar.com.tr'
    }
  };

  function selectedTopic() {
    var topic = new URLSearchParams(window.location.search).get('kategori') || 'son-dakika';
    return topics[topic] ? topic : 'son-dakika';
  }

  function normalize(value) {
    return (value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u');
  }

  function normalizeCategoryLinks() {
    document.querySelectorAll('.topic-link[data-topic]').forEach(function (link) {
      var topic = link.dataset.topic;
      if (!topic || topic === 'son-dakika') {
        link.setAttribute('href', '/haber/');
        return;
      }
      link.setAttribute('href', '/haber/?kategori=' + encodeURIComponent(topic));
    });
  }

  function inferredTopicForTitle(title) {
    var text = normalize(title);

    if (/(magazin|eurovision|sarki yarismasi|tv yayin akisi|ibrahim tatlises|bulent sakrak|duygu arabacioglu|dizi|oyuncu)/.test(text)) {
      return 'magazin';
    }
    if (/(dunya kupasi|futbol|basketbol|super lig|sampiyonlar ligi|uefa|fifa|wolfsburg|milli takim|corum fk)/.test(text)) {
      return 'spor';
    }
    if (/(ebola|hantavirus|virus salgini|pandemi|saglik acil|kanser|hemsirelik|saglikli mi|beslenme|matcha)/.test(text)) {
      return 'saglik';
    }
    if (/(openai|yapay zeka|artificial intelligence|cip fabrikasi|halbleiter|semiconductor)/.test(text)) {
      return 'teknoloji';
    }
    if (/(el nino|iklim krizi|iklim degisikligi)/.test(text)) {
      return 'dunya';
    }
    if (/(enflasyon|faiz|borsa|piyasa|vergi reformu|\bdax\b|ekonomik yardim|maliye bakani)/.test(text)) {
      return 'ekonomi';
    }
    return '';
  }

  function repairClearCategoryErrors() {
    document.querySelectorAll('.topic-card').forEach(function (card) {
      var titleNode = card.querySelector('.headline-title, .card-title');
      var corrected = inferredTopicForTitle(titleNode ? titleNode.textContent : '');
      if (!corrected || !topics[corrected]) return;

      card.dataset.topic = corrected;
      card.querySelectorAll('.headline-topic, .card-topic').forEach(function (label) {
        label.textContent = topics[corrected].label;
      });
    });
  }

  function makeElement(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function buildHeroFromFeedCard(source, topic) {
    var sourceLink = source.querySelector('.card-title a[href], .card-image-link[href]');
    var sourceTitle = source.querySelector('.card-title');
    if (!sourceLink || !sourceTitle) return null;

    var title = sourceTitle.textContent.trim();
    var slide = makeElement('a', 'headline-slide headline-card topic-card is-category-promoted-hero');
    slide.href = sourceLink.getAttribute('href');
    slide.dataset.topic = topic;
    slide.setAttribute('aria-label', title);

    var sourceImage = source.querySelector('.card-image img');
    var media;
    if (sourceImage && sourceImage.getAttribute('src')) {
      media = makeElement('div', 'headline-image');
      var image = document.createElement('img');
      image.src = sourceImage.getAttribute('src');
      image.alt = sourceImage.getAttribute('alt') || title;
      image.loading = 'eager';
      image.setAttribute('fetchpriority', 'high');
      image.width = 1080;
      image.height = 720;
      media.appendChild(image);
    } else {
      media = makeElement('div', 'headline-placeholder');
      media.setAttribute('aria-hidden', 'true');
      media.appendChild(makeElement('span', '', topics[topic].label));
    }

    var content = makeElement('div', 'headline-content');
    var meta = makeElement('div', 'headline-meta');
    meta.appendChild(makeElement('span', 'headline-tag', 'Öne Çıkan'));
    meta.appendChild(makeElement('span', 'headline-topic', topics[topic].label));
    content.appendChild(meta);
    content.appendChild(makeElement('h3', 'headline-title', title));

    var sourceDate = source.querySelector('.card-date');
    if (sourceDate) {
      var date = makeElement('time', 'headline-date', sourceDate.textContent.trim());
      if (sourceDate.getAttribute('datetime')) date.setAttribute('datetime', sourceDate.getAttribute('datetime'));
      content.appendChild(date);
    }

    slide.appendChild(media);
    slide.appendChild(content);
    return slide;
  }

  function buildEmptyHero(topic) {
    var slide = makeElement('div', 'headline-slide headline-card topic-card is-category-empty-hero');
    slide.dataset.topic = topic;
    slide.dataset.nonNews = 'true';
    slide.setAttribute('role', 'status');
    slide.setAttribute('aria-label', topics[topic].label + ' kategorisinde henüz manşet bulunmuyor');

    var media = makeElement('div', 'headline-placeholder');
    media.setAttribute('aria-hidden', 'true');
    media.appendChild(makeElement('span', '', topics[topic].label));

    var content = makeElement('div', 'headline-content');
    var meta = makeElement('div', 'headline-meta');
    meta.appendChild(makeElement('span', 'headline-tag', 'Kategori'));
    meta.appendChild(makeElement('span', 'headline-topic', topics[topic].label));
    content.appendChild(meta);
    content.appendChild(makeElement('h3', 'headline-title', topics[topic].label + ' kategorisinde yeni manşet bekleniyor'));
    content.appendChild(makeElement('p', 'headline-date', 'Yeni haber yayınlandığında burada görünecek.'));

    slide.appendChild(media);
    slide.appendChild(content);
    return slide;
  }

  function ensureCategoryHero() {
    var topic = selectedTopic();
    if (topic === 'son-dakika') return;

    var slider = document.querySelector('.headline-slider');
    if (!slider || slider.querySelector('.headline-slide[data-topic="' + topic + '"]')) return;

    var source = document.querySelector('.news-card.topic-card[data-topic="' + topic + '"]');
    var slide = source ? buildHeroFromFeedCard(source, topic) : buildEmptyHero(topic);
    if (!slide) return;

    var controls = slider.querySelector('.slider-controls');
    slider.insertBefore(slide, controls || null);
    if (source) source.remove();
  }

  function activateCategoryHero() {
    var topic = selectedTopic();
    if (topic === 'son-dakika') return;
    var slider = document.querySelector('.headline-slider');
    if (!slider) return;
    var selected = slider.querySelector('.headline-slide[data-topic="' + topic + '"]:not([hidden])');
    if (!selected) return;
    slider.querySelectorAll('.headline-slide').forEach(function (slide) {
      slide.classList.remove('is-active');
    });
    selected.classList.add('is-active');
    slider.classList.toggle('has-image-active', Boolean(selected.querySelector('.headline-image img')));
    var controls = slider.querySelector('.slider-controls');
    if (controls) controls.hidden = true;
  }

  function installAccurateCount() {
    if (typeof window.countCards !== 'function') return;
    window.countCards = function () {
      var pairs = [
        ['count-turkey', '#turkiye .topic-card, #grid-turkey .topic-card'],
        ['count-usa', '#grid-usa .news-card'],
        ['count-germany', '#grid-germany .news-card']
      ];
      pairs.forEach(function (pair) {
        var node = document.getElementById(pair[0]);
        if (!node) return;
        var visibleCards = Array.prototype.slice.call(document.querySelectorAll(pair[1])).filter(function (card) {
          return card.dataset.filteredOut !== 'true' && card.dataset.nonNews !== 'true';
        });
        node.textContent = visibleCards.length;
      });
    };
  }

  function applyCategoryHeading() {
    var topic = topics[selectedTopic()];
    var heading = document.getElementById('turkiye-title');
    var note = document.querySelector('.showcase-note');
    var isEmpty = Boolean(document.querySelector('.is-category-empty-hero[data-topic="' + selectedTopic() + '"]'));

    if (heading) heading.textContent = topic.heading;
    if (note) {
      note.textContent = isEmpty
        ? topic.label + ' kategorisinde henüz yayınlanmış manşet bulunmuyor.'
        : topic.note;
    }
    document.title = topic.title;
  }

  function refreshTopicDisplay() {
    normalizeCategoryLinks();
    repairClearCategoryErrors();
    ensureCategoryHero();
    installAccurateCount();
    applyCategoryHeading();
    if (typeof window.applyTopicFilter === 'function') window.applyTopicFilter();
    activateCategoryHero();
    if (typeof window.countCards === 'function') window.countCards();
    if (typeof window.refreshSideHeadlineRotation === 'function') window.refreshSideHeadlineRotation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshTopicDisplay, { once: true });
  } else {
    refreshTopicDisplay();
  }
})();
