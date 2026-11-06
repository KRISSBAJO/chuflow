import Image from "next/image";
export function ChildrenWelcome({
  title = "Little people. A big welcome.",
  description = "A joyful place to belong. A clear way to care for every child.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="children-hero">
      <div className="children-hero-copy">
        <p className="children-kicker mb-4">ChuFlow Kids</p>
        <h1 className="children-title">{title}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#5e6b59]">
          {description}
        </p>
        <div className="mt-6 flex gap-2">
          <span className="children-badge">Welcome</span>
          <span className="children-badge">Belong</span>
          <span className="children-badge">Grow</span>
        </div>
      </div>
      <Image
        src="/children/welcome.png"
        width={1752}
        height={896}
        alt="Children welcomed into a bright, friendly classroom"
        priority
      />
    </section>
  );
}
