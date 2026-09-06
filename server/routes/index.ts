import { Router } from 'express';
import { healthRouter } from './health';
import { systemRouter } from './system';
import { aiRouter } from './ai';
import { cloudRouter } from './cloud';

const router = Router();

router.use('/health', healthRouter);
router.use('/system', systemRouter);
router.use('/ai', aiRouter);
router.use('/cloud', cloudRouter);

export default router;
