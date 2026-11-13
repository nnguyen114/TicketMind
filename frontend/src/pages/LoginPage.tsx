import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/api/errors';
import { FormField } from '@/components/FormField';
import { Logo } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { Button, Notice } from '@/components/ui';
import { formatError } from '@/lib/errorMessages';
import { useCountdown } from '@/hooks/useCountdown';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

/** The centered card both sign-in and registration sit in. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-start justify-center px-4 py-12 sm:items-center">
      <section
        aria-labelledby="auth-heading"
        className="flex w-full max-w-sm flex-col gap-[18px] rounded-2xl border border-zinc-200 bg-white p-8"
      >
        <Logo />
        <h1 id="auth-heading" className="text-[22px] font-bold">
          {title}
        </h1>
        {children}
      </section>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState<unknown>(null);
  const [wait, setWait] = useState<{ seconds: number } | null>(null);
  const secondsLeft = useCountdown(wait);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const code = failure instanceof ApiError ? failure.code : null;
  const waiting = code === 'rate_limit_exceeded' && secondsLeft > 0;

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (error) {
      setFailure(error);
      if (error instanceof ApiError && error.retryAfterSeconds) {
        setWait({ seconds: error.retryAfterSeconds });
      }
    }
  });

  return (
    <AuthCard title="Sign in">
      {code === 'account_locked' ? (
        <Notice tone="warning" icon={<Icon name="lock" />}>
          This account is locked after too many failed attempts. Try again in a few minutes.
        </Notice>
      ) : code === 'rate_limit_exceeded' ? (
        <Notice tone="warning" icon={<Icon name="clock" />} live="status">
          {waiting
            ? `Too many attempts. You can try again in ${secondsLeft} seconds.`
            : 'You can try again now.'}
        </Notice>
      ) : failure ? (
        <Notice tone="error" icon={<Icon name="alert" />}>
          {formatError(failure)}
        </Notice>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate>
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
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" disabled={isSubmitting || waiting} className="min-h-11">
          {waiting ? `Try again in ${secondsLeft}s` : isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-center text-[13px] text-zinc-600">
        New here?{' '}
        <Link to="/register" className="text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
