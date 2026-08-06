[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$composeFile = Join-Path $repositoryRoot "infrastructure\searxng\compose.yml"
$env:IRIS_SEARXNG_SECRET = "shutdown-only-placeholder"
try {
    docker compose --file $composeFile down
}
finally {
    Remove-Item Env:\IRIS_SEARXNG_SECRET -ErrorAction SilentlyContinue
}
