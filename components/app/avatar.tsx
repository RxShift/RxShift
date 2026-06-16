// Rounded-square (1:1) avatar — a photo when present, initials otherwise.
// Square-with-rounded-corners matches the rest of the UI (softer than a circle).

export default function Avatar({
  url,
  name,
  size = 32,
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-cloud font-brand font-bold text-steel"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          width={size}
          height={size}
        />
      ) : (
        initials
      )}
    </span>
  );
}
