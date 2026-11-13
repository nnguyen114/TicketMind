import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { CONTROL_BORDER, CONTROL_BORDER_INVALID, CONTROL_CLASS, ErrorText } from './ui';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

/**
 * Label, control, then either the error or the hint.
 *
 * <p>The three exported wrappers exist because this shell used to support
 * {@code <input>} only, so every textarea and select in the app hand-copied the
 * label + control-classes + error-paragraph triple. Adding the two siblings
 * removed four such copies.
 */
function Field({
  label,
  error,
  hint,
  controlId,
  children,
}: FieldProps & { controlId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : hint ? (
        <p className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function controlClass(error: string | undefined): string {
  return `${CONTROL_CLASS} ${error ? CONTROL_BORDER_INVALID : CONTROL_BORDER}`;
}

export function FormField({
  label,
  error,
  hint,
  id,
  ...inputProps
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = id ?? inputProps.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} controlId={controlId}>
      <input
        id={controlId}
        {...inputProps}
        aria-invalid={error ? true : undefined}
        className={controlClass(error)}
      />
    </Field>
  );
}

export function FormTextArea({
  label,
  error,
  hint,
  id,
  ...textareaProps
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlId = id ?? textareaProps.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} controlId={controlId}>
      <textarea
        id={controlId}
        {...textareaProps}
        aria-invalid={error ? true : undefined}
        className={controlClass(error)}
      />
    </Field>
  );
}

export function FormSelect({
  label,
  error,
  hint,
  id,
  children,
  ...selectProps
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const controlId = id ?? selectProps.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} controlId={controlId}>
      <select
        id={controlId}
        {...selectProps}
        aria-invalid={error ? true : undefined}
        className={`${controlClass(error)} disabled:bg-slate-100`}
      >
        {children}
      </select>
    </Field>
  );
}
