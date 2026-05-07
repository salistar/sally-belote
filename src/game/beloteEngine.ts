/**
 * BeloteEngine - Moteur de jeu Belote simplifie
 * Jeu de plis par equipes utilisant le paquet espagnol de 40 cartes
 *
 * Regles:
 * - 4 joueurs en 2 equipes (joueurs 0,2 vs 1,3)
 * - Paquet espagnol 40 cartes: 4 couleurs (bastos, copas, espadas, oros) x valeurs (1-7, 10-12)
 * - Chaque joueur recoit 5 cartes (20 cartes au total)
 * - Phase d'encheres: les joueurs encherissent pour choisir l'atout ou passent
 * - Phase de jeu: jouer des plis, obligation de suivre la couleur, l'atout bat tout
 * - Ordre des atouts: 11(valet)>1(as)>12(roi)>10(sota)>7>6>5>4>3>2
 * - Ordre hors atout: 1(as)>12(roi)>11(caballo)>10(sota)>7>6>5>4>3>2
 * - L'equipe avec le plus de plis gagne la manche
 * - Score simplifie: chaque pli = 1 point, cible 10 plis au total
 */

// ============================================================
// TYPES
// ============================================================

export type Suit = 'bastos' | 'copas' | 'espadas' | 'oros';
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  value: CardValue;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isBot: boolean;
  team: number; // 0 or 1
}

export type GamePhase =
  | 'waiting'
  | 'bidding'
  | 'playing'
  | 'trick_end'
  | 'round_end'
  | 'game_over';

export interface Trick {
  cards: { playerId: string; card: Card }[];
  leadSuit: Suit;
  winnerId: string;
}

export interface Bid {
  playerId: string;
  suit: Suit | null; // null = pass
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  deck: Card[];
  trumpSuit: Suit | null;
  bids: Bid[];
  bidWinnerId: string | null;
  currentTrick: { playerId: string; card: Card }[];
  tricks: Trick[];
  teamScores: [number, number]; // [team0, team1]
  roundNumber: number;
  winnerId: string | null; // winning team: "team-0" or "team-1"
  targetScore: number;
  lastTrickWinner: string | null;
}

export type GameAction =
  | { type: 'JOIN'; playerId: string; playerName: string; isBot?: boolean; team: number }
  | { type: 'START_GAME' }
  | { type: 'BID'; playerId: string; suit: Suit | null }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string }
  | { type: 'NEXT_TRICK' }
  | { type: 'NEW_ROUND' }
  | { type: 'RESET' };

// ============================================================
// CONSTANTS
// ============================================================

export const SUITS: Suit[] = ['bastos', 'copas', 'espadas', 'oros'];
export const VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export const SUIT_NAMES: Record<Suit, string> = {
  bastos: 'Batons',
  copas: 'Coupes',
  espadas: 'Epees',
  oros: 'Deniers',
};

export const VALUE_NAMES: Record<CardValue, string> = {
  1: 'As',
  2: 'Deux',
  3: 'Trois',
  4: 'Quatre',
  5: 'Cinq',
  6: 'Six',
  7: 'Sept',
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
};

/** Trump card strength order (higher index = stronger) */
export const TRUMP_ORDER: CardValue[] = [2, 3, 4, 5, 6, 7, 10, 12, 1, 11];

/** Non-trump card strength order (higher index = stronger) */
export const NON_TRUMP_ORDER: CardValue[] = [2, 3, 4, 5, 6, 7, 10, 11, 12, 1];

export const PLAYERS_COUNT = 4;
export const CARDS_PER_PLAYER = 5;
export const DEFAULT_TARGET_SCORE = 10;

