$ErrorActionPreference = "Stop"

$engineScript = Join-Path $PSScriptRoot "start-engine.ps1"
$webScript = Join-Path $PSScriptRoot "start-web.ps1"
$existingEngine = Get-NetTCPConnection `
    -State Listen `
    -LocalPort 8100 `
    -ErrorAction SilentlyContinue
if ($existingEngine) {
    throw "8100 포트를 이미 다른 프로세스가 사용 중입니다."
}

$engineInfo = [System.Diagnostics.ProcessStartInfo]::new()
$engineInfo.FileName = "powershell.exe"
$engineInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $engineScript
$engineInfo.UseShellExecute = $true
$engineInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$engineProcess = [System.Diagnostics.Process]::Start($engineInfo)

try {
    $connected = $false
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        try {
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:8100/health" `
                -TimeoutSec 1
            if ($response.status -eq "ok") {
                $connected = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $connected) {
        throw "LUNEL Engine이 제한 시간 안에 시작되지 않았습니다."
    }

    & $webScript
}
finally {
    $engineListener = Get-NetTCPConnection `
        -State Listen `
        -LocalPort 8100 `
        -ErrorAction SilentlyContinue
    if ($engineListener) {
        Stop-Process -Id $engineListener.OwningProcess -ErrorAction SilentlyContinue
    }
    if ($engineProcess -and -not $engineProcess.HasExited) {
        Stop-Process -Id $engineProcess.Id -ErrorAction SilentlyContinue
    }
}
