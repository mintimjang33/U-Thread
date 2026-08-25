const API_URL = 'https://u-thread.vercel.app/api/extension/benchmark';
const MENU_ID = 'save-to-uthread';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '유쓰레드 벤치마킹에 저장',
    contexts: ['selection'],
  });
});

function flashBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const { extensionKey } = await chrome.storage.local.get('extensionKey');
  if (!extensionKey) {
    flashBadge('!', '#dc2626');
    chrome.action.setTitle({ title: '유쓰레드 익스텐션 키를 먼저 등록해주세요 (아이콘 클릭)' });
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionKey}`,
      },
      body: JSON.stringify({
        source: tab?.url || '',
        content: info.selectionText,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    flashBadge('저장', '#16a34a');
  } catch (err) {
    flashBadge('실패', '#dc2626');
    console.error('유쓰레드 벤치마킹 저장 실패', err);
  }
});
