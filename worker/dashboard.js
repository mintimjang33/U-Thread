const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig } = require('./config');
const { getClaudeAccountEmail, generateViaClaude } = require('./generate');
const { closeBrowser, scrapeThreadsPost, scrapeProfilePosts } = require('./collectBenchmark');
const accounts = require('./accounts');
const { loadMaterials, takeUnusedMaterials, removeMaterial } = require('./materials');
const { loadQueue, addDraft, removeDraft, scheduleDraft, unscheduleDraft, clearAll } = require('./draftQueue');
const tossLinks = require('./tossLinks');
const persona = require('./persona');
const channelClone = require('./channelClone');
const postLog = require('./postLog');

// "직접 소싱(커스텀)" 탭 전용 로컬 키워드 저장 — 앱 기본 검색어(웹 대시보드의 검색 키워드 관리)와
// 별개로, 이 탭에서만 쓰는 검색어를 로컬 파일에 저장한다.
const CUSTOM_KEYWORDS_PATH = path.join(os.homedir(), '.u-thread-worker', 'custom-keywords.json');
function loadCustomKeywords() {
  try {
    const data = JSON.parse(fs.readFileSync(CUSTOM_KEYWORDS_PATH, 'utf-8'));
    if (!data.dailyGroups) data.dailyGroups = [];
    if (!data.shoppingGroups) data.shoppingGroups = [];
    return data;
  } catch {
    return { daily: [], shopping: [], dailyGroups: [], shoppingGroups: [] };
  }
}
function saveCustomKeywords(data) {
  const dir = path.dirname(CUSTOM_KEYWORDS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOM_KEYWORDS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// 발행할 때 쓸 기본 쓰레드 계정 — 워커 브라우저 로그인(1개)과 달리, 실제 발행은 공식 API를
// 쓰므로 유쓰레드 웹에 연결해둔 계정이 여러 개면 그중 하나를 골라 저장해둔다.
const PREFS_PATH = path.join(os.homedir(), '.u-thread-worker', 'prefs.json');
function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf-8'));
  } catch {
    return { defaultThreadsAccountId: null };
  }
}
function savePrefs(data) {
  const dir = path.dirname(PREFS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PREFS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const PORT = 5757;
const MAX_LOG_LINES = 300;
const logs = [];
let status = { state: 'starting', claudeEmail: null, apiBase: null, currentJob: null, threadsLoginStatus: {} };

// 계정별 로그인 확인 결과를 status.threadsLoginStatus[accountId]에 기록한다.
function setThreadsLoginStatus(accountId, loggedIn) {
  const id = accountId || accounts.load().activeAccountId;
  status = { ...status, threadsLoginStatus: { ...status.threadsLoginStatus, [id]: { loggedIn, checkedAt: new Date().toISOString() } } };
}

function pushLog(line) {
  logs.push({ time: new Date().toLocaleTimeString('ko-KR'), text: String(line) });
  if (logs.length > MAX_LOG_LINES) logs.shift();
}

function setStatus(patch) {
  status = { ...status, ...patch };
}

// console.log/error를 가로채서 대시보드 로그에도 남긴다(터미널 출력은 그대로 유지).
function hookConsole() {
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => {
    pushLog(args.map(String).join(' '));
    origLog(...args);
  };
  console.error = (...args) => {
    pushLog('❌ ' + args.map(String).join(' '));
    origError(...args);
  };
}

// 키워드를 안 넣고 "일상글 올리기" 탭에서 바로 수집을 누를 때 쓰는 기본 후보 — 실제로 인기 있던
// 검색어 위주(현황/ai-worker 페이지의 DEFAULT_KEYWORDS와 동일 계열).
const FALLBACK_KEYWORDS = ['꿀템', '살림꿀팁', '자취템', '다이소템', '뷰티템'];

async function handleCollectAction(body) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const keyword = (body?.keyword || '').trim() || FALLBACK_KEYWORDS[Math.floor(Math.random() * FALLBACK_KEYWORDS.length)];
  const minutes = Number(body?.minutes) || 10;
  // 시간(분) 단위를 실제 스크롤 횟수로 환산 — 정확한 시간제한은 아니고 대략적인 비례치.
  const maxScrolls = Math.max(3, Math.min(20, Math.round(minutes / 2)));

  const accountId = body?.accountId || accounts.load().activeAccountId;
  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ type: 'collect_benchmark', input: { keyword, maxScrolls, accountId } }),
  });
  if (!res.ok) throw new Error(`작업 생성 실패 (${res.status})`);
  const { job } = await res.json();
  pushLog(`[대시보드] "${keyword}" 원본 수집 작업 등록 완료(${job.id.slice(0, 8)}, 계정: ${accountId}) — 곧 처리됩니다.`);
  return job;
}

async function handleKeyStatus(provider) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const res = await fetch(config.apiBase + `/api/keys?provider=${encodeURIComponent(provider)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '조회 실패');
  return data;
}

async function handleListThreadsAccounts() {
  // ⚠️ 이름이 같지만 다른 개념: 여기(handleListThreadsAccounts)는 "실제 발행"에 쓸 공식 API
  // 연동 계정 목록(유쓰레드 웹 ut_threads_accounts)이고, accounts.js는 "좋아요/댓글/수집"용
  // 브라우저 로그인 프로필 목록(로컬 전용)이다. 서로 다른 시스템이니 헷갈리지 말 것.
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const res = await fetch(config.apiBase + '/api/threads-accounts', {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '쓰레드 계정 조회 실패');
  return { accounts: data.accounts || [], defaultThreadsAccountId: loadPrefs().defaultThreadsAccountId };
}

async function handleCheckAccountAction(accountId) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const id = accountId || accounts.load().activeAccountId;

  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ type: 'check_threads_login', input: { accountId: id } }),
  });
  if (!res.ok) throw new Error(`작업 생성 실패 (${res.status})`);
  const { job } = await res.json();
  pushLog(`[대시보드] "${id}" 계정 연결 확인 작업 등록(${job.id.slice(0, 8)}) — 곧 처리됩니다.`);
  return job;
}

// "내가 직접 써서 올리기" — 이미 있는 유쓰레드 API 두 개를 그대로 이어붙인다(새로 만든 기능 아님):
// smart-editor(mode:'manual')로 초안을 만들고, threads-accounts/publish로 실제 발행.
// 두 라우트 모두 원래 쿠키 세션 전용이었는데, /api/worker/jobs에 이미 쓰던 것과 같은
// 방식으로 워커 Bearer 토큰도 받아들이게 살짝 넓혀뒀다.
async function handleManualPostAction(body) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const text = (body?.text || '').trim();
  if (!text) throw new Error('올릴 글 내용이 없습니다.');

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` };

  const draftRes = await fetch(config.apiBase + '/api/smart-editor', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ mode: 'manual', topic: text }),
  });
  const draftData = await draftRes.json();
  if (!draftRes.ok) throw new Error(draftData.error || '초안 생성 실패');
  pushLog(`[대시보드] 초안 생성 완료(${draftData.post.id.slice(0, 8)}) — 발행 시도 중...`);

  const acctRes = await fetch(config.apiBase + '/api/threads-accounts', { headers: authHeaders });
  const acctData = await acctRes.json();
  if (!acctRes.ok) throw new Error(acctData.error || '쓰레드 계정 조회 실패');
  const accounts = acctData.accounts || [];
  if (!accounts.length) throw new Error('연동된 쓰레드 계정이 없습니다. 유쓰레드 웹 대시보드에서 먼저 쓰레드 계정을 연결하세요.');

  // 연결된 계정이 여러 개면 [계정] 탭에서 고른 기본 계정을 쓴다 — 안 골랐으면 첫 번째로 대체.
  const prefs = loadPrefs();
  const account = accounts.find((a) => a.id === prefs.defaultThreadsAccountId) || accounts[0];

  const publishRes = await fetch(config.apiBase + '/api/threads-accounts/publish', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ postId: draftData.post.id, threadsAccountId: account.id }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishData.error || '발행 실패');
  pushLog(`[대시보드] ✅ 실제 쓰레드에 게시 완료 (threadsPostId: ${publishData.threadsPostId})`);
  postLog.logPost({ accountId: accounts.load().activeAccountId, type: body?.type });
  return publishData;
}

function buildRewritePrompt(type, sourceText) {
  const styleNote = type === 'shopping' ? '쇼핑/제품 소개 느낌으로, 광고 티 안 나게 자연스럽게' : '평범한 일상 공유 느낌으로';
  const personaNote = persona.load().note;
  return `아래는 실제로 반응이 좋았던 쓰레드(Threads) 게시물이다. 표현과 구조(훅 방식, 문장 길이, 이모지 사용)만 참고해서, 완전히 새로운 내용으로 다시 써라. 그대로 베끼면 안 되고, 욕설/과도한 광고 문구는 쓰지 않는다. ${styleNote}.
말투 지침(반드시 따를 것): ${personaNote}
결과는 게시물 본문 텍스트만 출력해라(설명이나 따옴표 없이).

===원본 시작===
${sourceText.slice(0, 800)}
===원본 끝===`;
}

async function handleCustomCollectAction(body) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const type = body?.type === 'shopping' ? 'shopping' : 'daily';
  const keyword = (body?.keyword || '').trim();
  if (!keyword) throw new Error('키워드를 입력하세요.');
  const minutes = Number(body?.minutes) || 10;
  const maxScrolls = Math.max(3, Math.min(20, Math.round(minutes / 2)));
  const input = {
    keyword,
    maxScrolls,
    saveMaterialsAs: type,
    minLikes: Number(body?.minLikes) || 0,
    minReplies: Number(body?.minReplies) || 0,
    matchMode: type === 'shopping' ? 'both' : 'either',
    accountId: body?.accountId || accounts.load().activeAccountId,
  };

  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ type: 'collect_benchmark', input }),
  });
  if (!res.ok) throw new Error(`작업 생성 실패 (${res.status})`);
  const { job } = await res.json();
  pushLog(`[대시보드] 직접소싱 "${keyword}"(${type === 'shopping' ? '쇼핑글' : '일상글'}) 수집 등록(${job.id.slice(0, 8)})`);
  return job;
}

async function handleCustomWriteAction(body) {
  const type = body?.type === 'shopping' ? 'shopping' : 'daily';
  const count = Math.max(1, Math.min(5, Number(body?.count) || 1));
  const materials = takeUnusedMaterials(type, count);
  if (!materials.length) throw new Error('글감 창고가 비었어요 — 먼저 원본 수집을 하세요.');

  const drafts = [];
  for (const m of materials) {
    const content = (await generateViaClaude(buildRewritePrompt(type, m.content))).trim();
    drafts.push(addDraft({ type, content, source: '직접소싱' }));
  }
  pushLog(`[대시보드] 직접소싱 바로쓰기로 ${drafts.length}개 생성 → [검수] 탭에 추가됨`);
  return drafts;
}

async function handlePasteAction(body) {
  const type = body?.type === 'shopping' ? 'shopping' : 'daily';
  const raw = (body?.text || '').trim();
  if (!raw) throw new Error('내용을 입력하세요.');
  const isUrl = /^https?:\/\//.test(raw);
  const accountId = body?.accountId || accounts.load().activeAccountId;

  let content;
  let source;
  if (isUrl) {
    pushLog(`[대시보드] 링크에서 게시물 가져오는 중: ${raw}`);
    const sourceText = await scrapeThreadsPost(raw, accountId);
    content = (await generateViaClaude(buildRewritePrompt(type, sourceText))).trim();
    source = '벤치 링크';
  } else {
    content = raw; // 직접 쓴 글은 AI를 거치지 않고 그대로 담는다.
    source = '직접 작성';
  }
  const draft = addDraft({ type, content, source });
  pushLog(`[대시보드] [검수] 탭에 추가됨(${draft.id})`);
  return draft;
}

async function handleQueuePublishAction(id) {
  const items = loadQueue();
  const item = items.find((d) => d.id === id);
  if (!item) throw new Error('이미 처리됐거나 없는 항목이에요.');
  const result = await handleManualPostAction({ text: item.content, type: item.type });
  removeDraft(id);
  return result;
}

