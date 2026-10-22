import { Router, Request, Response } from 'express';
import { getLanInterfaces } from '../utils/lan-ip';
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
 * Retorna as interfaces de rede IPv4 locais detectadas para facilitar
 * a conexão dos celulares na mesma rede Wi-Fi.
 */
systemRouter.get('/network-info', (req: Request, res: Response) => {
  const webPort = parseInt(req.query.webPort as string, 10) || 3000;
  const interfaces = getLanInterfaces(webPort);

  const response: SystemInfoResponse = {
    status: 'online',
    port: parseInt(process.env.PORT || '3001', 10),
    uptimeSeconds: Math.floor(process.uptime()),
    interfaces,
  };

  res.json(response);
});
