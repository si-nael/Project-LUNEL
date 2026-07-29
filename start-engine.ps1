param(
    [int]$Port = 8100,
    [string]$DatabasePath = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$engineRoot = Join-Path $projectRoot "engine"
$venvRoot = Join-Path $engineRoot ".venv"
$venvPython = Join-Path $venvRoot "Scripts\python.exe"
$runtimePython = $null

if (Test-Path -LiteralPath $venvPython) {
    $runtimePython = $venvPython
}
else {
    $bootstrap = Get-Command python.exe -ErrorAction SilentlyContinue
    $bootstrapArguments = @()
    if (-not $bootstrap) {
        $bootstrap = Get-Command py.exe -ErrorAction SilentlyContinue
        $bootstrapArguments = @("-3")
    }

    $usingCodexRuntime = $false
    if (-not $bootstrap) {
        $codexPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
        if (Test-Path -LiteralPath $codexPython) {
            $bootstrap = [pscustomobject]@{ Source = $codexPython }
            $usingCodexRuntime = $true
        }
    }
    if (-not $bootstrap) {
        throw "Python 3을 찾을 수 없습니다."
    }

    # Codex 작업공간에서는 기존 패키지를 재사용해 네트워크 설치 없이도
    # 엔진을 즉시 실행한다. 일반 환경에서는 독립 .venv를 만든다.
    $workspacePackages = Join-Path $projectRoot "backend\venv\Lib\site-packages"
    if ($usingCodexRuntime -and (Test-Path -LiteralPath $workspacePackages)) {
        $runtimePython = $bootstrap.Source
        $env:PYTHONPATH = "$engineRoot;$workspacePackages"
    }
    else {
        Write-Host "LUNEL Engine 가상환경을 준비합니다..."
        & $bootstrap.Source @bootstrapArguments -m venv $venvRoot
        if ($LASTEXITCODE -ne 0) {
            throw "Python 가상환경 생성에 실패했습니다."
        }
        $runtimePython = $venvPython
    }
}

& $runtimePython -c "import fastapi, uvicorn, pydantic" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "LUNEL Engine 의존성을 설치합니다..."
    & $runtimePython -m pip install -r (Join-Path $engineRoot "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "엔진 의존성 설치에 실패했습니다."
    }
}

if (-not $env:LUNEL_ENGINE_TOKEN) {
    $env:LUNEL_ENGINE_TOKEN = "local-lunel-engine"
}
if ($DatabasePath) {
    $env:LUNEL_ENGINE_DB = $DatabasePath
}

Write-Host "LUNEL Engine: http://127.0.0.1:$Port"
& $runtimePython -m uvicorn lunel_engine.app:app `
    --app-dir $engineRoot `
    --host 127.0.0.1 `
    --port $Port
