$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$SchemaFile = Join-Path $BackendDir ".local\openapi-test.json"

if (-not (Test-Path $VenvPython)) {
    throw "Sanal ortam bulunamadı. Önce .\scripts\setup.ps1 çalıştırın."
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SchemaFile) | Out-Null

Push-Location $BackendDir
try {
    & $VenvPython manage.py check --settings=config.settings.test
    if ($LASTEXITCODE -ne 0) { throw "Django system check başarısız oldu." }
    & $VenvPython manage.py makemigrations --check --dry-run --settings=config.settings.test
    if ($LASTEXITCODE -ne 0) { throw "Migration drift kontrolü başarısız oldu." }
    & $VenvPython -m ruff check .
    if ($LASTEXITCODE -ne 0) { throw "Ruff lint kontrolü başarısız oldu." }
    & $VenvPython -m ruff format --check .
    if ($LASTEXITCODE -ne 0) { throw "Ruff format kontrolü başarısız oldu." }
    & $VenvPython -m pip check
    if ($LASTEXITCODE -ne 0) { throw "Python bağımlılık kontrolü başarısız oldu." }
    & $VenvPython -m pytest
    if ($LASTEXITCODE -ne 0) { throw "Backend testleri başarısız oldu." }
    & $VenvPython manage.py spectacular `
        --format openapi-json `
        --validate `
        --file $SchemaFile `
        --settings=config.settings.test
    if ($LASTEXITCODE -ne 0) { throw "OpenAPI şema kontrolü başarısız oldu." }
}
finally {
    Pop-Location
}

Push-Location $FrontendDir
try {
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw "Frontend lint kontrolü başarısız oldu." }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Frontend typecheck başarısız oldu." }
    npm run test
    if ($LASTEXITCODE -ne 0) { throw "Frontend testleri başarısız oldu." }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend production build başarısız oldu." }
    npm run test:e2e
    if ($LASTEXITCODE -ne 0) { throw "Frontend uçtan uca testleri başarısız oldu." }
}
finally {
    Pop-Location
}
