"use client";

// MintCeremony — Stage 3.5d image-backed reveal scene. Same 8-phase
// state machine + timeline + audio cues + dev controls as before; the
// programmatic atmospheric layers (moon halo, magic circle + runes,
// light beam, radial rays, core pulse, lantern glows, stars, torii)
// are replaced by a single Midjourney background image
// (public/ceremony_bg.jpg — a moonlit lotus pond that already carries
// the warm lanterns + cool crescent moon + drifting motes we used to
// fake). A subtle top/bottom vignette overlay keeps the UI text legible.
//
// Bug fixes this stage:
//  • Aurora-always-on: removed the .cardWrapper::after "shine-sweep"
//    teal/violet overlay that held at opacity 0.5 on the revealed card
//    (the real culprit 3.5c missed — NOT the NFTCard holo, which is
//    correctly hidden at rest).
//  • Frame-on-tilt: same ::after was a flat rectangle that didn't tilt
//    with the 3D card; removing it clears the artefact too.
// NFTCard is therefore left completely untouched.
//
// During the spin the silhouette displays the current tier's kanji
// full-card-size; after the land, NFTCard fades in with
// interactive=true so the player can touch-drag for holo + 3D tilt.
//
// NFTCard / yokai.ts / useInventory / ceremonySound / audioManager
// are all consumed read-only.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { parseEventLogs } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";
import NFTCard from "@/components/NFTCard";
import styles from "./MintCeremony.module.css";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";
import { type InventoryNFT } from "@/hooks/useInventory";
import {
  KAMI_NFT_ABI,
  NFT_CONTRACT_ADDRESS,
  SONEIUM_CHAIN_ID,
} from "@/config/contract";
import { walletConnectConnectorId } from "@/lib/wagmi";
import { useMiniAppContext } from "@/hooks/useMiniAppContext";
import { playTick, playChime, playMintSuccess } from "@/lib/ceremonySound";

// True when a chain switch failed because the wallet simply can't do the
// target chain (the Farcaster Wallet has no Soneium 1868 support) — as
// opposed to the user rejecting the switch. Drives the external-wallet
// escape hatch.
function isUnsupportedChainError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("reject") || msg.includes("denied")) return false;
  return (
    msg.includes("unsupported") ||
    msg.includes("unknown") ||
    msg.includes("not configured") ||
    msg.includes("1868")
  );
}

// Map a wallet/tx error into a short, human ceremony message.
function mintErrorMessage(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request")
  ) {
    return "Mint cancelled.";
  }
  if (msg.includes("alreadyminted")) {
    return "You've already bound this kami.";
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient gas")) {
    return "Not enough ETH for gas on Soneium.";
  }
  if (msg.includes("chain") && (msg.includes("match") || msg.includes("switch"))) {
    return "Wrong network — switch to Soneium.";
  }
  return "Mint failed. Please try again.";
}

