import { useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { explainBetSize, getCoachAdvice } from "../coach/coach";
import { formatCard, isRed } from "../poker/cards";
import { chooseAIActionForHand, OPPONENT_PROFILES } from "../poker/ai";
import { availableActions, playerView, potSize, recommendBetTo } from "../poker/engine";
import { equitySamplingRange95, estimateEquity } from "../poker/equity";
import {
  applyTrainerAction,
  createDefaultTrainerData,
  dealTrainerNextHand,
  loadTrainerData,
  recordCoachDecision,
  saveTrainerData,
  startTrainerMatch,
  updateCoachingProgress,
  type CoachMode,
  type CoachDecisionRecord,
  type TrainerData,
} from "../poker/persistence";
import type { MatchSettings } from "../poker/match";
import { buildReplayFrames, calculatePlayerStats, findLeakIndicators } from "../poker/stats";
import { createSimulationPdf, simulationToCsv, simulationToJson } from "../simulation/simulationReport";
import type { SimulationResult } from "../simulation/simulate";
import type { Card, HandState, OpponentProfile, PokerAction, PlayerId } from "../poker/types";

const EQUITY_SAMPLES = 96;
const COACH_MODES: { id: CoachMode; title: string; detail: string }[] = [
  { id: "beginner", title: "Beginner", detail: "Hints appear automatically." },
  { id: "practice", title: "Practice", detail: "Ask for a hint when you want one." },
  { id: "challenge", title: "Challenge", detail: "Play without hints; review afterward." },
];

function CardTile({ card, hidden = false, compact = false }: { card?: Card; hidden?: boolean; compact?: boolean }) {
  if (hidden) return <span className={`playing-card card-back${compact ? " compact" : ""}`} aria-label="Opponent card hidden">✦</span>;
  if (!card) return <span className={`playing-card card-empty${compact ? " compact" : ""}`} aria-label="Board card not yet dealt" />;
  return (
    <span className={`playing-card${isRed(card) ? " red" : ""}${compact ? " compact" : ""}`} aria-label={formatCard(card)}>
      <span>{formatCard(card)}</span>
      <span className="card-corner" aria-hidden="true">{card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}</span>
    </span>
  );
}

function Button({ children, variant = "secondary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button className={`button ${variant}`} type={type} {...props}>{children}</button>;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function formatRate(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

function formatAction(action: PokerAction): string {
  switch (action.type) {
    case "fold": return "Fold";
    case "check": return "Check";
    case "call": return "Call";
    case "raise": return `Raise to ${action.amountTo}`;
  }
}

function actionLabel(type: string): string {
  return type === "raise" ? "bet / raise" : type === "call" ? "call" : type;
}

function Metric({ label, value, sample, hint }: { label: string; value: string; sample: string; hint: string }) {
  return (
    <div className="metric-tile">
      <div className="metric-title"><span>{label}</span><strong>{value}</strong></div>
      <small>{sample}</small>
      <p>{hint}</p>
    </div>
  );
}

function rateSample(numerator: number, denominator: number, label: string): string {
  const top = Number.isInteger(numerator) ? String(numerator) : numerator.toFixed(1);
  return `${top} / ${denominator} ${label}`;
}

function makeBootState(): { data: TrainerData; recovered: boolean } {
  try {
    return loadTrainerData(window.localStorage);
  } catch {
    return { data: createDefaultTrainerData(), recovered: true };
  }
}

export function App() {
  const [boot] = useState(makeBootState);
  const [trainer, setTrainer] = useState(boot.data);
  const [storageMessage, setStorageMessage] = useState(boot.recovered
    ? "A saved session could not be restored. A fresh practice match is ready; your browser data stays on this device."
    : "");
  const [setupStack, setSetupStack] = useState(String(boot.data.match.settings.startingStackChips));
  const [setupSmallBlind, setSetupSmallBlind] = useState(String(boot.data.match.settings.smallBlindChips));
  const [setupBigBlind, setSetupBigBlind] = useState(String(boot.data.match.settings.bigBlindChips));
  const [setupSeed, setSetupSeed] = useState(boot.data.match.seedRoot);
  const [raiseTo, setRaiseTo] = useState(0);
  const [practiceHintVisible, setPracticeHintVisible] = useState(false);
  const [challengeReviewVisible, setChallengeReviewVisible] = useState(false);
  const [equityEstimate, setEquityEstimate] = useState<ReturnType<typeof estimateEquity> | null>(null);
  const [formError, setFormError] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiRetry, setAiRetry] = useState(0);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [replayStep, setReplayStep] = useState(0);
  const [simHands, setSimHands] = useState(1000);
  const [simSeed, setSimSeed] = useState("20261030");
  const [simFirst, setSimFirst] = useState<OpponentProfile>("balanced");
  const [simSecond, setSimSecond] = useState<OpponentProfile>("aggressive");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState("");
  const workerRef = useRef<Worker | null>(null);

  const match = trainer.match;
  const hand = match.hand;
  const human = hand.players[0];
  const opponent = hand.players[1];
  const humanView = useMemo(() => playerView(hand, "p0"), [hand]);
  const actions = useMemo(() => availableActions(hand, "p0"), [hand]);
  const coach = useMemo(() => getCoachAdvice(humanView), [humanView]);
  const heroStats = useMemo(() => calculatePlayerStats(trainer.history, "p0"), [trainer.history]);
  const opponentStats = useMemo(() => calculatePlayerStats(trainer.history, "p1"), [trainer.history]);
  const leakIndicators = useMemo(() => findLeakIndicators(heroStats), [heroStats]);
  const humanToAct = hand.street !== "complete" && hand.currentActor === "p0" && match.status === "active";
  const currentProfile = OPPONENT_PROFILES.find((item) => item.id === trainer.profile)!;
  const shownPot = hand.result?.pot ?? potSize(hand);
  const p0Position = hand.button === "p0" ? "BUTTON · SMALL BLIND" : "BIG BLIND";
  const p1Position = hand.button === "p1" ? "BUTTON · SMALL BLIND" : "BIG BLIND";
  const clampedRaiseTo = actions.canRaise
    ? Math.min(actions.maxRaiseTo, Math.max(actions.minRaiseTo, raiseTo || actions.minRaiseTo))
    : 0;
  const showRecommendation = humanToAct && (trainer.coachMode === "beginner"
    || (trainer.coachMode === "practice" && practiceHintVisible));
  const currentHandDecisions = trainer.decisions.filter((decision) => decision.matchId === match.id && decision.handNumber === match.handNumber);
  const reviewRecord = trainer.history.find((item) => item.id === selectedReviewId) ?? trainer.history.at(-1) ?? null;
  const replay = useMemo(() => {
    if (!reviewRecord) return { frames: [] as HandState[], error: "" };
    try {
      return { frames: buildReplayFrames(reviewRecord), error: "" };
    } catch {
      return { frames: [] as HandState[], error: "This saved hand could not be replayed." };
    }
  }, [reviewRecord]);
  const replayIndex = Math.min(replayStep, Math.max(0, replay.frames.length - 1));
  const replayHand = replay.frames[replayIndex];

  useEffect(() => {
    try {
      if (!saveTrainerData(window.localStorage, trainer)) {
        setStorageMessage("This browser could not save the match. You can keep playing, but refresh recovery is unavailable until storage works.");
      }
    } catch {
      setStorageMessage("This browser could not save the match. You can keep playing, but refresh recovery is unavailable until storage works.");
    }
  }, [trainer]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (match.status !== "active" || hand.currentActor !== "p1" || aiError) return;
    let active = true;
    let completed = false;
    const actionTimer = window.setTimeout(() => {
      if (!active) return;
      try {
        const action = chooseAIActionForHand(playerView(hand, "p1"), trainer.profile, hand.actionCount, hand.seed);
        setTrainer((current) => {
          if (current.match.hand.seed !== hand.seed || current.match.hand.actionCount !== hand.actionCount
            || current.match.hand.currentActor !== "p1" || current.match.status !== "active") return current;
          return applyTrainerAction(current, action);
        });
        completed = true;
      } catch {
        setAiError("The opponent did not finish this turn. Retry the turn to continue the hand.");
      }
    }, 420);
    const watchdog = window.setTimeout(() => {
      if (active && !completed) setAiError("The opponent is taking too long. Retry the turn to continue the hand.");
    }, 5_000);
    return () => {
      active = false;
      window.clearTimeout(actionTimer);
      window.clearTimeout(watchdog);
    };
  }, [match.status, hand.currentActor, hand.seed, hand.actionCount, hand, trainer.profile, aiError, aiRetry]);

  useEffect(() => {
    if (!humanToAct) return;
    setRaiseTo((current) => actions.canRaise
      ? Math.min(actions.maxRaiseTo, Math.max(actions.minRaiseTo, current || actions.minRaiseTo))
      : 0);
  }, [actions.canRaise, actions.maxRaiseTo, actions.minRaiseTo, hand.currentActor, hand.street, humanToAct]);

  function startNewMatch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setFormError("");
    try {
      if (setupSeed.trim().length === 0 || setupSeed.length > 100) throw new RangeError("Use a match seed from 1 to 100 characters.");
      const settings: MatchSettings = {
        startingStackChips: Number(setupStack),
        smallBlindChips: Number(setupSmallBlind),
        bigBlindChips: Number(setupBigBlind),
      };
      setTrainer((current) => startTrainerMatch(current, settings, setupSeed.trim()));
      setEquityEstimate(null);
      setPracticeHintVisible(false);
      setChallengeReviewVisible(false);
      setAiError("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Match settings are invalid.");
    }
  }

  function startNextHand() {
    setTrainer((current) => dealTrainerNextHand(current));
    setEquityEstimate(null);
    setPracticeHintVisible(false);
    setChallengeReviewVisible(false);
    setAiError("");
  }

  function act(action: PokerAction, usedRecommendation = false) {
    if (!humanToAct) return;
    const decision: CoachDecisionRecord = {
      id: `${match.id}:hand:${match.handNumber}:action:${hand.actionCount + 1}`,
      matchId: match.id,
      handNumber: match.handNumber,
      street: hand.street as CoachDecisionRecord["street"],
      board: [...hand.board],
      ownCards: [...human.holeCards],
      position: humanView.position,
      pot: humanView.pot,
      callAmount: humanView.callAmount,
      chosenAction: action,
      recommendedAction: coach.action === "raise"
        ? { type: "raise", amountTo: coach.amountTo ?? actions.minRaiseTo }
        : { type: coach.action },
      recommendationLabel: coach.label,
      rationale: coach.rationale,
    };
    setTrainer((current) => {
      if (current.match.hand.seed !== hand.seed || current.match.hand.actionCount !== hand.actionCount) return current;
      let next = recordCoachDecision(current, decision);
      next = applyTrainerAction(next, action);
      if (usedRecommendation) next = updateCoachingProgress(next, "recommendationsUsed");
      return next;
    });
    setPracticeHintVisible(false);
    setChallengeReviewVisible(false);
    setEquityEstimate(null);
    setAiError("");
  }

  function useRecommendation() {
    if (coach.action === "raise") act({ type: "raise", amountTo: coach.amountTo ?? actions.minRaiseTo }, true);
    else act({ type: coach.action }, true);
  }

  function changeCoachMode(mode: CoachMode) {
    setTrainer((current) => ({ ...current, coachMode: mode }));
    setPracticeHintVisible(false);
    setChallengeReviewVisible(false);
  }

  function askForPracticeHint() {
    setTrainer((current) => updateCoachingProgress(current, "practiceHintsRequested"));
    setPracticeHintVisible(true);
  }

  function revealChallengeReview() {
    setTrainer((current) => updateCoachingProgress(current, "challengeReviews"));
    setChallengeReviewVisible(true);
  }

  function openReview(id: string) {
    setSelectedReviewId(id);
    setReplayStep(0);
    setTrainer((current) => updateCoachingProgress(current, "handReviewsOpened"));
  }

  function runEquityEstimate() {
    if (!humanToAct) return;
    try {
      setEquityEstimate(estimateEquity(human.holeCards, hand.board, EQUITY_SAMPLES, `${hand.seed}:${hand.actionCount}:coach-equity`));
    } catch {
      setEquityEstimate(null);
      setFormError("Equity estimate is unavailable for this card state.");
    }
  }

  function runBatch() {
    setSimBusy(true);
    setSimError("");
    setSimulation(null);
    workerRef.current?.terminate();
    try {
      const worker = new Worker(new URL("../simulation/simulation.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: SimulationResult; error?: string }>) => {
        worker.terminate();
        workerRef.current = null;
        setSimBusy(false);
        if (!event.data.ok || !event.data.result) setSimError(event.data.error ?? "Simulation failed. Try a smaller batch.");
        else setSimulation(event.data.result);
      };
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        setSimBusy(false);
        setSimError("The simulation worker failed. Check browser support and retry.");
      };
      worker.postMessage({ hands: simHands, seed: simSeed, firstProfile: simFirst, secondProfile: simSecond, codeSha: "browser working tree" });
    } catch {
      setSimBusy(false);
      setSimError("This browser could not start a simulation worker.");
    }
  }

  const matchHandsPlayed = Math.max(0, match.handNumber - 1 + (hand.street === "complete" ? 1 : 0));
  const matchWinner: PlayerId | null = match.status === "match-complete"
    ? human.stack > opponent.stack ? "p0" : "p1"
    : null;
  const selectedProfileDescription = currentProfile.description;
  const opponentObservation = opponentStats.hands === 0
    ? "No completed-hand action sample yet. The selected profile is a broad tendency, not a promise about a hand."
    : `Across ${opponentStats.hands} saved hands, this opponent voluntarily entered ${formatRate(opponentStats.vpip.value)} and raised preflop ${formatRate(opponentStats.pfr.value)} of hands. These are past actions, not information about hidden cards.`;

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Poker Trainer home"><span className="mark" aria-hidden="true">♠</span> POKER <b>PRACTICE</b></a>
        <div className="topbar-right"><span className="play-money-tag">PLAY MONEY ONLY</span><a className="top-link" href="#statistics">Your stats <span aria-hidden="true">↓</span></a></div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">HEADS-UP NO-LIMIT · LOCAL TRAINER</p>
          <h1>Play the hand.<br /><em>Learn the pattern.</em></h1>
          <p className="intro-copy">A continuous heads-up match with explainable heuristic coaching and private on-device progress.</p>
        </div>
        <div className="intro-note"><span className="status-dot" /><div><strong>Built for practice</strong><span>Guidance and estimates are approximate learning aids, not optimal-play advice.</span></div></div>
      </section>

      <section className="match-setup" aria-label="Match setup">
        <details>
          <summary>Match setup <span>{trainer.match.settings.startingStackChips} chips · blinds {trainer.match.settings.smallBlindChips}/{trainer.match.settings.bigBlindChips} · seed {trainer.match.seedRoot}</span></summary>
          <form className="setup-grid" onSubmit={startNewMatch}>
            <label>Starting stack<input aria-label="Starting stack" type="number" min={2} max={1_000_000} step={1} value={setupStack} onChange={(event) => setSetupStack(event.target.value)} /></label>
            <label>Small blind<input aria-label="Small blind" type="number" min={1} max={99_999} step={1} value={setupSmallBlind} onChange={(event) => setSetupSmallBlind(event.target.value)} /></label>
            <label>Big blind<input aria-label="Big blind" type="number" min={2} max={100_000} step={1} value={setupBigBlind} onChange={(event) => setSetupBigBlind(event.target.value)} /></label>
            <label>Match seed<input aria-label="Match seed" maxLength={100} value={setupSeed} onChange={(event) => setSetupSeed(event.target.value)} /></label>
            <Button variant="primary" type="submit">Start new match</Button>
          </form>
          <p className="setup-note">Starting stacks must cover the big blind. Later hands carry each player's remaining chips forward.</p>
          {formError && <p className="inline-error" role="alert">{formError}</p>}
        </details>
      </section>

      {storageMessage && <p className="storage-message" role="status">{storageMessage}</p>}

      <section className="workspace-grid" aria-label="Poker table and coaching">
        <div className="table-column">
          <div className="table-toolbar">
            <div className="toolbar-title"><span className="live-dot" /> MATCH {String(trainer.matchesStarted).padStart(2, "0")} · HAND {String(match.handNumber).padStart(3, "0")} <span className="toolbar-divider">/</span> {hand.street.toUpperCase()}</div>
            <div className="toolbar-controls">
              <label htmlFor="ai-profile">OPPONENT</label>
              <select id="ai-profile" aria-label="Opponent profile" value={trainer.profile} onChange={(event) => setTrainer((current) => ({ ...current, profile: event.target.value as OpponentProfile }))}>
                {OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>

          <div className="poker-table" aria-label="Heads-up poker table">
            <div className="table-rim" /><div className="table-felt" />
            <div className={`seat opponent-seat${hand.currentActor === "p1" ? " active-seat" : ""}`}>
              <div className="seat-meta"><span className="seat-name">Opponent</span><span className="seat-position">{p1Position}</span></div>
              <div className="seat-cards" aria-label={hand.street === "complete" && hand.result?.reason === "showdown" ? "Opponent cards revealed at showdown" : "Opponent cards hidden"}>
                {opponent.holeCards.map((card, index) => <CardTile key={index} card={card} hidden={hand.street !== "complete" || hand.result?.reason !== "showdown"} compact />)}
              </div>
              <div className="seat-stack"><span className="stack-icon" aria-hidden="true">◈</span> {opponent.stack} <span className="stack-label">chips</span><small>{(opponent.stack / hand.bigBlind).toFixed(1)} BB</small></div>
              {opponent.streetCommitted > 0 && <span className="commit-badge">+{opponent.streetCommitted}</span>}
              {hand.button === "p1" && <span className="dealer-chip" aria-label="Button">D</span>}
            </div>

            <div className="table-center">
              <span className="pot-label">POT</span>
              <div className="pot-value">{shownPot}<small> chips</small></div>
              <div className="board-cards" aria-label={`Community cards, ${hand.board.length} dealt`}>
                {Array.from({ length: 5 }, (_, index) => <CardTile key={index} card={hand.board[index]} compact />)}
              </div>
              {hand.street === "complete" && hand.result && <div className={`result-banner${hand.result.winner === "p0" ? " won" : hand.result.winner === "tie" ? " tied" : " lost"}`} role="status">
                {hand.result.winner === "tie" ? "Split pot" : hand.result.winner === "p0" ? "You win" : "Opponent wins"} · {hand.result.reason === "fold" ? "fold" : "showdown"}
              </div>}
            </div>

            <div className={`seat hero-seat${hand.currentActor === "p0" ? " active-seat" : ""}`}>
              {hand.button === "p0" && <span className="dealer-chip" aria-label="Button">D</span>}
              <div className="seat-meta"><span className="seat-name">You</span><span className="seat-position">{p0Position}</span></div>
              <div className="seat-cards" aria-label="Your hole cards">{human.holeCards.map((card, index) => <CardTile key={index} card={card} compact />)}</div>
              <div className="seat-stack"><span className="stack-icon" aria-hidden="true">◈</span> {human.stack} <span className="stack-label">chips</span><small>{(human.stack / hand.bigBlind).toFixed(1)} BB</small></div>
              {human.streetCommitted > 0 && <span className="commit-badge">+{human.streetCommitted}</span>}
            </div>
            <span className="table-watermark" aria-hidden="true">♠</span>
          </div>

          <div className="table-footer">
            <div className="hand-stats"><span>BLINDS <b>{hand.smallBlind} / {hand.bigBlind}</b></span><span>HANDS PLAYED <b>{matchHandsPlayed}</b></span><span>SEED <b>{hand.seed}</b></span></div>
            <div className="turn-status" role="status" aria-live="polite">
              {hand.street === "complete" ? match.status === "match-complete" ? "Match complete" : "Hand complete" : humanToAct ? "Your action" : aiError ? "Opponent paused" : "Opponent thinking…"}
              <span className={`turn-indicator${humanToAct ? " your-turn" : ""}`} />
            </div>
          </div>

          {match.status === "match-complete" && <div className={`match-result${matchWinner === "p0" ? " won" : " lost"}`} role="status">
            <strong>{matchWinner === "p0" ? "You won the match" : "Opponent won the match"}</strong>
            <span>{matchWinner === "p0" ? "The opponent is out of chips." : "You are out of chips."} Start a new match to play again. Result saved on this device.</span>
          </div>}

          <section className="action-panel" aria-label="Your actions">
            <div className="action-heading"><div><span className="eyebrow">{humanToAct ? "YOUR TURN" : hand.street === "complete" ? "NEXT HAND" : "TABLE"}</span><h2>{humanToAct ? actions.toCall > 0 ? `Facing ${actions.callAmount} chips` : "Action is on you" : hand.street === "complete" ? match.status === "match-complete" ? "The match is over" : "Ready for the next hand?" : "Waiting for opponent"}</h2></div>
              {humanToAct && actions.toCall > 0 && <div className="call-price"><span>CALL PRICE · {coach.potOdds === null ? "—" : `${(coach.potOdds * 100).toFixed(1)}%`}</span><b>{actions.callAmount}<small> chips</small></b></div>}
            </div>
            {humanToAct && actions.canRaise && <details className="bet-sizing">
              <summary><span>{hand.currentBet === 0 ? "Set bet size" : "Set raise size"}</span><strong>{clampedRaiseTo} chips</strong></summary>
              <div className="bet-sizing-controls">
                <label htmlFor="bet-size-number"><span>{hand.currentBet === 0 ? "BET TO" : "RAISE TO"}</span><strong>{clampedRaiseTo} chips</strong></label>
                <div className="bet-input-row"><input id="bet-size-number" aria-label="Bet or raise to in chips" type="number" min={actions.minRaiseTo} max={actions.maxRaiseTo} step={1} value={clampedRaiseTo} onChange={(event) => setRaiseTo(Number(event.target.value))} /><input aria-label="Bet or raise size slider" type="range" min={actions.minRaiseTo} max={actions.maxRaiseTo} step={1} value={clampedRaiseTo} onChange={(event) => setRaiseTo(Number(event.target.value))} /></div>
                <div className="bet-range"><span>MIN {actions.minRaiseTo}</span><span>MAX {actions.maxRaiseTo}</span></div>
                <div className="size-presets"><button type="button" onClick={() => setRaiseTo(actions.minRaiseTo)}>Min</button><button type="button" onClick={() => setRaiseTo(recommendBetTo(hand, 0.5))}>½ pot</button><button type="button" onClick={() => setRaiseTo(recommendBetTo(hand, 1))}>Pot</button><button type="button" onClick={() => setRaiseTo(actions.maxRaiseTo)}>All-in</button></div>
              </div>
            </details>}
            <div className="action-buttons">
              {actions.canFold && <Button variant="danger" disabled={!humanToAct} onClick={() => act({ type: "fold" })}>Fold</Button>}
              {actions.canCheck && <Button disabled={!humanToAct} onClick={() => act({ type: "check" })}>Check</Button>}
              {actions.canCall && <Button disabled={!humanToAct} onClick={() => act({ type: "call" })}>Call {actions.callAmount}{actions.callAmount < actions.toCall ? " · all-in" : ""}</Button>}
              {humanToAct && actions.canRaise && <Button variant="primary" onClick={() => act({ type: "raise", amountTo: clampedRaiseTo })}>{hand.currentBet === 0 ? "Bet" : "Raise"} to {clampedRaiseTo}</Button>}
              {hand.street === "complete" && match.status === "hand-complete" && <Button variant="primary" onClick={startNextHand}>Deal next hand <span aria-hidden="true">→</span></Button>}
              {match.status === "match-complete" && <Button variant="primary" onClick={() => startNewMatch()}>Start a new match <span aria-hidden="true">↻</span></Button>}
            </div>
            {aiError && <div className="ai-error" role="alert"><span>{aiError}</span><Button onClick={() => { setAiError(""); setAiRetry((value) => value + 1); }}>Retry opponent turn</Button></div>}
          </section>

          <section className="history-panel" aria-label="Current hand history">
            <div className="section-heading"><div><span className="eyebrow">THIS HAND</span><h2>Action history</h2></div><span className="history-count">{hand.actions.length} actions</span></div>
            {hand.actions.length === 0 ? <p className="empty-state">Blinds are posted. Your actions will appear here.</p> : <ol className="action-list">
              {hand.actions.map((item, index) => <li key={`${item.player}-${index}`}><span className="action-index">{String(index + 1).padStart(2, "0")}</span><span className="action-actor">{item.player === "p0" ? "You" : "Opponent"}</span><span className="action-verb">{item.type === "raise" ? `to ${item.amountTo}` : item.type === "call" ? `called ${item.amount}` : actionLabel(item.type)}</span><span className="action-street">{item.street}</span></li>)}
            </ol>}
          </section>
        </div>

        <aside className="coach-column" aria-label="Coach and match notes">
          <section className="coach-card">
            <div className="coach-top"><span className="coach-icon" aria-hidden="true">✳</span><div><p className="eyebrow">COACH MODE</p><span className="approx-badge">HEURISTIC · APPROXIMATE</span></div></div>
            <div className="coach-mode-list" role="group" aria-label="Choose coaching mode">
              {COACH_MODES.map((mode) => <button key={mode.id} type="button" className={trainer.coachMode === mode.id ? "mode-choice selected" : "mode-choice"} aria-pressed={trainer.coachMode === mode.id} onClick={() => changeCoachMode(mode.id)}><strong>{mode.title}</strong><small>{mode.detail}</small></button>)}
            </div>
            {humanToAct && showRecommendation ? <div className="coach-advice">
              <p className="coach-kicker">RULE-BASED SUGGESTION</p><h2 className="coach-recommendation">{coach.label}</h2><p className="coach-rationale">{coach.rationale}</p>
              <Button variant="primary" disabled={coach.action === "fold" ? !actions.canFold : coach.action === "call" ? !actions.canCall : coach.action === "check" ? !actions.canCheck : !actions.canRaise} onClick={useRecommendation}>Use suggestion <span aria-hidden="true">↗</span></Button>
            </div> : humanToAct && trainer.coachMode === "practice" ? <div className="coach-advice"><p className="coach-kicker">YOUR PRACTICE HAND</p><h2 className="coach-recommendation">Choose first</h2><p className="coach-rationale">Make your own decision, then ask for a hint if you want a second perspective.</p><Button onClick={askForPracticeHint}>Get a hint</Button></div>
              : humanToAct && trainer.coachMode === "challenge" ? <div className="coach-advice"><p className="coach-kicker">CHALLENGE HAND</p><h2 className="coach-recommendation">No live hint</h2><p className="coach-rationale">Choose your action without a suggestion. After the hand, compare your choice with the approximate rule.</p></div>
                : hand.street === "complete" && trainer.coachMode === "challenge" ? <div className="coach-advice"><p className="coach-kicker">POST-HAND REVIEW</p><h2 className="coach-recommendation">How did you decide?</h2><p className="coach-rationale">Compare your recorded choices with a simple rule-based suggestion. A match is not a correctness grade.</p><Button onClick={revealChallengeReview}>Review challenge choices</Button></div>
                  : <div className="coach-advice"><p className="coach-kicker">HAND REVIEW</p><h2 className="coach-recommendation">Hand complete</h2><p className="coach-rationale">Review the visible cards, decisions, and result. The coach uses your cards and the public board only.</p></div>}
            {hand.street !== "complete" && <div className="coach-context">
              <div><span>Position</span><p>{coach.positionHint}</p></div>
              <div><span>Made hand</span><p>{coach.madeHandCategory ? `Current best category: ${coach.madeHandCategory}.` : "No five-card made hand can be ranked before the flop."}</p></div>
              {coach.potOdds !== null && <div><span>Pot odds</span><p>{(coach.potOdds * 100).toFixed(1)}% exact call-price break-even before future betting.</p></div>}
              {coach.preflopHint && <div><span>Starting cards</span><p>{coach.preflopHint}</p></div>}
              {actions.canRaise && <div><span>Bet sizing</span><p>{explainBetSize(humanView, clampedRaiseTo)} The size explains chip arithmetic, not an optimal wager.</p></div>}
            </div>}
            {trainer.coachMode === "challenge" && challengeReviewVisible && <div className="challenge-review" aria-label="Challenge decision review">
              <h3>This hand's choices</h3>
              {currentHandDecisions.length === 0 ? <p>No decisions were recorded in this hand.</p> : currentHandDecisions.map((decision) => <article key={decision.id}><strong>{decision.street} · You chose {formatAction(decision.chosenAction)}</strong><span>Rule suggestion: {decision.recommendationLabel}</span><small>{decision.rationale}</small></article>)}
              <p className="review-disclaimer">This compares your choices with an authored heuristic; it does not grade correctness or optimality.</p>
            </div>}
            <div className="coach-foot"><span className="source-dot" /> No hidden opponent cards used · no optimal-play claim</div>
          </section>

          <section className="equity-card" aria-label="Optional equity estimate">
            <div className="section-heading compact-heading"><div><span className="eyebrow">OPTIONAL TOOL</span><h2>Random-hand equity</h2></div><span className="approx-badge">APPROXIMATE</span></div>
            {humanToAct && <Button onClick={runEquityEstimate}>Estimate with {EQUITY_SAMPLES} trials</Button>}
            {equityEstimate ? (() => {
              const interval = equitySamplingRange95(equityEstimate);
              return <div className="equity-result"><strong>{(equityEstimate.equity * 100).toFixed(1)}%</strong><span>about 95% sampling range {(interval.low * 100).toFixed(0)}–{(interval.high * 100).toFixed(0)}%</span><small>{equityEstimate.samples} seeded samples · uniformly random legal opponent hand; not the selected profile's range</small></div>;
            })() : <p className="metric-subtext">Off until requested. The estimate assumes random legal opponent cards, excludes strategy, and has wide uncertainty at this sample cap.</p>}
          </section>

          <section className="profile-card">
            <div className="profile-heading"><span className="profile-bot" aria-hidden="true">◉</span><span><b>{currentProfile.name}</b><small>Heuristic opponent</small></span><span className="profile-status">ACTIVE</span></div>
            <p>{selectedProfileDescription}</p><p className="opponent-observation">{opponentObservation}</p>
            <span className="profile-note">Profile actions use only that player's cards and the public state.</span>
          </section>

          <section className="progress-card" aria-label="Coaching progress">
            <div className="section-heading compact-heading"><div><span className="eyebrow">PRACTICE PROGRESS</span><h2>Your coaching activity</h2></div></div>
            <div className="progress-grid"><div><strong>{trainer.coaching.practiceHintsRequested}</strong><span>Practice hints</span></div><div><strong>{trainer.coaching.recommendationsUsed}</strong><span>Suggestions used</span></div><div><strong>{trainer.coaching.challengeReviews}</strong><span>Challenge reviews</span></div><div><strong>{trainer.coaching.handReviewsOpened}</strong><span>Hand reviews</span></div></div>
            <small>Saved only in this browser. These counts track activity, not skill or win rate.</small>
          </section>
        </aside>
      </section>

      <section className="statistics-section" id="statistics" aria-label="Player statistics">
        <div className="section-heading stats-heading"><div><span className="eyebrow">YOUR SAVED SAMPLE</span><h2>Player statistics</h2></div><span className="history-count">Last {trainer.history.length} of up to 500 saved hands</span></div>
        <div className="stats-grid">
          <Metric label="VPIP" value={formatRate(heroStats.vpip.value)} sample={rateSample(heroStats.vpip.numerator, heroStats.vpip.denominator, "hands")} hint="Hands where you voluntarily called or raised preflop ÷ hands dealt." />
          <Metric label="PFR" value={formatRate(heroStats.pfr.value)} sample={rateSample(heroStats.pfr.numerator, heroStats.pfr.denominator, "hands")} hint="Hands where you raised preflop ÷ hands dealt." />
          <Metric label="3-bet" value={formatRate(heroStats.threeBet.value)} sample={rateSample(heroStats.threeBet.numerator, heroStats.threeBet.denominator, "opportunities")} hint="Raises after an opponent's first preflop raise ÷ legal 3-bet opportunities." />
          <Metric label="Aggression factor" value={formatNumber(heroStats.aggression.value)} sample={`${heroStats.aggression.aggressiveActions} bets / raises · ${heroStats.aggression.calls} calls`} hint="Bets and raises ÷ calls; unavailable until at least one call is recorded." />
          <Metric label="C-bet" value={formatRate(heroStats.continuationBet.value)} sample={rateSample(heroStats.continuationBet.numerator, heroStats.continuationBet.denominator, "opportunities")} hint="Flop bets by the preflop aggressor ÷ their first no-bet flop opportunities." />
          <Metric label="Fold to c-bet" value={formatRate(heroStats.foldsToContinuationBet.value)} sample={rateSample(heroStats.foldsToContinuationBet.numerator, heroStats.foldsToContinuationBet.denominator, "faced")} hint="Folds ÷ times facing a flop bet by the preflop aggressor." />
          <Metric label="WTSD" value={formatRate(heroStats.wentToShowdown.value)} sample={rateSample(heroStats.wentToShowdown.numerator, heroStats.wentToShowdown.denominator, "flops seen")} hint="Showdowns reached ÷ hands where you saw a flop." />
          <Metric label="W$SD share" value={formatRate(heroStats.wonAtShowdown.value)} sample={rateSample(heroStats.wonAtShowdown.numerator, heroStats.wonAtShowdown.denominator, "showdowns")} hint="Average share of awarded chips at showdown; split pots contribute an equal share." />
          <Metric label="BB / 100" value={heroStats.bbPer100 === null ? "—" : heroStats.bbPer100.toFixed(1)} sample={`${heroStats.hands} completed hands`} hint="Net chips normalized by each hand's big blind, then per 100 hands." />
        </div>
        <div className="stats-lower-grid">
          <section className="position-card"><h3>Position splits</h3><div className="table-scroll"><table><thead><tr><th>Position</th><th>Hands</th><th>VPIP</th><th>PFR</th><th>BB / 100</th></tr></thead><tbody>
            {(["button", "bigBlind"] as const).map((position) => { const split = heroStats.positions[position]; return <tr key={position}><th>{position === "button" ? "Button / small blind" : "Big blind"}</th><td>{split.hands}</td><td>{formatRate(split.vpip.value)}</td><td>{formatRate(split.pfr.value)}</td><td>{split.bbPer100 === null ? "—" : split.bbPer100.toFixed(1)}</td></tr>; })}
          </tbody></table></div><p>Button and big-blind rates use each position's hand count; early samples are noisy.</p></section>
          <section className="leak-card"><h3>Common leak indicators</h3><div className="leak-list">{leakIndicators.map((indicator) => <article className={indicator.severity} key={indicator.id}><strong>{indicator.label}</strong><span>{indicator.detail}</span></article>)}</div><p>These thresholds prompt review; they do not diagnose a player or grade strategy quality.</p></section>
          <section className="match-record-card"><h3>Match results</h3><div className="match-record-number"><strong>{trainer.completedMatches.length}</strong><span>completed matches saved</span></div>
            {trainer.completedMatches.length === 0 ? <p>Finish a match by eliminating the opponent to record a result.</p> : <ul>{trainer.completedMatches.slice(-5).reverse().map((result) => <li key={result.id}><span>{result.winner === "p0" ? "You won" : "Opponent won"} · {result.hands} hands</span><b>{result.finalStacks.p0} : {result.finalStacks.p1}</b></li>)}</ul>}
          </section>
        </div>
      </section>

      <section className="review-section" aria-label="Hand review and replay">
        <div className="section-heading"><div><span className="eyebrow">REVIEW THE LINE</span><h2>Hand replay</h2></div><span className="history-count">{trainer.history.length} hands available</span></div>
        {trainer.history.length === 0 ? <p className="empty-state">Completed hands appear here with a step-by-step replay. Current hands are saved for refresh recovery.</p> : <>
          <label className="review-select-label" htmlFor="review-hand">Choose a saved hand</label>
          <select id="review-hand" value={reviewRecord?.id ?? ""} onChange={(event) => openReview(event.target.value)}>
            {trainer.history.slice(-40).reverse().map((record) => <option key={record.id} value={record.id}>Match {record.matchId} · Hand {record.handNumber} · {record.result.winner === "p0" ? "You won" : record.result.winner === "p1" ? "Opponent won" : "Split"}</option>)}
          </select>
          {replay.error && <p className="inline-error" role="alert">{replay.error}</p>}
          {replayHand && reviewRecord && <div className="replay-panel">
            <div className="replay-board"><div><span>BOARD</span><div>{Array.from({ length: 5 }, (_, index) => <CardTile key={index} card={replayHand.board[index]} compact />)}</div></div><div><span>STEP {replayIndex} / {replay.frames.length - 1}</span><strong>{replayHand.street === "complete" ? `${replayHand.result?.winner === "p0" ? "You won" : replayHand.result?.winner === "p1" ? "Opponent won" : "Split pot"} · ${replayHand.result?.reason}` : `${replayHand.street} · ${replayHand.currentActor === "p0" ? "You to act" : "Opponent to act"}`}</strong></div></div>
            <div className="replay-holes"><div><span>YOUR CARDS</span><div>{replayHand.players[0].holeCards.map((card, index) => <CardTile key={index} card={card} compact />)}</div></div><div><span>OPPONENT</span><div>{replayHand.players[1].holeCards.map((card, index) => <CardTile key={index} card={card} hidden={replayHand.street !== "complete" || replayHand.result?.reason !== "showdown"} compact />)}</div></div></div>
            <div className="replay-controls"><Button disabled={replayIndex === 0} onClick={() => setReplayStep((value) => Math.max(0, value - 1))}>← Previous action</Button><Button disabled={replayIndex >= replay.frames.length - 1} onClick={() => setReplayStep((value) => Math.min(replay.frames.length - 1, value + 1))}>Next action →</Button><span>Pot {potSize(replayHand)} chips · Button {replayHand.button === "p0" ? "You" : "Opponent"}</span></div>
            <ol className="action-list replay-actions">{reviewRecord.actions.map((item, index) => <li key={`${item.player}-${index}`} className={index < replayIndex ? "played" : ""}><span className="action-index">{String(index + 1).padStart(2, "0")}</span><span className="action-actor">{item.player === "p0" ? "You" : "Opponent"}</span><span className="action-verb">{item.type === "raise" ? `bet / raise to ${item.amountTo}` : item.type === "call" ? `called ${item.amount}` : item.type}</span><span className="action-street">{item.street}</span></li>)}</ol>
          </div>}
        </>}
      </section>

      <section className="simulation-section" id="simulation">
        <div className="simulation-header"><div><p className="eyebrow">REPRODUCIBLE · HEADLESS · SYNTHETIC</p><h2>Opponent simulation lab</h2><p>Compare the four authored heuristic profiles in seeded, play-money batches. These results describe those profiles only.</p></div><div className="sim-number"><span>01</span><small>SIMULATE</small></div></div>
        <div className="sim-controls">
          <label>HANDS<input type="number" min="100" max="10000" step="100" value={simHands} onChange={(event) => { const value = Number(event.target.value); setSimHands(Number.isFinite(value) ? Math.min(10000, Math.max(100, value)) : 100); }} /></label>
          <label>SEED<input aria-label="Simulation seed" value={simSeed} onChange={(event) => setSimSeed(event.target.value)} /></label>
          <label>PLAYER 1<select aria-label="Simulation player 1" value={simFirst} onChange={(event) => setSimFirst(event.target.value as OpponentProfile)}>{OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>PLAYER 2<select aria-label="Simulation player 2" value={simSecond} onChange={(event) => setSimSecond(event.target.value as OpponentProfile)}>{OPPONENT_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Button variant="primary" disabled={simBusy} onClick={runBatch}>{simBusy ? "Simulating…" : "Run batch"} <span aria-hidden="true">→</span></Button>
        </div>
        {simError && <p className="sim-error" role="alert">{simError}</p>}
        {simulation && <div className="simulation-results" aria-live="polite">
          <div className="results-title"><div><span className="eyebrow">BATCH COMPLETE</span><h3>{simulation.handsCompleted.toLocaleString()} hands <small>· {simulation.runtimeMs.toFixed(0)} ms</small></h3></div><div className="results-actions">
            <Button onClick={() => download("poker-trainer-simulation.json", simulationToJson(simulation), "application/json")}>JSON</Button><Button onClick={() => download("poker-trainer-actions.csv", simulationToCsv(simulation), "text/csv")}>CSV</Button><Button onClick={async () => download("poker-trainer-report.pdf", await createSimulationPdf(simulation), "application/pdf")}>PDF report</Button>
          </div></div>
          <div className="result-metrics"><div><span>{OPPONENT_PROFILES.find((item) => item.id === simulation.profiles.p0)?.name} wins</span><b>{simulation.outcomes.p0Wins}</b></div><div><span>{OPPONENT_PROFILES.find((item) => item.id === simulation.profiles.p1)?.name} wins</span><b>{simulation.outcomes.p1Wins}</b></div><div><span>Split pots</span><b>{simulation.outcomes.ties}</b></div><div><span>Average pot</span><b>{simulation.chipResults.averagePot.toFixed(1)}<small> chips</small></b></div></div>
          <p className="sim-caveat">Empirical heuristic behavior only. The batch does not establish strategy quality, optimal play, or performance against real opponents.</p>
        </div>}
        <div className="simulation-rule"><span>NO BACKEND</span><span>SEEDED RESULTS</span><span>PLAY MONEY</span><span>HEURISTIC PROFILES</span></div>
      </section>

      <footer className="footer"><a className="wordmark" href="#top"><span className="mark" aria-hidden="true">♠</span> POKER <b>PRACTICE</b></a><p>For learning and play only. Advice is approximate and does not claim optimal play.</p><a href="https://github.com/mylo123ai-hue/Poker-GTO-v1" target="_blank" rel="noreferrer">Source repository ↗</a></footer>
    </main>
  );
}
