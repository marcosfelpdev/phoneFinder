# ==============================================================================
# Phone Finder - Instalador em Serie via USB (ADB)
# ==============================================================================
# Permite instalar e configurar multiplos aparelhos em serie de forma rapida,
# bastando conectar o cabo USB de cada celular com a Depuracao USB ativada.
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Show-Header {
    Clear-Host
    Write-Host "====================================================================" -ForegroundColor Cyan
    Write-Host "           PHONE FINDER - INSTALADOR EM SERIE VIA USB (ADB)         " -ForegroundColor White
    Write-Host "====================================================================" -ForegroundColor Cyan
    Write-Host "Instalacao e configuracao automatica em celulares via cabo USB." -ForegroundColor Gray
    Write-Host ""
}

function Get-AdbPath {
    # 1. Verificar se adb ja esta no PATH
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    # 2. Caminhos comuns de instalacao no Windows
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
        "C:\Program Files\Android\Android Studio\platform-tools\adb.exe",
        "C:\Android\platform-tools\adb.exe",
        "C:\platform-tools\adb.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Get-ApkPath {
    $rootDir = Split-Path -Parent $PSScriptRoot
    $apkPath = Join-Path $rootDir "apps\android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        return (Resolve-Path $apkPath).Path
    }
    return $null
}

# --- INICIALIZACAO ---
Show-Header

# Localizar ADB
$adb = Get-AdbPath
if (-not $adb) {
    Write-Host "[ERRO] O utilitario ADB (Android Debug Bridge) nao foi encontrado no computador." -ForegroundColor Red
    Write-Host ""
    Write-Host "Para usar este instalador:" -ForegroundColor Yellow
    Write-Host "1. Instale o Android Studio ou baixe as Platform-Tools do Android:" -ForegroundColor Yellow
    Write-Host "   https://developer.android.com/tools/releases/platform-tools" -ForegroundColor Yellow
    Write-Host "2. Extraia e adicione a pasta platform-tools ao seu PATH ou em: $env:LOCALAPPDATA\Android\Sdk\platform-tools" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione [Enter] para sair"
    exit 1
}

Write-Host "[OK] ADB detectado: $adb" -ForegroundColor Green

# Localizar APK
$apk = Get-ApkPath
if (-not $apk) {
    Write-Host "[AVISO] APK nao encontrado em apps/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Yellow
    Write-Host "Compilando o APK agora via Gradle..." -ForegroundColor Cyan

    $rootDir = Split-Path -Parent $PSScriptRoot
    $androidDir = Join-Path $rootDir "apps\android"
    
    if (-not $env:JAVA_HOME) {
        $jdk17 = "C:\Users\$env:USERNAME\.jdks\ms-17.0.20.1"
        if (Test-Path $jdk17) {
            $env:JAVA_HOME = $jdk17
        }
    }

    Push-Location $androidDir
    & ".\gradlew.bat" assembleDebug
    Pop-Location

    $apk = Get-ApkPath
    if (-not $apk) {
        Write-Host "[ERRO] Nao foi possivel compilar o APK." -ForegroundColor Red
        Read-Host "Pressione [Enter] para sair"
        exit 1
    }
}

$apkInfo = Get-Item $apk
$apkSizeMb = [Math]::Round($apkInfo.Length / 1MB, 2)
Write-Host "[OK] APK carregado: $($apkInfo.Name) ($apkSizeMb MB)" -ForegroundColor Green
Write-Host ""

Write-Host "Instrucoes:" -ForegroundColor White
Write-Host "1. Ative a 'Depuracao USB' no celular (em Configuracoes > Opcoes do desenvolvedor)." -ForegroundColor Gray
Write-Host "2. Conecte o cabo USB no computador." -ForegroundColor Gray
Write-Host "3. O instalador detecta o celular, instala o app e concede as permissoes necessarias." -ForegroundColor Gray
Write-Host "4. Ao concluir, desconecte e ligue o proximo celular." -ForegroundColor Gray
Write-Host ""
Write-Host "Pressione [Ctrl+C] ou digite 'Q' a qualquer momento para encerrar." -ForegroundColor DarkGray
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$installedSerials = [System.Collections.Generic.HashSet[string]]::new()
$totalInstalled = 0

