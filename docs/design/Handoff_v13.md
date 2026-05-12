# Kami Merge — Handoff v13

**Date:** May 11, 2026 (late session, ~22:30 UTC+3)
**Phase:** Design complete → Implementation begins
**Next milestone:** Stage 3.3 NFTCard.tsx
**Supersedes:** Handoff v11 (Phase 3D context) + Handoff v12 (NFT art finalization)
**Companion docs:** `kami_merge_design_brief_v13.md` (design locks) + `kami_merge_nft_lore.md` (NFT descriptions)

---

## КТО / WHO

**Kody** — соло-разработчик, France-based. Стек: Next.js 16, TypeScript, Matter.js, Web Audio, wagmi/RainbowKit/Farcaster SDK. Опыт Web3, нет prior game design experience. Предпочитает data-driven decisions, single copy-paste CC prompts, scannable responses с tables. Communicates RU primary, EN для code/docs. Использует Cloudflare WARP для доступа к Vercel из ISP-blocked location.

**Project context:**
- **Kami Merge** (神マージ) — Suika-style yokai merge puzzle на Soneium L2
- Built как Farcaster Mini App + standalone web
- Targeting Startale Superstars ($250K) + Soneium For All ($60K+) grants
- Solo development, public GitHub, ~60+ commits

---

## ЧТО ПРОИЗОШЛО В ЭТОЙ СЕССИИ (2026-05-11)

### Часть 1 — Bug fixes (production blockers)

| Bug | Symptom | Root cause | Fix | PR |
|---|---|---|---|---|
| **#1 Critical** | Splash застрял на "Loading..." в MetaMask Browser, Connect Wallet никогда не появлялся | `sdk.context` promise hangs в non-Farcaster webview (no postMessage response) — `isReady` остаётся `false` навсегда | `Promise.race` с 1500ms timeout — fallback к standalone mode | #12 merged |
| **#2 Medium** | HUD (Score/High/Next/Restart) visible через splash на каждый reload | `animate-splash-fade` class на root div делал opacity 0→1 (включая bg backdrop) за 400ms — HUD просвечивал | Удалить класс из root, splash mounts at full opacity instantly | #14 merged |
| **#3 Medium** | Тёмный сфера-силуэт между h1 title и yokai chain во время splash | Same root cause as #2 — Matter.js spawned kodama виден через transparent splash window | Same fix как #2 | #14 merged |
| **#4 Low** | Disconnect button внутри Farcaster Mini App вызывает confusing "loading host wallet" → reload → auto-reconnect cycle | SDK ограничение — нельзя disconnect от host wallet находясь в Mini App | Conditional render `!inMiniApp` для button | #13 merged |
| **Bonus** | Не было способа дебажить iPhone webview console (MetaMask not visible в Safari Web Inspector) | Apple platform restriction на third-party app webviews | Added eruda dev console gated by `?debug=1` URL param | #11 merged |

**Diagnostic discovery process:**
1. Kody подключил eruda через `?debug=1`
2. Console показал: `isMiniApp: false, miniAppReady: false, probing: true` — застрял в probing state
3. Идентифицирован как Failure Point #3 из Handoff v11 ("sdk.context может зависнуть")
4. Fix через `Promise.race` против 1500ms timeout

**Verification (от Kody, screenshots):**
- iPhone MetaMask Browser → Connect Wallet работает
- `MetaMask: Connected to chain with ID "0x74c"` (0x74c = 1868 = Soneium ✓)
- `actualChainId: 1868`, `isConnected: true`, `isValidSession: true`

### Часть 2 — Design sessions A-F (full strategic pass)

Прошли через **полный strategic audit** всех еще-неопределенных aspects проекта. См. **Design Brief v13** для полных deliverables.

| Session | Topic | Status |
|---|---|---|
| **A** | NFT economics + score ladder | ✅ Locked (recalibrated drop matrix, 44-cap, tradeable) |
| **B** | Metadata schema (attributes, lore, royalties) | ✅ Locked (7 traits, 11 base lores + 4 tier flavors) |
| **C** | Onboarding flow | ✅ Locked (hybrid splash hint + first-game tutorial + 5-section Help modal) |
| **D** | Share / viral hooks | ✅ Locked (cast/tweet templates, client canvas image gen, simple referrals) |
| **E** | Backend / anti-cheat | ✅ Locked (heuristic + EIP-712 signed authorization, Supabase leaderboard, rate limits) |
| **F** | Grant submission package | ✅ Locked (60-sec demo video script, Twitter strategy, narrative, 5-6 week timeline) |

