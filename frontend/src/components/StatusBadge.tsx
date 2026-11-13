import { STATUS_LABELS, SUBMITTER_STATUS_LABELS, type TicketStatus } from '@/domain/ticket';
import { Icon } from './icons';
import { STATUS_ICONS } from './statusIcons';

/** Icon plus words: status is never shown by color alone. */
export function StatusBadge({
  status,
  audience = 'staff',
  className = '',
}: {
  status: TicketStatus;
  audience?: 'staff' | 'submitter';
  className?: string;
}) {
  const label = audience === 'staff' ? STATUS_LABELS[status] : SUBMITTER_STATUS_LABELS[status];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon name={STATUS_ICONS[status]} size={14} />
      {label}
    </span>
  );
}
