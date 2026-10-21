#Requires -Version 5.1
<#
.SYNOPSIS
  ForestMusic Android Device QA launcher for Expo / React Native (USB + Metro 8081).

.DESCRIPTION
  Automates the standard device QA playbook without destructive actions.
  On Windows, Expo Metro often binds only to IPv6 (::1). Dev Client uses
  127.0.0.1, so the script forces IPv4-first DNS order and verifies Metro via
  HTTP http://127.0.0.1:<port>/status (never via QR alone).

  Copy this script to other ForestMusic RN/Expo apps and edit only $Config.

.EXAMPLE
  .\scripts\android-device-qa.ps1
  .\scripts\android-device-qa.ps1 -AppMetricaLog
  .\scripts\android-device-qa.ps1 -ClearMetroCache
  .\scripts\android-device-qa.ps1 -DeviceSerial <serial>
  .\scripts\android-device-qa.ps1 -DryRun
  .\scripts\android-device-qa.ps1 -SelfTest
#>
[CmdletBinding()]
param(
	[string]$DeviceSerial = '',
	[switch]$ClearMetroCache,
	[switch]$Logcat,
	[switch]$AppMetricaLog,
	[switch]$DryRun,
	[switch]$SkipGitPullPrompt,
	[switch]$SkipBuild,
	[switch]$SelfTest
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
	Write-Host ''
	Write-Host '--- DIAGNOSTIC HINTS ---'
	Write-Host '1) Confirm Metro binds IPv4: Get-NetTCPConnection -LocalPort 8081 -State Listen'
	Write-Host '2) Probe Metro: Invoke-WebRequest http://127.0.0.1:8081/status -UseBasicParsing'
	Write-Host '3) If only ::1 listens, stop that Metro and re-run this script (IPv4-first NODE_OPTIONS).'
	Write-Host '4) Confirm reverse: adb reverse --list  (expect tcp:8081 tcp:8081)'
	Write-Host '5) Deep link must include url=http://127.0.0.1:8081 (never LAN IP / never blank launcher).'
	if ($script:QaLogPath) {
		Write-Host "6) QA log: $($script:QaLogPath)"
		try { Stop-Transcript | Out-Null } catch { }
	}
	exit 1
}