**Critical revisions from prior locked decisions:**

1. **Drop probability matrix rebalanced** — старые brackets (0-200/200-1k/1k-3k/3k-8k/8k+) с Legendary cap 30% punished skilled players. New Option B brackets (0-500/500-1.5k/1.5k-3k/3k-5k/5k+) с Legendary up to 55% at top tier.

2. **Per-wallet cap added** — was undefined. Locked: 1 per yokai-tier per wallet (44 max collection per wallet).

3. **Soulbound vs tradeable decided** — was undefined. Locked: tradeable (ERC-721) для OpenSea visibility.

4. **Royalties locked** — 2.5% (ERC-2981) → developer wallet.

5. **Help modal expanded** — было 4 sections, теперь 5 (added Yokai Chain section для educational depth).

6. **Onboarding tutorial added** — было не в v11/v12 spec. Locked: 3-screen modal at first game-over.

---

## CODE STATE

**Repo:** https://github.com/DjimyNeitron/kami-merge-onchain
**Local path:** `/Users/meverik/Pictures/my game/kami-merge`
**Branch:** `main`
**Latest commit:** `f3b1eb5` (PR #14 merged — animate-fade removal)
**Deploy:** https://kami-merge.vercel.app (auto-deploys from main)
**Team:** djimyneitrons-projects (Vercel)

### Recent PR history (this session)

| PR # | Title | Merged |
|---|---|---|
| #11 | feat: `?debug=1` gated eruda console for mobile webview debug | ✅ |
| #12 | fix(wallet): timeout sdk.context to unstick non-Farcaster webviews | ✅ |
| #13 | fix(splash): hide Disconnect button inside Farcaster Mini App | ✅ |
| #14 | fix(splash): remove mount fade-in window that exposed HUD bleed-through | ✅ |

All branches cleaned up post-merge.

### Active bugs

**None.** All 4 bugs identified в Handoff v11 fixed this session. Production-ready foundation.

### Known accept-as-is items

| Item | Reason |
|---|---|
| Splash video не играет в MetaMask/Rainbow webviews | iOS WKWebView autoplay restriction в third-party apps. Poster fallback works. Affects MM/Rainbow only — Farcaster + standalone Safari работают |
| `ObjectMultiplex orphaned data for stream "metamask-multichain-provider"` warning | MetaMask SDK internal noise, безвредно |
| Auto-network-switch не показывает "wrong network" UI | wagmi автоматически переключает chain via MetaMask popup — наш UI не нужен. Confirmed correct behavior |

---

## DESIGN DECISIONS — QUICK REFERENCE

### NFT Economics (Session A)

**Drop probability matrix (Option B, FINAL):**

| Score | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| 0–500 | 80% | 17% | 2.5% | 0.5% |
| 500–1,500 | 50% | 37% | 11% | 2% |
| 1,500–3,000 | 22% | 48% | 25% | 5% |
| 3,000–5,000 | 5% | 25% | 50% | 20% |
| 5,000+ | 1% | 9% | 35% | 55% |

**Other locks:**
- Mint trigger: game over, score ≥ 1,000
- Yokai = highest reached in game
- Tier = weighted random within score bracket
- Per-wallet cap: 1 per yokai-tier (44 max)
- Cost: gas only (~$0.001 Soneium)
- Tradeable (ERC-721)

### Metadata Schema (Session B)

**7 attributes per NFT:** Yokai, Kanji, Tier, Yokai Rank (1-11), Tier Rank (1-4), Element, Aurora Opacity

**Element mapping:** Kodama=Forest, Hitodama=Spirit, Tanuki=Earth, Kappa=Water, Kitsune=Fox, Jorogumo=Shadow, Tengu=Sky, Oni=Fire, Raijin=Storm, Ryujin=Sea, Amaterasu=Sun

**Naming:** `{Yokai} — {Tier}` (em-dash)
**Royalties:** 2.5% (ERC-2981, 250 bps)
**External URL:** `https://kami-merge.vercel.app`
**Background color:** `0F1626`
**Description:** base_lore[yokai] + tier_flavor[tier] (see `kami_merge_nft_lore.md`)

### Onboarding (Session C)

**Splash hint (first launch only):** "Play to earn yokai NFTs on Soneium"
**First-game-over tutorial:** 3-screen modal (Run complete / NFT earned / Collect all 44)
**Help modal:** 5 sections single scrollable — Controls / Yokai Chain / NFTs / Leaderboard / Music
**Localization:** EN only v1, JP в Phase 4 post-grant

### Share / Viral (Session D)

**Trigger:** post-mint primary + post-game-over secondary
**Platforms:** Cast (Farcaster Mini App SDK) → Twitter → Copy → Native share (mobile)
**Image gen:** client canvas overlay on 4 pre-rendered tier templates (1200×630 OG)
**Templates:** Farcaster cast + Twitter + score-only (see Brief v13)
**Referrals:** simple URL param tracker, no rewards v1
**Auto-cast:** Settings toggle, OFF default

### Backend / Anti-cheat (Session E)

**Approach:** Heuristic + EIP-712 signed authorization
**Client payload:** score, run_duration, highest_yokai, merge_events, game_seed, wallet signature
**Heuristic rules:** score cap, duration plausibility, merge count, sum check, signature verify, rate limits
**EIP-712 fields:** wallet, yokai, tier_seed, score, nonce, deadline (10-min)
**Tier randomness:** deterministic from signed tier_seed (`keccak256(seed) % 10000 → bracket lookup`)
**Leaderboard:** Supabase only v1 (on-chain Phase 4)
**Rate limits:** 30/hr wallet, 100/hr IP, 5-burst → 5 min cooldown
**Data retention:** scores 90d, others forever
**Contract:** rotatable signerAddress, on-chain cap enforcement, on-chain tier derivation

### Grant Submission (Session F)

**Demo video:** 60 sec, script in Brief v13, ~4-6 hours production
**Twitter:** create @kamimergegame, 3 posts/week, yokai reveals + dev updates + community
**Farcaster:** existing @kodymeverik for authentic journey
**Pitch deck:** 5 slides PDF, dark theme
**Narrative:** hybrid story (technical + cultural + market validation)
**Timeline:** 5-6 weeks to submission (Stage 7 + soft launch + video + apply)

---

## IMPLEMENTATION PHASE — ROADMAP

### Stage 3 — UI completion (Week 1)

| Sub-stage | Component | Notes |
|---|---|---|
| 3.3 | `components/NFTCard.tsx` | Props: yokai, tier, artUrl, animatedUrl. Mouse tilt + Aurora holo (tier-scaled 0.45/0.60/0.75/0.90) |
| 3.4 | `components/Inventory.tsx` | Grid, empty state ("Earn first NFT — score 1000+"), NFT detail view |
| 3.5 | `components/MintCeremony.tsx` | "Run complete · Score X" → spinning frame → reveal → mint button |
| 3.6 | `components/HelpModal.tsx` | 5 scrollable sections |
| 3.7 | `components/Onboarding.tsx` | 3-screen first-time tutorial |
| 3.8 | `components/ShareModal.tsx` | Buttons + canvas image generation |
| 3.9 | `components/PauseOverlay.tsx` | Resume/Restart/Settings/Help/Quit |

### Stage 4-6 — Spike route deploy + security delta audit + prod merge

Existing scope from v11. Light, mostly verification.

### Stage 7 — Contracts + IPFS + Soneium deployment (Week 2)

| Item | Lines (est) |
|---|---|
| `KamiMergeNFT.sol` (ERC-721 + ERC-2981 + EIP-712) | ~250 |
| Foundry test suite | ~400 |
| Deployment script (Soneium mainnet) | ~60 |
| `supabase/functions/submit-score/index.ts` | ~200 |
| EIP-712 sign/verify helpers | ~80 |
| `mint` integration client-side | ~120 |
| `referrals` table + tracker | ~30 |
| IPFS metadata upload (44 JSON + 88 images) | ~50 |

### Stage 8 — Soft launch + grant prep (Weeks 3-5)

- Smoke test mint flow end-to-end
- Twitter account + 3-5 initial posts
- Demo video recording + editing
- Pitch deck (Figma/Keynote)
- Application drafts (Startale + Soneium For All)
- Submit Week 5

---

## NEXT CC PROMPT (для start следующей сессии)

Когда откроешь новый chat и подтвердишь готовность:

```markdown
# Stage 3.3 — NFTCard.tsx Component

**Goal:** React component для рендеринга NFT card с tier-scaled Aurora holo + mouse tilt.

**Reference:** Brief v13 Sessions A+B locks. NFT assets уже в `public/nft_assets/static/` 
и `public/nft_assets/animated/` (44 each).

**Spec:**

## Props interface
```tsx
type Tier = 'common' | 'rare' | 'epic' | 'legendary';
type YokaiName = 'kodama' | 'hitodama' | 'tanuki' | 'kappa' | 'kitsune' | 
                 'jorogumo' | 'tengu' | 'oni' | 'raijin' | 'ryujin' | 'amaterasu';

interface NFTCardProps {
  yokai: YokaiName;
  tier: Tier;
  size?: 'sm' | 'md' | 'lg';        // default 'md'
  interactive?: boolean;              // default true; false для static preview
  showLore?: boolean;                 // default false; true для detail view
}
```

## Visual specs
- Portrait 5:7 aspect ratio (matches assets 1024×1434)
- Aurora opacity per tier: common 0.45 / rare 0.60 / epic 0.75 / legendary 0.90
- 36-stop HSL conic gradient + blur(12-16px) + scale(1.4) (см. Handoff v10 specs)
- Mouse tilt effect (3D perspective) — disable если `interactive={false}`
- Static PNG fallback, animated WebP при hover (или auto-play если supported)
- Aurora intensity scales с tier
- Sprite multiplier: radius × 2.2

## File paths
- Static: `/nft_assets/static/{yokai}_{tier}.png`
- Animated: `/nft_assets/animated/{yokai}_{tier}.webp`

## Demo reference
`nft_card_demo.html` (existing в repo) — CSS + JS already prototyped, port to React.

## Constraints
- НЕ touch wallet code, game engine, или other components
- НЕ create mint logic (это Stage 3.5)
- Single atomic PR
- Storybook-style demo page для test rendering all 44 cards

## PR
- Branch: `feat/stage-3.3-nft-card`
- Atomic commit
- Standard merge flow (split squash + manual branch delete per Lessons)
```

---

## INFRASTRUCTURE STATUS

### Vercel
- Project: `kami-merge` под team `djimyneitrons-projects`
- Auto-deploy: `main` branch
- Env vars: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (Production + Preview scope)
- Status: ACTIVE, last deploy ~30 min ago (PR #14)

### Supabase
- Project: `kami-merge` (id: `ehbhmnfxdwjmhwjowjop`)
- Region: `ap-northeast-1` (Tokyo)
- Status: ACTIVE_HEALTHY
- Free tier — 7-day auto-pause limit (tool calls reset timer)
- Tables: `users`, `scores`, `personal_bests` (RLS enabled)
- Edge function `submit-score`: skeleton exists, implementation Stage 7
- **TODO:** add `referrals` table (Stage 7)

### Soneium Mainnet
- Chain ID: 1868
- Hex: 0x74c
- RPC: works via wagmi defaults
- Confirmed working: wallet auto-detection, chain switching
- Smart contract deployment: Stage 7
- Test wallet: `0xc6C8...1Aa8` (NOT main wallet, isolated for dev)
- Production wallet for grants/treasury: TBD before Stage 7 deploy

### Farcaster
- FID: 334785 (`kodymeverik`)
- Custody address: `0x2c2b42B5BaF04b9aeFd65eAc8249797bAA026453`
- Domain verified: `kami-merge.vercel.app`
- Manifest signed, account association valid
- Hosted manifest URL: registered ✓

### WalletConnect / Reown
- Team: `KodyMeverik`
- Project: `Kami Merge`
- Allowlist: `localhost:3000` + `kami-merge.vercel.app`
- Project ID configured in `.env.local`

---

## FILES & RESOURCES

### Files created this session (in /mnt/user-data/outputs/)

| File | Purpose |
|---|---|
| `kami_merge_design_brief_v13.md` | Strategic design document, Sessions A-F deliverables |
| `kami_merge_nft_lore.md` | 11 base lores + 4 tier flavors для NFT descriptions |
| `01_audit_wallet_flow.md` | CC structural audit prompt (used during Bug #1 diagnosis) |
| `02_fix_bug4_disconnect_button.md` | CC prompt that produced PR #13 |
| `03_add_eruda_debug_console.md` | CC prompt that produced PR #11 |
| `04_fix_bug1_sdk_context_timeout.md` | CC prompt that produced PR #12 |
| `05_fix_bug23_animate_fade.md` | CC prompt that produced PR #14 |

**ACTION:** Drag `kami_merge_design_brief_v13.md` and `kami_merge_nft_lore.md` and `Kami_Merge_Handoff_v13.md` into Claude project sidebar before opening next chat.

### Older handoffs (project knowledge — leave there)

- v11 — Phase 3D context, original Bug #1-4 documentation, 4 failure points hypothesis
- v12 — NFT art finalization, common-peaceful-subdued principle, file references
- v10 — Drop probability matrix original spec, mint ceremony UI design, Supabase verification

### Older handoffs (consider removing or archiving)

- v3-v9 — outdated context, may confuse search. Recommend archive but keep for historical reference

### Game code references

- `src/lib/wagmi.ts` — wagmi config с RainbowKit + farcasterMiniApp connectors
- `src/hooks/useMiniAppContext.ts` — Mini App detection + auto-connect logic (Bug #1 fix here)
- `src/components/SplashScreen.tsx` — splash state machine + render (Bug #2 fix here)
- `src/components/DebugConsole.tsx` — eruda loader (new this session)
- `src/config/yokai.ts` — canonical yokai data + lore (single source of truth)
- `public/nft_assets/static/` — 44 static PNGs (locked from prior sessions)
- `public/nft_assets/animated/` — 44 animated WebPs (locked)

---

## DEFERRED ITEMS (не критично для grant submission)

| Item | Why deferred | When to revisit |
|---|---|---|
| Drop pool composition audit (which yokai randomly spawn at start) | Не блокирует Stage 3.3+. Suika standard = первые 5 | Stage 3.5 or post-launch |
| Score formula exact numbers (points per merge per tier) | Locked в коде. Validation rules в Edge Function adapt to actual numbers | Stage 7 backend |
| Game over screen visual mockup | Existing screen уже работает; mint ceremony overlays on top | Stage 3.5 |
| Collection banner image (1400×400 OpenSea) | Stage 7 cosmetic | Stage 7 image gen task |
| Per-yokai detail page routes | Phase 4 polish | Post-grant |
| JP localization | Phase 4 growth play | Post-grant |
| On-chain leaderboard contract | Phase 4 decentralization | Post-grant |
| Reward layer for referrals | Need to see actual referral volume | If viral takeoff happens |
| Audio settings (volume slider) | Polish | Optional Stage 3.9 |
| Haptic feedback iPhone | Polish | Optional Stage 3.9 |
| Analytics integration | For grant metrics | Stage 8 soft launch |
| Privacy / Terms pages | Optional | Stage 8 |

---

## LESSONS LEARNED THIS SESSION

### Diagnostic patterns

1. **Console output > Speculation.** Without iPhone eruda logs мы бы гадали месяцами какой из 4 failure points fires для Bug #1. Once logs showed `miniAppReady: false, probing: true` — diagnosis instant.

2. **`?debug=1` gated tooling.** Adding eruda на ?param means zero impact на normal users но instant access debug когда нужно. Pattern для future tools (DevPanel, perf overlay).

3. **`Promise.race` для async cleanup.** Whenever third-party promise может hang indefinitely в edge cases — race against timeout. Fail safe to standalone mode.

### Design process patterns

4. **Surface locked decisions before designing.** Session A original пакет conflicted с locked decisions из Handoff v10 (drop matrix). Search project knowledge ALWAYS перед предложением нового дизайна.

5. **Permission to revisit locked.** "Locked" не значит "carved in stone" — если new analysis показывает better path, propose change explicitly. Kody dyrect разрешил revision Session A после search'а.

6. **Sequential package commitment.** Каждая session packaged как single commit (all decisions atomic). Avoids back-and-forth iterations. Trade-off: requires comprehensive thinking upfront, но faster overall.

### Communication patterns

7. **`ask_user_input_v0` for decisions.** Especially valuable когда proposing complete package — clear yes/no/iterate path. Mobile-friendly tap.

8. **Tables for strategic decisions.** Pros/cons + recommendation тable scannable instantly. Tag "🎯" для my recommendation prominent.

9. **One question max per response.** Even в long strategic responses, single end-question keeps momentum. Comprehensive design package + simple "accept / iterate" question.

---

## INIT PROMPT FOR NEW CHAT

Copy-paste это для start новой сессии:

```
Привет Клод! Продолжаем работу над Kami Merge.

Прикрепленные файлы (в Claude project):
1. Kami_Merge_Handoff_v13.md — operational state + recap
2. kami_merge_design_brief_v13.md — все design decisions из Sessions A-F
3. kami_merge_nft_lore.md — NFT descriptions (11 base + 4 tier flavors)

Current status: design phase complete. Все 4 bugs из Handoff v11 fixed. 
Production-ready foundation. Ready for implementation.

Next task: Stage 3.3 — NFTCard.tsx implementation.

Подготовь атомарный CC prompt для components/NFTCard.tsx согласно spec в Handoff v13 
секции "NEXT CC PROMPT". Assets уже в public/nft_assets/{static,animated}/. 

Working style: single copy-paste CC prompts, scannable response (tables, минимум prose), 
RU primary, без emoji unless I use them first.
```

---

*Handoff v13 complete. Ready for implementation phase.*
*Design brief v13 + lore file = single source of truth for NFT system.*
*All 4 bugs closed. No active blockers.*
