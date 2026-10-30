export const PLAYER_IDS = ["p0", "p1"] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];
export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Card = { rank: number; suit: Suit };
export type Street = "preflop" | "flop" | "turn" | "river" | "complete";
export type ActionType = "fold" | "check" | "call" | "raise";

export type PokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; amountTo: number };

export type ActionRecord = {
  player: PlayerId;
  type: ActionType;
  street: Exclude<Street, "complete">;
  amount: number;
  amountTo?: number;
};

export type PlayerState = {
  id: PlayerId;
  label: string;
  stack: number;
  holeCards: Card[];
  streetCommitted: number;
  totalCommitted: number;
  folded: boolean;
  allIn: boolean;
};

export type PotAward = {
  amount: number;
  eligible: PlayerId[];
  winners: PlayerId[];
};

export type HandResult = {
  winner: PlayerId | "tie";
  reason: "fold" | "showdown";
  pot: number;
  payouts: Record<PlayerId, number>;
  refunds: Record<PlayerId, number>;
  handNames?: Partial<Record<PlayerId, string>>;
  pots: PotAward[];
};

export type HandState = {
  seed: string;
  deck: Card[];
  deckCursor: number;
  players: [PlayerState, PlayerState];
  board: Card[];
  button: PlayerId;
  street: Street;
  currentActor: PlayerId | null;
  currentBet: number;
  lastFullRaise: number;
  actedThisStreet: PlayerId[];
  raiseRights: PlayerId[];
  actions: ActionRecord[];
  actionCount: number;
  initialStack: number;
  originalPot: number;
  result: HandResult | null;
};

export type AvailableActions = {
  toCall: number;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  callAmount: number;
};

export type PlayerView = {
  player: PlayerId;
  ownCards: Card[];
  board: Card[];
  street: Street;
  pot: number;
  stack: number;
  toCall: number;
  callAmount: number;
  canCheck: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  position: "button" | "big blind";
};

export type OpponentProfile = "tight" | "caller" | "aggressive" | "balanced";

export type SidePot = {
  amount: number;
  eligible: PlayerId[];
};
