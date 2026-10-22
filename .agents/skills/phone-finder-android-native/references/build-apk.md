# Runbook — Gerar e Instalar o APK do Phone Finder

> Estado atual: o módulo `apps/android` ainda **não foi compilado** (o ambiente de desenvolvimento não possui Android SDK/JDK/Gradle e o projeto não contém `gradlew`). Erros de compilação no primeiro build devem ser reportados e corrigidos, e este documento atualizado.

## 1. Pré-requisitos (Windows)
- **Android Studio** (Ladybug 2024.2+ ou mais recente). Já inclui o JDK 17 (`jbr`) exigido pelo projeto.
- **Android SDK Platform 35** (SDK Manager → SDK Platforms) e **Build-Tools** correspondentes.
- Versões fixadas no projeto: AGP `8.7.3`, Kotlin `2.0.21`, `compileSdk/targetSdk 35`, `minSdk 24`, Java 17. O AGP 8.7.x exige **Gradle 8.9+**.

## 2. Gerar o APK pelo Android Studio (recomendado)
1. `File > Open` → selecionar a pasta `apps/android` (não a raiz do monorepo).
2. Aguardar o *Gradle Sync*. Se não houver `gradle-wrapper`, aceitar a criação/uso da distribuição Gradle sugerida pelo Studio.
3. `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
4. Clicar em **locate** na notificação. Saída:
   `apps/android/app/build/outputs/apk/debug/app-debug.apk`

## 3. Gerar via linha de comando (após o wrapper existir)
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd apps/android
.\gradlew.bat assembleDebug
```
Para gerar o wrapper se o Gradle estiver instalado: `gradle wrapper --gradle-version 8.9`.

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

## 7. Release assinado (opcional)
`Build > Generate Signed Bundle / APK > APK` com um keystore próprio. Nunca versionar o keystore.
