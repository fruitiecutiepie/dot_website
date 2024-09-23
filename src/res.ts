// Asynchronous
export async function res_async<T>(
  fn: () => Promise<T> | Thenable<T>
): Promise<[
  ok: T,
  err: any
]> {
  try {
    return [await fn(), undefined];
  } catch (err: any) {
    return [undefined as unknown as T, err];
  }
}

// Synchronous function overload
export function res<T>(
  fn: () => T
): [
  ok: T,
  err: any
] {
  try {
    return [fn(), undefined];
  } catch (err: any) {
    return [undefined as unknown as T, err];
  }
}
