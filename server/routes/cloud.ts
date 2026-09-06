import { Router } from 'express';
import { supabaseServer } from '../lib/supabase';

export const cloudRouter = Router();

cloudRouter.get('/status', async (_req, res) => {
  const start = Date.now();
  try {
    const { error } = await supabaseServer.from('projects').select('count', { count: 'exact', head: true });
    const latencyMs = Date.now() - start;

    if (error && error.code !== 'PGRST205') {
      res.json({
        ok: true,
        connected: true,
        cluster: 'Supabase Cloud Pro',
        url: process.env.SUPABASE_URL || 'https://eoafqqhojpuigpxrxfwm.supabase.co',
        latencyMs,
        tablesReady: false,
        note: error.message
      });
      return;
    }

    res.json({
      ok: true,
      connected: true,
      cluster: 'Supabase Cloud (Scale Tier)',
      url: process.env.SUPABASE_URL || 'https://eoafqqhojpuigpxrxfwm.supabase.co',
      latencyMs,
      tablesReady: !error,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      connected: false,
      error: err.message || 'Failed to ping Supabase cloud cluster'
    });
  }
});
