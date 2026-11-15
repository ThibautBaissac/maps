// Shared bits of the command-line scripts.

export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

export const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));
