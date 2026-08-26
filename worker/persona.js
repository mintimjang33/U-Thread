const fs = require('fs');
const path = require('path');
const os = require('os');

// 글 생성 프롬프트에 반영할 말투 설정.
// - profiles: 저장해둔 말투(페르소나) 라이브러리(여러 벌 보관 가능)
// - mode: 'fixed'면 항상 기본 말투(DEFAULT_NOTE)만 씀, 'manual'이면 activeProfileId로 지정한
//   프로필을 전체 기본값으로 씀
// - accountOverrides: 계정별로 다른 프로필을 강제 지정(전역 설정보다 항상 우선)
const PERSONA_PATH = path.join(os.homedir(), '.u-thread-worker', 'persona.json');
const DEFAULT_NOTE = '20~30대 여성 특유의 친근하고 공감가는 말투. 반말/구어체 자연스럽게 섞고, 과하지 않은 이모지 사용.';

function makeId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function migrate(raw) {
  if (Array.isArray(raw?.profiles)) {
    return {
      mode: raw.mode === 'manual' ? 'manual' : 'fixed',
      activeProfileId: raw.activeProfileId || null,
      profiles: raw.profiles,
      accountOverrides: raw.accountOverrides && typeof raw.accountOverrides === 'object' ? raw.accountOverrides : {},
    };
  }
  // 예전(단일 노트) 형식 — 저장돼 있던 노트를 라이브러리 첫 항목으로 옮겨온다.
  if (raw?.note && raw.note !== DEFAULT_NOTE) {
    const profile = { id: makeId(), name: raw.sourceHandle || '이전에 적용한 말투', note: raw.note, sourceHandle: raw.sourceHandle || null, createdAt: new Date().toISOString() };
    return { mode: 'manual', activeProfileId: profile.id, profiles: [profile], accountOverrides: {} };
  }
  return { mode: 'fixed', activeProfileId: null, profiles: [], accountOverrides: {} };
}

function load() {
  try {
    return migrate(JSON.parse(fs.readFileSync(PERSONA_PATH, 'utf-8')));
  } catch {
    return { mode: 'fixed', activeProfileId: null, profiles: [], accountOverrides: {} };
  }
}

function save(data) {
  const dir = path.dirname(PERSONA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PERSONA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function addProfile({ name, note, sourceHandle }) {
  const data = load();
  const profile = { id: makeId(), name: (name || sourceHandle || '새 말투').trim(), note: note.trim(), sourceHandle: sourceHandle || null, createdAt: new Date().toISOString() };
  data.profiles.push(profile);
  save(data);
  return profile;
}

function removeProfile(id) {
  const data = load();
  data.profiles = data.profiles.filter((p) => p.id !== id);
  if (data.activeProfileId === id) data.activeProfileId = null;
  for (const acctId of Object.keys(data.accountOverrides)) {
    if (data.accountOverrides[acctId] === id) delete data.accountOverrides[acctId];
  }
  save(data);
  return data;
}

function setMode(mode) {
  const data = load();
  data.mode = mode === 'manual' ? 'manual' : 'fixed';
  save(data);
  return data;
}

function setActiveProfile(id) {
  const data = load();
  if (id && !data.profiles.some((p) => p.id === id)) throw new Error('존재하지 않는 페르소나예요.');
  data.activeProfileId = id || null;
  save(data);
  return data;
}

function setAccountOverride(accountId, profileId) {
  const data = load();
  if (!accountId) throw new Error('계정을 지정하세요.');
  if (profileId) {
    if (!data.profiles.some((p) => p.id === profileId)) throw new Error('존재하지 않는 페르소나예요.');
    data.accountOverrides[accountId] = profileId;
  } else {
    delete data.accountOverrides[accountId];
  }
  save(data);
  return data;
}

// 실제 프롬프트에 넣을 말투 문장을 계정 기준으로 결정한다.
// 우선순위: 이 계정 전용 지정 > (직접고르기 모드일 때) 전역 활성 프로필 > 기본 말투
function getEffectiveNote(accountId) {
  const data = load();
  const overrideId = accountId ? data.accountOverrides[accountId] : null;
  if (overrideId) {
    const p = data.profiles.find((x) => x.id === overrideId);
    if (p) return p.note;
  }
  if (data.mode === 'manual' && data.activeProfileId) {
    const p = data.profiles.find((x) => x.id === data.activeProfileId);
    if (p) return p.note;
  }
  return DEFAULT_NOTE;
}

function reset() {
  const data = load();
  data.mode = 'fixed';
  data.activeProfileId = null;
  data.accountOverrides = {};
  save(data);
  return data;
}

module.exports = {
  load, save, reset, DEFAULT_NOTE,
  addProfile, removeProfile, setMode, setActiveProfile, setAccountOverride, getEffectiveNote,
};
