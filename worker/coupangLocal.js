const fs = require('fs');
const path = require('path');
const os = require('os');

// "쿠팡 링크 진단" 탭에서 쓰는 로컬 전용 설정 — API 키(볼트, 서버 저장)와 별개로,
// 내 파트너스 ID(lptag 값)만 로컬에 저장해두고 붙여넣은 링크와 비교하는 데 쓴다.
const LOCAL_PATH = path.join(os.homedir(), '.u-thread-worker', 'coupang-local.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf-8'));
  } catch {
    return { partnerId: null };
  }
}

function save(data) {
  const dir = path.dirname(LOCAL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// "AF4468131" 처럼 ID를 직접 입력했거나, 내 링크를 통째로 붙여넣었을 수 있다(lptag= 값을 뽑아낸다).
function extractPartnerId(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const m = trimmed.match(/[?&]lptag=([^&\s]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return trimmed;
}

function setPartnerId(raw) {
  const id = extractPartnerId(raw);
  if (!id) throw new Error('ID나 링크를 입력하세요.');
  const data = { partnerId: id };
  save(data);
  return data;
}

module.exports = { load, save, setPartnerId, extractPartnerId };