async function handleQueueClearAllAction() {
  const count = loadQueue().length;
  clearAll();
  pushLog(`[대시보드] 검수 대기 ${count}개 전부 비움`);
  return { cleared: count };
}

async function handleQueueRewriteAllAction() {
  const items = loadQueue();
  if (!items.length) throw new Error('비어있어요 — 다시 쓸 게 없습니다.');
  const dailyCount = items.filter((d) => d.type === 'daily').length;
  const shoppingCount = items.filter((d) => d.type === 'shopping').length;
  clearAll();

  const drafts = [];
  for (const [type, count] of [['daily', dailyCount], ['shopping', shoppingCount]]) {
    if (!count) continue;
    const materials = takeUnusedMaterials(type, count);
    for (const m of materials) {
      const content = (await generateViaClaude(buildRewritePrompt(type, m.content))).trim();
      drafts.push(addDraft({ type, content, source: '전체 다시쓰기' }));
    }
    if (materials.length < count) {
      pushLog(`[대시보드] ${type} 글감이 부족해서 ${count}개 중 ${materials.length}개만 다시 씀 — 원본 수집을 더 해주세요.`);
    }
  }
  pushLog(`[대시보드] 검수 대기 ${items.length}개를 비우고 ${drafts.length}개로 다시 씀`);
  return drafts;
}

async function handlePersonaAnalyzeAction(body) {
  const raw = (body?.handle || '').trim();
  if (!raw) throw new Error('계정 핸들이나 링크를 입력하세요.');
  const url = raw.startsWith('http') ? raw : `https://www.threads.net/@${raw.replace(/^@/, '')}`;
  pushLog(`[대시보드] 페르소나 분석용 페이지 여는 중: ${url}`);
  const sourceText = await scrapeThreadsPost(url, body?.accountId);
  const prompt = `아래는 어떤 쓰레드(Threads) 계정의 실제 게시물이다. 이 글의 말투(반말/존댓말, 어조, 자주 쓰는 표현, 이모지 사용 습관, 문장 길이)를 분석해서, 앞으로 다른 주제의 글을 쓸 때 그대로 따라 할 수 있게 2~3문장으로 요약해라. 설명 없이 요약 결과만 출력해라.

===게시물 시작===
${sourceText.slice(0, 800)}
===게시물 끝===`;
  const note = (await generateViaClaude(prompt)).trim();
  persona.save({ note, sourceHandle: raw });
  pushLog(`[대시보드] 페르소나 적용됨: ${note.slice(0, 60)}...`);
  return { note };
}

async function handleLearnAccountsAction(body) {
  const raw = (body?.accounts || '').trim();
  if (!raw) throw new Error('배울 계정 주소를 넣으세요.');
  const handles = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);

  let allPosts = [];
  for (const h of handles) {
    pushLog(`[대시보드] "${h}" 글 배우는 중...`);
    try {
      const posts = await scrapeProfilePosts(h, 3, body?.accountId);
      allPosts = allPosts.concat(posts);
    } catch (err) {
      pushLog(`[대시보드] "${h}" 배우기 실패(건너뜀): ${err.message}`);
    }
  }
  if (!allPosts.length) throw new Error('배울 수 있는 글을 하나도 못 찾았어요.');

  const prompt = `아래는 여러 쓰레드(Threads) 게시물이다. 이 글들의 공통 패턴(훅 종류 2~3가지, 글 구조 2~3가지, 자주 다루는 주제)을 분석해서 앞으로 새 글을 쓸 때 참고할 수 있게 짧게 요약해라. 설명 없이 요약 결과만 출력해라.

${allPosts.map((p, i) => `--- 게시물 ${i + 1} ---\n${p.slice(0, 500)}`).join('\n\n')}`;
  const summary = (await generateViaClaude(prompt)).trim();
  const data = { accounts: handles, summary, samplePosts: allPosts.slice(0, 10) };
  channelClone.save(data);
  pushLog(`[대시보드] 채널 복제 학습 완료 (${handles.length}개 계정, 게시물 ${allPosts.length}개)`);
  return data;
}

async function handleChannelWriteAction(body) {
  const data = channelClone.load();
  if (!data.summary) throw new Error('먼저 계정을 배우세요.');
  const count = Math.max(1, Math.min(3, Number(body?.count) || 1));
  const type = body?.type === 'shopping' ? 'shopping' : 'daily';
  const personaNote = persona.load().note;

  const samples = data.samplePosts.sort(() => Math.random() - 0.5).slice(0, 2);
  const drafts = [];
  for (let i = 0; i < count; i++) {
    const prompt = `아래는 배운 계정들의 글 패턴 요약과 실제 예시 글이다. 이 패턴(훅 방식, 구조, 주제 성향)을 따라 완전히 새로운 내용의 쓰레드(Threads) 글을 하나 써라. 예시를 베끼지 말고 패턴만 따른다.
말투 지침: ${personaNote}

[패턴 요약]
${data.summary}

[예시 글]
${samples.map((s, idx) => `--- 예시 ${idx + 1} ---\n${s.slice(0, 400)}`).join('\n\n')}

결과는 게시물 본문 텍스트만 출력해라(설명이나 따옴표 없이).`;
    const content = (await generateViaClaude(prompt)).trim();
    drafts.push(addDraft({ type, content, source: '채널복제' }));
  }
  pushLog(`[대시보드] 채널 복제로 ${drafts.length}개 생성 → [검수] 탭에 추가됨`);
  return drafts;
}

async function handleRecheckAction() {
  logs.length = 0; // 재연결하면 로그를 비우고 새로 시작 — 예전 로그와 섞여서 헷갈리지 않게.
  pushLog('[대시보드] 재연결 시작...');

  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const email = await getClaudeAccountEmail();
  setStatus({ claudeEmail: email, apiBase: config.apiBase });
  const res = await fetch(config.apiBase + '/api/worker/jobs', {
    headers: { Authorization: `Bearer ${config.token}`, ...(email ? { 'X-Claude-Account': email } : {}) },
  });
  if (!res.ok) throw new Error(`서버 연결 실패 (${res.status})`);
  pushLog(`[대시보드] 재연결 확인 완료 — 클로드 계정: ${email || '확인 안 됨'}`);
  return email;
}

// 왼쪽 메뉴 구조 — 참고 앱(쓰레드 자동화 챌린지)의 사이드바를 그대로 매핑.
// ready:true인 것만 실제로 동작하고, 나머지는 "준비 중" 화면만 보여준다(안 되는 걸 되는 척하지 않음).
const NAV_SECTIONS = [
  {
    label: '오늘',
    items: [
      { id: 'status', label: '현황', ready: true },
      { id: 'daily', label: '일상글 올리기', ready: true },
      { id: 'shopping', label: '쇼핑글 올리기', ready: true },
      { id: 'schedule', label: '예약', ready: true },
      { id: 'custom', label: '직접 소싱(커스텀)', ready: true },
      { id: 'clone', label: '채널 복제', ready: true },
      { id: 'revenue', label: '수익', ready: true },
      { id: 'review', label: '검수', ready: true },
      { id: 'toss', label: '토스링크(테스트)', ready: true },
    ],
  },
  {
    label: '준비',
    items: [
      { id: 'ideas', label: '글감 창고', ready: true },
      { id: 'account', label: '계정', ready: true },
      { id: 'persona', label: '페르소나', ready: true },
      { id: 'coupang', label: '쿠파스 API 연결', ready: true },
    ],
  },
];

