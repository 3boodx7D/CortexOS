import { Router, type Request, type Response } from 'express';
import os from 'os';

export const systemRouter = Router();

systemRouter.get('/info', (_req: Request, res: Response) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  res.json({
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    memory: {
      totalGB: +(totalMem / (1024 ** 3)).toFixed(2),
      freeGB: +(freeMem / (1024 ** 3)).toFixed(2),
      usedGB: +(usedMem / (1024 ** 3)).toFixed(2),
      usagePercent: Math.round((usedMem / totalMem) * 100),
    },
    defaultWorkspace: 'D:\\dev26-27',
  });
});
