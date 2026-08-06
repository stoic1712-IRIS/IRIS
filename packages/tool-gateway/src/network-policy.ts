import { isIP } from "node:net";

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  const [first = -1, second = -1] = parts;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function assertPublicHttpsTarget(url: URL, allowedHosts: readonly string[]): void {
  const hostname = url.hostname.toLowerCase();
  const unwrapped = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  if (
    url.protocol !== "https:" ||
    !allowedHosts.includes(hostname) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isIP(unwrapped) === 6 ||
    privateIpv4(unwrapped)
  )
    throw new Error("NETWORK_PUBLIC_TARGET_REQUIRED");
}
