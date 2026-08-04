# One-click install WordWave + offline TTS engine to the Android phone
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-phone.ps1
$ErrorActionPreference = 'Continue'
$adb = 'C:\Users\Intel\Android\sdk\platform-tools\adb.exe'
$base = 'D:\英语\English-study\mobile'
$wordwaveApk = Join-Path $base 'WordWave-离线版.apk'
$cloneApk = Join-Path $base 'CloneTTS-离线语音引擎.apk'

# Find the phone (exclude emulators)
$serial = $null
$out = & $adb devices 2>$null | Out-String
foreach ($line in ($out -split "`r?`n")) {
  if ($line -match '^(\S+)\s+device') {
    $s = $Matches[1]
    if ($s -notlike 'emulator-*') { $serial = $s; break }
  }
}
if (-not $serial) {
  Write-Host '!! Phone not found. Enable USB debugging, plug in, and allow the prompt.'
  exit 1
}
Write-Host "Phone: $serial"

Write-Host 'Installing CloneTTS offline TTS engine...'
& $adb -s $serial install -r $cloneApk 2>&1 | Select-Object -Last 1

Write-Host 'Setting default TTS engine to CloneTTS...'
& $adb -s $serial shell 'pm list packages -3' 2>$null | Out-String | Select-String -Pattern 'clone' | ForEach-Object {
  $pkg = ($_ -split ':')[1].Trim()
  Write-Host "Engine package: $pkg"
  & $adb -s $serial shell "settings put secure tts_default_synth $pkg" | Out-Null
}

Write-Host 'Installing WordWave (offline build)...'
& $adb -s $serial install -r $wordwaveApk 2>&1 | Select-Object -Last 1

Write-Host 'Setting up USB backend tunnel (127.0.0.1:3101 -> PC)...'
& $adb -s $serial reverse tcp:3101 tcp:3101 | Out-Null

Write-Host 'Launching WordWave...'
& $adb -s $serial shell am start -n com.wordwave.wordwave/.MainActivity 2>&1 | Select-Object -First 1
Write-Host 'Done! Open the app and tap Study -> Play to test pronunciation.'
