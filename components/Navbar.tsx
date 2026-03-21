"use client";

import { signOut, useSession } from "next-auth/react";

type Props = {
  mapType: string;
  setMapType: (type: string) => void;
  onOpenAuth: () => void;
};

export default function Navbar({ mapType, setMapType, onOpenAuth }: Props) {
  const { data: session, status } = useSession();
  const types = [
    { value: "normal", label: "Explore" },
    { value: "cafe", label: "Cafe" },
    { value: "metro", label: "Metro" },
    { value: "park", label: "Park" },
    { value: "bmtc", label: "BMTC" },
  ];

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] max-w-[calc(100%-1.5rem)] -translate-x-1/2 px-1 md:left-[62.5%] md:w-[calc(75%-2rem)] md:max-w-[40rem]">
      <div className="pointer-events-auto flex flex-col gap-2 rounded-[2rem] bg-[#222222]/95 px-3 py-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center justify-start gap-1.5 sm:flex-1">
          {types.map((type) => (
            <button
              key={type.value}
              onClick={() => setMapType(type.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium tracking-tight transition ${
                mapType === type.value
                  ? "bg-white text-[#111111]"
                  : "text-white/78 hover:bg-white/10 hover:text-white"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 sm:shrink-0">
          {status === "authenticated" && session.user ? (
            <>
              <span className="hidden text-sm text-white/72 md:inline">
                Hi, {session.user.name?.split(" ")[0] || "Explorer"}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-full bg-[#f4f0e8] px-4 py-1.5 text-sm font-medium text-[#111111] transition hover:scale-[1.02]"
            >
              {status === "loading" ? "Loading..." : "Sign in"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
