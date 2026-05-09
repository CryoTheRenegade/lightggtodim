export async function retry<T>(
  operation: () => Promise<T>,
  options: { retries: number; delayMs: number; onRetry?: (error: unknown, attempt: number) => void }
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === options.retries) {
        break;
      }
      options.onRetry?.(error, attempt + 1);
      await sleep(options.delayMs);
    }
  }

  throw lastError;
}

export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
