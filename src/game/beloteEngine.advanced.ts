/**
 * @file beloteEngine.advanced.ts
 * @description Améliorations du moteur Belote :
 *   - Annonces (tierce 20, quarte 50, cinquante 50, cent 100, deux-cents 200)
 *   - Belote / rebelote (R+D atout = +20 pts)
 *   - Card counting (le bot suit les atouts déjà joués)
 *   - Bot avec 3 niveaux : easy / medium / hard
 *   - Évaluation de main en "points Belote" pour botBid
 *   - Variante Coinche (annonce d'un contrat 80..capot)
 *
 * Ce fichier est ADDITIF : il étend beloteEngine.ts sans modifier l'API
 * existante. Les écrans Belote peuvent migrer progressivement.
 */

import {
  Card,
  CardValue,
  Suit,
  Player,
  GameState,
  TRUMP_ORDER,
  NON_TRUMP_ORDER,
  PLAYERS_COUNT,
  getCardStrength,
  getPlayableCards,
  resolveTrick,
  SUITS,
} from './beloteEngine';

// ============================================================
// 1. VALEURS POINTS BELOTE OFFICIELS (pour scoring + bid)
// ============================================================

/** Points d'une carte à l'atout. */
export const TRUMP_POINTS: Record<CardValue, number> = {
  11: 20, // Valet = 20
  10: 14, //  9   = 14  (10 = sota en espagnol = 9 français — adapté)
  1: 11,  //  As  = 11
  12: 4,  //  Roi = 4
  7: 3,   //  Dame= 3 (CardValue=12 reste Roi ; on adapte les espagnols)
  6: 0, 5: 0, 4: 0, 3: 0, 2: 0,
};

/** Points d'une carte hors atout. */
export const NON_TRUMP_POINTS: Record<CardValue, number> = {
  1: 11, 12: 10, 11: 4, 10: 3, 7: 2,
  6: 0, 5: 0, 4: 0, 3: 0, 2: 0,
};

/** Total des points en jeu par manche (sans annonces) = 162. */
export const TOTAL_ROUND_POINTS = 162;

export function cardPoints(card: Card, trumpSuit: Suit | null): number {
  if (trumpSuit && card.suit === trumpSuit) return TRUMP_POINTS[card.value] ?? 0;
  return NON_TRUMP_POINTS[card.value] ?? 0;
}

// ============================================================
// 2. ANNONCES (à déclarer avant de jouer la 2e carte du 1er pli)
// ============================================================

export type AnnonceType =
  | 'tierce'        // 3 cartes consécutives même couleur (+20)
  | 'cinquante'     // 4 cartes consécutives (+50)
  | 'cent'          // 5+ cartes consécutives (+100)
  | 'carre-valets'  // 4 valets (+200)
  | 'carre-neufs'   // 4 neufs (+150)
  | 'carre-autres'  // 4 As / 10 / Roi / Dame (+100)
  | 'belote';       // Roi + Dame d'atout (+20, déclaré en jouant)

export interface Annonce {
  type: AnnonceType;
  playerId: string;
  points: number;
  cards: Card[];  // les cartes qui composent l'annonce
}

const SUIT_VALUE_ORDER: CardValue[] = [1, 12, 11, 10, 7, 6, 5, 4, 3, 2];

