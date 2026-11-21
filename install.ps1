# irm https://raw.githubusercontent.com/LatinaLover67/chapel/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$setupUrl = 'https://github.com/LatinaLover67/chapel/releases/latest/download/Chapel-Setup.exe'

function Test-Command($name, [string[]]$arguments) {
  $ErrorActionPreference = 'Continue'
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { return $false }
  try { & $name @arguments *> $null; return $LASTEXITCODE -eq 0 } catch { return $false }
}

function Update-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

Write-Host ''
Write-Host '  Chapel' -ForegroundColor White
Write-Host ''

$missing = @()
if (-not (Test-Command py '-3.12', '--version')) { $missing += , @('Python 3.12', 'Python.Python.3.12') }
if (-not (Test-Command ffmpeg '-version')) { $missing += , @('ffmpeg', 'Gyan.FFmpeg') }
if (-not (Test-Command git '--version')) { $missing += , @('Git for Windows', 'Git.Git') }

if ($missing.Count -gt 0) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    foreach ($m in $missing) {
      Write-Host "  installing $($m[0])..."
      winget install --id $m[1] -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
    }
    Update-Path
  } else {
    Write-Host '  Chapel also needs these, install them after:' -ForegroundColor Yellow
    foreach ($m in $missing) { Write-Host "    - $($m[0])" -ForegroundColor Yellow }
  }
}

Write-Host '  downloading Chapel...'
$setup = Join-Path $env:TEMP 'Chapel-Setup.exe'
Invoke-WebRequest -Uri $setupUrl -OutFile $setup -UseBasicParsing

Write-Host '  installing...'
Start-Process -FilePath $setup -ArgumentList '/S' -Wait
Remove-Item $setup -ErrorAction SilentlyContinue

$app = Join-Path $env:LOCALAPPDATA 'Programs\Chapel\Chapel.exe'
if (-not (Test-Path $app)) { throw "Chapel didn't install. Try downloading Chapel-Setup.exe from https://github.com/LatinaLover67/chapel/releases" }

Write-Host '  done, opening Chapel' -ForegroundColor Green
Write-Host ''
Start-Process -FilePath $app
