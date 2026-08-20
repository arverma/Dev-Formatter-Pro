export type ConvertDirection = 'auto' | 'epoch' | 'date';

export type EpochUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

export interface ConvertResult {
  text: string;
  isError: boolean;
  errorMessage?: string;
  direction: 'epoch' | 'date' | 'now';
}

export interface ConvertOptions {
  /** IANA timezone id (e.g. Asia/Kolkata). Use UTC for GMT. */
  timeZone: string;
  direction: ConvertDirection;
  /** Injected for tests; defaults to Date.now(). */
  nowMs?: number;
}
