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
  const height = variant === "login" ? 48 : 32;
  const width = variant === "login" ? 220 : 140;

  const img = (
    <Image
      src="/logos/aife.png"
      alt="Australia Institute of Future Education"
      width={width}
      height={height}
      className={`h-auto w-auto rounded-md object-contain ${className}`}
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
