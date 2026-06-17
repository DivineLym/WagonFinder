export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-10 4 6 3-4 4 8M3 20h18" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">WagonFinder</span>
          </div>
          <p className="text-sm text-gray-500">Логистическая платформа КТЖ</p>
        </div>
        {children}
      </div>
    </div>
  );
}
