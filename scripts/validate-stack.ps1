param(
  [ValidateSet('Start', 'Rebuild', 'Test', 'Status', 'BackupDrill', 'Stop')][string]$Action = 'Status',
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [string[]]$Specs = @()
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$runRoot = Join-Path (Join-Path $repoRoot '.validation') $RunId
$project = "parley-validation-$RunId"
$composeFile = Join-Path $repoRoot 'docker-compose.validation.yml'
$envFile = Join-Path $runRoot 'validation.env'
$compose = @('compose', '--project-name', $project, '--env-file', $envFile, '-f', $composeFile)
function RunDocker([string[]]$Arguments) {
  & docker @compose @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Validation Docker action failed (exit $LASTEXITCODE)." }
}
if ($Action -eq 'Start') {
  if (Test-Path -LiteralPath $runRoot) { throw 'Run already exists. Use a fresh RunId; existing data is never overwritten.' }
  New-Item -ItemType Directory -Path $runRoot | Out-Null
  $lines = @("VALIDATION_RUN=$RunId")
  foreach ($key in @('DB_PASSWORD','REDIS_PASSWORD','MQ_PASSWORD','TURN_SECRET','JWT_SECRET','HASH_SECRET')) {
    $lines += "VALIDATION_$key=$([Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)))"
  }
  $lines += "VALIDATION_TOTP_KEY=$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)))"
  [IO.File]::WriteAllLines($envFile, $lines)
  [IO.File]::WriteAllText((Join-Path $runRoot 'state.json'), (@{runId=$RunId; project=$project; frontend='http://127.0.0.1:3107'; api='http://127.0.0.1:18080'; mailpit='http://127.0.0.1:18025'} | ConvertTo-Json))
  RunDocker @('config','--quiet')
  RunDocker @('build','api','workers')
  RunDocker @('build','frontend')
  RunDocker @('up','--detach','--no-build','--wait','--wait-timeout','180')
  Write-Output "Validation ready: $project (frontend 127.0.0.1:3107)."
} else {
  if (!(Test-Path -LiteralPath $envFile)) { throw 'Unknown validation run; refusing to target another stack.' }
  switch ($Action) {
    'Status' { RunDocker @('ps') }
    'Rebuild' {
      RunDocker @('build','api','workers')
      RunDocker @('build','frontend')
      RunDocker @('up','--detach','--no-build','--wait','--wait-timeout','180')
    }
    'Stop' {
      # Project comes only from the validated RunId and fixed prefix, never from arbitrary saved state.
      RunDocker @('down','--volumes','--remove-orphans')
      Remove-Item -LiteralPath $envFile
      Write-Output "Removed only validation project $project and its test credentials; reports are retained."
    }
    'BackupDrill' {
      # Stop only this test project's writers to capture a consistent snapshot; no live --drop restore.
      RunDocker @('stop','api','workers')
      try {
        $drill = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'validation-backup-drill.mjs') -Raw
        $drill | & docker @compose run --rm --no-deps -T -e "PARLEY_VALIDATION_RUN=$RunId" -e 'VALIDATION_DRILL_ACTION=prepare' api node --input-type=module
        if ($LASTEXITCODE -ne 0) { throw 'Backup manifest preparation failed.' }
        RunDocker @('exec','-T','mongodb','sh','-c','mongodump --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db parley_validation --archive=/tmp/validation.archive --gzip')
        $restoreCommand = 'mongorestore --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/tmp/validation.archive --gzip --nsFrom="parley_validation.*" --nsTo="parley_validation_restore_' + $RunId + '.*"'
        RunDocker @('exec','-T','mongodb','sh','-c',$restoreCommand)
        $drill | & docker @compose run --rm --no-deps -T -e "PARLEY_VALIDATION_RUN=$RunId" -e 'VALIDATION_DRILL_ACTION=verify' api node --input-type=module
        if ($LASTEXITCODE -ne 0) { throw 'Restored content, indexes or credentials did not verify.' }
      } finally { RunDocker @('up','--detach','--wait','api','workers') }
    }
    'Test' {
      $names = @('E2E_BASE_URL','E2E_MAILPIT_URL','E2E_COMPOSE_PROJECT','E2E_COMPOSE_FILE','E2E_COMPOSE_ENV_FILE')
      $saved = @{}; foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
      Push-Location (Join-Path $repoRoot 'frontend')
      try {
        $env:E2E_BASE_URL = 'http://127.0.0.1:3107'; $env:E2E_MAILPIT_URL = 'http://127.0.0.1:18025'
        $env:E2E_COMPOSE_PROJECT = $project; $env:E2E_COMPOSE_FILE = $composeFile; $env:E2E_COMPOSE_ENV_FILE = $envFile
        & npm.cmd run test:e2e:stack -- --workers=1 @Specs
        if ($LASTEXITCODE -ne 0) { throw 'Full-stack validation failed. See frontend/test-results; isolated stack remains available for diagnosis.' }
      } finally {
        Pop-Location
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
      }
    }
  }
}
