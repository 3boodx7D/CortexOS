import { Router } from 'express';
import { healthRouter } from './health';
import { systemRouter } from './system';

const router = Router();

router.use('/health', healthRouter);
router.use('/system', systemRouter);

export default router;
