[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$containerName = "iris-wave5-openclaw-proof"
$image = "ghcr.io/openclaw/openclaw@sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac"
$expectedDigest = "sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac"
$expectedRevision = "0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c"

if (docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}") {
    throw "The exact Wave 5 proof container already exists; refusing to replace it."
}

$imageDetails = docker image inspect $image | ConvertFrom-Json
if ($imageDetails.Count -ne 1) {
    throw "Expected exactly one pinned OpenClaw image."
}

$imageDigest = ($imageDetails[0].RepoDigests | Where-Object { $_ -like "*$expectedDigest" })
$imageRevision = $imageDetails[0].Config.Labels."org.opencontainers.image.revision"
$imageLicense = $imageDetails[0].Config.Labels."org.opencontainers.image.licenses"
$imageUser = $imageDetails[0].Config.User

if (-not $imageDigest -or $imageRevision -ne $expectedRevision -or $imageLicense -ne "MIT" -or $imageUser -ne "node") {
    throw "Pinned OpenClaw identity, license, revision, or non-root user did not match."
}

try {
    $containerId = docker run --detach `
        --name $containerName `
        --network none `
        --read-only `
        --cap-drop ALL `
        --security-opt no-new-privileges `
        --memory 512m `
        --cpus 1 `
        --pids-limit 128 `
        --tmpfs /tmp:rw,noexec,nosuid,size=64m `
        --tmpfs /home/node/.openclaw:rw,noexec,nosuid,size=64m `
        $image `
        sleep 30

    if (-not $containerId) {
        throw "Docker did not return a container identifier."
    }

    $runtime = docker inspect $containerName | ConvertFrom-Json
    $hostConfig = $runtime[0].HostConfig
    $mounts = @($runtime[0].Mounts)

    if ($hostConfig.NetworkMode -ne "none") { throw "Network isolation failed." }
    if (-not $hostConfig.ReadonlyRootfs) { throw "Read-only root enforcement failed." }
    if ($hostConfig.CapDrop -notcontains "ALL") { throw "Linux capability removal failed." }
    if ($hostConfig.SecurityOpt -notcontains "no-new-privileges") { throw "no-new-privileges enforcement failed." }
    if ($hostConfig.Memory -ne 536870912) { throw "Memory bound did not match 512 MiB." }
    if ($hostConfig.NanoCpus -ne 1000000000) { throw "CPU bound did not match one CPU." }
    if ($hostConfig.PidsLimit -ne 128) { throw "PID bound did not match 128." }
    if ($mounts.Count -ne 0) { throw "Unexpected host or volume mount detected." }

    $runtimeUid = docker exec $containerName id -u
    $cliVersion = docker exec $containerName node openclaw.mjs --version
    if ($runtimeUid -ne "1000") { throw "Runtime did not execute as UID 1000." }
    if (($cliVersion -join "`n") -notmatch "2026\.7\.1") { throw "OpenClaw CLI version proof failed." }

    [ordered]@{
        status = "passed"
        image_digest = $expectedDigest
        source_revision = $imageRevision
        license = $imageLicense
        runtime_user = $imageUser
        runtime_uid = 1000
        network = "none"
        read_only_root = $true
        capabilities = "dropped-all"
        no_new_privileges = $true
        memory_mib = 512
        cpus = 1
        pids_limit = 128
        host_mounts = 0
        repository_mounted = $false
        docker_socket_mounted = $false
        synthetic_state = "tmpfs-only"
    } | ConvertTo-Json
}
finally {
    if (docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}") {
        docker rm --force $containerName | Out-Null
    }
}

$remaining = docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
if ($remaining) {
    throw "Wave 5 proof container remains after cleanup."
}

Write-Output "Provider-authoritative cleanup: zero matching Wave 5 containers."
