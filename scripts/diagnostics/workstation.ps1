$ErrorActionPreference = "Continue"

$results = [System.Collections.Generic.List[string]]::new()

function Add-Check {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    $results.Add("")
    $results.Add("=== $Name ===")

    try {
        $output = (& $Command 2>&1 | Out-String) -replace "`0", ""
        $outputLines = $output -split "\r?\n" |
            ForEach-Object { $_.TrimEnd() }
        $results.Add(($outputLines -join [Environment]::NewLine).Trim())
    }
    catch {
        $results.Add("ERROR: $($_.Exception.Message)")
    }
}

$results.Add("STOIC-IRIS Wave 0 Workstation Diagnostics")
$results.Add("Generated: $((Get-Date).ToString('o'))")

Add-Check "Git revision" {
    git rev-parse --verify HEAD
    git branch --show-current
    git status --short
}

Add-Check "Windows host" {
    Get-CimInstance Win32_ComputerSystem |
        Select-Object Manufacturer, Model, @{
            Name = "RAM_GB"
            Expression = {
                [math]::Round($_.TotalPhysicalMemory / 1GB, 2)
            }
        } |
        Format-List
}

Add-Check "Windows storage" {
    Get-Volume |
        Where-Object DriveLetter |
        Select-Object DriveLetter, FileSystem, @{
            Name = "Size_GB"
            Expression = { [math]::Round($_.Size / 1GB, 2) }
        }, @{
            Name = "Free_GB"
            Expression = {
                [math]::Round($_.SizeRemaining / 1GB, 2)
            }
        } |
        Format-Table -AutoSize
}

Add-Check "WSL status" {
    wsl --status
    wsl -l -v
}

Add-Check "Ubuntu release" {
    wsl -d Ubuntu -- cat /etc/os-release
}

Add-Check "Ubuntu resources" {
    wsl -d Ubuntu -- free -h
    wsl -d Ubuntu -- df -h /
    wsl -d Ubuntu -- lscpu
}

Add-Check "Ubuntu security status" {
    wsl -d Ubuntu -- pro security-status --format json
}

Add-Check "Development tools" {
    wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && node --version"
    wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && npm --version"
    wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && pnpm --version"
    wsl -d Ubuntu -- python3 --version
    wsl -d Ubuntu -- git --version
    code --version
}

Add-Check "Docker" {
    docker version
}

Add-Check "Windows GPU" {
    nvidia-smi
}

Add-Check "WSL GPU" {
    wsl -d Ubuntu -- nvidia-smi
}

Add-Check "Container GPU" {
    docker run --rm --gpus all `
        nvidia/cuda:12.9.1-base-ubuntu24.04 `
        nvidia-smi
}

Add-Check "Local model runtimes" {
    ollama --version
    ollama list
    lms --version
    cmd.exe /d /c "lms server status 2>&1"
}

Add-Check "Ollama structured-response test" {
    $schema = @{
        type = "object"
        properties = @{
            status = @{
                type = "string"
                enum = @("ready")
            }
            model = @{ type = "string" }
            gpu_vram_gb = @{ type = "integer" }
        }
        required = @("status", "model", "gpu_vram_gb")
        additionalProperties = $false
    }

    $body = @{
        model = "qwen3:8b"
        messages = @(
            @{
                role = "user"
                content = 'Return status "ready", model "qwen3:8b", and gpu_vram_gb 24.'
            }
        )
        stream = $false
        think = $false
        format = $schema
        options = @{ temperature = 0 }
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod `
        -Uri "http://localhost:11434/api/chat" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    $response.message.content
    $response.message.content | ConvertFrom-Json | Format-List
    ollama ps
}

$evidenceDirectory = Join-Path $PSScriptRoot "..\..\evidence\wave-0"
$evidenceDirectory = [IO.Path]::GetFullPath($evidenceDirectory)
$outputPath = Join-Path $evidenceDirectory "workstation-diagnostics.txt"

New-Item -ItemType Directory -Force $evidenceDirectory | Out-Null
$results | Set-Content -Encoding UTF8 $outputPath

Write-Host "Diagnostics saved to:"
Write-Host $outputPath
