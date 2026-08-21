import { PremiumGate } from '../PremiumLock';

export default function ThreadsArchivePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">내 게시물 보관함</h1>
      </div>
      <PremiumGate message="스마트 에디터로 작성하고 생성된 모든 브랜드 피드 및 타래 보관 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          아직 스마트 에디터로 작성한 게시물이 없어요. <a href="/write" className="underline font-bold text-black">지금 작성하러 가기</a>
        </div>
      </PremiumGate>
    </div>
  );
}
