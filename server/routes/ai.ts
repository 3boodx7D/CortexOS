import { Router } from 'express';
import { generateAcademicSummary, askGemini, askDeepSeek } from '../lib/ai';

export const aiRouter = Router();

aiRouter.get('/status', async (_req, res) => {
  res.json({
    status: 'online',
    engines: [
      { id: 'gemini', name: 'Google Gemini 3.6 Flash', active: true, default: true },
      { id: 'deepseek', name: 'DeepSeek Chat (V4-Flash)', active: true, fallback: true }
    ],
    timestamp: new Date().toISOString()
  });
});

aiRouter.post('/summarize', async (req, res) => {
  try {
    const { text, engine } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }
    const result = await generateAcademicSummary(text, engine);
    res.json(result);
  } catch (err: any) {
    console.error('[AI Route] Summarize error:', err);
    res.status(500).json({ error: err.message || 'AI synthesis failed' });
  }
});

aiRouter.post('/chat', async (req, res) => {
  try {
    const { message, system, engine = 'gemini' } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    let reply: string;
    let provider = engine;
    if (engine === 'deepseek') {
      try {
        reply = await askDeepSeek(message, system);
      } catch {
        reply = await askGemini(message, system);
        provider = 'gemini (fallback)';
      }
    } else {
      try {
        reply = await askGemini(message, system);
      } catch {
        reply = await askDeepSeek(message, system);
        provider = 'deepseek (fallback)';
      }
    }

    res.json({ reply, provider });
  } catch (err: any) {
    console.error('[AI Route] Chat error:', err);
    res.status(500).json({ error: err.message || 'AI chat failed' });
  }
});
