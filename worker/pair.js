const readline = require('readline');
const { saveConfig } = require('./config');
const { getClaudeStatus } = require('./generate');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('유쓰레드 웹 API 주소 (예: https://u-thread.vercel.app): ', (apiBase) => {
  rl.question('페어링 토큰 (웹 대시보드 "로컬 워커 연결"에서 발급): ', async (token) => {
    saveConfig({ apiBase: apiBase.trim().replace(/\/$/, ''), token: token.trim() });
    console.log('저장 완료.');

    console.log('\n클로드 로그인 상태 확인 중...');
    const status = await getClaudeStatus();
    if (status?.loggedIn) {
      console.log(`✅ 연결된 클로드 계정: ${status.email} (${status.subscriptionType})`);
      try {
        await fetch(apiBase.trim().replace(/\/$/, '') + '/api/worker/jobs', {
          headers: { Authorization: `Bearer ${token.trim()}`, 'X-Claude-Account': status.email },
        });
        console.log('✅ 유쓰레드 대시보드에도 바로 반영했어요 — /dashboard/ai-worker 에서 확인하세요.');
      } catch (e) {
        console.log('⚠️ 대시보드 반영은 실패했지만 설정 저장은 됐어요:', e.message);
      }
    } else {
      console.log('❌ 클로드 CLI가 로그인 안 돼있어요. 0_claude_login.bat 먼저 실행하세요.');
    }

    console.log('\nnode index.js 로 워커를 시작하세요.');
    rl.close();
  });
});
