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

function addDraft({ type, content, source }) {
  const items = loadQueue();
  const draft = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, content, source: source || null, createdAt: new Date().toISOString() };
  items.unshift(draft);
  saveQueue(items);
  return draft;
}

function removeDraft(id) {
  const items = loadQueue().filter((d) => d.id !== id);
  saveQueue(items);
}

module.exports = { loadQueue, addDraft, removeDraft };
