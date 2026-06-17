import SidebarReopenButton from "@/components/app/sidebar-reopen-button";

export default function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-[60px] items-center justify-between border-b border-line bg-surface px-8">
      <div className="flex items-center gap-2">
        {/* Appears only when the sidebar is collapsed — sits where the « was. */}
        <SidebarReopenButton />
        <h1 className="font-brand text-lg font-bold text-navy">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-line bg-surface px-6 py-16 text-center">
      <p className="max-w-[400px] font-body text-sm leading-relaxed text-steel">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
