// ============================================================================
// AI AGENT LOCK: PRODUCTION SLM PIPELINE — DO NOT MODIFY THIS FILE.
// See AGENTS.md for architectural boundaries.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { SlmSonificationInput, SlmSonificationOutput } from '@/app/lib/datasets';
import { buildProceduralFallback } from '@/app/lib/smlPipeline';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let payload: SlmSonificationInput;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  // 1. Dynamic timeout: 90s for local testing, 58s for Vercel production
  const timeoutMs = process.env.NODE_ENV === 'development' ? 90000 : 58000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link client abort signal so cancelling from browser immediately terminates TCP to Ollama
  if (req.signal.aborted) {
    clearTimeout(timeoutId);
    return new Response(null, { status: 499 });
  }

  const onClientAbort = () => {
    controller.abort();
  };
  req.signal.addEventListener('abort', onClientAbort, { once: true });

  const combinedSignal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any([req.signal, controller.signal])
      : controller.signal;

  try {
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://34.93.186.69:11434/api/chat';
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: combinedSignal,
      body: JSON.stringify({
        model: 'polaris-slm',
        stream: false,
        keep_alive: -1,
        options: {
          temperature: 0.1,
          repeat_penalty: 1.0,
          num_predict: 850,
          num_thread: 8,
        },
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });

    clearTimeout(timeoutId);
    req.signal.removeEventListener('abort', onClientAbort);

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
    console.log(
      '✅ [/api/sonify] Served via LIVE POLARIS-SLM | Scale:',
      parsed?.musical_params?.scale,
      '| BPM:',
      parsed?.musical_params?.bpm
    );
    return NextResponse.json(parsed);
  } catch (error) {
    clearTimeout(timeoutId);
    req.signal.removeEventListener('abort', onClientAbort);

    if (req.signal.aborted) {
      console.log('⏹️ [/api/sonify] Client closed connection (499), cancelled Ollama job');
      return new Response(null, { status: 499 });
    }

    const reason = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ [/api/sonify] Served via PROCEDURAL FALLBACK | Reason:', reason);

    // Fallback to deterministic procedural sonification with attached failure reason
    const fallback = buildProceduralFallback(payload);
    fallback.fallback_reason = reason;
    return NextResponse.json(fallback);
  }
}
