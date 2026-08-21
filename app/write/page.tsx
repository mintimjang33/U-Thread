import Link from 'next/link';

export default function SmartEditorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-10">
      <div className="border border-border bg-neutral-50 p-10 text-center max-w-md">
        <div className="text-3xl mb-4">🔒</div>
        <p className="text-sm text-neutral-600 mb-6">
          AI 스마트 에디터 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.
        </p>
        <Link href="/purchase" className="inline-block bg-black text-white text-[11px] font-black px-6 py-3">
          프리미엄 구독하기
        </Link>
      </div>
    </div>
  );
}
