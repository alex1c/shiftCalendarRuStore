#Requires -Version 5.1
<#
.SYNOPSIS
  ForestMusic Android Device QA launcher for Expo / React Native (USB + Metro 8081).

.DESCRIPTION
  Automates the standard device QA playbook without destructive actions.
  Copy this script to other ForestMusic RN/Expo apps and edit only $Config.

.EXAMPLE
  .\scripts\android-device-qa.ps1
  .\scripts\android-device-qa.ps1 -AppMetricaLog
  .\scripts\android-device-qa.ps1 -ClearMetroCache
  .\scripts\android-device-qa.ps1 -DeviceSerial <serial>
  .\scripts\android-device-qa.ps1 -DryRun
#>
[CmdletBinding()]
param(
	[string]$DeviceSerial = '',
	[switch]$ClearMetroCache,
	[switch]$Logcat,
	[switch]$AppMetricaLog,
	[switch]$DryRun,
	[switch]$SkipGitPullPrompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# CONFIG - edit only this block when copying to another ForestMusic project
# ---------------------------------------------------------------------------
$Config = @{
	Package   = 'com.calculatorplatform.shiftcalendar'
	# Expo slug used in exp+<slug>:// development-client deep links
	Scheme    = 'shift-calendar'
	MetroPort = 8081
	ApkPath   = 'android\app\build\outputs\apk\debug\app-debug.apk'
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Pass ([string]$Message) { Write-Host "[PASS] $Message" }
function Write-Warn ([string]$Message) { Write-Host "[WARN] $Message" }
function Write-Fail ([string]$Message) { Write-Host "[FAIL] $Message" }
function Write-Info ([string]$Message) { Write-Host "[INFO] $Message" }
function Write-Plan ([string]$Message) { Write-Host "[PLAN] $Message" }

function Stop-Qa ([string]$Message) {
	Write-Fail $Message
	exit 1
}

function Get-ProjectRoot {
	# scripts/ -> project root
	return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-AdbArgs {
	param([string]$Serial)
	if ([string]::IsNullOrWhiteSpace($Serial)) { return @() }
	return @('-s', $Serial)
}

function Invoke-Adb {
	param(
		[Parameter(Mandatory)][string[]]$AdbArgs,
		[string]$Serial = ''
	)
	$prefix = Get-AdbArgs -Serial $Serial
	& adb @prefix @AdbArgs
}

function Test-TcpLocalhostPort {
	param([Parameter(Mandatory)][int]$Port, [int]$TimeoutMs = 1000)
	try {
		$client = New-Object System.Net.Sockets.TcpClient
		$iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
		$ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
		if (-not $ok) {
			$client.Close()
			return $false
		}
		$client.EndConnect($iar)
		$client.Close()
		return $true
	} catch {
		return $false
	}
}

function Get-ListenersOnPort {
	param([Parameter(Mandatory)][int]$Port)
	try {
		return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
	} catch {
		return @()
	}
}

function Read-ExpectedVersions {
	param([Parameter(Mandatory)][string]$Root)
	$appJsonPath = Join-Path $Root 'app.json'
	$gradlePath = Join-Path $Root 'android\app\build.gradle'
	if (-not (Test-Path $appJsonPath)) { Stop-Qa "Missing app.json at $appJsonPath" }
	if (-not (Test-Path $gradlePath)) { Stop-Qa "Missing android/app/build.gradle at $gradlePath" }

	$app = Get-Content -Raw -Path $appJsonPath | ConvertFrom-Json
	$expoVersion = [string]$app.expo.version
	$expoCode = [int]$app.expo.android.versionCode

	$gradle = Get-Content -Raw -Path $gradlePath
	if ($gradle -notmatch 'versionName\s+"([^"]+)"') {
		Stop-Qa 'android/app/build.gradle is missing versionName'
	}
	$gradleName = $Matches[1]
	if ($gradle -notmatch 'versionCode\s+(\d+)') {
		Stop-Qa 'android/app/build.gradle is missing versionCode'
	}
	$gradleCode = [int]$Matches[1]

	return [pscustomobject]@{
		ExpoVersionName = $expoVersion
		ExpoVersionCode = $expoCode
		GradleVersionName = $gradleName
		GradleVersionCode = $gradleCode
	}
}

function Get-DeviceRows {
	$raw = & adb devices -l 2>&1 | Out-String
	$rows = @()
	foreach ($line in ($raw -split "`r?`n")) {
		if ($line -match '^\s*$' -or $line -match '^List of devices') { continue }
		if ($line -match '^(\S+)\s+(\S+)(.*)$') {
			$serial = $Matches[1]
			$status = $Matches[2]
			$rest = $Matches[3]
			$model = ''
			if ($rest -match 'model:(\S+)') { $model = $Matches[1] }
			$rows += [pscustomobject]@{
				Serial = $serial
				Status = $status
				Model = $model
				Raw = $line.Trim()
			}
		}
	}
	return $rows
}

function Resolve-DeviceSerial {
	param([string]$RequestedSerial)
	$rows = @(Get-DeviceRows)
	if ($rows.Count -eq 0) {
		if ($DryRun) {
			Write-Warn 'Android device not found (dry-run continues with placeholder serial).'
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'none'; Model = 'none'; Raw = '' }
		}
		Stop-Qa 'Android device not found. Connect phone / enable USB debugging.'
	}

	$unauthorized = @($rows | Where-Object { $_.Status -eq 'unauthorized' })
	if ($unauthorized.Count -gt 0 -and -not $RequestedSerial) {
		Write-Fail 'Device unauthorized. Unlock the phone and accept the USB debugging prompt.'
		$unauthorized | ForEach-Object { Write-Host "  $($_.Raw)" }
		if ($DryRun) {
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'unauthorized'; Model = 'none'; Raw = '' }
		}
		exit 1
	}

	$ready = @($rows | Where-Object { $_.Status -eq 'device' })
	if ($ready.Count -eq 0) {
		Write-Fail 'No device with status=device.'
		$rows | ForEach-Object { Write-Host "  $($_.Raw)" }
		if ($DryRun) {
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'none'; Model = 'none'; Raw = '' }
		}
		exit 1
	}

	if (-not [string]::IsNullOrWhiteSpace($RequestedSerial)) {
		$match = @($ready | Where-Object { $_.Serial -eq $RequestedSerial })
		if ($match.Count -eq 0) {
			Write-Fail "Requested serial '$RequestedSerial' not found among ready devices."
			$ready | ForEach-Object { Write-Host "  $($_.Raw)" }
			if ($DryRun) {
				return [pscustomobject]@{ Serial = $RequestedSerial; Status = 'missing'; Model = 'none'; Raw = '' }
			}
			exit 1
		}
		return $match[0]
	}

	if ($ready.Count -eq 1) {
		return $ready[0]
	}

	Write-Warn 'Multiple Android devices connected. Choose one:'
	for ($i = 0; $i -lt $ready.Count; $i++) {
		$d = $ready[$i]
		Write-Host ("  [{0}] {1}  model={2}" -f ($i + 1), $d.Serial, $d.Model)
	}
	if ($DryRun) {
		Write-Plan "Would prompt for device selection; using first device $($ready[0].Serial) for dry-run only"
		return $ready[0]
	}
	$choice = Read-Host 'Enter number or serial'
	if ($choice -match '^\d+$') {
		$idx = [int]$choice - 1
		if ($idx -lt 0 -or $idx -ge $ready.Count) { Stop-Qa 'Invalid device selection.' }
		return $ready[$idx]
	}
	$picked = @($ready | Where-Object { $_.Serial -eq $choice })
	if ($picked.Count -eq 0) { Stop-Qa "Unknown serial '$choice'." }
	return $picked[0]
}

