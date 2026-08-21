import { VaultForm } from '../VaultForm';

export default function CoupangOnboardingPage() {
  return (
    <VaultForm
      provider="COUPANG"
      serviceName="쿠팡파트너스"
      fields={[
        { key: 'accessKey', label: 'ACCESS KEY', type: 'password' },
        { key: 'secretKey', label: 'SECRET KEY', type: 'password' },
      ]}
    />
  );
}
