import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Alive + Free mark: the line-art heart plus the lowercase, letter-spaced
 * "alive + free" from the brand logo, with the product name set small beneath.
 * `tone="light"` inverts the black line art for dark (navy) backgrounds.
 */
export function Wordmark({
  className,
  tone = "light",
  showProduct = true,
}: {
  className?: string;
  tone?: "light" | "dark";
  showProduct?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/brand/alive-free-heart.png"
        alt=""
        width={40}
        height={40}
        priority
        className={cn("size-12 shrink-0 scale-125", tone === "light" ? "invert" : "dark:invert")}
      />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-light tracking-[0.18em] lowercase">alive + free</span>
        {showProduct && (
          <span className="note mt-1 text-[13px] tracking-normal opacity-70">Client Hub</span>
        )}
      </span>
      <span className="sr-only">Alive + Free Client Hub</span>
    </span>
  );
}
