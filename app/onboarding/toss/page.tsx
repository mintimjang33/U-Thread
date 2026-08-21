import { VaultForm } from '../VaultForm';

export default function TossOnboardingPage() {
  return (
    <VaultForm
      provider="TOSS"
      serviceName="토스쇼핑 파트너스"
      fields={[
        { key: 'accessKey', label: 'ACCESS KEY', type: 'password' },
        { key: 'secretKey', label: 'SECRET KEY', type: 'password' },
        { key: 'publisherId', label: '회원 연동 ID (PublisherID, UUID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      ]}
    />
  );
}
