/**
 * Informações de interface de rede local (LAN).
 */
export interface LanInterfaceInfo {
  name: string;
  ip: string;
  receiverUrl: string;
  dashboardUrl: string;
}

/**
 * Informações do sistema e status do servidor local.
 */
export interface SystemInfoResponse {
  status: 'online';
  port: number;
  uptimeSeconds: number;
  interfaces: LanInterfaceInfo[];
}
