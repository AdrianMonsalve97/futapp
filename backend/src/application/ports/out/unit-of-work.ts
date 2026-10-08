/** Atomic boundary for use cases that write to several repositories. */
export interface UnitOfWork {
  run<T>(operation: () => T): T;
}
