export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="CREATE Cluster"
      className={`h-12 w-12 object-contain ${className}`}
    />
  );
}