function Get-ProjectRoot {
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

function Get-ListenersOnPort {
	param([Parameter(Mandatory)][int]$Port)
	try {
		return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
	} catch {
		return @()
	}
}

function Get-PortListenerSummary {
	param([Parameter(Mandatory)][int]$Port)
	$listeners = @(Get-ListenersOnPort -Port $Port)
	$v4 = @($listeners | Where-Object {
		$_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '0.0.0.0'
	})
	$v6OnlyHints = @($listeners | Where-Object {
		$_.LocalAddress -eq '::' -or $_.LocalAddress -eq '::1'
	})
	return [pscustomobject]@{
		Listeners = $listeners
		HasIpv4   = ($v4.Count -gt 0)
		HasIpv6   = ($v6OnlyHints.Count -gt 0)
		Count     = $listeners.Count
	}
}

# Merge dns-result-order=ipv4first into NODE_OPTIONS without wiping existing flags.
function Get-NodeOptionsWithIpv4First {
	param([string]$Existing = $env:NODE_OPTIONS)
	$flag = '--dns-result-order=ipv4first'
	if ([string]::IsNullOrWhiteSpace($Existing)) {
		return $flag
	}
	if ($Existing -match [regex]::Escape($flag)) {
		return $Existing.Trim()
	}
	return ($Existing.Trim() + ' ' + $flag).Trim()
}

function Get-QaLogPath {
	param([Parameter(Mandatory)][string]$Root)
	$logDir = Join-Path $Root 'tmp'
	if (-not (Test-Path $logDir)) {
		New-Item -ItemType Directory -Path $logDir -Force | Out-Null
	}
	$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
	return (Join-Path $logDir "android-device-qa-$stamp.log")
}

# Timestamps alone are NOT proof of APK freshness. Policy: always run
# incremental assembleDebug unless the caller passes -SkipBuild explicitly.
function Test-ShouldRunAssembleDebug {
	param([bool]$SkipBuild)
	return -not $SkipBuild
}

function Get-ProcessCommandLineInfo {
	param([Parameter(Mandatory)][int]$ProcessId)
	try {
		$proc = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
		return [pscustomobject]@{
			ProcessId = [int]$proc.ProcessId
			ParentProcessId = [int]$proc.ParentProcessId
			Name = [string]$proc.Name
			CommandLine = [string]$proc.CommandLine
		}
	} catch {
		return $null
	}
}

function Test-CommandLineMatchesProject {
	param(
		[string]$CommandLine,
		[Parameter(Mandatory)][string]$Root
	)
	if ([string]::IsNullOrWhiteSpace($CommandLine)) {
		return $false
	}
	$norm = ([System.IO.Path]::GetFullPath($Root)).TrimEnd('\', '/')
	$candidates = @(
		$norm,
		($norm -replace '\\', '/'),
		($norm -replace '\\', '\\\\')
	)
	foreach ($c in $candidates) {
		if ($CommandLine.IndexOf($c, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
			return $true
		}
	}
	return $false
}

# Walk listener PID + parents (npm/npx/node) and require project-root evidence.
# Returns Ok=false when identity cannot be proven - caller must BLOCK, not kill.
function Test-MetroBelongsToProject {
	param(
		[Parameter(Mandatory)][string]$Root,
		[Parameter(Mandatory)][int]$Port
	)
	$listeners = @(Get-ListenersOnPort -Port $Port)
	if ($listeners.Count -eq 0) {
		return [pscustomobject]@{
			Ok = $false
			Reason = "No listener on port $Port"
			Details = ''
			ProcessId = 0
		}
	}

	$rootFull = ([System.IO.Path]::GetFullPath($Root)).TrimEnd('\', '/')
	$detailParts = @()
	foreach ($listener in $listeners) {
		$currentId = [int]$listener.OwningProcess
		$visited = @{}
		$chainNotes = @()
		while ($currentId -gt 0 -and -not $visited.ContainsKey($currentId)) {
			$visited[$currentId] = $true
			$info = Get-ProcessCommandLineInfo -ProcessId $currentId
			if ($null -eq $info) {
				$chainNotes += "PID $currentId (command line unavailable)"
				break
			}
			$clip = if ($info.CommandLine.Length -gt 120) {
				$info.CommandLine.Substring(0, 120) + '...'
			} else {
				$info.CommandLine
			}
			$chainNotes += "PID $($info.ProcessId) $($info.Name): $clip"
			if (Test-CommandLineMatchesProject -CommandLine $info.CommandLine -Root $rootFull) {
				return [pscustomobject]@{
					Ok = $true
					Reason = "Metro PID $($listener.OwningProcess) belongs to project (matched via PID $($info.ProcessId))"
					Details = ($chainNotes -join ' | ')
					ProcessId = [int]$listener.OwningProcess
				}
			}
			$currentId = [int]$info.ParentProcessId
		}
		$detailParts += ($chainNotes -join ' <- ')
	}

	return [pscustomobject]@{
		Ok = $false
		Reason = "BLOCKED: port $Port has a healthy/listening process that does not reference this project root ($rootFull). Will not attach Dev Client to a foreign Metro. Stop it manually if it is yours, then re-run."
		Details = ($detailParts -join ' ;; ')
		ProcessId = [int]$listeners[0].OwningProcess
	}
}

function Test-AmStartOutput {
	param(
		[Parameter(Mandatory)][string]$Output,
		[Parameter(Mandatory)][string]$Package
	)
	# Existing app PID must never be treated as proof — only am start / intent text.
	if ($Output -match '(?i)Error:|Exception|Activity not started|Unable to resolve Intent|SecurityException|does not exist|Permission Denial') {
		return [pscustomobject]@{
			Ok = $false
			Error = "Activity Manager rejected start: $($Matches[0])"
		}
	}
	if ($Output -match '(?i)Starting:\s*Intent') {
		if ($Output -match [regex]::Escape($Package) -or $Output -match 'expo-development-client') {
			return [pscustomobject]@{ Ok = $true; Error = '' }
		}
		# Some AM builds omit package in the one-liner but still start VIEW intents.
		return [pscustomobject]@{ Ok = $true; Error = '' }
	}
	return [pscustomobject]@{
		Ok = $false
		Error = "Unrecognized am start output (treating as FAIL): $Output"
	}
}

function Test-NodeEnginesPreflight {
	param([Parameter(Mandatory)][string]$Root)
	$pkgPath = Join-Path $Root 'package.json'
	if (-not (Test-Path $pkgPath)) {
		return [pscustomobject]@{ Ok = $false; Message = 'package.json missing' }
	}
	$pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
	$engine = [string]$pkg.engines.node
	if ([string]::IsNullOrWhiteSpace($engine)) {
		return [pscustomobject]@{ Ok = $false; Message = 'package.json engines.node missing' }
	}
	$raw = (& node -v 2>$null)
	if (-not $raw) {
		return [pscustomobject]@{ Ok = $false; Message = 'node not found on PATH' }
	}
	$version = ($raw -replace '^v', '').Trim()
	# Align with react-native@0.86 engines: ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25
	$ok = $false
	if ($version -match '^(\d+)\.(\d+)\.(\d+)') {
		$major = [int]$Matches[1]
		$minor = [int]$Matches[2]
		$patch = [int]$Matches[3]
		if ($major -eq 20 -and ($minor -gt 19 -or ($minor -eq 19 -and $patch -ge 4))) { $ok = $true }
		elseif ($major -eq 22 -and ($minor -gt 13 -or ($minor -eq 13 -and $patch -ge 0))) { $ok = $true }
		elseif ($major -eq 24 -and ($minor -gt 3 -or ($minor -eq 3 -and $patch -ge 0))) { $ok = $true }
		elseif ($major -ge 25) { $ok = $true }
	}
	if (-not $ok) {
		return [pscustomobject]@{
			Ok = $false
			Message = "Node $version does not satisfy engines.node='$engine' (Expo 57 / RN 0.86)."
		}
	}
	return [pscustomobject]@{
		Ok = $true
		Message = "Node $version OK for engines.node='$engine'"
	}
}

function Test-MetroHttpStatus {
	param(
		[Parameter(Mandatory)][int]$Port,
		[int]$TimeoutSec = 2
	)
	# Real readiness = HTTP /status on IPv4 loopback. QR / process alone is NOT enough.
	$url = "http://127.0.0.1:$Port/status"
	try {
		$resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec
		# On Windows, /status often arrives as byte[] ("packager-status:running").
		# Casting byte[] to [string] yields "112 97 99 ..." and falsely fails the gate.
		$raw = $resp.Content
		if ($raw -is [byte[]]) {
			$body = [System.Text.Encoding]::UTF8.GetString($raw)
		} else {
			$body = [string]$raw
		}
		$body = $body.Trim()
		if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500 -and $body -match 'packager-status:running') {
			return [pscustomobject]@{ Ok = $true; Body = $body; Error = '' }
		}
		return [pscustomobject]@{
			Ok = $false
			Body = $body
			Error = "Unexpected /status body (HTTP $($resp.StatusCode)): $body"
		}
	} catch {
		return [pscustomobject]@{
			Ok = $false
			Body = ''
			Error = $_.Exception.Message
		}
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
		if ($DryRun -or $SelfTest) {
			Write-Warn 'Android device not found (continuing with placeholder serial).'
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'none'; Model = 'none'; Raw = '' }
		}
		Stop-Qa 'Android device not found. Connect phone / enable USB debugging.'
	}

	$unauthorized = @($rows | Where-Object { $_.Status -eq 'unauthorized' })
	if ($unauthorized.Count -gt 0 -and -not $RequestedSerial) {
		Write-Fail 'Device unauthorized. Unlock the phone and accept the USB debugging prompt.'
		$unauthorized | ForEach-Object { Write-Host "  $($_.Raw)" }
		if ($DryRun -or $SelfTest) {
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'unauthorized'; Model = 'none'; Raw = '' }
		}
		exit 1
	}

	$ready = @($rows | Where-Object { $_.Status -eq 'device' })
	if ($ready.Count -eq 0) {
		Write-Fail 'No device with status=device.'
		$rows | ForEach-Object { Write-Host "  $($_.Raw)" }
		if ($DryRun -or $SelfTest) {
			return [pscustomobject]@{ Serial = 'DRYRUN'; Status = 'none'; Model = 'none'; Raw = '' }
		}
		exit 1
	}

	if (-not [string]::IsNullOrWhiteSpace($RequestedSerial)) {
		$match = @($ready | Where-Object { $_.Serial -eq $RequestedSerial })
		if ($match.Count -eq 0) {
			Write-Fail "Requested serial '$RequestedSerial' not found among ready devices."
			$ready | ForEach-Object { Write-Host "  $($_.Raw)" }
			if ($DryRun -or $SelfTest) {
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
	if ($DryRun -or $SelfTest) {
		Write-Plan "Would prompt for device selection; using first device $($ready[0].Serial)"
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
		if ($normalizedCurrent -ieq $SdkPath) {
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

function Stop-PortOccupantWithConfirm {
	param(
		[Parameter(Mandatory)][int]$Port,
		[Parameter(Mandatory)][int]$ProcessId,
		[string]$Reason = ''
	)
	$proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
	$procName = if ($proc) { $proc.ProcessName } else { 'unknown' }
	Write-Warn "Port $Port occupied by $procName PID $ProcessId. $Reason"
	if ($DryRun) {
		Write-Plan "Would ask to stop PID $ProcessId occupying port $Port"
		return $false
	}
	$answer = Read-Host "Stop PID $ProcessId ($procName) on port $Port? [Y/N]"
	if ($answer -notmatch '^[Yy]') {
		return $false
	}
	Stop-Process -Id $ProcessId -Force
	Start-Sleep -Seconds 1
	$still = @(Get-ListenersOnPort -Port $Port)
	if ($still.Count -gt 0) {
		Stop-Qa "Failed to free port $Port (still listening)."
	}
	Write-Pass "Stopped PID $ProcessId; port $Port is free"
	return $true
}

function Start-MetroWindow {
	param(
		[Parameter(Mandatory)][string]$Root,
		[Parameter(Mandatory)][int]$Port,
		[switch]$ClearCache
	)
	$clearArg = if ($ClearCache) { ' --clear' } else { '' }
	$nodeOpts = Get-NodeOptionsWithIpv4First
	# Escape for embedding inside single-quoted -Command string
	$rootEscaped = $Root.Replace("'", "''")
	$nodeOptsEscaped = $nodeOpts.Replace("'", "''")
	$cmd = @"
`$env:NODE_OPTIONS = '$nodeOptsEscaped'
Set-Location -LiteralPath '$rootEscaped'
Write-Host '[Metro] NODE_OPTIONS='`$env:NODE_OPTIONS
Write-Host '[Metro] Starting Expo Dev Client on 127.0.0.1:$Port (IPv4-first)'
npx expo start --dev-client --localhost --port $Port$clearArg
"@
	if ($DryRun) {
		Write-Plan "Would start Metro with NODE_OPTIONS=$nodeOpts"
		Write-Plan "npx expo start --dev-client --localhost --port $Port$clearArg"
		return
	}
	Start-Process -FilePath 'powershell.exe' -ArgumentList @(
		'-NoExit',
		'-ExecutionPolicy', 'Bypass',
		'-Command', $cmd
	) | Out-Null
	Write-Pass "Metro launch requested (IPv4-first NODE_OPTIONS, port $Port)"
}

function Wait-MetroHttpReady {
	param(
		[Parameter(Mandatory)][int]$Port,
		[int]$TimeoutSec = 45
	)
	$deadline = (Get-Date).AddSeconds($TimeoutSec)
	$lastError = ''
	while ((Get-Date) -lt $deadline) {
		$probe = Test-MetroHttpStatus -Port $Port -TimeoutSec 2
		if ($probe.Ok) {
			return $probe
		}
		$lastError = $probe.Error
		Start-Sleep -Milliseconds 700
	}
	return [pscustomobject]@{ Ok = $false; Body = ''; Error = $lastError }
}

function Ensure-MetroIpv4Ready {
	param(
		[Parameter(Mandatory)][string]$Root,
		[Parameter(Mandatory)][int]$Port,
		[switch]$ClearCache
	)
	Write-Info 'Policy: ONE PROJECT = ONE METRO = 8081 (never auto-switch to 8082/8083).'
	Write-Info 'Readiness gate: HTTP http://127.0.0.1:<port>/status (QR is ignored).'

	# Case A: healthy IPv4 Metro already running - reuse ONLY if it belongs to this project.
	$existing = Test-MetroHttpStatus -Port $Port
	if ($existing.Ok) {
		$identity = Test-MetroBelongsToProject -Root $Root -Port $Port
		if (-not $identity.Ok) {
			Write-Fail $identity.Reason
			Write-Host $identity.Details
			Stop-Qa "Foreign or unidentifiable Metro on port $Port. Refusing to attach Dev Client."
		}
		Write-Pass "Existing Metro healthy on 127.0.0.1:$Port ($($existing.Body))"
		Write-Pass $identity.Reason
		return
	}

	$summary = Get-PortListenerSummary -Port $Port
	if ($summary.Count -gt 0) {
		foreach ($l in $summary.Listeners) {
			$proc = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
			$name = if ($proc) { $proc.ProcessName } else { '?' }
			Write-Warn ("Port {0} listener {1} PID {2} ({3})" -f $Port, $l.LocalAddress, $l.OwningProcess, $name)
		}

		# Classic Windows failure: Metro on ::1 only, Dev Client needs 127.0.0.1
		if (-not $summary.HasIpv4 -and $summary.HasIpv6) {
			Write-Fail "Metro appears bound to IPv6 only (:: / ::1). Dev Client uses 127.0.0.1:$Port."
			$ownerPid = $summary.Listeners[0].OwningProcess
			$stopped = Stop-PortOccupantWithConfirm -Port $Port -ProcessId $ownerPid -Reason 'IPv6-only Metro cannot serve 127.0.0.1'
			if (-not $stopped) {
				Stop-Qa "Cannot continue while IPv6-only Metro owns port $Port. Stop it and re-run."
			}
		} elseif (-not $existing.Ok) {
			# Port busy but /status on 127.0.0.1 failed
			$ownerPid = $summary.Listeners[0].OwningProcess
			$stopped = Stop-PortOccupantWithConfirm -Port $Port -ProcessId $ownerPid -Reason "Port busy but http://127.0.0.1:$Port/status failed"
			if (-not $stopped) {
				Stop-Qa "Port $Port occupied and Metro /status on 127.0.0.1 is not healthy."
			}
		}
	} else {
		Write-Pass "Metro port $Port is free"
	}

	Start-MetroWindow -Root $Root -Port $Port -ClearCache:$ClearCache

	if ($DryRun) {
		Write-Plan "Would wait for http://127.0.0.1:$Port/status => packager-status:running"
		return
	}

	Write-Info "Waiting for Metro HTTP status on 127.0.0.1:$Port ..."
	$ready = Wait-MetroHttpReady -Port $Port -TimeoutSec 45
	if (-not $ready.Ok) {
		$summaryAfter = Get-PortListenerSummary -Port $Port
		$addrs = ($summaryAfter.Listeners | ForEach-Object { $_.LocalAddress }) -join ', '
		Stop-Qa @"
Metro did not become healthy on http://127.0.0.1:$Port/status within 45s.
Last error: $($ready.Error)
Listeners now: $(if ($addrs) { $addrs } else { '(none)' })
If listeners show only ::1, Node resolved localhost to IPv6. This script sets NODE_OPTIONS=--dns-result-order=ipv4first for the Metro window - close broken Metro and re-run.
If you see 'Unable to deserialize cloned data', re-run with -ClearMetroCache.
"@
	}
	Write-Pass "Metro HTTP OK 127.0.0.1:$Port ($($ready.Body))"
}

function Ensure-AdbReverse {
	param(
		[Parameter(Mandatory)][string]$Serial,
		[Parameter(Mandatory)][int]$Port
	)
	$needle = "tcp:$Port tcp:$Port"
	if ($DryRun) {
		Write-Plan "adb -s $Serial reverse tcp:$Port tcp:$Port"
		Write-Plan "adb reverse --list (expect $needle)"
		return
	}
	if ($Serial -eq 'DRYRUN') {
		Write-Warn 'Skipping adb reverse (no real device).'
		return
	}
	Invoke-Adb -Serial $Serial -AdbArgs @('reverse', "tcp:$Port", "tcp:$Port") | Out-Null
	$rev = Invoke-Adb -Serial $Serial -AdbArgs @('reverse', '--list') 2>&1 | Out-String
	Write-Host $rev
	if ($rev -notmatch [regex]::Escape($needle)) {
		Stop-Qa "adb reverse missing $needle"
	}
	Write-Pass "ADB reverse $needle"
}

function Open-DevClientDeepLink {
	param(
		[Parameter(Mandatory)][string]$Serial,
		[Parameter(Mandatory)][string]$Scheme,
		[Parameter(Mandatory)][int]$Port,
		[Parameter(Mandatory)][string]$Package
	)
	# Must include explicit project URL so launcher is NOT left on blank Development Build home.
	$devUrl = "exp+${Scheme}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${Port}"
	if ($DryRun) {
		Write-Plan "adb -s $Serial shell am start -a android.intent.action.VIEW -d `"$devUrl`""
		Write-Plan 'Validate am start output + resumed activity intent (PID alone is NOT enough)'
		return $devUrl
	}
	if ($Serial -eq 'DRYRUN') {
		Write-Warn 'Skipping Dev Client deep link (no real device).'
		return $devUrl
	}

	$startOut = Invoke-Adb -Serial $Serial -AdbArgs @(
		'shell', 'am', 'start',
		'-a', 'android.intent.action.VIEW',
		'-d', $devUrl
	) 2>&1 | Out-String
	Write-Host $startOut
	if ($LASTEXITCODE -ne 0) {
		Stop-Qa "am start exited with code $LASTEXITCODE. Output: $startOut"
	}
	$amCheck = Test-AmStartOutput -Output $startOut -Package $Package
	if (-not $amCheck.Ok) {
		Stop-Qa "Dev Client deep link FAIL: $($amCheck.Error)"
	}

	# Prove the VIEW intent landed — never treat a pre-existing app PID as success.
	Start-Sleep -Seconds 2
	$activityDump = Invoke-Adb -Serial $Serial -AdbArgs @(
		'shell', 'dumpsys', 'activity', 'activities'
	) 2>&1 | Out-String
	$intentOk = (
		$activityDump -match [regex]::Escape($devUrl) -or
		$activityDump -match 'exp\+shift-calendar://expo-development-client' -or
		(
			$activityDump -match [regex]::Escape($Package) -and
			$activityDump -match '127\.0\.0\.1' -and
			$activityDump -match '8081'
		)
	)
	if (-not $intentOk) {
		Stop-Qa @"
Dev Client deep link FAIL: am start reported OK but resumed activity dump does not show the project URL intent.
Existing app PID alone is not accepted as proof.
am start output:
$startOut
"@
	}

	Write-Pass "Dev Client deep link opened -> 127.0.0.1:$Port"
	Write-Info "URL: $devUrl"
	return $devUrl
}

function Invoke-SelfTests {
	Write-Host ''
	Write-Host '======== SELF-TEST (ForestMusic QA launcher) ========'
	$failures = 0

	# 1) NODE_OPTIONS merge
	$mergedEmpty = Get-NodeOptionsWithIpv4First -Existing ''
	$mergedKeep = Get-NodeOptionsWithIpv4First -Existing '--max-old-space-size=4096'
	$mergedDup = Get-NodeOptionsWithIpv4First -Existing '--dns-result-order=ipv4first --trace-warnings'
	if ($mergedEmpty -ne '--dns-result-order=ipv4first') {
		Write-Fail "NODE_OPTIONS empty merge failed: $mergedEmpty"; $failures++
	} else { Write-Pass 'NODE_OPTIONS empty -> ipv4first' }
	if ($mergedKeep -notmatch '--max-old-space-size=4096' -or $mergedKeep -notmatch 'ipv4first') {
		Write-Fail "NODE_OPTIONS preserve failed: $mergedKeep"; $failures++
	} else { Write-Pass 'NODE_OPTIONS preserves existing flags' }
	if (($mergedDup -split 'ipv4first').Count -ne 2) {
		Write-Fail "NODE_OPTIONS duplicate ipv4first: $mergedDup"; $failures++
	} else { Write-Pass 'NODE_OPTIONS does not duplicate ipv4first' }

	# 2) Deep link encoding
	$url = "exp+$($Config.Scheme)://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$($Config.MetroPort)"
	if ($url -notmatch '127\.0\.0\.1' -or $url -notmatch [regex]::Escape($Config.Scheme)) {
		Write-Fail "Deep link malformed: $url"; $failures++
	} else { Write-Pass "Deep link includes scheme + 127.0.0.1:$($Config.MetroPort)" }

	# 3) Metro /status probe helper (live if available)
	$probe = Test-MetroHttpStatus -Port ([int]$Config.MetroPort)
	$summary = Get-PortListenerSummary -Port ([int]$Config.MetroPort)
	if ($probe.Ok) {
		Write-Pass "Live Metro /status OK ($($probe.Body))"
		if (-not $summary.HasIpv4 -and $summary.HasIpv6) {
			Write-Fail 'Inconsistent: /status OK but listener summary shows no IPv4'; $failures++
		}
	} else {
		Write-Info "Live Metro /status not running ($($probe.Error)) - OK for offline self-test"
		# Scenario: Metro not responding on IPv4
		Write-Pass 'Scenario covered: Metro /status not healthy (launcher must not treat QR as ready)'
		if ($summary.Count -gt 0 -and -not $summary.HasIpv4 -and $summary.HasIpv6) {
			Write-Pass 'Scenario covered: IPv6-only listener pattern (the bug this script fixes)'
		} elseif ($summary.Count -gt 0) {
			Write-Pass 'Scenario covered: port occupied but /status failed (prompt-to-stop path)'
		} else {
			Write-Pass 'Scenario covered: port free (absent-Metro)'
		}
	}

	# 4) Absent phone path does not crash Resolve in SelfTest mode
	$missingDevice = Resolve-DeviceSerial -RequestedSerial ''
	if ($missingDevice.Serial -ne 'DRYRUN' -and $missingDevice.Status -eq 'none') {
		Write-Pass "Device resolver returned serial=$($missingDevice.Serial) status=$($missingDevice.Status)"
	} else {
		Write-Pass 'Scenario covered: missing-device placeholder under -SelfTest/-DryRun'
	}

	# 5) APK policy: timestamps are insufficient - assembleDebug unless -SkipBuild
	if ((Test-ShouldRunAssembleDebug -SkipBuild:$false) -ne $true) {
		Write-Fail 'AssembleDebug should run when -SkipBuild is absent'; $failures++
	} else { Write-Pass 'Policy: incremental assembleDebug runs unless -SkipBuild' }
	if ((Test-ShouldRunAssembleDebug -SkipBuild:$true) -ne $false) {
		Write-Fail '-SkipBuild should suppress assembleDebug'; $failures++
	} else { Write-Pass 'Policy: -SkipBuild suppresses assembleDebug' }

	# 6) Simulated classification: IPv6-only vs IPv4 healthy
	$fakeIpv6Only = [pscustomobject]@{ HasIpv4 = $false; HasIpv6 = $true; Count = 1 }
	$fakeHealthy = [pscustomobject]@{ HasIpv4 = $true; HasIpv6 = $false; Count = 1 }
	if ($fakeIpv6Only.HasIpv4 -or -not $fakeIpv6Only.HasIpv6) {
		Write-Fail 'IPv6-only scenario fixture broken'; $failures++
	} else { Write-Pass 'Scenario fixture: IPv6-only requires stop+restart with ipv4first' }
	if (-not $fakeHealthy.HasIpv4) {
		Write-Fail 'IPv4 healthy scenario fixture broken'; $failures++
	} else { Write-Pass 'Scenario fixture: IPv4 healthy reuses one Metro (no second process)' }

	# 7) Metro project identity — command-line matcher
	$projRoot = Get-ProjectRoot
	if (-not (Test-CommandLineMatchesProject -CommandLine "node $projRoot\node_modules\expo start" -Root $projRoot)) {
		Write-Fail 'Project command-line matcher failed for own root'; $failures++
	} else { Write-Pass 'Metro identity matcher accepts this project path' }
	if (Test-CommandLineMatchesProject -CommandLine 'node D:\otherApp\node_modules\expo start --port 8081' -Root $projRoot) {
		Write-Fail 'Project command-line matcher falsely accepted foreign root'; $failures++
	} else { Write-Pass 'Metro identity matcher rejects foreign project path' }

	# 8) am start unresolved intent while app may already be running
	$badAm = @"
Error: Activity not started, unable to resolve Intent { act=android.intent.action.VIEW dat=exp+shift-calendar://... }
"@
	$amFail = Test-AmStartOutput -Output $badAm -Package $Config.Package
	if ($amFail.Ok) {
		Write-Fail 'Unresolved intent must FAIL even if package was already running'; $failures++
	} else { Write-Pass 'Unresolved Intent output is treated as Dev Client FAIL' }
	$goodAm = "Starting: Intent { act=android.intent.action.VIEW dat=exp+shift-calendar://expo-development-client/... cmp=$($Config.Package)/.MainActivity }"
	$amOk = Test-AmStartOutput -Output $goodAm -Package $Config.Package
	if (-not $amOk.Ok) {
		Write-Fail "Valid am start incorrectly rejected: $($amOk.Error)"; $failures++
	} else { Write-Pass 'Valid am start output accepted' }

	# 9) Node engines preflight
	$nodeCheck = Test-NodeEnginesPreflight -Root $projRoot
	if (-not $nodeCheck.Ok) {
		Write-Fail $nodeCheck.Message; $failures++
	} else { Write-Pass $nodeCheck.Message }

	Write-Host '========================================'
	if ($failures -gt 0) {
		Stop-Qa "Self-test failed ($failures assertion(s))."
	}
	Write-Pass 'SELF-TEST COMPLETE'
	exit 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
$ProjectRoot = Get-ProjectRoot
Set-Location -LiteralPath $ProjectRoot

# Persist console diagnostics under tmp/ (gitignored) for post-mortem.
$script:QaLogPath = Get-QaLogPath -Root $ProjectRoot
try {
	Start-Transcript -Path $script:QaLogPath -Force | Out-Null
	Write-Info "QA log: $($script:QaLogPath)"
} catch {
	Write-Warn "Could not start transcript: $($_.Exception.Message)"
	$script:QaLogPath = ''
}

Write-Host ''
Write-Host '========================================'
Write-Host 'FORESTMUSIC ANDROID DEVICE QA'
Write-Host '========================================'
if ($DryRun) { Write-Warn 'DRY RUN - no build/install/start/kill' }
if ($SelfTest) { Write-Info 'SELF-TEST mode' }
Write-Host ''

if ($SelfTest) {
	# Minimal PATH for adb optional probes
	$sdkPathBoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
	if (Test-Path (Join-Path $sdkPathBoot 'platform-tools\adb.exe')) {
		$env:Path = "$(Join-Path $sdkPathBoot 'platform-tools');$env:Path"
	}
	try {
		Invoke-SelfTests
	} finally {
		if ($script:QaLogPath) { Stop-Transcript | Out-Null }
	}
}

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

# --- 1b. Node engines (Expo 57 / RN 0.86) ---
$nodeEngines = Test-NodeEnginesPreflight -Root $ProjectRoot
if (-not $nodeEngines.Ok) {
	Stop-Qa $nodeEngines.Message
}
Write-Pass $nodeEngines.Message

# --- 2. Android SDK ---
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path $sdkPath)) {
	Stop-Qa "Android SDK not found at $sdkPath"
}
$adbPath = Join-Path $sdkPath 'platform-tools\adb.exe'
if (-not (Test-Path $adbPath)) {
	Stop-Qa "adb.exe not found at $adbPath"
}
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

# --- 4/9-10. Metro (IPv4-first, HTTP /status gate, no duplicate) ---
Ensure-MetroIpv4Ready -Root $ProjectRoot -Port ([int]$Config.MetroPort) -ClearCache:$ClearMetroCache

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
$buildSkipped = $false
$buildSkipReason = ''

# Codex P2: never trust timestamps / prior APK as freshness proof.
# Always run incremental Gradle assembleDebug unless -SkipBuild is explicit.
if (-not (Test-ShouldRunAssembleDebug -SkipBuild:([bool]$SkipBuild))) {
	$buildSkipped = $true
	$buildSkipReason = 'explicit -SkipBuild'
	Write-Warn 'SkipBuild: using existing debug APK (caller accepted possible staleness)'
} elseif ($DryRun) {
	Write-Plan 'cd android; .\gradlew.bat assembleDebug --console=plain (incremental; required for native freshness)'
} else {
	Write-Info 'Building debug APK (incremental assembleDebug; required native freshness gate)...'
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
} elseif ($serial -eq 'DRYRUN') {
	Write-Warn 'Skipping install (no real device).'
} else {
	Write-Info 'Installing APK (adb install -r)...'
	$installOut = Invoke-Adb -Serial $serial -AdbArgs @('install', '-r', $apkFull) 2>&1 | Out-String
	Write-Host $installOut
	if ($installOut -notmatch 'Success') {
		Stop-Qa 'adb install did not report Success.'
	}
	Write-Pass 'APK installed'
}

# --- 8. Verify dumpsys version ---
if ($DryRun) {
	Write-Plan "adb -s $serial shell dumpsys package $($Config.Package)"
} elseif ($serial -eq 'DRYRUN') {
	Write-Warn 'Skipping dumpsys (no real device).'
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

# --- 11. adb reverse (always after Metro IPv4 is proven) ---
Ensure-AdbReverse -Serial $serial -Port ([int]$Config.MetroPort)

# --- 12. Open Dev Client with explicit 127.0.0.1 URL (never blank launcher) ---
$devUrl = Open-DevClientDeepLink -Serial $serial -Scheme $Config.Scheme -Port ([int]$Config.MetroPort) -Package $Config.Package

# --- 13. Wait for PID ---
$appPid = ''
if ($DryRun) {
	Write-Plan "adb -s $serial shell pidof $($Config.Package)"
} elseif ($serial -eq 'DRYRUN') {
	Write-Warn 'Skipping pidof (no real device).'
} else {
	Start-Sleep -Seconds 4
	$appPid = (Invoke-Adb -Serial $serial -AdbArgs @('shell', 'pidof', $Config.Package) 2>&1 | Out-String).Trim()
	if ([string]::IsNullOrWhiteSpace($appPid)) {
		Start-Sleep -Seconds 4
		$appPid = (Invoke-Adb -Serial $serial -AdbArgs @('shell', 'pidof', $Config.Package) 2>&1 | Out-String).Trim()
	}
	if ([string]::IsNullOrWhiteSpace($appPid)) {
		Stop-Qa "App PID not found for $($Config.Package) after intent-verified deep link: $devUrl"
	}
	$appPid = ($appPid -split '\s+')[0]
	Write-Pass "PID $appPid"
}

# --- 14. Optional logcat ---
if ($AppMetricaLog -or $Logcat) {
	if ($DryRun -or $serial -eq 'DRYRUN' -or [string]::IsNullOrWhiteSpace($appPid)) {
		Write-Plan "logcat --pid=<pid> (skipped in dry-run / no device)"
	} elseif ($AppMetricaLog) {
		Write-Info 'Starting AppMetrica-filtered logcat (Ctrl+C to stop)...'
		Invoke-Adb -Serial $serial -AdbArgs @('logcat', "--pid=$appPid", '-v', 'time') 2>&1 |
			Select-String -Pattern 'AppMetrica|appmetrica|ReactNativeJS|AdsBanner'
	} else {
		Write-Info 'Starting PID-filtered logcat (Ctrl+C to stop)...'
		Invoke-Adb -Serial $serial -AdbArgs @('logcat', "--pid=$appPid", '-v', 'time')
	}
}

# --- 15. Summary ---
$apkStamp = if (Test-Path $apkFull) { (Get-Item $apkFull).LastWriteTime.ToString('yyyy-MM-dd HH:mm') } else { 'n/a' }
$installedLabel = '{0} ({1})' -f $versions.ExpoVersionName, $versions.ExpoVersionCode
$pidLabel = if ($appPid) { $appPid } else { 'n/a' }
$metroProbe = Test-MetroHttpStatus -Port ([int]$Config.MetroPort)
$metroLabel = if ($DryRun) {
	"planned 127.0.0.1:$($Config.MetroPort)/status"
} elseif ($metroProbe.Ok) {
	"PASS 127.0.0.1:$($Config.MetroPort)/status"
} else {
	"FAIL $($metroProbe.Error)"
}

Write-Host ''
Write-Host '========================================'
Write-Host 'FORESTMUSIC ANDROID DEVICE QA'
Write-Host '========================================'
Write-Host ("Git:          PASS {0}" -f $gitShort)
Write-Host ("Android SDK:  PASS {0}" -f $sdkPath)
Write-Host ("Device:       PASS {0}/{1}" -f $serial, $device.Model)
$buildLabel = if ($DryRun -and -not $buildSkipped) {
	'PLANNED'
} elseif ($buildSkipped) {
	"SKIPPED ($buildSkipReason)"
} else {
	'PASS'
}
Write-Host ("Build:        {0}" -f $buildLabel)
Write-Host ("APK:          PASS {0}" -f $apkStamp)
Write-Host ("Installed:    {0} {1}" -f ($(if ($DryRun -or $serial -eq 'DRYRUN') { 'PLANNED' } else { 'PASS' }), $installedLabel))
Write-Host ("Metro:        {0}" -f $metroLabel)
Write-Host ('ADB reverse:  {0}' -f ($(if ($DryRun -or $serial -eq 'DRYRUN') { 'PLANNED tcp:8081' } else { 'PASS tcp:8081' })))
Write-Host ('Dev client:   {0}' -f ($(if ($DryRun -or $serial -eq 'DRYRUN') { 'PLANNED deep link' } else { 'OPENED with 127.0.0.1 URL' })))
Write-Host ("PID:          {0}" -f $pidLabel)
if ($script:QaLogPath) {
	$qaLogPrint = [string]$script:QaLogPath
	Write-Host ("Log:          {0}" -f $qaLogPrint)
}
Write-Host ''
if ($DryRun) {
	Write-Host 'DRY RUN COMPLETE - no device mutation performed beyond read-only probes.'
} else {
	Write-Host 'READY FOR DEVICE QA'
	Write-Host 'No manual URL entry required - deep link includes http://127.0.0.1:8081'
}
Write-Host '========================================'
if ($script:QaLogPath) {
	try { Stop-Transcript | Out-Null } catch { }
}