// Best-effort off-chain record of the mint (links the NFT to the player's
// personal best). Never blocks the ceremony — the NFT is minted on-chain
// regardless of whether this POST lands.
async function recordMint(body: {
  tokenId: number;
  txHash: string;
  typeId: number;
  scoreId: string;
}): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) return;
    const { token } = await sdk.quickAuth.getToken();
    if (!token) return;
    await fetch(`${baseUrl}/functions/v1/confirm-mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn(
      "[mint] confirm-mint record failed (NFT minted on-chain regardless)",
      e,
    );
  }
}

export type CeremonyPhase =
  | "intro"
  | "spinning"
  | "card-materializing"
  | "aurora-rising"
  | "tier-banner"
  | "mint-ready"
  | "minting"
  | "success";

interface MintCeremonyProps {
  yokai: YokaiName;
  tier: Tier;
  score: number;
  /** The player's persisted score row id (from the submit-score response).
   *  Threaded to confirm-mint so the mint binds to their personal best.
   *  null in standalone web / when submit-score didn't run → mint still
   *  works, the off-chain record is just skipped. */
  scoreId?: string | null;
  onMintComplete?: (nft: InventoryNFT) => void;
  onClose?: () => void;
  /** "Visit the Shrine" (success screen). Falls back to onClose if absent. */
  onVisitShrine?: () => void;
  cardWidth?: number;          // default 200 (smaller than PR #37 — scene needs the breathing room)
  soundEnabled?: boolean;
  onPhaseChange?: (phase: CeremonyPhase) => void;
}

// ─── Timing constants (ms) — unchanged from PR #37 ──────────────────
const INTRO_MS = 1500;
const MATERIALIZE_MS = 500;
const AURORA_MS = 600;
const BANNER_MS = 250;
const SUCCESS_HOLD_MS = 2000;

// Spin sequence: [tierIndex, durationMs]. 12 fast cycles, 4
// decelerating steps, then a 500 ms landing on the real tier
// (~2.16 s total).
function buildSpinSequence(target: Tier): Array<[number, number]> {
  const targetIdx = TIER_ORDER.indexOf(target);
  const seq: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) seq.push([i % 4, 70]);
  seq.push([0, 110], [1, 160], [2, 230], [3, 320]);
  seq.push([targetIdx, 500]);
  return seq;
}

const TIER_LABEL: Record<Tier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};
const TIER_KANJI: Record<Tier, string> = {
  common: "大",
  rare: "中",
  epic: "上",
  legendary: "神",
};

// Fireflies — a sparse 8-mote layer of gentle animated parallax over
// the background image. Reduced from 14 (3.5c) because ceremony_bg.jpg
// already carries warm motes of its own; a denser overlay competed
// with the art. Edge-biased so they read against the darker margins.
type FireflyTone = "gold" | "amber";
// prettier-ignore
const FIREFLIES: Array<{ x: number; y: number; size: number; delay: number; tone: FireflyTone }> = [
  { x: 18, y: 22, size: 1.5, delay: 0,   tone: "gold"  }, { x: 82, y: 25, size: 1.3, delay: 0.5, tone: "gold"  },
  { x: 15, y: 38, size: 1.2, delay: 1,   tone: "amber" }, { x: 86, y: 40, size: 1.6, delay: 1.5, tone: "gold"  },
  { x: 22, y: 50, size: 1.1, delay: 2,   tone: "amber" }, { x: 80, y: 53, size: 1.4, delay: 2.5, tone: "gold"  },
  { x: 15, y: 65, size: 1.3, delay: 3,   tone: "amber" }, { x: 85, y: 68, size: 1.2, delay: 3.5, tone: "gold"  },
];

// Sakura gradient defs — rendered once off-screen; the petal variants
// reference them by id (single defs, many refs = valid + cheap).
const SAKURA_DEFS = (
  <svg className={styles.sakuraDefs} aria-hidden="true">
    <defs>
      <linearGradient id="sakuraFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffd4de" /><stop offset="60%" stopColor="#ffb8c8" /><stop offset="100%" stopColor="#ff9ab0" />
      </linearGradient>
      <linearGradient id="sakuraSide" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffc4d6" /><stop offset="100%" stopColor="#ffa0b8" />
      </linearGradient>
    </defs>
  </svg>
);

// 3 petal silhouettes — front (full bloom), side (narrower), edge (thin
// slip). Default preserveAspectRatio keeps each undistorted in the box;
// random per petal so the fall reads as real tumbling blossoms.
const SAKURA_VARIANTS = [
  <svg key="f" viewBox="0 0 16 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 8 1 C 12.5 4, 13 13, 9 19 L 8.5 17 L 8 19 L 7.5 17 L 7 19 C 3 13, 3.5 4, 8 1 Z" fill="url(#sakuraFront)" />
    <path d="M 8 4 C 5.5 7, 5.5 13, 7 17 L 8 16 Z" fill="#ffe8ee" opacity="0.5" />
  </svg>,
  <svg key="s" viewBox="0 0 12 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 6 1 C 9 5, 9.5 14, 7 19 L 6 17 L 5 19 C 2.5 14, 3 5, 6 1 Z" fill="url(#sakuraSide)" />
  </svg>,
  <svg key="e" viewBox="0 0 8 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 4 1 C 5.5 6, 5.5 16, 4 21 C 2.5 16, 2.5 6, 4 1 Z" fill="#ffb0c5" opacity="0.85" />
  </svg>,
];

// One falling petal — randomised position / size / drift / timing.
interface PetalSpec {
  key: string;
  left: number; // %
  topOffset: number; // px below container top
  size: number; // px width
  rotation: number; // deg
  drift: number; // px horizontal drift
  duration: number; // s
  delay: number; // s
  opacityMax: number;
  variant: number; // index into SAKURA_VARIANTS
}

// 3.5h: one petal at a time. delay:0 — petals fall the instant they
// spawn; the natural stagger comes from the spawn interval, not a
// per-petal delay (that was the old "stripes" cause). Unique key via
// timestamp + random suffix so continuous spawns never collide.
function createPetal(): PetalSpec {
  return {
    key: `p${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    left: Math.random() * 100, topOffset: -(20 + Math.random() * 40),
    size: 10 + Math.random() * 10, rotation: Math.random() * 360,
    drift: (Math.random() - 0.5) * 120, duration: 8 + Math.random() * 4,
    delay: 0, opacityMax: 0.55 + Math.random() * 0.35,
    variant: Math.floor(Math.random() * SAKURA_VARIANTS.length),
  };
}

