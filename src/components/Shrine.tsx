"use client";

// Shrine — full-screen collection gallery overlay. Shows all 44 NFTs
// (11 yokai × 4 tiers) in a YOKAI_ORDER × TIER_ORDER matrix with
// owned/locked states read on-chain (useOwnedTypeIds), an "X / 44
// collected" counter, and a tap-to-zoom detail view. Reuses the
// ceremony background + a #0F1626 scrim (not the parchment skin).

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import NFTCard from "@/components/NFTCard";
import {
  YOKAI_ORDER,
  TIER_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";
import { useOwnedTypeIds } from "@/hooks/useOwnedTypeIds";
import { chainName } from "@/config/chains";
import styles from "./Shrine.module.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const typeIdOf = (yi: number, ti: number) => yi * 4 + ti;

type Selected = { yokai: YokaiName; tier: Tier; typeId: number };

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M6 6 L18 18 M18 6 L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <rect
        x="5"
        y="10.5"
        width="14"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Shrine({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { ownedTypeIds, ownedCount, isLoading, hasAddress, chainsFor } =
    useOwnedTypeIds(address);
  const { openConnectModal } = useConnectModal();
  const [selected, setSelected] = useState<Selected | null>(null);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-label="The Shrine — your kami collection"
    >
      <div className={styles.scrim} aria-hidden="true" />

      <header className={styles.header}>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close shrine"
        >
          <CloseIcon />
        </button>
        <h2 className={`kami-title ${styles.title}`}>The Shrine</h2>
        <p className={styles.counter}>
          {isLoading ? "…" : ownedCount} / 44 collected
        </p>
        {!hasAddress && (
          <div className={styles.connectRow}>
            <p className={styles.connectHint}>
              Connect your wallet to reveal your collection
            </p>
            {openConnectModal && (
              <button
                type="button"
                className={`btn-on-dark ${styles.connectBtn}`}
                onClick={openConnectModal}
              >
                Connect Wallet
              </button>
            )}
          </div>
        )}
        <div className={styles.tierHeaders} aria-hidden="true">
          {TIER_ORDER.map((t) => (
            <span key={t} className={styles.tierHeader}>
              {cap(t)}
            </span>
          ))}
        </div>
      </header>

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          {YOKAI_ORDER.map((yokai, yi) =>
            TIER_ORDER.map((tier, ti) => {
              const typeId = typeIdOf(yi, ti);
              const owned = ownedTypeIds.has(typeId);
              return (
                <button
                  type="button"
                  key={typeId}
                  className={`${styles.cell} ${owned ? styles.owned : styles.locked}`}
                  onClick={() => setSelected({ yokai, tier, typeId })}
                  aria-label={`${cap(yokai)} ${cap(tier)}${owned ? "" : " — locked"}`}
                >
                  <NFTCard
                    yokai={yokai}
                    tier={tier}
                    interactive={false}
                    className={styles.cardFill}
                  />
                  {owned && (
                    <span className={styles.chainBadges} aria-hidden="true">
                      {chainsFor(typeId).map((cid) => (
                        <span
                          key={cid}
                          className={styles.chainBadge}
                          title={chainName(cid)}
                        >
                          {chainName(cid).charAt(0)}
                        </span>
                      ))}
                    </span>
                  )}
                  {!owned && (
                    <span className={styles.lock} aria-hidden="true">
                      <LockIcon />
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {selected && (
        <ShrineDetail
          yokai={selected.yokai}
          tier={selected.tier}
          owned={ownedTypeIds.has(selected.typeId)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ShrineDetail({
  yokai,
  tier,
  owned,
  onClose,
}: {
  yokai: YokaiName;
  tier: Tier;
  owned: boolean;
  onClose: () => void;
}) {
  // Escape closes the zoom.
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className={styles.detail}
      role="dialog"
      aria-label={`${cap(yokai)} ${cap(tier)}`}
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
      >
        <CloseIcon />
      </button>
      <div
        className={styles.detailCard}
        onClick={(e) => e.stopPropagation()}
      >
        {owned ? (
          <NFTCard yokai={yokai} tier={tier} interactive={true} />
        ) : (
          <div className={styles.detailLockedWrap}>
            <NFTCard
              yokai={yokai}
              tier={tier}
              interactive={false}
              className={styles.cardFillLocked}
            />
            <span className={styles.detailLock} aria-hidden="true">
              <LockIcon />
            </span>
          </div>
        )}
        <p
          className={`kami-serif ${styles.detailBadge} ${
            owned ? styles.badgeOwned : styles.badgeLocked
          }`}
        >
          {owned ? "Owned" : "Locked"}
        </p>
        <p className={`kami-serif ${styles.detailSubtitle}`}>
          {cap(yokai)} · {cap(tier)}
        </p>
      </div>
    </div>
  );
}
