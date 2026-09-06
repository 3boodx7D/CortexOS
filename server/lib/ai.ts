const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || 'AQ.Ab8RN6JMmZErPnm2vKorpgIH8Sjc4m04zDPqr8mHFN4GTkFSgw';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-85563b65c56f4ff7a6559808635ffe6c';

export interface AISummaryResult {
  summary: string;
  provider: 'gemini' | 'deepseek' | 'fallback';
  model: string;
}

export async function askGemini(prompt: string, systemInstruction = ''): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GOOGLE_AI_KEY}`;
  
  const contents: any[] = [];
  if (systemInstruction) {
    contents.push({
      role: 'user',
      parts: [{ text: `System Instruction: ${systemInstruction}` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will adhere strictly to these instructions.' }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google AI error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No content returned from Google AI');
  }
  return text.trim();
}

export async function askDeepSeek(prompt: string, systemInstruction = ''): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DeepSeek AI error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No content returned from DeepSeek');
  }
  return text.trim();
}

export async function generateAcademicSummary(lectureText: string, preferredEngine?: 'gemini' | 'deepseek'): Promise<AISummaryResult> {
  const prompt = `You are the CortexOS Neural Synthesis Engine. Synthesize the following lecture or notes into a high-density, crystal-clear executive summary. Focus on core architectural principles, trade-offs, and critical definitions.
Keep it between 3 to 5 sentences of punchy, elegant insight.

Lecture Text:
"""
${lectureText}
"""`;

  const systemInstruction = 'You are an advanced academic AI that delivers clean, highly informative summaries without filler words.';

  // Attempt preferred or primary (Google Gemini)
  if (preferredEngine === 'deepseek') {
    try {
      const summary = await askDeepSeek(prompt, systemInstruction);
      return { summary, provider: 'deepseek', model: 'deepseek-chat' };
    } catch (deepseekErr) {
      console.warn('[AI] DeepSeek failed, attempting Google Gemini fallback:', deepseekErr);
    }
  }

  try {
    const summary = await askGemini(prompt, systemInstruction);
    return { summary, provider: 'gemini', model: 'gemini-3.6-flash' };
  } catch (geminiErr) {
    console.warn('[AI] Gemini failed, attempting DeepSeek fallback:', geminiErr);
    try {
      const summary = await askDeepSeek(prompt, systemInstruction);
      return { summary, provider: 'deepseek', model: 'deepseek-chat' };
    } catch (deepseekErr) {
      console.error('[AI] Both Gemini and DeepSeek failed:', deepseekErr);
      throw new Error('AI engines unavailable: ' + ((geminiErr as Error)?.message || (deepseekErr as Error)?.message));
    }
  }
}
