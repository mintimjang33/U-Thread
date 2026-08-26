const { loadConfig } = require('./config');
const { generateViaClaude, getClaudeAccountEmail, loadAiSource } = require('./generate');
const { collectBenchmark, checkLoginStatus } = require('./collectBenchmark');
const { startDashboard, setStatus, handleManualPostAction, setThreadsLoginStatus } = require('./dashboard');
const { addMaterials } = require('./materials');
const { dueDrafts, removeDraft } = require('./draftQueue');

const POLL_INTERVAL_MS = 8000;
let claudeEmail = null;

async function apiFetch(config, path, options = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}`, ...(options.headers || {}) };
  if (claudeEmail) headers['X-Claude-Account'] = claudeEmail;
  const res = await fetch(config.apiBase + path, { ...options, headers });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

async function claimAndRun(config, job) {
  console.log(`[job ${job.id}] ${job.type} 시작`);
  setStatus({ currentJob: `${job.type} (${job.id.slice(0, 8)})` });
  await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processing' }) });

  try {
    let output;
    if (job.type === 'generate') {
      const content = await generateViaClaude(job.input.prompt);
      output = { content };
    } else if (job.type === 'collect_benchmark') {
      output = await collectBenchmark(job.input);
      // "직접 소싱(커스텀)" 탭에서 건 수집은 이 탭 전용 로컬 글감 창고에도 저장한다
      // (다른 탭 글감 창고와 안 섞이게 분리 보관).
      if (job.input.saveMaterialsAs && output.items?.length) {
        addMaterials(job.input.saveMaterialsAs, output.items);
        console.log(`[글감] "${job.input.saveMaterialsAs}" 창고에 ${output.items.length}개 저장 시도(중복 제외)`);
      }
    } else if (job.type === 'check_threads_login') {
      const accountId = job.input?.accountId;
      const loggedIn = await checkLoginStatus(accountId);
      setThreadsLoginStatus(accountId, loggedIn);
      output = { loggedIn };
    } else {
      throw new Error(`알 수 없는 작업 타입: ${job.type}`);
    }
    await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done', output }) });
    console.log(`[job ${job.id}] 완료`);
  } catch (err) {
    console.error(`[job ${job.id}] 실패:`, err.message);
    await apiFetch(config, `/api/worker/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error: err.message }) });
  } finally {
    setStatus({ currentJob: null });
  }
}

// "예약" 탭에서 시각을 붙인 검수 큐 항목을 확인해서, 그 시각이 지났으면 자동으로 게시한다.
// 워커가 켜져 있는 동안만 동작(꺼져 있으면 안 올라가고, 다시 켜면 밀린 것부터 처리됨).
async function runScheduledPublish() {
  const due = dueDrafts();
  for (const draft of due) {
    console.log(`[예약] "${draft.content.slice(0, 30)}..." 게시 시각 도달 — 게시 시도`);
    try {
      const result = await handleManualPostAction({ text: draft.content, type: draft.type });
      removeDraft(draft.id);
      console.log(`[예약] ✅ 게시 완료 (threadsPostId: ${result.threadsPostId})`);
    } catch (err) {
      console.error(`[예약] 게시 실패(다음 루프에서 재시도):`, err.message);
    }
  }
}

async function pollLoop() {
  startDashboard();

  const config = loadConfig();
  if (!config) {
    console.error('페어링 설정이 없습니다. 먼저 node pair.js 를 실행하세요.');
    setStatus({ state: 'error' });
    return;
  }

  setStatus({ apiBase: config.apiBase });
  claudeEmail = await getClaudeAccountEmail();
  await loadAiSource();
  setStatus({ state: 'running', claudeEmail });
  console.log(`유쓰레드 로컬 워커 시작 — ${config.apiBase}${claudeEmail ? ` (클로드 계정: ${claudeEmail})` : ' (클로드 계정 확인 안 됨 — claude auth login 필요)'}`);
  while (true) {
    try {
      const { jobs } = await apiFetch(config, '/api/worker/jobs');
      for (const job of jobs) {
        await claimAndRun(config, job);
      }
      await runScheduledPublish();
    } catch (err) {
      console.error('폴링 오류:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

pollLoop();