/** Détecte toutes les annonces possibles dans une main. */
export function detectAnnonces(player: Player, trumpSuit: Suit): Annonce[] {
  const found: Annonce[] = [];

  // 1) Suites par couleur
  for (const suit of SUITS) {
    const cards = player.hand
      .filter((c) => c.suit === suit)
      .sort((a, b) => SUIT_VALUE_ORDER.indexOf(a.value) - SUIT_VALUE_ORDER.indexOf(b.value));
    // Recherche de séquences consécutives dans SUIT_VALUE_ORDER
    let run: Card[] = [];
    for (const c of cards) {
      if (run.length === 0) {
        run = [c];
        continue;
      }
      const prevIdx = SUIT_VALUE_ORDER.indexOf(run[run.length - 1].value);
      const curIdx = SUIT_VALUE_ORDER.indexOf(c.value);
      if (curIdx === prevIdx + 1) {
        run.push(c);
      } else {
        if (run.length >= 3) {
          found.push(makeRunAnnonce(player.id, run));
        }
        run = [c];
      }
    }
    if (run.length >= 3) found.push(makeRunAnnonce(player.id, run));
  }

  // 2) Carrés (4 cartes de même valeur dans la main)
  const byValue: Record<number, Card[]> = {};
  for (const c of player.hand) {
    (byValue[c.value] ??= []).push(c);
  }
  for (const [val, group] of Object.entries(byValue)) {
    if (group.length !== 4) continue;
    const v = Number(val) as CardValue;
    if (v === 11) {
      found.push({ type: 'carre-valets', playerId: player.id, points: 200, cards: group });
    } else if (v === 9 || v === 10 /* selon ordre espagnol/français */) {
      found.push({ type: 'carre-neufs', playerId: player.id, points: 150, cards: group });
    } else if (v === 1 || v === 12 || v === 7 || v === 6) {
      found.push({ type: 'carre-autres', playerId: player.id, points: 100, cards: group });
    }
  }

  return found;
}

function makeRunAnnonce(playerId: string, run: Card[]): Annonce {
  if (run.length === 3) {
    return { type: 'tierce', playerId, points: 20, cards: run };
  }
  if (run.length === 4) {
    return { type: 'cinquante', playerId, points: 50, cards: run };
  }
  return { type: 'cent', playerId, points: 100, cards: run };
}

/** Vérifie la belote/rebelote : R+D d'atout dans la même main. */
export function hasBelote(player: Player, trumpSuit: Suit): boolean {
  const trumpCards = player.hand.filter((c) => c.suit === trumpSuit);
  return trumpCards.some((c) => c.value === 12) && trumpCards.some((c) => c.value === 11);
}

/** Trouve l'équipe qui remporte la "bataille des annonces" : la plus grosse annonce
 *  gagne pour TOUTE son équipe. En cas d'égalité, l'équipe du donneur l'emporte. */
export function resolveAnnonces(
  annonces: Annonce[],
  players: Player[],
  dealerId: string,
): { winningTeam: number; totalPoints: number; winningAnnonces: Annonce[] } {
  if (annonces.length === 0) return { winningTeam: -1, totalPoints: 0, winningAnnonces: [] };

  const byTeam: Record<number, Annonce[]> = { 0: [], 1: [] };
  for (const a of annonces) {
    const p = players.find((pp) => pp.id === a.playerId);
    if (p) byTeam[p.team].push(a);
  }

  const maxOf = (xs: Annonce[]) => xs.reduce((m, x) => (x.points > m ? x.points : m), 0);
  const m0 = maxOf(byTeam[0]);
  const m1 = maxOf(byTeam[1]);

  let winningTeam: number;
  if (m0 > m1) winningTeam = 0;
  else if (m1 > m0) winningTeam = 1;
  else {
    // Egalité => dealer's team wins
    const dealer = players.find((p) => p.id === dealerId);
    winningTeam = dealer ? dealer.team : 0;
  }

  const winning = byTeam[winningTeam];
  return {
    winningTeam,
    totalPoints: winning.reduce((s, a) => s + a.points, 0),
    winningAnnonces: winning,
  };
}

// ============================================================
// 3. CARD COUNTING (extension du GameState)
// ============================================================

export interface AdvancedGameState extends GameState {
  /** Toutes les cartes déjà jouées (toutes mains confondues). */
  playedCards: Card[];
  /** Annonces déclarées au début de la manche. */
  annonces: Annonce[];
  /** Belote/rebelote déclarée par le joueur ? */
  beloteBy: string | null;
  /** Annonce de contrat (Coinche) : 80, 90, ..., 250, capot. */
  contract: number | null;
  /** Contrée / sur-contrée. */
  contre: 0 | 1 | 2; // 0 = normal, 1 = coinché, 2 = sur-coinché
}

