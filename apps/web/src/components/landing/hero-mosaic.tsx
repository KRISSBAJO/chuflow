"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { unsplash } from "./landing-images";

type Photo = { id: string; alt: string };

const TILES: {
  caption: string;
  photos: Photo[];
  size: string;
  tilt: number;
  lift: number;
  drift: number;
  depth: number;
  from: string;
}[] = [
  {
    caption: "Sanctuary",
    size: "lp-tile-outer",
    tilt: -7,
    lift: 70,
    drift: 1.6,
    depth: 1.5,
    from: "250%",
    photos: [
      { id: "1604072424771-7300bc5de457", alt: "A mother and son sitting together in the church pews" },
      { id: "1661332625333-1e3defc5dcc4", alt: "A Nigerian church building with a tall white tower" },
      { id: "1542296120-cd8d3eb196d5", alt: "A young man reading his Bible beneath a lit cross" },
    ],
  },
  {
    caption: "Community",
    size: "lp-tile-inner",
    tilt: -3.5,
    lift: 28,
    drift: 1,
    depth: 1,
    from: "120%",
    photos: [
      { id: "1778824717521-a23599f32d71", alt: "Young church members laughing together with their Bibles" },
      { id: "1560251445-ba979d304eb9", alt: "A gospel choir in red and gold robes" },
      { id: "1517486808906-6ca8b3f04846", alt: "Young adults from a church community smiling together" },
    ],
  },
  {
    caption: "Worship",
    size: "lp-tile-center",
    tilt: 0,
    lift: 0,
    drift: 0.4,
    depth: 0.6,
    from: "0%",
    photos: [
      { id: "1473177104440-ffee2f376098", alt: "White arches inside a church" },
      { id: "1791357775814-24088f555824", alt: "A father lifting his child as the congregation worships with raised hands" },
      { id: "1647957902647-0337913440fc", alt: "A worship leader in African print singing into a microphone" },
      { id: "1626956016065-9d3e22d1390b", alt: "A pastor preaching during a church service" },
    ],
  },
  {
    caption: "Fellowship",
    size: "lp-tile-inner",
    tilt: 3.5,
    lift: 28,
    drift: 1,
    depth: 1,
    from: "-120%",
    photos: [
      { id: "1739301674016-45dddb02e2dd", alt: "Three women reading the Bible together" },
      { id: "1658356788072-ecd83ab24e33", alt: "A congregation raising their hands in worship" },
      { id: "1614317354806-860a3bf79069", alt: "Church members dressed for Sunday service" },
      { id: "1543269865-cbf427effbad", alt: "Friends talking and laughing around a table" },
    ],
  },
  {
    caption: "Family",
    size: "lp-tile-outer",
    tilt: 7,
    lift: 70,
    drift: 1.6,
    depth: 1.5,
    from: "-250%",
    photos: [
      { id: "1681936489137-cd9af7055814", alt: "A family with their children in front of a stained glass window" },
      { id: "1585144374720-64d181405b1c", alt: "A young family sitting together at church" },
    ],
  },
];

/** Order in which frames change photo: from the centre outwards, so the fan ripples. */
const CYCLE_ORDER = [2, 1, 3, 0, 4];
const CYCLE_MS = 2300;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

