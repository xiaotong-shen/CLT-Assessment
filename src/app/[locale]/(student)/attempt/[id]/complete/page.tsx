import { useTranslations } from "next-intl";

export default function CompletePage() {
  return <CompleteContent />;
}

function CompleteContent() {
  // Deliberately a server component — no dynamic data needed, just a static confirmation
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-10 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-xl font-semibold mb-2">Assessment Complete</h1>
        <p className="text-sm text-gray-500">
          Thank you for completing the assessment. Your results will be reviewed
          by an ESL specialist and you will be contacted with your placement.
        </p>
        <p className="text-sm text-gray-400 mt-6">评估已完成，感谢您的参与。</p>
      </div>
    </main>
  );
}
