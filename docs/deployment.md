# Yayına Çıkış (GitHub Pages)

> Son güncelleme: 28 Ağustos 2026.

## Neden statik hosting yeterli

B Photo tamamen local-first çalışır. Fotoğraf, logo ve şablonlar tarayıcıda
(object URL, IndexedDB, localStorage) tutulur; render Canvas 2D ve Web Worker ile
istemcide yapılır. `services/health.ts` kaldırıldıktan sonra **frontend Django
API'sine hiçbir istek atmaz** ve bu, e2e testindeki "sıfır ağ yazma isteği"
kontrolüyle sabitlenmiştir. Vue Router kullanılmadığı için tek bir `index.html`
vardır; SPA fallback kuralına da gerek yoktur.

Sonuç: yayın için **yalnız `frontend/app/dist` klasörünün statik olarak servis
edilmesi** yeterlidir. Sunucu, veritabanı ve Django deployment'ı gerekmez.

`backend/` depoda kalır — sağlık endpoint'i ve ileride gerçek bir API ihtiyacı
doğarsa temel hazır — ancak **deploy edilmez**.

## Yayın mimarisi

- Barındırma: GitHub Pages (public depo, ücretsiz plan).
- Adres: proje sayfası, `https://<KULLANICI>.github.io/<DEPO>/`.
- Tetikleyici: `main` dalına her push; ayrıca Actions sekmesinden elle
  (`workflow_dispatch`).
- Workflow: `.github/workflows/deploy.yml`.

Workflow sırası: `npm ci` → ESLint → TypeScript → Vitest → production build →
Pages artifact yükleme → yayın. Kalite adımları build'den önce koştuğu için
kırık bir commit yayına çıkamaz.

Playwright e2e testleri CI'da **koşmaz**; gerçek Chrome ve Django dev sunucusu
gerektirdikleri için yerelde `scripts/test.ps1` ile çalıştırılır. Yayın öncesi
bu paketin yeşil olduğundan emin ol.

## Alt dizin (base) ayarı

Proje sayfasında uygulama kökte değil `/<DEPO>/` altında servis edilir. Bu yüzden
Vite'ın `base` değeri doğru olmalıdır, aksi hâlde JS/CSS 404 döner ve sayfa boş
açılır.

- `frontend/app/vite.config.ts` içinde `base`, `process.env.BASE_PATH ?? '/'`
  olarak okunur.
- Workflow build adımında `BASE_PATH: /${{ github.event.repository.name }}/`
  verir. **Depo adı değişse bile ayar kendiliğinden doğru kalır**; elle
  güncelleme gerekmez.
- Yerel geliştirmede `BASE_PATH` tanımsızdır, `base` `/` olur; `npm run dev` ve
  Playwright davranışı değişmez.
- Marka bağlantısı sabit `href="/"` yerine `import.meta.env.BASE_URL` kullanır
  (`App.vue`), böylece alt dizinde de kendi sayfasına döner.

## İlk kurulum (tek seferlik)

1. GitHub'da **public** ve **boş** bir depo aç (README/lisans/gitignore ekleme).
2. Proje kökünde remote'u bağla ve gönder:

   ```powershell
   git remote add origin https://github.com/<KULLANICI>/<DEPO>.git
   git push -u origin main
   ```

3. Depo → **Settings → Pages** → *Build and deployment* → **Source: GitHub
   Actions** seç. (Bu adım şart; varsayılan "Deploy from a branch" seçiliyken
   workflow yayın yapamaz.)
4. **Actions** sekmesinden "Deploy to GitHub Pages" çalışmasını izle. Yeşil
   olduğunda adres `deploy` işinin özetinde görünür.

İlk yayının erişilebilir olması birkaç dakika sürebilir.

## Sonraki yayınlar

`main` dalına push yeterlidir:

```powershell
git add -A
git commit -m "Değişiklik açıklaması"
git push
```

## Yayını yerelde doğrulama

Alt dizinli build'i yayına çıkmadan denemek için:

```powershell
$env:BASE_PATH = '/<DEPO>/'
cd frontend
npm run build
npx vite preview --base /<DEPO>/
```

Ardından `$env:BASE_PATH = $null` ile ortam değişkenini temizle; aksi hâlde aynı
PowerShell oturumundaki sonraki `npm run dev` de alt dizin varsayar.

## Bilinen sınırlar ve sonraki adımlar

- **Favicon yok.** `index.html` bir ikon bildirmiyor; tarayıcı sekmesinde
  varsayılan simge çıkar. `frontend/app/public/` altına bir ikon konup
  `<link rel="icon">` eklenebilir.
- **Analytics ve hata takibi yok.** Local-first gizlilik duruşuyla uyumlu;
  eklenirse gizlilik metni gözden geçirilmelidir.
- **Özel alan adı** istenirse `frontend/app/public/CNAME` dosyası eklenir, DNS'te
  A/ALIAS kaydı GitHub Pages IP'lerine yönlendirilir ve `BASE_PATH` kaldırılarak
  `base` `/` bırakılır.
- **Depo public'tir.** Kaynak kod, plan belgesi ve devir notları herkese açıktır;
  bunlarda müşteri adı veya özel bilgi bulunmamalıdır. Kök dizindeki örnek
  görseller (`Bant_Logo_Sahibinden.*`, `wp_canli_destek_1-ilan-matik.jpg`) de
  yayımlanır.
- Ücretsiz planda GitHub Pages yalnız public depolarda çalışır. Depo private
  yapılacaksa GitHub Pro gerekir ya da Cloudflare Pages / Netlify gibi bir
  alternatife geçilir; her ikisinde de aynı `dist` çıktısı ve `BASE_PATH`
  mantığı kullanılır.
