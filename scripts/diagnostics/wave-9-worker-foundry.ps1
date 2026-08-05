$ErrorActionPreference = "Stop"
$containerName = "iris-wave9-native-worker-proof"
$externalContainerName = "iris-wave5-openclaw-proof"
$image = "node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43"
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) "iris-wave9-worker-proof"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (docker ps -a --filter "name=^/$externalContainerName$" --format "{{.Names}}") {
    throw "OpenClaw proof container must be absent before the IRIS-native worker runs."
}
if (Test-Path -LiteralPath $workspace) {
    Remove-Item -LiteralPath $workspace -Recurse -Force
}
New-Item -ItemType Directory -Path $workspace | Out-Null

try {
    $manifest = @{
        entries = @(
            @{ path = "wave-9/decision.json"; digest = "sha256:$('a' * 64)" }
            @{ path = "wave-9/worker-proposal.json"; digest = "sha256:$('b' * 64)" }
        )
    } | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText(
        (Join-Path $workspace "manifest.json"),
        $manifest,
        [System.Text.UTF8Encoding]::new($false)
    )
    $scriptPath = (Join-Path $repositoryRoot "scripts\workers\evidence-verifier.mjs")
    $output = docker run --rm --name $containerName `
        --network none --read-only --cap-drop ALL --security-opt no-new-privileges `
        --user 65532:65532 --cpus 1 --memory 128m --pids-limit 32 `
        --mount "type=bind,source=$workspace,target=/evidence,readonly" `
        --mount "type=bind,source=$scriptPath,target=/worker/evidence-verifier.mjs,readonly" `
        $image node /worker/evidence-verifier.mjs /evidence/manifest.json
    if ($LASTEXITCODE -ne 0) { throw "IRIS-native worker container failed." }
    $result = $output | ConvertFrom-Json
    if (-not $result.valid -or $result.checked -ne 2 -or $result.runtime -ne "iris-native") {
        throw "IRIS-native worker output failed validation."
    }
    [ordered]@{
        external_system = "absent"
        external_container = $externalContainerName
        native_worker = "worker_evidence-verifier"
        runtime = $result.runtime
        checked = $result.checked
        citations = $result.citations
        isolation = @("network-none", "read-only-root", "non-root", "cap-drop-all", "bounded-resources")
        result = "passed"
    } | ConvertTo-Json -Depth 5
}
finally {
    if (docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}") {
        docker rm -f $containerName | Out-Null
    }
    if (Test-Path -LiteralPath $workspace) {
        Remove-Item -LiteralPath $workspace -Recurse -Force
    }
}

$remaining = docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
if ($remaining) { throw "Wave 9 worker container cleanup was not verified." }
if (Test-Path -LiteralPath $workspace) { throw "Wave 9 workspace cleanup was not verified." }
Write-Output '{"cleanup_verified":true,"remaining_wave9_containers":0,"remaining_workspaces":0}'
