$ErrorActionPreference = "Stop"

$irisRepository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$projectsDirectory = Split-Path $irisRepository -Parent
$commandCenter = Join-Path $projectsDirectory "iris-founder-command-center"

if (-not (Test-Path -LiteralPath (Join-Path $commandCenter "scripts\local-gateway.mjs"))) {
    throw "The canonical Founder Command Center workspace was not found."
}

$wslCommand = @"
source "`$HOME/.nvm/nvm.sh"
cd /mnt/c/Projects/iris-founder-command-center
node scripts/local-gateway.mjs
"@

wsl -d Ubuntu -- bash -lc $wslCommand
