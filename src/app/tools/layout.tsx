/**
 * Tools Layout
 * Standalone layout for the tools micro-site pages.
 * Provides a clean, marketing-oriented layout without the main app sidebar.
 */

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white" style={{ background: 'white' }}>
      {children}
    </div>
  );
}
