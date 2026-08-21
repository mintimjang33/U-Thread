import { VaultForm } from './VaultForm';

export default function GeminiOnboardingPage() {
  return (
    <VaultForm
      provider="GEMINI"
      serviceName="GOOGLE GEMINI"
      fields={[{ key: 'apiKey', label: 'GOOGLE GEMINI API 키', placeholder: 'AIzaSy...', type: 'password' }]}
    />
  );
}
