const OPENAI_ENDPOINT='https://api.openai.com/v1/responses';
const GROQ_ENDPOINT='https://api.groq.com/openai/v1/responses';

export function aiConfigured() {
  return Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

export function aiProvider() {
  return process.env.GROQ_API_KEY ? 'groq' : (process.env.OPENAI_API_KEY ? 'openai' : 'none');
}

export function aiModel() {
  return process.env.AI_MODEL || (process.env.GROQ_API_KEY ? 'openai/gpt-oss-120b' : (process.env.OPENAI_MODEL || 'gpt-5.4-mini'));
}

export async function requestStructured({ input, schema, name }) {
  const groq = Boolean(process.env.GROQ_API_KEY);
  const key = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  const response = await fetch(groq ? GROQ_ENDPOINT : OPENAI_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: aiModel(),
      input,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const data = await response.json();
  const output = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!output) throw new Error('AI returned no structured output.');
  return JSON.parse(output);
}
