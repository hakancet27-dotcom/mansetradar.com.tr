(function () {
  'use strict';

  var desktopMarket = document.querySelector('header .desktop-market-strip, header .market-strip:not(.mobile-market-strip)');
  var mobileMarket = document.querySelector('.mobile-market-strip');
  var keys = ['usd', 'eur', 'gbp', 'btc'];
  var detailKeys = ['usd', 'eur', 'gbp'];
  var turkeyWeatherCities = null;

  function rateDetailHref(root, key) {
    var item = root.querySelector('[data-market-item="' + key + '"], #market-' + key + '-item');
    var value = item && item.querySelector('.market-value');
    var change = item && item.querySelector('.market-change');
    return '/weather.html?rate=' + key.toUpperCase()
      + '&value=' + encodeURIComponent(value ? value.textContent.trim() : '')
      + '&change=' + encodeURIComponent(change ? change.textContent.trim() : '');
  }

  function makeRatesClickable(root) {
    if (!root) return;
    detailKeys.forEach(function (key) {
      var item = root.querySelector('[data-market-item="' + key + '"], #market-' + key + '-item');
      if (!item || item.dataset.detailReady) return;
      item.dataset.detailReady = 'true';
      item.setAttribute('role', 'link');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', key.toUpperCase() + ' kur detayını aç');
      item.addEventListener('click', function () { location.href = rateDetailHref(root, key); });
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          location.href = rateDetailHref(root, key);
        }
      });
    });
  }

  function hideMobileStatus() {
    if (!mobileMarket) return;
    var status = mobileMarket.querySelector('[data-market-status], .market-status');
    if (!status) return;
    status.hidden = true;
    status.style.display = 'none';
    status.setAttribute('aria-hidden', 'true');
  }

  function weatherCodeToText(code) {
    var map = {
      0: 'Açık', 1: 'Az bulutlu', 2: 'Parçalı bulutlu', 3: 'Bulutlu',
      45: 'Sisli', 48: 'Sisli', 51: 'Çisenti', 53: 'Hafif yağmur', 55: 'Yağmur',
      61: 'Yağmur', 63: 'Sağanak', 65: 'Kuvvetli yağmur', 71: 'Kar', 73: 'Kar',
      75: 'Kuvvetli kar', 80: 'Sağanak', 81: 'Yağışlı', 82: 'Kuvvetli sağanak', 95: 'Fırtına'
    };
    return map[code] || 'Durum yok';
  }

  function selectedWeatherCity(cities) {
    var stored = '';
    try { stored = localStorage.getItem('manset-weather-city') || ''; } catch (error) { stored = ''; }
    return cities.find(function (city) { return city.name === stored; }) || cities.find(function (city) { return city.name === 'İstanbul'; }) || cities[0];
  }

  function renderProvinceWeather(city, list) {
    if (!city || !list) return;
    list.dataset.provinceMode = 'true';
    list.dataset.renderingProvince = 'true';
    list.innerHTML = '<li><span class="weather-city">' + city.name + '</span><span class="weather-temp">--</span><span class="weather-meta">Yükleniyor</span></li>';
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon + '&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FIstanbul', { cache: 'default' })
      .then(function (response) { if (!response.ok) throw new Error('weather'); return response.json(); })
      .then(function (payload) {
        var current = payload && payload.current ? payload.current : {};
        var temp = typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m) + '°' : '--';
        var wind = typeof current.wind_speed_10m === 'number' ? Math.round(current.wind_speed_10m) + ' km/s' : '--';
        var label = weatherCodeToText(current.weather_code);
        list.innerHTML = '<li><span class="weather-city">' + city.name + '</span><span class="weather-temp">' + temp + '</span><span class="weather-meta">' + label + ' · Rüzgar ' + wind + '</span></li>';
      })
      .catch(function () {
        list.innerHTML = '<li><span class="weather-city">' + city.name + '</span><span class="weather-temp">--</span><span class="weather-meta">Veri yok</span></li>';
      })
      .finally(function () {
        window.setTimeout(function () { list.dataset.renderingProvince = 'false'; }, 120);
      });
  }

  function initWeatherProvinceSelector() {
    var list = document.getElementById('weather-list');
    if (!list || list.dataset.provinceSelectorReady === 'true') return;
    var widget = list.closest('.sidebar-widget');
    if (!widget) return;

    fetch('/data/turkey-weather-cities.json', { cache: 'default' })
      .then(function (response) { if (!response.ok) throw new Error('cities'); return response.json(); })
      .then(function (cities) {
        if (!Array.isArray(cities) || !cities.length) return;
        turkeyWeatherCities = cities;
        list.dataset.provinceSelectorReady = 'true';
        injectSidebarWidgetStyles();

        var wrap = document.createElement('div');
        wrap.className = 'weather-province-tools';
        wrap.innerHTML = '<label class="weather-province-label" for="weather-province-select">İl seç</label><select id="weather-province-select" class="compact-live-select" aria-label="Hava durumu ili seç"></select>';
        var select = wrap.querySelector('select');
        select.innerHTML = cities.map(function (city) {
          return '<option value="' + city.name + '">' + city.name + '</option>';
        }).join('');
        var selected = selectedWeatherCity(cities);
        select.value = selected.name;
        widget.insertBefore(wrap, list);

        select.addEventListener('change', function () {
          var city = cities.find(function (item) { return item.name === select.value; }) || selectedWeatherCity(cities);
          try { localStorage.setItem('manset-weather-city', city.name); } catch (error) {}
          renderProvinceWeather(city, list);
        });

        var observer = new MutationObserver(function () {
          if (list.dataset.renderingProvince === 'true') return;
          if (list.dataset.provinceMode !== 'true') return;
          var city = cities.find(function (item) { return item.name === select.value; }) || selectedWeatherCity(cities);
          window.setTimeout(function () { renderProvinceWeather(city, list); }, 80);
        });
        observer.observe(list, { childList: true, subtree: true });
        renderProvinceWeather(selected, list);
      })
      .catch(function () {});
  }

  function fixWeatherLinks() {
    var list = document.getElementById('weather-list');
    if (!list) return;
    list.addEventListener('click', function (event) {
      var item = event.target.closest('li');
      if (!item) return;
      var city = item.querySelector('.weather-city');
      if (!city) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = '/weather.html?city=' + encodeURIComponent(city.textContent.trim());
    }, true);
  }

  function injectSidebarWidgetStyles() {
    if (document.getElementById('sidebar-live-widgets-style')) return;
    var style = document.createElement('style');
    style.id = 'sidebar-live-widgets-style';
    style.textContent = [
      '.compact-live-list{list-style:none;display:grid;gap:9px}',
      '.compact-live-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border:1px solid var(--border);border-radius:8px;background:#fbfcfe;padding:9px 11px}',
      '.compact-live-name{font-size:.82rem;font-weight:900;color:var(--text)}',
      '.compact-live-value{font-size:.86rem;font-weight:900;color:var(--dark);text-align:right}',
      '.compact-live-meta{grid-column:1/-1;font-size:.72rem;font-weight:700;color:var(--muted);line-height:1.35}',
      '.compact-live-note{font-size:.78rem;font-weight:700;color:var(--muted);line-height:1.45}',
      '.compact-live-link{display:inline-block;margin-top:10px;color:var(--red);font-size:.78rem;font-weight:900;text-decoration:none}',
      '.compact-live-link:hover{text-decoration:underline}',
      '.compact-live-select{width:100%;border:1px solid var(--border);border-radius:8px;background:#fbfcfe;color:var(--text);font-size:.82rem;font-weight:800;padding:9px 10px;outline:none}',
      '.compact-live-select:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(215,25,32,.09)}',
      '.weather-province-tools{display:grid;gap:6px;margin-bottom:10px}',
      '.weather-province-label{font-size:.7rem;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.5px}',
      '.compact-standings{width:100%;border-collapse:collapse;font-size:.76rem}',
      '.compact-standings th{color:var(--muted);font-size:.68rem;text-transform:uppercase;text-align:left;border-bottom:1px solid var(--border);padding:0 0 7px}',
      '.compact-standings td{border-bottom:1px solid var(--border);padding:7px 0;color:var(--text);font-weight:800}',
      '.compact-standings td:last-child,.compact-standings th:last-child{text-align:right}',
      '.compact-standings tr:last-child td{border-bottom:0}'
    ].join('');
    document.head.appendChild(style);
  }

  function createSidebarWidget(title, innerHtml) {
    var widget = document.createElement('aside');
    widget.className = 'sidebar-widget sidebar-live-widget';
    widget.innerHTML = '<h3 class="widget-title">' + title + '</h3>' + innerHtml;
    return widget;
  }

  function findWeatherWidget() {
    var weatherList = document.getElementById('weather-list');
    return weatherList ? weatherList.closest('.sidebar-widget') : null;
  }

  function insertAfterWeather(widget) {
    var weatherWidget = findWeatherWidget();
    if (!weatherWidget || !weatherWidget.parentNode) return false;
    weatherWidget.parentNode.insertBefore(widget, weatherWidget.nextSibling);
    return true;
  }

  function loadPrayerWidget(root) {
    var list = root.querySelector('[data-prayer-list]');
    if (!list) return;
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Istanbul&country=Turkey&method=13', { cache: 'default' })
      .then(function (response) { if (!response.ok) throw new Error('prayer'); return response.json(); })
      .then(function (payload) {
        var timings = payload && payload.data && payload.data.timings ? payload.data.timings : {};
        var rows = [
          ['İmsak', timings.Imsak],
          ['Güneş', timings.Sunrise],
          ['Öğle', timings.Dhuhr],
          ['İkindi', timings.Asr],
          ['Akşam', timings.Maghrib],
          ['Yatsı', timings.Isha]
        ];
        list.innerHTML = rows.map(function (row) {
          var time = String(row[1] || '--').split(' ')[0];
          return '<li class="compact-live-row"><span class="compact-live-name">' + row[0] + '</span><span class="compact-live-value">' + time + '</span></li>';
        }).join('') + '<li class="compact-live-meta">İstanbul · Diyanet yöntemi</li>';
      })
      .catch(function () {
        list.innerHTML = '<li class="compact-live-note">Namaz vakitleri şu an alınamadı.</li>';
      });
  }

  function loadHoroscopeWidget(root) {
    var target = root.querySelector('[data-horoscope-box]');
    if (!target) return;
    fetch('/data/horoscope.json', { cache: 'default' })
      .then(function (response) { if (!response.ok) throw new Error('horoscope'); return response.json(); })
      .then(function (payload) {
        var item = Array.isArray(payload) ? payload[0] : (payload && payload.items ? payload.items[0] : payload);
        if (!item) throw new Error('empty');
        var title = item.title || item.sign || 'Günün Burcu';
        var text = item.description || item.comment || item.text || 'Günlük yorum hazırlanıyor.';
        target.innerHTML = '<div class="compact-live-row"><span class="compact-live-name">' + title + '</span><span class="compact-live-value">Bugün</span><span class="compact-live-meta">' + text + '</span></div><a class="compact-live-link" href="/weather.html?service=horoscope">Tüm burçları gör</a>';
      })
      .catch(function () {
        target.innerHTML = '<p class="compact-live-note">Günlük burç yorumları hazırlanıyor.</p>';
      });
  }

  function loadStandingsWidget(root) {
    var target = root.querySelector('[data-standings-box]');
    if (!target) return;
    fetch('/data/standings.json', { cache: 'default' })
      .then(function (response) { if (!response.ok) throw new Error('standings'); return response.json(); })
      .then(function (payload) {
        var rows = Array.isArray(payload) ? payload : (payload && payload.table ? payload.table : []);
        rows = rows.slice(0, 5);
        if (!rows.length) throw new Error('empty');
        target.innerHTML = '<table class="compact-standings"><thead><tr><th>#</th><th>Takım</th><th>P</th></tr></thead><tbody>' + rows.map(function (row, index) {
          return '<tr><td>' + (row.position || index + 1) + '</td><td>' + (row.team || row.name || 'Takım') + '</td><td>' + (row.points || row.pts || 0) + '</td></tr>';
        }).join('') + '</tbody></table><a class="compact-live-link" href="/weather.html?service=standings">Puan durumunu aç</a>';
      })
      .catch(function () {
        target.innerHTML = '<p class="compact-live-note">Puan durumu için güvenli veri dosyası hazırlanıyor. API anahtarı tarayıcıya yazılmayacak.</p>';
      });
  }

  function initSidebarLiveWidgets() {
    if (document.body.dataset.sidebarLiveWidgetsReady === 'true') return;
    var weatherWidget = findWeatherWidget();
    if (!weatherWidget) return;
    document.body.dataset.sidebarLiveWidgetsReady = 'true';
    injectSidebarWidgetStyles();

    var horoscope = createSidebarWidget('Burç Yorumları', '<div data-horoscope-box><p class="compact-live-note">Günlük yorumlar yükleniyor.</p></div>');
    var prayer = createSidebarWidget('Namaz Vakitleri', '<ul class="compact-live-list" data-prayer-list><li class="compact-live-note">Vakitler yükleniyor.</li></ul>');
    var standings = createSidebarWidget('Puan Durumu', '<div data-standings-box><p class="compact-live-note">Puan durumu yükleniyor.</p></div>');

    if (insertAfterWeather(standings)) {
      weatherWidget.parentNode.insertBefore(prayer, standings);
      weatherWidget.parentNode.insertBefore(horoscope, prayer);
      loadHoroscopeWidget(horoscope);
      loadPrayerWidget(prayer);
      loadStandingsWidget(standings);
    }
  }

  if (!desktopMarket) {
    fixWeatherLinks();
    initSidebarLiveWidgets();
    if (typeof window.startWeatherLive === 'function') window.startWeatherLive();
    window.setTimeout(initWeatherProvinceSelector, 250);
    return;
  }

  makeRatesClickable(desktopMarket);

  if (!mobileMarket) {
    var media = window.matchMedia('(max-width: 640px)');
    var hero = document.querySelector('.headline-slider');
    var marker = document.createComment('market-desktop-position');
    desktopMarket.parentNode.insertBefore(marker, desktopMarket);

    function placeMarket() {
      if (media.matches && hero) {
        desktopMarket.classList.add('mobile-market-strip');
        hero.insertAdjacentElement('afterend', desktopMarket);
        document.body.classList.add('mobile-home-ux-ready');
      } else {
        desktopMarket.classList.remove('mobile-market-strip');
        if (marker.parentNode) marker.parentNode.insertBefore(desktopMarket, marker.nextSibling);
        document.body.classList.remove('mobile-home-ux-ready');
      }
    }
    placeMarket();
    if (media.addEventListener) media.addEventListener('change', placeMarket);
  } else {
    document.body.classList.add('mobile-home-static-ready');
    hideMobileStatus();
    function syncValues() {
      keys.forEach(function (key) {
        var sourceItem = document.getElementById('market-' + key + '-item');
        var sourceValue = document.getElementById('market-' + key);
        var sourceChange = document.getElementById('market-' + key + '-change');
        var targetItem = mobileMarket.querySelector('[data-market-item="' + key + '"]');
        var targetValue = mobileMarket.querySelector('[data-market-value="' + key + '"]');
        var targetChange = mobileMarket.querySelector('[data-market-change="' + key + '"]');
        if (sourceItem && targetItem) targetItem.className = sourceItem.className.replace(/\bdesktop-market-item\b/g, '').trim();
        if (sourceValue && targetValue) targetValue.textContent = sourceValue.textContent;
        if (sourceChange && targetChange) targetChange.textContent = sourceChange.textContent;
      });
      hideMobileStatus();
      makeRatesClickable(mobileMarket);
    }
    syncValues();
    if ('MutationObserver' in window) {
      new MutationObserver(syncValues).observe(desktopMarket, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  fixWeatherLinks();
  initSidebarLiveWidgets();
  if (typeof window.startMarketsLive === 'function') window.startMarketsLive();
  if (typeof window.startWeatherLive === 'function') window.startWeatherLive();
  window.setTimeout(initWeatherProvinceSelector, 250);
})();