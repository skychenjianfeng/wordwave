# 在 Android 模拟器上运行集成测试并同步截图
$ErrorActionPreference = 'Continue'
$adb = 'C:\Users\Intel\Android\sdk\platform-tools\adb.exe'
$outDir = 'D:\英语\English-study\scripts\screenshots\mobile'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

& $adb logcat -c
& $adb shell am force-stop com.wordwave.wordwave 2>$null

$job = Start-Job -ScriptBlock {
  Set-Location 'C:\wordwave-mobile'
  $env:ANDROID_HOME = 'C:\Users\Intel\Android\sdk'
  $env:ANDROID_SDK_ROOT = 'C:\Users\Intel\Android\sdk'
  $env:PATH = 'C:\Users\Intel\flutter\flutter\bin;' + $env:PATH
  $env:JAVA_HOME = 'C:\Users\Intel\jdk17\jdk-17.0.20+8'
  $env:PATH = $env:JAVA_HOME + '\bin;' + $env:PATH
  flutter drive --driver=test_driver/integration_test.dart --target=integration_test/app_test.dart -d emulator-5554 *> 'D:\英语\English-study\tools\flutter-drive-final.log'
}

$seen = @{}
$deadline = (Get-Date).AddMinutes(10)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  $lines = & $adb logcat -d 2>$null | Out-String
  foreach ($m in [regex]::Matches($lines, 'SNAP ([0-9a-zA-Z_-]+)')) {
    $name = $m.Groups[1].Value
    if (-not $seen.ContainsKey($name)) {
      $seen[$name] = $true
      $file = Join-Path $outDir ($name + '.png')
      cmd /c "`"$adb`" exec-out screencap -p > `"$file`""
      Write-Output ("captured: " + $name)
    }
  }
  if ($seen.Count -ge 8) { break }
}

Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
& $adb shell am force-stop com.wordwave.wordwave 2>$null
Write-Output ("captured total: " + $seen.Count)
