# Sveltia CMS Kurulumu

Bu panel yayindaki public haberleri editoryal bakim icin kullanilir.
Private haber uretim ve inceleme akisi ayri newsroom panelindedir.

- Panel adresi: `https://mansetradar.com.tr/admin/`
- Newsroom paneli: `https://mansetradar.com.tr/admin/newsroom/`
- Backend: `hakancet27-dotcom/mansetradar.com.tr`
- Koleksiyonlar:
  - `1 - Yayindaki Haberler / Turkce`: `articles/*.json`
  - `2 - Published News / English`: `news/articles/*.json`
  - `3 - Veroeffentlichte Nachrichten / Deutsch`: `nachrichten/artikel/*.json`

Notlar:

- Haber uretim otomasyonu `haber-botu` reposunda kalir.
- `newsroom/review/pending` kuyrugu public site reposunda tutulmaz; `haber-botu` reposundaki `/admin/newsroom/` panelinden yonetilir.
- Yayindaki haber koleksiyonlari hicbir otomasyonu tetiklemez; sadece editoryal bakim icindir.
- Ilk asamada GitHub token ile giris en hizli yoldur. Cok kullanicili rahat giris icin daha sonra OAuth client eklenebilir.
