type Lang = 'th' | 'en' | 'zh' | 'ja' | 'my' | 'km';

interface TrForm {
  trade_name: string;
  generic_name: string;
  usage: string;
  indication: string;
  warning: string;
  storage: string;
}

interface RequestBody {
  source_lang: Lang;
  fields: TrForm;
  target_langs: Lang[];
}

const LANG_NAMES: Record<Lang, string> = {
  th: 'Thai',
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  my: 'Burmese (Myanmar)',
  km: 'Khmer (Cambodian)',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { source_lang, fields, target_langs } = body;

  if (!source_lang || !fields || !target_langs || target_langs.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing API key' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const targetLangList = target_langs.map((l) => `- ${l}: ${LANG_NAMES[l]}`).join('\n');
  const sourceContent = [
    `trade_name: ${fields.trade_name || '(empty)'}`,
    `generic_name: ${fields.generic_name || '(empty)'}`,
    `usage: ${fields.usage || '(empty)'}`,
    `indication: ${fields.indication || '(empty)'}`,
    `warning: ${fields.warning || '(empty)'}`,
    `storage: ${fields.storage || '(empty)'}`,
  ].join('\n');

  const prompt = `You are a professional pharmaceutical translator for a Thai pharmacy.
Translate these medicine label fields from ${LANG_NAMES[source_lang]} into each target language.

RULES:
1. Output ONLY valid JSON — no markdown, no code fences, no explanation.
2. Keep translations SHORT and CONCISE — labels are printed on a 90x65mm sticker.
3. Use standard pharmaceutical terminology for each language.
4. For Burmese (my): use standard Myanmar script with correct Unicode.
5. For Khmer (km): use standard Khmer script with correct Unicode.
6. If a field is "(empty)", output "" for that field in all languages.
7. Preserve brand names (trade_name) unless a universally standard localized form exists.

Source language: ${LANG_NAMES[source_lang]}
Source content:
${sourceContent}

Target languages:
${targetLangList}

Return a JSON object keyed by language code. Each value must have exactly these keys:
trade_name, generic_name, usage, indication, warning, storage

Translate now:`;

  let rawContent: string;
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    rawContent = groqData.choices?.[0]?.message?.content ?? '';
    if (!rawContent) throw new Error('Empty response from Groq');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Groq API error: ${message}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonText = rawContent
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON from Gemini', raw: rawContent }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const result: Partial<Record<Lang, TrForm>> = {};
  for (const lang of target_langs) {
    const raw = parsed[lang] as Record<string, string> | undefined;
    result[lang] = {
      trade_name:   String(raw?.trade_name   ?? ''),
      generic_name: String(raw?.generic_name ?? ''),
      usage:        String(raw?.usage        ?? ''),
      indication:   String(raw?.indication   ?? ''),
      warning:      String(raw?.warning      ?? ''),
      storage:      String(raw?.storage      ?? ''),
    };
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
