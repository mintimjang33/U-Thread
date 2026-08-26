const fs = require('fs');
const path = require('path');
const os = require('os');

// "앱이 쓰는 검색어" — 자동 예열/자동 올리기 엔진이 원본을 모을 때 쓰는 기본 검색어 풀.
// [직접 소싱] 탭의 custom-keywords.json(사용자가 그 탭에서만 쓰는 검색어)과는 분리된 저장소다.
// 기본값은 빈 목록 — 무슨 키워드가 잘 되는지는 사용자마다 다르므로 임의로 채워 넣지 않는다.
// 켜둔 검색어가 하나도 없으면 자동 엔진은 검색어 없이 홈 피드를 도는 방식으로 대체한다.
const PATH_ = path.join(os.homedir(), '.u-thread-worker', 'default-keywords.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(PATH_, 'utf-8'));
    return { daily: data.daily || [], shopping: data.shopping || [] };
  } catch {
    return { daily: [], shopping: [] };
  }
}

function save(data) {
  const dir = path.dirname(PATH_);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PATH_, JSON.stringify(data, null, 2), 'utf-8');
}

function addKeyword(type, keyword) {
  const data = load();
  const kw = (keyword || '').trim();
  if (!kw) throw new Error('검색어를 입력하세요.');
  if (data[type].some((k) => k.keyword === kw)) throw new Error('이미 있는 검색어예요.');
  data[type].push({ id: 'kw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), keyword: kw, enabled: true });
  save(data);
  return data;
}

function toggleKeyword(type, id) {
  const data = load();
  data[type] = data[type].map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k));
  save(data);
  return data;
}

function removeKeyword(type, id) {
  const data = load();
  data[type] = data[type].filter((k) => k.id !== id);
  save(data);
  return data;
}

function pickEnabledKeyword(type) {
  const list = load()[type].filter((k) => k.enabled);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)].keyword;
}

module.exports = { load, save, addKeyword, toggleKeyword, removeKeyword, pickEnabledKeyword };
