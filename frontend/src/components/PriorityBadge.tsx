import { PRIORITY_LABELS, type TicketPriority } from '@/domain/ticket';

// One color per priority, the same everywhere it appears. The label always
// rides along, so the color is never the only signal.
const PILL: Record<TicketPriority, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-amber-100 text-amber-800',
  MEDIUM: 'bg-slate-200 text-slate-700',
  LOW: 'bg-zinc-100 text-zinc-600',
};

const DOT: Record<TicketPriority, string> = {
  CRITICAL: 'bg-red-600',
  HIGH: 'bg-amber-600',
  MEDIUM: 'bg-slate-500',
  LOW: 'bg-zinc-400',
};

export function PriorityBadge({ priority }: { priority: TicketPriority | null | undefined }) {
  if (!priority) return null;
  return (
    <span className={`rounded px-1.5 py-px text-[11px] font-bold ${PILL[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Square dot + label, for property rows where a pill would be too loud. */
export function PriorityLabel({ priority }: { priority: TicketPriority | null | undefined }) {
  if (!priority) return <span className="text-zinc-500">Not set</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span aria-hidden className={`size-2 rounded-[2px] ${DOT[priority]}`} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
