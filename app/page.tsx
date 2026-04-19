import GameCanvasLoader from "@/components/GameCanvasLoader";
import SeasonTint from "@/components/SeasonTint";
import SeasonBadge from "@/components/SeasonBadge";

export default function Home() {
  return (
    <main className="app-shell items-center">
      <SeasonTint />
      <SeasonBadge />
      {/* Lantern glows sit between bg_game.jpg and the canvas (z:1 < z:10).
          Positions are in % so they follow the bg's cover-scaled layout. */}
      <div
        className="lantern-glow"
        style={{ left: "8%", top: "55%", animationDelay: "0s" }}
        aria-hidden
      />
      <div
        className="lantern-glow"
        style={{ right: "8%", top: "53%", animationDelay: "0.8s" }}
        aria-hidden
      />
      <div
        className="lantern-glow"
        style={{ left: "12%", top: "42%", animationDelay: "1.5s" }}
        aria-hidden
      />
      <div
        className="lantern-glow"
        style={{ right: "10%", top: "43%", animationDelay: "2.2s" }}
        aria-hidden
      />
      {/* Firefly mini-glows in tree foliage */}
      <div
        className="firefly-glow"
        style={{ left: "18%", top: "28%", animationDelay: "0s" }}
        aria-hidden
      />
      <div
        className="firefly-glow"
        style={{ right: "22%", top: "32%", animationDelay: "1s" }}
        aria-hidden
      />
      <div
        className="firefly-glow"
        style={{ left: "48%", top: "22%", animationDelay: "2s" }}
        aria-hidden
      />
      <header className="shrink-0 flex flex-col items-center leading-none pt-1 pb-2 relative z-10">
        <h1 className="kami-title text-xl sm:text-4xl font-bold tracking-tight">
          Kami Merge
        </h1>
        <p className="text-xs sm:text-base text-[#c8a84e]/70 font-light mt-1 tracking-[0.3em]">
          神マージ
        </p>
      </header>
      <GameCanvasLoader />
    </main>
  );
}
