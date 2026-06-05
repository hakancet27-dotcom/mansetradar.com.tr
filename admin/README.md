# Sveltia CMS Kurulumu

Bu yapida iki ayri panel vardir:

- `/admin/public/`: yayindaki haberler icin bakim paneli
- `/admin/newsroom/`: asil haber uretim, inceleme ve yayin paneli

Public panel, artik bilerek daha dar tutulur. Gorevi yayindaki haberlerde:

- baslik / kategori / spot / ozet duzeltmek
- haber govdesi HTML'ini duzeltmek
- gorsel ve alt metin bakimi yapmak
- meta alanlari ve etiketleri guncellemek

Yeni haber, AI haber, inceleme kuyrugu ve yayin onayi newsroom panelinden yonetilir.

- Panel adresi: `https://mansetradar.com.tr/admin/`
- Public haber bakim paneli: `https://mansetradar.com.tr/admin/public/`
- Newsroom paneli: `https://mansetradar.com.tr/admin/newsroom/`
- Backend: `hakancet27-dotcom/mansetradar.com.tr`
- Koleksiyonlar:
  - `1 - Yayindaki Haberler / Turkce`: `articles/*.json`
  - `2 - Published News / English`: `news/articles/*.json`
  - `3 - Veroeffentlichte Nachrichten / Deutsch`: `nachrichten/artikel/*.json`

Notlar:

- Haber uretim otomasyonu `haber-botu` reposunda kalir.
- Public panel generated `data/details/**` cache dosyalarini degil, duzenlenebilir kaynak `articles/**`, `news/articles/**` ve `nachrichten/artikel/**` JSON dosyalarini kullanir.
- `newsroom/review/pending` kuyrugu public site reposunda tutulmaz; `haber-botu` reposundaki `/admin/newsroom/` panelinden yonetilir.
- Newsroom paneli artik sistem raporlarini da gosterir. Oradan:
  - `CMS Kaynak Saglik Raporu`
  - `Kategori / Topic Uyusmazliklari`
  takip edilebilir.
- Yayindaki haber koleksiyonlari hicbir otomasyonu tetiklemez; sadece editoryal bakim icindir.
- Ilk asamada GitHub token ile giris en hizli yoldur. Cok kullanicili rahat giris icin daha sonra OAuth client eklenebilir.
