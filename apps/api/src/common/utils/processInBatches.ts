type ProcessInBatchesOptions<T> = {
  batchSize: number;
  onItemError?: (error: unknown, item: T, itemIndex: number) => void;
  throwOnError?: boolean;
};

export async function processInBatches<T, TResult = void>(
  items: T[],
  processItem: (item: T) => Promise<TResult>,
  { batchSize, onItemError, throwOnError = true }: ProcessInBatchesOptions<T>,
) {
  const fulfilledResults: TResult[] = [];
  const errors: unknown[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map((item) => processItem(item)));

    results.forEach((result, batchIndex) => {
      if (result.status === "fulfilled") {
        fulfilledResults.push(result.value);
        return;
      }

      const itemIndex = index + batchIndex;
      errors.push(result.reason);
      onItemError?.(result.reason, batch[batchIndex], itemIndex);
    });
  }

  if (throwOnError && errors.length) {
    const [error] = errors;

    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  return fulfilledResults;
}
