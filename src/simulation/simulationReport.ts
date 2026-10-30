import type { SimulationResult } from "./simulate";

export function simulationToCsv(result: SimulationResult): string {
  const columns = [
    "record", "seed", "player", "profile", "hands_requested", "hands_completed",
    "fold", "check", "call", "raise", "fold_frequency", "check_frequency", "call_frequency", "raise_frequency",
    "p0_net_chips", "p1_net_chips", "total_net_chips", "average_pot_chips",
    "p0_wins", "p1_wins", "ties", "showdowns", "folds", "runtime_ms", "code_sha", "solver_data_sha",
    "verified_solver_spots", "eligible_decisions", "coverage_percent", "solver_agreement", "solver_expected_value_loss",
    "failure_count", "failed_hand", "failure_message", "notes",
  ];
  const runMetadata = {
    seed: result.seed,
    hands_requested: String(result.handsRequested),
    hands_completed: String(result.handsCompleted),
    runtime_ms: String(result.runtimeMs),
    code_sha: result.codeSha,
    solver_data_sha: result.solverDataSha ?? "",
    verified_solver_spots: String(result.solverCoverage.verifiedSpots),
    eligible_decisions: String(result.solverCoverage.eligibleDecisions),
    coverage_percent: String(result.solverCoverage.coveragePercent),
    solver_agreement: "",
    solver_expected_value_loss: "",
    failure_count: String(result.failures.length),
  };
  const rows: Record<string, string>[] = [];
  for (const id of ["p0", "p1"] as const) {
    rows.push({
      ...runMetadata,
      record: "action-counts",
      player: id,
      profile: result.profiles[id],
      fold: String(result.actionCounts[id].fold),
      check: String(result.actionCounts[id].check),
      call: String(result.actionCounts[id].call),
      raise: String(result.actionCounts[id].raise),
      fold_frequency: String(result.actionFrequency[id].fold),
      check_frequency: String(result.actionFrequency[id].check),
      call_frequency: String(result.actionFrequency[id].call),
      raise_frequency: String(result.actionFrequency[id].raise),
      p0_net_chips: String(result.chipResults.p0Net),
      p1_net_chips: String(result.chipResults.p1Net),
      total_net_chips: String(result.chipResults.totalNet),
      average_pot_chips: String(result.chipResults.averagePot),
      notes: "Empirical behavior of selected heuristic profiles; not solver frequencies.",
    });
  }
  rows.push({
    ...runMetadata,
    record: "outcomes",
    player: "both",
    profile: `${result.profiles.p0} vs ${result.profiles.p1}`,
    p0_net_chips: String(result.chipResults.p0Net),
    p1_net_chips: String(result.chipResults.p1Net),
    total_net_chips: String(result.chipResults.totalNet),
    average_pot_chips: String(result.chipResults.averagePot),
    p0_wins: String(result.outcomes.p0Wins),
    p1_wins: String(result.outcomes.p1Wins),
    ties: String(result.outcomes.ties),
    showdowns: String(result.outcomes.showdowns),
    folds: String(result.outcomes.folds),
    notes: "No matching solver decision is used by these heuristic-profile simulations; agreement and solver EV loss are unavailable.",
  });
  for (const failure of result.failures) {
    rows.push({
      ...runMetadata,
      record: "failure",
      failed_hand: String(failure.hand),
      failure_message: failure.message,
    });
  }
  const encode = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [columns.map(encode).join(","), ...rows.map((row) => columns.map((column) => encode(row[column] ?? "")).join(","))].join("\n") + "\n";
}

export function simulationToJson(result: SimulationResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export async function createSimulationPdf(result: SimulationResult): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const left = 48;
  const width = 516;
  document.setFont("helvetica", "bold");
  document.setFontSize(22);
  document.text("Heads-up simulation report", left, 52);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(`Seed ${result.seed}  |  ${result.handsCompleted}/${result.handsRequested} hands  |  runtime ${result.runtimeMs.toFixed(1)} ms`, left, 72);
  document.text(`Profiles: ${result.profiles.p0} vs ${result.profiles.p1}  |  starting stack ${result.startingStackChips} chips  |  blinds 1/${result.blinds.big}`, left, 88);
  document.text(`Code SHA: ${result.codeSha}`, left, 104);
  document.text(`Solver data SHA: ${result.solverDataSha ?? "not used — the separate river demo is not part of this simulation"}`, left, 120);

  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  document.text("Outcomes", left, 158);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  const outcomes = [
    ["P0 wins", result.outcomes.p0Wins],
    ["P1 wins", result.outcomes.p1Wins],
    ["Ties", result.outcomes.ties],
  ] as const;
  const maxOutcome = Math.max(1, ...outcomes.map(([, value]) => value));
  outcomes.forEach(([label, value], index) => {
    const y = 178 + index * 26;
    document.text(`${label}  ${value}`, left, y + 11);
    document.setFillColor(index === 0 ? 26 : index === 1 ? 194 : 133, index === 2 ? 148 : 118, index === 1 ? 94 : 88);
    document.rect(left + 112, y, (width - 140) * value / maxOutcome, 15, "F");
  });
  document.text(`Showdowns ${result.outcomes.showdowns}  |  folds ${result.outcomes.folds}  |  average pot ${result.chipResults.averagePot.toFixed(2)} chips`, left, 266);
  document.text(`Failed hands: ${result.failures.length}`, left, 282);

  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  document.text("Empirical action counts", left, 306);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  const actionNames = ["fold", "check", "call", "raise"] as const;
  for (const [index, player] of (["p0", "p1"] as const).entries()) {
    const y = 330 + index * 87;
    document.setFont("helvetica", "bold");
    document.text(`${player.toUpperCase()} — ${result.profiles[player]}`, left, y);
    document.setFont("helvetica", "normal");
    actionNames.forEach((action, actionIndex) => {
      const value = result.actionCounts[player][action];
      const x = left + actionIndex * 126;
      document.text(`${action}: ${value} (${(result.actionFrequency[player][action] * 100).toFixed(1)}%)`, x, y + 19);
      document.setFillColor(91, 181, 144);
      document.rect(x, y + 28, 108 * result.actionFrequency[player][action], 9, "F");
      document.setDrawColor(210, 210, 210);
      document.rect(x, y + 28, 108, 9, "S");
    });
  }

  document.setFont("helvetica", "bold");
  document.setFontSize(12);
  document.text("Solver coverage and limits", left, 528);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  const caveats = [
    `Verified solver spots: ${result.solverCoverage.verifiedSpots}; eligible decisions: ${result.solverCoverage.eligibleDecisions}; coverage ${result.solverCoverage.coveragePercent.toFixed(2)}%.`,
    "Agreement and solver EV loss were not computed; this simulation does not evaluate a matching solver decision.",
    "Action frequencies describe these heuristic opponents only; they are not GTO frequencies.",
    `Net chips: P0 ${result.chipResults.p0Net}; P1 ${result.chipResults.p1Net}; total ${result.chipResults.totalNet}. Results depend on this seed, stack, and profiles.`,
  ];
  caveats.forEach((line, index) => document.text(line, left, 550 + index * 16));
  if (result.failures.length > 0) {
    document.setTextColor(160, 86, 77);
    document.text(`First failure (hand ${result.failures[0]!.hand}): ${result.failures[0]!.message.slice(0, 90)}`, left, 627);
  }

  document.setFontSize(8);
  document.setTextColor(100);
  document.text("Poker GTO Lab • play-money simulation • no GTO accuracy claim", left, 738);
  return new Uint8Array(document.output("arraybuffer"));
}
