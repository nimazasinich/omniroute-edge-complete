$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Stage = Join-Path $env:TEMP 'omniroute-edge-deploy-staging'
$env:npm_config_cache = Join-Path $env:LOCALAPPDATA 'npm-cache'

Write-Host "OmniRoute Edge deploy staging"
Write-Host "Source: $Root"
Write-Host "Stage : $Stage"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force $Stage | Out-Null

$excludeDirs = @(
  'node_modules', 'dist', '.wrangler', '.git', '.serena',
  'checkpoints', 'deep-work-logs', 'env-work-logs', 'merge-logs',
  'scratch', 'data', 'verification'
)
$excludeFiles = @(
  '.env', 'sqlite.db', 'OmniRoute-provider-reference.sqlite.db',
  'sqlite.db-wal', 'sqlite.db-shm',
  'scratch_omniroute_raw.json', 'providers-and-keys.json'
)

$roboArgs = @($Root, $Stage, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
$roboArgs += '/XD'
foreach ($dir in $excludeDirs) { $roboArgs += (Join-Path $Root $dir) }
$roboArgs += '/XF'
foreach ($file in $excludeFiles) { $roboArgs += $file }

& robocopy @roboArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Set-Location $Stage

Write-Host '=== Installing locked dependencies in sanitized staging ==='
npm cache verify
npm ci

Write-Host '=== TypeScript ==='
npm run lint
Write-Host '=== Vitest ==='
npm test
Write-Host '=== Build ==='
npm run build
Write-Host '=== Dependency-free contracts ==='
npm run test:node
Write-Host '=== Static safety ==='
npm run verify:safety
Write-Host '=== Manifest ==='
npm run manifest
Write-Host '=== Deployment config ==='
npm run verify:deploy-config

Write-Host '=== Cloudflare deploy ==='
npx --yes wrangler@4.131.1 deploy
Write-Host 'DEPLOY COMPLETED.'
