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
        link.setAttribute('href', '/');
        return;
      }
      link.setAttribute('href', '/?kategori=' + encodeURIComponent(topic));
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

  var categoryFeedCache = {};
  var categorySliderTimer = null;

  function markCategoryPartReady(className) {
    document.documentElement.classList.add(className);
    if (
      document.documentElement.classList.contains('category-showcase-ready') &&
      document.documentElement.classList.contains('category-feed-ready')
    ) {
      document.documentElement.classList.add('category-page-ready');
    }
  }

  async function loadCategoryArticles(topic) {
    if (!topic || topic === 'son-dakika') return [];
    if (!categoryFeedCache[topic]) {
      categoryFeedCache[topic] = fetch('/data/categories/' + encodeURIComponent(topic) + '.json')
        .then(function (response) {
          if (!response.ok) return [];
          return response.json();
        })
        .then(function (payload) {
          var articles = Array.isArray(payload) ? payload : (payload.articles || []);
          var seen = new Set();
          return articles.filter(function (article) {
            var href = articleUrl(article);
            var key = articleKey(href);
            if (!key || seen.has(key) || !(article.title || '').trim()) return false;
            seen.add(key);
            return true;
          });
        })
        .catch(function (error) {
          console.warn('Kategori haberleri yuklenemedi:', error);
          return [];
        });
    }
    return categoryFeedCache[topic];
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

  function articleUrl(article) {
    if (!article) return '';
    if (article.url) return article.url;
    if (article.slug) return '/articles/' + article.slug.replace(/^\/+|\/+$/g, '') + '/';
    return '';
  }

  function articleImageUrl(article) {
    if (!article) return '';
    if (article.image && article.image.url) return article.image.url;
    return article.image_url || article.thumbnail || '';
  }

  function articleDateText(article) {
    return article.date || article.date_iso || '';
  }

  function articleKey(href) {
    if (!href) return '';
    try {
      return new URL(href, window.location.origin).pathname.replace(/\/+$/, '/') || '/';
    } catch (error) {
      return href.replace(/\/+$/, '/') || '/';
    }
  }

  function buildCategoryCard(article, topic) {
    var href = articleUrl(article);
    var title = (article.title || '').trim();
    if (!href || !title) return null;

    var card = makeElement('article', 'news-card topic-card is-json-category-card');
    card.dataset.topic = topic;
    card.dataset.dynamicCategory = 'true';

    var imageUrl = articleImageUrl(article);
    if (imageUrl) {
      var imageLink = makeElement('a', 'card-image-link');
      imageLink.href = href;
      imageLink.setAttribute('aria-label', title);
      var imageWrap = makeElement('div', 'card-image');
      var image = document.createElement('img');
      image.src = imageUrl;
      image.alt = article.image_alt || (article.image && article.image.alt) || title;
      image.loading = 'lazy';
      image.width = 1080;
      image.height = 720;
      imageWrap.appendChild(image);
      imageLink.appendChild(imageWrap);
      card.appendChild(imageLink);
    }

    var body = makeElement('div', 'card-body');
    var meta = makeElement('div', 'card-meta');
    meta.appendChild(makeElement('span', 'card-category', 'TR Türkiye'));
    meta.appendChild(makeElement('span', 'card-topic', topics[topic].label));
    var date = makeElement('time', 'card-date', article.date || article.date_iso || '');
    if (article.date_iso) date.setAttribute('datetime', article.date_iso);
    meta.appendChild(date);
    body.appendChild(meta);

    var titleNode = makeElement('h3', 'card-title');
    var titleLink = document.createElement('a');
    titleLink.href = href;
    titleLink.textContent = title;
    titleNode.appendChild(titleLink);
    body.appendChild(titleNode);

    if (article.summary) {
      body.appendChild(makeElement('p', 'card-excerpt', article.summary));
    }

    var footer = makeElement('div', 'card-footer');
    var readMore = makeElement('a', 'read-more', 'Devamını Oku →');
    readMore.href = href;
    readMore.setAttribute('aria-label', title + ' haberini oku');
    footer.appendChild(readMore);
    body.appendChild(footer);

    card.appendChild(body);
    return card;
  }

  function buildHeadlineSlideFromArticle(article, topic, index) {
    var href = articleUrl(article);
    var title = (article.title || '').trim();
    if (!href || !title) return null;

    var slide = makeElement('a', 'headline-slide headline-card is-json-category-hero');
    if (index === 0) slide.classList.add('is-active');
    slide.href = href;
    slide.dataset.topic = topic;
    slide.dataset.dynamicCategory = 'true';
    slide.setAttribute('aria-label', title);

    var imageUrl = articleImageUrl(article);
    if (imageUrl) {
      var media = makeElement('div', 'headline-image');
      var image = document.createElement('img');
      image.src = imageUrl;
      image.alt = article.image_alt || (article.image && article.image.alt) || title;
      image.loading = index === 0 ? 'eager' : 'lazy';
      if (index === 0) image.setAttribute('fetchpriority', 'high');
      image.width = 1080;
      image.height = 720;
      media.appendChild(image);
      slide.appendChild(media);
    } else {
      var placeholder = makeElement('div', 'headline-placeholder');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.appendChild(makeElement('span', '', topics[topic].label));
      slide.appendChild(placeholder);
    }

    var content = makeElement('div', 'headline-content');
    var meta = makeElement('div', 'headline-meta');
    meta.appendChild(makeElement('span', 'headline-tag', 'Öne Çıkan'));
    meta.appendChild(makeElement('span', 'headline-topic', topics[topic].label));
    content.appendChild(meta);
    content.appendChild(makeElement('h3', 'headline-title', title));
    var date = makeElement('time', 'headline-date', articleDateText(article));
    if (article.date_iso) date.setAttribute('datetime', article.date_iso);
    content.appendChild(date);
    slide.appendChild(content);
    return slide;
  }

  function buildSideHeadlineFromArticle(article, topic) {
    var href = articleUrl(article);
    var title = (article.title || '').trim();
    if (!href || !title) return null;

    var card = makeElement('a', 'headline-card side-headline is-json-category-side');
    card.href = href;
    card.dataset.topic = topic;
    card.dataset.dynamicCategory = 'true';
    card.setAttribute('aria-label', title);

    var imageUrl = articleImageUrl(article);
    if (imageUrl) {
      var media = makeElement('div', 'headline-image');
      var image = document.createElement('img');
      image.src = imageUrl;
      image.alt = article.image_alt || (article.image && article.image.alt) || title;
      image.loading = 'lazy';
      image.width = 1080;
      image.height = 720;
      media.appendChild(image);
      card.appendChild(media);
    } else {
      var placeholder = makeElement('div', 'headline-placeholder');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.appendChild(makeElement('span', '', topics[topic].label));
      card.appendChild(placeholder);
    }

    var content = makeElement('div', 'headline-content');
    var meta = makeElement('div', 'headline-meta');
    meta.appendChild(makeElement('span', 'headline-tag', 'Öne Çıkan'));
    meta.appendChild(makeElement('span', 'headline-topic', topics[topic].label));
    content.appendChild(meta);
    content.appendChild(makeElement('h3', 'headline-title', title));
    var date = makeElement('time', 'headline-date', articleDateText(article));
    if (article.date_iso) date.setAttribute('datetime', article.date_iso);
    content.appendChild(date);
    card.appendChild(content);
    return card;
  }

  function initCategoryHeadlineSlider(slider) {
    if (!slider) return;
    var slides = Array.prototype.slice.call(slider.querySelectorAll('.is-json-category-hero'));
    var controls = slider.querySelector('.slider-controls');
    var nextBtn = slider.querySelector('[data-slider-next]');
    var prevBtn = slider.querySelector('[data-slider-prev]');
    var dotsWrap = slider.querySelector('.slider-dots');
    var current = 0;
    var autoPausedUntil = 0;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (categorySliderTimer) {
      window.clearInterval(categorySliderTimer);
      categorySliderTimer = null;
    }
    if (!slides.length) return;
    if (controls) controls.hidden = slides.length <= 1;
    if (!dotsWrap) {
      dotsWrap = makeElement('div', 'slider-dots');
      dotsWrap.setAttribute('aria-label', 'Manşet sırası');
      slider.appendChild(dotsWrap);
    }
    dotsWrap.hidden = slides.length <= 1;
    dotsWrap.replaceChildren();

    function pauseAuto(duration) {
      autoPausedUntil = Date.now() + (duration || 12000);
    }

    function updateDots() {
      Array.prototype.slice.call(dotsWrap.querySelectorAll('.slider-dot')).forEach(function (dot, index) {
        var active = index === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }

    function showSlide(nextIndex) {
      slides[current].classList.remove('is-active');
      current = (nextIndex + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      slider.classList.toggle('has-image-active', Boolean(slides[current].querySelector('.headline-image img')));
      updateDots();
    }

    slides.forEach(function (slide, index) {
      slide.classList.toggle('is-active', index === 0);
      var dot = makeElement('button', 'slider-dot', String(index + 1));
      dot.type = 'button';
      dot.textContent = String(index + 1);
      dot.innerText = String(index + 1);
      dot.setAttribute('aria-label', String(index + 1) + '. manşete geç');
      dot.addEventListener('click', function () {
        pauseAuto();
        showSlide(index);
      });
      dotsWrap.appendChild(dot);
    });

    slider.classList.toggle('has-image-active', Boolean(slides[0].querySelector('.headline-image img')));
    updateDots();

    if (nextBtn) nextBtn.onclick = function () {
      pauseAuto();
      showSlide(current + 1);
    };
    if (prevBtn) prevBtn.onclick = function () {
      pauseAuto();
      showSlide(current - 1);
    };

    var touchStartX = 0;
    var touchDeltaX = 0;
    slider.ontouchstart = function (event) {
      if (slides.length <= 1) return;
      pauseAuto();
      touchStartX = event.changedTouches[0].clientX;
      touchDeltaX = 0;
    };
    slider.ontouchmove = function (event) {
      if (slides.length <= 1) return;
      touchDeltaX = event.changedTouches[0].clientX - touchStartX;
    };
    slider.ontouchend = function () {
      if (slides.length <= 1 || Math.abs(touchDeltaX) < 45) return;
      pauseAuto();
      showSlide(touchDeltaX < 0 ? current + 1 : current - 1);
    };

    if (!reducedMotion && slides.length > 1) {
      categorySliderTimer = window.setInterval(function () {
        if (Date.now() < autoPausedUntil) return;
        showSlide(current + 1);
      }, 3000);
    }
  }

  function renderCategoryShowcase(articles, topic) {
    var slider = document.querySelector('.headline-slider');
    if (!slider || !articles.length) return;

    var controls = slider.querySelector('.slider-controls');
    var dots = slider.querySelector('.slider-dots');
    Array.prototype.slice.call(slider.querySelectorAll('.headline-slide')).forEach(function (slide) {
      slide.remove();
    });
    if (dots) dots.remove();

    articles.slice(0, 10).forEach(function (article, index) {
      var slide = buildHeadlineSlideFromArticle(article, topic, index);
      if (slide) slider.insertBefore(slide, controls || null);
    });
    initCategoryHeadlineSlider(slider);

    var side = document.querySelector('.side-headlines');
    if (side) {
      side.remove();
    }
  }

  var initialSonDakikaSlides = [];
  var initialSonDakikaCards = [];
  var initialSonDakikaHeading = '';
  var initialSonDakikaNote = '';
  var initialDocumentTitle = '';
  var initialCaptured = false;
  var currentActiveTopic = 'son-dakika';

  function captureInitialSonDakikaState() {
    if (initialCaptured) return;
    var slider = document.querySelector('.headline-slider');
    if (slider) {
      initialSonDakikaSlides = Array.prototype.slice.call(slider.querySelectorAll('.headline-slide')).map(function (s) {
        return s.cloneNode(true);
      });
    }
    var grid = document.getElementById('grid-turkey');
    if (grid) {
      initialSonDakikaCards = Array.prototype.slice.call(grid.children).map(function (c) {
        return c.cloneNode(true);
      });
    }
    var heading = document.getElementById('turkiye-title');
    if (heading) initialSonDakikaHeading = heading.textContent;
    var note = document.querySelector('.showcase-note');
    if (note) initialSonDakikaNote = note.textContent;
    initialDocumentTitle = document.title;
    initialCaptured = true;
  }

  function restoreSonDakika() {
    captureInitialSonDakikaState();
    currentActiveTopic = 'son-dakika';
    document.documentElement.dataset.activeTopic = 'son-dakika';
    document.querySelectorAll('.topic-link[data-topic]').forEach(function (l) {
      l.classList.toggle('is-active', l.dataset.topic === 'son-dakika');
    });

    var heading = document.getElementById('turkiye-title');
    if (heading && initialSonDakikaHeading) heading.textContent = initialSonDakikaHeading;
    var note = document.querySelector('.showcase-note');
    if (note && initialSonDakikaNote) note.textContent = initialSonDakikaNote;
    if (initialDocumentTitle) document.title = initialDocumentTitle;

    var slider = document.querySelector('.headline-slider');
    if (slider && initialSonDakikaSlides.length) {
      var controls = slider.querySelector('.slider-controls');
      var dots = slider.querySelector('.slider-dots');
      Array.prototype.slice.call(slider.querySelectorAll('.headline-slide')).forEach(function (slide) {
        slide.remove();
      });
      if (dots) dots.remove();
      initialSonDakikaSlides.forEach(function (slideClone) {
        slider.insertBefore(slideClone.cloneNode(true), controls || null);
      });
      if (typeof window.initHeadlineSlider === 'function') {
        window.initHeadlineSlider();
      } else {
        initCategoryHeadlineSlider(slider);
      }
      slider.dataset.categoryShowcase = 'son-dakika';
    }

    var grid = document.getElementById('grid-turkey');
    if (grid && initialSonDakikaCards.length) {
      grid.innerHTML = '';
      initialSonDakikaCards.forEach(function (cardClone) {
        grid.appendChild(cardClone.cloneNode(true));
      });
      grid.dataset.categoryHydrated = 'son-dakika';
      grid.dataset.categoryMode = 'static';
    }

    var sec = document.getElementById('turkiye');
    if (sec) sec.hidden = false;
    var akis = document.getElementById('turkiye-akis');
    if (akis) akis.hidden = false;

    if (typeof window.dedupeNewsCards === 'function') window.dedupeNewsCards();
    if (typeof window.applyTopicFilter === 'function') window.applyTopicFilter();
    if (typeof window.countCards === 'function') window.countCards();
    if (typeof window.initPagination === 'function') window.initPagination('grid-turkey');
    markCategoryPartReady('category-showcase-ready');
    markCategoryPartReady('category-feed-ready');
  }

  async function switchToCategory(topic, pushState) {
    if (!topic || topic === 'son-dakika') {
      if (pushState) {
        if (window.location.pathname !== '/' || window.location.search) {
          window.history.pushState({ topic: 'son-dakika' }, '', '/');
        }
      }
      restoreSonDakika();
      return;
    }

    captureInitialSonDakikaState();
    currentActiveTopic = topic;

    if (pushState) {
      var targetUrl = '/?kategori=' + encodeURIComponent(topic);
      if (window.location.search !== '?kategori=' + encodeURIComponent(topic)) {
        window.history.pushState({ topic: topic }, '', targetUrl);
      }
    }

    if (!categoryFeedCache[topic]) {
      document.documentElement.classList.remove('category-showcase-ready', 'category-page-ready');
    }

    document.documentElement.dataset.activeTopic = topic;
    document.querySelectorAll('.topic-link[data-topic]').forEach(function (l) {
      l.classList.toggle('is-active', l.dataset.topic === topic);
    });

    var conf = topics[topic];
    if (conf) {
      var heading = document.getElementById('turkiye-title');
      if (heading) heading.textContent = conf.heading;
      var note = document.querySelector('.showcase-note');
      if (note) note.textContent = conf.note;
      document.title = conf.title;
    }

    var sec = document.getElementById('turkiye');
    if (sec) sec.hidden = false;
    var akis = document.getElementById('turkiye-akis');
    if (akis) akis.hidden = false;

    var articles = await loadCategoryArticles(topic);
    if (currentActiveTopic !== topic) return;

    if (!articles || !articles.length) {
      var slider = document.querySelector('.headline-slider');
      if (slider) {
        var controls = slider.querySelector('.slider-controls');
        var dots = slider.querySelector('.slider-dots');
        Array.prototype.slice.call(slider.querySelectorAll('.headline-slide')).forEach(function (slide) {
          slide.remove();
        });
        if (dots) dots.remove();
        var emptyHero = buildEmptyHero(topic);
        slider.insertBefore(emptyHero, controls || null);
        initCategoryHeadlineSlider(slider);
        slider.dataset.categoryShowcase = topic;
      }
      var grid = document.getElementById('grid-turkey');
      if (grid) {
        grid.innerHTML = '<p class="news-search-status" style="padding:24px;text-align:center;grid-column:1/-1;">Bu kategoride henüz yayınlanmış haber bulunmuyor.</p>';
        grid.dataset.categoryHydrated = topic;
      }
      markCategoryPartReady('category-showcase-ready');
      markCategoryPartReady('category-feed-ready');
      return;
    }

    renderCategoryShowcase(articles, topic);
    var sliderNode = document.querySelector('.headline-slider');
    if (sliderNode) sliderNode.dataset.categoryShowcase = topic;

    var gridNode = document.getElementById('grid-turkey');
    if (gridNode) {
      var seen = new Set();
      var fragment = document.createDocumentFragment();
      articles.forEach(function (article) {
        var href = articleUrl(article);
        var key = articleKey(href);
        if (!key || seen.has(key)) return;
        var card = buildCategoryCard(article, topic);
        if (!card) return;
        seen.add(key);
        fragment.appendChild(card);
      });
      gridNode.innerHTML = '';
      gridNode.appendChild(fragment);
      gridNode.dataset.categoryHydrated = topic;
      gridNode.dataset.categoryMode = 'json';
    }

    if (typeof window.countCards === 'function') window.countCards();
    if (typeof window.initPagination === 'function') window.initPagination('grid-turkey');
    markCategoryPartReady('category-showcase-ready');
    markCategoryPartReady('category-feed-ready');
  }

  function bindCategoryLinkClicks() {
    document.querySelectorAll('.topic-link[data-topic]').forEach(function (link) {
      if (link.dataset.navBound) return;
      link.dataset.navBound = 'true';
      link.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (typeof event.button === 'number' && event.button !== 0) return;

        var targetTopic = link.dataset.topic;
        if (!targetTopic) return;
        if (!topics[targetTopic] && targetTopic !== 'son-dakika') return;

        event.preventDefault();
        if (targetTopic === currentActiveTopic) return;
        switchToCategory(targetTopic, true);
      });
    });
  }

  window.addEventListener('popstate', function () {
    var topic = selectedTopic();
    switchToCategory(topic, false);
  });

  function prefetchCategories() {
    var categoryKeys = ['gundem', 'ekonomi', 'spor', 'siyaset', 'dunya', 'magazin', 'teknoloji', 'saglik'];
    categoryKeys.forEach(function (key) {
      loadCategoryArticles(key);
    });
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
    if (!topic) return;

    if (heading) heading.textContent = topic.heading;
    if (note) note.textContent = topic.note;
    document.title = topic.title;
  }

  function refreshTopicDisplay() {
    normalizeCategoryLinks();
    bindCategoryLinkClicks();
    installAccurateCount();

    var initialTopic = selectedTopic();
    currentActiveTopic = initialTopic;

    if (initialTopic === 'son-dakika') {
      captureInitialSonDakikaState();
      markCategoryPartReady('category-showcase-ready');
      markCategoryPartReady('category-feed-ready');
      prefetchCategories();
    } else {
      applyCategoryHeading();
      switchToCategory(initialTopic, false).then(function () {
        prefetchCategories();
      });
    }
  }

  window.switchToCategory = switchToCategory;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshTopicDisplay, { once: true });
  } else {
    refreshTopicDisplay();
  }
})();
