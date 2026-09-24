/**
 * settingsBroadcast.ts
 * Dùng BroadcastChannel API để gửi thông báo tức thì giữa các tab trình duyệt.
 * Admin (FileManagement, ChatCustomization) gửi "settings-changed" → ChatPage nghe và reload settings ngay lập tức.
 * Không cần WebSocket, không cần polling.
 */
export const SETTINGS_CHANNEL = 'mada-settings-channel';

export type SettingsEvent =
  | { type: 'settings-changed'; keys: string[] }
  | { type: 'settings-reload' };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!_channel) {
    _channel = new BroadcastChannel(SETTINGS_CHANNEL);
  }
  return _channel;
}

/** Gửi thông báo rằng settings đã thay đổi — dùng ở Admin (FileManagement, ChatCustomization) */
export function broadcastSettingsChange(keys: string[] = []): void {
  if (typeof BroadcastChannel === 'undefined') return; // SSR guard
  try {
    getChannel().postMessage({ type: 'settings-changed', keys });
    console.log('[settingsBroadcast] 📡 Sent settings-changed:', keys);
  } catch (err) {
    console.warn('[settingsBroadcast] Failed to broadcast:', err);
  }
}

/** Gửi thông báo yêu cầu reload tất cả settings */
export function broadcastSettingsReload(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    getChannel().postMessage({ type: 'settings-reload' });
    console.log('[settingsBroadcast] 📡 Sent settings-reload');
  } catch (err) {
    console.warn('[settingsBroadcast] Failed to broadcast:', err);
  }
}

/** Lắng nghe thông báo settings thay đổi — dùng ở ChatPage */
export function onSettingsChange(callback: (event: SettingsEvent) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = getChannel();
  const handler = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object' && 'type' in e.data) {
      callback(e.data as SettingsEvent);
    }
  };
  channel.addEventListener('message', handler);
  // Trả về hàm cleanup để remove listener khi component unmount
  return () => {
    channel.removeEventListener('message', handler);
  };
}