while ($true) {
    # Obter lista de dispositivos
    $devicesRaw = & $adb devices -l
    $lines = $devicesRaw -split "`r?`n" | Where-Object { $_.Trim() -ne "" -and $_ -notmatch "^List of devices attached" }

    $connectedDevices = @()
    foreach ($line in $lines) {
        $parts = -split $line
        if ($parts.Count -ge 2) {
            $connectedDevices += [PSCustomObject]@{
                Serial = $parts[0]
                Status = $parts[1]
                Raw = $line
            }
        }
    }

    # Cenario 1: Nenhum dispositivo conectado
    if ($connectedDevices.Count -eq 0) {
        Write-Host -NoNewline "`r[*] Aguardando celular conectado via USB... (conecte o cabo)   "
        Start-Sleep -Seconds 2
        continue
    }

    # Cenario 2: Aparelho nao autorizado
    $unauth = $connectedDevices | Where-Object { $_.Status -eq "unauthorized" }
    if ($unauth) {
        Write-Host ""
        Write-Host "[!] Aparelho detectado, mas a Depuracao USB NAO FOI AUTORIZADA:" -ForegroundColor Yellow
        Write-Host "    Serial: $($unauth.Serial)" -ForegroundColor White
        Write-Host "    -> Olhe para a tela do celular agora!" -ForegroundColor Cyan
        Write-Host "    -> Marque 'Sempre permitir a partir deste computador' e clique em 'Permitir / OK'." -ForegroundColor Cyan
        Write-Host ""
        Start-Sleep -Seconds 3
        continue
    }

    # Cenario 3: Aparelho em modo offline
    $offline = $connectedDevices | Where-Object { $_.Status -eq "offline" }
    if ($offline) {
        Write-Host ""
        Write-Host "[!] Aparelho detectado em estado offline ($($offline.Serial)). Reconecte o cabo USB." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        continue
    }

    # Cenario 4: Aparelhos autorizados
    $readyDevices = $connectedDevices | Where-Object { $_.Status -eq "device" }
    $newDevice = $null

    foreach ($dev in $readyDevices) {
        if (-not $installedSerials.Contains($dev.Serial)) {
            $newDevice = $dev
            break
        }
    }

    if (-not $newDevice) {
        $alreadyList = ($readyDevices | ForEach-Object { $_.Serial }) -join ", "
        Write-Host -NoNewline "`r[OK] Aparelho ($alreadyList) ja configurado. Conecte o proximo celular...   "
        Start-Sleep -Seconds 2
        continue
    }

    Write-Host ""
    Write-Host "--------------------------------------------------------------------" -ForegroundColor DarkCyan
    $serial = $newDevice.Serial

    # Coletar informacoes do aparelho
    $model = (& $adb -s $serial shell getprop ro.product.model).Trim()
    $manufacturer = (& $adb -s $serial shell getprop ro.product.manufacturer).Trim()
    $androidVer = (& $adb -s $serial shell getprop ro.build.version.release).Trim()
    if (-not $model) { $model = "Desconhecido" }
    if (-not $manufacturer) { $manufacturer = "Android" }

    Write-Host "[+] NOVO CELULAR DETECTADO!" -ForegroundColor Green
    Write-Host "    Fabricante : $manufacturer" -ForegroundColor White
    Write-Host "    Modelo     : $model" -ForegroundColor White
    Write-Host "    Versao SO  : Android $androidVer" -ForegroundColor White
    Write-Host "    Serial     : $serial" -ForegroundColor White
    Write-Host ""

    Write-Host "[*] Instalando o aplicativo Phone Finder..." -ForegroundColor Cyan
    $installOutput = & $adb -s $serial install -r -d -g "$apk" 2>&1
    $installText = $installOutput -join " "

    if ($installText -match "Success") {
        Write-Host "[OK] APK instalado com sucesso!" -ForegroundColor Green

        Write-Host "[*] Aplicando permissoes automaticas via ADB..." -ForegroundColor Cyan

        # 1. Isencao de otimizacao de bateria (Doze Mode)
        try {
            & $adb -s $serial shell dumpsys deviceidle whitelist +com.phonefinder 2>&1 | Out-Null
            Write-Host "    [OK] Bateria: Isencao de Doze Mode liberada (mantem conexao ativa)" -ForegroundColor Green
        } catch {
            Write-Host "    [-] Bateria: $_" -ForegroundColor DarkGray
        }

        # 2. Sobrepor a outros apps (Alerta visual 100% vermelho sobre a tela)
        try {
            & $adb -s $serial shell appops set com.phonefinder SYSTEM_ALERT_WINDOW allow 2>&1 | Out-Null
            Write-Host "    [OK] Sobreposicao: 'Sobrepor a outros apps' liberada" -ForegroundColor Green
        } catch {
            Write-Host "    [-] Sobreposicao: $_" -ForegroundColor DarkGray
        }

        # 3. Notificacoes em tela cheia (Android 14+)
        try {
            & $adb -s $serial shell appops set com.phonefinder USE_FULL_SCREEN_INTENT allow 2>&1 | Out-Null
            Write-Host "    [OK] Alarme: Notificacoes em tela cheia liberadas" -ForegroundColor Green
        } catch {}

        # 4. Notificacoes do sistema (Android 13+)
        try {
            & $adb -s $serial shell pm grant com.phonefinder android.permission.POST_NOTIFICATIONS 2>&1 | Out-Null
            Write-Host "    [OK] Notificacoes: Permissao POST_NOTIFICATIONS concedida" -ForegroundColor Green
        } catch {}

        # 5. Execucao continua e autoinicio em 2º plano (Xiaomi / HyperOS / Samsung)
        try {
            & $adb -s $serial shell appops set com.phonefinder AUTO_START allow 2>&1 | Out-Null
            & $adb -s $serial shell appops set com.phonefinder RUN_IN_BACKGROUND allow 2>&1 | Out-Null
            & $adb -s $serial shell appops set com.phonefinder SCHEDULE_EXACT_ALARM allow 2>&1 | Out-Null
            Write-Host "    [OK] Sistema: Execucao continua e alarmes liberados" -ForegroundColor Green
        } catch {}

        # 5. Iniciar o app na tela do aparelho
        Write-Host "[*] Abrindo Phone Finder na tela do celular..." -ForegroundColor Cyan
        try {
            & $adb -s $serial shell am start -n com.phonefinder/.MainActivity 2>&1 | Out-Null
            Write-Host "    [OK] Aplicativo iniciado na tela!" -ForegroundColor Green
        } catch {}

        $installedSerials.Add($serial) | Out-Null
        $totalInstalled++

        Write-Host ""
        Write-Host "====================================================================" -ForegroundColor Green
        Write-Host "   [SUCESSO] APARELHO CONFIGURADO COM SUCESSO! ($totalInstalled concluido(s))" -ForegroundColor Green
        Write-Host "====================================================================" -ForegroundColor Green
        Write-Host "Pronto para o proximo celular!" -ForegroundColor Yellow
        Write-Host "-> Desconecte este cabo USB, conecte o proximo celular." -ForegroundColor White
        Write-Host "-> Pressione [Enter] para continuar, ou digite 'Q' para sair." -ForegroundColor DarkGray
        Write-Host ""

        $ans = Read-Host "Aguardando proximo celular [Enter = Continuar / Q = Sair]"
        if ($ans -eq "q" -or $ans -eq "Q") {
            break
        }
    } else {
        Write-Host "[ERRO] Falha ao instalar o APK no aparelho:" -ForegroundColor Red
        Write-Host "       $installText" -ForegroundColor Red
        Write-Host ""
        Write-Host "Dicas:" -ForegroundColor Yellow
        Write-Host "1. Verifique se o celular esta desbloqueado." -ForegroundColor Yellow
        Write-Host "2. Em aparelhos Xiaomi / HyperOS: ative 'Instalar via USB' nas Opcoes do desenvolvedor." -ForegroundColor Yellow
        Write-Host ""
        $ans = Read-Host "Tentar novamente este aparelho? [Enter = Tentar de novo / P = Pular / Q = Sair]"
        if ($ans -eq "q" -or $ans -eq "Q") {
            break
        } elseif ($ans -eq "p" -or $ans -eq "P") {
            $installedSerials.Add($serial) | Out-Null
        }
    }
}

Write-Host ""
Write-Host "Sessao encerrada. Total de celulares configurados: $totalInstalled" -ForegroundColor Cyan
Write-Host "Ate logo!" -ForegroundColor Gray
Start-Sleep -Seconds 2
