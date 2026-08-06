[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$composeFile = Join-Path $repositoryRoot "infrastructure\searxng\compose.yml"
$secretBytes = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $random.GetBytes($secretBytes)
}
finally {
    $random.Dispose()
}
$env:IRIS_SEARXNG_SECRET = ([BitConverter]::ToString($secretBytes) -replace "-", "").ToLowerInvariant()
try {
    docker compose --file $composeFile up --detach --wait
}
finally {
    Remove-Item Env:\IRIS_SEARXNG_SECRET -ErrorAction SilentlyContinue
}

Write-Host "IRIS search is ready at http://127.0.0.1:8888"
