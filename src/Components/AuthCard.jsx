export default function AuthCard({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-2xl border border-neutral-800 space-y-6`}
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>

        {children}

        {footer && (
          <p className="text-center text-xs text-gray-500">{footer}</p>
        )}
      </div>
    </div>
  );
}
