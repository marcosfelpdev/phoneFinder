<#
.SYNOPSIS
    Utilitário para descoberta de IP local e diagnóstico de portas do Phone Finder.
.DESCRIPTION
    Exibe os endereços IPv4 da máquina local na rede Wi-Fi/Ethernet e verifica o status
    das portas do servidor e do firewall do Windows.
#>

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "       PHONE FINDER — DIAGNÓSTICO DE REDE       " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Obter endereços IPv4 locais
Write-Host "`n[1] Endereços IPv4 detectados nesta máquina:" -ForegroundColor Yellow
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual' -and $_.IPAddress -notmatch '^169\.254\.' }

foreach ($adapter in $adapters) {
    $alias = $adapter.InterfaceAlias
    $ip = $adapter.IPAddress
    Write-Host "  -> Interface: $alias | IPv4: $ip" -ForegroundColor Green
    Write-Host "     URL para celular: http://${ip}:3000/receiver`n" -ForegroundColor White
}

# 2. Testar portas do servidor (padrão: 3000 para web/server ou 3001 para api)
$ports = @(3000, 3001)
Write-Host "[2] Verificação das portas locais ($($ports -join ', ')):" -ForegroundColor Yellow
foreach ($port in $ports) {
    $listener = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Host "  -> Porta $port está em USO (Estado: $($listener.State | Select-Object -First 1))" -ForegroundColor Green
    } else {
        Write-Host "  -> Porta $port está LIVRE" -ForegroundColor Gray
    }
}

# 3. Informações sobre Firewall
Write-Host "`n[3] Regra de Firewall do Windows:" -ForegroundColor Yellow
Write-Host "Caso os celulares não consigam acessar a URL, execute o PowerShell como Administrador e rode:" -ForegroundColor White
Write-Host 'New-NetFirewallRule -DisplayName "Phone Finder Local LAN" -Direction Inbound -LocalPort 3000,3001 -Protocol TCP -Action Allow' -ForegroundColor Cyan
Write-Host "`n=================================================" -ForegroundColor Cyan
