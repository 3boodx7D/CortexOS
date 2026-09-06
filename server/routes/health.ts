import { Router, type Request, type Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'CortexOS Neural Engine',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
