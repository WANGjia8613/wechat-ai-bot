import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { BotManager } from './bot.js';
import { chat, hasApiKey } from './ai.js';

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const bot = new BotManager(config);

const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'status', data: bot.getStatus() }));
  ws.on('close', () => clients.delete(ws));
});

const broadcast = (type, data) => {
  const msg = JSON.stringify({ type, data });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
};

for (const ev of ['status', 'qrcode', 'message', 'contacts', 'error', 'log']) {
  bot.on(ev, (data) => broadcast(ev, data));
}

bot.on('error', (data) => console.error(`[bot-error] ${data}`));
bot.on('log', (data) => console.log(`[bot-log] ${data}`));
bot.on('message', (data) => console.log(`[bot-message] ${data.type} from=${data.displayName}: ${String(data.text).slice(0, 60)}`));

const publicConfig = () => ({
  wechatMode: config.wechatMode,
  puppet: config.puppet,
  hasPadlocalToken: Boolean(config.padlocalToken),
  hasApiKey: hasApiKey(config),
  model: config.llm.model,
  baseUrl: config.llm.baseUrl,
  autoReply: config.autoReply,
  replyPrefix: config.replyPrefix,
  mockContacts: config.mockContacts,
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

app.put('/api/config', (req, res) => {
  const { autoReply, replyPrefix, wechatMode, systemPrompt, padlocalToken, puppet } = req.body || {};
  if (typeof autoReply === 'boolean') {
    config.autoReply = autoReply;
    bot.cfg.autoReply = autoReply;
  }
  if (typeof replyPrefix === 'string') config.replyPrefix = replyPrefix;
  if (typeof systemPrompt === 'string' && systemPrompt) config.llm.systemPrompt = systemPrompt;
  if (wechatMode === 'mock' || wechatMode === 'wechaty') {
    config.wechatMode = wechatMode;
    bot.cfg.wechatMode = wechatMode;
  }
  if (typeof padlocalToken === 'string' && padlocalToken) {
    config.padlocalToken = padlocalToken;
    bot.cfg.padlocalToken = padlocalToken;
  }
  if (typeof puppet === 'string' && puppet) {
    config.puppet = puppet;
    bot.cfg.puppet = puppet;
  }
  res.json(publicConfig());
});

app.get('/api/bot/status', (_req, res) => {
  res.json(bot.getStatus());
});

app.post('/api/bot/start', async (req, res) => {
  const { wechatMode, puppet, padlocalToken, autoReply } = req.body || {};
  try {
    const status = await bot.start({
      wechatMode: wechatMode || undefined,
      puppet: puppet || undefined,
      padlocalToken: padlocalToken || undefined,
      autoReply: autoReply ?? undefined,
    });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/stop', async (_req, res) => {
  res.json(await bot.stop());
});

app.post('/api/bot/restart', async (req, res) => {
  const { wechatMode, puppet, padlocalToken, autoReply } = req.body || {};
  try {
    const status = await bot.restart({
      wechatMode: wechatMode || undefined,
      puppet: puppet || undefined,
      padlocalToken: padlocalToken || undefined,
      autoReply: autoReply ?? undefined,
    });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/send', async (req, res) => {
  const { contactId, text, isRoom } = req.body || {};
  if (!contactId || !text) return res.status(400).json({ error: 'contactId 和 text 必填' });
  try {
    const contact = bot.contacts.find((c) => c.id === contactId) || { name: contactId };
    await bot.sendMessage(contactId, contact.name, text, Boolean(isRoom), isRoom ? contactId : null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/mock-inject', async (req, res) => {
  const { contactName, text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text 必填' });
  try {
    await bot.injectMockMessage(contactName, text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contacts', (_req, res) => {
  res.json(bot.contacts);
});

app.post('/api/chat', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text 必填' });
  try {
    const reply = await chat([{ role: 'user', content: text }], config);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[wechat-ai-bot] 生产模式：已托管前端构建产物 ${distDir}`);
} else {
  console.log('[wechat-ai-bot] 开发模式：未发现前端构建产物，请通过 Vite dev server 访问');
}

server.listen(config.port, () => {
  console.log(`[wechat-ai-bot] 后端服务已启动: http://localhost:${config.port}`);
  console.log(`[wechat-ai-bot] 微信模式: ${config.wechatMode}  |  AI: ${hasApiKey(config) ? '已配置' : '未配置(模拟回复)'}`);
  console.log(`[wechat-ai-bot] WebSocket: ws://localhost:${config.port}/ws`);
});
