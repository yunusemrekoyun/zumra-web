# Zümra Web

Zümra Web, Zümra Akademi public sitesi ve CRM/SaaS workspace panelleri için Next.js tabanlı uygulamadır.

## Çalıştırma

```bash
npm install
npm run dev
```

Yerel geliştirme varsayılan olarak `http://localhost:3000` üzerinde çalışır.

## Route ve Dil Yapısı

Uygulama `next-intl` ile prefix'li locale route yapısı kullanır.

- Public site: `/tr`, `/en`
- Admin panel: `/tr/admin`, `/en/admin`
- Öğrenci paneli: `/tr/ogrenci`, `/en/ogrenci`
- Danışman paneli: `/tr/danisman`, `/en/danisman`
- Öğretmen paneli: `/tr/ogretmen`, `/en/ogretmen`

Varsayılan dil `tr`'dir. Prefixsiz route'lar middleware üzerinden locale'li karşılığa yönlenir.

## Workspace Kuralları

- Panel layout'ları `WorkspaceShell` üzerinden çalışır.
- Yeni panel veya modül doğrudan sidebar içine elle eklenmemelidir; workspace module/config katmanı üzerinden tanımlanmalıdır.
- Yeni panel sayfalarının root wrapper'ı `workspace-page` veya mevcut panel uyumluluğu için `admin-page` olmalıdır.
- Panel linkleri locale-aware navigation helper'ları üzerinden kullanılmalıdır.
- Route geçiş animasyonu merkezi `route-animation-engine` ile çalışır.

## Data ve Rol Kuralları

- UI sayfaları mock data array'lerini doğrudan tüketmek yerine domain facade/service katmanından veri almalıdır.
- Admin tüm workspace datasını görebilir.
- Danışman yalnızca kendisine atanmış lead ve öğrencileri görür.
- Öğretmen yalnızca kendi ders/öğrenci akışını görür.
- Öğrenci yalnızca kendi profil, ders, görüşme, teklif ve ilerleme datasını görür.

## Para Birimi

Para birimi her dilde sabittir: `TRY`.

- Tutarlar locale'e göre formatlanabilir.
- Para birimi dönüştürülmez.
- `TRY` dışında para birimi gösterimi veya dönüşümü yapılmaz.

## Yeni Modül Ekleme Kontrolü

1. Workspace module/config katmanına modül tanımını ekle.
2. İlgili `app/[locale]/...` page dosyasını oluştur.
3. `messages/tr.json` ve `messages/en.json` içine metinleri ekle.
4. Sayfayı `workspace-page` ile başlat.
5. UI primitive'leri kullan: `Card`, `Button`, `PageHeader`, `KpiCard`, `SearchInput`, `ResponsiveTabs`.
6. Veri ihtiyacı varsa domain facade/service katmanından beslen.

## Kabul Kontrol Listesi

```bash
npm run lint
npm run build
```

Smoke route'lar:

- `/tr`, `/en`
- `/tr/admin`, `/en/admin`
- `/tr/ogrenci`, `/en/ogrenci`
- `/tr/danisman`, `/en/danisman`
- `/tr/ogretmen`, `/en/ogretmen`

Ek kontroller:

- Locale switch aynı path'i korur.
- Body-level horizontal scroll oluşmaz.
- Workspace route animasyonu bozulmaz.
- TR/EN message key eşitliği korunur.
- Rol bazlı visibility doğru çalışır.
- Tutar alanlarında currency `TRY` kalır.
