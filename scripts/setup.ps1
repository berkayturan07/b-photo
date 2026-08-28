$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$BackendDir = Join-Path $ProjectRoot "backend"
$LocalDataDir = Join-Path $BackendDir ".local"
$RequirementsFile = Join-Path $BackendDir "requirements\lock.txt"
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path $VenvPython)) {
    Write-Host "Python sanal ortamı oluşturuluyor..."
    py -3.12 -m venv (Join-Path $ProjectRoot ".venv")
}

Write-Host "Backend bağımlılıkları kuruluyor..."
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip güncellemesi başarısız oldu." }
& $VenvPython -m pip install -r $RequirementsFile
if ($LASTEXITCODE -ne 0) { throw "Backend bağımlılık kurulumu başarısız oldu." }

New-Item -ItemType Directory -Force -Path $LocalDataDir | Out-Null

Write-Host "Django migration'ları uygulanıyor..."
& $VenvPython (Join-Path $BackendDir "manage.py") migrate
if ($LASTEXITCODE -ne 0) { throw "Django migration işlemi başarısız oldu." }

Write-Host "Frontend bağımlılıkları kuruluyor..."
Push-Location $FrontendDir
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "Frontend bağımlılık kurulumu başarısız oldu." }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Kurulum tamamlandı. Uygulamayı başlatmak için:"
Write-Host "  .\scripts\dev.ps1"
