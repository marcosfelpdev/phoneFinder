# Runbook — Gerar e Instalar o APK do Phone Finder

> Estado atual: `assembleDebug` foi validado com sucesso (BUILD SUCCESSFUL, APK de ~6 MB) com Gradle Wrapper 8.9 + **JDK 17** + Android SDK Platform 35. O wrapper (`gradlew`, `gradle/wrapper`) está versionado em `apps/android`.

> [!IMPORTANT]
> O Gradle 8.9 **não roda em JDK 25** (erro opaco `What went wrong: 25.0.3`). O Android Studio recente (262+) embarca o JBR 25. Use sempre um **JDK 17** para o Gradle (ver seção 2, passo 2).

## 1. Pré-requisitos (Windows)
- **Android Studio** (Ladybug 2024.2+ ou mais recente).
- **JDK 17** (Temurin/Eclipse Adoptium). Studios recentes trazem JBR 25, incompatível com Gradle 8.9.
- **Android SDK Platform 35** (SDK Manager → SDK Platforms) e **Build-Tools** correspondentes.
- Versões fixadas no projeto: AGP `8.7.3`, Kotlin `2.0.21`, `compileSdk/targetSdk 35`, `minSdk 24`, Java 17. O AGP 8.7.x exige **Gradle 8.9+**.

## 2. Gerar o APK pelo Android Studio (recomendado)
1. `File > Open` → selecionar a pasta `apps/android` (não a raiz do monorepo).
2. Em `File > Settings > Build, Execution, Deployment > Build Tools > Gradle`, definir **Gradle JDK = 17** (se não listado: *Download JDK...* → versão 17). Depois aguardar o *Gradle Sync*.
3. `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
4. Clicar em **locate** na notificação. Saída:
   `apps/android/app/build/outputs/apk/debug/app-debug.apk`

## 3. Gerar via linha de comando (após o wrapper existir)
```powershell
$env:JAVA_HOME = "<caminho do JDK 17>"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd apps/android
.\gradlew.bat assembleDebug
```
É necessário `apps/android/local.properties` com `sdk.dir=...` (arquivo local, ignorado pelo git). Na primeira execução o Gradle baixa o Android SDK Platform 35 sozinho.

## 4. Instalar no celular
- **Via cabo (ADB)**: ativar *Depuração USB* e executar `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- **Via arquivo**: copiar o `.apk` para o celular, abri-lo e permitir "Instalar apps desconhecidos" para o gerenciador de arquivos usado.

## 5. Configuração obrigatória no celular (após instalar)
1. Abrir o app e informar a URL do servidor: `http://<IPv4-do-PC>:3001` (porta 3001, **não** a 3000). O padrão embutido é `http://192.168.1.4:3001`.
2. Conceder a permissão de **Notificações** (Android 13+).
3. Tocar em **Configurar Bateria Sem Restrições** e permitir.
4. Android 14+: conferir *Configurações > Apps > Acesso especial > Notificações em tela cheia* e habilitar para o Phone Finder.
5. Fabricantes agressivos (Xiaomi/MIUI, Samsung, Huawei, Oppo): habilitar *Início automático* e *Exibir pop-ups durante execução em segundo plano*, e travar o app na lista de recentes.
6. No PC, liberar as portas 3000 e 3001 no Firewall (ver README seção 6). PC e celular na mesma rede Wi-Fi.

## 6. Teste de aceitação em segundo plano
1. Gerar código de pareamento no dashboard e parear pelo app.
2. Bloquear o celular e apagar a tela.
3. Clicar em **Localizar Celular** no card: a tela deve acender em vermelho por 5 s com som de alarme e vibração.
4. Se a tela não acender mas o som/vibração ocorrerem, revisar os itens 4 e 5 acima.

## 7. Dispositivos validados
- **Samsung Galaxy A21s (SM-A217M), Android 12 / One UI**: instalação via `adb install -r` OK, `PhoneFinderForegroundService` com `isForeground=true`, app conecta ao servidor (`Conectado (Wi-Fi)`), celular em `192.168.1.19` alcança o PC em `192.168.1.4:3001`.
- **Xiaomi / POCO (25078PC3EG), Android 15 / HyperOS**: instalação via `adb install -r` OK, IP `192.168.1.2`, app conectado e foreground service ativo com o novo ícone launcher personalizado.
- **Diferenças por SO móvel**:
  - **Android 12**: não requer permissão em tempo de execução `POST_NOTIFICATIONS`.
  - **Android 13+ (incluindo Android 15)**: requer confirmação de permissão de Notificações (`POST_NOTIFICATIONS`) e liberação de *Notificações em tela cheia* para acordar o display bloqueado.
  - **Xiaomi/MIUI/HyperOS**: para instalação remota via ADB, exige ativar "Instalar via USB" nas *Opções do desenvolvedor*.
  - **Samsung One UI**: para segundo plano confiável, desativar otimização em *Bateria > Limites de uso em segundo plano > Apps que nunca ficam em suspensão*.

## 8. Release assinado (opcional)
`Build > Generate Signed Bundle / APK > APK` com um keystore próprio. Nunca versionar o keystore.
