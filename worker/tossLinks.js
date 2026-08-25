const fs = require('fs');
const path = require('path');
const os = require('os');

// "토스링크(테스트)" 탭 — 토스쇼핑 쉐어링크에 쓸 수 있는 공개 API가 확인된 게 없어서(2026-08-25 기준),
// 실제 자동 연동 없이 로컬 저장소로만 동작한다. 링크 저장소 + 정산 제출 체크리스트 둘 다 로컬 파일.
const TOSS_PATH = path.join(os.homedir(), '.u-thread-worker', 'toss-links.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(TOSS_PATH, 'utf-8'));
  } catch {
    return { apiKey: null, links: [], submissions: [] };
  }
}

function save(data) {
  const dir = path.dirname(TOSS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOSS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function setApiKey(apiKey) {
  const data = load();
  data.apiKey = apiKey || null;
  save(data);
  return data;
}

function addLink(keyword, url) {
  const data = load();
  data.links = data.links || [];
  data.links.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), keyword, url, addedAt: new Date().toISOString() });
  save(data);
  return data;
}

function removeLink(id) {
  const data = load();
  data.links = (data.links || []).filter((l) => l.id !== id);
  save(data);
  return data;
}

function addSubmission(postUrl, memo) {
  const data = load();
  data.submissions = data.submissions || [];
  data.submissions.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), postUrl, memo, checked: false, addedAt: new Date().toISOString() });
  save(data);
  return data;
}

function toggleSubmission(id) {
  const data = load();
  data.submissions = (data.submissions || []).map((s) => (s.id === id ? { ...s, checked: !s.checked } : s));
  save(data);
  return data;
}

function removeSubmission(id) {
  const data = load();
  data.submissions = (data.submissions || []).filter((s) => s.id !== id);
  save(data);
  return data;
}

module.exports = { load, setApiKey, addLink, removeLink, addSubmission, toggleSubmission, removeSubmission };
