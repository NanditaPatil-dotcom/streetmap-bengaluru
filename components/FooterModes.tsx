"use client";

type Props = {
  modeEnabled: boolean;
  setModeEnabled: (enabled: boolean) => void;
  mode: string;
  setMode: (mode: string) => void;
};

export default function FooterModes({
  modeEnabled,
  setModeEnabled,
  mode,
  setMode,
}: Props) {
  const modes = ["morning", "noon", "evening", "night"];

  return (
    <div className="pointer-events-none absolute bottom-7 left-1/2 z-[1000] w-full max-w-[calc(100%-1.5rem)] -translate-x-1/2 px-1 md:left-[62.5%] md:w-[calc(75%-2rem)] md:max-w-[40rem]">
      <div className="pointer-events-auto grid grid-cols-1 gap-2 rounded-[2rem] bg-[#222222] px-3 py-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-black/10 backdrop-blur sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <button
          type="button"
          onClick={() => setModeEnabled(!modeEnabled)}
          className="flex items-center justify-center rounded-full px-3 py-2 transition hover:bg-white/15"
          aria-pressed={modeEnabled}
          aria-label={`Mode ${modeEnabled ? "on" : "off"}`}
        >
          <span
            className={`relative h-6 w-11 rounded-full transition ${
              modeEnabled ? "bg-white" : "bg-white/25"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#111111] transition ${
                modeEnabled ? "left-[1.35rem]" : "left-0.5"
              }`}
            />
          </span>
        </button>

        <div>
          <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            Refine by time
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={!modeEnabled}
                className={`rounded-full px-4 py-1.5 text-sm font-medium tracking-tight transition ${
                  modeEnabled && mode === m
                    ? "bg-white text-[#111111]"
                    : "text-white/78 hover:bg-white/10 hover:text-white"
                } ${!modeEnabled ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-white/78" : ""}`}
                aria-pressed={modeEnabled && mode === m}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:block" />
      </div>
    </div>
  );
}
