type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  xs: "w-10 h-10 text-base",
  sm: "w-14 h-14 text-lg",
  md: "w-16 h-16 text-xl",
  lg: "w-24 h-24 text-3xl",
  xl: "w-32 h-32 text-4xl",
};

export default function CompanyLogo({
  src,
  name,
  size = "md",
  rounded = "md",
  className = "",
}: {
  src: string | null | undefined;
  name: string;
  size?: Size;
  rounded?: "md" | "lg";
  className?: string;
}) {
  const sizeCls = SIZE_MAP[size];
  const radius = rounded === "lg" ? "rounded-lg" : "rounded-md";
  const base = `${sizeCls} ${radius} bg-white border border-line shrink-0 ${className}`;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${base} object-contain p-1.5`}
      />
    );
  }
  return (
    <div
      className={`${base} flex items-center justify-center text-slate-400 font-semibold`}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
