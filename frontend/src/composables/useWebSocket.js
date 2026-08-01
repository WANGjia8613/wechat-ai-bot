import { ref, onUnmounted } from 'vue';

export function useWebSocket(onMessage) {
  const connected = ref(false);
  let ws = null;
  let retry = 0;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${window.location.host}/ws`;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      connected.value = true;
      retry = 0;
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (_) {
        /* noop */
      }
    };
    ws.onclose = () => {
      connected.value = false;
      retry += 1;
      setTimeout(connect, Math.min(3000 * retry, 15000));
    };
    ws.onerror = () => ws.close();
  }

  connect();
  onUnmounted(() => ws && ws.close());

  return { connected };
}