/** Crée un state avancé à partir d'un GameState basique. */
export function upgradeState(state: GameState): AdvancedGameState {
  return {
    ...state,
    playedCards: [],
    annonces: [],
    beloteBy: null,
    contract: null,
    contre: 0,
  };
}

/** Cartes encore en jeu d'une couleur (pour le card counting). */
export function remainingOfSuit(
  state: AdvancedGameState,
  suit: Suit,
  knownCards: Card[] = [], // cartes du bot lui-même
): Card[] {
  const seen = new Set<string>(
    [...state.playedCards, ...knownCards].filter((c) => c.suit === suit).map((c) => c.id),
  );
  const all: Card[] = [];
  for (const v of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as CardValue[]) {
    const id = `${suit}-${v}`;
    if (!seen.has(id)) all.push({ suit, value: v, id });
  }
  return all;
}

/** Probabilité qu'un adversaire ait au moins une carte d'atout > value donnée. */
export function probAdversaireBeatsAtout(
  state: AdvancedGameState,
  bot: Player,
  value: CardValue,
): number {
  if (!state.trumpSuit) return 0;
  const remaining = remainingOfSuit(state, state.trumpSuit, bot.hand);
  const higher = remaining.filter((c) => TRUMP_ORDER.indexOf(c.value) > TRUMP_ORDER.indexOf(value));
  if (remaining.length === 0) return 0;
  // Approx : probabilité = nb_higher / nb_remaining * nb_adversaires_actifs (2)
  return Math.min(1, (higher.length / remaining.length) * 2);
}

// ============================================================
// 4. BOT AVEC 3 NIVEAUX DE DIFFICULTE
// ============================================================

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotConfig {
  /** Niveau de difficulté. */
  difficulty: BotDifficulty;
  /** Variabilité (probabilité de jouer un coup sous-optimal) — pour humaniser. */
  randomness: number;
}

export const BOT_PRESETS: Record<BotDifficulty, BotConfig> = {
  easy:   { difficulty: 'easy',   randomness: 0.30 },
  medium: { difficulty: 'medium', randomness: 0.10 },
  hard:   { difficulty: 'hard',   randomness: 0.00 },
};

/** Évalue la valeur en "points Belote" d'une main pour un atout donné. */
export function evaluateHand(hand: Card[], trumpSuit: Suit): number {
  let pts = 0;
  let trumpsCount = 0;
  for (const c of hand) {
    pts += cardPoints(c, trumpSuit);
    if (c.suit === trumpSuit) trumpsCount++;
  }
  // Bonus pour beaucoup d'atouts (chacun > 3 = +5)
  if (trumpsCount > 3) pts += (trumpsCount - 3) * 5;
  // Pénalité si zéro atout
  if (trumpsCount === 0) pts -= 20;
  return pts;
}

/** Détermine le contrat optimal en Coinche (80, 90, ..., 250, capot=252) en fonction de la main. */
export function evaluateContract(hand: Card[], trumpSuit: Suit): number | null {
  const pts = evaluateHand(hand, trumpSuit);
  if (pts < 55) return null;         // Pas assez = passe
  if (pts < 65) return 80;
  if (pts < 75) return 90;
  if (pts < 85) return 100;
  if (pts < 100) return 110;
  if (pts < 130) return 130;
  if (pts < 160) return 160;
  if (pts < 200) return 200;
  return 252;                         // Capot
}

