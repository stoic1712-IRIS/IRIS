import { z } from "zod";

export const capabilityStatusSchema = z.enum(["available", "learning", "restricted", "offline"]);

export const capabilityNodeSchema: z.ZodType<CapabilityNode> = z.lazy(() =>
  z
    .object({
      id: z.string().regex(/^capability_[a-z0-9][a-z0-9-]{2,99}$/u),
      name: z.string().min(1).max(120),
      description: z.string().min(1).max(500),
      status: capabilityStatusSchema,
      workerIds: z.array(z.string().regex(/^worker_[a-z0-9][a-z0-9-]{2,99}$/u)).max(20),
      dependencies: z.array(z.string().regex(/^capability_[a-z0-9][a-z0-9-]{2,99}$/u)).max(20),
      evidence: z.array(z.string().min(1).max(500)).max(20),
      authorizationRequirement: z.enum([
        "none",
        "standing-policy",
        "founder-confirmation",
        "typed-protected-approval",
      ]),
      internetAccess: z.enum(["none", "governed-gateway"]),
      children: z.array(capabilityNodeSchema).max(30),
    })
    .strict(),
);

export interface CapabilityNode {
  id: string;
  name: string;
  description: string;
  status: z.infer<typeof capabilityStatusSchema>;
  workerIds: string[];
  dependencies: string[];
  evidence: string[];
  authorizationRequirement:
    "none" | "standing-policy" | "founder-confirmation" | "typed-protected-approval";
  internetAccess: "none" | "governed-gateway";
  children: CapabilityNode[];
}

export const capabilityTreeSchema = z
  .object({
    root: capabilityNodeSchema,
    generatedAt: z.iso.datetime(),
    canonicalMemoryMutation: z.literal(false),
  })
  .strict();

export type CapabilityTree = z.infer<typeof capabilityTreeSchema>;

export function validateCapabilityTree(input: unknown): CapabilityTree {
  const tree = capabilityTreeSchema.parse(input);
  const ids = new Set<string>();
  const visit = (node: CapabilityNode): void => {
    if (ids.has(node.id)) throw new Error(`Duplicate capability id: ${node.id}`);
    ids.add(node.id);
    node.children.forEach(visit);
  };
  visit(tree.root);
  return tree;
}
