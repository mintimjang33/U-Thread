const fs = require('fs');
const path = require('path');
const os = require('os');

// "채널 복제" 탭 — 닮고 싶은 계정(들)의 최근 글을 모아 훅/구조/주제를 학습해서 "프로필"로 저장해둔다.
// 여러 벌을 동시에 저장해두고(원본 앱처럼), 그중 하나를 골라 그 결로 새 글을 쓴다.
const CLONE_PATH = path.join(os.homedir(), '.u-thread-worker', 'channel-clone.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(CLONE_PATH, 'utf-8'));
    // 예전(단일 슬롯) 형식으로 저장된 파일이면 profiles 배열만 남기고 나머지는 버린다.
    return { profiles: Array.isArray(data.profiles) ? data.profiles : [] };
  } catch {
    return { profiles: [] };
  }
}

function save(data) {
  const dir = path.dirname(CLONE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLONE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function addProfile({ accounts, summary, samplePosts, hooks, structures, topics }) {
  const data = load();
  const profile = {
    id: 'clone_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    accounts,
    summary,
    samplePosts,
    hooks: hooks || [],
    structures: structures || [],
    topics: topics || [],
    learnedAt: new Date().toISOString(),
  };
  data.profiles.push(profile);
  save(data);
  return profile;
}

function removeProfile(id) {
  const data = load();
  data.profiles = data.profiles.filter((p) => p.id !== id);
  save(data);
  return data;
}

module.exports = { load, save, addProfile, removeProfile };
