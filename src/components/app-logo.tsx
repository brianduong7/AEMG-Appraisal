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
  const isLogin = variant === "login";
  const sizeClass = isLogin
    ? "h-20 w-auto max-w-[420px] sm:h-24 sm:max-w-[520px]"
    : "h-9 w-auto max-w-[140px]";
  const width = isLogin ? 520 : 140;
  const height = isLogin ? 96 : 36;
  const src = isLogin ? "/logos/aife-login.png" : "/logos/aife.png";

  const img = (
    <Image
      src={src}
      alt="Australia Institute of Future Education"
      width={width}
      height={height}
      className={`object-contain object-left ${sizeClass} ${className}`}
      priority={isLogin}
    />
  );

  const mark = isLogin ? (
    <span className="inline-flex items-center rounded-lg bg-white px-1.5 py-1 shadow-md shadow-navy-950/20 ring-1 ring-black/5">
      {img}
    </span>
  ) : (
    img
  );

  if (!href) return mark;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {mark}
    </Link>
  );
}
