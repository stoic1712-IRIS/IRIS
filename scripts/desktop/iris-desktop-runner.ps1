$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Deny([string]$Code) {
    throw $Code
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw) -or [Text.Encoding]::UTF8.GetByteCount($raw) -gt 65536) {
    Deny "DESKTOP_CONTROL_REQUEST_INVALID"
}

try { $request = $raw | ConvertFrom-Json -Depth 12 } catch { Deny "DESKTOP_CONTROL_REQUEST_INVALID" }
if ($null -eq $request.target.processId -or $request.target.processId -notmatch '^\d+$') {
    Deny "DESKTOP_CONTROL_PROCESS_BINDING_REQUIRED"
}

$sensitive = '(?i)(credential|password|passkey|secret|token|wallet|payment|billing|checkout|account\s+admin|administrator|user\s+account\s+control|windows\s+security|certificate|private\s+key)'
if ([string]$request.target.windowTitle -match $sensitive -or [string]$request.target.applicationId -match $sensitive) {
    Deny "DESKTOP_CONTROL_SENSITIVE_WINDOW_DENIED"
}

$process = Get-Process -Id ([int]$request.target.processId) -ErrorAction Stop
if ($process.MainWindowHandle -eq [IntPtr]::Zero -or $process.MainWindowTitle -cne [string]$request.target.windowTitle) {
    Deny "DESKTOP_CONTROL_TARGET_BINDING_INVALID"
}
if ($process.ProcessName -cne [string]$request.target.applicationId) {
    Deny "DESKTOP_CONTROL_APPLICATION_BINDING_INVALID"
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class IrisNativeWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

function Focus-Target {
    if (-not [IrisNativeWindow]::SetForegroundWindow($process.MainWindowHandle)) {
        Deny "DESKTOP_CONTROL_FOCUS_FAILED"
    }
}

function Find-Element([string]$AutomationId) {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
    if ($null -eq $root) { Deny "DESKTOP_CONTROL_AUTOMATION_ROOT_UNAVAILABLE" }
    $condition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        $AutomationId
    )
    $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($null -eq $element) { Deny "DESKTOP_CONTROL_ELEMENT_NOT_FOUND" }
    return $element
}

if ([string]$request.operation -eq 'recover') {
    Focus-Target
    @{ recoveredAt = [DateTime]::UtcNow.ToString('o'); result = 'recovered' } |
        ConvertTo-Json -Compress
    exit 0
}
if ([string]$request.operation -cne 'perform') { Deny "DESKTOP_CONTROL_OPERATION_INVALID" }

switch ([string]$request.action.kind) {
    'focus-window' { Focus-Target }
    'invoke' {
        $element = Find-Element ([string]$request.action.automationId)
        $pattern = $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        if ($null -eq $pattern) { Deny "DESKTOP_CONTROL_PATTERN_UNAVAILABLE" }
        ([System.Windows.Automation.InvokePattern]$pattern).Invoke()
    }
    'set-text' {
        $element = Find-Element ([string]$request.action.automationId)
        if ($element.Current.IsPassword) { Deny "DESKTOP_CONTROL_SECRET_FIELD_DENIED" }
        $pattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        if ($null -eq $pattern) { Deny "DESKTOP_CONTROL_PATTERN_UNAVAILABLE" }
        ([System.Windows.Automation.ValuePattern]$pattern).SetValue([string]$request.action.text)
    }
    'select-option' {
        $element = Find-Element ([string]$request.action.automationId)
        $nameCondition = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NameProperty,
            [string]$request.action.option
        )
        $option = $element.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nameCondition)
        if ($null -eq $option) { Deny "DESKTOP_CONTROL_OPTION_NOT_FOUND" }
        $pattern = $option.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        if ($null -eq $pattern) { Deny "DESKTOP_CONTROL_PATTERN_UNAVAILABLE" }
        ([System.Windows.Automation.SelectionItemPattern]$pattern).Select()
    }
    'keypress' {
        Focus-Target
        $keys = @{
            Enter = '{ENTER}'; Escape = '{ESC}'; Tab = '{TAB}'; ArrowUp = '{UP}';
            ArrowDown = '{DOWN}'; ArrowLeft = '{LEFT}'; ArrowRight = '{RIGHT}'
        }
        $key = $keys[[string]$request.action.key]
        if ($null -eq $key) { Deny "DESKTOP_CONTROL_KEY_DENIED" }
        [System.Windows.Forms.SendKeys]::SendWait($key)
    }
    default { Deny "DESKTOP_CONTROL_ACTION_INVALID" }
}

@{ completedAt = [DateTime]::UtcNow.ToString('o'); result = 'completed' } |
    ConvertTo-Json -Compress
