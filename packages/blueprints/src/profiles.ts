import type { BlueprintProfile } from "./contracts.js";

export interface ProfileLimits {
  readonly cpuCores: number;
  readonly memoryMiB: number;
  readonly storageGiB: number;
  readonly gpuCount: number;
  readonly allowPublicExposure: boolean;
  readonly costMultiplier: number;
}

export const profileLimits: Readonly<Record<BlueprintProfile, ProfileLimits>> = Object.freeze({
  development: Object.freeze({
    cpuCores: 12,
    memoryMiB: 32_768,
    storageGiB: 500,
    gpuCount: 1,
    allowPublicExposure: false,
    costMultiplier: 0,
  }),
  test: Object.freeze({
    cpuCores: 24,
    memoryMiB: 65_536,
    storageGiB: 1_000,
    gpuCount: 2,
    allowPublicExposure: false,
    costMultiplier: 0.5,
  }),
  staging: Object.freeze({
    cpuCores: 64,
    memoryMiB: 262_144,
    storageGiB: 4_096,
    gpuCount: 4,
    allowPublicExposure: true,
    costMultiplier: 0.8,
  }),
  production: Object.freeze({
    cpuCores: 256,
    memoryMiB: 1_048_576,
    storageGiB: 32_768,
    gpuCount: 16,
    allowPublicExposure: true,
    costMultiplier: 1,
  }),
});
