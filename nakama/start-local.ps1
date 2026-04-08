param(
  [string]$NakamaPath = "nakama",
  [string]$DbAddress = "",
  [string]$Name = "nakama1",
  [string]$LogLevel = "DEBUG",
  [int]$TokenExpirySec = 7200
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildDir = Join-Path $ScriptDir "build"
$EnvFile = Join-Path $ScriptDir ".env"

if (-not (Test-Path $BuildDir)) {
  throw "Build output not found at '$BuildDir'. Run 'npm run build' inside 'nakama' first."
}

function Convert-ToNakamaDbAddress {
  param([string]$RawAddress)

  if ([string]::IsNullOrWhiteSpace($RawAddress)) {
    return $RawAddress
  }

  if ($RawAddress -match "^(postgres|cockroach):") {
    return $RawAddress
  }

  if ($RawAddress -match "^postgresql:\/\/") {
    $normalized = $RawAddress.Trim().Trim("'").Trim('"')
    $match = [regex]::Match($normalized, "^postgresql:\/\/(?<user>[^:\/\s]+):(?<pass>[^@\s]+)@(?<host>[^:\/\s]+)(:(?<port>\d+))?\/(?<db>[^\?\s\/]+)")
    if (-not $match.Success) {
      throw "Could not parse NAKAMA_DB_ADDRESS from .env. Use format 'postgresql://user:password@host:5432/dbname'."
    }

    $user = $match.Groups["user"].Value
    $pass = $match.Groups["pass"].Value
    $dbHost = $match.Groups["host"].Value
    $port = if ($match.Groups["port"].Success) { $match.Groups["port"].Value } else { "5432" }
    $dbName = $match.Groups["db"].Value

    return "${user}:${pass}@${dbHost}:$port/$dbName"
  }

  return $RawAddress
}

if ([string]::IsNullOrWhiteSpace($DbAddress) -and (Test-Path $EnvFile)) {
  $envLine = Get-Content $EnvFile | Where-Object { $_ -match "^NAKAMA_DB_ADDRESS=" } | Select-Object -First 1
  if ($envLine) {
    $DbAddress = ($envLine -replace "^NAKAMA_DB_ADDRESS=", "").Trim()
  }
}

if ([string]::IsNullOrWhiteSpace($DbAddress)) {
  $DbAddress = "postgres:localdb@127.0.0.1:5432/nakama"
}

$DbAddress = Convert-ToNakamaDbAddress -RawAddress $DbAddress

Write-Host "Running migrations..." -ForegroundColor Cyan
& $NakamaPath migrate up --database.address $DbAddress
if ($LASTEXITCODE -ne 0) {
  throw "Nakama migration failed."
}

Write-Host "Starting Nakama..." -ForegroundColor Green
& $NakamaPath `
  --name $Name `
  --database.address $DbAddress `
  --logger.level $LogLevel `
  --session.token_expiry_sec $TokenExpirySec `
  --runtime.path $BuildDir `
  --runtime.js_entrypoint "main.js"
