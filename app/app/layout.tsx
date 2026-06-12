export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen flex-1 bg-page">{children}</div>;
}
