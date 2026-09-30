import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TONES = ["bg-[#2F5BEA]", "bg-[#C59267]", "bg-[#1F7A55]", "bg-[#7A4FD1]", "bg-[#B7791F]", "bg-[#C2417A]"];

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
