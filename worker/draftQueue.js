const fs = require('fs');
const path = require('path');
const os = require('os');

// 여러 탭(직접소싱/일상글/검수)이 공유하는 로컬 초안 큐 — 붙여넣거나 생성한 글이 여기 쌓이고,
// [검수] 탭에서 확인 후 실제로 게시한다. 서버(Supabase)에는 실제로 게시할 때만 올라간다.
const QUEUE_PATH = path.join(os.homedir(), '.u-thread-worker', 'draft-queue.json');

function loadQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveQueue(items) {
  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

function addDraft({ type, content, source, accountId }) {
  const items = loadQueue();
  const draft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, content, source: source || null, accountId: accountId || null, createdAt: new Date().toISOString() };
  items.unshift(draft);
  saveQueue(items);
  return draft;
}

function removeDraft(id) {
  const items = loadQueue().filter((d) => d.id !== id);
  saveQueue(items);
}

// "예약" 탭 — 검수 큐에 있는 글에 게시 시각을 붙인다. 워커의 폴링 루프가 매 사이클마다
// scheduledAt이 지난 항목을 찾아 자동으로 게시한다(워커가 켜져있는 동안만 동작).
function scheduleDraft(id, scheduledAt) {
  const items = loadQueue();
  const updated = items.map((d) => (d.id === id ? { ...d, scheduledAt } : d));
  saveQueue(updated);
  return updated.find((d) => d.id === id);
}

function unscheduleDraft(id) {
  const items = loadQueue();
  const updated = items.map((d) => (d.id === id ? { ...d, scheduledAt: null } : d));
  saveQueue(updated);
}

function dueDrafts() {
  const now = Date.now();
  return loadQueue().filter((d) => d.scheduledAt && new Date(d.scheduledAt).getTime() <= now);
}

function clearAll() {
  saveQueue([]);
}

module.exports = { loadQueue, addDraft, removeDraft, scheduleDraft, unscheduleDraft, dueDrafts, clearAll };
