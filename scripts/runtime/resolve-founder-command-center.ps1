param(
    [Parameter(Mandatory = $true)]
    [string]$IrisRepository
)

$ErrorActionPreference = "Stop"

$resolvedIrisRepository = (Resolve-Path -LiteralPath $IrisRepository).Path
$projectsDirectory = Split-Path $resolvedIrisRepository -Parent
$irisDirectoryName = Split-Path $resolvedIrisRepository -Leaf
$worktreeSuffix = if ($irisDirectoryName.StartsWith("STOIC-IRIS")) {
    $irisDirectoryName.Substring("STOIC-IRIS".Length)
} else {
    ""
}

$commandCenterCandidates = @(
    if ($env:IRIS_COMMAND_CENTER_ROOT) {
        $env:IRIS_COMMAND_CENTER_ROOT
    }
    if ($worktreeSuffix) {
        Join-Path $projectsDirectory "iris-founder-command-center$worktreeSuffix"
    }
    Join-Path $projectsDirectory "iris-founder-command-center-main"
    Join-Path $projectsDirectory "iris-founder-command-center"
) | Select-Object -Unique

$commandCenter = $commandCenterCandidates |
    Where-Object { Test-Path -LiteralPath (Join-Path $_ "scripts\local-gateway.mjs") } |
    Select-Object -First 1

if (-not $commandCenter) {
    throw "The canonical Founder Command Center workspace was not found."
}

(Resolve-Path -LiteralPath $commandCenter).Path
