$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "start-iris-search.ps1")

$irisRepository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$projectsDirectory = Split-Path $irisRepository -Parent
$irisDirectoryName = Split-Path $irisRepository -Leaf
$worktreeSuffix = if ($irisDirectoryName.StartsWith("STOIC-IRIS")) {
    $irisDirectoryName.Substring("STOIC-IRIS".Length)
} else {
    ""
}
$commandCenterCandidates = @(
    (Join-Path $projectsDirectory "iris-founder-command-center$worktreeSuffix"),
    (Join-Path $projectsDirectory "iris-founder-command-center")
)
$commandCenter = $commandCenterCandidates |
    Where-Object { Test-Path -LiteralPath (Join-Path $_ "scripts\local-gateway.mjs") } |
    Select-Object -First 1

if (-not $commandCenter) {
    throw "The canonical Founder Command Center workspace was not found."
}

function Convert-ToWslPath([string]$Path) {
    # Windows PowerShell 5 can remove backslashes while forwarding a native
    # command argument through wsl.exe. Normalize to the Windows path form
    # accepted by wslpath before crossing that process boundary.
    $normalizedPath = $Path.Replace("\", "/")
    $converted = wsl -d Ubuntu -- wslpath -a -- $normalizedPath
    if ($LASTEXITCODE -ne 0 -or -not $converted) {
        throw "Unable to resolve the WSL path for $Path."
    }
    return $converted.Trim()
}

function Quote-Bash([string]$Value) {
    if ($Value.Contains("'")) {
        throw "A workspace path contains an unsupported single quote."
    }
    return "'$Value'"
}

$irisWslPath = Convert-ToWslPath $irisRepository
$commandCenterWslPath = Convert-ToWslPath $commandCenter
$wslCommand = 'source "$HOME/.nvm/nvm.sh"; export IRIS_ROOT=' +
    (Quote-Bash $irisWslPath) + '; cd ' +
    (Quote-Bash $commandCenterWslPath) +
    '; node scripts/local-gateway.mjs'

wsl -d Ubuntu -- bash -lc $wslCommand
