const fs = require('fs');
const path = require('path');
const os = require('os');

// 실제로 발행 성공한 글의 기록 — "오늘 활동"/"계정별 현황"/쇼핑글 예열 판단(7일)에 쓴다.
const LOG_PATH = path.join(os.homedir(), '.u-thread-worker', 'post-log.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function save(items) {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

function logPost({ accountId, type }) {
  const items = load();
  items.push({
    accountId: accountId || 'default',
    type: type === 'shopping' ? 'shopping' : 'daily',
    postedAt: new Date().toISOString(),
  });
  save(items);
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function summaryByAccount() {
  const byAccount = {};
  for (const it of load()) {
    (byAccount[it.accountId] ||= []).push(it);
  }
  const result = {};
  for (const [accountId, entries] of Object.entries(byAccount)) {
    entries.sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
    const today = entries.filter((e) => isToday(e.postedAt));
    result[accountId] = {
      dailyToday: today.filter((e) => e.type === 'daily').length,
      shoppingToday: today.filter((e) => e.type === 'shopping').length,
      lastPostedAt: entries[entries.length - 1]?.postedAt || null,
      firstPostedAt: entries[0]?.postedAt || null,
    };
  }
  return result;
}

function totalCount() {
  return load().length;
}

module.exports = { logPost, summaryByAccount, totalCount };