// ============================================================
// DECK
// ============================================================

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      const valueStr = value.toString().padStart(2, '0');
      deck.push({
        suit,
        value,
        id: `${valueStr}-${suit}`,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================
// DEALING
// ============================================================

export function dealCards(
  players: Player[],
  deck: Card[]
): { players: Player[]; remainingDeck: Card[] } {
  const shuffled = shuffleDeck(deck);
  let idx = 0;

  const updatedPlayers = players.map((player) => {
    const hand = shuffled.slice(idx, idx + CARDS_PER_PLAYER);
    idx += CARDS_PER_PLAYER;
    return { ...player, hand };
  });

  return { players: updatedPlayers, remainingDeck: shuffled.slice(idx) };
}

// ============================================================
// CARD STRENGTH
// ============================================================

export function getCardStrength(card: Card, trumpSuit: Suit | null): number {
  const isTrump = card.suit === trumpSuit;
  const order = isTrump ? TRUMP_ORDER : NON_TRUMP_ORDER;
  const baseStrength = order.indexOf(card.value);
  // Trump cards are always stronger than non-trump
  return isTrump ? baseStrength + 100 : baseStrength;
}

export function getPlayableCards(
  hand: Card[],
  leadSuit: Suit | null,
  trumpSuit: Suit | null,
  currentTrick: { playerId: string; card: Card }[]
): Card[] {
  if (!leadSuit) return hand; // Leading the trick, can play anything

  // Must follow suit if possible
  const suitCards = hand.filter((c) => c.suit === leadSuit);
  if (suitCards.length > 0) return suitCards;

  // Can't follow suit: must play trump if possible
  if (trumpSuit) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (trumpCards.length > 0) return trumpCards;
  }

  // Can't follow suit and no trumps: play anything
  return hand;
}

// ============================================================
// TRICK RESOLUTION
// ============================================================

export function resolveTrick(
  trick: { playerId: string; card: Card }[],
  trumpSuit: Suit | null
): string {
  if (trick.length === 0) throw new Error('Empty trick');

  const leadSuit = trick[0].card.suit;
  let winnerId = trick[0].playerId;
  let winnerStrength = getCardStrength(trick[0].card, trumpSuit);
  let winnerIsTrump = trick[0].card.suit === trumpSuit;

  for (let i = 1; i < trick.length; i++) {
    const entry = trick[i];
    const isTrump = entry.card.suit === trumpSuit;
    const strength = getCardStrength(entry.card, trumpSuit);

    if (isTrump && !winnerIsTrump) {
      // Trump beats non-trump
      winnerId = entry.playerId;
      winnerStrength = strength;
      winnerIsTrump = true;
    } else if (isTrump === winnerIsTrump) {
      if (isTrump) {
        // Both trump: higher strength wins
        if (strength > winnerStrength) {
          winnerId = entry.playerId;
          winnerStrength = strength;
        }
      } else if (entry.card.suit === leadSuit && strength > winnerStrength) {
        // Both non-trump, same lead suit: higher strength wins
        winnerId = entry.playerId;
        winnerStrength = strength;
      } else if (entry.card.suit === leadSuit && trick[0].card.suit !== leadSuit) {
        // This card follows lead suit but winner doesn't
        winnerId = entry.playerId;
        winnerStrength = strength;
      }
    }
  }

  return winnerId;
}

// ============================================================
// BOT AI
// ============================================================

export function botBid(
  bot: Player,
  bids: Bid[]
): Suit | null {
  // Count cards per suit
  const suitCounts: Record<Suit, number> = { bastos: 0, copas: 0, espadas: 0, oros: 0 };
  const suitStrength: Record<Suit, number> = { bastos: 0, copas: 0, espadas: 0, oros: 0 };

  for (const card of bot.hand) {
    suitCounts[card.suit]++;
    suitStrength[card.suit] += TRUMP_ORDER.indexOf(card.value);
  }

  // Find best suit (most cards, then highest strength)
  let bestSuit: Suit | null = null;
  let bestCount = 0;
  let bestStr = 0;

  for (const suit of SUITS) {
    if (suitCounts[suit] > bestCount || (suitCounts[suit] === bestCount && suitStrength[suit] > bestStr)) {
      bestCount = suitCounts[suit];
      bestStr = suitStrength[suit];
      bestSuit = suit;
    }
  }

  // Only bid if we have 2+ cards of the suit and decent strength
  if (bestCount >= 2 && bestStr >= 8) {
    // Check if someone already bid this suit
    const alreadyBid = bids.some((b) => b.suit === bestSuit);
    if (!alreadyBid) return bestSuit;
  }

  // 30% chance to bid anyway if no one has bid yet
  const anyBid = bids.some((b) => b.suit !== null);
  if (!anyBid && Math.random() < 0.3 && bestSuit) return bestSuit;

  return null; // pass
}

export function botPlay(state: GameState): { cardId: string } {
  const bot = state.players[state.currentPlayerIndex];
  if (!bot || bot.hand.length === 0) {
    throw new Error('Bot has no cards');
  }

  const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
  const playable = getPlayableCards(bot.hand, leadSuit, state.trumpSuit, state.currentTrick);

  if (playable.length === 1) {
    return { cardId: playable[0].id };
  }

  // Strategy: if leading, play strongest non-trump
  if (state.currentTrick.length === 0) {
    // Lead with a strong non-trump card
    const nonTrump = playable.filter((c) => c.suit !== state.trumpSuit);
    if (nonTrump.length > 0) {
      const sorted = nonTrump.sort((a, b) =>
        getCardStrength(b, state.trumpSuit) - getCardStrength(a, state.trumpSuit)
      );
      return { cardId: sorted[0].id };
    }
  }

  // If last to play in trick, play minimum winning card
  if (state.currentTrick.length === PLAYERS_COUNT - 1) {
    const currentWinner = resolveTrick(state.currentTrick, state.trumpSuit);
    const winnerTeam = state.players.find((p) => p.id === currentWinner)?.team;

    if (winnerTeam === bot.team) {
      // Partner is winning, play lowest
      const sorted = playable.sort((a, b) =>
        getCardStrength(a, state.trumpSuit) - getCardStrength(b, state.trumpSuit)
      );
      return { cardId: sorted[0].id };
    }
  }

  // Try to win with minimum strength
  if (state.currentTrick.length > 0) {
    const currentWinnerStrength = Math.max(
      ...state.currentTrick.map((e) => {
        // Only consider cards that can win
        if (e.card.suit === state.trumpSuit) return getCardStrength(e.card, state.trumpSuit);
        if (e.card.suit === state.currentTrick[0].card.suit) return getCardStrength(e.card, state.trumpSuit);
        return -1;
      })
    );

    const winners = playable.filter((c) => getCardStrength(c, state.trumpSuit) > currentWinnerStrength);
    if (winners.length > 0) {
      // Play weakest winning card
      winners.sort((a, b) => getCardStrength(a, state.trumpSuit) - getCardStrength(b, state.trumpSuit));
      return { cardId: winners[0].id };
    }
  }

  // Can't win: play lowest value
  const sorted = playable.sort((a, b) =>
    getCardStrength(a, state.trumpSuit) - getCardStrength(b, state.trumpSuit)
  );
  return { cardId: sorted[0].id };
}

// ============================================================
// GAME STATE MANAGEMENT
// ============================================================

export function initGame(
  playerNames: string[],
  botCount: number,
  targetScore: number = DEFAULT_TARGET_SCORE
): GameState {
  const state = createInitialState(targetScore);
  let current = state;

  // Player is always index 0, team 0
  for (let i = 0; i < playerNames.length; i++) {
    current = gameReducer(current, {
      type: 'JOIN',
      playerId: `player-${i + 1}`,
      playerName: playerNames[i],
      isBot: false,
      team: i % 2, // players 0,2 = team 0; players 1,3 = team 1
    });
  }

  const botNames = ['Pierre', 'Marie', 'Jean'];
  for (let i = 0; i < botCount; i++) {
    const teamIndex = (playerNames.length + i) % 2;
    current = gameReducer(current, {
      type: 'JOIN',
      playerId: `bot-${i + 1}`,
      playerName: botNames[i % botNames.length],
      isBot: true,
      team: teamIndex,
    });
  }

  current = gameReducer(current, { type: 'START_GAME' });
  return current;
}

export function createInitialState(
  targetScore: number = DEFAULT_TARGET_SCORE
): GameState {
  return {
    phase: 'waiting',
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    trumpSuit: null,
    bids: [],
    bidWinnerId: null,
    currentTrick: [],
    tricks: [],
    teamScores: [0, 0],
    roundNumber: 0,
    winnerId: null,
    targetScore,
    lastTrickWinner: null,
  };
}

export function createBots(count: number, startTeam: number = 1): GameAction[] {
  const botNames = ['Pierre', 'Marie', 'Jean'];
  return Array.from({ length: Math.min(count, botNames.length) }, (_, i) => ({
    type: 'JOIN' as const,
    playerId: `bot-${i + 1}`,
    playerName: botNames[i],
    isBot: true,
    team: (startTeam + i) % 2,
  }));
}

export function getWinner(state: GameState): string | null {
  return state.winnerId;
}

// ============================================================
// REDUCER
// ============================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'JOIN': {
      if (state.phase !== 'waiting') return state;
      if (state.players.length >= PLAYERS_COUNT) return state;
      if (state.players.find((p) => p.id === action.playerId)) return state;

      const newPlayer: Player = {
        id: action.playerId,
        name: action.playerName,
        hand: [],
        isBot: action.isBot || false,
        team: action.team,
      };

      return { ...state, players: [...state.players, newPlayer] };
    }

    case 'START_GAME': {
      if (state.players.length !== PLAYERS_COUNT) return state;

      const deck = createDeck();
      const { players, remainingDeck } = dealCards(state.players, deck);

      return {
        ...state,
        phase: 'bidding',
        players,
        deck: remainingDeck,
        currentPlayerIndex: 0,
        bids: [],
        bidWinnerId: null,
        currentTrick: [],
        tricks: [],
        roundNumber: state.roundNumber + 1,
        lastTrickWinner: null,
      };
    }

    case 'BID': {
      if (state.phase !== 'bidding') return state;
      const pIdx = state.players.findIndex((p) => p.id === action.playerId);
      if (pIdx !== state.currentPlayerIndex) return state;

      const newBids = [...state.bids, { playerId: action.playerId, suit: action.suit }];

      // Check if bidding is done
      if (newBids.length >= PLAYERS_COUNT) {
        // Find the last player who bid a suit
        const winningBid = [...newBids].reverse().find((b) => b.suit !== null);

        if (!winningBid) {
          // Everyone passed: force first player's strongest suit as trump
          const firstPlayer = state.players[0];
          const suitCounts: Record<Suit, number> = { bastos: 0, copas: 0, espadas: 0, oros: 0 };
          for (const card of firstPlayer.hand) suitCounts[card.suit]++;
          const forcedSuit = SUITS.reduce((a, b) => suitCounts[a] >= suitCounts[b] ? a : b);

          return {
            ...state,
            phase: 'playing',
            bids: newBids,
            trumpSuit: forcedSuit,
            bidWinnerId: firstPlayer.id,
            currentPlayerIndex: 0,
          };
        }

        return {
          ...state,
          phase: 'playing',
          bids: newBids,
          trumpSuit: winningBid.suit,
          bidWinnerId: winningBid.playerId,
          currentPlayerIndex: state.players.findIndex((p) => p.id === winningBid.playerId),
        };
      }

      return {
        ...state,
        bids: newBids,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % PLAYERS_COUNT,
      };
    }

    case 'PLAY_CARD': {
      if (state.phase !== 'playing') return state;

      const playerIndex = state.players.findIndex((p) => p.id === action.playerId);
      if (playerIndex !== state.currentPlayerIndex) return state;

      const player = state.players[playerIndex];
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return state;

      // Validate the card is playable
      const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
      const playable = getPlayableCards(player.hand, leadSuit, state.trumpSuit, state.currentTrick);
      if (!playable.some((c) => c.id === card.id)) return state;

      const newHand = player.hand.filter((c) => c.id !== card.id);
      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = { ...player, hand: newHand };

      const newTrick = [...state.currentTrick, { playerId: player.id, card }];

      // Check if trick is complete
      if (newTrick.length >= PLAYERS_COUNT) {
        const winnerId = resolveTrick(newTrick, state.trumpSuit);
        const winnerTeam = updatedPlayers.find((p) => p.id === winnerId)!.team;

        const completedTrick: Trick = {
          cards: newTrick,
          leadSuit: newTrick[0].card.suit,
          winnerId,
        };

        const newTricks = [...state.tricks, completedTrick];
        const newScores: [number, number] = [...state.teamScores];
        newScores[winnerTeam] += 1;

        // Check if all cards played
        const allEmpty = updatedPlayers.every((p) => p.hand.length === 0);

        if (allEmpty) {
          // Determine round winner
          const winningTeam = newScores[0] > newScores[1] ? 0 : newScores[1] > newScores[0] ? 1 : -1;

          if (winningTeam === -1) {
            // Tie
            return {
              ...state,
              phase: 'round_end',
              players: updatedPlayers,
              currentTrick: [],
              tricks: newTricks,
              teamScores: newScores,
              lastTrickWinner: winnerId,
            };
          }

          // Check if game over
          if (newScores[winningTeam] >= state.targetScore) {
            return {
              ...state,
              phase: 'game_over',
              players: updatedPlayers,
              currentTrick: [],
              tricks: newTricks,
              teamScores: newScores,
              winnerId: `team-${winningTeam}`,
              lastTrickWinner: winnerId,
            };
          }

          return {
            ...state,
            phase: 'round_end',
            players: updatedPlayers,
            currentTrick: [],
            tricks: newTricks,
            teamScores: newScores,
            lastTrickWinner: winnerId,
          };
        }

        return {
          ...state,
          phase: 'trick_end',
          players: updatedPlayers,
          currentTrick: newTrick,
          tricks: newTricks,
          teamScores: newScores,
          lastTrickWinner: winnerId,
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        currentTrick: newTrick,
        currentPlayerIndex: (playerIndex + 1) % PLAYERS_COUNT,
      };
    }

    case 'NEXT_TRICK': {
      if (state.phase !== 'trick_end') return state;

      const winnerIdx = state.players.findIndex((p) => p.id === state.lastTrickWinner);

      return {
        ...state,
        phase: 'playing',
        currentTrick: [],
        currentPlayerIndex: winnerIdx >= 0 ? winnerIdx : 0,
      };
    }

    case 'NEW_ROUND': {
      if (state.phase !== 'round_end') return state;

      const deck = createDeck();
      const resetPlayers = state.players.map((p) => ({ ...p, hand: [] }));
      const { players, remainingDeck } = dealCards(resetPlayers, deck);

      return {
        ...state,
        phase: 'bidding',
        players,
        deck: remainingDeck,
        currentPlayerIndex: 0,
        trumpSuit: null,
        bids: [],
        bidWinnerId: null,
        currentTrick: [],
        tricks: [],
        roundNumber: state.roundNumber + 1,
        lastTrickWinner: null,
      };
    }

    case 'RESET': {
      return createInitialState(state.targetScore);
    }

    default:
      return state;
  }
}

