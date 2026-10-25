import 'server-only';
import type { AiProvider, GenerateRequest, GenerateResult } from './provider';

/** Google Gemini over REST with JSON-schema output. Paid key only: free-tier keys may be used for training. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.input }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: req.jsonSchema,
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return {
      text,
      model: this.model,
      tokensIn: json.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
