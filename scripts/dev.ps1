$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path $VenvPython)) {
    throw "Sanal ortam bulunamadı. Önce .\scripts\setup.ps1 çalıştırın."
}

$BackendProcess = Start-Process `
    -FilePath $VenvPython `
    -ArgumentList @("manage.py", "runserver", "127.0.0.1:8000") `
    -WorkingDirectory $BackendDir `
    -NoNewWindow `
    -PassThru

try {
    Write-Host "Backend: http://127.0.0.1:8000"
    Write-Host "Frontend: http://127.0.0.1:5173"
    Push-Location $FrontendDir
    try {
        npm run dev
    }
    finally {
        Pop-Location
    }
}
finally {
    if (-not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id
    }
}
