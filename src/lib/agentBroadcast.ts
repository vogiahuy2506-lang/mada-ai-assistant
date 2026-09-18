/**
 * agentBroadcast.ts
 * Dùng BroadcastChannel API để gửi thông báo tức thì giữa các tab trình duyệt.
 * AdminAgents gửi "agent-changed" → ChatPage nghe và gọi loadAgents() ngay lập tức.
 * Không cần WebSocket, không cần polling.
 */
export const AGENT_CHANNEL = 'mada-agent-channel';

export type AgentEvent =
  | { type: 'agent-created'; agentId: string }
  | { type: 'agent-updated'; agentId: string }
  | { type: 'agent-deleted'; agentId: string }
  | { type: 'agent-toggled'; agentId: string }
  | { type: 'agents-imported'; agentIds: string[] };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!_channel) {
    _channel = new BroadcastChannel(AGENT_CHANNEL);
  }
  return _channel;
}

/** Gửi thông báo rằng agents đã thay đổi — dùng ở AdminAgents */
export function broadcastAgentChange(event: AgentEvent): void {
  if (typeof BroadcastChannel === 'undefined') return; // SSR guard
  try {
    getChannel().postMessage(event);
    console.log('[agentBroadcast] 📡 Sent:', event.type, event);
  } catch (err) {
    console.warn('[agentBroadcast] Failed to broadcast:', err);
  }
}

/** Lắng nghe thông báo agents thay đổi — dùng ở ChatPage */
export function onAgentChange(callback: (event: AgentEvent) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = getChannel();
  const handler = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object' && 'type' in e.data) {
      callback(e.data as AgentEvent);
    }
  };
  channel.addEventListener('message', handler);
  // Trả về hàm cleanup để remove listener khi component unmount
  return () => {
    channel.removeEventListener('message', handler);
  };
}