/** Décision d'enchère pour la Belote classique (atout seulement, pas de contrat). */
export function botBidAdvanced(
  bot: Player,
  bids: { playerId: string; suit: Suit | null }[],
  config: BotConfig,
): Suit | null {
  // Trouve la meilleure couleur (en points + atouts)
  let bestSuit: Suit | null = null;
  let bestScore = 0;
  for (const suit of SUITS) {
    const score = evaluateHand(bot.hand, suit);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  // Easy : prend même avec une main faible 50% du temps
  // Medium : prend si points >= 55
  // Hard  : prend si points >= 55 et personne n'a déjà annoncé une meilleure couleur
  const threshold = config.difficulty === 'easy' ? 45
                  : config.difficulty === 'medium' ? 55 : 60;

  if (bestScore < threshold) return null;

  const alreadyBidByOther = bids.some((b) => b.suit !== null);
  if (alreadyBidByOther && config.difficulty === 'hard') {
    // En Hard : on ne re-prend qu'une couleur strictement meilleure
    const minRequired = threshold + 10;
    if (bestScore < minRequired) return null;
  }

  // Humanisation
  if (Math.random() < config.randomness) {
    return Math.random() < 0.5 ? null : bestSuit;
  }
  return bestSuit;
}

/** Décision de jeu améliorée avec card counting. */
export function botPlayAdvanced(
  state: AdvancedGameState,
  config: BotConfig,
): { cardId: string } {
  const bot = state.players[state.currentPlayerIndex];
  if (!bot || bot.hand.length === 0) throw new Error('Bot has no cards');

  const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
  const playable = getPlayableCards(bot.hand, leadSuit, state.trumpSuit, state.currentTrick);
  if (playable.length === 1) return { cardId: playable[0].id };

  // Easy : 50% du temps choix random parmi playable
  if (config.difficulty === 'easy' && Math.random() < config.randomness) {
    return { cardId: playable[Math.floor(Math.random() * playable.length)].id };
  }

  // ----- HEURISTIQUE PRINCIPALE -----
  const trump = state.trumpSuit;

  // (1) Si on ouvre la levée
  if (state.currentTrick.length === 0) {
    return chooseOpener(state, bot, playable, config);
  }

  // (2) Si on est le dernier à jouer
  if (state.currentTrick.length === PLAYERS_COUNT - 1) {
    return chooseLastInTrick(state, bot, playable);
  }

  // (3) Au milieu : essayer de gagner avec carte minimum
  return chooseMidTrick(state, bot, playable);
}

function chooseOpener(
  state: AdvancedGameState,
  bot: Player,
  playable: Card[],
  config: BotConfig,
): { cardId: string } {
  // Hard : si on a beaucoup d'atouts (>3), sortir les atouts pour purger les adversaires
  if (config.difficulty === 'hard' && state.trumpSuit) {
    const trumpsInHand = bot.hand.filter((c) => c.suit === state.trumpSuit);
    if (trumpsInHand.length >= 3) {
      // Card counting : si l'adversaire a encore des atouts hauts, jouer la plus haute
      const remaining = remainingOfSuit(state as AdvancedGameState, state.trumpSuit, bot.hand);
      if (remaining.length > 0) {
        const sorted = playable
          .filter((c) => c.suit === state.trumpSuit)
          .sort((a, b) => getCardStrength(b, state.trumpSuit!) - getCardStrength(a, state.trumpSuit!));
        if (sorted.length > 0) return { cardId: sorted[0].id };
      }
    }
  }

  // Sinon : jouer la plus forte non-atout
  const nonTrump = playable.filter((c) => c.suit !== state.trumpSuit);
  if (nonTrump.length > 0) {
    const sorted = nonTrump.sort((a, b) =>
      getCardStrength(b, state.trumpSuit) - getCardStrength(a, state.trumpSuit));
    return { cardId: sorted[0].id };
  }
  // Sinon plus basse en main
  const sorted = playable.sort((a, b) =>
    getCardStrength(a, state.trumpSuit) - getCardStrength(b, state.trumpSuit));
  return { cardId: sorted[0].id };
}

function chooseLastInTrick(
  state: AdvancedGameState,
  bot: Player,
  playable: Card[],
): { cardId: string } {
  const currentWinner = resolveTrick(state.currentTrick, state.trumpSuit);
  const winnerTeam = state.players.find((p) => p.id === currentWinner)?.team;

  if (winnerTeam === bot.team) {
    // Partenaire gagne : on "charge" avec la carte la plus haute en points qui ne perd pas
    const sorted = playable.sort((a, b) =>
      cardPoints(b, state.trumpSuit) - cardPoints(a, state.trumpSuit));
    return { cardId: sorted[0].id };
  }

  // Adversaire gagne : on essaie de gagner avec la carte minimale
  return chooseMidTrick(state, bot, playable);
}

function chooseMidTrick(
  state: AdvancedGameState,
  bot: Player,
  playable: Card[],
): { cardId: string } {
  const currentWinnerStrength = Math.max(
    ...state.currentTrick.map((e) => {
      if (e.card.suit === state.trumpSuit) return getCardStrength(e.card, state.trumpSuit);
      if (e.card.suit === state.currentTrick[0].card.suit) return getCardStrength(e.card, state.trumpSuit);
      return -1;
    }),
  );

  const winners = playable.filter(
    (c) => getCardStrength(c, state.trumpSuit) > currentWinnerStrength,
  );
  if (winners.length > 0) {
    winners.sort((a, b) =>
      getCardStrength(a, state.trumpSuit) - getCardStrength(b, state.trumpSuit));
    return { cardId: winners[0].id };
  }
  // Ne peut pas gagner : défausse la plus faible en points
  const sorted = playable.sort((a, b) =>
    cardPoints(a, state.trumpSuit) - cardPoints(b, state.trumpSuit));
  return { cardId: sorted[0].id };
}

// ============================================================
// 5. SCORING AVEC ANNONCES
// ============================================================

export interface RoundScore {
  team0: number;
  team1: number;
  team0Annonces: number;
  team1Annonces: number;
  belote: { team: number; points: number } | null;
  contractMet: boolean | null;  // null si pas de contrat (Belote classique)
}

/** Calcule le score d'une manche en incluant annonces + belote. */
export function scoreRound(
  state: AdvancedGameState,
): RoundScore {
  // Points des plis
  let teamPoints: [number, number] = [0, 0];
  for (const trick of state.tricks) {
    const winner = state.players.find((p) => p.id === trick.winnerId);
    if (!winner) continue;
    const pts = trick.cards.reduce((s, e) => s + cardPoints(e.card, state.trumpSuit), 0);
    teamPoints[winner.team] += pts;
  }
  // Bonus 10 de der (dernière levée = +10)
  if (state.lastTrickWinner) {
    const w = state.players.find((p) => p.id === state.lastTrickWinner);
    if (w) teamPoints[w.team] += 10;
  }
  // Annonces : équipe gagnante prend toutes ses annonces
  const annonceResult = resolveAnnonces(state.annonces, state.players, state.players[0].id);
  const annoncePts: [number, number] = [0, 0];
  if (annonceResult.winningTeam >= 0) {
    annoncePts[annonceResult.winningTeam] = annonceResult.totalPoints;
  }
  // Belote
  let beloteResult: RoundScore['belote'] = null;
  if (state.beloteBy) {
    const p = state.players.find((pp) => pp.id === state.beloteBy);
    if (p) {
      teamPoints[p.team] += 20;
      beloteResult = { team: p.team, points: 20 };
    }
  }
  // Contrat (Coinche)
  let contractMet: boolean | null = null;
  if (state.contract !== null && state.bidWinnerId) {
    const taker = state.players.find((p) => p.id === state.bidWinnerId);
    if (taker) {
      const totalTaker = teamPoints[taker.team] + annoncePts[taker.team];
      contractMet = totalTaker >= state.contract;
      if (!contractMet) {
        // Chute : toute la donne va à l'adversaire (162 + annonces + bonus capot)
        const other = (taker.team === 0 ? 1 : 0) as 0 | 1;
        teamPoints = [0, 0];
        teamPoints[other] = TOTAL_ROUND_POINTS + (state.contract === 252 ? 250 : 0);
      } else {
        // Coinche / sur-coinche multiplie le contrat
        if (state.contre > 0) {
          const mult = state.contre === 1 ? 2 : 4;
          teamPoints[taker.team] = state.contract * mult;
        }
      }
    }
  }

  return {
    team0: teamPoints[0] + annoncePts[0],
    team1: teamPoints[1] + annoncePts[1],
    team0Annonces: annoncePts[0],
    team1Annonces: annoncePts[1],
    belote: beloteResult,
    contractMet,
  };
}
