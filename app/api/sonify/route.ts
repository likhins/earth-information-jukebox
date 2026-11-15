import { NextRequest, NextResponse } from 'next/server';
import { SlmSonificationInput, SlmSonificationOutput } from '@/app/lib/datasets';
import { buildProceduralFallback } from '@/app/lib/smlPipeline';

export async function POST(req: NextRequest) {
  let payload: SlmSonificationInput;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://34.93.186.69:11434/api/chat';
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'polaris-slm',
        stream: false,
        keep_alive: -1,
        options: {
          temperature: 0.1,
          repeat_penalty: 1.0,
          num_predict: 1024,
          num_thread: 8,
        },
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama responded with status: ${res.status}`);
    }

    const data = await res.json();
    let rawContent = data.message?.content || '';

    // Strip markdown code fences if polaris-slm returns ```json ... ```
    const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      rawContent = fenceMatch[1];
    }

    const parsed: SlmSonificationOutput = JSON.parse(rawContent.trim());
    parsed.source = 'slm';
    return NextResponse.json(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Ollama SLM inference unreachable or failed. Falling back to procedural sonification.', error);
    // Fallback to deterministic procedural sonification if VM is unreachable
    const fallback = buildProceduralFallback(payload);
    return NextResponse.json(fallback);
  }
}
