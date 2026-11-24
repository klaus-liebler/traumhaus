<#
.SYNOPSIS
    Den Traumhaus-Planer bauen und nach https://liebler.iui.hs-osnabrueck.de/traumhaus/ ausrollen.
.DESCRIPTION
    Rein statische Seite (Vite, Basis './'). nginx liefert /var/www/html auf liebler.iui.hs-osnabrueck.de statisch und ohne
    Passwort aus (Grundgeruest liebler.conf aus dem VibeVHS-Kit) - eine eigene nginx-Datei in /etc/nginx/liebler.d/ ist daher
    NICHT noetig. Die App liegt in /var/www/html/traumhaus (gehoert srvadmin, wie rgb/ und factorycontrol/). Nur beim
    allerersten Mal legt das Skript dieses Verzeichnis mit sudo an (fragt nach dem Passwort von srvadmin), danach braucht es
    kein sudo. Auf dem Server spielt ausrollen.sh die neue Version ein (erst assets/ und models/, dann index.html, dann Altes
    weg) und behaelt die vorige als ~/traumhaus.vorher (Rueckweg: -Zurueck).
    Zugang per SSH-Schluessel aus %USERPROFILE%\.ssh (nicht im Repository); Server nur im Hochschul-VPN erreichbar.
.EXAMPLE
    npm run deploy                        # bauen + hochladen + einspielen + pruefen
.EXAMPLE
    .\deploy\deploy.ps1 -NurBauen         # nur bauen (dist)
.EXAMPLE
    .\deploy\deploy.ps1 -OhneBauen        # das vorhandene dist ausrollen
.EXAMPLE
    .\deploy\deploy.ps1 -Trocken          # bauen und nur anzeigen, was hochgeladen und ausgefuehrt wuerde
.EXAMPLE
    .\deploy\deploy.ps1 -Zurueck          # die vorige Version wieder einspielen
#>
param(
    [string] $Ziel = "srvadmin@liebler.iui.hs-osnabrueck.de",
    [string] $Schluessel = "$env:USERPROFILE\.ssh\id_ed25519_liebler_iui_hs_osnabrueck",
    [string] $Url = "https://liebler.iui.hs-osnabrueck.de/traumhaus/",
    [switch] $NurBauen,
    [switch] $OhneBauen,
    [switch] $Trocken,
    [switch] $Zurueck
)

$ErrorActionPreference = "Stop"
$projekt = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $projekt "dist"
$serverVerzeichnis = "/var/www/html/traumhaus"
$sshArgs = @()
if (Test-Path $Schluessel) { $sshArgs = @("-i", $Schluessel) }

# Fernbefehle: bei -Trocken nur anzeigen
function Fern([string] $programm, [string[]] $argumente) {
    if ($Trocken) { Write-Host ("  [trocken] {0} {1}" -f $programm, ($argumente -join " ")) -ForegroundColor DarkGray; $global:LASTEXITCODE = 0; return }
    & $programm @argumente
}

function Pruefen {
    if ($Trocken) { Write-Host "  [trocken] pruefen: $Url" -ForegroundColor DarkGray; return }
    Write-Host "» pruefen: $Url" -ForegroundColor Cyan
    $seite = Invoke-WebRequest -Uri $Url -UseBasicParsing
    if ($seite.StatusCode -ne 200 -or $seite.Content -notmatch "Traumhaus-Planer") { throw "$Url liefert nicht die App (Status $($seite.StatusCode))." }
    $skript = [regex]::Match($seite.Content, 'src="\./(assets/[^"]+\.js)"').Groups[1].Value
    if (-not $skript) { throw "index.html verweist auf kein Skript." }
    $js = Invoke-WebRequest -Uri ($Url + $skript) -UseBasicParsing
    if ($js.StatusCode -ne 200) { throw "$skript fehlt auf dem Server." }
    Write-Host ("✓ erreichbar: {0} ({1}, {2:N0} kB)" -f $Url, $skript, ($js.RawContentLength / 1KB)) -ForegroundColor Green
}

$ausrollen = Join-Path $PSScriptRoot "ausrollen.sh"

if ($Zurueck) {
    Fern scp ($sshArgs + @($ausrollen, "${Ziel}:/tmp/traumhaus-ausrollen.sh"))
    Fern ssh ($sshArgs + @($Ziel, "bash /tmp/traumhaus-ausrollen.sh --zurueck"))
    if ($LASTEXITCODE -ne 0) { throw "Zurueckspielen fehlgeschlagen - Meldung oben." }
    Pruefen
    return
}

if (-not $OhneBauen) {
    Write-Host "» bauen: npm run build" -ForegroundColor Cyan
    Push-Location $projekt
    try {
        if (-not (Test-Path "node_modules\vite")) { npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci fehlgeschlagen." } }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen." }
    } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $dist "index.html"))) { throw "$dist\index.html fehlt - erst bauen." }
if ($NurBauen) { Write-Host "✓ gebaut: $dist" -ForegroundColor Green; return }

$archiv = Join-Path $env:TEMP "traumhaus.tar.gz"
tar -czf $archiv -C $dist .
if ($LASTEXITCODE -ne 0) { throw "Archiv konnte nicht erstellt werden." }
Write-Host ("» hochladen ({0:N0} kB) nach {1}" -f ((Get-Item $archiv).Length / 1KB), $Ziel) -ForegroundColor Cyan
Fern scp ($sshArgs + @($archiv, "${Ziel}:/tmp/traumhaus.tar.gz"))
if ($LASTEXITCODE -ne 0) { throw "Hochladen fehlgeschlagen." }
Fern scp ($sshArgs + @($ausrollen, "${Ziel}:/tmp/traumhaus-ausrollen.sh"))
if ($LASTEXITCODE -ne 0) { throw "Hochladen fehlgeschlagen." }
Remove-Item $archiv

# Einmalig: das Verzeichnis anlegen und srvadmin geben (danach kein sudo mehr)
if ($Trocken) {
    Write-Host "  [trocken] falls $serverVerzeichnis fehlt: ssh -t $Ziel `"sudo install -d -o srvadmin -g srvadmin -m 755 $serverVerzeichnis`"" -ForegroundColor DarkGray
} else {
    ssh @sshArgs $Ziel "test -w $serverVerzeichnis"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "» einmalig: $serverVerzeichnis anlegen (sudo fragt nach dem Passwort von srvadmin)" -ForegroundColor Cyan
        ssh @sshArgs -t $Ziel "sudo install -d -o srvadmin -g srvadmin -m 755 $serverVerzeichnis"
        if ($LASTEXITCODE -ne 0) { throw "$serverVerzeichnis konnte nicht angelegt werden." }
    }
}

Write-Host "» einspielen" -ForegroundColor Cyan
Fern ssh ($sshArgs + @($Ziel, "bash /tmp/traumhaus-ausrollen.sh /tmp/traumhaus.tar.gz"))
if ($LASTEXITCODE -ne 0) { throw "Einspielen fehlgeschlagen - Meldung oben (die vorige Version liegt in ~/traumhaus.vorher, -Zurueck)." }
Pruefen
