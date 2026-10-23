# Starts the Trace Java server against the local Oracle XE database.
# Run from this folder:  .\start-server.ps1
# The TRACE_APP password is typed at the prompt below and stays on this machine.

$root = $PSScriptRoot

# Windows socket-path workaround (see backend/README.md); used only if that folder exists.
$sockets = 'C:\Users\Diya Gupta\Documents\Codex\work\trace-sockets'
if (Test-Path $sockets) { $env:TEMP = $sockets; $env:TMP = $sockets }

$env:TRACE_DB_URL = 'jdbc:oracle:thin:@localhost:1521:XE'
$env:TRACE_DB_USER = 'TRACE_APP'
$env:TRACE_FRONTEND_DIST = Join-Path $root 'frontend\dist'

# Prefer the JAR built in this repo (mvn package); fall back to the separately delivered one.
$jar = Join-Path $root 'backend\target\trace-1.0.0.jar'
if (-not (Test-Path $jar)) { $jar = Join-Path $root '..\trace-api.jar' }
if (-not (Test-Path $jar)) { Write-Error 'No server JAR found. Run "mvn -B -ntp package" in backend\ first.'; exit 1 }

# Prefer the workspace-local JDK 21 if present; otherwise use java on PATH.
$java = Join-Path $root '..\..\work\tools\jdk21\jdk-21.0.12.1+1\bin\java.exe'
if (-not (Test-Path $java)) { $java = 'java' }

$secret = Read-Host 'TRACE_APP password' -AsSecureString
$env:TRACE_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password

Write-Host 'Starting Trace on http://localhost:7000 (Ctrl+C to stop)...'
& $java -jar $jar
