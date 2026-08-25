const fs = require('fs');
const path = require('path');
const os = require('os');

// "채널 복제" 탭 — 닮고 싶은 계정 여러 개의 최근 글을 모아 훅/구조/주제를 학습해두고,
// 그 결로 새 글을 쓸 때 few-shot 예시로 쓴다.
const CLONE_PATH = path.join(os.homedir(), '.u-thread-worker', 'channel-clone.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(CLONE_PATH, 'utf-8'));
  } catch {
    return { accounts: [], summary: null, samplePosts: [] };
  }
}

function save(data) {
  const dir = path.dirname(CLONE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CLONE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function reset() {
  const data = { accounts: [], summary: null, samplePosts: [] };
  save(data);
  return data;
}

module.exports = { load, save, reset };
