const input = document.getElementById('key');
const status = document.getElementById('status');
const saveBtn = document.getElementById('save');

chrome.storage.local.get('extensionKey', ({ extensionKey }) => {
  if (extensionKey) {
    input.value = extensionKey;
    status.textContent = '저장된 키가 있어요. Threads 글을 드래그 → 우클릭해보세요.';
  }
});

saveBtn.addEventListener('click', () => {
  const value = input.value.trim();
  if (!value) {
    status.style.color = '#dc2626';
    status.textContent = '키를 먼저 붙여넣어주세요.';
    return;
  }
  chrome.storage.local.set({ extensionKey: value }, () => {
    status.style.color = '#16a34a';
    status.textContent = '키가 저장됐어요. 이제 바로 사용할 수 있어요.';
  });
});
