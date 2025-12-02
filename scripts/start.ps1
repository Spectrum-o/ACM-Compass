$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$uvInstallScript = "https://astral.sh/uv/install.ps1"
$uvPythonSpec = if ($env:PYTHON) { $env:PYTHON } else { "3.13" }

function Write-Log {
    param([string] $Message)
    Write-Host "[acm-compass] $Message"
}

function Invoke-Python {
    param(
        [string[]] $PythonCmd,
        [string[]] $Args
    )

    $prefix = @()
    if ($PythonCmd.Count -gt 1) {
        $prefix = $PythonCmd[1..($PythonCmd.Count - 1)]
    }

    & $PythonCmd[0] @prefix @Args
}

function Add-PathIfMissing {
    param([string] $PathToAdd)
    if ([string]::IsNullOrWhiteSpace($PathToAdd)) { return }
    if (-not (Test-Path $PathToAdd)) { return }
    $separator = [System.IO.Path]::PathSeparator
    if (-not ($env:PATH -split [regex]::Escape($separator) | Where-Object { $_ -eq $PathToAdd })) {
        $env:PATH = "$PathToAdd$separator$env:PATH"
    }
}

function Get-PythonCommand {
    if ($env:PYTHON -and (Get-Command $env:PYTHON -ErrorAction SilentlyContinue)) {
        $cmd = @($env:PYTHON)
        $version = Invoke-Python -PythonCmd $cmd -Args @("-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))") 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @{ Command = $cmd; Version = $version }
        }
    }

    $candidates = @(
        @("py", "-3.13"),
        @("py", "-3"),
        @("python3"),
        @("python")
    )

    foreach ($candidate in $candidates) {
        if (-not (Get-Command $candidate[0] -ErrorAction SilentlyContinue)) {
            continue
        }

        $version = Invoke-Python -PythonCmd $candidate -Args @("-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))") 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @{ Command = $candidate; Version = $version }
        }
    }

    return $null
}

function Add-UserScriptsToPath {
    param([string[]] $PythonCmd)
    if (-not $PythonCmd) { return }
    $userScripts = Invoke-Python -PythonCmd $PythonCmd -Args @("-c", "import site, os; print(os.path.join(site.USER_BASE, 'Scripts'))") 2>$null
    if ($LASTEXITCODE -eq 0 -and $userScripts) {
        Add-PathIfMissing $userScripts
    }
}

function Ensure-Uv {
    param([string[]] $PythonCmd)

    if (Get-Command uv -ErrorAction SilentlyContinue) {
        return $true
    }

    if ($PythonCmd) {
        Write-Log "Trying to install uv via pip (user)..."
        Invoke-Python -PythonCmd $PythonCmd -Args @("-m", "pip", "install", "--user", "-U", "uv")
        if ($LASTEXITCODE -eq 0) {
            Add-UserScriptsToPath -PythonCmd $PythonCmd
            Add-PathIfMissing "$HOME/.local/bin"
            $uvCmd = Get-Command uv -ErrorAction SilentlyContinue
            if ($uvCmd) {
                Write-Log "uv installed via pip at $($uvCmd.Source)"
                return $true
            }
        } else {
            Write-Log "uv install via pip failed."
        }
    }

    Write-Log "Trying to install uv via official script..."
    try {
        Invoke-Expression (Invoke-RestMethod $uvInstallScript)
    } catch {
        Write-Log "uv install via official script failed: $($_.Exception.Message)"
    }

    Add-PathIfMissing "$HOME/.local/bin"
    $uvCmd2 = Get-Command uv -ErrorAction SilentlyContinue
    if ($uvCmd2) {
        Write-Log "uv installed at $($uvCmd2.Source)"
        return $true
    }

    Write-Log "uv installation failed."
    return $false
}

$pythonInfo = Get-PythonCommand
$pythonCmd = if ($pythonInfo) { $pythonInfo.Command } else { $null }

if (-not (Ensure-Uv -PythonCmd $pythonCmd)) {
    if (-not $pythonInfo) {
        Write-Error "Python 3.13+ is required but no interpreter was found, and uv installation failed."
        exit 1
    }
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Log "Using uv to install dependencies..."
    uv sync --python "$uvPythonSpec"
    Write-Log "Starting server with uv run (http://127.0.0.1:7860/)..."
    uv run --python "$uvPythonSpec" python server.py
    exit $LASTEXITCODE
}

if (-not $pythonInfo) {
    Write-Error "Python 3.13+ is required but no interpreter was found."
    exit 1
}

$pythonCmd = $pythonInfo.Command
$pythonVersion = $pythonInfo.Version

Invoke-Python -PythonCmd $pythonCmd -Args @("-c", "import sys; sys.exit(0 if sys.version_info >= (3, 13) else 1)")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python 3.13+ is required (found $pythonVersion)."
    exit 1
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Log "Using uv to install dependencies..."
    uv sync
    Write-Log "Starting server with uv run (http://127.0.0.1:7860/)..."
    uv run python server.py
    exit $LASTEXITCODE
}

$venvPath = Join-Path $projectRoot ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Log "Creating virtual environment at $venvPath"
    Invoke-Python -PythonCmd $pythonCmd -Args @("-m", "venv", $venvPath)
}

$env:VIRTUAL_ENV = $venvPath
$env:PATH = (Join-Path $venvPath "Scripts") + [System.IO.Path]::PathSeparator + $env:PATH

Write-Log "Installing dependencies with pip..."
pip install -r requirements.txt

Write-Log "Starting server from virtual environment (http://127.0.0.1:7860/)..."
python server.py
exit $LASTEXITCODE
