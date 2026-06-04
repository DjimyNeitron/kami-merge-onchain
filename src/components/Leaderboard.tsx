"use client";

// Leaderboard — the reusable presentational list (ranks, avatars, own-row
// highlight, "Your rank", new-PB flourish, loading/empty/error states),
// fed by the anon useLeaderboard hook. Shared by two surfaces: the
// game-over scroll panel and the in-game pausable overlay. The section
// header (LEADERBOARD / 番付) is owned by each surface so this stays a
// pure list. Styled to the parchment palette (wood-ink text, gold-700
// accents) so it sits cleanly inside the wood-scroll chrome.

import { useLeaderboard } from "@/hooks/useLeaderboard";

type LeaderboardProps = {
  /** Viewer's Farcaster id — own-row highlight + rank. null in web. */
  fid: number | null;
  /** Player's personal best seeded from the submit response (game-over). */
  seededBest?: number | null;
  /** Show the "new personal best" flourish (game-over only). */
  isNewPersonalBest?: boolean;
};

export default function Leaderboard({
  fid,
  seededBest = null,
  isNewPersonalBest = false,
}: LeaderboardProps) {
  const { topN, myRank, myBest, loading, error } = useLeaderboard(
    fid,
    seededBest,
  );

  if (error) {
    return (
      <div className="kami-serif text-[0.7rem] text-(--wood-light)/60 py-1">
        Leaderboard unavailable
      </div>
    );
  }
  if (loading && topN.length === 0) {
    return (
      <div className="kami-serif text-[0.7rem] text-(--wood-light)/60 py-1">
        Loading…
      </div>
    );
  }
  if (topN.length === 0) {
    return (
      <div className="kami-serif text-[0.7rem] text-(--wood-light)/60 py-1">
        Be the first to score!
      </div>
    );
  }

  return (
    <>
      {isNewPersonalBest && (
        <div className="kami-serif text-[0.7rem] font-bold tracking-(--tracking-wide) text-(--wood-dark) mb-1">
          ★ New personal best! ★
        </div>
      )}
      {myRank != null && (
        <div className="kami-serif text-[0.7rem] text-(--wood-dark)/80 mb-2">
          Your rank: <span className="font-bold">#{myRank}</span>
          {myBest != null && (
            <span className="text-(--wood-light)/60"> · {myBest}</span>
          )}
        </div>
      )}
      <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-0.5">
        {topN.map((entry) => {
          const isMe = fid != null && entry.fid === fid;
          const name = entry.username
            ? `@${entry.username}`
            : entry.displayName ?? `#${entry.fid}`;
          return (
            <div
              key={entry.fid}
              className={`flex items-center gap-2 px-2 py-1 rounded ${
                isMe ? "bg-(--gold-200)/15 border border-(--gold-700)/40" : ""
              }`}
            >
              <span className="kami-serif text-[0.7rem] font-bold text-(--wood-light)/70 w-5 text-right tabular-nums">
                {entry.rank}
              </span>
              {entry.pfpUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.pfpUrl}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-(--wood-light)/20 shrink-0" />
              )}
              <span className="kami-serif text-[0.72rem] text-(--wood-dark) truncate flex-1 text-left">
                {name}
              </span>
              <span className="kami-serif text-[0.72rem] font-bold text-(--wood-dark) tabular-nums">
                {entry.score}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
