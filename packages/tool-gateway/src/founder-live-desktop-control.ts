import {
  DesktopControlDeniedError,
  executeDesktopControl,
  type DesktopControlAdapter,
  type DesktopControlApproval,
  type DesktopControlDecisionRecorder,
  type DesktopControlPlan,
  type DesktopControlPreview,
  type DesktopControlReceipt,
  type DesktopControlReplayGuard,
} from "./desktop-control-provider.js";

export interface FounderDesktopAccessAuthorizer {
  authorize(requestId: string, capability: "desktop.operate-bounded"): unknown;
}

export class FounderLiveDesktopControl {
  readonly #access: FounderDesktopAccessAuthorizer;
  readonly #adapter: DesktopControlAdapter;
  readonly #replayGuard: DesktopControlReplayGuard;
  readonly #now: () => Date;
  #active:
    | { requestId: string; controller: AbortController; generation: number }
    | undefined;
  #generation = 0;

  constructor(options: {
    access: FounderDesktopAccessAuthorizer;
    adapter: DesktopControlAdapter;
    replayGuard: DesktopControlReplayGuard;
    now?: () => Date;
  }) {
    this.#access = options.access;
    this.#adapter = options.adapter;
    this.#replayGuard = options.replayGuard;
    this.#now = options.now ?? (() => new Date());
  }

  async start(
    accessRequestId: string,
    plan: DesktopControlPlan,
    preview: DesktopControlPreview,
    approval: DesktopControlApproval,
    audit: DesktopControlDecisionRecorder,
  ): Promise<DesktopControlReceipt> {
    if (this.#active !== undefined)
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_EXECUTION_ALREADY_ACTIVE");
    this.#access.authorize(accessRequestId, "desktop.operate-bounded");
    const controller = new AbortController();
    const generation = ++this.#generation;
    this.#active = { requestId: plan.requestId, controller, generation };
    try {
      return await executeDesktopControl(plan, preview, approval, this.#adapter, {
        enabled: true,
        audit,
        replayGuard: this.#replayGuard,
        signal: controller.signal,
        now: this.#now(),
        clock: this.#now,
        timeoutMs: plan.maximumDurationMs,
      });
    } finally {
      if (this.#active?.generation === generation) this.#active = undefined;
    }
  }

  stop(): boolean {
    if (this.#active === undefined) return false;
    this.#active.controller.abort();
    this.#active = undefined;
    return true;
  }

  status(): { active: false } | { active: true; requestId: string } {
    return this.#active === undefined
      ? { active: false }
      : { active: true, requestId: this.#active.requestId };
  }
}
