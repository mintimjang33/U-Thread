import { PremiumGate } from '../PremiumLock';

export default function VideosArchivePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">유쓰레드 아카이브</h1>
      </div>
      <PremiumGate message="고화질 원본 숏폼 비디오 소재 아카이브 전체 열람 및 다운로드 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다.">
        <div className="border border-dashed border-border p-16 text-center text-sm text-neutral-400">
          아카이브 콘텐츠는 준비 중이에요.
        </div>
      </PremiumGate>
    </div>
  );
}
