export const modelGatewayErrorCodes = [
  "SECRET_DETECTED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_REJECTED",
  "INVALID_PROVIDER_RESPONSE",
  "INVALID_STRUCTURED_OUTPUT",
  "MODEL_MISMATCH",
] as const;
export type ModelGatewayErrorCode = (typeof modelGatewayErrorCodes)[number];

export class ModelGatewayError extends Error {
  readonly code: ModelGatewayErrorCode;
  readonly retryable: boolean;
  readonly safeDetails: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: ModelGatewayErrorCode,
    message: string,
    retryable: boolean,
    safeDetails: Record<string, string | number | boolean | null> = {},
  ) {
    super(message);
    this.name = "ModelGatewayError";
    this.code = code;
    this.retryable = retryable;
    this.safeDetails = Object.freeze({ ...safeDetails });
  }
}
