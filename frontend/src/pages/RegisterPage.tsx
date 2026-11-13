import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { FormField } from '@/components/FormField';
import { Icon } from '@/components/icons';
import { Button, Notice } from '@/components/ui';
import { formatError } from '@/lib/errorMessages';
import { AuthCard } from './LoginPage';

// Mirrors the backend's PasswordPolicy: length is the rule, no composition
// rules (current OWASP guidance).
const PASSWORD_MIN = 12;

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required').max(120),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: doRegister, status } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirm: '' },
  });

  const password = watch('password');
  const confirm = watch('confirm');
  const rules = [
    { label: `${PASSWORD_MIN}+ characters`, ok: password.length >= PASSWORD_MIN },
    { label: 'Passwords match', ok: password.length > 0 && password === confirm },
  ];
  const ready = rules.every((rule) => rule.ok);

  const onSubmit = handleSubmit(async ({ displayName, email, password: pw }) => {
    setServerError(null);
    try {
      // Success flips status to authenticated, and the guard below redirects.
      await doRegister({ displayName, email, password: pw });
    } catch (error) {
      setServerError(formatError(error));
    }
  });

  if (status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <AuthCard title="Create your account">
      {serverError ? (
        <Notice tone="error" icon={<Icon name="alert" />}>
          {serverError}
        </Notice>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
        <FormField
          label="Display name"
          autoComplete="name"
          {...register('displayName')}
          error={errors.displayName?.message}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-rules"
          {...register('password')}
          error={errors.password?.message}
        />
        <FormField
          label="Confirm password"
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-rules"
          {...register('confirm')}
          error={errors.confirm?.message}
        />
        <ul
          id="password-rules"
          aria-live="polite"
          className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 text-[13px]"
        >
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2">
              {rule.ok ? (
                <>
                  <Icon name="check" className="text-green-800" label="Done" />
                  <span className="font-semibold text-green-800">{rule.label}</span>
                </>
              ) : (
                <>
                  <Icon name="circle" className="text-zinc-500" label="Not yet" />
                  <span className="text-zinc-600">{rule.label}</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <Button type="submit" disabled={isSubmitting || !ready} className="min-h-11">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-center text-[13px] text-zinc-600">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
