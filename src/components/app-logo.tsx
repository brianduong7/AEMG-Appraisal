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
      ? "h-11 w-auto max-w-[180px]"
      : "h-9 w-auto max-w-[140px]";
  const width = variant === "login" ? 180 : 140;
  const height = variant === "login" ? 44 : 36;

  const img = (
    <Image
      src="/logos/aife.png"
      alt="Australia Institute of Future Education"
      width={width}
      height={height}
      className={`object-contain object-left ${sizeClass} ${className}`}
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
