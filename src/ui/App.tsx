import { useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { getCoachAdvice } from "../coach/coach";
import { formatCard, isRed } from "../poker/cards";
import { chooseAIActionForHand, OPPONENT_PROFILES } from "../poker/ai";
import {
  applyAction,
  availableActions,
  createHand,
  playerView,
  potSize,
  recommendBetTo,
} from "../poker/engine";
import { estimateEquity } from "../poker/equity";
import { createSimulationPdf, simulationToCsv, simulationToJson } from "../simulation/simulationReport";
import type { SimulationResult } from "../simulation/simulate";
import { lookupSolverSpot, VERIFIED_SOLVER_SPOT_COUNT } from "../solver/adapter";
import { SolverDemo } from "./SolverDemo";
import type { Card, HandState, OpponentProfile, PokerAction, PlayerId } from "../poker/types";

const DEFAULT_SEED = 20261030;
const STARTING_STACK = 200;

function CardTile({ card, hidden = false, compact = false }: { card?: Card; hidden?: boolean; compact?: boolean }) {
  if (hidden) {
    return <span className={`playing-card card-back${compact ? " compact" : ""}`} aria-label="Hidden card">✦</span>;
  }
  if (!card) {
    return <span className={`playing-card card-empty${compact ? " compact" : ""}`} aria-label="Undealt community card" />;
  }
  return (
    <span className={`playing-card${isRed(card) ? " red" : ""}${compact ? " compact" : ""}`} aria-label={formatCard(card)}>
      <span>{formatCard(card)}</span>
      <span className="card-corner">{card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}</span>
    </span>
  );
}

function formatChips(value: number): string {
  return `${value} chip${value === 1 ? "" : "s"}`;
}

function actionLabel(type: string): string {
  return type === "raise" ? "raised" : type === "call" ? "called" : type === "check" ? "checked" : "folded";
}

function download(name: string, content: string | Uint8Array, type: string) {
  const part: BlobPart = content instanceof Uint8Array
    ? content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer
    : content;
  const url = URL.createObjectURL(new Blob([part], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Button({ children, variant = "secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

export function App() {
  const [handSeed, setHandSeed] = useState(String(DEFAULT_SEED + 1));
  const [hand, setHand] = useState<HandState>(() => createHand({ seed: DEFAULT_SEED, stack: STARTING_STACK }));
  const [profile, setProfile] = useState<OpponentProfile>("balanced");
  const [raiseTo, setRaiseTo] = useState(0);
  const [simHands, setSimHands] = useState(1000);
  const [simSeed, setSimSeed] = useState("20261030");
  const [simFirst, setSimFirst] = useState<OpponentProfile>("balanced");
  const [simSecond, setSimSecond] = useState<OpponentProfile>("aggressive");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const handCounterRef = useRef(0);

  const humanView = useMemo(() => playerView(hand, "p0"), [hand]);
  const actions = useMemo(() => availableActions(hand, "p0"), [hand]);
  const coach = useMemo(() => getCoachAdvice(humanView), [humanView]);
  const equity = useMemo(() => estimateEquity(
    hand.players[0].holeCards,
    hand.board,
    96,
    `${hand.seed}:${hand.actionCount}:hero-equity`,
  ), [hand]);
  const solverLookup = useMemo(() => lookupSolverSpot({
    players: 2,
    effectiveStackChips: STARTING_STACK,
    rakePercent: 0,
    street: hand.street === "complete" ? "river" : hand.street,
  }), [hand.street]);
  const currentProfile = OPPONENT_PROFILES.find((item) => item.id === profile)!;

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (hand.street === "complete" || hand.currentActor !== "p1") return;
    const timer = window.setTimeout(() => {
      setHand((current) => {
        if (current.street === "complete" || current.currentActor !== "p1") return current;
        const view = playerView(current, "p1");
        const action = chooseAIActionForHand(view, profile, current.actionCount, current.seed);
        return applyAction(current, action);
      });
    }, 360);
    return () => window.clearTimeout(timer);
  }, [hand, profile]);

  useEffect(() => {
    if (hand.currentActor === "p0" && hand.street !== "complete") {
      setRaiseTo((current) => actions.canRaise
        ? Math.min(actions.maxRaiseTo, Math.max(actions.minRaiseTo, current || actions.minRaiseTo))
        : 0,
      );
    }
  }, [actions.canRaise, actions.maxRaiseTo, actions.minRaiseTo, hand.currentActor, hand.street]);

  function startHand() {
    const parsed = Number(handSeed);
    const seed = Number.isFinite(parsed) ? parsed : handSeed;
    const button: PlayerId = handCounterRef.current % 2 === 0 ? "p1" : "p0";
    handCounterRef.current += 1;
    setHand(createHand({ seed, button, stack: STARTING_STACK }));
    setHandSeed(String(Number.isFinite(parsed) ? parsed + 1 : `${handSeed}:${handCounterRef.current}`));
  }

  function act(action: PokerAction) {
    setHand((current) => applyAction(current, action));
  }

  function useCoachAction() {
    if (coach.action === "raise") act({ type: "raise", amountTo: coach.amountTo ?? actions.minRaiseTo });
    else act({ type: coach.action });
  }

  function runBatch() {
    setSimBusy(true);
    setSimError("");
    setSimulation(null);
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../simulation/simulation.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: SimulationResult; error?: string }>) => {
      worker.terminate();
      workerRef.current = null;
      setSimBusy(false);
      if (!event.data.ok || !event.data.result) setSimError(event.data.error ?? "Simulation failed.");
      else setSimulation(event.data.result);
    };
    worker.onerror = () => {
      worker.terminate();
      workerRef.current = null;
      setSimBusy(false);
      setSimError("The simulation worker failed. Check the browser console and retry.");
    };
    worker.postMessage({
      hands: simHands,
      seed: simSeed,
      firstProfile: simFirst,
      secondProfile: simSecond,
      codeSha: "browser working tree",
      solverDataSha: null,
    });
  }

  const human = hand.players[0];
  const opponent = hand.players[1];
  const humanToAct = hand.street !== "complete" && hand.currentActor === "p0";
  const shownPot = hand.result?.pot ?? potSize(hand);
  const p0Position = hand.button === "p0" ? "BUTTON · SB" : "BIG BLIND";
  const p1Position = hand.button === "p1" ? "BUTTON · SB" : "BIG BLIND";
  const clampedRaiseTo = Math.min(actions.maxRaiseTo, Math.max(actions.minRaiseTo, raiseTo || actions.minRaiseTo));

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Poker GTO Lab home"><span className="mark">♠</span> POKER <b>GTO</b> LAB</a>
        <div className="topbar-right"><span className="play-money-tag">PLAY MONEY ONLY</span><a className="top-link" href="#simulation">Simulation lab <span aria-hidden="true">↗</span></a></div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">HEADS-UP NO-LIMIT · TRAINER</p>
          <h1>Every decision,<br /><em>made visible.</em></h1>
          <p className="intro-copy">Practice heads-up poker with transparent rules, an honest coach, and reproducible hands.</p>
        </div>
        <div className="intro-note">
          <span className="status-dot" />
          <div><strong>Transparent by design</strong><span>One exact river demo has solver data. Live coaching remains approximate.</span></div>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Poker table and coach">
        <div className="table-column">
          <div className="table-toolbar">
            <div className="toolbar-title"><span className="live-dot" /> HAND {String(handCounterRef.current + 1).padStart(3, "0")} <span className="toolbar-divider">/</span> {hand.street.toUpperCase()}</div>
            <div className="toolbar-controls">
              <label htmlFor="ai-profile">OPPONENT</label>
              <select id="ai-profile" value={profile} onChange={(event) => setProfile(event.target.value as OpponentProfile)}>
                {OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <label className="seed-label" htmlFor="hand-seed">SEED</label>
              <input id="hand-seed" aria-label="Hand seed" value={handSeed} onChange={(event) => setHandSeed(event.target.value)} />
              <Button variant="secondary" onClick={startHand}>New hand <span aria-hidden="true">↻</span></Button>
            </div>
          </div>

          <div className="poker-table" aria-label="Heads-up poker table">
            <div className="table-rim" />
            <div className="table-felt" />
            <div className={`seat opponent-seat${hand.currentActor === "p1" ? " active-seat" : ""}`}>
              <div className="seat-meta"><span className="seat-name">Opponent</span><span className="seat-position">{p1Position}</span></div>
              <div className="seat-cards" aria-label={hand.street === "complete" && hand.result?.reason === "showdown" ? "Opponent cards" : "Opponent cards hidden"}>
                {opponent.holeCards.map((card, index) => <CardTile key={index} card={card} hidden={hand.street !== "complete" || hand.result?.reason !== "showdown"} compact />)}
              </div>
              <div className="seat-stack"><span className="stack-icon">◈</span> {opponent.stack} <span className="stack-label">chips</span></div>
              {opponent.streetCommitted > 0 && <span className="commit-badge">+{opponent.streetCommitted}</span>}
              {hand.button === "p1" && <span className="dealer-chip">D</span>}
            </div>

            <div className="table-center">
              <span className="pot-label">POT</span>
              <div className="pot-value">{shownPot}<small> chips</small></div>
              <div className="board-cards" aria-label={`Community cards, ${hand.board.length} dealt`}>
                {Array.from({ length: 5 }, (_, index) => <CardTile key={index} card={hand.board[index]} compact />)}
              </div>
              {hand.street === "complete" && hand.result && (
                <div className={`result-banner${hand.result.winner === "p0" ? " won" : hand.result.winner === "tie" ? " tied" : " lost"}`} role="status">
                  {hand.result.winner === "tie" ? "Split pot" : hand.result.winner === "p0" ? "You win" : "Opponent wins"} · {hand.result.reason === "fold" ? "fold" : "showdown"}
                </div>
              )}
            </div>

            <div className={`seat hero-seat${hand.currentActor === "p0" ? " active-seat" : ""}`}>
              {hand.button === "p0" && <span className="dealer-chip">D</span>}
              <div className="seat-meta"><span className="seat-name">You</span><span className="seat-position">{p0Position}</span></div>
              <div className="seat-cards" aria-label="Your hole cards">
                {human.holeCards.map((card, index) => <CardTile key={index} card={card} compact />)}
              </div>
              <div className="seat-stack"><span className="stack-icon">◈</span> {human.stack} <span className="stack-label">chips</span></div>
              {human.streetCommitted > 0 && <span className="commit-badge">+{human.streetCommitted}</span>}
            </div>
            <span className="table-watermark">♠</span>
          </div>

          <div className="table-footer">
            <div className="hand-stats"><span>BLINDS <b>1 / 2</b></span><span>STACK <b>100 BB</b></span><span>SEED <b>{hand.seed}</b></span></div>
            <div className="turn-status" role="status" aria-live="polite">
              {hand.street === "complete" ? "Hand complete" : humanToAct ? "Your action" : "Opponent is thinking…"}
              <span className={`turn-indicator${humanToAct ? " your-turn" : ""}`} />
            </div>
          </div>

          <section className="action-panel" aria-label="Your actions">
            <div className="action-heading"><div><span className="eyebrow">YOUR TURN</span><h2>{humanToAct ? actions.toCall > 0 ? `Facing ${formatChips(actions.toCall)}` : "Action is on you" : hand.street === "complete" ? "Ready for the next hand?" : "Waiting for opponent"}</h2></div>
              <div className="call-price">{humanToAct && actions.toCall > 0 && <><span>CALL PRICE</span><b>{actions.callAmount}<small> chips</small></b></>}</div>
            </div>
            {humanToAct && actions.canRaise && (
              <div className="bet-sizing">
                <label htmlFor="bet-size">{hand.currentBet === 0 ? "BET TO" : "RAISE TO"} <strong>{clampedRaiseTo} chips</strong></label>
                <input id="bet-size" type="range" min={actions.minRaiseTo} max={actions.maxRaiseTo} step="1" value={clampedRaiseTo} onChange={(event) => setRaiseTo(Number(event.target.value))} aria-label="Raise size in chips" />
                <div className="bet-range"><span>MIN {actions.minRaiseTo}</span><span>MAX {actions.maxRaiseTo}</span></div>
                <div className="size-presets">
                  <button onClick={() => setRaiseTo(actions.minRaiseTo)}>Min</button>
                  <button onClick={() => setRaiseTo(recommendBetTo(hand, 0.5))}>½ pot</button>
                  <button onClick={() => setRaiseTo(recommendBetTo(hand, 1))}>Pot</button>
                  <button onClick={() => setRaiseTo(actions.maxRaiseTo)}>All-in</button>
                </div>
              </div>
            )}
            <div className="action-buttons">
              {actions.canFold && <Button variant="danger" disabled={!humanToAct} onClick={() => act({ type: "fold" })}>Fold</Button>}
              {actions.canCheck && <Button disabled={!humanToAct} onClick={() => act({ type: "check" })}>Check</Button>}
              {actions.canCall && <Button disabled={!humanToAct} onClick={() => act({ type: "call" })}>Call {actions.callAmount}</Button>}
              {humanToAct && actions.canRaise && <Button variant="primary" onClick={() => act({ type: "raise", amountTo: clampedRaiseTo })}>{hand.currentBet === 0 ? "Bet" : "Raise"} to {clampedRaiseTo}</Button>}
              {hand.street === "complete" && <Button variant="primary" onClick={startHand}>Deal next hand <span aria-hidden="true">→</span></Button>}
            </div>
          </section>

          <section className="history-panel" aria-label="Hand history">
            <div className="section-heading"><div><span className="eyebrow">THIS HAND</span><h2>Action history</h2></div><span className="history-count">{hand.actions.length} actions</span></div>
            {hand.actions.length === 0 ? <p className="empty-state">The hand is dealt. Actions will appear here.</p> : (
              <ol className="action-list">
                {hand.actions.map((item, index) => <li key={`${item.player}-${index}`}><span className="action-index">{String(index + 1).padStart(2, "0")}</span><span className="action-actor">{item.player === "p0" ? "You" : "Opponent"}</span><span className="action-verb">{item.type === "raise" ? `raised to ${item.amountTo}` : item.type === "call" ? `called ${item.amount}` : actionLabel(item.type)}</span><span className="action-street">{item.street}</span></li>)}
              </ol>
            )}
          </section>
        </div>

        <aside className="coach-column" aria-label="Coach and metrics">
          <section className="coach-card">
            <div className="coach-top"><span className="coach-icon">✳</span><div><p className="eyebrow">LIVE COACH</p><span className="approx-badge">APPROXIMATE</span></div></div>
            {humanToAct ? <>
              <p className="coach-kicker">HEURISTIC RECOMMENDATION</p>
              <h2 className="coach-recommendation">{coach.label}</h2>
              <p className="coach-rationale">{coach.rationale}</p>
              <Button variant="primary" disabled={coach.action === "fold" ? !actions.canFold : coach.action === "call" ? !actions.canCall : coach.action === "check" ? !actions.canCheck : !actions.canRaise} onClick={useCoachAction}>
                Use recommendation <span aria-hidden="true">↗</span>
              </Button>
            </> : <>
              <p className="coach-kicker">{hand.street === "complete" ? "HAND REVIEW" : "NEXT DECISION"}</p>
              <h2 className="coach-recommendation">{hand.street === "complete" ? "Hand complete" : "Coach is ready"}</h2>
              <p className="coach-rationale">{hand.street === "complete" ? "Review the visible cards, result, and approximate metrics. No opponent cards are used by the coach." : "When it is your turn, the coach will weigh your visible cards against the current call price."}</p>
            </>}
            <div className="coach-rule"><span className="rule-line" /><span>NOT SOLVER VERIFIED</span><span className="rule-line" /></div>
            <div className="coach-source"><span className="source-dot" /> Heuristic rules · source in docs</div>
          </section>

          <section className="metrics-card">
            <div className="section-heading compact-heading"><div><span className="eyebrow">SPOT METRICS</span><h2>What the numbers mean</h2></div><span className="info-icon" aria-label="More information">i</span></div>
            <div className="metric-row"><div><span className="metric-label">Monte Carlo equity</span><span className="metric-tag approximate-tag">APPROXIMATE</span></div><strong>{(equity.equity * 100).toFixed(1)}<small>%</small></strong></div>
            <p className="metric-subtext">{equity.samples} samples vs a uniformly random legal hand · not the actual opponent range</p>
            <div className="metric-row"><div><span className="metric-label">Call break-even</span><span className="metric-tag exact-tag">POT ODDS</span></div><strong>{coach.potOdds === null ? "—" : `${(coach.potOdds * 100).toFixed(1)}%`}</strong></div>
            <p className="metric-subtext">Exact pot-size arithmetic; excludes future bets and fold equity.</p>
            <details className="more-metrics">
              <summary>Expand strategy and EV metrics <span aria-hidden="true">＋</span></summary>
              <div className="expanded-metrics">
                <div><span>GTO action frequencies</span><b className="unavailable-tag">{solverLookup.status}</b></div>
                <div><span>Solver EV / EV loss</span><b className="unavailable-tag">{solverLookup.status}</b></div>
                <div><span>Current heuristic strength score</span><b className="approx-value">{(coach.strengthScore * 100).toFixed(0)} / 100</b></div>
              </div>
            </details>
            <p className="metrics-footnote">Solver coverage: <strong>{VERIFIED_SOLVER_SPOT_COUNT} verified demo spot</strong>. Live hand lookup: {solverLookup.reason}</p>
          </section>

          <section className="profile-card">
            <div className="profile-heading"><span className="profile-bot">◉</span><span><b>{currentProfile.name}</b><small>Opponent profile</small></span><span className="profile-status">ACTIVE</span></div>
            <p>{currentProfile.description}</p>
            <span className="profile-note">Deterministic decisions from the visible state and hand seed.</span>
          </section>
        </aside>
      </section>

      <SolverDemo />

      <section className="simulation-section" id="simulation">
        <div className="simulation-header"><div><p className="eyebrow">REPRODUCIBLE · HEADLESS · NO TABLE RENDERING</p><h2>Simulation lab</h2><p>Run hundreds or thousands of hands in a worker, then download the raw data and a charted PDF report.</p></div><div className="sim-number"><span>01</span><small>SIMULATE</small></div></div>
        <div className="sim-controls">
          <label>HANDS<input type="number" min="100" max="10000" step="100" value={simHands} onChange={(event) => setSimHands(Math.min(10000, Math.max(100, Number(event.target.value))))} /></label>
          <label>SEED<input value={simSeed} onChange={(event) => setSimSeed(event.target.value)} /></label>
          <label>PLAYER 1<select value={simFirst} onChange={(event) => setSimFirst(event.target.value as OpponentProfile)}>{OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>PLAYER 2<select value={simSecond} onChange={(event) => setSimSecond(event.target.value as OpponentProfile)}>{OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Button variant="primary" disabled={simBusy} onClick={runBatch}>{simBusy ? "Simulating…" : "Run batch"} <span aria-hidden="true">→</span></Button>
        </div>
        {simError && <p className="sim-error" role="alert">{simError}</p>}
        {simulation && <div className="simulation-results" aria-live="polite">
          <div className="results-title"><div><span className="eyebrow">BATCH COMPLETE</span><h3>{simulation.handsCompleted.toLocaleString()} hands <small>· {simulation.runtimeMs.toFixed(0)} ms</small></h3></div><div className="results-actions">
            <Button onClick={() => download("poker-gto-simulation.json", simulationToJson(simulation), "application/json")}>JSON</Button>
            <Button onClick={() => download("poker-gto-actions.csv", simulationToCsv(simulation), "text/csv")}>CSV</Button>
            <Button onClick={async () => download("poker-gto-report.pdf", await createSimulationPdf(simulation), "application/pdf")}>PDF report</Button>
          </div></div>
          <div className="result-metrics"><div><span>{OPPONENT_PROFILES.find((item) => item.id === simulation.profiles.p0)?.name} wins</span><b>{simulation.outcomes.p0Wins}</b></div><div><span>{OPPONENT_PROFILES.find((item) => item.id === simulation.profiles.p1)?.name} wins</span><b>{simulation.outcomes.p1Wins}</b></div><div><span>Split pots</span><b>{simulation.outcomes.ties}</b></div><div><span>Average pot</span><b>{simulation.chipResults.averagePot.toFixed(1)}<small> chips</small></b></div></div>
          <p className="sim-caveat">Action counts are empirical profile behavior. The separate river demo is not used by these simulations; solver agreement and EV loss remain unavailable.</p>
        </div>}
        <div className="simulation-rule"><span>NO SOLVER CLAIMS FOR LIVE PLAY</span><span>REPRODUCIBLE SEEDS</span><span>PLAY-MONEY ONLY</span><span>ONE EXACT DEMO SPOT</span></div>
      </section>

      <footer className="footer"><a className="wordmark" href="#top"><span className="mark">♠</span> POKER <b>GTO</b> LAB</a><p>For learning and play only. No real-money play. No claim of full-game GTO accuracy.</p><a href="https://github.com/mylo123ai-hue/Poker-GTO-v1" target="_blank" rel="noreferrer">Source repository ↗</a></footer>
    </main>
  );
}
