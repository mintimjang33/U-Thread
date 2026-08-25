const fs = require('fs');
const path = require('path');
const os = require('os');

// 좋아요/댓글/수집용 브라우저 로그인을 여러 쓰레드 계정으로 관리한다 — 계정마다 별도 크롬
// 프로필(로그인 세션)을 씀. 원래 있던 단일 계정은 그대로 'default'로 유지해서 기존 로그인
// 세션이 안 끊기게 한다.
const ACCOUNTS_PATH = path.join(os.homedir(), '.u-thread-worker', 'accounts.json');
const DEFAULT_ACCOUNT = { id: 'default', label: '기본 계정' };

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf-8'));
    if (!data.accounts?.length) data.accounts = [DEFAULT_ACCOUNT];
    if (!data.activeAccountId) data.activeAccountId = data.accounts[0].id;
    return data;
  } catch {
    return { accounts: [DEFAULT_ACCOUNT], activeAccountId: 'default' };
  }
}

function save(data) {
  const dir = path.dirname(ACCOUNTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function addAccount(label) {
  const data = load();
  const id = 'acct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  data.accounts.push({ id, label: label || id });
  save(data);
  return data;
}

function removeAccount(id) {
  if (id === 'default') throw new Error('기본 계정은 삭제할 수 없어요.');
  const data = load();
  data.accounts = data.accounts.filter((a) => a.id !== id);
  if (data.activeAccountId === id) data.activeAccountId = data.accounts[0]?.id || 'default';
  save(data);
  return data;
}

function setActive(id) {
  const data = load();
  if (!data.accounts.some((a) => a.id === id)) throw new Error('없는 계정이에요.');
  data.activeAccountId = id;
  save(data);
  return data;
}

// 'default' 계정은 원래부터 쓰던 프로필 경로(chrome-profile)를 그대로 쓰고, 새로 추가한
// 계정만 별도 서브폴더를 쓴다 — 기존 로그인 세션이 안 끊기게 하기 위함.
function profileDirFor(accountId) {
  const base = path.join(os.homedir(), '.u-thread-worker');
  if (!accountId || accountId === 'default') return path.join(base, 'chrome-profile');
  return path.join(base, 'chrome-profile-' + accountId);
}

module.exports = { load, save, addAccount, removeAccount, setActive, profileDirFor };
