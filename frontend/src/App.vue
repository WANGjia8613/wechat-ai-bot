<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { api } from './api/http.js';
import { useWebSocket } from './composables/useWebSocket.js';
import QRCode from 'qrcode';
import ContactList from './components/ContactList.vue';
import ChatWindow from './components/ChatWindow.vue';
import ConfigPanel from './components/ConfigPanel.vue';

const status = reactive({
  status: 'stopped',
  mode: 'mock',
  qrcode: null,
  autoReply: true,
  hasApiKey: false,
  model: '',
  error: null,
});
const config = reactive({
  wechatMode: 'mock',
  puppet: 'wechaty-puppet-wechat4u',
  hasPadlocalToken: false,
  hasApiKey: false,
  model: '',
  baseUrl: '',
  autoReply: true,
  replyPrefix: '',
  mockContacts: [],
});
const contacts = ref([]);
const selectedId = ref(null);
const messagesByContact = reactive({});
const logs = ref([]);
const showQr = ref(false);
const loading = ref(false);

const statusText = computed(() => {
  const map = {
    running: '运行中',
    starting: '启动中',
    'waiting-qrcode': '等待扫码',
    stopped: '未启动',
    error: '错误',
  };
  return map[status.status] || status.status;
});

const selectedContact = computed(() => contacts.value.find((c) => c.id === selectedId.value) || null);
const selectedMessages = computed(() => messagesByContact[selectedId.value] || []);

function addLog(text, level = 'info') {
  logs.value.push({ text, level, ts: new Date().toLocaleTimeString() });
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200);
}

function handleWsMessage(msg) {
  if (msg.type === 'status') {
    Object.assign(status, msg.data);
    if (status.qrcode) showQr.value = true;
    else if (msg.data.qrcode === null) showQr.value = false;
  } else if (msg.type === 'qrcode') {
    status.qrcode = msg.data;
    showQr.value = true;
  } else if (msg.type === 'contacts') {
    contacts.value = msg.data;
    if (!selectedId.value && msg.data.length) selectedId.value = msg.data[0].id;
  } else if (msg.type === 'message') {
    if (msg.data.seq && msg.data.seq > msgCursor.value) msgCursor.value = msg.data.seq;
    handleMessage(msg.data);
  } else if (msg.type === 'log') {
    addLog(msg.data);
  } else if (msg.type === 'error') {
    addLog(msg.data, 'error');
  }
}

function handleMessage(data) {
  const key = data.isRoom ? `room:${data.roomId}` : `person:${data.contactId}`;
  if (!messagesByContact[key]) messagesByContact[key] = [];
  messagesByContact[key].push(data);
  if (data.isRoom) {
    const room = contacts.value.find((c) => c.id === data.roomId);
    if (room && selectedId.value !== room.id) {
      room.unread = (room.unread || 0) + 1;
    }
  } else {
    const c = contacts.value.find((x) => x.id === data.contactId);
    if (c && selectedId.value !== c.id) c.unread = (c.unread || 0) + 1;
  }
}

const msgCursor = ref(0);
let pollTimer = null;

