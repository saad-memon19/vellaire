import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';

export interface AiImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}

export interface AiRequest {
  system: string;
  prompt: string;
  images?: AiImage[];
  maxTokens?: number;
}

/** Every AI provider implements this. Add a new provider = one new class. */
export interface AiProvider {
  readonly name: string;
  complete(req: AiRequest): Promise<string>;
}

class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private client = new Anthropic({ apiKey: config.ai.apiKey || undefined });
  private model = config.ai.model || 'claude-opus-5-5';

  async complete(req: AiRequest) {
    const content: Anthropic.ContentBlockParam[] = [
      ...(req.images || []).map(
        (img): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
        }),
      ),
      { type: 'text', text: req.prompt },
    ];
    // Short writing tasks: low effort keeps them fast and cheap.
    // `fallbacks: "default"` re-runs a declined request on a suitable model in the same call.
    const params = {
      model: this.model,
      max_tokens: req.maxTokens || 2000,
      system: req.system,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content }],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
    const res = await this.client.beta.messages.create(params);
    if (res.stop_reason === 'refusal') throw new Error('The AI declined this request');
    return res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }
}

class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private model = config.ai.model || 'gpt-4o-mini';

  async complete(req: AiRequest) {
    const userContent: any[] = [
      ...(req.images || []).map((img) => ({
        type: 'image_url',
        image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
      })),
      { type: 'text', text: req.prompt },
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.ai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens || 2000,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const json: any = await res.json();
    return String(json.choices?.[0]?.message?.content || '').trim();
  }
}

export function createProvider(): AiProvider | null {
  if (!config.ai.apiKey && config.ai.provider !== 'claude') return null;
  switch (config.ai.provider) {
    case 'claude':
      return config.ai.apiKey || process.env.ANTHROPIC_API_KEY ? new ClaudeProvider() : null;
    case 'openai':
      return new OpenAiProvider();
    default:
      return null;
  }
}
