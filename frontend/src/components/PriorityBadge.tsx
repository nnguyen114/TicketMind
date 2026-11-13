import { PRIORITY_LABELS, type TicketPriority } from '@/domain/ticket';

const styles: Record<TicketPriority, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-slate-700',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
};

export function PriorityBadge({ priority }: { priority: TicketPriority | null | undefined }) {
  if (!priority) return <span className="text-slate-400 text-xs">-</span>;
  return (
    <span className={`text-xs font-medium ${styles[priority]}`}>{PRIORITY_LABELS[priority]}</span>
  );
}
