'use client';

export default function ThreadsManagePage() {
  // TODO: Meta for Developers에서 앱 등록 후, 아래 handleConnect가 실제 Threads OAuth authorize URL로 리다이렉트하도록 교체할 것.
  // scope 참고(원본 그대로): threads_basic,threads_content_publish,threads_keyword_search,threads_manage_insights,
  // threads_manage_mentions,threads_manage_replies,threads_profile_discovery,threads_read_replies,threads_delete,threads_share_to_instagram
  function handleConnect() {
    alert('Threads 연동은 Meta Developer 앱 등록 후 활성화됩니다. (Phase 4)');
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">내 쓰레드 관리</h1>
      </div>
      <div className="border border-border p-10 text-center max-w-lg">
        <p className="text-sm text-neutral-600 mb-6">
          Meta Threads 계정을 연동하면 이 곳에서 직접 게시물을 발행하고 관리할 수 있어요.
        </p>
        <button onClick={handleConnect} className="bg-black text-white text-[11px] font-black px-6 py-3">
          @ THREADS 계정 연동하기
        </button>
      </div>
    </div>
  );
}
