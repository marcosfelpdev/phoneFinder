/**
 * Informações de interface de rede local (LAN).
 */
export interface LanInterfaceInfo {
  name: string;
  ip: string;
  receiverUrl: string;
  dashboardUrl: string;
  apkDownloadUrl: string;
}

/**
 * Informações do arquivo APK disponível para download local.
 */
export interface ApkFileInfo {
  available: boolean;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMb: string;
  downloadUrl: string;
  lastModified?: string;
}

/**
 * Informações do sistema e status do servidor local.
 */
export interface SystemInfoResponse {
  status: 'online';
  port: number;
  uptimeSeconds: number;
  interfaces: LanInterfaceInfo[];
  apkInfo?: ApkFileInfo;
}
