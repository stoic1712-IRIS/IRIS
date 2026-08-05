import type {
  ExecutionRequest,
  ExecutorAdapter,
  ExecutorResult,
} from "./bootstrap-orchestrator.js";

export const approvedOpenClawRuntime = {
  image: "ghcr.io/openclaw/openclaw:2026.7.1-2",
  digest: "sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac",
  sourceRevision: "0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c",
  license: "MIT",
} as const;

export interface OpenClawTransport {
  health(): Promise<boolean>;
  execute(request: ExecutionRequest, signal: AbortSignal): Promise<ExecutorResult>;
  cancel(requestId: string): Promise<void>;
}

export class OpenClawAdapter implements ExecutorAdapter {
  readonly provider = "openclaw";
  readonly version = "2026.7.1-2";
  readonly #transport: OpenClawTransport;

  constructor(transport: OpenClawTransport) {
    this.#transport = transport;
  }

  async health(): Promise<{ status: "ready" | "unavailable"; safeSummary: string }> {
    return (await this.#transport.health())
      ? { status: "ready", safeSummary: "Bounded OpenClaw transport is ready." }
      : { status: "unavailable", safeSummary: "OpenClaw transport is unavailable." };
  }

  execute(request: ExecutionRequest, signal: AbortSignal): Promise<ExecutorResult> {
    return this.#transport.execute(request, signal);
  }

  cancel(requestId: string): Promise<void> {
    return this.#transport.cancel(requestId);
  }
}

export class DisabledExecutorAdapter implements ExecutorAdapter {
  readonly provider = "iris-native-disabled-provider";
  readonly version = "1.0.0";

  health(): Promise<{ status: "unavailable"; safeSummary: string }> {
    return Promise.resolve({ status: "unavailable", safeSummary: "External executor disabled." });
  }

  execute(_request: ExecutionRequest, _signal: AbortSignal): Promise<ExecutorResult> {
    void _request;
    void _signal;
    return Promise.reject(new Error("External executor disabled."));
  }

  cancel(_requestId: string): Promise<void> {
    void _requestId;
    return Promise.resolve();
  }
}
