import Link from "next/link";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const isZh = locale === "zh-Hans";
  const altLocale = isZh ? "en" : "zh-Hans";
  const altLabel = isZh ? "English" : "中文";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg text-center space-y-6">
        {/* Language switcher */}
        <div className="text-right">
          <Link
            href={`/${altLocale}`}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            {altLabel}
          </Link>
        </div>

        {/* Header */}
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2">
            {isZh ? "英语安置评估" : "ESL/ELD Placement Assessment"}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {isZh ? "欢迎！" : "Welcome!"}
          </h1>
          <p className="text-gray-600 leading-relaxed">
            {isZh
              ? "本评估帮助学校了解您的英语水平，以便为您安排合适的课程。评估包括阅读、听力、语法和写作四个部分。"
              : "This assessment helps the school understand your English language level so we can place you in the right course. It covers reading, listening, grammar, and writing."}
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3 text-sm text-left">
          {[
            {
              icon: "⏱",
              label: isZh ? "大约需要" : "Takes about",
              value: isZh ? "45–60 分钟" : "45–60 minutes",
            },
            {
              icon: "📝",
              label: isZh ? "不计分数" : "Not graded",
              value: isZh ? "结果仅用于分班" : "Results used for placement only",
            },
            {
              icon: "🔒",
              label: isZh ? "隐私保护" : "Private",
              value: isZh ? "仅学校工作人员可查看" : "Only school staff see results",
            },
            {
              icon: "💬",
              label: isZh ? "使用中文辅助" : "Chinese support",
              value: isZh ? "写作题提供中文说明" : "Writing prompts available in Chinese",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white border rounded-xl p-3 shadow-sm"
            >
              <span className="text-lg">{card.icon}</span>
              <p className="text-gray-400 text-xs mt-1">{card.label}</p>
              <p className="text-gray-800 font-medium text-xs">{card.value}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href={`/${locale}/intake`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl py-4 transition-colors shadow-sm"
        >
          {isZh ? "开始评估 →" : "Begin Assessment →"}
        </Link>

        {/* Staff link */}
        <p className="text-xs text-gray-300">
          {isZh ? "学校工作人员" : "School staff"}?{" "}
          <Link
            href={`/${locale}/login`}
            className="text-gray-400 hover:text-gray-600 underline"
          >
            {isZh ? "登录" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
