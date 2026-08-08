param(
    [Parameter(Mandatory = $true)]
    [string]$IrisRepository,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$canonicalRoot = (Resolve-Path -LiteralPath $IrisRepository).Path
$workflow = (Resolve-Path -LiteralPath (Join-Path $canonicalRoot "scripts\workflow\iris-workflow.mjs")).Path
$gitDirectory = Join-Path $canonicalRoot ".git"
if (-not (Test-Path -LiteralPath $gitDirectory)) { throw "IRIS_STARTUP_CANONICAL_REPOSITORY_REQUIRED" }

$taskName = "STOIC-IRIS Founder Runtime"
$node = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = "`"$workflow`" runtime start --core-root `"$canonicalRoot`" --json"
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $canonicalRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 12)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if ($WhatIf) {
    [pscustomobject]@{
        TaskName = $taskName
        Execute = $node
        Arguments = $arguments
        WorkingDirectory = $canonicalRoot
        Trigger = "Current user logon"
        RunLevel = "Limited"
        MultipleInstances = "IgnoreNew"
        Changed = $false
    } | ConvertTo-Json -Depth 5
    exit 0
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
[pscustomobject]@{ TaskName = $taskName; Installed = $true; Workflow = $workflow } | ConvertTo-Json -Compress
