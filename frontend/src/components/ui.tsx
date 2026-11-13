import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/**
 * The handful of visual primitives this app repeats.
 *
 * <p>Not a design system — just the class strings that were being copied
 * between pages, in one place. Before this, the same outline button existed in
 * six files with the tokens in a different order in two of them, and the
 * "Unassigned" chip was slate-400 in the list and slate-500 in the sidebar.
 */

/** Shared by input, textarea and select so the three always match. */
export const CONTROL_CLASS =
  'w-full rounded-md border px-3 py-2 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500';

export const CONTROL_BORDER = 'border-slate-300';
export const CONTROL_BORDER_INVALID = 'border-red-400';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
  outline: 'border border-indigo-600 text-indigo-600 hover:bg-indigo-50',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 font-medium',
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
      className={`rounded-md disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}

/** Exported for the few places that need the look on a non-div (a form, a Link). */
export const CARD_CLASS = 'rounded-md border border-slate-200 bg-white p-4';

/** A <Link> that should read as a primary button. */
export const LINK_BUTTON_CLASS =
  'inline-block rounded-md bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-500';

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
    <p role="alert" className={`text-sm text-red-600 ${className}`}>
      {children}
    </p>
  );
}

export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold text-slate-900 mb-6">{children}</h1>;
}

export function SectionHeading({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-sm font-semibold text-slate-900 ${className}`}>{children}</h2>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-slate-500 italic ${className}`}>{children}</span>;
}