const PAGE = () => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>유쓰레드 로컬 워커</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Malgun Gothic", sans-serif; background: #f7f7f8; margin: 0; color: #1a1a1a; }
  .shell { display: flex; min-height: 100vh; }
  .sidebar { width: 200px; flex-shrink: 0; background: #17151f; color: #eee; padding: 18px 0; }
  .sidebar .brand { padding: 0 18px 16px; font-weight: 900; font-size: 15px; border-bottom: 1px solid #302c3d; margin-bottom: 10px; }
  .sidebar .brand .sub { font-size: 11px; color: #8b87a0; font-weight: 400; margin-top: 2px; }
  .navsec { margin-bottom: 16px; }
  .navsec .navlabel { font-size: 10px; color: #6f6b85; font-weight: 900; padding: 6px 18px; letter-spacing: .04em; }
  .navitem { display: flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 12.5px; font-weight: 700; cursor: pointer; color: #cfccdd; }
  .navitem:hover { background: #221f2e; }
  .navitem.active { background: #6d28d9; color: #fff; }
  .navitem .badge { font-size: 9px; color: #6f6b85; }
  .navitem.active .badge { color: #d8ccff; }
  .main { flex: 1; padding: 24px 28px; min-width: 0; }
  .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px; margin-bottom: 16px; max-width: 720px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #888; font-size: 12px; margin-bottom: 16px; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
  .dot.off { background: #d4d4d4; }
  .dot.warn { background: #f59e0b; }
  .label { color: #888; width: 110px; flex-shrink: 0; }
  button { background: #6d28d9; color: #fff; border: none; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  button.secondary { background: #fff; color: #333; border: 1px solid #ddd; }
  button:disabled { opacity: .5; cursor: default; }
  input[type=text] { border: 1px solid #ddd; border-radius: 8px; padding: 9px 12px; font-size: 13px; flex: 1; }
  .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .logbar { display: flex; align-items: center; justify-content: space-between; max-width: 720px; margin-bottom: 6px; }
  .logbar span { font-size: 12px; font-weight: 700; color: #555; }
  #logs { max-width: 720px; height: 280px; overflow-y: auto; background: #111; color: #ddd; font-family: Consolas, monospace; font-size: 12px; padding: 12px; border-radius: 10px; box-sizing: border-box; }
  .logline { white-space: pre-wrap; word-break: break-all; margin-bottom: 2px; }
  .time { color: #666; }
  #msg { font-size: 12px; color: #6d28d9; margin-top: 8px; min-height: 16px; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .soon { max-width: 480px; border: 1px dashed #d8d4e0; border-radius: 10px; padding: 28px 20px; text-align: center; color: #8b87a0; background: #fff; }
  .soon .emoji { font-size: 26px; margin-bottom: 8px; }
  .soon .title { font-weight: 900; color: #444; font-size: 14px; margin-bottom: 4px; }
  .steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .step { position: relative; width: 92px; border: 1px solid #e5e5e5; border-radius: 10px; padding: 10px 6px; text-align: center; background: #fafafa; }
  .step.done { border-color: #86efac; background: #f0fdf4; }
  .step.active { border-color: #f59e0b; background: #fffbeb; }
  .step .emoji { font-size: 20px; }
  .step .label { font-size: 11px; font-weight: 800; color: #333; margin-top: 4px; width: auto; }
  .step .sub2 { font-size: 10px; color: #999; margin-top: 2px; }
  .step .badge2 { position: absolute; top: -6px; right: -6px; font-size: 13px; }
  .arrow { color: #ccc; font-size: 14px; }
  .checkitem { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; }
  .checkitem:last-child { border-bottom: none; }
  .checkitem .ci-title { font-weight: 800; }
  .checkitem.ok .ci-title { color: #16a34a; }
  .checkitem.bad .ci-title { color: #dc2626; }
  .checkitem .ci-desc { color: #888; margin: 3px 0; }
  .checkitem .ci-hint { color: #6d28d9; }
</style>
</head>
<body>
  <div class="shell">
    <div class="sidebar">
      <div class="brand">🧵 유쓰레드 워커<div class="sub">로컬 자동화</div></div>
      ${NAV_SECTIONS.map(
        (sec) => `
        <div class="navsec">
          <div class="navlabel">${sec.label}</div>
          ${sec.items
            .map(
              (it) => `<div class="navitem${it.id === 'status' ? ' active' : ''}" data-tab="${it.id}">
            <span>${it.label}</span>${it.ready ? '' : '<span class="badge">🚧</span>'}
          </div>`
            )
            .join('')}
        </div>`
      ).join('')}
    </div>

    <div class="main">
      <div class="tab-panel active" data-panel="status">
        <div class="card" style="max-width:720px">
          <h1>🐣 오늘 현황</h1>
          <div class="sub">계정이 얼마나 컸는지 확인해요. 급하게 쇼핑글부터 올리면 계정이 막혀요 — 일상글로 1주일 예열한 다음 쇼핑글로 넘어가세요.</div>
          <div class="steps" id="stepRow"></div>
        </div>

        <div class="card" style="max-width:720px" id="checklistCard"></div>

        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1 style="font-size:14px">📊 오늘 활동</h1>
            <button class="secondary" id="todayActivityRefreshBtn">갱신</button>
          </div>
          <div class="sub">계정마다 오늘 올린 글(일상·쇼핑)과 좋아요를 봅니다</div>
          <div id="todayActivityArea"></div>
        </div>

        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1 style="font-size:14px">계정별 현황</h1>
            <button class="secondary" id="accountStatusRefreshBtn">갱신</button>
          </div>
          <div class="sub">계정마다 오늘 올린 개수·쇼핑글을 쓸 수 있는 상태인지 봅니다</div>
          <div id="accountStatusArea"></div>
        </div>

        <div class="card">
          <div class="sub" style="margin-bottom:12px">이 창을 닫아도 워커는 계속 돌아가요. 완전히 끄려면 "🛑 워커 종료" 버튼을 쓰세요.</div>
          <div class="row"><span class="dot" id="dot"></span><span id="stateText">연결 확인 중...</span></div>
          <div class="row"><span class="label">클로드 계정</span><span id="claudeEmail">-</span></div>
          <div class="row"><span class="label">서버 주소</span><span id="apiBase">-</span></div>
          <div class="row"><span class="label">현재 작업</span><span id="currentJob">없음</span></div>

          <div class="row" style="margin-top:12px">
            <input type="text" id="keyword" placeholder="예: 다이소 꿀템" />
            <button id="collectBtn">원본 수집 시작</button>
          </div>
          <div class="actions">
            <button class="secondary" id="recheckBtn">🔄 재연결 확인</button>
            <button class="secondary" id="shutdownBtn" style="color:#dc2626;border-color:#fca5a5">🛑 워커 종료</button>
          </div>
          <div id="msg"></div>
        </div>

        <div class="logbar">
          <span>실시간 로그</span>
          <button class="secondary" id="copyBtn">📋 로그 복사</button>
        </div>
        <div id="logs"></div>
      </div>

      <div class="tab-panel" data-panel="account">
        <div class="card">
          <h1>👤 좋아요·댓글·수집용 브라우저 로그인</h1>
          <div class="sub">이 워커가 조종하는 크롬 프로필별로 쓰레드 계정을 하나씩 연결해요(검색·좋아요·댓글·수집에 씀). 계정을 여러 개 추가할 수 있고, 한 번에 한 계정만 켜져서 동작해요(현재 켠 계정).</div>
          <div class="row"><span class="label">클로드 계정</span><span id="acctClaudeEmail">-</span></div>
          <div id="browserAccountList" style="margin-top:8px"></div>
          <div class="row" style="margin-top:10px">
            <input type="text" id="newAccountLabel" placeholder="새 계정 이름(예: sub01, 육아계정)" />
            <button id="addAccountBtn">+ 계정 추가</button>
          </div>
          <div id="acctMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;"></div>
        </div>

        <div class="card">
          <h1 style="font-size:14px">📮 실제 게시할 계정</h1>
          <div class="sub">실제 발행은 공식 API를 쓰기 때문에, 유쓰레드 웹에 연결해둔 쓰레드 계정이 여러 개면 그중 어디로 올릴지 여기서 고를 수 있어요.</div>
          <div id="acctListArea"></div>
          <div id="acctListMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card">
          <h1 style="font-size:14px">🛡 안전하게 쓰는 기준</h1>
          <div class="sub" style="margin-bottom:12px">권고입니다 — 강제로 막지는 않아요. 계정 나이별 권장 게시 개수예요.</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <tr style="color:#888"><td style="padding:4px 0">새 계정 (1주 이내)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">1개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">예열 중 (1~4주)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">2개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">자리 잡음 (1개월~)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">3개</td></tr>
            <tr style="color:#888"><td style="padding:4px 0">성숙 (3개월~)</td><td style="text-align:right;font-weight:700;color:#1a1a1a">5개</td></tr>
          </table>
          <div class="sub" style="margin-top:10px">글 사이 간격 2시간 · 좋아요 하루 3개 · 피하는 시간대 00~08시</div>
          <div class="sub">쓰레드는 "많이"보다 "꾸준히"가 이깁니다. 하루 1개를 30일 올린 계정이 하루 5개를 6일 올린 계정보다 안전하고 멀리 갑니다.</div>
        </div>
      </div>

      <div class="tab-panel" data-panel="daily">
        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1>📝 일상글 올리기</h1>
            <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;padding:3px 10px;border-radius:999px">예열</span>
          </div>
          <div class="sub">계정 조회수를 띄우는 게 목적입니다. 좋아요·댓글이 많이 붙은 원본을 골라 표현만 바꿔 올립니다.</div>

          <div class="row" style="margin-top:10px"><span class="label">원본 수집</span><span id="dailyBenchInfo">키워드를 입력하거나 비워두면 자동으로 하나 골라요.</span></div>
          <div class="row">
            <input type="text" id="dailyKeyword" placeholder="예: 다이소 꿀템 (비워도 됨)" />
            <select id="dailyDuration" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="3">3분</option>
              <option value="5">5분</option>
              <option value="10" selected>10분</option>
              <option value="20">20분</option>
              <option value="30">30분</option>
            </select>
          </div>
          <div class="actions">
            <button id="dailyCollectBtn">📥 원본 수집</button>
            <button class="secondary" data-soon="원본 수집 중단">■ 원본 수집 중단</button>
            <button class="secondary" data-soon="창고 정리">🗑 창고 정리</button>
            <button class="secondary" id="dailyKeywordBankBtn">🔑 검색 키워드 관리</button>
          </div>
          <div class="sub" style="margin-top:8px">글쓰기는 아직 준비 중이에요 — 지금은 원본 수집까지만 실제로 동작해요.</div>

          <div class="actions" style="margin-top:14px">
            <button data-soon="일상글 바로쓰기(생성+게시)" style="background:#f59e0b">🔶 일상글 바로쓰기</button>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#888;margin-top:10px">
            <input type="checkbox" id="dailyAutoToggle" /> 🔄 일상글 자동 올리기 — 2시간마다 전 계정을 한 바퀴(게시 엔진 완성 후 활성화돼요)
          </label>
          <div id="dailyMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:15px">✏️ 내가 직접 써서 올리기</h1>
          <div class="sub">글감 AI를 하나도 안 거칩니다. 쓴 글이 그대로 올라갑니다.</div>
          <textarea id="manualPostText" rows="5" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;font-family:inherit" placeholder="올릴 글을 그대로 쓰세요. 줄바꿈도 쓴 그대로 올라갑니다."></textarea>
          <div class="actions">
            <button class="secondary" data-soon="사진 붙이기">📷 사진 붙이기</button>
            <button class="secondary" data-soon="변형하기">🎭 변형하기</button>
            <button class="secondary" data-soon="되돌리기">↩ 되돌리기</button>
            <button id="manualPostBtn">올리기</button>
          </div>
          <div class="sub">[올리기]는 지금 바로 올립니다. 유쓰레드 웹에서 연동한 쓰레드 계정으로 실제 발행돼요(공식 Meta API 사용, 계정 연동이 안 돼있으면 실패해요).</div>
          <div id="manualPostMsg" style="font-size:12px;color:#6d28d9;margin-top:4px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">벤치 링크로 바로 만들기</h1>
          <div class="row">
            <input type="text" id="benchUrl" placeholder="벤치 글 URL 붙여넣기 (threads.com/@.../post/...)" />
            <button id="benchConvertBtn" style="background:#f59e0b">변환</button>
          </div>
          <div class="sub">마음에 드는 남의 일상글 링크를 넣으면 표현만 바꿔 [검수] 탭에 담아요. 크롬 창이 잠깐 그 글을 열어봅니다.</div>
          <div id="benchMsg" style="font-size:12px;color:#6d28d9;margin-top:4px;min-height:16px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="shopping">
        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1>🛍️ 쇼핑글 올리기</h1>
            <span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:900;padding:3px 10px;border-radius:999px">파는 글</span>
          </div>
          <div class="sub">댓글·공유가 많이 붙은 원본을 골라 내 쿠팡 링크로 바꿔 답니다. 링크는 [직접 소싱] 탭에 붙여넣거나, 검수창에서 직접 달아주세요(자동 상품 검색은 아직 준비 중).</div>

          <div class="row" style="margin-top:10px">
            <input type="text" id="shoppingKeyword" placeholder="예: 다이소 신상 (비워도 됨)" />
            <select id="shoppingDuration" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="3">3분</option>
              <option value="5">5분</option>
              <option value="10" selected>10분</option>
              <option value="20">20분</option>
            </select>
          </div>
          <div class="actions">
            <button id="shoppingCollectBtn" style="background:#2563eb">📥 원본 수집</button>
            <button class="secondary" id="shoppingKeywordBankBtn">🔑 검색 키워드 관리</button>
          </div>
          <div id="shoppingMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:15px">✏️ 내가 직접 써서 올리기</h1>
          <div class="sub">쿠팡 링크는 본문엔 안 넣고 첫 댓글로 자동으로 붙어요(광고 티 안 나게). 상품 링크는 유쓰레드 웹의 쿠팡 파트너스 연동에서 가져와요 — 지금은 본문만 이 칸에서 바로 올릴 수 있어요.</div>
          <textarea id="shoppingPostText" rows="5" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;font-family:inherit" placeholder="쿠팡 상품 소개 글을 쓰세요."></textarea>
          <div class="actions">
            <button id="shoppingPostBtn" style="background:#2563eb">올리기</button>
          </div>
          <div id="shoppingPostMsg" style="font-size:12px;color:#6d28d9;margin-top:4px;min-height:16px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="custom">
        <div class="card" style="max-width:960px">
          <h1>🤙 직접 소싱(커스텀)</h1>
          <div class="sub">스레드에서 직접 찾은 글은 링크를, 내가 쓴 글은 글 그대로 붙여넣어 [검수] 탭에 담습니다. 이 탭의 검색어는 [일상글/쇼핑글 올리기] 탭과 안 섞입니다.</div>
        </div>

        <div class="card" style="max-width:960px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <h1 style="font-size:14px">📗 일상글 소싱</h1>
              <div class="row"><input type="text" id="customKwDaily" placeholder="예: 자취 꿀템" /><button class="secondary" id="addKwDailyBtn">추가</button></div>
              <div id="customKwDailyList" style="font-size:11px;color:#888;margin:4px 0 8px"></div>
              <div class="sub" style="margin-top:6px">📁 키워드 그룹(켜둔 그룹의 검색어도 소싱 때 같이 랜덤으로 뽑혀요)</div>
              <div id="customKwGroupsDaily" style="font-size:11px;color:#888;margin:4px 0 8px"></div>
              <div class="row">
                <input type="text" id="newKwGroupNameDaily" placeholder="그룹 이름(예: 자취템 시리즈)" style="max-width:140px" />
                <input type="text" id="newKwGroupWordsDaily" placeholder="검색어(쉼표로 구분)" />
                <button class="secondary" id="addKwGroupDailyBtn">그룹 추가</button>
              </div>
              <div class="actions" style="margin-top:8px">
                <button id="customCollectDailyBtn">📥 내 검색어로 일상글 소싱</button>
              </div>
              <div class="sub" id="customMaterialDailyInfo" style="margin-top:6px">글감 창고: 0개</div>
              <div class="actions" style="margin-top:8px">
                <button id="customWriteDailyBtn" style="background:#f59e0b">🔶 일상글 바로쓰기</button>
              </div>
            </div>
            <div>
              <h1 style="font-size:14px">🛒 쇼핑글 소싱</h1>
              <div class="row"><input type="text" id="customKwShopping" placeholder="예: 다이소 신상" /><button class="secondary" id="addKwShoppingBtn">추가</button></div>
              <div id="customKwShoppingList" style="font-size:11px;color:#888;margin:4px 0 8px"></div>
              <div class="sub" style="margin-top:6px">📁 키워드 그룹(켜둔 그룹의 검색어도 소싱 때 같이 랜덤으로 뽑혀요)</div>
              <div id="customKwGroupsShopping" style="font-size:11px;color:#888;margin:4px 0 8px"></div>
              <div class="row">
                <input type="text" id="newKwGroupNameShopping" placeholder="그룹 이름(예: 다이소 시리즈)" style="max-width:140px" />
                <input type="text" id="newKwGroupWordsShopping" placeholder="검색어(쉼표로 구분)" />
                <button class="secondary" id="addKwGroupShoppingBtn">그룹 추가</button>
              </div>
              <div class="actions" style="margin-top:8px">
                <button id="customCollectShoppingBtn" style="background:#2563eb">📥 내 검색어로 쇼핑글 소싱</button>
              </div>
              <div class="sub" id="customMaterialShoppingInfo" style="margin-top:6px">글감 창고: 0개</div>
              <div class="actions" style="margin-top:8px">
                <button id="customWriteShoppingBtn" style="background:#2563eb">🛍️ 쇼핑글 바로쓰기</button>
              </div>
            </div>
          </div>
          <div class="row" style="margin-top:12px">
            <select id="customDuration" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="3">3분</option>
              <option value="5" selected>5분</option>
              <option value="10">10분</option>
              <option value="20">20분</option>
            </select>
          </div>
          <div id="customMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:960px">
          <h1 style="font-size:14px">📊 반응 기준(좋아요·댓글)</h1>
          <div class="sub">직접 넣은 검색어로 아무거나 담기지 않게 걸러요. 화면에 보이는 숫자 순서로 추정한 값이라 100% 정확하진 않을 수 있어요.</div>
          <div class="row"><span class="label">일상글 — 좋아요</span><input type="text" id="minLikesDaily" value="0" style="max-width:80px" /><span class="label" style="width:auto">개 또는 댓글</span><input type="text" id="minRepliesDaily" value="0" style="max-width:80px" /><span class="label" style="width:auto">개 (둘 중 하나만 넘으면 통과, 0=제한없음)</span></div>
          <div class="row"><span class="label">쇼핑글 — 좋아요</span><input type="text" id="minLikesShopping" value="0" style="max-width:80px" /><span class="label" style="width:auto">개 그리고 댓글</span><input type="text" id="minRepliesShopping" value="0" style="max-width:80px" /><span class="label" style="width:auto">개 (둘 다 넘어야 통과)</span></div>
        </div>

        <div class="card" style="max-width:960px">
          <h1 style="font-size:14px">🔗 링크·직접 쓴 글 붙여넣기</h1>
          <div class="sub">쓰레드 글 주소를 넣으면 열어서 표현만 바꿔 담고, 그냥 글을 붙여넣으면 그대로 담습니다.</div>
          <textarea id="pasteText" rows="4" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;font-family:inherit" placeholder="https://www.threads.com/@아이디/post/... 또는 직접 쓴 글"></textarea>
          <div class="actions">
            <button id="pasteShoppingBtn" style="background:#2563eb">🛒 쇼핑글로 담기</button>
            <button id="pasteDailyBtn">💬 일상글로 담기</button>
          </div>
          <div id="pasteMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:960px">
          <h1 style="font-size:14px">✂️ 글쓰기 조건(바로쓰기 누를 때 몇 개씩 만들지)</h1>
          <div class="sub">원본 글감 하나당 이 개수만큼 [바로쓰기]가 한 번에 만들어요(글감이 부족하면 있는 만큼만).</div>
          <div class="row">
            <select id="customWriteCount" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="1" selected>1개씩</option>
              <option value="2">2개씩</option>
              <option value="3">3개씩</option>
              <option value="5">5개씩</option>
            </select>
          </div>
        </div>
      </div>

      <div class="tab-panel" data-panel="review">
        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1>🧑‍⚖️ 검수</h1>
            <button class="secondary" id="reviewRefreshBtn">🔄 새로고침</button>
          </div>
          <div class="sub">일상글 바로쓰기·직접소싱·붙여넣기로 담긴 글이 여기 쌓여요. 실제로 게시하려면 [지금 게시]를 누르세요.</div>
          <div class="actions">
            <button class="secondary" id="reviewRewriteAllBtn">🔄 전체 다시쓰기</button>
            <button class="secondary" id="reviewClearAllBtn" style="color:#dc2626;border-color:#fca5a5">🗑 대기 비우기</button>
          </div>
          <div id="reviewBulkMsg" style="font-size:12px;color:#6d28d9;margin-top:4px;min-height:16px"></div>
          <div id="reviewList" style="margin-top:8px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="ideas">
        <div class="card" style="max-width:720px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h1>📦 글감 창고</h1>
            <button class="secondary" id="ideasRefreshBtn">🔄 새로고침</button>
          </div>
          <div class="sub">[직접 소싱(커스텀)]에서 원본 수집한 글감이 여기 쌓여요. "바로쓰기"에서 쓴(사용됨) 것도 계속 보여요 — 지우려면 [버리기]를 누르세요.</div>
          <div class="actions" style="margin-top:8px">
            <button class="secondary" id="ideasFilterAll">전체</button>
            <button class="secondary" id="ideasFilterDaily">일상</button>
            <button class="secondary" id="ideasFilterShopping">쇼핑</button>
          </div>
          <div id="ideasList" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="toss">
        <div class="card" style="max-width:720px">
          <h1>🔵 토스링크 <span style="font-size:11px;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:999px">테스트</span></h1>
          <div class="sub">토스쇼핑 쉐어링크를 모아 두고, 정산 제출까지 챙기는 곳이에요. 토스쇼핑 쉐어링크에 쓸 수 있는 공개 API가 확인되지 않아 자동 연결은 없어요 — 링크는 직접 만들어서 저장해두는 방식이에요.</div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">🔗 내 토스 링크 저장소</h1>
          <div class="sub">키워드로 저장해두면 다음에 같은 상품일 때 찾아 쓰기 쉬워요.</div>
          <div class="row">
            <input type="text" id="tossKeyword" placeholder="키워드 (예: 케라시스 샴푸)" style="max-width:220px" />
            <input type="text" id="tossUrl" placeholder="https://toss.im/_m/..." />
            <button id="tossAddLinkBtn">담기</button>
          </div>
          <div id="tossLinksList" style="margin-top:10px"></div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">✅ 정산 제출 체크리스트</h1>
          <div class="sub">토스는 올린 글 주소를 토스 폼에 제출해야 정산돼요. 여기 담아두고 하나씩 체크하세요.</div>
          <div class="row">
            <input type="text" id="tossPostUrl" placeholder="올린 쓰레드 글 주소 https://www.threads.com/@.../post/..." />
            <input type="text" id="tossMemo" placeholder="메모(상품명 등)" style="max-width:160px" />
            <button id="tossAddSubmissionBtn">담기</button>
          </div>
          <div id="tossSubmissionsList" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="persona">
        <div class="card" style="max-width:720px">
          <h1>🎭 페르소나</h1>
          <div class="sub">글을 쓰는 말투를 정하는 곳이에요. 아무것도 안 하면 기본 말투로 써요. 닮고 싶은 계정이 있으면 링크를 넣으세요 — 글을 읽어 말투를 분석한 뒤 그대로 씁니다.</div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">지금 적용 중</h1>
          <div id="personaNoteView" class="sub" style="color:#333"></div>
          <div class="actions" style="margin-top:8px">
            <button class="secondary" id="personaResetBtn">↩ 기본 말투로</button>
          </div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">🪞 닮고 싶은 계정으로 분석</h1>
          <div class="sub">닮고 싶은 계정의 @핸들이나 프로필/게시물 주소를 넣으면, 그 계정 글을 읽어 말투를 분석한 뒤 앞으로 쓰는 모든 글이 그 말투를 따르게 해요.</div>
          <div class="row">
            <input type="text" id="personaHandle" placeholder="@handle 또는 https://www.threads.com/@handle 또는 게시물 링크" />
            <button id="personaAnalyzeBtn">분석해서 적용</button>
          </div>
          <div id="personaMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="revenue">
        <div class="card" style="max-width:720px">
          <h1>💰 수익</h1>
          <div class="sub">쿠팡 파트너스(쿠파스) 실적입니다. 쿠팡파트너스는 클릭/전환 실적을 공개적으로 확인할 수 있는 API가 문서화돼 있지 않아서(2026-08-25 기준 확인), 정확한 수익은 쿠팡파트너스 사이트에서 직접 확인해야 해요.</div>
          <div class="row"><span class="label">쿠팡 API 키</span><span id="revenueKeyStatus">확인 중...</span></div>
          <div class="actions" style="margin-top:8px">
            <a href="https://partners.coupang.com" target="_blank"><button class="secondary">쿠팡파트너스 실적 페이지 열기 ↗</button></a>
          </div>
        </div>
      </div>

      <div class="tab-panel" data-panel="coupang">
        <div class="card" style="max-width:720px">
          <h1>🛍️ 쿠파스 API 연결</h1>
          <div class="sub">쿠팡 파트너스 키는 유쓰레드 웹 대시보드에서 등록해요(암호화 저장이라 이 로컬 워커에서는 직접 입력하지 않아요). 여기서는 등록 여부만 확인할 수 있어요.</div>
          <div class="row"><span class="label">등록 상태</span><span id="coupangKeyStatus">확인 중...</span></div>
          <div class="actions" style="margin-top:8px">
            <button id="coupangCheckBtn">🔄 다시 확인</button>
            <button class="secondary" id="coupangOpenBtn">키 등록하러 가기 ↗</button>
          </div>
        </div>
      </div>

      <div class="tab-panel" data-panel="schedule">
        <div class="card" style="max-width:720px">
          <h1>⏰ 예약</h1>
          <div class="sub">[검수] 탭에 있는 글에 게시 시각을 붙여두면, 그 시각에 워커가 자동으로 올려요. 워커가 켜져 있어야 동작해요 — 꺼두면 그 시각이 지나도 안 올라가고, 다시 켜면 밀린 것부터 올라가요.</div>
          <div class="actions">
            <button class="secondary" id="scheduleRefreshBtn">🔄 새로고침</button>
          </div>
          <div id="scheduleList" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="tab-panel" data-panel="clone">
        <div class="card" style="max-width:720px">
          <h1>🎯 채널 복제 — 이 계정처럼 쓰기</h1>
          <div class="sub">잘 되는 계정 주소를 넣으면 그 계정의 훅 유형·글 구조·주제를 배워서, 앞으로 쓰는 글이 그 결을 따라가요.</div>
          <textarea id="cloneAccounts" rows="3" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:13px;font-family:inherit" placeholder="https://www.threads.com/@계정1&#10;https://www.threads.com/@계정2&#10;@계정3 (한 줄에 하나씩, 최대 5개)"></textarea>
          <div class="actions">
            <button id="cloneLearnBtn">🎯 이 계정들처럼 배우기</button>
            <button class="secondary" id="cloneResetBtn">초기화</button>
          </div>
          <div id="cloneMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">📖 배워 둔 것</h1>
          <div id="cloneSummary" class="sub">아직 배운 계정이 없어요.</div>
        </div>

        <div class="card" style="max-width:720px">
          <h1 style="font-size:14px">✍️ 그 결로 글쓰기</h1>
          <div class="row">
            <select id="cloneWriteType" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="daily">일상글</option>
              <option value="shopping">쇼핑글</option>
            </select>
            <select id="cloneWriteCount" style="border:1px solid #ddd;border-radius:8px;padding:9px 8px;font-size:12px">
              <option value="1">1편</option>
              <option value="2">2편</option>
              <option value="3">3편</option>
            </select>
            <button id="cloneWriteBtn" style="background:#f59e0b">🔶 이 결로 글 만들기</button>
          </div>
          <div id="cloneWriteMsg" style="font-size:12px;color:#6d28d9;margin-top:8px;min-height:16px"></div>
        </div>
      </div>

      ${NAV_SECTIONS.flatMap((s) => s.items)
        .filter((it) => !it.ready)
        .map(
          (it) => `
      <div class="tab-panel" data-panel="${it.id}">
        <div class="soon">
          <div class="emoji">🚧</div>
          <div class="title">${it.label} — 아직 준비 중이에요</div>
          <div>다음 업데이트에서 실제로 동작하게 만들 예정이에요.</div>
        </div>
      </div>`
        )
        .join('')}
    </div>
  </div>

  <script>
    let lastLogs = [];

    document.querySelectorAll('.navitem').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.navitem').forEach((n) => n.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        el.classList.add('active');
        const panel = document.querySelector('.tab-panel[data-panel="' + el.dataset.tab + '"]');
        if (panel) panel.classList.add('active');
      });
    });

    function renderChecklist(s) {
      const aiDone = !!s.claudeEmail;
      const browserDone = true; // 워커가 떠 있다는 것 자체가 크롬을 이미 찾았다는 뜻
      const activeAcctId = window.__activeAccountId || 'default';
      const acctDone = s.threadsLoginStatus?.[activeAcctId]?.loggedIn === true;

      const steps = [
        { emoji: '🤖', label: 'AI 연결', sub2: '클로드', done: aiDone },
        { emoji: '🌐', label: '브라우저', sub2: '구글 크롬 사용', done: browserDone },
        { emoji: '🧵', label: '계정 연결', sub2: acctDone ? '연결됨' : '아직 없음', done: acctDone, active: !acctDone && browserDone },
        { emoji: '✍️', label: '일상글 쓰기', sub2: '아직 준비중', locked: true },
        { emoji: '☀️', label: '1주일 예열', sub2: '아직 준비중', locked: true },
        { emoji: '🛍️', label: '쇼핑글 올리기', sub2: '아직 준비중', locked: true },
      ];

      document.getElementById('stepRow').innerHTML = steps
        .map((st, i) => {
          const cls = st.done ? 'done' : st.active ? 'active' : '';
          const badge = st.locked ? '🔒' : st.done ? '✅' : st.active ? '' : '⬜';
          const arrow = i < steps.length - 1 ? '<span class="arrow">→</span>' : '';
          return (
            '<div class="step ' + cls + '"><span class="badge2">' + badge + '</span>' +
            '<div class="emoji">' + st.emoji + '</div>' +
            '<div class="label">' + st.label + '</div>' +
            '<div class="sub2">' + st.sub2 + '</div></div>' + arrow
          );
        })
        .join('');

      const items = [
        {
          ok: aiDone,
          title: (aiDone ? '✅' : '❌') + ' 클로드(Claude Code) 연결',
          desc: aiDone ? '연결됨 — ' + s.claudeEmail : '클로드 CLI 로그인이 안 돼있어요.',
          hint: aiDone ? '' : '☞ 0_claude_login.bat을 실행해서 클로드 구독 계정으로 로그인하세요.',
        },
        {
          ok: browserDone,
          title: '✅ 브라우저(구글 크롬)',
          desc: '구글 크롬 사용',
          hint: '',
        },
        {
          ok: acctDone,
          title: (acctDone ? '✅' : '❌') + ' 쓰레드 계정 연결',
          desc: acctDone ? '로그인된 계정이 있습니다.' : '로그인된 계정이 없습니다. 안 하면: 연결 전까지는 글을 만들 수는 있어도 올릴 수는 없습니다.',
          hint: acctDone ? '' : '☞ [계정] 탭에서 "지금 확인하기"를 누르면 뜨는 크롬 창에서 평소처럼 쓰레드에 로그인하면 끝입니다.',
        },
      ];
      const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
      document.getElementById('checklistCard').innerHTML =
        '<h1 style="font-size:14px">시작하기 전에 — 아래 순서대로만 하면 됩니다</h1>' +
        '<div class="sub" style="margin-bottom:10px">✅는 이미 끝난 것이니 넘어가세요. ❌만 위에서부터 차례로 해결하면 됩니다.</div>' +
        items.map((it, i) => (
          '<div class="checkitem ' + (it.ok ? 'ok' : 'bad') + '"><div class="ci-title">' + (circled[i] || (i + 1) + '.') + ' ' + it.title + '</div>' +
          '<div class="ci-desc">' + it.desc + '</div>' +
          (it.hint ? '<div class="ci-hint">' + it.hint + '</div>' : '') + '</div>'
        )).join('');
    }

    async function tick() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        renderChecklist(data.status);
        window.__apiBase = data.status.apiBase;
        document.getElementById('dot').className = 'dot' + (data.status.state === 'running' ? '' : ' off');
        document.getElementById('stateText').textContent = data.status.state === 'running' ? '온라인 — 정상 작동 중' : '연결 대기 중';
        document.getElementById('claudeEmail').textContent = data.status.claudeEmail || '확인 안 됨';
        document.getElementById('apiBase').textContent = data.status.apiBase || '-';
        document.getElementById('currentJob').textContent = data.status.currentJob || '없음';
        lastLogs = data.logs;
        const logsEl = document.getElementById('logs');
        const atBottom = logsEl.scrollHeight - logsEl.scrollTop - logsEl.clientHeight < 40;
        logsEl.innerHTML = data.logs.map(l => '<div class="logline"><span class="time">[' + l.time + ']</span> ' + l.text.replace(/</g,'&lt;') + '</div>').join('');
        if (atBottom) logsEl.scrollTop = logsEl.scrollHeight;

        document.getElementById('acctClaudeEmail').textContent = data.status.claudeEmail || '확인 안 됨';
        window.__threadsLoginStatus = data.status.threadsLoginStatus || {};
      } catch {}
    }
    tick();
    setInterval(tick, 1500);

    function setMsg(text) {
      document.getElementById('msg').textContent = text;
    }

    document.getElementById('collectBtn').addEventListener('click', async () => {
      const keyword = document.getElementById('keyword').value.trim();
      if (!keyword) { setMsg('키워드를 입력하세요.'); return; }
      const btn = document.getElementById('collectBtn');
      btn.disabled = true;
      setMsg('작업 등록 중...');
      try {
        const res = await fetch('/api/action/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        setMsg('✅ 작업 등록됨 — 아래 로그에서 진행상황을 확인하세요.');
      } catch (err) {
        setMsg('❌ ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    // 아직 안 만든 기능 버튼(data-soon="라벨") 공용 처리 — 조용히 아무것도 안 하는 대신
    // 뭐가 준비 중인지 화면에 바로 보여준다(가짜로 되는 척하지 않기 위함).
    let toastTimer = null;
    function showToast(text) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.style.cssText = 'position:fixed;bottom:20px;right:24px;background:#1a1a1a;color:#fff;font-size:12px;font-weight:700;padding:10px 16px;border-radius:8px;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,.2)';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-soon]');
      if (btn) showToast('🚧 "' + btn.dataset.soon + '" 아직 준비 중이에요.');
    });

    document.getElementById('dailyCollectBtn').addEventListener('click', async () => {
      const keyword = document.getElementById('dailyKeyword').value.trim();
      const minutes = document.getElementById('dailyDuration').value;
      const btn = document.getElementById('dailyCollectBtn');
      btn.disabled = true;
      document.getElementById('dailyMsg').textContent = '작업 등록 중...';
      try {
        const res = await fetch('/api/action/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, minutes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        document.getElementById('dailyMsg').textContent = '✅ 작업 등록됨 — [현황] 탭 로그에서 진행상황을 볼 수 있어요.';
      } catch (err) {
        document.getElementById('dailyMsg').textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('manualPostBtn').addEventListener('click', async () => {
      const text = document.getElementById('manualPostText').value.trim();
      const msgEl = document.getElementById('manualPostMsg');
      if (!text) { msgEl.textContent = '❌ 올릴 글을 입력하세요.'; return; }
      const btn = document.getElementById('manualPostBtn');
      btn.disabled = true;
      msgEl.textContent = '초안 생성 중...';
      try {
        const res = await fetch('/api/action/post-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, type: 'daily' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ 실제로 게시됐어요 (threadsPostId: ' + data.threadsPostId + ')';
        document.getElementById('manualPostText').value = '';
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('dailyKeywordBankBtn').addEventListener('click', () => {
      const base = window.__apiBase || 'https://u-thread.vercel.app';
      window.open(base + '/dashboard/ai-worker', '_blank');
    });

    document.getElementById('benchConvertBtn').addEventListener('click', async () => {
      const text = document.getElementById('benchUrl').value.trim();
      const msgEl = document.getElementById('benchMsg');
      if (!text) { msgEl.textContent = '❌ 링크를 입력하세요.'; return; }
      const btn = document.getElementById('benchConvertBtn');
      btn.disabled = true;
      msgEl.textContent = '변환 중... (크롬 창이 잠깐 뜰 수 있어요)';
      try {
        const res = await fetch('/api/action/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'daily', text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ [검수] 탭에 담겼어요.';
        document.getElementById('benchUrl').value = '';
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });

    // ---- 쇼핑글 올리기 ----
    document.getElementById('shoppingCollectBtn').addEventListener('click', async () => {
      const keyword = document.getElementById('shoppingKeyword').value.trim();
      const minutes = document.getElementById('shoppingDuration').value;
      const btn = document.getElementById('shoppingCollectBtn');
      btn.disabled = true;
      document.getElementById('shoppingMsg').textContent = '작업 등록 중...';
      try {
        const res = await fetch('/api/action/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, minutes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        document.getElementById('shoppingMsg').textContent = '✅ 작업 등록됨 — [현황] 탭 로그에서 진행상황을 볼 수 있어요.';
      } catch (err) {
        document.getElementById('shoppingMsg').textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById('shoppingKeywordBankBtn').addEventListener('click', () => {
      const base = window.__apiBase || 'https://u-thread.vercel.app';
      window.open(base + '/dashboard/ai-worker', '_blank');
    });
    document.getElementById('shoppingPostBtn').addEventListener('click', async () => {
      const text = document.getElementById('shoppingPostText').value.trim();
      const msgEl = document.getElementById('shoppingPostMsg');
      if (!text) { msgEl.textContent = '❌ 올릴 글을 입력하세요.'; return; }
      const btn = document.getElementById('shoppingPostBtn');
      btn.disabled = true;
      msgEl.textContent = '게시 중...';
      try {
        const res = await fetch('/api/action/post-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, type: 'shopping' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ 실제로 게시됐어요 (threadsPostId: ' + data.threadsPostId + ')';
        document.getElementById('shoppingPostText').value = '';
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });

    // ---- 직접 소싱(커스텀) ----
    async function loadCustomKeywords() {
      const res = await fetch('/api/custom-keywords');
      const data = await res.json();
      renderKwList('customKwDailyList', data.daily || [], 'daily');
      renderKwList('customKwShoppingList', data.shopping || [], 'shopping');
      renderKwGroups('customKwGroupsDaily', data.dailyGroups || [], 'daily');
      renderKwGroups('customKwGroupsShopping', data.shoppingGroups || [], 'shopping');
      return data;
    }
    function renderKwGroups(elId, groups, type) {
      const el = document.getElementById(elId);
      if (!groups.length) { el.textContent = '아직 없습니다.'; return; }
      el.innerHTML = groups.map((g) => (
        '<div style="display:flex;align-items:center;gap:6px;padding:3px 0">' +
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer">' +
        '<input type="checkbox" data-toggle-kwgroup="' + g.id + '" data-kwgroup-type="' + type + '"' + (g.enabled ? ' checked' : '') + ' />' +
        '<b>' + g.name + '</b></label>' +
        '<span style="color:#aaa">(' + g.keywords.length + '개: ' + g.keywords.join(', ') + ')</span>' +
        '<span data-delete-kwgroup="' + g.id + '" data-kwgroup-type="' + type + '" style="cursor:pointer;color:#a78bfa;margin-left:auto">×</span>' +
        '</div>'
      )).join('');
    }
    async function addKeywordGroup(type) {
      const nameEl = document.getElementById(type === 'daily' ? 'newKwGroupNameDaily' : 'newKwGroupNameShopping');
      const wordsEl = document.getElementById(type === 'daily' ? 'newKwGroupWordsDaily' : 'newKwGroupWordsShopping');
      const name = nameEl.value.trim();
      const keywords = wordsEl.value.split(',').map((s) => s.trim()).filter(Boolean);
      if (!name || !keywords.length) { document.getElementById('customMsg').textContent = '❌ 그룹 이름과 검색어를 입력하세요.'; return; }
      await fetch('/api/action/add-keyword-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, keywords }),
      });
      nameEl.value = '';
      wordsEl.value = '';
      await loadCustomKeywords();
    }
    document.getElementById('addKwGroupDailyBtn').addEventListener('click', () => addKeywordGroup('daily'));
    document.getElementById('addKwGroupShoppingBtn').addEventListener('click', () => addKeywordGroup('shopping'));
    document.addEventListener('change', async (e) => {
      const el = e.target.closest('[data-toggle-kwgroup]');
      if (!el) return;
      await fetch('/api/action/toggle-keyword-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: el.dataset.kwgroupType, groupId: el.dataset.toggleKwgroup }),
      });
      await loadCustomKeywords();
    });
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-delete-kwgroup]');
      if (!el) return;
      if (!confirm('그룹을 삭제할까요?')) return;
      await fetch('/api/action/delete-keyword-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: el.dataset.kwgroupType, groupId: el.dataset.deleteKwgroup }),
      });
      await loadCustomKeywords();
    });
    function renderKwList(elId, list, type) {
      const el = document.getElementById(elId);
      if (!list.length) { el.textContent = '아직 없습니다.'; return; }
      el.innerHTML = list.map((k) => (
        '<span style="display:inline-flex;align-items:center;gap:3px;background:#f3f0ff;color:#6d28d9;font-weight:700;padding:2px 8px;border-radius:999px;margin:2px">' +
        k + '<span data-remove-kw="' + k + '" data-kw-type="' + type + '" style="cursor:pointer;color:#a78bfa">×</span></span>'
      )).join('');
    }
    async function saveKeywordList(type, keywords) {
      await fetch('/api/action/save-custom-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, keywords }),
      });
      await loadCustomKeywords();
    }
    document.getElementById('addKwDailyBtn').addEventListener('click', async () => {
      const input = document.getElementById('customKwDaily');
      const kw = input.value.trim();
      if (!kw) return;
      const data = await loadCustomKeywords();
      if (!(data.daily || []).includes(kw)) await saveKeywordList('daily', [...(data.daily || []), kw]);
      input.value = '';
    });
    document.getElementById('addKwShoppingBtn').addEventListener('click', async () => {
      const input = document.getElementById('customKwShopping');
      const kw = input.value.trim();
      if (!kw) return;
      const data = await loadCustomKeywords();
      if (!(data.shopping || []).includes(kw)) await saveKeywordList('shopping', [...(data.shopping || []), kw]);
      input.value = '';
    });
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-remove-kw]');
      if (!el) return;
      const type = el.dataset.kwType;
      const data = await loadCustomKeywords();
      await saveKeywordList(type, (data[type] || []).filter((k) => k !== el.dataset.removeKw));
    });

    function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

    async function runCustomCollect(type) {
      const data = await loadCustomKeywords();
      const groupWords = (data[type + 'Groups'] || []).filter((g) => g.enabled).flatMap((g) => g.keywords);
      const list = [...new Set([...(data[type] || []), ...groupWords])];
      if (!list.length) { document.getElementById('customMsg').textContent = '❌ 먼저 검색어를 추가하세요.'; return; }
      const keyword = pickRandom(list);
      const minutes = document.getElementById('customDuration').value;
      const minLikes = document.getElementById(type === 'daily' ? 'minLikesDaily' : 'minLikesShopping').value;
      const minReplies = document.getElementById(type === 'daily' ? 'minRepliesDaily' : 'minRepliesShopping').value;
      document.getElementById('customMsg').textContent = '"' + keyword + '" 수집 등록 중...';
      try {
        const res = await fetch('/api/action/custom-collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, keyword, minutes, minLikes, minReplies }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || '실패');
        document.getElementById('customMsg').textContent = '✅ "' + keyword + '" 수집 등록됨 — [현황] 탭 로그에서 진행상황을 볼 수 있어요.';
      } catch (err) {
        document.getElementById('customMsg').textContent = '❌ ' + err.message;
      }
    }
    document.getElementById('customCollectDailyBtn').addEventListener('click', () => runCustomCollect('daily'));
    document.getElementById('customCollectShoppingBtn').addEventListener('click', () => runCustomCollect('shopping'));

    async function runCustomWrite(type) {
      const btn = document.getElementById(type === 'daily' ? 'customWriteDailyBtn' : 'customWriteShoppingBtn');
      btn.disabled = true;
      const count = document.getElementById('customWriteCount').value;
      document.getElementById('customMsg').textContent = count + '개 쓰는 중...(클로드 호출이라 몇 초씩 걸려요)';
      try {
        const res = await fetch('/api/action/custom-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, count }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        document.getElementById('customMsg').textContent = '✅ [검수] 탭에 ' + data.drafts.length + '개 추가됐어요.';
      } catch (err) {
        document.getElementById('customMsg').textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    }
    document.getElementById('customWriteDailyBtn').addEventListener('click', () => runCustomWrite('daily'));
    document.getElementById('customWriteShoppingBtn').addEventListener('click', () => runCustomWrite('shopping'));

    async function runPaste(type) {
      const text = document.getElementById('pasteText').value.trim();
      const msgEl = document.getElementById('pasteMsg');
      if (!text) { msgEl.textContent = '❌ 내용을 입력하세요.'; return; }
      msgEl.textContent = '처리 중...';
      try {
        const res = await fetch('/api/action/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ [검수] 탭에 담겼어요.';
        document.getElementById('pasteText').value = '';
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      }
    }
    document.getElementById('pasteDailyBtn').addEventListener('click', () => runPaste('daily'));
    document.getElementById('pasteShoppingBtn').addEventListener('click', () => runPaste('shopping'));

    // ---- 검수 ----
    async function loadReviewQueue() {
      const res = await fetch('/api/queue');
      const data = await res.json();
      const el = document.getElementById('reviewList');
      if (!data.items.length) {
        el.innerHTML = '<div class="sub" style="margin-top:10px">검수할 글이 없습니다. [일상글/쇼핑글/직접소싱]에서 먼저 글을 만들어보세요.</div>';
        return;
      }
      el.innerHTML = data.items.map((d) => (
        '<div class="checkitem"><div class="ci-title">' + (d.type === 'shopping' ? '🛒 쇼핑글' : '💬 일상글') + ' · ' + (d.source || '') + ' · ' + new Date(d.createdAt).toLocaleString('ko-KR') + '</div>' +
        '<div class="ci-desc" style="white-space:pre-wrap">' + d.content.replace(/</g, '&lt;') + '</div>' +
        '<div class="actions" style="margin-top:6px">' +
        '<button data-publish-id="' + d.id + '">지금 게시</button>' +
        '<button class="secondary" data-remove-id="' + d.id + '">삭제</button>' +
        '</div></div>'
      )).join('');
    }
    document.getElementById('reviewRefreshBtn').addEventListener('click', loadReviewQueue);
    document.getElementById('reviewClearAllBtn').addEventListener('click', async () => {
      if (!confirm('검수 대기 중인 글을 전부 지울까요?')) return;
      const res = await fetch('/api/action/queue-clear-all', { method: 'POST' });
      const data = await res.json();
      document.getElementById('reviewBulkMsg').textContent = res.ok ? '✅ ' + data.cleared + '개 비웠어요.' : '❌ ' + data.error;
      await loadReviewQueue();
    });
    document.getElementById('reviewRewriteAllBtn').addEventListener('click', async () => {
      if (!confirm('지금 대기 중인 글을 버리고 같은 개수만큼 글감에서 새로 쓸까요?')) return;
      const btn = document.getElementById('reviewRewriteAllBtn');
      btn.disabled = true;
      document.getElementById('reviewBulkMsg').textContent = '다시 쓰는 중...';
      try {
        const res = await fetch('/api/action/queue-rewrite-all', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        document.getElementById('reviewBulkMsg').textContent = '✅ ' + data.drafts.length + '개로 다시 썼어요.';
        await loadReviewQueue();
      } catch (err) {
        document.getElementById('reviewBulkMsg').textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });
    document.addEventListener('click', async (e) => {
      const pubBtn = e.target.closest('[data-publish-id]');
      if (pubBtn) {
        pubBtn.disabled = true;
        pubBtn.textContent = '게시 중...';
        try {
          const res = await fetch('/api/action/queue-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pubBtn.dataset.publishId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '실패');
          await loadReviewQueue();
        } catch (err) {
          alert('❌ ' + err.message);
          pubBtn.disabled = false;
          pubBtn.textContent = '지금 게시';
        }
        return;
      }
      const rmBtn = e.target.closest('[data-remove-id]');
      if (rmBtn) {
        await fetch('/api/action/queue-remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rmBtn.dataset.removeId }),
        });
        await loadReviewQueue();
      }
    });

    // ---- 글감 창고 ----
    let ideasFilter = 'all';
    async function loadIdeas() {
      const res = await fetch('/api/materials');
      const data = await res.json();
      const combined = [
        ...(data.daily || []).map((m) => ({ ...m, type: 'daily' })),
        ...(data.shopping || []).map((m) => ({ ...m, type: 'shopping' })),
      ].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      const filtered = ideasFilter === 'all' ? combined : combined.filter((m) => m.type === ideasFilter);
      const el = document.getElementById('ideasList');
      if (!filtered.length) {
        el.innerHTML = '<div class="sub">아직 수집된 글이 없습니다 — [직접 소싱(커스텀)]에서 원본 수집을 먼저 하세요.</div>';
        return;
      }
      el.innerHTML = filtered.map((m) => (
        '<div class="checkitem"><div class="ci-title">' + (m.type === 'shopping' ? '🛒 쇼핑' : '💬 일상') + (m.used ? ' · 사용됨' : ' · 안 씀') + '</div>' +
        '<div class="ci-desc" style="white-space:pre-wrap">' + m.content.replace(/</g, '&lt;').slice(0, 300) + '</div>' +
        '<div class="actions" style="margin-top:6px"><button class="secondary" data-material-remove="' + m.id + '" data-material-type="' + m.type + '">버리기</button></div></div>'
      )).join('');
    }
    document.getElementById('ideasRefreshBtn').addEventListener('click', loadIdeas);
    document.getElementById('ideasFilterAll').addEventListener('click', () => { ideasFilter = 'all'; loadIdeas(); });
    document.getElementById('ideasFilterDaily').addEventListener('click', () => { ideasFilter = 'daily'; loadIdeas(); });
    document.getElementById('ideasFilterShopping').addEventListener('click', () => { ideasFilter = 'shopping'; loadIdeas(); });
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-material-remove]');
      if (!el) return;
      await fetch('/api/action/materials-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: el.dataset.materialRemove, type: el.dataset.materialType }),
      });
      await loadIdeas();
    });
    document.querySelector('.navitem[data-tab="ideas"]').addEventListener('click', loadIdeas);

    // ---- 토스링크(테스트) ----
    async function loadToss() {
      const res = await fetch('/api/toss');
      const data = await res.json();
      const linksEl = document.getElementById('tossLinksList');
      linksEl.innerHTML = (data.links || []).length
        ? data.links.map((l) => (
            '<div class="row"><span style="font-weight:800;min-width:100px">' + l.keyword + '</span>' +
            '<a href="' + l.url + '" target="_blank" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + l.url + '</a>' +
            '<button class="secondary" data-toss-remove-link="' + l.id + '">삭제</button></div>'
          )).join('')
        : '<div class="sub">아직 담아 둔 링크가 없습니다.</div>';

      const subEl = document.getElementById('tossSubmissionsList');
      subEl.innerHTML = (data.submissions || []).length
        ? data.submissions.map((s) => (
            '<div class="row"><input type="checkbox" data-toss-toggle-sub="' + s.id + '"' + (s.checked ? ' checked' : '') + ' />' +
            '<a href="' + s.postUrl + '" target="_blank" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px' + (s.checked ? ';text-decoration:line-through;color:#aaa' : '') + '">' + s.postUrl + '</a>' +
            '<span style="font-size:11px;color:#888">' + (s.memo || '') + '</span>' +
            '<button class="secondary" data-toss-remove-sub="' + s.id + '">삭제</button></div>'
          )).join('')
        : '<div class="sub">아직 담아 둔 글이 없습니다.</div>';
    }
    document.getElementById('tossAddLinkBtn').addEventListener('click', async () => {
      const keyword = document.getElementById('tossKeyword').value.trim();
      const url = document.getElementById('tossUrl').value.trim();
      if (!keyword || !url) return;
      await fetch('/api/action/toss-add-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, url }),
      });
      document.getElementById('tossKeyword').value = '';
      document.getElementById('tossUrl').value = '';
      await loadToss();
    });
    document.getElementById('tossAddSubmissionBtn').addEventListener('click', async () => {
      const postUrl = document.getElementById('tossPostUrl').value.trim();
      const memo = document.getElementById('tossMemo').value.trim();
      if (!postUrl) return;
      await fetch('/api/action/toss-add-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl, memo }),
      });
      document.getElementById('tossPostUrl').value = '';
      document.getElementById('tossMemo').value = '';
      await loadToss();
    });
    document.addEventListener('click', async (e) => {
      const rmLink = e.target.closest('[data-toss-remove-link]');
      if (rmLink) {
        await fetch('/api/action/toss-remove-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rmLink.dataset.tossRemoveLink }) });
        await loadToss();
        return;
      }
      const rmSub = e.target.closest('[data-toss-remove-sub]');
      if (rmSub) {
        await fetch('/api/action/toss-remove-submission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rmSub.dataset.tossRemoveSub }) });
        await loadToss();
      }
    });
    document.addEventListener('change', async (e) => {
      const tog = e.target.closest('[data-toss-toggle-sub]');
      if (!tog) return;
      await fetch('/api/action/toss-toggle-submission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tog.dataset.tossToggleSub }) });
      await loadToss();
    });
    document.querySelector('.navitem[data-tab="toss"]').addEventListener('click', loadToss);

    // ---- 페르소나 ----
    async function loadPersona() {
      const res = await fetch('/api/persona');
      const data = await res.json();
      document.getElementById('personaNoteView').textContent = data.note + (data.sourceHandle ? ' (출처: ' + data.sourceHandle + ')' : ' (고정)');
    }
    document.getElementById('personaAnalyzeBtn').addEventListener('click', async () => {
      const handle = document.getElementById('personaHandle').value.trim();
      const msgEl = document.getElementById('personaMsg');
      if (!handle) { msgEl.textContent = '❌ 계정을 입력하세요.'; return; }
      const btn = document.getElementById('personaAnalyzeBtn');
      btn.disabled = true;
      msgEl.textContent = '분석 중... (크롬으로 그 계정 글을 열어봐요, 10~20초 걸려요)';
      try {
        const res = await fetch('/api/action/persona-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ 적용됐어요. 앞으로 만드는 글이 이 말투를 따라요.';
        await loadPersona();
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById('personaResetBtn').addEventListener('click', async () => {
      await fetch('/api/action/persona-reset', { method: 'POST' });
      await loadPersona();
    });
    document.querySelector('.navitem[data-tab="persona"]').addEventListener('click', loadPersona);

    // ---- 수익 / 쿠파스 API 연결 ----
    async function loadKeyStatus(elId) {
      const el = document.getElementById(elId);
      el.textContent = '확인 중...';
      try {
        const res = await fetch('/api/key-status?provider=COUPANG');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        el.textContent = data.hasKey ? '✅ 등록됨' : '❌ 미등록';
      } catch (err) {
        el.textContent = '❌ ' + err.message;
      }
    }
    document.querySelector('.navitem[data-tab="revenue"]').addEventListener('click', () => loadKeyStatus('revenueKeyStatus'));
    document.querySelector('.navitem[data-tab="coupang"]').addEventListener('click', () => loadKeyStatus('coupangKeyStatus'));
    document.getElementById('coupangCheckBtn').addEventListener('click', () => loadKeyStatus('coupangKeyStatus'));
    document.getElementById('coupangOpenBtn').addEventListener('click', () => {
      const base = window.__apiBase || 'https://u-thread.vercel.app';
      window.open(base + '/onboarding/coupang', '_blank');
    });

    // ---- 예약 ----
    function toLocalInputValue(iso) {
      const d = iso ? new Date(iso) : new Date(Date.now() + 30 * 60000);
      const pad = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    async function loadSchedule() {
      const res = await fetch('/api/queue');
      const data = await res.json();
      const el = document.getElementById('scheduleList');
      if (!data.items.length) {
        el.innerHTML = '<div class="sub">[검수] 탭에 글이 없어요 — 먼저 글을 만드세요.</div>';
        return;
      }
      el.innerHTML = data.items.map((d) => (
        '<div class="checkitem"><div class="ci-title">' + (d.type === 'shopping' ? '🛒 쇼핑글' : '💬 일상글') +
        (d.scheduledAt ? ' · ⏰ ' + new Date(d.scheduledAt).toLocaleString('ko-KR') + ' 예약됨' : ' · 예약 안 됨') + '</div>' +
        '<div class="ci-desc" style="white-space:pre-wrap">' + d.content.replace(/</g, '&lt;').slice(0, 150) + '</div>' +
        '<div class="row" style="margin-top:6px">' +
        '<input type="datetime-local" data-sched-input="' + d.id + '" value="' + toLocalInputValue(d.scheduledAt) + '" style="max-width:220px" />' +
        '<button data-sched-set="' + d.id + '">예약 설정</button>' +
        (d.scheduledAt ? '<button class="secondary" data-sched-clear="' + d.id + '">예약 취소</button>' : '') +
        '</div></div>'
      )).join('');
    }
    document.getElementById('scheduleRefreshBtn').addEventListener('click', loadSchedule);
    document.addEventListener('click', async (e) => {
      const setBtn = e.target.closest('[data-sched-set]');
      if (setBtn) {
        const input = document.querySelector('[data-sched-input="' + setBtn.dataset.schedSet + '"]');
        const scheduledAt = new Date(input.value).toISOString();
        await fetch('/api/action/schedule-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: setBtn.dataset.schedSet, scheduledAt }),
        });
        await loadSchedule();
        return;
      }
      const clearBtn = e.target.closest('[data-sched-clear]');
      if (clearBtn) {
        await fetch('/api/action/schedule-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: clearBtn.dataset.schedClear, scheduledAt: null }),
        });
        await loadSchedule();
      }
    });
    document.querySelector('.navitem[data-tab="schedule"]').addEventListener('click', loadSchedule);

    // ---- 채널 복제 ----
    async function loadClone() {
      const res = await fetch('/api/channel-clone');
      const data = await res.json();
      document.getElementById('cloneSummary').textContent = data.summary
        ? '배운 계정: ' + data.accounts.join(', ') + '\\n\\n' + data.summary
        : '아직 배운 계정이 없어요.';
    }
    document.getElementById('cloneLearnBtn').addEventListener('click', async () => {
      const accounts = document.getElementById('cloneAccounts').value.trim();
      const msgEl = document.getElementById('cloneMsg');
      if (!accounts) { msgEl.textContent = '❌ 계정 주소를 넣으세요.'; return; }
      const btn = document.getElementById('cloneLearnBtn');
      btn.disabled = true;
      msgEl.textContent = '배우는 중... (계정마다 크롬으로 열어봐서 시간이 좀 걸려요)';
      try {
        const res = await fetch('/api/action/clone-learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ 배우기 완료!';
        await loadClone();
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });
    document.getElementById('cloneResetBtn').addEventListener('click', async () => {
      await fetch('/api/action/clone-reset', { method: 'POST' });
      await loadClone();
    });
    document.getElementById('cloneWriteBtn').addEventListener('click', async () => {
      const type = document.getElementById('cloneWriteType').value;
      const count = document.getElementById('cloneWriteCount').value;
      const msgEl = document.getElementById('cloneWriteMsg');
      const btn = document.getElementById('cloneWriteBtn');
      btn.disabled = true;
      msgEl.textContent = '쓰는 중...';
      try {
        const res = await fetch('/api/action/clone-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, count }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        msgEl.textContent = '✅ [검수] 탭에 추가됐어요.';
      } catch (err) {
        msgEl.textContent = '❌ ' + err.message;
      } finally {
        btn.disabled = false;
      }
    });
    document.querySelector('.navitem[data-tab="clone"]').addEventListener('click', loadClone);

    document.querySelector('.navitem[data-tab="custom"]').addEventListener('click', loadCustomKeywords);
    document.querySelector('.navitem[data-tab="review"]').addEventListener('click', loadReviewQueue);
    loadCustomKeywords();

    async function loadThreadsAccountList() {
      const el = document.getElementById('acctListArea');
      el.textContent = '불러오는 중...';
      try {
        const res = await fetch('/api/threads-accounts-list');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        if (!data.accounts.length) {
          el.innerHTML = '<div class="sub">연동된 쓰레드 계정이 없어요. 유쓰레드 웹 대시보드에서 먼저 연결하세요.</div>';
          return;
        }
        el.innerHTML = data.accounts.map((a) => (
          '<label style="display:flex;align-items:center;gap:8px;border:1px solid #e5e5e5;border-radius:8px;padding:10px;margin-bottom:6px;cursor:pointer">' +
          '<input type="radio" name="defaultAcct" value="' + a.id + '"' + (a.id === data.defaultThreadsAccountId ? ' checked' : '') + ' />' +
          '<span style="font-weight:800;font-size:13px">@' + (a.username || a.threads_user_id) + '</span>' +
          '</label>'
        )).join('');
        if (!data.defaultThreadsAccountId) {
          document.getElementById('acctListMsg').textContent = '아직 안 골랐으면 첫 번째 계정으로 자동 게시돼요. 원하는 계정을 선택하면 저장됩니다.';
        }
      } catch (err) {
        el.innerHTML = '<div class="sub">❌ ' + err.message + '</div>';
      }
    }
    document.addEventListener('change', async (e) => {
      if (e.target.name !== 'defaultAcct') return;
      await fetch('/api/action/set-default-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.target.value }),
      });
      document.getElementById('acctListMsg').textContent = '✅ 이 계정으로 게시하도록 저장됐어요.';
    });
    document.querySelector('.navitem[data-tab="account"]').addEventListener('click', loadThreadsAccountList);

    // ---- 좋아요/댓글/수집용 브라우저 계정(여러 개) ----
    async function loadBrowserAccounts() {
      const res = await fetch('/api/browser-accounts');
      const data = await res.json();
      window.__activeAccountId = data.activeAccountId;
      const st = window.__threadsLoginStatus || {};
      const el = document.getElementById('browserAccountList');
      el.innerHTML = data.accounts.map((a) => {
        const login = st[a.id];
        const isActive = a.id === data.activeAccountId;
        const dotClass = login === undefined ? 'off' : login.loggedIn ? '' : 'warn';
        const statusText = login === undefined ? '아직 확인 안 함' : login.loggedIn ? '로그인됨 · ' + new Date(login.checkedAt).toLocaleString('ko-KR') : '로그인 안 됨';
        return (
          '<div class="row" style="border:1px solid ' + (isActive ? '#6d28d9' : '#e5e5e5') + ';border-radius:8px;padding:10px;margin-bottom:6px">' +
          '<span class="dot ' + dotClass + '"></span>' +
          '<span style="font-weight:800;min-width:90px">' + a.label + (isActive ? ' (켜짐)' : '') + '</span>' +
          '<span style="font-size:11px;color:#888;flex:1">' + statusText + '</span>' +
          (isActive ? '' : '<button class="secondary" data-acct-activate="' + a.id + '">이 계정 켜기</button>') +
          '<button class="secondary" data-acct-check="' + a.id + '">로그인 확인</button>' +
          (a.id === 'default' ? '' : '<button class="secondary" data-acct-remove="' + a.id + '">삭제</button>') +
          '</div>'
        );
      }).join('');
    }
    document.getElementById('addAccountBtn').addEventListener('click', async () => {
      const label = document.getElementById('newAccountLabel').value.trim();
      if (!label) { document.getElementById('acctMsg').textContent = '❌ 계정 이름을 입력하세요.'; return; }
      await fetch('/api/action/browser-account-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      document.getElementById('newAccountLabel').value = '';
      document.getElementById('acctMsg').textContent = '✅ 계정이 추가됐어요. "이 계정 켜기" 후 원본 수집을 돌리면 그 크롬 창에서 로그인하면 돼요.';
      await loadBrowserAccounts();
    });
    document.addEventListener('click', async (e) => {
      const actBtn = e.target.closest('[data-acct-activate]');
      if (actBtn) {
        await fetch('/api/action/browser-account-activate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: actBtn.dataset.acctActivate }),
        });
        await loadBrowserAccounts();
        return;
      }
      const chkBtn = e.target.closest('[data-acct-check]');
      if (chkBtn) {
        chkBtn.disabled = true;
        document.getElementById('acctMsg').textContent = '확인 중... (크롬 창이 잠깐 떴다 닫혀요)';
        try {
          const res = await fetch('/api/action/check-account', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: chkBtn.dataset.acctCheck }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '실패');
          document.getElementById('acctMsg').textContent = '✅ 확인 작업이 등록됐어요 — 몇 초 안에 상태가 갱신돼요.';
        } catch (err) {
          document.getElementById('acctMsg').textContent = '❌ ' + err.message;
        } finally {
          chkBtn.disabled = false;
        }
        return;
      }
      const rmBtn = e.target.closest('[data-acct-remove]');
      if (rmBtn) {
        if (!confirm('이 계정을 삭제할까요? (로그인 세션도 같이 사라져요)')) return;
        await fetch('/api/action/browser-account-remove', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rmBtn.dataset.acctRemove }),
        });
        await loadBrowserAccounts();
      }
    });
    document.querySelector('.navitem[data-tab="account"]').addEventListener('click', loadBrowserAccounts);
    loadBrowserAccounts();

    // ---- 오늘 활동 / 계정별 현황 ----
    async function loadActivitySummary() {
      const res = await fetch('/api/activity-summary');
      const data = await res.json();
      renderTodayActivity(data.accounts);
      renderAccountStatus(data.accounts);
    }
    function renderTodayActivity(accts) {
      const active = accts.filter((a) => a.dailyToday + a.shoppingToday > 0);
      const el = document.getElementById('todayActivityArea');
      if (!active.length) { el.innerHTML = '<div class="sub" style="margin:0">활성 계정이 없습니다.</div>'; return; }
      el.innerHTML = active.map((a) => (
        '<div class="row" style="justify-content:space-between">' +
        '<span><b>' + a.label + '</b></span>' +
        '<span style="color:#888">✍️ ' + a.dailyToday + '개 · 🛍️ ' + a.shoppingToday + '개 · ❤️ 0개</span>' +
        '</div>'
      )).join('');
    }
    function renderAccountStatus(accts) {
      const el = document.getElementById('accountStatusArea');
      if (!accts.length) { el.innerHTML = '<div class="sub" style="margin:0">계정이 없습니다.</div>'; return; }
      el.innerHTML = accts.map((a) => (
        '<div style="padding:8px 0;border-top:1px solid #eee">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:2px">' +
        '<b>' + a.label + '</b>' +
        '<span style="color:#888;font-size:12px">📷 ' + a.dailyToday + '개 · 🛒 ' + a.shoppingToday + '개</span>' +
        '</div>' +
        '<div class="sub" style="margin:0">' +
        (a.shoppingOpen ? '✅ 쇼핑 열림' : '🔒 쇼핑 준비 중(예열 ' + a.ageDays + '/7일)') +
        ' · 마지막 ' + (a.lastPostedAt ? new Date(a.lastPostedAt).toLocaleString('ko-KR') : '없음') +
        '</div></div>'
      )).join('');
    }
    document.getElementById('todayActivityRefreshBtn').addEventListener('click', loadActivitySummary);
    document.getElementById('accountStatusRefreshBtn').addEventListener('click', loadActivitySummary);
    loadActivitySummary();

    document.getElementById('shutdownBtn').addEventListener('click', async () => {
      if (!confirm('워커를 종료할까요? 콘솔 창도 같이 닫혀요.')) return;
      setMsg('종료 중...');
      try {
        await fetch('/api/action/shutdown', { method: 'POST' });
        setMsg('✅ 워커가 종료됐어요. 이 페이지는 이제 안 써도 돼요.');
      } catch {
        setMsg('✅ 워커가 종료됐어요.');
      }
    });

    document.getElementById('recheckBtn').addEventListener('click', async () => {
      const btn = document.getElementById('recheckBtn');
      btn.disabled = true;
      setMsg('재연결 확인 중...');
      try {
        const res = await fetch('/api/action/recheck', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '실패');
        setMsg('✅ 재연결 확인 완료 (클로드 계정: ' + (data.claudeEmail || '확인 안 됨') + ')');
      } catch (err) {
        setMsg('❌ ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('copyBtn').addEventListener('click', async () => {
      const text = lastLogs.map(l => '[' + l.time + '] ' + l.text).join('\\n');
      try {
        await navigator.clipboard.writeText(text);
        setMsg('✅ 로그를 클립보드에 복사했어요.');
      } catch {
        setMsg('❌ 복사 실패 — 브라우저 권한을 확인하세요.');
      }
    });
  </script>
</body>
</html>`;

function startDashboard() {
  hookConsole();
  const server = http.createServer((req, res) => {
    if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status, logs }));
      return;
    }
    if (req.url === '/api/action/collect' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const job = await handleCollectAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, job }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/post-now' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const result = await handleManualPostAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/custom-collect' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const job = await handleCustomCollectAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, job }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/custom-write' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const drafts = await handleCustomWriteAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, drafts }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/paste' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const draft = await handlePasteAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, draft }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/save-custom-keywords' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const type = parsed?.type === 'shopping' ? 'shopping' : 'daily';
          const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords.filter((k) => typeof k === 'string' && k.trim()) : [];
          const data = loadCustomKeywords();
          data[type] = keywords;
          saveCustomKeywords(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/activity-summary') {
      const accData = accounts.load();
      const summary = postLog.summaryByAccount();
      const now = Date.now();
      const result = accData.accounts.map((a) => {
        const s = summary[a.id] || { dailyToday: 0, shoppingToday: 0, lastPostedAt: null, firstPostedAt: null };
        const ageDays = s.firstPostedAt ? Math.floor((now - new Date(s.firstPostedAt).getTime()) / 86400000) : 0;
        return {
          id: a.id,
          label: a.label,
          dailyToday: s.dailyToday,
          shoppingToday: s.shoppingToday,
          lastPostedAt: s.lastPostedAt,
          ageDays,
          shoppingOpen: ageDays >= 7,
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accounts: result }));
      return;
    }
    if (req.url === '/api/custom-keywords') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadCustomKeywords()));
      return;
    }
    if (req.url === '/api/action/add-keyword-group' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const type = parsed?.type === 'shopping' ? 'shopping' : 'daily';
          const name = (parsed?.name || '').trim();
          const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords.filter((k) => typeof k === 'string' && k.trim()) : [];
          if (!name || !keywords.length) throw new Error('그룹 이름과 검색어가 필요합니다.');
          const data = loadCustomKeywords();
          const groupsKey = type + 'Groups';
          const group = { id: 'kwg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, keywords, enabled: true };
          data[groupsKey] = [...(data[groupsKey] || []), group];
          saveCustomKeywords(data);
          pushLog(`[대시보드] 키워드 그룹 "${name}" 추가(${type === 'shopping' ? '쇼핑글' : '일상글'}, ${keywords.length}개)`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/toggle-keyword-group' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const type = parsed?.type === 'shopping' ? 'shopping' : 'daily';
          const groupsKey = type + 'Groups';
          const data = loadCustomKeywords();
          data[groupsKey] = (data[groupsKey] || []).map((g) => (g.id === parsed?.groupId ? { ...g, enabled: !g.enabled } : g));
          saveCustomKeywords(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/delete-keyword-group' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const type = parsed?.type === 'shopping' ? 'shopping' : 'daily';
          const groupsKey = type + 'Groups';
          const data = loadCustomKeywords();
          data[groupsKey] = (data[groupsKey] || []).filter((g) => g.id !== parsed?.groupId);
          saveCustomKeywords(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/queue') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: loadQueue() }));
      return;
    }
    if (req.url === '/api/materials') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadMaterials()));
      return;
    }
    if (req.url === '/api/action/materials-remove' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          removeMaterial(parsed.type, parsed.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/toss') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tossLinks.load()));
      return;
    }
    if (req.url === '/api/persona') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(persona.load()));
      return;
    }
    if (req.url === '/api/channel-clone') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(channelClone.load()));
      return;
    }
    if (req.url === '/api/action/clone-learn' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const data = await handleLearnAccountsAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/clone-write' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const drafts = await handleChannelWriteAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, drafts }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/clone-reset' && req.method === 'POST') {
      const data = channelClone.reset();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...data }));
      return;
    }
    if (req.url === '/api/action/schedule-draft' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const draft = scheduleDraft(parsed.id, parsed.scheduledAt || null);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, draft }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/persona-analyze' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const result = await handlePersonaAnalyzeAction(JSON.parse(body || '{}'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/persona-reset' && req.method === 'POST') {
      const data = persona.reset();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...data }));
      return;
    }
    if (req.url.startsWith('/api/key-status')) {
      const provider = new URL(req.url, 'http://x').searchParams.get('provider') || 'COUPANG';
      handleKeyStatus(provider)
        .then((data) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    if (req.url.startsWith('/api/action/toss-') && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          let data;
          if (req.url === '/api/action/toss-set-key') data = tossLinks.setApiKey(parsed.apiKey);
          else if (req.url === '/api/action/toss-add-link') data = tossLinks.addLink(parsed.keyword, parsed.url);
          else if (req.url === '/api/action/toss-remove-link') data = tossLinks.removeLink(parsed.id);
          else if (req.url === '/api/action/toss-add-submission') data = tossLinks.addSubmission(parsed.postUrl, parsed.memo);
          else if (req.url === '/api/action/toss-toggle-submission') data = tossLinks.toggleSubmission(parsed.id);
          else if (req.url === '/api/action/toss-remove-submission') data = tossLinks.removeSubmission(parsed.id);
          else throw new Error('알 수 없는 요청');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/queue-publish' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await handleQueuePublishAction(parsed.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/queue-remove' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          removeDraft(parsed.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/queue-clear-all' && req.method === 'POST') {
      handleQueueClearAllAction()
        .then((data) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    if (req.url === '/api/action/queue-rewrite-all' && req.method === 'POST') {
      handleQueueRewriteAllAction()
        .then((drafts) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, drafts }));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    if (req.url === '/api/browser-accounts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(accounts.load()));
      return;
    }
    if (req.url === '/api/action/browser-account-add' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const data = accounts.addAccount(parsed.label);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/browser-account-remove' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const data = accounts.removeAccount(parsed.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/browser-account-activate' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const data = accounts.setActive(parsed.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...data }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/threads-accounts-list') {
      handleListThreadsAccounts()
        .then((data) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    if (req.url === '/api/action/set-default-account' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          savePrefs({ defaultThreadsAccountId: parsed.id || null });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.url === '/api/action/check-account' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        handleCheckAccountAction(parsed.accountId)
          .then((job) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, job }));
          })
          .catch((err) => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
      });
      return;
    }
    if (req.url === '/api/action/shutdown' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      console.log('[대시보드] 종료 버튼으로 워커를 끕니다.');
      // 응답을 먼저 보내고, 크롬(퍼펫티어) 창을 닫은 뒤, 워커 프로세스를 종료한다.
      // 크롬은 워커와 별개의 OS 프로세스라 process.exit()만으로는 안 닫힌다.
      setTimeout(async () => {
        await closeBrowser();
        process.exit(0);
      }, 300);
      return;
    }
    if (req.url === '/api/action/recheck' && req.method === 'POST') {
      handleRecheckAction()
        .then((claudeEmail) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, claudeEmail }));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE());
  });
  server.listen(PORT, () => {
    console.log(`대시보드: http://localhost:${PORT}`);
  });
  return { setStatus };
}

module.exports = { startDashboard, setStatus, pushLog, handleManualPostAction, setThreadsLoginStatus };