// Phases during which sakura keep spawning (continuous snowfall). On
// exit, existing petals finish their fall and the scene depletes.
const REVEAL_PHASES = new Set<CeremonyPhase>([
  "card-materializing", "aurora-rising", "tier-banner",
  "mint-ready", "minting", "success",
]);

// 3.5g — 12 gold sparkles bursting radially on success. Fixed vectors
// (not Math.random in render) so re-renders during the success phase
// don't make them jump.
const SPARKLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const dist = 90 + (i % 3) * 25;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, delay: i * 0.03 };
});

export default function MintCeremony({
  yokai,
  tier,
  score,
  scoreId = null,
  onMintComplete,
  onClose,
  onVisitShrine,
  cardWidth = 200,
  soundEnabled = true,
  onPhaseChange,
}: MintCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [spinIdx, setSpinIdx] = useState(0);
  const [mintError, setMintError] = useState<string | null>(null);
  // True once the connected (Farcaster) wallet has proven it can't reach
  // Soneium — the CTA switches to the external-wallet "summon" step.
  const [awaitingExternalWallet, setAwaitingExternalWallet] = useState(false);
  // Set on a successful browser-path mint where no Quick Auth was available
  // to record it — surfaces a gentle "open in Farcaster" note.
  const [unrecorded, setUnrecorded] = useState(false);
  const timers = useRef<number[]>([]);

  // On-chain mint wiring. The connected wallet signs; no key in app code.
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { connectAsync, connectors } = useConnect();
  const publicClient = usePublicClient({ chainId: SONEIUM_CHAIN_ID });
  const { isMiniApp } = useMiniAppContext();

  // typeId 0..43 = yokaiIndex * 4 + tierIndex (matches the metadata files
  // and the contract's typeId space).
  const typeId = YOKAI_ORDER.indexOf(yokai) * 4 + TIER_ORDER.indexOf(tier);

  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Mount-driven timeline — identical to PR #37. Replay = remount.
  useEffect(() => {
    const ids = timers.current;
    const at = (fn: () => void, ms: number) => {
      ids.push(window.setTimeout(fn, ms));
    };

    const runSpin = () => {
      const seq = buildSpinSequence(tier);
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(30);
          }
          if (soundRef.current) playChime(tier);
          setPhase("card-materializing");
          at(() => setPhase("aurora-rising"), MATERIALIZE_MS);
          at(() => setPhase("tier-banner"), MATERIALIZE_MS + AURORA_MS);
          at(
            () => setPhase("mint-ready"),
            MATERIALIZE_MS + AURORA_MS + BANNER_MS
          );
          return;
        }
        const [tierIdx, dur] = seq[i];
        setSpinIdx(tierIdx);
        if (soundRef.current) playTick();
        i += 1;
        ids.push(window.setTimeout(step, dur));
      };
      step();
    };

    at(() => {
      setPhase("spinning");
      runSpin();
    }, INTRO_MS);

    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      ids.length = 0;
    };
  }, [tier]);

  // The on-chain mint itself, assuming the active wallet can reach Soneium.
  // Signs `mint(typeId)` on KamiMergeNFT (1868) → waits for the receipt →
  // reads tokenId from the Minted event → best-effort confirm-mint record →
  // advances the ceremony to "success". Shared by the in-host path and the
  // external-wallet path (the connected account differs; everything else is
  // identical — the wallet that signs need not be the Farcaster identity).
  const executeMint = useCallback(async () => {
    setPhase("minting");

    // 1. Sign + send the mint tx (wallet approval happens here).
    let hash: `0x${string}`;
    try {
      hash = await writeContractAsync({
        address: NFT_CONTRACT_ADDRESS,
        abi: KAMI_NFT_ABI,
        functionName: "mint",
        args: [typeId],
        chainId: SONEIUM_CHAIN_ID,
      });
    } catch (e) {
      setMintError(mintErrorMessage(e));
      setPhase("mint-ready");
      return;
    }

    // 2. Wait for the receipt.
    let receipt;
    try {
      receipt = await publicClient!.waitForTransactionReceipt({ hash });
    } catch {
      setMintError("Couldn't confirm the transaction. Check your wallet.");
      setPhase("mint-ready");
      return;
    }
    if (receipt.status !== "success") {
      setMintError("Mint transaction reverted.");
      setPhase("mint-ready");
      return;
    }

    // 3. Read tokenId back from the Minted event.
    let tokenId: bigint | null = null;
    try {
      const events = parseEventLogs({
        abi: KAMI_NFT_ABI,
        logs: receipt.logs,
        eventName: "Minted",
      });
      if (events.length > 0) {
        tokenId = (events[0].args as { tokenId: bigint }).tokenId;
      }
    } catch {
      /* tokenId stays null; success still proceeds off the confirmed tx */
    }

    // 4. Off-chain record (links NFT → personal best). Only possible with a
    //    Quick Auth JWT + a scoreId — i.e. inside a Farcaster host. Outside
    //    it we flag `unrecorded` so the success screen can nudge the player.
    if (tokenId !== null && scoreId && isMiniApp) {
      void recordMint({
        tokenId: Number(tokenId),
        txHash: hash,
        typeId,
        scoreId,
      });
    } else {
      setUnrecorded(true);
    }

    // 5. Advance the ceremony to success (same UX as before).
    if (soundRef.current) playMintSuccess();
    setPhase("success");
    const nft: InventoryNFT = {
      tokenId: tokenId !== null ? tokenId.toString() : hash,
      yokai,
      tier,
      mintedAt: Date.now(),
      score,
    };
    const holdId = window.setTimeout(() => {
      onMintComplete?.(nft);
    }, SUCCESS_HOLD_MS);
    timers.current.push(holdId);
  }, [
    writeContractAsync,
    publicClient,
    typeId,
    scoreId,
    isMiniApp,
    yokai,
    tier,
    score,
    onMintComplete,
  ]);

  // Tap "Bind the spirit": guard the chain, then mint. If the connected
  // wallet can't reach Soneium (the Farcaster Wallet has no 1868 support),
  // surface the external-wallet escape hatch instead of a raw failure.
  const handleMint = useCallback(async () => {
    if (phase !== "mint-ready") return;
    setMintError(null);

    if (!isConnected || !address) {
      setMintError("Connect a wallet to mint.");
      return;
    }

    if (walletChainId !== SONEIUM_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: SONEIUM_CHAIN_ID });
      } catch (e) {
        if (isUnsupportedChainError(e)) {
          setAwaitingExternalWallet(true);
          return;
        }
        setMintError("Switch to Soneium to mint.");
        return;
      }
    }

    await executeMint();
  }, [phase, isConnected, address, walletChainId, switchChainAsync, executeMint]);

  // External-wallet path: connect a Soneium-capable wallet over
  // WalletConnect (QR / mobile deep-link), then run the same mint. Quick
  // Auth identity still comes from the Farcaster host — only the tx signer
  // changes (confirm-mint already binds by fid/scoreId, not tx sender).
  const connectExternalWallet = useCallback(async () => {
    setMintError(null);
    const wc = connectors.find((c) => c.id === walletConnectConnectorId);
    if (!wc) {
      setMintError("No external wallet available.");
      return;
    }
    try {
      await connectAsync({ connector: wc, chainId: SONEIUM_CHAIN_ID });
    } catch (e) {
      setMintError(mintErrorMessage(e));
      return;
    }
    setAwaitingExternalWallet(false);
    await executeMint();
  }, [connectors, connectAsync, executeMint]);

  const handleButton = () => {
    if (phase === "success") (onVisitShrine ?? onClose)?.();
    else void handleMint();
  };

  // Silhouette kanji + tier accent: intro shows the central 神
  // placeholder; once the spin starts the drum-index drives both the
  // kanji glyph and the per-tier border colour via --tier-current.
  const silhouetteTier: Tier =
    phase === "intro" ? "legendary" : TIER_ORDER[spinIdx];
  const silhouetteKanji = TIER_KANJI[silhouetteTier];

  // 3.5h: continuous staggered snowfall. A 6-petal burst the instant the
  // card materialises (immediate presence), then one new petal every
  // 450 ms while in a reveal phase, capped at 25 live at once. Each
  // petal removes itself on animationend (removePetal). A Replay
  // remounts the component, so the list resets to [] automatically.
  const [petals, setPetals] = useState<PetalSpec[]>([]);
  useEffect(() => {
    if (phase === "card-materializing") {
      setPetals((prev) => [...prev, ...Array.from({ length: 6 }, () => createPetal())]);
    }
  }, [phase]);
  useEffect(() => {
    if (!REVEAL_PHASES.has(phase)) return;
    const id = window.setInterval(() => {
      setPetals((prev) => (prev.length >= 25 ? prev : [...prev, createPetal()]));
    }, 450);
    return () => window.clearInterval(id);
  }, [phase]);
  const removePetal = useCallback((key: string) => {
    setPetals((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const silhouetteStyle = {
    ["--tier-current"]: `var(--tier-${silhouetteTier})`,
  } as React.CSSProperties;
  const tierBannerStyle = {
    ["--tier-current"]: `var(--tier-${tier})`,
  } as React.CSSProperties;

  return (
    <div className={styles.ceremonyScene} data-phase={phase}>
      {/* 1 — Midjourney background image + legibility vignette */}
      <div className={styles.bgImage} aria-hidden="true" />
      <div className={styles.bgOverlay} aria-hidden="true" />

      {/* 10a — card silhouette during intro + spinning */}
      <div
        className={styles.cardSilhouette}
        style={{ ...silhouetteStyle, width: cardWidth }}
      >
        <span className={styles.silhouetteKanji}>{silhouetteKanji}</span>
      </div>

      {/* 10b — revealed NFTCard (interactive — touch tilt + holo) */}
      <div
        className={styles.cardWrapper}
        style={{ width: cardWidth, ["--card-width"]: `${cardWidth}px` } as React.CSSProperties}
      >
        <NFTCard
          yokai={yokai}
          tier={tier}
          width={cardWidth}
          interactive={true}
        />
      </div>

      {/* 10c — success celebration: breathing aura (behind card) +
          one-shot flash + radial burst + 4 continuous drifting sparkles */}
      {phase === "success" && (
        <>
          <div className={styles.successAura} aria-hidden="true" />
          <div className={styles.successFlash} aria-hidden="true" />
          <div className={styles.sparkleContainer} aria-hidden="true">
            {SPARKLES.map((s, i) => (
              <div key={i} className={styles.sparkle}
                style={{ ["--end-x"]: `${s.x}px`, ["--end-y"]: `${s.y}px`, ["--delay"]: `${s.delay}s` } as React.CSSProperties} />
            ))}
          </div>
          <div className={styles.driftingSparkles} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.driftingSparkle}
                style={{ ["--delay"]: `${i * 1.2}s`, ["--start-x"]: `${20 + (i % 2) * 60}%`, ["--start-y"]: `${30 + Math.floor(i / 2) * 30}%` } as React.CSSProperties} />
            ))}
          </div>
        </>
      )}

      {/* 11a — sakura petals (state-driven; each self-removes on end) */}
      {SAKURA_DEFS}
      <div className={styles.sakuraContainer} aria-hidden="true">
        {petals.map((p) => (
          <PetalEl key={p.key} p={p} onDone={() => removePetal(p.key)} />
        ))}
      </div>

      {/* 11b — 8 warm fireflies (gold + amber tones) over the image */}
      <div className={styles.firefliesContainer} aria-hidden="true">
        {FIREFLIES.map((f, i) => {
          const gold = f.tone === "gold";
          return (
            <div key={i} className={styles.firefly}
              style={{ left: `${f.x}%`, top: `${f.y}%`, ["--size"]: `${f.size}`, animationDelay: `${f.delay}s` } as React.CSSProperties}>
              <div className={`${styles.fireflyHalo} ${gold ? styles.fireflyHaloGold : styles.fireflyHaloAmber}`} />
              <div className={`${styles.fireflyCore} ${gold ? styles.fireflyCoreGold : styles.fireflyCoreAmber}`} />
            </div>
          );
        })}
      </div>

      {/* 12a — header. Evolves on success ("Your kami / 守護神") and dims
          (via [data-phase="success"]) so the card becomes the hero. */}
      <div className={styles.headerContainer}>
        <div className={styles.headerRunComplete}>
          {phase === "success" ? "Your kami" : "Run complete"}
        </div>
        <div className={styles.headerRunCompleteJp}>
          {phase === "success" ? "守護神" : "完了"}
        </div>
        <div className={styles.headerScore}>
          {phase === "success"
            ? `✦ ${score.toLocaleString()}`
            : `Score ${score.toLocaleString()}`}
        </div>
      </div>

      {/* 12a′ — anticipation subtitle (intro + spinning only) */}
      {(phase === "intro" || phase === "spinning") && (
        <div className={styles.anticipationText}>
          Calling forth your spirit
          <span className={styles.anticipationJp}>魂を呼ぶ</span>
        </div>
      )}

      {/* 12b — tier banner (─ 上 EPIC ─). Unmounted on success so it
          can't crossfade against the inline success banner at the same
          slot — the success banner takes over cleanly. */}
      {phase !== "success" && (
        <div className={styles.tierBanner} style={tierBannerStyle}>
          <div className={styles.tierBannerDash} />
          <span className={styles.tierBannerKanji}>{TIER_KANJI[tier]}</span>
          <span className={styles.tierBannerText}>{TIER_LABEL[tier]}</span>
          <div className={styles.tierBannerDash} />
        </div>
      )}

      {/* 12c — action button. Primary heavy wood button before mint;
          a light ghost button (secondary, no urgency) on success. */}
      <div className={styles.mintButtonContainer}>
        {phase === "success" ? (
          <>
            <button type="button" className={`btn-ghost ${styles.ghostBtn}`} onClick={handleButton}>
              Visit the Shrine
            </button>
            {unrecorded && (
              <p className={styles.mintSub}>
                Minted on-chain — open in Farcaster to record it to your shrine.
              </p>
            )}
          </>
        ) : awaitingExternalWallet ? (
          // The Farcaster Wallet can't reach Soneium — route the mint
          // through an external wallet via WalletConnect.
          <>
            <p className={styles.mintSub}>
              Your Farcaster wallet doesn&apos;t speak Soneium — summon an
              external wallet to bind this kami.
            </p>
            <button
              type="button"
              className={`btn-on-dark ${styles.mintButton}`}
              onClick={() => void connectExternalWallet()}
            >
              Summon an external wallet
            </button>
            <p className={styles.mintSubJp}>外の財布を招く</p>
            {mintError && (
              <p className={styles.mintError} role="alert">
                {mintError}
              </p>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className={`btn-on-dark ${styles.mintButton}`}
              onClick={handleButton}
              disabled={phase === "minting"}
            >
              {phase === "minting" ? (
                <>
                  <span className={styles.spinner} />
                  鋳造中…
                </>
              ) : (
                "Bind the spirit"
              )}
            </button>
            <p className={styles.mintSub}>A blessing — only the network fee</p>
            <p className={styles.mintSubJp}>御祭 · 無料</p>
            {mintError && (
              <p className={styles.mintError} role="alert">
                {mintError}
              </p>
            )}
          </>
        )}
      </div>

      {/* 12d — success banner: inline, replaces the tier banner in-place
          on success (no top-overlay that could cover the card). */}
      {phase === "success" && (
        <div className={styles.successBannerInline}>
          <div className={styles.successKanjiInline}>完</div>
          <div className={styles.successTextInline}>Blessing received</div>
        </div>
      )}
    </div>
  );
}

// 3.5g — two nested elements decouple the motion so the descent is a
// pure linear translateY (no "staircase" from uneven keyframe Y deltas):
//   • outer .petal  — vertical fall only (finite, forwards).
//   • inner .petalInner — horizontal sine drift + gentle wobble (both
//     infinite, independent periods → organic, non-repeating motion).
// onAnimationEnd fires only from the outer's finite fall (the inner's
// infinite animations never end); the target===currentTarget guard
// ignores any event bubbling up from the inner.
function PetalEl({ p, onDone }: { p: PetalSpec; onDone: () => void }) {
  const outer = {
    left: `${p.left}%`, top: `${p.topOffset}px`,
    ["--size"]: `${p.size}px`, ["--duration"]: `${p.duration}s`,
    ["--delay"]: `${p.delay}s`, ["--opacity-max"]: `${p.opacityMax}`,
  } as React.CSSProperties;
  const inner = {
    ["--drift"]: `${p.drift}px`, ["--rotation-start"]: `${p.rotation}deg`,
    ["--drift-duration"]: `${(p.duration * 0.4).toFixed(2)}s`,
    ["--wobble-duration"]: `${(p.duration * 0.5).toFixed(2)}s`,
  } as React.CSSProperties;
  return (
    <div
      className={styles.petal}
      style={outer}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
    >
      <div className={styles.petalInner} style={inner}>
        {SAKURA_VARIANTS[p.variant]}
      </div>
    </div>
  );
}
