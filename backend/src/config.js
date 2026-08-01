import dotenv from 'dotenv';

dotenv.config();

const bool = (v, def) => {
  if (v === undefined) return def;
  return v === 'true' || v === '1';
};

export const config = {
  port: Number(process.env.PORT) || 3001,
  wechatMode: process.env.WECHAT_MODE || 'mock',
  puppet: process.env.WECHATY_PUPPET || 'wechaty-puppet-wechat4u',
  padlocalToken: process.env.PADLOCAL_TOKEN || '',
  llm: {
    apiKey: process.env.USER_LLM_API_KEY || '',
    baseUrl: (process.env.USER_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.USER_LLM_MODEL || 'gpt-3.5-turbo',
    systemPrompt: process.env.SYSTEM_PROMPT || '你是一个友善、简洁的微信聊天助手，请用中文回复用户，回答尽量简短自然。',
  },
  autoReply: bool(process.env.AUTO_REPLY, true),
  replyPrefix: process.env.REPLY_PREFIX || '',
  mockContacts: (process.env.MOCK_CONTACTS || '小明,小红,测试群').split(',').map((s) => s.trim()).filter(Boolean),
};
