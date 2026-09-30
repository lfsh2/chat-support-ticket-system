import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Deep, ink-like tones drawn from the brand, all ≥ 4.5:1 against white initials.
const TONES = ["bg-[#2A3A63]", "bg-[#8A5A36]", "bg-[#2F5BEA]", "bg-[#1F6B4C]", "bg-[#6B3E5E]", "bg-[#4A5568]"];

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function tone(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

export function UserAvatar({
  name,
  src,
  seed,
  className,
}: {
  name: string;
  src?: string | null;
  seed?: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn("text-xs font-semibold text-white", tone(seed ?? name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
