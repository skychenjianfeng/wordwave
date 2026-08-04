$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $py 'backend\manage.py' runserver 8010 --noreload