function TilePhotos({ tile, index, active, previous, preloadNext }: {
  tile: (typeof TILES)[number];
  index: number;
  active: number;
  previous: number | null;
  preloadNext: boolean;
}) {
  const next = (active + 1) % tile.photos.length;
  const layers = [
    ...(previous !== null && previous !== active ? [{ photo: previous, role: "previous" }] : []),
    { photo: active, role: "active" },
    ...(preloadNext ? [{ photo: next, role: "next" }] : []),
  ];

  return (
    <div className="lp-tile-photo">
      {layers.map(({ photo, role }) => (
        <div
          key={`${photo}-${role === "next" ? "next" : "shown"}`}
          className={`lp-tile-layer ${role === "active" && previous !== null ? "lp-tile-layer-in" : ""} ${role === "next" ? "opacity-0" : ""}`}
          style={{ zIndex: role === "active" ? 2 : 1 }}
        >
          <Image
            src={unsplash(tile.photos[photo].id, 760)}
            alt={role === "active" ? tile.photos[photo].alt : ""}
            fill
            unoptimized
            preload={index === 2 && photo === 0}
            sizes="25vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Five living photo frames dealt out from a stack, tilted in 3D by the pointer and opened up by scroll.
 * One rAF loop writes --mx, --my (pointer, -1..1) and --p (scroll, 0..1) onto the container.
 */
export function HeroMosaic() {
  const ref = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState(() => TILES.map(() => ({ active: 0, previous: null as number | null })));
  const [ready, setReady] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0, p: 0 };
    let lastPointer = 0;
    let visible = true;
    let frame = 0;

    const onPointer = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
      lastPointer = performance.now();
    };

    const tick = (now: number) => {
      frame = 0;
      // Without a recent mouse (touch screens, idle), drift on a slow figure-eight so it never sits still.
      if (now - lastPointer > 2500) {
        target.x = Math.sin(now / 2600) * 0.35;
        target.y = Math.sin(now / 1900) * 0.2;
      }
      const rect = node.getBoundingClientRect();
      const scroll = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));

      current.x = lerp(current.x, target.x, 0.07);
      current.y = lerp(current.y, target.y, 0.07);
      current.p = lerp(current.p, scroll, 0.18);

      node.style.setProperty("--mx", current.x.toFixed(4));
      node.style.setProperty("--my", current.y.toFixed(4));
      node.style.setProperty("--p", current.p.toFixed(4));

      if (visible) frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      pausedRef.current = !visible;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    window.addEventListener("pointermove", onPointer, { passive: true });
    frame = requestAnimationFrame(tick);

    // Living photos start once the deal-out entrance has finished.
    let step = 0;
    let cycle = 0;
    const start = window.setTimeout(() => {
      setReady(true);
      cycle = window.setInterval(() => {
        if (pausedRef.current || document.hidden) return;
        const tileIndex = CYCLE_ORDER[step % CYCLE_ORDER.length];
        step += 1;
        setSlides((currentSlides) =>
          currentSlides.map((slide, index) =>
            index === tileIndex
              ? { previous: slide.active, active: (slide.active + 1) % TILES[index].photos.length }
              : slide,
          ),
        );
      }, CYCLE_MS);
    }, 2600);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.clearTimeout(start);
      window.clearInterval(cycle);
    };
  }, []);

  const onTileMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--hx", (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    event.currentTarget.style.setProperty("--hy", (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  };

  const onTileLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--hx", "0");
    event.currentTarget.style.setProperty("--hy", "0");
  };

  return (
    <div
      ref={ref}
      className="lp-mosaic relative mt-16 pb-10 sm:mt-24"
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div aria-hidden className="lp-mosaic-glow" />
      <div aria-hidden className="lp-mosaic-burst" />

      <svg
        viewBox="0 0 1440 360"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-[34%] h-[50%] w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id="lp-ribbon" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
            <stop offset="18%" stopColor="#f59e0b" />
            <stop offset="60%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </linearGradient>
          <filter id="lp-comet-glow" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M0 250 C 240 330, 380 60, 620 150 S 980 330, 1180 160 S 1380 90, 1440 120"
          fill="none"
          stroke="url(#lp-ribbon)"
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={1}
          className="lp-ribbon lp-mosaic-ribbon"
        />
        <path
          d="M0 250 C 240 330, 380 60, 620 150 S 980 330, 1180 160 S 1380 90, 1440 120"
          fill="none"
          stroke="#fb923c"
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          filter="url(#lp-comet-glow)"
          className="lp-comet"
        />
      </svg>

      <div className="lp-mosaic-stage relative mx-auto flex max-w-[1320px] items-end justify-center gap-3 px-4 sm:gap-5">
        {TILES.map((tile, index) => {
          const order = Math.abs(index - 2);
          return (
            <div
              key={tile.caption}
              className={`lp-tile relative shrink-0 ${tile.size}`}
              onPointerMove={onTileMove}
              onPointerLeave={onTileLeave}
              style={
                {
                  "--tilt": tile.tilt,
                  "--lift": tile.lift,
                  "--drift": tile.drift,
                  "--depth": tile.depth,
                  "--from": tile.from,
                  "--deal-delay": `${450 + order * 140}ms`,
                  "--bob-delay": `${-index * 1.3}s`,
                  "--bob-duration": `${6 + order * 1.2}s`,
                  zIndex: 10 - order,
                } as CSSProperties
              }
            >
              <div className="lp-tile-deal h-full w-full">
                <div className="lp-tile-bob h-full w-full">
                  <div className="lp-tile-motion h-full w-full">
                    <div className="lp-tile-card">
                      <TilePhotos
                        tile={tile}
                        index={index}
                        active={slides[index].active}
                        previous={slides[index].previous}
                        preloadNext={ready}
                      />
                      <div aria-hidden className="lp-tile-glare" />
                      <span className="lp-tile-caption">{tile.caption}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
