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
- Depo: <https://github.com/berkayturan07/b-photo>
- Adres: <https://berkayturan07.github.io/b-photo/>
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

Proje sayfasında uygulama kökte değil `/b-photo/` altında servis edilir. Bu yüzden
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

## İlk kurulum

Bu adımlar 28 Ağustos 2026'da tamamlandı; tekrar yapılması gerekmez. Depo
sıfırdan yeniden kurulursa sıra şudur:

1. Public ve boş bir depo aç (README/lisans/gitignore ekletme):

   ```powershell
   gh repo create b-photo --public --source=. --remote=origin --push
   ```

2. Pages kaynağını **GitHub Actions** yap. Bu adım şart; varsayılan "Deploy from
   a branch" seçiliyken workflow yayın yapamaz.

   ```powershell
   gh api --method POST repos/<KULLANICI>/b-photo/pages -f build_type=workflow
   ```

   Aynısı arayüzden: Settings → Pages → *Build and deployment* → Source: GitHub
   Actions.

3. Çalışmayı izle: `gh run watch`.

`gh auth login` yaparken **`--scopes repo,workflow` verilmelidir**. `workflow`
yetkisi olmayan bir token `.github/workflows/` altındaki dosyaları push edemez;
GitHub push'u doğrudan reddeder.

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
$env:BASE_PATH = '/b-photo/'
cd frontend
npm run build
npx vite preview --base /b-photo/
```

Ardından `$env:BASE_PATH = $null` ile ortam değişkenini temizle; aksi hâlde aynı
PowerShell oturumundaki sonraki `npm run dev` de alt dizin varsayar.

## Bilinen sınırlar ve sonraki adımlar

- **Analytics ve hata takibi yok.** Local-first gizlilik duruşuyla uyumlu;
  eklenirse gizlilik metni gözden geçirilmelidir.
- **Özel alan adı** istenirse `frontend/app/public/CNAME` dosyası eklenir, DNS'te
  A/ALIAS kaydı GitHub Pages IP'lerine yönlendirilir ve `BASE_PATH` kaldırılarak
  `base` `/` bırakılır.
- **Depo public'tir.** Kaynak kod herkese açıktır ve müşteri adı veya özel bilgi
  içermemelidir. Ajan talimatları (`AGENTS.md`, `CLAUDE.md`), devir notu, ürün
  planı ve kök dizindeki deneme görselleri (`Bant_Logo_Sahibinden.*`,
  `wp_canli_destek_1-ilan-matik.jpg`) bilinçli olarak depo dışındadır;
  `.gitignore` ile hariç tutulur ve yalnız yerel çalışma kopyasında durur.
- Ücretsiz planda GitHub Pages yalnız public depolarda çalışır. Depo private
  yapılacaksa GitHub Pro gerekir ya da Cloudflare Pages / Netlify gibi bir
  alternatife geçilir; her ikisinde de aynı `dist` çıktısı ve `BASE_PATH`
  mantığı kullanılır.
