$ErrorActionPreference = "Stop"

$irisRepository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$commandCenter = & (Join-Path $PSScriptRoot "resolve-founder-command-center.ps1") `
    -IrisRepository $irisRepository

& (Join-Path $PSScriptRoot "start-iris-search.ps1")

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

$irisWslPath = Convert-ToWslPath $irisRepository
$commandCenterWslPath = Convert-ToWslPath $commandCenter
$supervisorWslPath = "$irisWslPath/scripts/runtime/start-founder-command-center.sh"
$runtimeStateWindowsPath = Join-Path $env:LOCALAPPDATA "STOIC-IRIS\runtime\founder-runtime.json"
$runtimeStateWslPath = Convert-ToWslPath $runtimeStateWindowsPath

wsl -d Ubuntu -- env "IRIS_RUNTIME_STATE_PATH=$runtimeStateWslPath" bash $supervisorWslPath $irisWslPath $commandCenterWslPath
