[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$containerName = "iris-wave8-repository-cartographer"
$image = "node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$proofRoot = [IO.Path]::Combine($temporaryRoot, "iris-wave8-$([guid]::NewGuid().ToString('N'))")
$snapshot = Join-Path $proofRoot "snapshot"
$archive = Join-Path $proofRoot "baseline.tar"

function Invoke-Native {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE." }
}

try {
    New-Item -ItemType Directory -Path $snapshot -Force | Out-Null
    Invoke-Native git @("-C", $repositoryRoot, "archive", "origin/main", "--output", $archive)
    Invoke-Native tar @("-xf", $archive, "-C", $snapshot)
    $workerDirectory = Join-Path $snapshot "scripts\workers"
    New-Item -ItemType Directory -Path $workerDirectory -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "scripts\workers\repository-cartographer.mjs") -Destination $workerDirectory

    $expectedText = & node (Join-Path $repositoryRoot "scripts\workers\repository-cartographer.mjs") $snapshot
    if ($LASTEXITCODE -ne 0) { throw "Host deterministic inspection failed." }
    $expected = $expectedText | ConvertFrom-Json

    $existing = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($existing.Count -gt 0) { Invoke-Native docker @("rm", "-f", $containerName) | Out-Null }

    Invoke-Native docker @(
        "create", "--name", $containerName,
        "--network", "none",
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges:true",
        "--user", "1000:1000",
        "--memory", "256m",
        "--cpus", "1",
        "--pids-limit", "64",
        "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m",
        "--mount", "type=bind,source=$snapshot,target=/workspace,readonly",
        $image,
        "node", "/workspace/scripts/workers/repository-cartographer.mjs", "/workspace"
    ) | Out-Null

    $inspection = (& docker inspect $containerName | ConvertFrom-Json)[0]
    if ($inspection.HostConfig.NetworkMode -ne "none") { throw "Worker network is not disabled." }
    if (-not $inspection.HostConfig.ReadonlyRootfs) { throw "Worker root filesystem is not read-only." }
    if ($inspection.HostConfig.CapDrop -notcontains "ALL") { throw "Worker capabilities were not dropped." }
    if ($inspection.Mounts.Count -ne 1 -or $inspection.Mounts[0].RW) { throw "Worker snapshot mount is not uniquely read-only." }
    if (@($inspection.HostConfig.PortBindings.PSObject.Properties).Count -ne 0) { throw "Worker has published ports." }

    $actualText = & docker start --attach $containerName
    if ($LASTEXITCODE -ne 0) { throw "Repository Cartographer worker failed." }
    $actual = $actualText | ConvertFrom-Json
    foreach ($field in @("fileCount", "packageCount", "testCount", "sourceFileCount")) {
        if ($actual.$field -ne $expected.$field) { throw "Worker output mismatch for $field." }
    }
    if (($actual.citations | ConvertTo-Json -Compress) -ne ($expected.citations | ConvertTo-Json -Compress)) {
        throw "Worker citations did not match deterministic inspection."
    }

    [pscustomobject]@{
        Status = "passed"
        Worker = "Repository Cartographer"
        Image = $image
        Snapshot = "disposable-read-only"
        Network = "none"
        Secrets = 0
        PublishedPorts = 0
        GitAuthority = $false
        DelegationAuthority = $false
        OutputMatchesDeterministicInspection = $true
        FileCount = $actual.fileCount
        PackageCount = $actual.packageCount
        TestCount = $actual.testCount
    } | ConvertTo-Json
}
finally {
    $existing = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($existing.Count -gt 0) { & docker rm -f $containerName | Out-Null }
    $resolvedProofRoot = [IO.Path]::GetFullPath($proofRoot)
    if (-not $resolvedProofRoot.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a proof workspace outside the temporary root."
    }
    if (Test-Path -LiteralPath $resolvedProofRoot) { Remove-Item -LiteralPath $resolvedProofRoot -Recurse -Force }
    $remaining = @(& docker ps -a --filter "name=^/$containerName$" --format "{{.ID}}")
    if ($remaining.Count -ne 0) { throw "Worker container cleanup failed." }
    if (Test-Path -LiteralPath $resolvedProofRoot) { throw "Worker workspace cleanup failed." }
}
