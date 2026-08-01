import { EventEmitter } from 'events';
import { chat, hasApiKey } from './ai.js';

const HISTORY_LIMIT = 20;

export class BotManager extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.status = 'stopped';
    this.error = null;
    this.qrcode = null;
    this.contacts = [];
    this.sessions = new Map();
    this.bot = null;
    this.mockId = 0;
  }

  getStatus() {
    return {
      status: this.status,
      error: this.error,
      mode: this.cfg.wechatMode,
      qrcode: this.qrcode,
      autoReply: this.cfg.autoReply,
      hasApiKey: hasApiKey(this.cfg),
      model: this.cfg.llm.model,
      replyPrefix: this.cfg.replyPrefix,
      contacts: this.contacts,
    };
  }

  setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.emit('status', this.getStatus());
  }

  async start(overrides = {}) {
    const merged = { ...this.cfg };
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) merged[key] = value;
    }
    this.cfg = merged;
    if (['running', 'starting', 'waiting-qrcode'].includes(this.status)) return this.getStatus();
    this.setStatus('starting');
    try {
      if (this.cfg.wechatMode === 'wechaty') {
        await this.startWechaty();
      } else {
        this.startMock();
      }
    } catch (err) {
      this.setStatus('error', err.message);
      this.emit('error', `启动失败: ${err.message}`);
    }
    return this.getStatus();
  }

  async stop() {
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch (_) {
        /* noop */
      }
      this.bot = null;
    }
    this.qrcode = null;
    this.setStatus('stopped');
    this.emit('log', '机器人已停止');
    return this.getStatus();
  }

  async restart(overrides = {}) {
    await this.stop();
    this.sessions.clear();
    return this.start(overrides);
  }

  async handleIncoming(contactId, displayName, text, isRoom, roomId) {
    if (!text || !text.trim()) return;
    const key = isRoom ? `room:${roomId}` : `person:${contactId}`;
    const history = this.sessions.get(key) || [];
    history.push({ role: 'user', content: text });
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
    this.sessions.set(key, history);

    this.emit('message', {
      type: 'in', contactId, displayName, text, isRoom, roomId, ts: Date.now(),
    });

    if (!this.cfg.autoReply) return;

    try {
      const reply = await chat(history, this.cfg);
      const final = this.cfg.replyPrefix ? `${this.cfg.replyPrefix}${reply}` : reply;
      await this.sendMessage(contactId, displayName, final, isRoom, roomId);
      history.push({ role: 'assistant', content: final });
      this.sessions.set(key, history);
      this.emit('message', {
        type: 'out', contactId, displayName, text: final, isRoom, roomId, ts: Date.now(),
      });
    } catch (err) {
      this.emit('error', `回复 ${displayName} 失败: ${err.message}`);
    }
  }

  async sendMessage(contactId, displayName, text, isRoom, roomId) {
    if (this.cfg.wechatMode === 'wechaty') {
      if (!this.bot) throw new Error('机器人未启动');
      if (isRoom || roomId) {
        const room = await this.bot.Room.find({ id: roomId || contactId });
        if (!room) throw new Error('找不到群聊');
        await room.say(text);
      } else {
        const contact = await this.bot.Contact.find({ id: contactId });
        if (!contact) throw new Error('找不到联系人');
        await contact.say(text);
      }
    } else {
      this.emit('message', {
        type: 'out', contactId, displayName, text, isRoom: false, roomId: null, ts: Date.now(),
      });
    }
  }

  injectMockMessage(contactName, text) {
    const contact = this.contacts.find((c) => c.name === contactName) || this.contacts[0];
    if (!contact) throw new Error('没有可用的模拟联系人');
    if (!text || !text.trim()) return;
    const key = `person:${contact.id}`;
    const history = this.sessions.get(key) || [];
    history.push({ role: 'user', content: text });
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
    this.sessions.set(key, history);

    this.emit('message', {
      type: 'out', contactId: contact.id, displayName: contact.name, text, isRoom: false, roomId: null, ts: Date.now(),
    });

    if (!this.cfg.autoReply) return;
    (async () => {
      try {
        const reply = await chat(history, this.cfg);
        const final = this.cfg.replyPrefix ? `${this.cfg.replyPrefix}${reply}` : reply;
        this.emit('message', {
          type: 'in', contactId: contact.id, displayName: contact.name, text: final, isRoom: false, roomId: null, ts: Date.now(),
        });
        history.push({ role: 'assistant', content: final });
        this.sessions.set(key, history);
      } catch (err) {
        this.emit('error', `回复 ${contact.name} 失败: ${err.message}`);
      }
    })();
  }

  startMock() {
    this.contacts = this.cfg.mockContacts.map((name, i) => ({
      id: `mock-${i + 1}`, name, type: 'contact',
    }));
    this.emit('contacts', this.contacts);
    this.setStatus('running');
    this.emit('log', `模拟模式已启动，内置联系人：${this.cfg.mockContacts.join('、')}`);
  }

  async startWechaty() {
    let WechatyBuilder;
    let puppetName;
    try {
      ({ WechatyBuilder } = await import('wechaty'));
      if (this.cfg.padlocalToken) {
        puppetName = 'wechaty-puppet-padlocal';
        await import(puppetName);
      } else {
        puppetName = this.cfg.puppet;
        await import(puppetName);
      }
    } catch (err) {
      throw new Error(`加载 ${puppetName || 'wechaty'} 失败：${err.message}。请先执行 npm install 安装微信登录驱动。`);
    }

    if (puppetName === 'wechaty-puppet-padlocal') {
      process.env.WECHATY_PUPPET_PADLOCAL_TOKEN = this.cfg.padlocalToken;
    }

    const bot = WechatyBuilder.build({ name: 'wechat-ai-bot', puppet: puppetName });
    this.bot = bot;
    this.sessions.clear();

    bot.on('scan', (qrcode) => {
      this.qrcode = qrcode;
      this.setStatus('waiting-qrcode');
      this.emit('qrcode', qrcode);
      this.emit('log', '请用微信扫码登录');
    });

    bot.on('login', async (user) => {
      this.qrcode = null;
      this.setStatus('running');
      this.emit('log', `微信登录成功：${user.name()}`);
      await this.refreshWechatyContacts();
    });

    bot.on('logout', (user) => {
      this.emit('log', `微信退出登录：${user.name()}`);
      this.setStatus('stopped');
    });

    bot.on('message', async (message) => {
      try {
        if (message.self()) return;
        const room = message.room();
        const isRoom = Boolean(room);
        const contact = message.talker();
        const text = message.text();
        if (!text || !text.trim()) return;
        if (isRoom) {
          const mentioned = await message.mentionSelf().catch(() => false);
          if (!mentioned) return;
          const roomId = room.id;
          const roomTopic = await room.topic().catch(() => '群聊');
          await this.handleIncoming(roomId, `[群]${roomTopic}`, text, true, roomId);
        } else {
          if (contact.id === 'filehelper') return;
          await this.handleIncoming(contact.id, contact.name() || '联系人', text, false, null);
        }
      } catch (err) {
        this.emit('error', `处理消息失败: ${err.message}`);
      }
    });

    bot.on('error', (err) => {
      this.emit('error', `微信客户端错误: ${err.message}`);
    });

    this.emit('log', `正在启动 Wechaty（驱动：${puppetName}）...`);
    await bot.start();
  }

  async refreshWechatyContacts() {
    try {
      const list = [];
      const contacts = await this.bot.Contact.findAll();
      for (const c of contacts) {
        if (c.self()) continue;
        list.push({ id: c.id, name: c.name() || c.id, type: 'contact' });
      }
      const rooms = await this.bot.Room.findAll();
      for (const r of rooms) {
        const topic = await r.topic().catch(() => r.id);
        list.push({ id: r.id, name: `[群]${topic}`, type: 'room' });
      }
      this.contacts = list;
      this.emit('contacts', list);
    } catch (err) {
      this.emit('error', `刷新联系人失败: ${err.message}`);
    }
  }
}
