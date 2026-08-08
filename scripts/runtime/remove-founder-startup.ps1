param(
    [Parameter(Mandatory = $true)]
    [string]$IrisRepository,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$canonicalRoot = (Resolve-Path -LiteralPath $IrisRepository).Path
if (-not (Test-Path -LiteralPath (Join-Path $canonicalRoot ".git"))) {
    throw "IRIS_STARTUP_CANONICAL_REPOSITORY_REQUIRED"
}
$taskName = "STOIC-IRIS Founder Runtime"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($WhatIf) {
    [pscustomobject]@{ TaskName = $taskName; Exists = $null -ne $existing; Changed = $false } |
        ConvertTo-Json -Compress
    exit 0
}
if ($null -ne $existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
[pscustomobject]@{ TaskName = $taskName; Removed = $true } | ConvertTo-Json -Compress
