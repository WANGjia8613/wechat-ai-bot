<script setup>
defineProps({
  contacts: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
});
defineEmits(['select']);
</script>

<template>
  <aside class="contact-list">
    <div class="list-header">联系人</div>
    <div class="items">
      <div
        v-for="c in contacts"
        :key="c.id"
        class="item"
        :class="{ active: c.id === selectedId }"
        @click="$emit('select', c.id)"
      >
        <span class="avatar">{{ c.name.slice(0, 1) }}</span>
        <div class="meta">
          <div class="name">{{ c.name }}</div>
          <div class="type">{{ c.type === 'room' ? '群聊' : '好友' }}</div>
        </div>
        <span v-if="c.unread" class="unread">{{ c.unread }}</span>
      </div>
      <div v-if="!contacts.length" class="empty">暂无联系人</div>
    </div>
  </aside>
</template>

<style scoped>
.contact-list { width: 220px; border-right: 1px solid #e5e8ec; background: #fff; display: flex; flex-direction: column; }
.list-header { padding: 12px 16px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #e5e8ec; }
.items { flex: 1; overflow-y: auto; }
.item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; cursor: pointer; }
.item:hover { background: #f5f7fa; }
.item.active { background: #eef2ff; }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
.meta { flex: 1; min-width: 0; }
.name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type { font-size: 11px; color: #8a919f; }
.unread { background: #ef4444; color: #fff; font-size: 11px; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
.empty { padding: 20px; text-align: center; color: #8a919f; font-size: 13px; }
</style>
