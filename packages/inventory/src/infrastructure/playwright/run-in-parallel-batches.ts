export async function runInParallelBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => fn(item, offset + batchIndex)),
    );
    results.push(...batchResults);
  }
  return results;
}
