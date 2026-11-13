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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className="font-semibold text-zinc-900">
        {label}
      </label>
      {children}
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : hint ? (
        <p id={`${controlId}-hint`} className="text-[13px] text-zinc-600">
          {hint}
        </p>
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
        aria-describedby={hint && !error ? `${controlId}-hint` : undefined}
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
        aria-describedby={hint && !error ? `${controlId}-hint` : undefined}
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
        aria-describedby={hint && !error ? `${controlId}-hint` : undefined}
        {...selectProps}
        aria-invalid={error ? true : undefined}
        className={controlClass(error)}
      >
        {children}
      </select>
    </Field>
  );
}
