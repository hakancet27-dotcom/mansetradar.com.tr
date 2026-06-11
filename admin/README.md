# Sveltia CMS Kurulumu

Bu yapida aktif panel artik yalnizca:

- `/admin/public/`: yayindaki haberler icin bakim paneli

`/admin/` ve eski `/admin/newsroom/` adresleri otomatik olarak bu panele yonlenir.

Public panelin gorevi yayindaki haberlerde:

- baslik / kategori / spot / ozet duzeltmek
- haber govdesi HTML'ini duzeltmek
- gorsel ve alt metin bakimi yapmak
- meta alanlari ve etiketleri guncellemek
- gerekirse haberi tek adimda kalici olarak silmek

- Panel adresi: `https://mansetradar.com.tr/admin/`
- Public haber bakim paneli: `https://mansetradar.com.tr/admin/public/`
- Backend: `hakancet27-dotcom/mansetradar.com.tr`
- Koleksiyonlar:
  - `Yayindaki Haberler / Turkce`: `data/cms-published/articles/*.json`
  - `Published News / English`: `data/cms-published/news/articles/*.json`
  - `Veroeffentlichte Nachrichten / Deutsch`: `data/cms-published/nachrichten/artikel/*.json`
  - `0 - Stok Gorsel Havuzu`: `cms-stock-images/*.json`

Notlar:

- Haber uretim otomasyonu `haber-botu` reposunda kalir.
- Public panel ayni haberlerin bakim kopyalarini `data/cms-published/**` altindan aciyor.
- Public panelden silinen haber once bu bakim kopyasindan cikar; workflow gercek kaynak JSON'u, ilgili HTML ciktilarini, detail JSON'u ve veri cache kayitlarini temizler.
- Delete butonu liste ekraninda sadece tek haber seciliyken aktif tutulur.
- Ilk asamada GitHub token ile giris en hizli yoldur. Cok kullanicili rahat giris icin daha sonra OAuth client eklenebilir.
