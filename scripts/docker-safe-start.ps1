# WordWave Docker safe start / management script
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\docker-safe-start.ps1
#       Safe-start Docker Desktop and wait for engine (with memory guard).
#   powershell -ExecutionPolicy Bypass -File scripts\docker-safe-start.ps1 -NoAuto
#       After engine is ready: set ALL containers restart=no and stop them.
#   powershell -ExecutionPolicy Bypass -File scripts\docker-safe-start.ps1 -Run wordwave
#       Start only one project directory (must contain docker-compose.yml).

param(
  [string]$Run = "",
  [switch]$NoAuto,
  [switch]$SetupManual,
  [int]$MemoryGuardGB = 6,
  [int]$TimeoutSeconds = 240
)

$ErrorActionPreference = 'Continue'
$dockerPath = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path $dockerPath) { $env:PATH = $dockerPath + ';' + $env:PATH }

function Test-Engine {
  docker ps *> $null
  return ($LASTEXITCODE -eq 0)
}

function Stop-DockerDesktop {
  Get-Process | Where-Object { $_.ProcessName -like '*docker*' -or $_.ProcessName -like '*com.docker*' } |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  wsl.exe --shutdown 2>$null
}

if (-not (Test-Engine)) {
  Write-Host '== Engine not running, safe-starting Docker Desktop =='
  Stop-DockerDesktop
  Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' | Out-Null

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    if (Test-Engine) { Write-Host '== Engine ready =='; break }
    $backend = Get-Process -Name 'com.docker.backend' -ErrorAction SilentlyContinue |
      Sort-Object PrivateMemorySize64 -Descending | Select-Object -First 1
    if ($backend -and (($backend.PrivateMemorySize64 / 1GB) -gt $MemoryGuardGB)) {
      Write-Host ("!! Backend memory abnormal ({0:N1} GB), killing. Please reboot the PC and retry." -f ($backend.PrivateMemorySize64 / 1GB))
      Stop-DockerDesktop
      exit 2
    }
  }
  if (-not (Test-Engine)) {
    Write-Host '!! Timeout, engine not ready. Please reboot the PC and retry.'
    Stop-DockerDesktop
    exit 3
  }
}

if ($NoAuto) {
  Write-Host '== Set ALL containers restart=no and stop them =='
  $containers = docker ps -aq
  if ($containers) {
    foreach ($id in $containers) {
      $name = docker inspect --format '{{.Name}}' $id
      $policy = docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' $id
      docker update --restart=no $id | Out-Null
      Write-Host ("  {0}   old-policy={1} -> no" -f $name, $policy)
    }
    docker stop $containers | Out-Null
  }
  Write-Host '== All containers stopped and will NOT auto-start with Docker =='
  Write-Host '   To run a project later: use -Run <dir> or docker-compose up -d manually.'
}

if ($Run) {
  $dir = $null
  $cwd = (Get-Location).Path
  if (Test-Path (Join-Path $Run 'docker-compose.yml')) { $dir = $Run }
  elseif (Test-Path (Join-Path $cwd $Run 'docker-compose.yml')) { $dir = Join-Path $cwd $Run }
  elseif ($Run -eq 'wordwave' -and (Test-Path (Join-Path $cwd 'docker-compose.yml'))) { $dir = $cwd }
  if (-not $dir) {
    Write-Host ("!! Project dir not found: {0} (needs docker-compose.yml)" -f $Run)
    exit 4
  }
  Write-Host ("== Starting project: {0} ==" -f $Run)
  Push-Location $dir
  try { docker-compose up -d --build } finally { Pop-Location }
}

if ($SetupManual) {
  Write-Host '== Manual mode: engine ready, all containers manual. Starting WordWave only =='
  if (-not $NoAuto) {
    $containers = docker ps -aq
    if ($containers) { foreach ($id in $containers) { docker update --restart=no $id | Out-Null } }
    $running = docker ps -q
    if ($running) { docker stop $running | Out-Null }
  }
  $cwd = (Get-Location).Path
  if (Test-Path (Join-Path $cwd 'docker-compose.yml')) {
    Push-Location $cwd
    try { docker-compose up -d --build } finally { Pop-Location }
  } else {
    Write-Host '!! No docker-compose.yml in current directory; run -Run <project-dir> instead.'
  }
}

Write-Host '== Current containers =='
docker ps -a --format "table {{.Names}}`t{{.Status}}"
