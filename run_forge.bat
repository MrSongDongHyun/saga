@echo off
cd /d "%~dp0stable-diffusion-webui-forge"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
venv\Scripts\python.exe -u launch.py --xformers --skip-python-version-check --api > "%~dp0forge_log.txt" 2>&1
echo Exit code: %errorlevel% >> "%~dp0forge_log.txt"
