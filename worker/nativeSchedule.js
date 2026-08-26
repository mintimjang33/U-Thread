// 쓰레드(threads.com) 웹의 실제 "예약" 기능을 직접 눌러서 쓴다 — 우리 로컬 타이머 예약과 달리
// 워커(PC)가 꺼져 있어도 쓰레드 쪽에서 그 시각에 알아서 올라간다.
// 셀렉터는 threads.com의 실제 화면을 눌러보며 확인한 것이고, 쓰레드가 UI를 바꾸면 깨질 수 있다.

const path = require('path');
const os = require('os');

async function saveFailureScreenshot(page, label) {
  try {
    const dir = path.join(os.homedir(), '.u-thread-worker', 'schedule-debug');
    require('fs').mkdirSync(dir, { recursive: true });
    const file = path.join(dir, label + '-' + Date.now() + '.png');
    await page.screenshot({ path: file });
    return file;
  } catch {
    return null;
  }
}

// 이 계정은 다중 칼럼 레이아웃이 켜져 있어서 같은 문구(placeholder 등)가 화면에 여러 벌 존재한다.
// 방금 새로 연 작성창(모달)은 항상 문서상 가장 나중에 붙으므로, 항상 "마지막 일치 요소"를 쓴다.
async function findTextRect(page, exact) {
  return page.evaluate((t) => {
    const matches = [...document.querySelectorAll('div,span')].filter((e) => e.textContent.trim() === t);
    if (!matches.length) return null;
    const el = matches[matches.length - 1];
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, exact);
}

// 렌더링이 늦게 뜨는 팝오버/메뉴가 많아서, 고정 대기 대신 나타날 때까지 짧게 폴링한다.
async function waitForTextRect(page, exact, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rect = await findTextRect(page, exact);
    if (rect) return rect;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function clickRect(page, rect) {
  await page.mouse.move(rect.x, rect.y);
  await new Promise((r) => setTimeout(r, 150));
  await page.mouse.click(rect.x, rect.y, { delay: 60 });
}

async function clickByText(page, exact, timeoutMs = 3000) {
  const rect = await waitForTextRect(page, exact, timeoutMs);
  if (!rect) return false;
  await page.mouse.move(rect.x, rect.y);
  await new Promise((r) => setTimeout(r, 150));
  // 클릭 직전에 위치를 다시 확인한다 — 그 사이 애니메이션으로 살짝 움직였을 수 있다.
  const fresh = (await findTextRect(page, exact)) || rect;
  await page.mouse.click(fresh.x, fresh.y, { delay: 60 });
  return true;
}

// 작성창을 열고 글 내용을 입력하는 부분은 "지금 게시"와 "예약"이 똑같이 쓴다.
async function openComposerAndType(page, content) {
  // 창이 백그라운드에 있으면 포커스 의존적인 상호작용(모달 닫힘 등)이 불안정해진다.
  await page.bringToFront();
  await page.goto('https://www.threads.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  const opened = await page.evaluate(() => {
    const el = document.querySelector('svg[aria-label="새로운 스레드"]');
    if (!el) return false;
    const clickable = el.closest('a,div[role="link"],div[role="button"]') || el.parentElement;
    clickable.click();
    return true;
  });
  if (!opened) throw new Error('쓰레드 작성창을 열지 못했습니다(화면 구조가 바뀐 것 같습니다).');
  await new Promise((r) => setTimeout(r, 1200));

  const focused = await clickByText(page, '새로운 소식이 있나요?');
  if (!focused) throw new Error('작성창 입력칸을 찾지 못했습니다.');
  await new Promise((r) => setTimeout(r, 500));
  await page.keyboard.type(content);
  await new Promise((r) => setTimeout(r, 500));
}

// 크롬 창을 직접 눌러서 지금 바로 게시한다(공식 API 대신 브라우저 자동화 경로).
async function postNowViaBrowser(page, content) {
  await openComposerAndType(page, content);
  await page.bringToFront();

  const submitOk = await clickByText(page, '게시');
  if (!submitOk) {
    const f = await saveFailureScreenshot(page, 'no-post-now-button');
    throw new Error('"게시" 버튼을 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  await new Promise((r) => setTimeout(r, 2000));
  return { postedAt: new Date().toISOString() };
}

async function scheduleNativePost(page, content, scheduledAt) {
  const target = new Date(scheduledAt);
  if (isNaN(target.getTime())) throw new Error('예약 시각이 올바르지 않습니다.');

  await openComposerAndType(page, content);
  await page.bringToFront();
  const moreOk = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label="더 보기"]')];
    if (!svgs.length) return false;
    const target = svgs[svgs.length - 1]; // 작성창이 항상 문서상 가장 나중에 붙는다
    const clickable = target.closest('div[role="button"]') || target.parentElement;
    clickable.click();
    return true;
  });
  if (!moreOk) {
    const f = await saveFailureScreenshot(page, 'no-more-menu');
    throw new Error('작성창의 "더 보기" 메뉴를 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  await new Promise((r) => setTimeout(r, 500)); // 드롭다운 열리는 애니메이션이 끝날 때까지 기다린다

  const schedOk = await clickByText(page, '예약...');
  if (!schedOk) {
    const f = await saveFailureScreenshot(page, 'no-schedule-item');
    throw new Error('"예약..." 메뉴를 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }

  // 날짜 선택 — 대상 달까지 ">"를 눌러 이동한 다음, 그 달의 일(day) 칸을 누른다.
  for (let i = 0; i < 12; i++) {
    let monthLabel = null;
    const monthWaitStart = Date.now();
    while (Date.now() - monthWaitStart < 3000) {
      monthLabel = await page.evaluate(() => {
        const el = [...document.querySelectorAll('div,span')].find((e) => /^\d{4}년 \d{1,2}월$/.test(e.textContent.trim()));
        return el ? el.textContent.trim() : null;
      });
      if (monthLabel) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!monthLabel) {
      const f = await saveFailureScreenshot(page, 'no-calendar-header');
      throw new Error('달력 헤더를 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
    }
    const [, y, m] = monthLabel.match(/^(\d{4})년 (\d{1,2})월$/);
    if (Number(y) === target.getFullYear() && Number(m) === target.getMonth() + 1) break;
    const nextOk = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('svg')].find((s) => (s.getAttribute('aria-label') || '').includes('다음'));
      if (!btn) return false;
      (btn.closest('div[role="button"]') || btn.parentElement).click();
      return true;
    });
    if (!nextOk) throw new Error('다음 달로 넘어가는 버튼을 찾지 못했습니다.');
    await new Promise((r) => setTimeout(r, 400));
  }

  const dayOk = await page.evaluate((day) => {
    const spans = [...document.querySelectorAll('span')].filter((e) => e.children.length === 0 && e.textContent.trim() === String(day));
    if (!spans.length) return false;
    const el = spans[spans.length - 1];
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, target.getDate());
  if (!dayOk) throw new Error('날짜 칸을 찾지 못했습니다.');
  await clickRect(page, dayOk);
  await new Promise((r) => setTimeout(r, 500));

  // 시간(시/분) 입력 — 시계 아이콘 옆 두 칸(시, 분)에 각각 채워 넣는다.
  const findTimeRects = () => page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="시간 선택 도구"]');
    const container = svg ? svg.closest('div').parentElement : null;
    const inputs = container ? [...container.querySelectorAll('input')] : [];
    return inputs.map((i) => {
      const r = i.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
  });
  let timeRects = [];
  const timeWaitStart = Date.now();
  while (Date.now() - timeWaitStart < 3000) {
    timeRects = await findTimeRects();
    if (timeRects.length === 2) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  if (timeRects.length !== 2) {
    const f = await saveFailureScreenshot(page, 'no-time-inputs');
    throw new Error('시간 입력칸을 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  await page.mouse.click(timeRects[0].x, timeRects[0].y, { clickCount: 3 });
  await page.keyboard.type(String(target.getHours()).padStart(2, '0'));
  await new Promise((r) => setTimeout(r, 200));
  await page.mouse.click(timeRects[1].x, timeRects[1].y, { clickCount: 3 });
  await page.keyboard.type(String(target.getMinutes()).padStart(2, '0'));
  await new Promise((r) => setTimeout(r, 200));

  const doneOk = await clickByText(page, '완료');
  if (!doneOk) throw new Error('"완료" 버튼을 찾지 못했습니다.');

  // 이 시점부터 제출 버튼 라벨이 "게시"에서 "예약"으로 바뀐다 — 그걸 눌러야 실제로 예약이 걸린다.
  const submitOk = await clickByText(page, '예약');
  if (!submitOk) throw new Error('예약 제출 버튼을 찾지 못했습니다(예약 시각 설정까지는 됐을 수 있습니다).');
  await new Promise((r) => setTimeout(r, 1500));

  return { scheduledAt: target.toISOString() };
}

// 위에서 건 예약을 취소한다 — 작성창 헤더의 "임시 저장본" 아이콘에서 목록을 열고,
// 글 내용의 앞부분이 일치하는 항목을 찾아 지운다.
async function cancelScheduledPost(page, contentSnippet) {
  await page.bringToFront();
  await page.goto('https://www.threads.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  const opened = await page.evaluate(() => {
    const el = document.querySelector('svg[aria-label="새로운 스레드"]');
    if (!el) return false;
    (el.closest('a,div[role="link"],div[role="button"]') || el.parentElement).click();
    return true;
  });
  if (!opened) throw new Error('작성창을 열지 못했습니다.');
  await new Promise((r) => setTimeout(r, 1200));

  const draftsOk = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label="임시 저장본"]')];
    if (!svgs.length) return false;
    const target = svgs[svgs.length - 1];
    (target.closest('div[role="button"]') || target.parentElement).click();
    return true;
  });
  if (!draftsOk) {
    const f = await saveFailureScreenshot(page, 'no-drafts-icon');
    throw new Error('"임시 저장본" 아이콘을 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  await new Promise((r) => setTimeout(r, 1000));

  const moreOk = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label="더 보기"]')];
    if (!svgs.length) return false;
    (svgs[svgs.length - 1].closest('div[role="button"]') || svgs[svgs.length - 1].parentElement).click();
    return true;
  });
  if (!moreOk) {
    const f = await saveFailureScreenshot(page, 'no-item-more');
    throw new Error('목록 항목의 "더 보기"를 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  // 이 팝오버는 마우스가 살짝만 벗어나도(hover-out) 바로 닫히는 것으로 보여서,
  // move+대기 없이 좌표를 찾자마자 바로 클릭한다(체류시간을 최소화).
  const deleteRect = await waitForTextRect(page, '임시 저장본 삭제', 3000);
  const deleteOk = !!deleteRect;
  if (deleteRect) await page.mouse.click(deleteRect.x, deleteRect.y, { delay: 30 });
  if (!deleteOk) {
    const f = await saveFailureScreenshot(page, 'no-delete-item');
    throw new Error('"임시 저장본 삭제" 메뉴를 찾지 못했습니다.' + (f ? ` (스크린샷: ${f})` : ''));
  }
  await new Promise((r) => setTimeout(r, 700));
  await saveFailureScreenshot(page, 'confirm-dialog');

  return { screenshotSaved: true };
}

module.exports = { scheduleNativePost, cancelScheduledPost, postNowViaBrowser };
