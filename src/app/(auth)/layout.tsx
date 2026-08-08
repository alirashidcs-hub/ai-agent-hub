export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg bg-dot-grid flex items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
