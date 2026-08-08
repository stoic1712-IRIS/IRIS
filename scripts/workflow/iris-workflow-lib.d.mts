export interface WorkflowProgramResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface WorkflowProgramOptions {
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  timeout?: number;
}

export interface WorkflowRepositoryStatus {
  name: string;
  root: string;
  branch?: string;
  revision?: string;
  clean: boolean;
  changedPaths?: string[];
}

export interface WorkflowProbeResult {
  url: string;
  ready: boolean;
  status: number | null;
  error?: string;
}

export interface WorkflowRuntimeProcess {
  owner: "iris-founder-runtime";
  service?: string;
  processId: number;
  commandDigest?: string;
}

export interface WorkflowRuntimeState {
  owner: "iris-founder-runtime";
  bootId?: string;
  phase?: string;
  launcherPath?: string;
  processes?: WorkflowRuntimeProcess[];
  lastGreetingBootId?: string | null;
  greetingReady?: boolean;
  updatedAt?: string;
}

export interface WorkflowOverrides {
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  corepackEntrypoint?: string;
  probe?: (url: string) => WorkflowProbeResult | Promise<WorkflowProbeResult>;
  repositoryStatus?: (
    name: string,
    root: string,
  ) => WorkflowRepositoryStatus | Promise<WorkflowRepositoryStatus>;
  runProgram?: (
    program: string,
    arguments_: string[],
    options: WorkflowProgramOptions,
  ) => WorkflowProgramResult | Promise<WorkflowProgramResult>;
  sleep?: (milliseconds: number) => void | Promise<void>;
  spawnDetached?: (
    program: string,
    arguments_: string[],
    options: { cwd: string; environment: NodeJS.ProcessEnv },
  ) => { pid?: number };
  resolveBootId?: () => string | Promise<string>;
  writeRuntimeState?: (state: WorkflowRuntimeState) => void | Promise<void>;
  readRuntimeState?: () => WorkflowRuntimeState | null | Promise<WorkflowRuntimeState | null>;
  clearRuntimeState?: () => void | Promise<void>;
  openFounderApplication?: () => void | Promise<void>;
  stopStartedProcess?: (processId: number) => unknown | Promise<unknown>;
  stopOwnedProcess?: (process: WorkflowRuntimeProcess) => boolean | Promise<boolean>;
}

export type WorkflowResult = string | Record<string, unknown>;

export function helpText(): string;
export function parseArguments(tokens: string[]): {
  positional: string[];
  options: Record<string, string | boolean>;
};
export function resultExitCode(value: unknown): number;
export function resolveWorkflowRoots(options?: {
  coreRoot?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<{ core: string; commandCenter: string; projectsRoot: string }>;
export function runWorkflow(argv: string[], overrides?: WorkflowOverrides): Promise<WorkflowResult>;
