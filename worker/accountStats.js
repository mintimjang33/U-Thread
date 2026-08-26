const fs = require('fs');
const path = require('path');
const os = require('os');

// [계정] 탭 "👁 전체 조회수 갱신" 결과 캐시 — 매번 브라우저를 새로 열지 않고 마지막으로 읽은
// 팔로워 수를 보여줄 수 있게 로컬에 저장해둔다.
const STATS_PATH = path.join(os.homedir(), '.u-thread-worker', 'account-stats.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function save(data) {
  const dir = path.dirname(STATS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function setStats(accountId, stats) {
  const data = load();
  data[accountId] = stats;
  save(data);
  return data;
}

module.exports = { load, save, setStats };
