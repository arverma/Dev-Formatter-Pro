export type DecodeKind = 'base64' | 'url' | 'unicode' | 'jwt';

export interface DecodeResult {
  text: string;
  isError: boolean;
  errorMessage?: string;
  kind: DecodeKind;
}
