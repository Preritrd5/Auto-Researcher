$ErrorActionPreference = "Stop"

$ROOT_DIR = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RUNTIME_DIR = Join-Path $ROOT_DIR "output\runtime"
if (-not (Test-Path $RUNTIME_DIR)) {
    New-Item -ItemType Directory -Path $RUNTIME_DIR -Force | Out-Null
}

$API_PID_FILE = Join-Path $RUNTIME_DIR "backend-api.pid"
$WORKER_PID_FILE = Join-Path $RUNTIME_DIR "backend-worker.pid"
$FRONTEND_PID_FILE = Join-Path $RUNTIME_DIR "frontend.pid"

$API_LOG_FILE = Join-Path $RUNTIME_DIR "backend-api.log"
$WORKER_LOG_FILE = Join-Path $RUNTIME_DIR "backend-worker.log"
$FRONTEND_BUILD_LOG_FILE = Join-Path $RUNTIME_DIR "frontend-build.log"
$FRONTEND_LOG_FILE = Join-Path $RUNTIME_DIR "frontend.log"

$env_file = Join-Path $ROOT_DIR ".env"
if (Test-Path $env_file) {
    Get-Content $env_file | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $name = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $val, "Process")
        }
    }
}

$NATIVE_ROOT = $ROOT_DIR.Replace('\', '/')
$env:DATABASE_URL = "sqlite+aiosqlite:///$NATIVE_ROOT/backend/auto_researcher.db"
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://localhost:6379/0" }
$env:ARTIFACTS_ROOT = Join-Path $ROOT_DIR "artifacts"
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8000"
$env:NEXT_PUBLIC_WS_BASE_URL = "ws://127.0.0.1:8000"

function Is-Running($pidFile) {
    if (-not (Test-Path $pidFile)) { return $false }
    $p = (Get-Content $pidFile -Raw).Trim()
    if (-not $p) { return $false }
    $proc = Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue
    return ($null -ne $proc)
}

function Start-BackgroundService($name, $workdir, $pidFile, $logFile, $cmd, $args) {
    if (Is-Running $pidFile) {
        $existingPid = (Get-Content $pidFile -Raw).Trim()
        Write-Host "$name is already running (PID $existingPid)."
        return
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = $cmd
    $pinfo.Arguments = $args
    $pinfo.WorkingDirectory = $workdir
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $pinfo

    $logStream = [System.IO.StreamWriter]::new($logFile, $false, [System.Text.Encoding]::UTF8)
    $logStream.AutoFlush = $true

    $outHandler = {
        param($sender, $e)
        if ($e.Data) { $logStream.WriteLine($e.Data) }
    }
    $errHandler = {
        param($sender, $e)
        if ($e.Data) { $logStream.WriteLine($e.Data) }
    }
    Register-ObjectEvent -InputObject $proc -EventName "OutputDataReceived" -Action $outHandler | Out-Null
    Register-ObjectEvent -InputObject $proc -EventName "ErrorDataReceived" -Action $errHandler | Out-Null

    $proc.Start() | Out-Null
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    Set-Content -Path $pidFile -Value $proc.Id
    Write-Host "Started $name (PID $($proc.Id))."
}

function Wait-For-Http($name, $url, $logFile) {
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
                Write-Host "$name is ready: $url"
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    Write-Host "$name did not become ready in time."
    if (Test-Path $logFile) {
        Write-Host "Last log lines from $logFile:"
        Get-Content $logFile | Select-Object -Last 30
    }
    exit 1
}

Write-Host "Starting backend API..."
$backendDir = Join-Path $ROOT_DIR "backend"
Start-BackgroundService "backend API" $backendDir $API_PID_FILE $API_LOG_FILE "uv" "run uvicorn app.main:app --host 127.0.0.1 --port 8000"
Wait-For-Http "backend API" "http://127.0.0.1:8000/api/health" $API_LOG_FILE

Write-Host "Starting backend worker..."
Start-BackgroundService "backend worker" $backendDir $WORKER_PID_FILE $WORKER_LOG_FILE "uv" "run python worker.py"

Write-Host "Building frontend..."
$frontendDir = Join-Path $ROOT_DIR "frontend"
Push-Location $frontendDir
npm run build > $FRONTEND_BUILD_LOG_FILE 2>&1
Pop-Location
Write-Host "Frontend build complete."

Write-Host "Starting frontend..."
Start-BackgroundService "frontend" $frontendDir $FRONTEND_PID_FILE $FRONTEND_LOG_FILE "npm.cmd" "run start -- --hostname 127.0.0.1 --port 3000"
Wait-For-Http "frontend" "http://127.0.0.1:3000" $FRONTEND_LOG_FILE

Write-Host ""
Write-Host "Auto-Researcher is running."
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend API: http://127.0.0.1:8000/docs"
Write-Host "Logs in: $RUNTIME_DIR"
