import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'soon';

const variants: Record<Variant, string> = {
  default:  'bg-gray-100 text-gray-600',
  success:  'bg-green-50 text-green-700 border border-green-200',
  warning:  'bg-amber-50 text-amber-700 border border-amber-200',
  danger:   'bg-red-50 text-red-700 border border-red-200',
  info:     'bg-blue-50 text-blue-700 border border-blue-200',
  outline:  'border border-gray-300 text-gray-600',
  soon:     'bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wide px-1.5 py-0.5',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
