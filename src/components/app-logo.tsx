import Image from "next/image";
import Link from "next/link";

type AppLogoProps = {
  href?: string;
  /** "header" = compact nav bar; "login" = larger on auth screen */
  variant?: "header" | "login";
  className?: string;
};

export function AppLogo({
  href = "/",
  variant = "header",
  className = "",
}: AppLogoProps) {
  const sizeClass =
    variant === "login"
      ? "h-10 w-auto max-w-[165px]"
      : "h-7 w-auto max-w-[108px]";
  const width = variant === "login" ? 165 : 108;
  const height = variant === "login" ? 40 : 28;

  const img = (
    <Image
      src="/logos/aife.png"
      alt="Australia Institute of Future Education"
      width={width}
      height={height}
      className={`rounded-md object-contain object-left ${sizeClass} ${className}`}
      priority={variant === "login"}
    />
  );

  if (!href) return img;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  );
}