// ============================================================
// HELPERS
// ============================================================

export function getCurrentPlayer(state: GameState): Player | null {
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length) {
    return null;
  }
  return state.players[state.currentPlayerIndex];
}

export function isPlayerTurn(state: GameState, playerId: string): boolean {
  const current = getCurrentPlayer(state);
  return current?.id === playerId && (state.phase === 'playing' || state.phase === 'bidding');
}

export function formatCard(card: Card): string {
  return `${VALUE_NAMES[card.value]} de ${SUIT_NAMES[card.suit]}`;
}

export function getTeamName(team: number): string {
  return team === 0 ? 'Equipe A' : 'Equipe B';
}

/**
 * Détection de blocage Belote :
 *  - 'allPassed' : phase 'bidding' avec un Bid.suit === null pour chacun
 *    des players × 2 (tous les joueurs ont passé aux 2 tours).
 *    → redistribution forcée par le donneur suivant.
 *  - 'none' : la partie progresse normalement.
 */
export type BeloteStuck = 'allPassed' | 'none';

export function detectStuck(state: GameState): BeloteStuck {
  if (state.phase !== 'bidding') return 'none';
  const passCount = state.bids.filter((b) => b.suit === null).length;
  if (passCount >= state.players.length * 2) return 'allPassed';
  return 'none';
}
