import type { TicketStatus } from '@/domain/ticket';
import type { IconName } from './icons';

export const STATUS_ICONS: Record<TicketStatus, IconName> = {
  OPEN: 'circle',
  IN_PROGRESS: 'clock',
  WAITING: 'pause',
  RESOLVED: 'checkCircle',
  CLOSED: 'lock',
};
