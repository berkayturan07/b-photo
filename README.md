# B Photo

Galericilerin ve ilan veren işletmelerin fotoğraflarını, tekrar kullanılabilir
görsel reçeteleriyle toplu biçimde yayına hazırlayan local-first web uygulaması.

## Teknoloji

- Backend: Python 3.12, Django 5.2 LTS, Django REST Framework
- Frontend: Vue 3, TypeScript, Vite, Pinia, Konva
- Yerel işleme: Canvas 2D, Web Workers ve OffscreenCanvas
- Veritabanı: geliştirmede SQLite, üretimde PostgreSQL

Fotoğraflar varsayılan akışta tarayıcıda kalır ve Django API'ye yüklenmez.

## Gereksinimler

- Windows Python 3.12
- Windows Node.js 22.22.2 veya uyumlu Node.js 22 sürümü
- PowerShell

Proje Windows-native çalıştırılır. Windows ve WSL `.venv`/`node_modules`
klasörleri birbirine karıştırılmaz.

## İlk kurulum

PowerShell'i proje kökünde açın:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

## Geliştirme

Backend ve frontend'i birlikte başlatmak için:

```powershell
.\scripts\dev.ps1
```

- Vue: <http://127.0.0.1:5173>
- Django API: <http://127.0.0.1:8000/api/v1/>
- OpenAPI şeması: <http://127.0.0.1:8000/api/v1/schema>

## Kalite kontrolleri

```powershell
.\scripts\test.ps1
```

Komut Django kontrollerini, migration drift kontrolünü, backend lint/test,
frontend lint/typecheck/test, production build ve gerçek Chrome üzerinde
Playwright uçtan uca test adımlarını çalıştırır.

## Yayına çıkış

Uygulama local-first olduğu ve API'ye istek atmadığı için statik olarak
yayınlanır: `main` dalına yapılan her push
`.github/workflows/deploy.yml` üzerinden lint, typecheck, Vitest ve production
build adımlarını koşup çıktıyı GitHub Pages'e gönderir. Backend depoda durur,
deploy edilmez. Ayrıntılar ve ilk kurulum adımları için
[`docs/deployment.md`](docs/deployment.md).

## Güncel durum

İlk dört dikey dilimde çoklu fotoğraf/klasör seçimi, sürükle-bırak, metadata
çıkarma, yön sınıflandırma, Konva tabanlı yerel önizleme, logo, dinamik metin
ve tek/tekrarlanan filigran katmanları hazırdır. Logo, metin ve tek filigran
sürüklenebilir veya dokuz hazır konuma hizalanabilir. Katmanlar sürümlü Template
JSON ile yönetilir; bağımsız Canvas 2D motoru seçili fotoğrafı orijinal
çözünürlükte JPG/PNG olarak indirir.

Önizleme yüzde 25–400 aralığında düğmeler, fare tekerleği veya dokunmatik
yakınlaştırma hareketiyle büyütülebilir. Yakın görünüm fotoğraf sürüklenerek
gezilebilir ve tek düğmeyle yeniden ekrana sığdırılabilir. Bu kamera durumu
reçeteye ve indirilen görsele yansımaz.

Fare tekerleği varsayılan olarak sayfayı kaydırır. Kullanıcı önizleme
araçlarındaki Tekerlekle Zoom anahtarını açabilir veya anahtardan bağımsız
olarak `Ctrl/Cmd + tekerlek` kısayolunu kullanabilir. Anahtar tercihi yalnız
tarayıcıda saklanır.

Önizleme “Büyük Görünüm” düğmesiyle ekranı kaplayacak şekilde genişletilebilir.
Zoom, pan ve katman etkileşimleri korunur; düğmeyle veya `Esc` tuşuyla normal
çalışma alanına dönülür.

Şablonlar adlandırılarak logo ve ortak ilan bilgileriyle birlikte IndexedDB'de
saklanabilir, daha sonra Hazır Şablonlar alanından yeniden uygulanabilir. Tüm
fotoğraflar ilerleme ve iptal desteğiyle aynı reçeteden geçirilip tek ZIP
dosyası olarak indirilebilir.

Seçili fotoğrafın parlaklık, kontrast, renk canlılığı ve sıcaklığı diğer
fotoğraflardan bağımsız ve orijinal dosyaya dokunmadan ayarlanabilir. Kullanıcı
orijinal/düzenlenmiş görünüm arasında geçiş yapabilir veya seçili fotoğrafın
ayarlarını sıfırlayabilir. Bu düzeltmeler yalnız taban fotoğrafa uygulanır;
ortak logo, metin ve filigran reçetesinden ayrı tutulur.

Sıradaki geliştirme dilimi Template JSON dışa/içe aktarma, büyük dosyalarda
Web Worker tabanlı işleme ve bellek yönetimidir.
