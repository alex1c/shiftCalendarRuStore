#Requires -Version 5.1
<#
.SYNOPSIS
  Wrapper that runs android-device-qa.ps1 -SelfTest for CI / local gates.

.DESCRIPTION
  Covers NODE_OPTIONS merge, deep-link shape, Metro /status readiness gate,
  IPv6-only / busy-port / absent-Metro classification, missing-device path,
  and debug APK freshness helper.
#>
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$launcher = Join-Path $root 'scripts\android-device-qa.ps1'
if (-not (Test-Path -LiteralPath $launcher)) {
	throw "Launcher not found: $launcher"
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -SelfTest
exit $LASTEXITCODE
