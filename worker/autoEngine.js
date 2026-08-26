const fs = require('fs');
const path = require('path');
const os = require('os');

// "🔄 N시간마다 전 계정 순회" — 켜두면 워커가 폴링 루프마다 계정별로 마지막 실행 이후
// intervalHours가 지났는지 확인해서, 지났으면 그 계정으로 자동 생성+게시를 한 번 돌린다.
// 기본값은 항상 꺼짐(enabled:false) — 실수로 자동 게시가 켜진 채 방치되지 않게.
const AUTO_PATH = path.join(os.homedir(), '.u-thread-worker', 'auto-engine.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTO_PATH, 'utf-8'));
    if (!data.lastRunAt) data.lastRunAt = {};
    return data;
  } catch {
    return { enabled: false, intervalHours: 4, lastRunAt: {} };
  }
}

function save(data) {
  const dir = path.dirname(AUTO_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AUTO_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function setEnabled(enabled) {
  const data = load();
  data.enabled = !!enabled;
  save(data);
  return data;
}

function setIntervalHours(hours) {
  const data = load();
  data.intervalHours = Math.max(1, Math.min(24, Number(hours) || 4));
  save(data);
  return data;
}

function isDue(accountId) {
  const data = load();
  if (!data.enabled) return false;
  const last = data.lastRunAt[accountId];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= data.intervalHours * 3600000;
}

function markRan(accountId) {
  const data = load();
  data.lastRunAt[accountId] = new Date().toISOString();
  save(data);
  return data;
}

function nextRunAt(accountId) {
  const data = load();
  const last = data.lastRunAt[accountId];
  if (!last) return null; // 아직 한 번도 안 돌았으면 바로 다음 사이클에 실행됨
  return new Date(new Date(last).getTime() + data.intervalHours * 3600000).toISOString();
}

module.exports = { load, save, setEnabled, setIntervalHours, isDue, markRan, nextRunAt };
