<script setup>
import { ref } from 'vue';

const props = defineProps({
  config: { type: Object, required: true },
  status: { type: Object, required: true },
  logs: { type: Array, default: () => [] },
});
const emit = defineEmits(['update-config', 'save-config']);

const padlocalToken = ref('');

function setMode(mode) {
  emit('update-config', { wechatMode: mode });
}

function setPuppet(puppet) {
  emit('update-config', { puppet });
  if (puppet === 'wechaty-puppet-padlocal') setMode('wechaty');
}

function save() {
  if (padlocalToken.value.trim()) emit('update-config', { padlocalToken: padlocalToken.value.trim() });
  emit('save-config');
  padlocalToken.value = '';
}

const statusMap = {
  running: '运行中',
  starting: '启动中',
  'waiting-qrcode': '等待扫码',
  stopped: '未启动',
  error: '错误',
};
</script>

<template>
  <aside class="config-panel">
    <div class="section">
      <div class="section-title">微信登录</div>
      <div class="mode-switch">
        <button :class="{ active: config.wechatMode === 'mock' }" @click="setMode('mock')">模拟模式</button>
        <button :class="{ active: config.wechatMode === 'wechaty' }" @click="setMode('wechaty')">真实微信</button>
      </div>
      <label class="field">
        <span>登录驱动</span>
        <select :value="config.puppet" @change="setPuppet($event.target.value)">
          <option value="wechaty-puppet-wechat4u">wechat4u（网页协议，免费）</option>
          <option value="wechaty-puppet-padlocal">padlocal（ipad 协议，需 token）</option>
        </select>
      </label>
      <label v-if="config.puppet === 'wechaty-puppet-padlocal'" class="field">
        <span>PadLocal Token</span>
        <input v-model="padlocalToken" type="password" placeholder="输入你的 token" />
      </label>
      <button class="btn primary full" @click="save">保存配置</button>
      <div class="hint">
        <p v-if="config.wechatMode === 'mock'">模拟模式无需登录，内置演示联系人，开箱即用。</p>
        <p v-else>真实模式：保存后点击顶部"启动"，微信扫码登录。<br />wechat4u 免费但可能被风控；padlocal 稳定但需在 <b>pad-local.com</b> 购买 token。</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">AI 对话</div>
      <div class="ai-status" :class="{ ready: config.hasApiKey }">
        {{ config.hasApiKey ? 'API Key 已配置' : 'API Key 未配置（使用模拟回复）' }}
      </div>
      <div class="kv" v-if="config.hasApiKey">
        <span>模型</span><b>{{ config.model }}</b>
      </div>
      <div class="kv">
        <span>接口地址</span><b>{{ config.baseUrl }}</b>
      </div>
      <label class="field">
        <span>自动回复</span>
        <select :value="config.autoReply" @change="emit('update-config', { autoReply: $event.target.value === 'true' })">
          <option value="true">开启</option>
          <option value="false">关闭</option>
        </select>
      </label>
      <label class="field">
        <span>回复前缀</span>
        <input :value="config.replyPrefix" placeholder="留空则无前缀" @input="emit('update-config', { replyPrefix: $event.target.value })" />
      </label>
      <button class="btn full" @click="emit('save-config')">应用设置</button>
      <div class="hint">
        <p>AI 使用 OpenAI 兼容接口。在 <b>backend/.env</b> 中配置：</p>
        <code>USER_LLM_API_KEY=你的key<br />USER_LLM_BASE_URL=接口地址<br />USER_LLM_MODEL=模型名</code>
        <p>支持 DeepSeek / 通义 / OpenAI 等任何兼容服务。</p>
      </div>
    </div>

    <div class="section log-section">
      <div class="section-title">运行日志</div>
      <div class="logs">
        <div v-for="(l, i) in logs" :key="i" class="log-line" :class="l.level">
          <span class="t">{{ l.ts }}</span> {{ l.text }}
        </div>
        <div v-if="!logs.length" class="hint">暂无日志</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.config-panel { width: 300px; border-left: 1px solid #e5e8ec; background: #fff; overflow-y: auto; }
.section { padding: 16px 18px; border-bottom: 1px solid #e5e8ec; }
.section-title { font-weight: 600; font-size: 14px; margin-bottom: 12px; }
.mode-switch { display: flex; background: #f1f3f6; border-radius: 8px; padding: 3px; margin-bottom: 12px; }
.mode-switch button { flex: 1; border: none; background: transparent; padding: 6px 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
.mode-switch button.active { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #4f46e5; font-weight: 600; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field span { font-size: 12px; color: #6b7280; }
.field select, .field input { border: 1px solid #d0d4dc; border-radius: 6px; padding: 7px 10px; font-size: 13px; outline: none; }
.field select:focus, .field input:focus { border-color: #4f46e5; }
.btn.full { width: 100%; margin-top: 4px; }
.hint { font-size: 12px; color: #8a919f; margin-top: 10px; line-height: 1.6; }
.hint p { margin: 4px 0; }
.hint code { display: block; background: #f6f8fa; border: 1px solid #e5e8ec; border-radius: 6px; padding: 8px; font-size: 11px; color: #374151; margin: 6px 0; word-break: break-all; }
.ai-status { padding: 8px 12px; border-radius: 8px; background: #fef3c7; color: #92400e; font-size: 13px; margin-bottom: 10px; }
.ai-status.ready { background: #dcfce7; color: #166534; }
.kv { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
.kv span { color: #6b7280; }
.log-section { flex: 1; }
.logs { font-size: 12px; font-family: ui-monospace, monospace; }
.log-line { padding: 3px 0; border-bottom: 1px dashed #f1f3f6; word-break: break-all; }
.log-line .t { color: #9ca3af; margin-right: 6px; }
.log-line.error { color: #dc2626; }
</style>
