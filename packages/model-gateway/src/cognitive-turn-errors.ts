export const cognitiveTurnErrorCodes = [
  "COGNITIVE_OBJECTIVE_BINDING_MISMATCH",
  "COGNITIVE_CAPABILITY_NOT_ALLOWED",
  "COGNITIVE_PROTECTED_EFFECT_STOP",
  "COGNITIVE_ROUTE_MISMATCH",
  "COGNITIVE_INVALID_TRANSITION",
  "COGNITIVE_REVIEWER_UNAVAILABLE",
  "COGNITIVE_EVIDENCE_MISMATCH",
  "COGNITIVE_SYNTHESIS_INVALID",
  "COGNITIVE_TURN_CANCELLED",
  "COGNITIVE_RESUME_BINDING_MISMATCH",
  "COGNITIVE_ORCHESTRATOR_UNAVAILABLE",
  "COGNITIVE_SPECIALIST_UNAVAILABLE",
  "MODEL_LEASE_CONFLICT",
  "MODEL_LEASE_RELEASE_FAILED",
] as const;

export type CognitiveTurnErrorCode = (typeof cognitiveTurnErrorCodes)[number];

export type CognitiveTurnSafeDetail = string | number | boolean | null;
export type CognitiveTurnSafeDetails = Readonly<Record<string, CognitiveTurnSafeDetail>>;

export class CognitiveTurnError extends Error {
  readonly code: CognitiveTurnErrorCode;
  readonly retryable: boolean;
  readonly safeDetails: CognitiveTurnSafeDetails;

  constructor(
    code: CognitiveTurnErrorCode,
    options: {
      readonly retryable?: boolean;
      readonly safeDetails?: Readonly<Record<string, CognitiveTurnSafeDetail>>;
    } = {},
  ) {
    super(code);
    this.name = "CognitiveTurnError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.safeDetails = Object.freeze({ ...(options.safeDetails ?? {}) });
    Object.freeze(this);
  }
}
