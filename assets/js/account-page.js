(function () {
  'use strict';

  var CATEGORIES = [
    'gundem',
    'siyaset',
    'ekonomi',
    'dunya',
    'spor',
    'teknoloji',
    'saglik',
    'kultur-sanat'
  ];

  var I18N = {
    tr: {
      locale: 'tr-TR',
      homeUrl: '/',
      pageTitle: 'Hesap Yönetimi | Manşet Radar Üye Merkezi',
      portalTopLabel: 'Manşet Radar Kurumsal Üye Portalı',
      sessionOpen: 'Oturum Açık',
      brandSubtitle: 'Üye Merkezi',
      backHome: '← Ana Sayfaya Dön',
      logout: 'Oturumu Kapat',
      greetingPrefix: 'Sayın ',
      defaultMember: 'Üye',
      verifiedLabel: 'Doğrulanmış Aktif Hesap',
      statSavedLabel: 'Kayıtlı Haber',
      statTierValue: 'Standart',
      statTierLabel: 'Üyelik',
      statStatusValue: 'Aktif',
      statStatusLabel: 'Durum',
      navSavedText: 'Kaydedilen Haberler',
      navInterestsText: 'Takip Edilen Konular',
      navNotificationsText: 'Bülten ve Bildirim Ayarları',
      pageHeading: 'Hesap Yönetimi',
      pageSubtext: 'Kayıtlı haber arşivinizi, takip ettiğiniz konu başlıklarını ve bülten tercihlerinizi buradan yönetebilirsiniz.',
      pageBreadcrumb: 'Ana Sayfa / Hesabım',
      savedHeading: 'Kaydedilen Haberler',
      savedBadge: function (n) { return n + ' Kayıtlı İçerik'; },
      thTitle: 'Haber Başlığı',
      thSource: 'Kategori',
      thAction: 'İşlem',
      emptyTitle: 'Kayıtlı haber listeniz şu anda boş',
      emptyDesc: 'Sonra okumak veya referans olarak saklamak istediğiniz haberleri, ilgili haber detay sayfasındaki “Haberi Kaydet” butonunu kullanarak hesabınıza ekleyebilirsiniz.',
      emptyBtn: 'Manşetlere Göz Atın →',
      readBtn: 'Habere Git',
      removeBtn: 'Kaldır',
      removedMsg: 'Haber kayıtlarınızdan kaldırıldı.',
      removeErrMsg: 'Kayıt kaldırılamadı. Lütfen tekrar deneyin.',
      loadSavedErrMsg: 'Kaydedilen haberler şu anda yüklenemedi.',
      interestsHeading: 'Takip Edilen Haber Kategorileri',
      interestsBadge: function (n) { return n + ' Seçili'; },
      interestsSubtext: 'İlgi alanlarınıza göre önceliklendirilen haber kategorilerini seçin.',
      interestsSubmit: 'Tercihleri Güncelle',
      interestsSavedMsg: 'Takip edilen kategori tercihleriniz güncellendi.',
      interestsErrMsg: 'Kategori tercihleri kaydedilemedi. Lütfen tekrar deneyin.',
      notificationsHeading: 'E-posta ve Bildirim Ayarları',
      notificationsBadge: 'Üye İletişimi',
      notificationsSubtext: 'Günlük bülten gönderimleri ve son dakika uyarıları için iletişim tercihlerinizi yönetin.',
      prefMailTitle: 'Günlük E-posta Özeti',
      prefMailDesc: 'Günün öne çıkan manşetleri her sabah e-posta kutunuza gelsin.',
      prefPushTitle: 'Son Dakika Uyarıları',
      prefPushDesc: 'Kritik gelişmelerde anlık tarayıcı bilgilendirmesi alın.',
      prefsSubmit: 'Ayarları Kaydet',
      prefsSavedMsg: 'İletişim ve bildirim ayarlarınız kaydedildi.',
      prefsErrMsg: 'Ayarlar kaydedilemedi. Lütfen tekrar deneyin.',
      loadPrefsErrMsg: 'Kayıtlı tercihler şu anda yüklenemedi.',
      loadAccountErrMsg: 'Hesap bilgileri alınamadı.',
      defaultCategory: 'Haber',
      catLabels: {
        gundem: 'Gündem',
        siyaset: 'Siyaset',
        ekonomi: 'Ekonomi',
        dunya: 'Dünya',
        spor: 'Spor',
        teknoloji: 'Teknoloji',
        saglik: 'Sağlık',
        'kultur-sanat': 'Kültür & Sanat',
        'son-dakika': 'Son Dakika',
        magazin: 'Magazin'
      }
    },
    en: {
      locale: 'en-US',
      homeUrl: '/en/',
      pageTitle: 'Account Management | Manşet Radar Member Center',
      portalTopLabel: 'Manşet Radar Corporate Member Portal',
      sessionOpen: 'Session Active',
      brandSubtitle: 'Member Center',
      backHome: '← Back to Homepage',
      logout: 'Sign Out',
      greetingPrefix: '',
      defaultMember: 'Member',
      verifiedLabel: 'Verified Active Account',
      statSavedLabel: 'Saved Stories',
      statTierValue: 'Standard',
      statTierLabel: 'Tier',
      statStatusValue: 'Active',
      statStatusLabel: 'Status',
      navSavedText: 'Saved Stories',
      navInterestsText: 'Followed Topics',
      navNotificationsText: 'Newsletter & Alerts',
      pageHeading: 'Account Management',
      pageSubtext: 'Manage your saved articles archive, followed news topics, and communication preferences in one place.',
      pageBreadcrumb: 'Home / Account',
      savedHeading: 'Saved Stories',
      savedBadge: function (n) { return n + (n === 1 ? ' Saved Item' : ' Saved Items'); },
      thTitle: 'Article Headline',
      thSource: 'Category',
      thAction: 'Actions',
      emptyTitle: 'Your saved stories archive is currently empty',
      emptyDesc: 'Use the “Save Story” button on any article page to bookmark reports and analyses for later reading.',
      emptyBtn: 'Browse Headlines →',
      readBtn: 'Read',
      removeBtn: 'Remove',
      removedMsg: 'Article removed from your saved archive.',
      removeErrMsg: 'Could not remove article. Please try again.',
      loadSavedErrMsg: 'Saved stories could not be loaded right now.',
      interestsHeading: 'Followed News Categories',
      interestsBadge: function (n) { return n + ' Selected'; },
      interestsSubtext: 'Select the editorial desks and topics prioritized for your reading profile.',
      interestsSubmit: 'Update Preferences',
      interestsSavedMsg: 'Followed category preferences updated.',
      interestsErrMsg: 'Could not save category preferences. Please try again.',
      notificationsHeading: 'Email & Notification Settings',
      notificationsBadge: 'Member Comms',
      notificationsSubtext: 'Configure your daily briefing digest and breaking news alert preferences.',
      prefMailTitle: 'Daily Email Briefing',
      prefMailDesc: 'Receive a curated summary of top headlines every morning.',
      prefPushTitle: 'Breaking News Alerts',
      prefPushDesc: 'Get instant browser notifications for major developments.',
      prefsSubmit: 'Save Settings',
      prefsSavedMsg: 'Communication preferences saved.',
      prefsErrMsg: 'Could not save settings. Please try again.',
      loadPrefsErrMsg: 'Saved preferences could not be loaded right now.',
      loadAccountErrMsg: 'Account details could not be retrieved.',
      defaultCategory: 'News',
      catLabels: {
        gundem: 'Top News',
        siyaset: 'Politics',
        ekonomi: 'Economy',
        dunya: 'World',
        spor: 'Sports',
        teknoloji: 'Technology',
        saglik: 'Health',
        'kultur-sanat': 'Culture & Arts',
        'son-dakika': 'Breaking',
        magazin: 'Lifestyle'
      }
    },
    de: {
      locale: 'de-DE',
      homeUrl: '/de/',
      pageTitle: 'Kontoverwaltung | Manşet Radar Mitgliederportal',
      portalTopLabel: 'Manşet Radar Redaktions- & Mitgliederportal',
      sessionOpen: 'Sitzung Aktiv',
      brandSubtitle: 'Mitgliederbereich',
      backHome: '← Zur Startseite',
      logout: 'Abmelden',
      greetingPrefix: '',
      defaultMember: 'Mitglied',
      verifiedLabel: 'Verifiziertes Aktives Konto',
      statSavedLabel: 'Gespeichert',
      statTierValue: 'Standard',
      statTierLabel: 'Mitgliedschaft',
      statStatusValue: 'Aktiv',
      statStatusLabel: 'Status',
      navSavedText: 'Gespeicherte Artikel',
      navInterestsText: 'Abonnierte Themen',
      navNotificationsText: 'Newsletter & Hinweise',
      pageHeading: 'Kontoverwaltung',
      pageSubtext: 'Verwalten Sie hier Ihr Artikelarchiv, bevorzugte Themenbereiche und Ihre Benachrichtigungseinstellungen.',
      pageBreadcrumb: 'Startseite / Mein Konto',
      savedHeading: 'Gespeicherte Artikel',
      savedBadge: function (n) { return n + (n === 1 ? ' Gespeicherter Inhalt' : ' Gespeicherte Inhalte'); },
      thTitle: 'Artikeltitel',
      thSource: 'Kategorie',
      thAction: 'Aktion',
      emptyTitle: 'Ihr Artikelarchiv ist derzeit leer',
      emptyDesc: 'Nutzen Sie auf jeder Artikelseite die Schaltfläche „Artikel speichern“, um Beiträge für später abzulegen.',
      emptyBtn: 'Schlagzeilen entdecken →',
      readBtn: 'Lesen',
      removeBtn: 'Entfernen',
      removedMsg: 'Der Artikel wurde aus Ihrem Archiv entfernt.',
      removeErrMsg: 'Eintrag konnte nicht entfernt werden. Bitte erneut versuchen.',
      loadSavedErrMsg: 'Gespeicherte Artikel konnten derzeit nicht geladen werden.',
      interestsHeading: 'Abonnierte Nachrichtenressorts',
      interestsBadge: function (n) { return n + ' Ausgewählt'; },
      interestsSubtext: 'Wählen Sie die Nachrichtenbereiche aus, die für Ihr Leseprofil priorisiert werden sollen.',
      interestsSubmit: 'Auswahl aktualisieren',
      interestsSavedMsg: 'Ihre Themenauswahl wurde aktualisiert.',
      interestsErrMsg: 'Themenauswahl konnte nicht gespeichert werden.',
      notificationsHeading: 'E-Mail- & Benachrichtigungseinstellungen',
      notificationsBadge: 'Kommunikation',
      notificationsSubtext: 'Steuern Sie Ihre Einstellungen für tägliche Briefings und Eilmeldungen.',
      prefMailTitle: 'Tägliche E-Mail-Übersicht',
      prefMailDesc: 'Erhalten Sie jeden Morgen eine Zusammenfassung der wichtigsten Schlagzeilen.',
      prefPushTitle: 'Eilmeldungs-Hinweise',
      prefPushDesc: 'Erhalten Sie bei wichtigen Entwicklungen direkte Browser-Hinweise.',
      prefsSubmit: 'Einstellungen speichern',
      prefsSavedMsg: 'Ihre Benachrichtigungseinstellungen wurden gespeichert.',
      prefsErrMsg: 'Einstellungen konnten nicht gespeichert werden.',
      loadPrefsErrMsg: 'Gespeicherte Einstellungen konnten derzeit nicht geladen werden.',
      loadAccountErrMsg: 'Kontodaten konnten nicht geladen werden.',
      defaultCategory: 'Nachrichten',
      catLabels: {
        gundem: 'Aktuell',
        siyaset: 'Politik',
        ekonomi: 'Wirtschaft',
        dunya: 'Welt',
        spor: 'Sport',
        teknoloji: 'Technologie',
        saglik: 'Gesundheit',
        'kultur-sanat': 'Kultur & Kunst',
        'son-dakika': 'Eilmeldung',
        magazin: 'Gesellschaft'
      }
    }
  };

  function node(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var target = node(id);
    if (target) target.textContent = value || '';
  }

  function detectLang() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var raw = String(params.get('lang') || '').trim().toLowerCase();
      if (raw === 'en' || raw === 'de' || raw === 'tr') return raw;
    } catch (_) {}
    return 'tr';
  }

  function toTitleCase(raw, locale) {
    return String(raw || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toLocaleUpperCase(locale) + part.slice(1).toLocaleLowerCase(locale);
      })
      .join(' ');
  }

  function rawMemberName(user, fallback) {
    var metadata = user && user.user_metadata ? user.user_metadata : {};
    var name = String(metadata.display_name || metadata.full_name || metadata.name || '').trim();
    if (name) return name;
    var email = String(user && user.email || '');
    return email ? email.split('@')[0].replace(/[._-]+/g, ' ') : fallback;
  }

  function computeInitials(formattedName) {
    var parts = String(formattedName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return 'MR';
  }

  function statusText(target, text, type) {
    if (!target) return;
    target.textContent = text || '';
    target.className = 'member-message' + (type ? ' ' + type : '');
  }

  function formatPortalDate(locale) {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch (_) {
      return '';
    }
  }

  function applyTranslations(lang, t) {
    document.documentElement.lang = lang;
    document.title = t.pageTitle;
    setText('portal-date', formatPortalDate(t.locale));
    setText('portal-top-label', t.portalTopLabel);
    setText('session-status', t.sessionOpen);
    setText('brand-subtitle', t.brandSubtitle);
    setText('back-home-btn', t.backHome);
    setText('logout', t.logout);
    setText('sidebar-logout', t.logout);
    setText('verified-label', t.verifiedLabel);
    setText('stat-saved-label', t.statSavedLabel);
    setText('stat-tier-value', t.statTierValue);
    setText('stat-tier-label', t.statTierLabel);
    setText('stat-status-value', t.statStatusValue);
    setText('stat-status-label', t.statStatusLabel);
    setText('nav-saved-text', t.navSavedText);
    setText('nav-interests-text', t.navInterestsText);
    setText('nav-notifications-text', t.navNotificationsText);
    setText('page-heading', t.pageHeading);
    setText('page-subtext', t.pageSubtext);
    setText('page-breadcrumb', t.pageBreadcrumb);
    setText('saved-heading', t.savedHeading);
    setText('saved-badge', t.savedBadge(0));
    setText('th-title', t.thTitle);
    setText('th-source', t.thSource);
    setText('th-action', t.thAction);
    setText('interests-heading', t.interestsHeading);
    setText('interests-badge', t.interestsBadge(0));
    setText('interests-subtext', t.interestsSubtext);
    setText('interests-submit', t.interestsSubmit);
    setText('notifications-heading', t.notificationsHeading);
    setText('notifications-badge', t.notificationsBadge);
    setText('notifications-subtext', t.notificationsSubtext);
    setText('pref-mail-title', t.prefMailTitle);
    setText('pref-mail-desc', t.prefMailDesc);
    setText('pref-push-title', t.prefPushTitle);
    setText('pref-push-desc', t.prefPushDesc);
    setText('prefs-submit', t.prefsSubmit);

    var brandLink = node('brand-home-link');
    if (brandLink) brandLink.href = t.homeUrl;
    var backBtn = node('back-home-btn');
    if (backBtn) backBtn.href = t.homeUrl;

    var pills = document.querySelectorAll('.lang-pill[data-lang]');
    pills.forEach(function (pill) {
      pill.classList.toggle('active', pill.getAttribute('data-lang') === lang);
    });
  }

  function inferCategoryLabel(item, t) {
    var haystack = (String(item && item.article_url || '') + ' ' + String(item && item.article_slug || '')).toLowerCase();
    var rules = [
      { key: 'ekonomi', re: /ekonomi|economy|wirtschaft|finance|borsa|piyasa/ },
      { key: 'siyaset', re: /siyaset|politics|politik/ },
      { key: 'dunya', re: /dunya|world|welt/ },
      { key: 'spor', re: /spor|sport/ },
      { key: 'teknoloji', re: /teknoloji|tech|technologie|bilim/ },
      { key: 'saglik', re: /saglik|health|gesundheit|nobetci|eczane/ },
      { key: 'kultur-sanat', re: /kultur|culture|sanat|yasam/ },
      { key: 'son-dakika', re: /son-dakika|breaking|eilmeldung/ },
      { key: 'gundem', re: /gundem|news|nachrichten|usa|germany|turkiye/ }
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].re.test(haystack) && t.catLabels[rules[i].key]) {
        return t.catLabels[rules[i].key];
      }
    }
    return t.defaultCategory;
  }

  function renderCategoryGrid(t, prefs, onSelectionChange) {
    var grid = node('interests-grid');
    if (!grid) return;
    grid.textContent = '';

    CATEGORIES.forEach(function (slug) {
      var label = document.createElement('label');
      label.className = 'cat-item';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'interest';
      input.value = slug;
      input.className = 'sr-only-check';

      var box = document.createElement('span');
      box.className = 'checkbox-box';
      box.setAttribute('aria-hidden', 'true');
      box.textContent = '✓';

      var textSpan = document.createElement('span');
      textSpan.textContent = t.catLabels[slug] || slug;

      if (prefs.categories.indexOf(slug) !== -1) {
        input.checked = true;
        label.classList.add('checked');
      }

      input.addEventListener('change', function () {
        label.classList.toggle('checked', input.checked);
        if (typeof onSelectionChange === 'function') onSelectionChange();
      });

      label.appendChild(input);
      label.appendChild(box);
      label.appendChild(textSpan);
      grid.appendChild(label);
    });

    if (typeof onSelectionChange === 'function') onSelectionChange();
  }

  function setupSidebarNav() {
    var navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
    navItems.forEach(function (item) {
      item.addEventListener('click', function () {
        navItems.forEach(function (el) { el.classList.remove('active'); });
        item.classList.add('active');
      });
    });

    if (window.location.hash) {
      var sectionId = window.location.hash.replace(/^#/, '');
      navItems.forEach(function (item) {
        item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var lang = detectLang();
    var t = I18N[lang] || I18N.tr;
    applyTranslations(lang, t);
    setupSidebarNav();

    var prefs = { email_daily_digest: false, breaking_news_push: false, categories: [] };

    function updateSelectedInterestsCount() {
      var grid = node('interests-grid');
      var checkedCount = grid ? grid.querySelectorAll('input[name="interest"]:checked').length : 0;
      setText('interests-badge', t.interestsBadge(checkedCount));
      setText('nav-interests-count', String(checkedCount));
    }

    renderCategoryGrid(t, prefs, updateSelectedInterestsCount);

    try {
      var active = await HaberMember.requireMember();
      if (!active) return;

      var currentUser = await HaberMember.user();
      var formattedName = toTitleCase(rawMemberName(currentUser, t.defaultMember), t.locale) || t.defaultMember;
      setText('member-greeting', t.greetingPrefix + formattedName);
      setText('member-email', currentUser && currentUser.email ? currentUser.email : '');
      setText('member-avatar', computeInitials(formattedName));

      var handleLogout = async function () {
        await HaberMember.logout();
        window.location.href = t.homeUrl;
      };
      var topLogout = node('logout');
      if (topLogout) topLogout.addEventListener('click', handleLogout);
      var sideLogout = node('sidebar-logout');
      if (sideLogout) sideLogout.addEventListener('click', handleLogout);

      var savedList = node('saved-list');
      var savedCount = 0;

      function updateSavedCounters() {
        setText('saved-count', String(savedCount));
        setText('nav-saved-count', String(savedCount));
        setText('saved-badge', t.savedBadge(savedCount));
      }

      function buildEmptySavedState() {
        var box = document.createElement('div');
        box.className = 'empty-table-body';

        var title = document.createElement('div');
        title.className = 'empty-title';
        title.textContent = t.emptyTitle;

        var desc = document.createElement('p');
        desc.className = 'empty-desc';
        desc.textContent = t.emptyDesc;

        var cta = document.createElement('a');
        cta.className = 'btn-primary';
        cta.href = t.homeUrl;
        cta.textContent = t.emptyBtn;

        box.appendChild(title);
        box.appendChild(desc);
        box.appendChild(cta);
        return box;
      }

      function renderSavedItem(item, tableBody) {
        var row = document.createElement('div');
        row.className = 'member-saved-row';

        var link = document.createElement('a');
        link.href = item.article_url || '#';
        link.textContent = item.article_title || item.article_url || t.defaultCategory;
        link.className = 'member-saved-title';

        var cat = document.createElement('span');
        cat.className = 'member-saved-category';
        cat.textContent = inferCategoryLabel(item, t);

        var actions = document.createElement('div');
        actions.className = 'member-saved-actions';

        var open = document.createElement('a');
        open.href = item.article_url || '#';
        open.textContent = t.readBtn;
        open.className = 'member-inline-btn';

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'member-inline-btn danger';
        remove.textContent = t.removeBtn;
        remove.addEventListener('click', async function () {
          remove.disabled = true;
          try {
            var response = await HaberMember.removeArticle(item.article_url);
            if (response && response.error) throw response.error;
            row.remove();
            savedCount = Math.max(0, savedCount - 1);
            updateSavedCounters();
            if (tableBody && !tableBody.querySelector('.member-saved-row')) {
              savedList.textContent = '';
              savedList.appendChild(buildEmptySavedState());
            }
            statusText(node('saved-message'), t.removedMsg, 'success');
          } catch (_) {
            remove.disabled = false;
            statusText(node('saved-message'), t.removeErrMsg, 'error');
          }
        });

        actions.appendChild(open);
        actions.appendChild(remove);
        row.appendChild(link);
        row.appendChild(cat);
        row.appendChild(actions);
        return row;
      }

      if (savedList) {
        var result = await HaberMember.savedArticles();
        savedList.textContent = '';
        if (result && result.error) {
          savedList.appendChild(buildEmptySavedState());
          statusText(node('saved-message'), t.loadSavedErrMsg, 'error');
        } else if (!result || !result.data || !result.data.length) {
          savedCount = 0;
          savedList.appendChild(buildEmptySavedState());
        } else {
          savedCount = result.data.length;
          var tableBody = document.createElement('div');
          tableBody.className = 'saved-table-body';
          result.data.forEach(function (item) {
            tableBody.appendChild(renderSavedItem(item, tableBody));
          });
          savedList.appendChild(tableBody);
        }
        updateSavedCounters();
      }

      var stored = await HaberMember.loadPrefs();
      if (stored && !stored.error && stored.data) {
        prefs.email_daily_digest = !!stored.data.email_daily_digest;
        prefs.breaking_news_push = !!stored.data.breaking_news_push;
        prefs.categories = Array.isArray(stored.data.categories) ? stored.data.categories.slice() : [];
      }

      renderCategoryGrid(t, prefs, updateSelectedInterestsCount);

      var mailCheck = node('pref-mail');
      var pushCheck = node('pref-push');
      if (mailCheck) mailCheck.checked = prefs.email_daily_digest;
      if (pushCheck) pushCheck.checked = prefs.breaking_news_push;

      if (stored && stored.error) {
        statusText(node('prefs-message'), t.loadPrefsErrMsg, 'error');
      }

      var interestsForm = node('interests-form');
      if (interestsForm) {
        interestsForm.addEventListener('submit', async function (event) {
          event.preventDefault();
          var submitBtn = node('interests-submit');
          if (submitBtn) submitBtn.disabled = true;
          try {
            var selected = Array.prototype.slice.call(
              interestsForm.querySelectorAll('input[name="interest"]:checked')
            ).map(function (input) { return input.value; });
            var customExisting = prefs.categories.filter(function (slug) {
              return CATEGORIES.indexOf(slug) === -1;
            });
            prefs.categories = selected.concat(customExisting);
            var response = await HaberMember.savePrefs(prefs);
            if (response && response.error) {
              statusText(node('interests-message'), t.interestsErrMsg, 'error');
            } else {
              statusText(node('interests-message'), t.interestsSavedMsg, 'success');
            }
          } catch (_) {
            statusText(node('interests-message'), t.interestsErrMsg, 'error');
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      var prefsForm = node('prefs-form');
      if (prefsForm) {
        prefsForm.addEventListener('submit', async function (event) {
          event.preventDefault();
          var submitBtn = node('prefs-submit');
          if (submitBtn) submitBtn.disabled = true;
          try {
            prefs.email_daily_digest = !!(mailCheck && mailCheck.checked);
            prefs.breaking_news_push = !!(pushCheck && pushCheck.checked);
            var response = await HaberMember.savePrefs(prefs);
            if (response && response.error) {
              statusText(node('prefs-message'), t.prefsErrMsg, 'error');
            } else {
              statusText(node('prefs-message'), t.prefsSavedMsg, 'success');
            }
          } catch (_) {
            statusText(node('prefs-message'), t.prefsErrMsg, 'error');
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      if (window.location.hash) {
        window.setTimeout(function () {
          try {
            var target = document.querySelector(window.location.hash);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (_) {}
        }, 50);
      }
    } catch (error) {
      statusText(node('member-error'), (error && error.message) || t.loadAccountErrMsg, 'error');
    }
  });
})();
