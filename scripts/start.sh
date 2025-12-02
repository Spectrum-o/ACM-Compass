#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log() {
  echo "[acm-compass] $*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command_exists sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

PYTHON_TARGET_VERSION="3.13.1"
PYTHON_BIN="${PYTHON:-}"
UV_PYTHON_SPEC="${PYTHON:-3.13}"
UV_INSTALL_URL="https://astral.sh/uv/install.sh"

ensure_uv() {
  if command_exists uv; then
    return 0
  fi

  log "uv not found; attempting installation..."

  # Prefer pip install (user scope)
  local py_for_pip=""
  for candidate in "${PYTHON:-}" python3 python; do
    [[ -z "$candidate" ]] && continue
    if command_exists "$candidate"; then
      py_for_pip="$candidate"
      break
    fi
  done

  if [[ -n "$py_for_pip" ]]; then
    log "Trying to install uv via pip (user)..."
    if "$py_for_pip" -m pip install --user -U uv; then
      export PATH="$HOME/.local/bin:$PATH"
      if command_exists uv; then
        log "uv installed at $(command -v uv)"
        return 0
      fi
    else
      log "uv install via pip failed."
    fi
  else
    log "No Python interpreter found for pip install of uv."
  fi

  # Fallback to official installer script
  if command_exists curl; then
    if curl -Ls "$UV_INSTALL_URL" | sh; then
      :
    else
      log "uv install via curl failed."
    fi
  elif command_exists wget; then
    if wget -qO- "$UV_INSTALL_URL" | sh; then
      :
    else
      log "uv install via wget failed."
    fi
  else
    log "Neither curl nor wget is available to install uv."
    return 1
  fi

  export PATH="$HOME/.local/bin:$PATH"
  if command_exists uv; then
    log "uv installed at $(command -v uv)"
    return 0
  fi

  log "uv installation failed."
  return 1
}

install_python_with_pyenv() {
  if ! command_exists pyenv; then
    return 1
  fi

  log "Installing Python ${PYTHON_TARGET_VERSION} via pyenv..."
  if ! pyenv versions --bare | grep -Fx "${PYTHON_TARGET_VERSION}" >/dev/null 2>&1; then
    pyenv install "${PYTHON_TARGET_VERSION}" || return 1
  fi

  export PYENV_VERSION="${PYTHON_TARGET_VERSION}"
  PYTHON_BIN="$(pyenv which python 2>/dev/null)" || return 1
  return 0
}

install_python_with_apt() {
  if ! command_exists apt-get; then
    return 1
  fi

  log "Attempting to install python3.13 via apt..."
  if run_as_root apt-get update &&
     run_as_root apt-get install -y python3.13 python3.13-venv; then
    PYTHON_BIN="python3.13"
    return 0
  fi

  if command_exists add-apt-repository; then
    log "Trying deadsnakes PPA for python3.13..."
    if run_as_root add-apt-repository -y ppa:deadsnakes/ppa &&
       run_as_root apt-get update &&
       run_as_root apt-get install -y python3.13 python3.13-venv; then
      PYTHON_BIN="python3.13"
      return 0
    fi
  fi

  log "apt installation failed."
  return 1
}

install_python_with_brew() {
  if ! command_exists brew; then
    return 1
  fi

  log "Installing python@3.13 via Homebrew..."
  if brew install python@3.13; then
    PYTHON_BIN="$(brew --prefix python@3.13)/bin/python3.13"
    return 0
  fi

  return 1
}

ensure_uv

if command_exists uv; then
  log "Using uv to install dependencies (Python ${UV_PYTHON_SPEC})..."
  uv sync --python "${UV_PYTHON_SPEC}" || uv sync
  log "Starting server with uv run (http://127.0.0.1:7860/)..."
  exec uv run --python "${UV_PYTHON_SPEC}" python server.py
fi

ensure_python() {
  if [[ -z "$PYTHON_BIN" ]]; then
    if command_exists python3.13; then
      PYTHON_BIN="python3.13"
    elif command_exists python3; then
      PYTHON_BIN="python3"
    elif command_exists python; then
      PYTHON_BIN="python"
    fi
  fi

  if [[ -z "$PYTHON_BIN" ]] || ! command_exists "$PYTHON_BIN"; then
    log "Python 3.13+ not found; attempting automatic installation..."
    install_python_with_pyenv || install_python_with_apt || install_python_with_brew || {
      log "Automatic installation failed. Please install Python 3.13+ manually and re-run."
      exit 1
    }
  fi

  PY_VERSION="$("$PYTHON_BIN" - <<'PY'
import sys
print(".".join(map(str, sys.version_info[:3])))
PY
  )"
  if "$PYTHON_BIN" - <<'PY'
import sys
sys.exit(0 if sys.version_info >= (3, 13) else 1)
PY
  then
    return
  fi

  log "Detected Python ${PY_VERSION:-unknown}, but 3.13+ is required. Installing..."
  install_python_with_pyenv || install_python_with_apt || install_python_with_brew || {
    log "Automatic installation failed. Please install Python 3.13+ manually and re-run."
    exit 1
  }
}

ensure_python

PY_VERSION="$("$PYTHON_BIN" - <<'PY'
import sys
print(".".join(map(str, sys.version_info[:3])))
PY
)"

log "uv not found; falling back to venv + pip."
if [[ ! -d ".venv" ]]; then
  log "Creating virtual environment at .venv"
  "$PYTHON_BIN" -m venv .venv
fi

# shellcheck disable=SC1091
. ".venv/bin/activate"

log "Installing dependencies with pip..."
pip install -r requirements.txt

log "Starting server from virtual environment (http://127.0.0.1:7860/)..."
exec python server.py
