import os from 'os';
import { LanInterfaceInfo } from 'shared';

/**
 * Descobre todos os endereços IPv4 da máquina local na rede Wi-Fi / Ethernet.
 */
export function getLanInterfaces(webPort: number = 3000): LanInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: LanInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // Filtrar apenas IPv4, não-internos (não 127.0.0.1) e não autoconfigurados (169.254.x.x)
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        results.push({
          name,
          ip: addr.address,
          receiverUrl: `http://${addr.address}:${webPort}/receiver`,
          dashboardUrl: `http://${addr.address}:${webPort}`,
          apkDownloadUrl: `http://${addr.address}:${webPort}/api/apk/download`,
        });
      }
    }
  }

  // Fallback caso não encontre nenhuma interface física externa
  if (results.length === 0) {
    results.push({
      name: 'localhost',
      ip: '127.0.0.1',
      receiverUrl: `http://localhost:${webPort}/receiver`,
      dashboardUrl: `http://localhost:${webPort}`,
      apkDownloadUrl: `http://localhost:${webPort}/api/apk/download`,
    });
  }

  return results;
}
