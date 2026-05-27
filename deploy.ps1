$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$TARIH = Get-Date -Format "yyyyMMdd_HHmm"
$YEDEK = "$ROOT\_kaynak_yedek"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DEPLOY BASLIYOR - $TARIH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. YEDEK AL ──────────────────────────────────────────────────────────────
Write-Host "`n[1/6] Yedek aliniyor..." -ForegroundColor Yellow

$faceSource = "$ROOT\assets\js\faceracer.source.js"
$gameSource = "$ROOT\ninja\static\js\game.source.js"
$taktakSrc  = "$ROOT\taktak-src\src"

if (Test-Path $faceSource) {
    Copy-Item $faceSource "$YEDEK\faceracer.source_$TARIH.js" -Force
    Write-Host "  + faceracer.source_$TARIH.js" -ForegroundColor Green
}
if (Test-Path $gameSource) {
    Copy-Item $gameSource "$YEDEK\game.source_$TARIH.js" -Force
    Write-Host "  + game.source_$TARIH.js" -ForegroundColor Green
}
if (Test-Path $taktakSrc) {
    $zipPath = "$YEDEK\taktak-src_$TARIH.zip"
    Compress-Archive -Path $taktakSrc -DestinationPath $zipPath -Force
    Write-Host "  + taktak-src_$TARIH.zip" -ForegroundColor Green
}

# ── 2. BUILD AL ──────────────────────────────────────────────────────────────
Write-Host "`n[2/6] Build aliniyor..." -ForegroundColor Yellow
node "$ROOT\build.js"
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD BASARISIZ! Deploy iptal edildi." -ForegroundColor Red
    exit 1
}

# ── 3. HTML REFERANSLARINI GUNCELLE ─────────────────────────────────────────
Write-Host "`n[3/6] HTML referanslari guncelleniyor..." -ForegroundColor Yellow

$gameHtml   = "$ROOT\game.html"
$ninjaHtml  = "$ROOT\ninja\index.html"

(Get-Content $gameHtml)  -replace 'faceracer\.source\.js', 'faceracer.js'  | Set-Content $gameHtml
(Get-Content $ninjaHtml) -replace 'game\.source\.js',      'game.min.js'   | Set-Content $ninjaHtml
Write-Host "  + game.html ve ninja/index.html guncellendi" -ForegroundColor Green

# ── 4. SOURCE DOSYALARINI GECICI TASIMA ─────────────────────────────────────
Write-Host "`n[4/6] Source dosyalari gecici olarak tasiniyor..." -ForegroundColor Yellow

if (Test-Path $faceSource) {
    Move-Item $faceSource "$YEDEK\_temp_faceracer.source.js" -Force
    Write-Host "  - faceracer.source.js kaldirildi" -ForegroundColor DarkYellow
}
if (Test-Path $gameSource) {
    Move-Item $gameSource "$YEDEK\_temp_game.source.js" -Force
    Write-Host "  - game.source.js kaldirildi" -ForegroundColor DarkYellow
}

# ── 5. GIT PUSH ──────────────────────────────────────────────────────────────
Write-Host "`n[5/6] GitHub'a push ediliyor..." -ForegroundColor Yellow
Set-Location $ROOT
git add -A
git commit -m "deploy $TARIH"
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "GIT PUSH BASARISIZ!" -ForegroundColor Red
}

# ── 6. HER SEYI GERI GETIR ───────────────────────────────────────────────────
Write-Host "`n[6/6] Dosyalar geri getiriliyor..." -ForegroundColor Yellow

if (Test-Path "$YEDEK\_temp_faceracer.source.js") {
    Move-Item "$YEDEK\_temp_faceracer.source.js" $faceSource -Force
    Write-Host "  + faceracer.source.js geri geldi" -ForegroundColor Green
}
if (Test-Path "$YEDEK\_temp_game.source.js") {
    Move-Item "$YEDEK\_temp_game.source.js" $gameSource -Force
    Write-Host "  + game.source.js geri geldi" -ForegroundColor Green
}

(Get-Content $gameHtml)  -replace 'faceracer\.js',  'faceracer.source.js' | Set-Content $gameHtml
(Get-Content $ninjaHtml) -replace 'game\.min\.js',  'game.source.js'      | Set-Content $ninjaHtml
Write-Host "  + HTML referanslari eski haline dondu" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DEPLOY TAMAMLANDI!" -ForegroundColor Cyan
Write-Host "   Yedekler: _kaynak_yedek\" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