async function pollMessages() {
  try {
    if (!contacts.value.length) {
      const cl = await api.contacts();
      if (cl.length) {
        contacts.value = cl;
        if (!selectedId.value) selectedId.value = cl[0].id;
      }
    }
    const res = await api.messages(msgCursor.value);
    if (res.messages && res.messages.length) {
      for (const m of res.messages) {
        if (m.seq > msgCursor.value) msgCursor.value = m.seq;
        handleMessage(m);
      }
    }
  } catch (_) {
    /* 轮询失败静默 */
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollMessages, 3000);
  pollMessages();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

const { connected } = useWebSocket(handleWsMessage);
watch(
  connected,
  (on) => {
    if (on) stopPolling();
    else startPolling();
  },
  { immediate: true }
);

async function refresh() {
  try {
    Object.assign(config, await api.config());
    Object.assign(status, await api.status());
    contacts.value = await api.contacts();
    if (!selectedId.value && contacts.value.length) selectedId.value = contacts.value[0].id;
  } catch (err) {
    addLog(`加载失败: ${err.message}`, 'error');
  }
}

async function startBot() {
  loading.value = true;
  try {
    const res = await api.start({
      wechatMode: config.wechatMode,
      puppet: config.puppet,
    });
    Object.assign(status, res);
    addLog(`启动请求已发送，当前状态: ${statusText.value}`);
    if (!contacts.value.length) {
      const cl = await api.contacts();
      if (cl.length) {
        contacts.value = cl;
        if (!selectedId.value) selectedId.value = cl[0].id;
      }
    }
  } catch (err) {
    addLog(`启动失败: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
}

async function stopBot() {
  loading.value = true;
  try {
    await api.stop();
    addLog('已发送停止请求');
  } catch (err) {
    addLog(`停止失败: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleSend(text) {
  if (!text.trim() || !selectedContact.value) return;
  const contact = selectedContact.value;
  const key = `person:${contact.id}`;
  if (!messagesByContact[key]) messagesByContact[key] = [];
  messagesByContact[key].push({ type: 'out', text, displayName: contact.name, ts: Date.now(), self: true });
  if (status.mode === 'mock') {
    try {
      await api.mockInject({ contactName: contact.name, text });
    } catch (err) {
      addLog(`发送失败: ${err.message}`, 'error');
    }
  } else {
    try {
      await api.send({ contactId: contact.id, text, isRoom: contact.type === 'room' });
    } catch (err) {
      addLog(`发送失败: ${err.message}`, 'error');
    }
  }
}

const testReply = ref('');
async function handleTestChat(text) {
  testReply.value = '思考中...';
  try {
    const res = await api.chat(text);
    testReply.value = res.reply;
  } catch (err) {
    testReply.value = `错误: ${err.message}`;
  }
}

async function qrcodeDataUrl() {
  if (!status.qrcode) return '';
  if (/^(data:|https?:)/.test(status.qrcode)) return status.qrcode;
  return await QRCode.toDataURL(status.qrcode, { width: 280, margin: 2 });
}

function selectContact(id) {
  selectedId.value = id;
  const c = contacts.value.find((x) => x.id === id);
  if (c) delete c.unread;
}

onMounted(refresh);
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🤖</span>
        <div>
          <h1>微信 AI Bot 控制台</h1>
          <span class="sub">Ubuntu 一键部署 · Wechaty + OpenAI 兼容接口</span>
        </div>
      </div>
      <div class="actions">
        <span class="ws-dot" :class="{ on: connected }"></span>
        <span class="mode-badge">{{ status.mode === 'wechaty' ? '真实微信' : '模拟模式' }}</span>
        <span class="status-badge" :class="status.status">{{ statusText }}</span>
        <button class="btn primary" :disabled="loading" @click="startBot">启动</button>
        <button class="btn danger" :disabled="loading" @click="stopBot">停止</button>
      </div>
    </header>

    <main class="main">
      <ContactList :contacts="contacts" :selected-id="selectedId" @select="selectContact" />
      <ChatWindow
        :contact="selectedContact"
        :messages="selectedMessages"
        :mode="status.mode"
        :test-reply="testReply"
        @send="handleSend"
        @test-chat="handleTestChat"
      />
      <ConfigPanel
        :config="config"
        :status="status"
        :logs="logs"
        @update-config="Object.assign(config, $event)"
        @save-config="api.updateConfig(config)"
      />
    </main>

    <div v-if="showQr" class="qr-mask" @click.self="showQr = false">
      <div class="qr-card">
        <h3>微信扫码登录</h3>
        <p>请使用微信扫一扫完成登录</p>
        <img v-if="status.qrcode" :src="qrcodeDataUrl" class="qr-img" />
        <button class="btn" @click="showQr = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style>
.layout { display: flex; flex-direction: column; height: 100vh; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e5e8ec; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand .logo { font-size: 28px; }
.brand h1 { margin: 0; font-size: 18px; }
.brand .sub { font-size: 12px; color: #8a919f; }
.actions { display: flex; align-items: center; gap: 10px; }
.ws-dot { width: 8px; height: 8px; border-radius: 50%; background: #d0d4dc; }
.ws-dot.on { background: #34c759; }
.mode-badge, .status-badge { font-size: 12px; padding: 3px 10px; border-radius: 12px; }
.mode-badge { background: #eef2ff; color: #4f46e5; }
.status-badge.running { background: #dcfce7; color: #16a34a; }
.status-badge.starting, .status-badge.waiting-qrcode { background: #fef9c3; color: #ca8a04; }
.status-badge.stopped { background: #e5e8ec; color: #6b7280; }
.status-badge.error { background: #fee2e2; color: #dc2626; }
.btn { border: 1px solid #d0d4dc; background: #fff; padding: 6px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.btn:hover { background: #f5f7fa; }
.btn.primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.btn.primary:hover { background: #4338ca; }
.btn.danger { color: #dc2626; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.main { flex: 1; display: flex; overflow: hidden; }
.qr-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.qr-card { background: #fff; padding: 24px 32px; border-radius: 12px; text-align: center; }
.qr-card h3 { margin: 0 0 4px; }
.qr-card p { color: #8a919f; font-size: 13px; }
.qr-img { width: 280px; height: 280px; margin: 12px 0; border: 1px solid #e5e8ec; border-radius: 8px; }
</style>
