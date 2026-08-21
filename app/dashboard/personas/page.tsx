import { PremiumLock } from '../PremiumLock';

export default function PersonasPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 bg-black inline-block" />
        <h1 className="text-xl font-black">페르소나 관리</h1>
      </div>
      <PremiumLock message="나만의 고유한 말투, 타겟팅 프롬프트, AI 페르소나 설정 및 프로필 분석 추출 기능은 프리미엄 멤버십 구독 후 이용할 수 있습니다." />
    </div>
  );
}
