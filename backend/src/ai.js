const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('AI 请求超时')), ms));

export function hasApiKey(cfg) {
  return Boolean(cfg.llm.apiKey);
}

export async function chat(messages, cfg) {
  if (!cfg.llm.apiKey) {
    await new Promise((r) => setTimeout(r, 500));
    return '未配置大模型 API Key。请在"机器人配置"页填写 USER_LLM_API_KEY 后启用真正的 AI 回复。';
  }

  const payload = {
    model: cfg.llm.model,
    messages: [
      { role: 'system', content: cfg.llm.systemPrompt },
      ...messages.slice(-20),
    ],
    temperature: 0.7,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${cfg.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.llm.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI 接口返回 ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI 接口返回为空');
    return text;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('AI 请求超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { timeout };
