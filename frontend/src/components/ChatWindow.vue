<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  contact: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  mode: { type: String, default: 'mock' },
  testReply: { type: String, default: '' },
});
const emit = defineEmits(['send', 'test-chat']);

const inputText = ref('');
const testText = ref('');
const listRef = ref(null);

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
  }
);

function onSend() {
  const text = inputText.value.trim();
  if (!text) return;
  emit('send', text);
  inputText.value = '';
}

function onTestChat() {
  const text = testText.value.trim();
  if (!text) return;
  emit('test-chat', text);
  testText.value = '';
}

function time(ts) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <section class="chat">
    <div class="chat-header">
      <span>{{ contact ? contact.name : '未选择联系人' }}</span>
      <span v-if="contact && contact.type === 'room'" class="tag">群聊</span>
    </div>

    <div class="test-bar">
      <input v-model="testText" placeholder="AI 对话测试：不经过微信，直接向大模型提问" @keyup.enter="onTestChat" />
      <button class="btn primary" @click="onTestChat">测试</button>
      <div v-if="testReply" class="test-reply">{{ testReply }}</div>    </div>

    <div ref="listRef" class="messages">
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="msg"
        :class="m.type === 'in' ? 'in' : 'out'"
      >
        <div class="bubble">{{ m.text }}</div>
        <div class="meta">{{ m.type === 'in' ? m.displayName : '我' }} · {{ time(m.ts) }}</div>
      </div>
      <div v-if="!messages.length" class="empty-hint">
        <p v-if="mode === 'mock'">模拟模式：在下方输入消息，将模拟该联系人来信并触发 AI 自动回复</p>
        <p v-else>等待微信好友发送消息...</p>
      </div>
    </div>

    <div class="input-bar">
      <input
        v-model="inputText"
        :placeholder="contact ? `发送给 ${contact.name}` : '请先选择联系人'"
        :disabled="!contact"
        @keyup.enter="onSend"
      />
      <button class="btn primary" :disabled="!contact" @click="onSend">发送</button>
    </div>
  </section>
</template>

<style scoped>
.chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.chat-header { padding: 12px 20px; font-weight: 600; background: #fff; border-bottom: 1px solid #e5e8ec; display: flex; align-items: center; gap: 8px; }
.tag { font-size: 11px; background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 10px; }
.test-bar { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #fafbfc; border-bottom: 1px dashed #e5e8ec; flex-wrap: wrap; }
.test-bar input { flex: 1; min-width: 200px; }
.test-reply { width: 100%; background: #fff; border: 1px solid #e5e8ec; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #374151; }
.messages { flex: 1; overflow-y: auto; padding: 16px 20px; }
.msg { margin-bottom: 12px; max-width: 70%; }
.msg.in { margin-right: auto; }
.msg.out { margin-left: auto; text-align: right; }
.bubble { display: inline-block; padding: 8px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; text-align: left; }
.msg.in .bubble { background: #fff; border: 1px solid #e5e8ec; border-top-left-radius: 4px; }
.msg.out .bubble { background: #4f46e5; color: #fff; border-top-right-radius: 4px; }
.meta { font-size: 11px; color: #8a919f; margin-top: 4px; }
.empty-hint { text-align: center; color: #8a919f; padding: 40px; font-size: 13px; }
.input-bar { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid #e5e8ec; background: #fff; }
input { flex: 1; border: 1px solid #d0d4dc; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; }
input:focus { border-color: #4f46e5; }
</style>
