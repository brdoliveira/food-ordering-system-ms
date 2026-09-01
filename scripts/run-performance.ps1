[CmdletBinding()]
param(
    [ValidateSet('smoke', 'load', 'stress')]
    [string]$Profile = 'smoke',
    [string]$ResultsDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $ResultsDirectory) {
    $ResultsDirectory = Join-Path $projectRoot 'performance/results'
}
$ResultsDirectory = [System.IO.Path]::GetFullPath($ResultsDirectory)
$runId = [Convert]::ToString([DateTimeOffset]::UtcNow.ToUnixTimeSeconds(), 16).PadLeft(8, '0')
$dockerNetwork = if ($env:K6_DOCKER_NETWORK) { $env:K6_DOCKER_NETWORK } else { 'food-ordering-system_food-ordering-system' }

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Preflight failed: $Name is required."
    }
}

function Require-HealthyService([string]$Service) {
    $containerId = docker ps --filter "label=com.docker.compose.service=$Service" --format '{{.ID}}' | Select-Object -First 1
    if (-not $containerId) {
        throw "Preflight failed: $Service is not running."
    }
    $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId
    if ($health -ne 'healthy') {
        throw "Preflight failed: $Service is $health, not healthy."
    }
}

Require-Command docker
docker info | Out-Null
docker network inspect $dockerNetwork | Out-Null

$minimumMemory = if ($Profile -eq 'stress') { 8GB } else { 4GB }
$minimumDisk = switch ($Profile) {
    'smoke' { 2GB }
    'load' { 5GB }
    'stress' { 10GB }
}
$dockerMemory = [Int64](docker info --format '{{.MemTotal}}')
$drive = (Get-Item $projectRoot).PSDrive
if ($dockerMemory -lt $minimumMemory) {
    throw "Preflight failed: Docker memory is below the minimum for $Profile."
}
if ($drive.Free -lt $minimumDisk) {
    throw "Preflight failed: free disk space is below the minimum for $Profile."
}

foreach ($service in 'keycloak', 'customer-service', 'order-service') {
    Require-HealthyService $service
}
foreach ($port in 8080, 8181, 8184) {
    if (-not (Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet)) {
        throw "Preflight failed: localhost port $port is unavailable."
    }
}
foreach ($variable in 'KEYCLOAK_CLIENT_SECRET', 'KEYCLOAK_TEST_PASSWORD', 'KEYCLOAK_TEST_USER') {
    if (-not [Environment]::GetEnvironmentVariable($variable)) {
        throw "Preflight failed: $variable must be set."
    }
}

$postgresContainerId = docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | Select-Object -First 1
if (-not $postgresContainerId) {
    throw 'Preflight failed: postgres is not running.'
}
$databaseUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'postgres' }
$creditEntries = [System.Collections.Generic.List[string]]::new()
$creditHistories = [System.Collections.Generic.List[string]]::new()
foreach ($virtualUser in 1..150) {
    $virtualUserHex = $virtualUser.ToString('x4')
    $customerId = "00000000-0000-4000-8000-$runId$virtualUserHex"
    $creditEntries.Add("('10000000-0000-4000-8000-$runId$virtualUserHex', '$customerId', 100000.00)")
    $creditHistories.Add("('20000000-0000-4000-8000-$runId$virtualUserHex', '$customerId', 100000.00, 'CREDIT')")
}
$seedSql = @"
INSERT INTO payment.credit_entry(id, customer_id, total_credit_amount)
VALUES $($creditEntries -join ",`n")
ON CONFLICT (id) DO UPDATE SET total_credit_amount = EXCLUDED.total_credit_amount;
INSERT INTO payment.credit_history(id, customer_id, amount, type)
VALUES $($creditHistories -join ",`n")
ON CONFLICT (id) DO NOTHING;
"@
$seedSql | docker exec -i $postgresContainerId psql -v ON_ERROR_STOP=1 -U $databaseUser
if ($LASTEXITCODE -ne 0) {
    throw 'Preflight failed: could not provision isolated payment credits.'
}

New-Item -ItemType Directory -Path $ResultsDirectory -Force | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$summary = "/results/$Profile-$timestamp-summary.json"
$report = "/results/$Profile-$timestamp-report.json"
$k6Directory = Join-Path $projectRoot 'performance/k6'

$arguments = @(
    'run', '--rm', '--network', $dockerNetwork,
    '--mount', "type=bind,source=$k6Directory,target=/scripts,readonly",
    '--mount', "type=bind,source=$ResultsDirectory,target=/results",
    '--env', "K6_PROFILE=$Profile",
    '--env', "K6_RUN_ID=$runId",
    '--env', 'KEYCLOAK_CLIENT_SECRET',
    '--env', 'KEYCLOAK_TEST_PASSWORD',
    '--env', 'KEYCLOAK_TEST_USER',
    '--env', 'KEYCLOAK_REALM',
    '--env', 'KEYCLOAK_CLIENT_ID',
    'grafana/k6:0.54.0', 'run', '/scripts/order-flow.js',
    '--summary-export', $summary,
    '--out', "json=$report"
)
& docker @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Performance artifacts saved in $ResultsDirectory."
