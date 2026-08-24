const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const PROFILE_DIR = path.join(os.homedir(), '.u-thread-worker', 'chrome-profile');

// ⚠️ 실제 로그인된 쓰레드 세션으로 검증되지 않음. 최초 실행은 반드시 headless:false로 눈으로 확인할 것.
// 쓰레드 DOM 구조가 바뀌면 여기 셀렉터만 고치면 된다.
const SELECTORS = {
  postContainer: 'div[data-pressable-container="true"]',
  postText: 'span[dir="auto"]',
  likeButton: 'svg[aria-label="좋아요"]',
};

const MIN_LIKES = 200;
const MIN_REPLIES = 50;
const MAX_LIKES_PER_SESSION = 5; // 봇 탐지 회피 — 짧은 시간에 너무 많이 누르지 않는다.

function findChrome() {
  const fs = require('fs');
  return CHROME_PATHS.find((p) => fs.existsSync(p));
}

async function collectBenchmark(input) {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('크롬을 찾을 수 없습니다.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  try {
    const page = await browser.newPage();
    const keyword = input.keyword || '';
    const url = keyword ? `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default` : 'https://www.threads.net/';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    const loggedIn = await page.evaluate(() => !document.body.innerText.includes('로그인'));
    if (!loggedIn) {
      throw new Error('threads.net에 로그인이 안 돼 있습니다. 워커가 띄운 크롬 창에서 먼저 로그인해주세요 (이후엔 프로필에 저장되어 자동 유지됨).');
    }

    const items = [];
    let likesUsed = 0;

    for (let scroll = 0; scroll < (input.maxScrolls || 5); scroll++) {
      const candidates = await page.evaluate(
        (sel) => {
          const posts = Array.from(document.querySelectorAll(sel.postContainer));
          return posts.map((el) => ({
            text: el.innerText || '',
            hasMedia: !!el.querySelector('img, video'),
          }));
        },
        SELECTORS
      );

      for (const c of candidates) {
        if (c.hasMedia) continue; // 일단 텍스트 전용 글만 (원본 수집 1차 범위)
        if (items.find((it) => it.content === c.text)) continue;
        items.push({ content: c.text, source: `threads.net 검색:${keyword}` });
      }

      // 사람처럼 보이게 세션당 최대 5개까지만, 느리게 좋아요
      if (likesUsed < MAX_LIKES_PER_SESSION) {
        const likeButtons = await page.$$(SELECTORS.likeButton);
        if (likeButtons[0]) {
          try {
            await likeButtons[0].click();
            likesUsed++;
            await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
          } catch {
            // 좋아요 실패는 치명적이지 않으므로 무시하고 계속 진행
          }
        }
      }

      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
    }

    return { items, likesUsed, note: '좋아요/댓글 수 필터는 아직 미적용 — DOM에서 수치 파싱 검증 필요' };
  } finally {
    await browser.close();
  }
}

module.exports = { collectBenchmark, MIN_LIKES, MIN_REPLIES };
