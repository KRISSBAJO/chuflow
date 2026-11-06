import Image from "next/image";
export function ChildrenPortrait({
  url,
  name,
}: {
  url?: string;
  name: string;
}) {
  return url ? (
    <Image
      src={url}
      width={56}
      height={56}
      unoptimized
      referrerPolicy="no-referrer"
      alt={`Photograph of ${name}`}
      className="h-14 w-14 shrink-0 rounded-2xl object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4e7ca] text-lg font-bold text-[#775c32]"
    >
      {name.slice(0, 1)}
    </span>
  );
}
