const readline = require('readline');
const { saveConfig } = require('./config');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('유쓰레드 웹 API 주소 (예: https://u-thread.vercel.app): ', (apiBase) => {
  rl.question('페어링 토큰 (웹 대시보드 "로컬 워커 연결"에서 발급): ', (token) => {
    saveConfig({ apiBase: apiBase.trim().replace(/\/$/, ''), token: token.trim() });
    console.log('저장 완료. node index.js 로 워커를 시작하세요.');
    rl.close();
  });
});
