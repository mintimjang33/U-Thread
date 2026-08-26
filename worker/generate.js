const spawn = require('cross-spawn');
const { loadConfig } = require('./config');

// 로컬에 설치된 Claude Code CLI를 헤드리스로 호출한다 — API 종량과금 없이 클로드 구독 안에서 처리됨.
// cross-spawn을 쓰는 이유: Windows에서 claude(.cmd)를 execFile로 직접 부르면 ENOENT가 나고,
// shell:true로 우회하면 프롬프트 내용에 셸 특수문자가 있을 때 인젝션 위험이 생긴다.
//
// 프롬프트는 커맨드라인 인자(-p "...")가 아니라 stdin으로 넘긴다. claude가 Windows에서
// .cmd 셸 스크립트라 cross-spawn이 내부적으로 cmd.exe를 거쳐 실행하는데, cmd.exe는 인자 안의
// 줄바꿈을 명령 구분자로 취급해서 여러 줄 프롬프트가 첫 줄만 남고 통째로 잘린다(실측 확인:
// "line one\nline two\nline three"를 인자로 넘기면 AI는 "line one"만 받음). stdin에는
// 이런 파싱이 적용되지 않아 문제 자체가 사라진다.
function runClaude(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { timeout: 120000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `claude exited with code ${code}`));
      resolve(stdout.trim());
    });
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

function generateViaClaude(prompt) {
  return runClaude(['-p', '--output-format', 'text'], prompt);
}

async function getClaudeStatus() {
  try {
    const out = await runClaude(['auth', 'status']);
    return JSON.parse(out);
  } catch {
    return null;
  }
}

async function getClaudeAccountEmail() {
  const status = await getClaudeStatus();
  return status?.email || null;
}

// 유쓰레드 웹 대시보드의 "AI 바꾸기" 설정(ai_source: 'worker'=클로드 구독 / 'gemini'=제미나이 API 과금)을
// 이 워커도 그대로 따른다 — 앱을 재시작할 때마다 한 번 읽어와서 메모리에 캐시해둔다.
let cachedAiSource = 'worker';

async function loadAiSource() {
  const config = loadConfig();
  if (!config) return cachedAiSource;
  try {
    const res = await fetch(config.apiBase + '/api/editor-defaults', {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return cachedAiSource;
    const data = await res.json();
    cachedAiSource = data.defaults?.ai_source === 'gemini' ? 'gemini' : 'worker';
    return cachedAiSource;
  } catch {
    return cachedAiSource;
  }
}

async function setAiSource(source) {
  const value = source === 'gemini' ? 'gemini' : 'worker';
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const res = await fetch(config.apiBase + '/api/editor-defaults', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ ai_source: value }),
  });
  if (!res.ok) throw new Error(`설정 저장 실패 (${res.status})`);
  cachedAiSource = value;
  return value;
}

async function generateViaGemini(prompt) {
  const config = loadConfig();
  if (!config) throw new Error('페어링 설정이 없습니다.');
  const res = await fetch(config.apiBase + '/api/worker/generate-gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `제미나이 생성 실패 (${res.status})`);
  return (data.content || '').trim();
}

// 글 생성이 필요한 모든 곳(바로쓰기, 다시쓰기, 페르소나 분석 등)은 클로드를 직접 부르는 대신
// 이 함수를 거친다 — ai_source 설정에 따라 클로드/제미나이 중 실제로 켜져있는 쪽으로 나간다.
async function generateContent(prompt) {
  return cachedAiSource === 'gemini' ? generateViaGemini(prompt) : generateViaClaude(prompt);
}

module.exports = {
  generateViaClaude,
  getClaudeAccountEmail,
  getClaudeStatus,
  loadAiSource,
  setAiSource,
  generateViaGemini,
  generateContent,
  getCachedAiSource: () => cachedAiSource,
};
