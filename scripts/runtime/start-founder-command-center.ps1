$ErrorActionPreference = "Stop"

$irisRepository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$commandCenter = & (Join-Path $PSScriptRoot "resolve-founder-command-center.ps1") `
    -IrisRepository $irisRepository

& (Join-Path $PSScriptRoot "start-iris-search.ps1")

function Invoke-HostRuntimeBuild([string]$Root) {
    $nodeDirectory = Join-Path $env:ProgramFiles "nodejs"
    $corepack = Join-Path $nodeDirectory "corepack.cmd"
    if (-not (Test-Path -LiteralPath $corepack)) {
        throw "The pinned Windows Corepack launcher is unavailable: $corepack"
    }
    $originalPath = $env:Path
    $locationPushed = $false
    try {
        # Package scripts can invoke pnpm again. Pin the child PATH as well as
        # the initial Corepack executable so nested commands cannot fall back
        # to an older per-user Node installation.
        $env:Path = "$nodeDirectory;$originalPath"
        $shimDirectory = Join-Path $env:LOCALAPPDATA "STOIC-IRIS\runtime\pinned-node-bin"
        $shimPath = Join-Path $shimDirectory "pnpm.cmd"
        New-Item -ItemType Directory -Path $shimDirectory -Force | Out-Null
        [System.IO.File]::WriteAllText(
            $shimPath,
            "@call `"$corepack`" pnpm %*`r`n",
            [System.Text.Encoding]::ASCII
        )
        $env:Path = "$shimDirectory;$env:Path"
        Push-Location $Root
        $locationPushed = $true
        & $corepack pnpm build
        if ($LASTEXITCODE -ne 0) {
            throw "Runtime build failed for $Root."
        }
    }
    finally {
        if ($locationPushed) {
            Pop-Location
        }
        $env:Path = $originalPath
    }
}

# The repositories live on NTFS and their dependency graph is materialized by
# Windows pnpm. Rebuilding those same node_modules from WSL can replace Windows
# links and native packages with Linux variants. Build on the owning host, then
# let WSL supervise only the loopback runtime processes.
Invoke-HostRuntimeBuild $irisRepository
Invoke-HostRuntimeBuild $commandCenter

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

wsl -d Ubuntu -- env "IRIS_RUNTIME_STATE_PATH=$runtimeStateWslPath" "IRIS_RUNTIME_PREBUILT=1" bash $supervisorWslPath $irisWslPath $commandCenterWslPath