function Ensure-LocalProperties {
	param(
		[Parameter(Mandatory)][string]$Root,
		[Parameter(Mandatory)][string]$SdkPath
	)
	$androidDir = Join-Path $Root 'android'
	$propsPath = Join-Path $androidDir 'local.properties'
	# Gradle on Windows expects escaped backslashes in sdk.dir
	$escaped = $SdkPath.Replace('\', '\\')
	$desired = "sdk.dir=$escaped"

	if (-not (Test-Path $androidDir)) {
		Stop-Qa "Missing android/ folder at $androidDir"
	}

	if (-not (Test-Path $propsPath)) {
		if ($DryRun) {
			Write-Plan "Would create android/local.properties with sdk.dir=$SdkPath"
			return
		}
		Set-Content -Path $propsPath -Value $desired -Encoding ASCII
		Write-Pass "Created android/local.properties (local-only, not for Git)"
		return
	}

	$content = Get-Content -Raw -Path $propsPath
	if ($content -match 'sdk\.dir\s*=\s*(.+)') {
		$current = $Matches[1].Trim()
		$normalizedCurrent = ($current -replace '\\\\', '\' -replace '/', '\')
		$normalizedSdk = $SdkPath
		if ($normalizedCurrent -ieq $normalizedSdk) {
			Write-Pass "android/local.properties sdk.dir OK"
		} else {
			Write-Warn "android/local.properties sdk.dir differs from default SDK"
			Write-Host "  file: $current"
			Write-Host "  expected: $SdkPath"
			Write-Info 'Leaving existing local.properties unchanged.'
		}
	} else {
		Write-Warn 'android/local.properties has no sdk.dir line; leaving file unchanged.'
	}
}

function Ensure-MetroPortFree {
	param([Parameter(Mandatory)][int]$Port)
	foreach ($probe in @(8081, 8082, 8083)) {
		$listeners = @(Get-ListenersOnPort -Port $probe)
		if ($listeners.Count -eq 0) {
			Write-Info "Port $probe is free"
			continue
		}
		foreach ($l in $listeners) {
			$proc = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
			$name = if ($proc) { $proc.ProcessName } else { '?' }
			$path = ''
			try {
				if ($proc -and $proc.Path) { $path = $proc.Path }
			} catch { }
			Write-Warn ("Port {0} occupied by PID {1} ({2}) {3}" -f $probe, $l.OwningProcess, $name, $path)
		}
	}

	$blocked = @(Get-ListenersOnPort -Port $Port)
	if ($blocked.Count -eq 0) {
		Write-Pass "Metro port $Port is free"
		return
	}

	$pidOwner = $blocked[0].OwningProcess
	$proc = Get-Process -Id $pidOwner -ErrorAction SilentlyContinue
	$procName = if ($proc) { $proc.ProcessName } else { 'unknown' }
	$procPath = ''
	try { if ($proc -and $proc.Path) { $procPath = $proc.Path } } catch { }

	Write-Warn "Port $Port is occupied by $procName PID $pidOwner $procPath"
	Write-Info 'Policy: ONE PROJECT = ONE METRO = 8081 (never auto-switch to 8082/8083).'

	if ($DryRun) {
		Write-Plan "Would ask to stop PID $pidOwner occupying port $Port"
		return
	}

	$answer = Read-Host "Port $Port is occupied by $procName PID $pidOwner. Stop it? [Y/N]"
	if ($answer -notmatch '^[Yy]') {
		Stop-Qa "Port $Port still occupied. Free it manually, then re-run."
	}
	Stop-Process -Id $pidOwner -Force
	Start-Sleep -Seconds 1
	$still = @(Get-ListenersOnPort -Port $Port)
	if ($still.Count -gt 0) {
		Stop-Qa "Failed to free port $Port (still listening)."
	}
	Write-Pass "Stopped PID $pidOwner; port $Port is free"
}

function Wait-MetroReady {
	param([Parameter(Mandatory)][int]$Port, [int]$TimeoutSec = 30)
	$deadline = (Get-Date).AddSeconds($TimeoutSec)
	while ((Get-Date) -lt $deadline) {
		if (Test-TcpLocalhostPort -Port $Port -TimeoutMs 800) {
			return $true
		}
		Start-Sleep -Milliseconds 500
	}
	return $false
}

function Start-MetroWindow {
	param(
		[Parameter(Mandatory)][string]$Root,
		[Parameter(Mandatory)][int]$Port,
		[switch]$ClearCache
	)
	$clearArg = if ($ClearCache) { ' --clear' } else { '' }
	$cmd = "Set-Location -LiteralPath '$Root'; npx expo start --dev-client --localhost --port $Port$clearArg"
	if ($DryRun) {
		Write-Plan "Would start Metro in a new PowerShell window: $cmd"
		return
	}
	Start-Process -FilePath 'powershell.exe' -ArgumentList @(
		'-NoExit',
		'-ExecutionPolicy', 'Bypass',
		'-Command', $cmd
	) | Out-Null
	Write-Pass "Metro launch requested in a new PowerShell window (port $Port)"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
$ProjectRoot = Get-ProjectRoot
Set-Location -LiteralPath $ProjectRoot

Write-Host ''
Write-Host '========================================'
Write-Host 'FORESTMUSIC ANDROID DEVICE QA'
Write-Host '========================================'
if ($DryRun) { Write-Warn 'DRY RUN - no build/install/start/kill' }
Write-Host ''

# --- 1. Preflight / Git ---
Write-Info "Project root: $ProjectRoot"
$branch = ''
$headSha = ''
try {
	$branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
	$headSha = (& git rev-parse HEAD 2>$null).Trim()
	Write-Info "Git branch: $branch"
	Write-Info "HEAD: $headSha"
	Write-Host '--- git status --short ---'
	& git status --short
	Write-Host '--------------------------'
} catch {
	Write-Warn 'Git metadata unavailable.'
}

$gitShort = if ($headSha) { $headSha.Substring(0, [Math]::Min(7, $headSha.Length)) } else { 'unknown' }
$statusPorcelain = @(& git status --porcelain 2>$null)
$trackedDirty = @($statusPorcelain | Where-Object { $_ -notmatch '^\?\?' })
if ($trackedDirty.Count -gt 0) {
	Write-Warn 'Tracked working tree is dirty - skipping automatic git pull.'
} elseif (-not $SkipGitPullPrompt -and -not $DryRun) {
	$pull = Read-Host 'Tracked tree is clean. Run git pull --ff-only origin main? [Y/N]'
	if ($pull -match '^[Yy]') {
		& git pull --ff-only origin main
		if ($LASTEXITCODE -ne 0) { Stop-Qa 'git pull --ff-only failed.' }
		$headSha = (& git rev-parse HEAD).Trim()
		$gitShort = $headSha.Substring(0, 7)
		Write-Pass "git pull --ff-only OK ($gitShort)"
	} else {
		Write-Info 'Skipped git pull.'
	}
} elseif ($DryRun) {
	Write-Plan 'Would optionally offer: git pull --ff-only origin main'
}
Write-Pass "Git $gitShort"

# --- 2. Android SDK ---
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path $sdkPath)) {
	Stop-Qa "Android SDK not found at $sdkPath"
}
$adbPath = Join-Path $sdkPath 'platform-tools\adb.exe'
if (-not (Test-Path $adbPath)) {
	Stop-Qa "adb.exe not found at $adbPath"
}
# Prefer SDK platform-tools on PATH for this session
$env:Path = "$(Join-Path $sdkPath 'platform-tools');$env:Path"
Write-Pass "Android SDK $sdkPath"
Ensure-LocalProperties -Root $ProjectRoot -SdkPath $sdkPath

# --- 3. ADB / device ---
if ($DryRun) {
	Write-Plan 'adb start-server'
	Write-Plan 'adb devices -l'
	try {
		& adb start-server | Out-Null
		& adb devices -l
	} catch {
		Write-Warn $_.Exception.Message
	}
} else {
	Write-Info 'adb start-server'
	& adb start-server | Out-Null
}
$device = Resolve-DeviceSerial -RequestedSerial $DeviceSerial
$serial = $device.Serial
Write-Pass ("Device {0} model={1}" -f $serial, $device.Model)

# --- 4. Metro port ---
Ensure-MetroPortFree -Port ([int]$Config.MetroPort)

# --- 5. Version + Build ---
$versions = Read-ExpectedVersions -Root $ProjectRoot
Write-Info ("app.json:           versionName={0} versionCode={1}" -f $versions.ExpoVersionName, $versions.ExpoVersionCode)
Write-Info ("build.gradle:       versionName={0} versionCode={1}" -f $versions.GradleVersionName, $versions.GradleVersionCode)
if ($versions.ExpoVersionName -ne $versions.GradleVersionName -or $versions.ExpoVersionCode -ne $versions.GradleVersionCode) {
	Stop-Qa 'Version mismatch between app.json and android/app/build.gradle - QA blocked.'
}
Write-Pass ("Version consistency {0} ({1})" -f $versions.ExpoVersionName, $versions.ExpoVersionCode)

$androidDir = Join-Path $ProjectRoot 'android'
$apkFull = Join-Path $ProjectRoot $Config.ApkPath

if ($DryRun) {
	Write-Plan "cd android; .\gradlew.bat assembleDebug --console=plain"
} else {
	Write-Info 'Building debug APK (assembleDebug)...'
	Push-Location $androidDir
	try {
		& .\gradlew.bat assembleDebug --console=plain
		if ($LASTEXITCODE -ne 0) {
			Pop-Location
			Stop-Qa 'BUILD FAILED. Diagnose with: cd android; .\gradlew.bat assembleDebug --stacktrace --console=plain'
		}
	} finally {
		if ((Get-Location).Path -eq $androidDir) { Pop-Location }
	}
	Write-Pass 'Build assembleDebug'
}

# --- 6. APK ---
if (-not (Test-Path $apkFull)) {
	if ($DryRun) {
		Write-Plan "Would require APK at $apkFull"
	} else {
		Stop-Qa "APK not found: $apkFull"
	}
} else {
	$apkItem = Get-Item $apkFull
	Write-Pass ("APK {0}" -f $apkItem.FullName)
	Write-Info ("APK size={0} bytes  LastWriteTime={1}" -f $apkItem.Length, $apkItem.LastWriteTime)
}

# --- 7. Install ---
if ($DryRun) {
	Write-Plan "adb -s $serial install -r `"$apkFull`""
} else {
	Write-Info 'Installing APK (adb install -r)...'
	$installOut = Invoke-Adb -Serial $serial -AdbArgs @('install', '-r', $apkFull) 2>&1 | Out-String
	Write-Host $installOut
	if ($installOut -notmatch '(?m)^Success$' -and $installOut -notmatch 'Success') {
		Stop-Qa 'adb install did not report Success.'
	}
	Write-Pass 'APK installed'
}

# --- 8. Verify dumpsys version ---
if ($DryRun) {
	Write-Plan "adb -s $serial shell dumpsys package $($Config.Package)"
} else {
	$dump = Invoke-Adb -Serial $serial -AdbArgs @('shell', 'dumpsys', 'package', $Config.Package) 2>&1 | Out-String
	$installedName = $null
	$installedCode = $null
	if ($dump -match 'versionName=([^\s]+)') { $installedName = $Matches[1] }
	if ($dump -match 'versionCode=(\d+)') { $installedCode = [int]$Matches[1] }
	if (-not $installedName -or $null -eq $installedCode) {
		Stop-Qa 'Could not parse versionName/versionCode from dumpsys.'
	}
	if ($installedName -ne $versions.ExpoVersionName -or $installedCode -ne $versions.ExpoVersionCode) {
		Stop-Qa ("Installed version mismatch: got {0} ({1}), expected {2} ({3})" -f $installedName, $installedCode, $versions.ExpoVersionName, $versions.ExpoVersionCode)
	}
	Write-Host ''
	Write-Pass 'Installed:'
	Write-Host "  versionName=$installedName"
	Write-Host "  versionCode=$installedCode"
	Write-Host ''
}

# --- 9-10. Metro ---
Start-MetroWindow -Root $ProjectRoot -Port ([int]$Config.MetroPort) -ClearCache:$ClearMetroCache
if ($DryRun) {
	Write-Plan "Would wait up to 30s for 127.0.0.1:$($Config.MetroPort)"
} else {
	Write-Info "Waiting for Metro on 127.0.0.1:$($Config.MetroPort) ..."
	if (-not (Wait-MetroReady -Port ([int]$Config.MetroPort) -TimeoutSec 30)) {
		Stop-Qa "Metro did not become reachable on 127.0.0.1:$($Config.MetroPort) within 30s. If you see 'Unable to deserialize cloned data', re-run with -ClearMetroCache."
	}
	Write-Pass "Metro 127.0.0.1:$($Config.MetroPort)"
}

# --- 11. adb reverse ---
if ($DryRun) {
	Write-Plan "adb -s $serial reverse tcp:$($Config.MetroPort) tcp:$($Config.MetroPort)"
	Write-Plan 'adb reverse --list (expect tcp:8081 tcp:8081)'
} else {
	Invoke-Adb -Serial $serial -AdbArgs @('reverse', "tcp:$($Config.MetroPort)", "tcp:$($Config.MetroPort)") | Out-Null
	$rev = Invoke-Adb -Serial $serial -AdbArgs @('reverse', '--list') 2>&1 | Out-String
	Write-Host $rev
	$needle = "tcp:$($Config.MetroPort) tcp:$($Config.MetroPort)"
	if ($rev -notmatch [regex]::Escape($needle)) {
		Stop-Qa "adb reverse missing $needle"
	}
	Write-Pass "ADB reverse $needle"
}

# --- 12. Open development client via localhost (never LAN / expo a) ---
$devUrl = "exp+$($Config.Scheme)://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$($Config.MetroPort)"
if ($DryRun) {
	Write-Plan "adb -s $serial shell am start -a android.intent.action.VIEW -d `"$devUrl`""
} else {
	Invoke-Adb -Serial $serial -AdbArgs @(
		'shell', 'am', 'start',
		'-a', 'android.intent.action.VIEW',
		'-d', $devUrl
	) | Out-Null
	Write-Pass 'Dev client OPENED (localhost deep link)'
}

# --- 13. Wait for PID ---
$appPid = ''
if ($DryRun) {
	Write-Plan "adb -s $serial shell pidof $($Config.Package)"
} else {
	Start-Sleep -Seconds 4
	$appPid = (Invoke-Adb -Serial $serial -AdbArgs @('shell', 'pidof', $Config.Package) 2>&1 | Out-String).Trim()
	if ([string]::IsNullOrWhiteSpace($appPid)) {
		# Retry once - cold start can be slow
		Start-Sleep -Seconds 4
		$appPid = (Invoke-Adb -Serial $serial -AdbArgs @('shell', 'pidof', $Config.Package) 2>&1 | Out-String).Trim()
	}
	if ([string]::IsNullOrWhiteSpace($appPid)) {
		Stop-Qa "App PID not found for $($Config.Package). Is the development client installed?"
	}
	# pidof may return multiple PIDs; take the first
	$appPid = ($appPid -split '\s+')[0]
	Write-Pass "PID $appPid"
}

# --- 14. Optional logcat ---
if ($AppMetricaLog -or $Logcat) {
	if ($DryRun) {
		if ($AppMetricaLog) {
			Write-Plan "adb -s $serial logcat --pid=$appPid -v time | Select-String AppMetrica|appmetrica|ReactNativeJS"
		} else {
			Write-Plan "adb -s $serial logcat --pid=$appPid -v time"
		}
	} else {
		if ($AppMetricaLog) {
			Write-Info 'Starting AppMetrica-filtered logcat (Ctrl+C to stop)...'
			Invoke-Adb -Serial $serial -AdbArgs @('logcat', "--pid=$appPid", '-v', 'time') 2>&1 |
				Select-String -Pattern 'AppMetrica|appmetrica|ReactNativeJS'
		} elseif ($Logcat) {
			Write-Info 'Starting PID-filtered logcat (Ctrl+C to stop)...'
			Invoke-Adb -Serial $serial -AdbArgs @('logcat', "--pid=$appPid", '-v', 'time')
		}
	}
}

# --- 15. Summary ---
$apkStamp = if (Test-Path $apkFull) { (Get-Item $apkFull).LastWriteTime.ToString('yyyy-MM-dd HH:mm') } else { 'n/a' }
$installedLabel = '{0} ({1})' -f $versions.ExpoVersionName, $versions.ExpoVersionCode
$pidLabel = if ($appPid) { $appPid } else { 'n/a (dry-run)' }
$metroLabel = if ($DryRun) { "planned 127.0.0.1:$($Config.MetroPort)" } else { "PASS 127.0.0.1:$($Config.MetroPort)" }

Write-Host ''
Write-Host '========================================'
Write-Host 'FORESTMUSIC ANDROID DEVICE QA'
Write-Host '========================================'
Write-Host ("Git:          PASS {0}" -f $gitShort)
Write-Host ("Android SDK:  PASS {0}" -f $sdkPath)
Write-Host ("Device:       PASS {0}/{1}" -f $serial, $device.Model)
Write-Host ('Build:        {0}' -f ($(if ($DryRun) { 'PLANNED' } else { 'PASS' })))
Write-Host ("APK:          PASS {0}" -f $apkStamp)
Write-Host ("Installed:    {0} {1}" -f ($(if ($DryRun) { 'PLANNED' } else { 'PASS' }), $installedLabel))
Write-Host ("Metro:        {0}" -f $metroLabel)
Write-Host ('ADB reverse:  {0}' -f ($(if ($DryRun) { 'PLANNED tcp:8081' } else { 'PASS tcp:8081' })))
Write-Host ('Dev client:   {0}' -f ($(if ($DryRun) { 'PLANNED' } else { 'OPENED' })))
Write-Host ("PID:          {0}" -f $pidLabel)
Write-Host ''
if ($DryRun) {
	Write-Host 'DRY RUN COMPLETE - no device mutation performed beyond read-only probes.'
} else {
	Write-Host 'READY FOR DEVICE QA'
}
Write-Host '========================================'
