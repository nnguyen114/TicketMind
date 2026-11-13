import { useState } from 'react';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { formatError } from '@/lib/errorMessages';

/**
 * A mutation that owns its own error message.
 *
 * <p>Every mutating component was repeating the same three things: a
 * `useState<string | null>`, an `onError` that ran the error through
 * {@link formatError}, and a manual `setError(null)` before firing. That is the
 * whole of this hook — callers supply `mutationFn` and `onSuccess` and read
 * `errorMessage`.
 */
export function useApiMutation<TData, TVariables = void>(
  options: Omit<UseMutationOptions<TData, Error, TVariables>, 'onError' | 'onMutate'>,
) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation<TData, Error, TVariables>({
    ...options,
    onMutate: () => {
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(formatError(error));
    },
  });

  return { mutation, errorMessage, setErrorMessage };
}
