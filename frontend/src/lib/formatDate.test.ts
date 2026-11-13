import { describe, expect, it } from 'vitest';
import { formatAbsolute, formatAge, formatRelative } from './formatDate';
import { triageState, TRIAGE_POLL_WINDOW_MS } from '@/domain/ticket';

describe('formatRelative', () => {
  const now = new Date('2026-07-02T12:00:00Z');

  it('rounds down to seconds when the delta is small', () => {
    const then = new Date('2026-07-02T11:59:55Z').toISOString();
    expect(formatRelative(then, now)).toMatch(/second/);
  });

  it('picks the largest fitting unit for older timestamps', () => {
    expect(formatRelative(new Date('2025-07-02T12:00:00Z').toISOString(), now)).toMatch(/year/);
    expect(formatRelative(new Date('2026-06-01T12:00:00Z').toISOString(), now)).toMatch(/month/);
    expect(formatRelative(new Date('2026-06-15T12:00:00Z').toISOString(), now)).toMatch(/week/);
    expect(formatRelative(new Date('2026-07-01T12:00:00Z').toISOString(), now)).toMatch(
      /day|yesterday/,
    );
    expect(formatRelative(new Date('2026-07-02T09:00:00Z').toISOString(), now)).toMatch(/hour/);
    expect(formatRelative(new Date('2026-07-02T11:50:00Z').toISOString(), now)).toMatch(/minute/);
  });
});

describe('formatAbsolute', () => {
  it('returns a non-empty formatted string', () => {
    const output = formatAbsolute('2026-07-02T12:00:00Z');
    expect(output.length).toBeGreaterThan(0);
  });
});

describe('formatAge', () => {
  const now = new Date('2026-07-02T12:00:00Z');
  it('uses the largest whole unit', () => {
    expect(formatAge('2026-07-02T11:46:00Z', now)).toBe('14m');
    expect(formatAge('2026-07-02T10:00:00Z', now)).toBe('2h');
    expect(formatAge('2026-06-29T12:00:00Z', now)).toBe('3d');
    expect(formatAge('2026-06-01T12:00:00Z', now)).toBe('4w');
    expect(formatAge('2026-07-02T12:05:00Z', now)).toBe('0m');
  });
});

describe('triageState', () => {
  const created = '2026-07-02T12:00:00Z';
  const t0 = new Date(created).getTime();
  it('is done once triaged, analyzing inside the window, and gives up after', () => {
    expect(
      triageState({ createdAt: created, triagedAt: created }, t0 + 10 * TRIAGE_POLL_WINDOW_MS),
    ).toBe('done');
    expect(triageState({ createdAt: created, triagedAt: null }, t0 + 1000)).toBe('analyzing');
    expect(triageState({ createdAt: created, triagedAt: null }, t0 + TRIAGE_POLL_WINDOW_MS)).toBe(
      'gave_up',
    );
  });
});
