param(
    [int]$Port = 3000,
    [string]$EngineUrl = "http://127.0.0.1:8100"
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$frontendRoot = Join-Path $projectRoot "frontend"
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    throw "Node.js와 npm을 찾을 수 없습니다."
}

if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot "node_modules"))) {
    Write-Host "LUNEL Web 의존성을 설치합니다..."
    Push-Location $frontendRoot
    try {
        & $npm.Source install
        if ($LASTEXITCODE -ne 0) {
            throw "웹 의존성 설치에 실패했습니다."
        }
    }
    finally {
        Pop-Location
    }
}

$env:NEXT_PUBLIC_LUNEL_LOCAL = "true"
$env:LUNEL_ENGINE_URL = $EngineUrl
if (-not $env:LUNEL_ENGINE_TOKEN) {
    $env:LUNEL_ENGINE_TOKEN = "local-lunel-engine"
}

Write-Host "LUNEL Web: http://127.0.0.1:$Port"
Push-Location $frontendRoot
try {
    & $npm.Source run dev -- -p $Port
}
finally {
    Pop-Location
}
