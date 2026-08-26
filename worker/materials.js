const fs = require('fs');
const path = require('path');
const os = require('os');

// "직접 소싱(커스텀)" 탭에서 원본 수집한 글감(아직 다시 쓰기 전 원본)을 종류(일상/쇼핑)별로
// 로컬에 보관한다. 앱 기본 검색어로 모은 것(Supabase ut_benchmark_items)과는 분리된 저장소다.
const MATERIALS_PATH = path.join(os.homedir(), '.u-thread-worker', 'materials.json');

function loadMaterials() {
  try {
    return JSON.parse(fs.readFileSync(MATERIALS_PATH, 'utf-8'));
  } catch {
    return { daily: [], shopping: [] };
  }
}

function saveMaterials(data) {
  const dir = path.dirname(MATERIALS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MATERIALS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function addMaterials(type, items, options) {
  const skipDedupe = options?.skipDedupe === true;
  const data = loadMaterials();
  if (!data[type]) data[type] = [];
  const existingContents = new Set(data[type].map((m) => m.content));
  for (const item of items) {
    if (!skipDedupe && existingContents.has(item.content)) continue; // 한 번 수집한 건 다시 안 담음
    data[type].push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), content: item.content, used: false, addedAt: new Date().toISOString() });
  }
  saveMaterials(data);
  return data[type];
}

function takeUnusedMaterials(type, count) {
  const data = loadMaterials();
  const list = data[type] || [];
  const unused = list.filter((m) => !m.used).slice(0, count);
  const unusedIds = new Set(unused.map((m) => m.id));
  data[type] = list.map((m) => (unusedIds.has(m.id) ? { ...m, used: true } : m));
  saveMaterials(data);
  return unused;
}

function removeMaterial(type, id) {
  const data = loadMaterials();
  data[type] = (data[type] || []).filter((m) => m.id !== id);
  saveMaterials(data);
}

// 글감 창고에서 사용자가 직접 체크한 것만 골라 변환할 때 쓴다 — used 여부와 상관없이 지정한 것만 꺼내고,
// 꺼낸 것은 used로 표시한다(같은 걸 두 번 안 담기 위함).
function takeMaterialsByIds(type, ids) {
  const data = loadMaterials();
  const list = data[type] || [];
  const idSet = new Set(ids);
  const picked = list.filter((m) => idSet.has(m.id));
  data[type] = list.map((m) => (idSet.has(m.id) ? { ...m, used: true } : m));
  saveMaterials(data);
  return picked;
}

// "창고 정리" — 이미 변환에 쓴(used) 글감만 지우고, 아직 안 쓴 건 남겨둔다.
function clearUsed(type) {
  const data = loadMaterials();
  const before = (data[type] || []).length;
  data[type] = (data[type] || []).filter((m) => !m.used);
  saveMaterials(data);
  return before - data[type].length;
}

module.exports = { loadMaterials, addMaterials, takeUnusedMaterials, takeMaterialsByIds, removeMaterial, clearUsed };
