import type { ErrorPosition } from './errorPosition';

export interface FormatResult {
  formatted: string;
  isError: boolean;
  errorMessage?: string;
  errorPosition?: ErrorPosition;
}
