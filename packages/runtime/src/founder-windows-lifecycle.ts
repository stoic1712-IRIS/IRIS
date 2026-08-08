import { z } from "zod";

const timestampSchema = z.iso.datetime();
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const founderRuntimePhaseSchema = z.enum([
  "stopped",
  "starting",
  "healthy",
  "degraded",
  "repairing",
]);
export type FounderRuntimePhase = z.infer<typeof founderRuntimePhaseSchema>;

export const founderRuntimeProcessSchema = z
  .object({
    service: z.enum(["launcher", "gateway", "voice", "search"]),
    processId: z.number().int().positive().max(4_294_967_295),
    owner: z.literal("iris-founder-runtime"),
    commandDigest: sha256Schema,
    startedAt: timestampSchema,
  })
  .strict();
export type FounderRuntimeProcess = z.infer<typeof founderRuntimeProcessSchema>;

export const founderRuntimeHealthSchema = z
  .object({
    service: z.enum(["gateway", "voice", "search", "ollama"]),
    url: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === "http:" && url.hostname === "127.0.0.1";
    }, "Founder runtime health URLs must be loopback HTTP."),
    ready: z.boolean(),
    status: z.number().int().min(100).max(599).nullable(),
    checkedAt: timestampSchema,
  })
  .strict();
export type FounderRuntimeHealth = z.infer<typeof founderRuntimeHealthSchema>;

export const founderWindowsLifecycleStateSchema = z
  .object({
    phase: founderRuntimePhaseSchema,
    bootId: z.string().regex(/^boot_[a-z0-9-]{8,100}$/u),
    gatewayBootId: z
      .string()
      .regex(/^gateway_[a-z0-9-]{8,100}$/u)
      .optional(),
    processes: z.array(founderRuntimeProcessSchema).max(8),
    health: z.array(founderRuntimeHealthSchema).length(4),
    lastGreetingBootId: z
      .string()
      .regex(/^boot_[a-z0-9-]{8,100}$/u)
      .optional(),
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const services = value.health.map((entry) => entry.service);
    if (new Set(services).size !== 4)
      context.addIssue({
        code: "custom",
        path: ["health"],
        message: "Health services must be unique.",
      });
    if (value.phase === "healthy" && value.health.some((entry) => !entry.ready))
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "Healthy requires every service.",
      });
    if (value.lastGreetingBootId !== undefined && value.lastGreetingBootId !== value.bootId)
      context.addIssue({
        code: "custom",
        path: ["lastGreetingBootId"],
        message: "Greeting must bind this boot.",
      });
  });
export type FounderWindowsLifecycleState = z.infer<typeof founderWindowsLifecycleStateSchema>;

export function classifyFounderRuntimeHealth(input: {
  processes: readonly FounderRuntimeProcess[];
  health: readonly FounderRuntimeHealth[];
  repairing?: boolean;
}): FounderRuntimePhase {
  const processes = z.array(founderRuntimeProcessSchema).max(8).parse(input.processes);
  const health = z.array(founderRuntimeHealthSchema).length(4).parse(input.health);
  if (input.repairing === true) return "repairing";
  if (health.every((entry) => entry.ready)) return "healthy";
  if (processes.length === 0 && health.every((entry) => !entry.ready)) return "stopped";
  if (health.every((entry) => !entry.ready)) return "starting";
  return "degraded";
}
