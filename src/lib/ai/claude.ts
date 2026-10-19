import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

export const MODEL = 'claude-opus-5-5'

export const client = new Anthropic()

type Effort = 'low' | 'medium' | 'high'

// One Claude call that returns JSON validated against a Zod schema.
export async function parseJson<T extends z.ZodType>(
  schema: T,
  system: string,
  content: Anthropic.ContentBlockParam[],
  effort: Effort = 'medium'
): Promise<z.infer<T>> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: zodOutputFormat(schema) },
  })
  const response = await stream.finalMessage()

  if (response.stop_reason === 'refusal') throw new Error('Claude declined the request')
  if (response.stop_reason === 'max_tokens') throw new Error('Claude response was cut off')

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  return schema.parse(JSON.parse(text))
}
