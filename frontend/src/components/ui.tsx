import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/**
 * The handful of visual primitives this app repeats.
 *
 * <p>Not a design system — just the class strings that were being copied
 * between pages, in one place. Colors follow the design canvas: brand blue for
 * actions, violet only for AI output, zinc for everything else.
 */

/** Shared by input, textarea and select so the three always match. */
export const CONTROL_CLASS =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-zinc-900 outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-zinc-100 disabled:text-zinc-600';

export const CONTROL_BORDER = 'border-zinc-300';
export const CONTROL_BORDER_INVALID = 'border-red-500';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-800 disabled:bg-zinc-200 disabled:text-zinc-600',
  secondary: 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100',
  outline: 'border border-brand-600 bg-white text-brand-600 hover:bg-brand-50',
  ai: 'bg-violet-700 text-white hover:bg-violet-800',
  aiOutline: 'border border-violet-500 bg-white text-violet-800 hover:bg-violet-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 min-h-8 text-[13px]',
  md: 'px-4 py-2 min-h-9 font-semibold',
  lg: 'px-4 min-h-[52px] text-base font-semibold',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button
      type={type}
      className={`rounded-lg disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}

/** Exported for the few places that need the look on a non-div (a form, a Link). */
export const CARD_CLASS = 'rounded-xl border border-zinc-200 bg-white p-4';

/** A <Link> that should read as a primary button. */
export const LINK_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-white px-4 min-h-11 font-semibold hover:bg-brand-800 hover:text-white';

/** A <Link> that should read as a secondary button. */
export const LINK_SECONDARY_CLASS =
  'inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-900 px-4 min-h-11 font-semibold hover:bg-zinc-100';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${CARD_CLASS} ${className}`} {...rest} />;
}

/** Always carries role="alert" — the reason this is a component and not a class string. */
export function ErrorText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role="alert" className={`text-sm text-red-700 ${className}`}>
      {children}
    </p>
  );
}

const NOTICE_TONES = {
  error: 'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
} as const;

/** A boxed message with an icon, for form-level outcomes (sign-in, rate limits). */
export function Notice({
  tone,
  icon,
  live = 'alert',
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  icon: ReactNode;
  live?: 'alert' | 'status';
  children: ReactNode;
}) {
  return (
    <div
      role={live}
      className={`flex gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium ${NOTICE_TONES[tone]}`}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold text-zinc-900">{children}</h1>;
}

export function SectionHeading({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-sm font-semibold text-zinc-900 ${className}`}>{children}</h2>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-zinc-500 ${className}`}>{children}</span>;
}

/** The violet "AI" tag. Used only on AI-generated content, so it keeps meaning something. */
export function AiTag() {
  return (
    <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-violet-800">
      AI
    </span>
  );
}
