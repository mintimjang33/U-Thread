const fs = require('fs');
const path = require('path');
const os = require('os');

// 글 생성 프롬프트에 반영할 말투 설정 — 아무것도 안 하면 기본(20~30대 여성 말투), 닮고 싶은
// 쓰레드 계정을 넣으면 그 계정 글을 분석해서 말투 설명을 뽑아 저장해둔다.
const PERSONA_PATH = path.join(os.homedir(), '.u-thread-worker', 'persona.json');
const DEFAULT_NOTE = '20~30대 여성 특유의 친근하고 공감가는 말투. 반말/구어체 자연스럽게 섞고, 과하지 않은 이모지 사용.';

function load() {
  try {
    return JSON.parse(fs.readFileSync(PERSONA_PATH, 'utf-8'));
  } catch {
    return { note: DEFAULT_NOTE, sourceHandle: null };
  }
}

function save(data) {
  const dir = path.dirname(PERSONA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PERSONA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function reset() {
  const data = { note: DEFAULT_NOTE, sourceHandle: null };
  save(data);
  return data;
}

module.exports = { load, save, reset, DEFAULT_NOTE };
