import { z } from "zod";

export const founderVoiceIntentSchema = z.enum([
  "conversation",
  "show-capabilities",
  "show-status",
  "emergency-stop",
  "propose-mission",
]);

export const founderVoiceCommandSchema = z.object({
  source: z.enum(["voice", "text"]),
  transcript: z.string().trim().min(1).max(2_000),
  intent: founderVoiceIntentSchema,
  audioRetention: z.literal("none"),
  transcriptRetention: z.enum(["ephemeral", "approved-memory-proposal"]),
  mayExecuteMutation: z.literal(false),
  requiresFounderConfirmation: z.boolean(),
});

export type FounderVoiceCommand = z.infer<typeof founderVoiceCommandSchema>;

export function validateFounderVoiceCommand(input: unknown): FounderVoiceCommand {
  return founderVoiceCommandSchema.parse(input);
}
