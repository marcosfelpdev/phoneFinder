import { Router, Request, Response } from 'express';
import { getLanInterfaces } from '../utils/lan-ip';
import { getApkPath, getApkInfo } from '../utils/apk-resolver';
import { SystemInfoResponse } from 'shared';

export const systemRouter = Router();

/**
 * Endpoint de verificação de integridade e status do servidor.
 */
systemRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * Retorna as interfaces de rede IPv4 locais detectadas e status do APK para facilitar
 * a conexão e instalação dos celulares na mesma rede Wi-Fi.
 */
systemRouter.get('/network-info', (req: Request, res: Response) => {
  const webPort = parseInt(req.query.webPort as string, 10) || 3000;
  const interfaces = getLanInterfaces(webPort);
  const primaryHost = interfaces.length > 0 ? interfaces[0].ip : 'localhost';
  const apkInfo = getApkInfo(webPort, primaryHost);

  const response: SystemInfoResponse = {
    status: 'online',
    port: parseInt(process.env.PORT || '3001', 10),
    uptimeSeconds: Math.floor(process.uptime()),
    interfaces,
    apkInfo,
  };

  res.json(response);
});

/**
 * Retorna o status e metadados do arquivo APK compilado.
 */
systemRouter.get('/apk/info', (req: Request, res: Response) => {
  const webPort = parseInt(req.query.webPort as string, 10) || 3000;
  const interfaces = getLanInterfaces(webPort);
  const primaryHost = interfaces.length > 0 ? interfaces[0].ip : 'localhost';
  const apkInfo = getApkInfo(webPort, primaryHost);

  res.json(apkInfo);
});

/**
 * Endpoint para download direto do arquivo APK no celular via rede local Wi-Fi.
 */
systemRouter.get(['/apk/download', '/download/apk', '/download/phonefinder.apk'], (_req: Request, res: Response) => {
  const apkPath = getApkPath();

  if (!apkPath) {
    res.status(404).json({
      error: 'Arquivo APK não encontrado no servidor. Compile o projeto Android ou execute .\\gradlew.bat assembleDebug.',
    });
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.download(apkPath, 'PhoneFinder.apk', (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Erro ao transferir arquivo APK.' });
    }
  });
});
