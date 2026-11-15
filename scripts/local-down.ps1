$ROOT_DIR = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RUNTIME_DIR = Join-Path $ROOT_DIR "output\runtime"

function Stop-BackgroundService($name, $pidFile) {
    if (-not (Test-Path $pidFile)) {
        Write-Host "$name is not running (no PID file)."
        return
    }
    $p = (Get-Content $pidFile -Raw).Trim()
    if (-not $p) {
        Remove-Item $pidFile -ErrorAction SilentlyContinue
        Write-Host "$name PID file was empty; cleaned up."
        return
    }
    try {
        $proc = Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue
        if ($null -ne $proc) {
            Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped $name (PID $p)."
        } else {
            Write-Host "$name is already stopped."
        }
    } catch {
        Write-Host "$name is already stopped."
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

Stop-BackgroundService "frontend" (Join-Path $RUNTIME_DIR "frontend.pid")
Stop-BackgroundService "backend worker" (Join-Path $RUNTIME_DIR "backend-worker.pid")
Stop-BackgroundService "backend API" (Join-Path $RUNTIME_DIR "backend-api.pid")

Write-Host "Auto-Researcher local services are stopped."
