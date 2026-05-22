/**
 * @file game/coinche.tsx
 * @description Mode Coinche pour Belote (1 humain + 3 bots).
 *   - Phase d'enchères : chaque joueur annonce un contrat (80, 90, ..., 250,
 *     capot=252) sur une couleur d'atout, ou passe.
 *   - Le plus haut contrat l'emporte. Les autres peuvent coincher / sur-coincher.
 *   - Puis phase de jeu classique (reducer beloteEngine).
 *   - En fin de manche : scoreRound() compare points faits vs contrat,
 *     applique multiplicateur coinche, déclare réussite ou chute.
 *
 * Cet écran est ADDITIF — il ne touche pas à local.tsx ni au reducer.
 */
import React, { useReducer, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  GameState, Suit, gameReducer, createInitialState,
  getCurrentPlayer, isPlayerTurn, botPlay, getPlayableCards,
  getTeamName, SUIT_NAMES, SUITS, PLAYERS_COUNT,
} from '../../src/game/beloteEngine';
import {
  AdvancedGameState, BOT_PRESETS, BotDifficulty, botPlayAdvanced,
  evaluateContract, scoreRound,
} from '../../src/game/beloteEngine.advanced';
import { getCardImage, getCardBackImage } from '../../src/game/cardAssets';

const PLAYER_ID = 'player-1';
const PLAYER_NAME = 'Vous';
const CONTRACT_STEPS = [80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 250, 252]; // 252 = capot

interface CoincheBid {
  playerId: string;
  contract: number | null;  // null = pass
  suit: Suit | null;
}

interface CoincheState {
  /** Enchères posées en ordre. */
  bids: CoincheBid[];
  /** Index du joueur dont c'est le tour d'enchérir. */
  currentBidder: number;
  /** Phase locale : 'auction' → 'playing' → 'roundOver'. */
  phase: 'auction' | 'playing' | 'roundOver';
  /** 0 = normal, 1 = coinché, 2 = sur-coinché. */
  contre: 0 | 1 | 2;
  /** Joueur qui a coinché (côté adversaire du preneur). */
  contreBy: string | null;
}

export default function CoincheScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: BotDifficulty = useMemo(() => {
    const d = (params.difficulty || '').toLowerCase();
    if (d === 'easy') return 'easy';
    if (d === 'hard' || d === 'expert') return 'hard';
    return 'medium';
  }, [params.difficulty]);
  const botConfig = BOT_PRESETS[difficulty];

  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [coinche, setCoinche] = useState<CoincheState>({
    bids: [], currentBidder: 0, phase: 'auction', contre: 0, contreBy: null,
  });
  const [message, setMessage] = useState('');
  const [showRoundOver, setShowRoundOver] = useState(false);
  const [lastScore, setLastScore] = useState<ReturnType<typeof scoreRound> | null>(null);
  const [cumScore, setCumScore] = useState<[number, number]>([0, 0]);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ───── Init : 4 joueurs (1 humain + 3 bots) puis START_GAME (qui distribue) ─────
  useEffect(() => {
    dispatch({ type: 'JOIN', playerId: PLAYER_ID, playerName: PLAYER_NAME, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-1', playerName: 'Pierre', isBot: true, team: 1 });
    dispatch({ type: 'JOIN', playerId: 'bot-2', playerName: 'Marie',  isBot: true, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-3', playerName: 'Jean',   isBot: true, team: 1 });
    const t1 = setTimeout(() => dispatch({ type: 'START_GAME' }), 300);
    return () => { clearTimeout(t1); if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, []);

  // ───── ENCHÈRES : les bots décident, le joueur clique sur les boutons ─────
  useEffect(() => {
    if (coinche.phase !== 'auction') return;
    if (state.players.length < PLAYERS_COUNT) return;
    if (coinche.bids.length >= PLAYERS_COUNT) {
      // Tout le monde a parlé → résoudre
      resolveAuction();
      return;
    }
    const bidder = state.players[coinche.currentBidder];
    if (!bidder) return;
    if (!bidder.isBot) return; // attendre l'input humain

    botTimerRef.current = setTimeout(() => {
      // Décision bot : essaie chaque suit, prend la meilleure si elle bat le contrat actuel
      let best: { contract: number; suit: Suit } | null = null;
      for (const suit of SUITS) {
        const ev = evaluateContract(bidder.hand, suit);
        if (ev && (!best || ev > best.contract)) {
          best = { contract: ev, suit };
        }
      }
      const highest = currentHighest(coinche.bids);
      // En hard, le bot ne re-enchérit que strictement au-dessus
      const minRequired = highest ? highest + 10 : 80;
      if (!best || best.contract < minRequired) {
        // pass
        setCoinche((c) => ({ ...c, bids: [...c.bids, { playerId: bidder.id, contract: null, suit: null }], currentBidder: (c.currentBidder + 1) % PLAYERS_COUNT }));
        setMessage(`${bidder.name} passe`);
      } else {
        setCoinche((c) => ({ ...c, bids: [...c.bids, { playerId: bidder.id, contract: best!.contract, suit: best!.suit }], currentBidder: (c.currentBidder + 1) % PLAYERS_COUNT }));
        setMessage(`${bidder.name} : ${best.contract === 252 ? 'CAPOT' : best.contract} ${SUIT_NAMES[best.suit]}`);
      }
    }, 900 + Math.random() * 500);

    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [coinche.phase, coinche.currentBidder, coinche.bids.length, state.players.length]);

  function currentHighest(bids: CoincheBid[]): number | null {
    const valid = bids.filter((b) => b.contract !== null);
    if (valid.length === 0) return null;
    return Math.max(...valid.map((b) => b.contract!));
  }

  function lastTaker(bids: CoincheBid[]): CoincheBid | null {
    const valid = [...bids].reverse().find((b) => b.contract !== null);
    return valid ?? null;
  }

  function resolveAuction() {
    const taker = lastTaker(coinche.bids);
    if (!taker) {
      // Tout le monde a passé → redistribuer
      setMessage('Personne ne prend → redistribution');
      setTimeout(() => {
        dispatch({ type: 'NEW_ROUND' });
        setCoinche({ bids: [], currentBidder: 0, phase: 'auction', contre: 0, contreBy: null });
      }, 1500);
      return;
    }
    // Force le trumpSuit + bidWinnerId via une série de bids "fictifs" qui passeront,
    // puis le dernier prend le suit gagnant. Le reducer attend exactement PLAYERS_COUNT bids.
    // Trick : on dispatche 3 PASSes puis 1 BID(suit) du taker pour boucler le reducer.
    // Note : le reducer ne sait pas que les passes ont déjà été "consommées" côté Coinche,
    //        donc on remet à zéro et on rejoue. On accepte la double-saisie pour simplicité.
    // Approche plus simple : on contourne le reducer en construisant l'état "playing" via
    //        4 dispatches BID dans le bon ordre. On va faire ça.
    const dispatchBidsSequentially = async () => {
      for (let i = 0; i < PLAYERS_COUNT; i++) {
        const playerId = state.players[i].id;
        const suit = playerId === taker.playerId ? taker.suit : null;
        dispatch({ type: 'BID', playerId, suit });
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    setCoinche((c) => ({ ...c, phase: 'playing' }));
    setMessage(`${state.players.find((p) => p.id === taker.playerId)?.name} prend à ${taker.contract === 252 ? 'CAPOT' : taker.contract} ${SUIT_NAMES[taker.suit!]}`);
    dispatchBidsSequentially();
  }

  // ───── BOT play (advanced) pendant la phase playing ─────
  useEffect(() => {
    if (coinche.phase !== 'playing') return;
    if (state.phase !== 'playing') return;
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;

    const advState: AdvancedGameState = {
      ...state, playedCards: [], annonces: [], beloteBy: null,
      contract: lastTaker(coinche.bids)?.contract ?? null,
      contre: coinche.contre,
    };

    botTimerRef.current = setTimeout(() => {
      try {
        const move = botPlayAdvanced(advState, botConfig);
        dispatch({ type: 'PLAY_CARD', playerId: current.id, cardId: move.cardId });
      } catch {
        try {
          const move = botPlay(state);
          dispatch({ type: 'PLAY_CARD', playerId: current.id, cardId: move.cardId });
        } catch { /* ignore */ }
      }
    }, 800 + Math.random() * 600);
    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [coinche.phase, state.phase, state.currentPlayerIndex, state.currentTrick.length, botConfig]);

  // ───── Auto-avancement pli puis manche ─────
  useEffect(() => {
    if (state.phase !== 'trick_end') return;
    const winner = state.players.find((p) => p.id === state.lastTrickWinner);
    setMessage(`${winner?.name || '?'} remporte le pli !`);
    const t = setTimeout(() => dispatch({ type: 'NEXT_TRICK' }), 1300);
    return () => clearTimeout(t);
  }, [state.phase, state.tricks.length]);

  // Fin de manche : calcule scoreRound avec le contrat
  useEffect(() => {
    if (state.phase !== 'round_end' && state.phase !== 'game_over') return;
    if (coinche.phase !== 'playing') return;
    const taker = lastTaker(coinche.bids);
    const advState: AdvancedGameState = {
      ...state, playedCards: [], annonces: [], beloteBy: null,
      contract: taker?.contract ?? null,
      contre: coinche.contre,
    };
    const r = scoreRound(advState);
    setLastScore(r);
    setCumScore(([a, b]) => [a + r.team0, b + r.team1]);
    setShowRoundOver(true);
    setCoinche((c) => ({ ...c, phase: 'roundOver' }));
  }, [state.phase]);

  // ───── Actions joueur ─────
  const handlePlayerBid = useCallback((contract: number | null, suit: Suit | null) => {
    const playerId = PLAYER_ID;
    if (contract !== null) {
      const highest = currentHighest(coinche.bids);
      if (highest && contract <= highest) {
        setMessage(`Le contrat doit dépasser ${highest}`);
        return;
      }
    }
    setCoinche((c) => ({
      ...c,
      bids: [...c.bids, { playerId, contract, suit }],
      currentBidder: (c.currentBidder + 1) % PLAYERS_COUNT,
    }));
    setMessage(contract === null ? 'Vous passez' : `Vous : ${contract === 252 ? 'CAPOT' : contract} ${SUIT_NAMES[suit!]}`);
  }, [coinche.bids]);

  const handleCoinche = useCallback(() => {
    setCoinche((c) => ({ ...c, contre: 1, contreBy: PLAYER_ID }));
    setMessage('COINCHE !');
  }, []);

  const handleCardPress = useCallback((cardId: string) => {
    if (state.phase !== 'playing') return;
    if (!isPlayerTurn(state, PLAYER_ID)) return;
    const player = state.players.find((p) => p.id === PLAYER_ID);
    if (!player) return;
    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const playable = getPlayableCards(player.hand, leadSuit, state.trumpSuit, state.currentTrick);
    if (!playable.some((c) => c.id === cardId)) {
      setMessage('Vous devez suivre la couleur !');
      return;
    }
    dispatch({ type: 'PLAY_CARD', playerId: PLAYER_ID, cardId });
  }, [state]);

  const handleNextRound = useCallback(() => {
    dispatch({ type: 'NEW_ROUND' });
    setCoinche({ bids: [], currentBidder: 0, phase: 'auction', contre: 0, contreBy: null });
    setShowRoundOver(false);
    setLastScore(null);
  }, []);

  // ───── Auto-clear message ─────
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 2200);
    return () => clearTimeout(t);
  }, [message]);

  const humanPlayer = state.players.find((p) => p.id === PLAYER_ID);
  const isMyBidTurn = coinche.phase === 'auction' && state.players[coinche.currentBidder]?.id === PLAYER_ID;
  const isMyPlayTurn = coinche.phase === 'playing' && isPlayerTurn(state, PLAYER_ID);
  const highestBid = currentHighest(coinche.bids);
  const takerNow = lastTaker(coinche.bids);
  const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
  const playableCards = humanPlayer
    ? getPlayableCards(humanPlayer.hand, leadSuit, state.trumpSuit, state.currentTrick)
    : [];

  return (
    <LinearGradient colors={['#0a0a1a', '#111128', '#0a0a1a']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.title}>Coinche</Text>
            {takerNow && coinche.phase !== 'auction' && (
              <Text style={s.subtitle}>
                Contrat : {takerNow.contract === 252 ? 'CAPOT' : takerNow.contract} {SUIT_NAMES[takerNow.suit!]}
                {coinche.contre === 1 ? ' x2' : coinche.contre === 2 ? ' x4' : ''}
              </Text>
            )}
          </View>
          <View style={[s.diffBadge, {
            backgroundColor: difficulty === 'hard' ? '#DC2626' : difficulty === 'medium' ? '#F59E0B' : '#10B981',
          }]}>
            <Text style={s.diffBadgeText}>{difficulty.toUpperCase()}</Text>
          </View>
        </View>

        {/* Scores cumulés */}
        <View style={s.scores}>
          <View style={s.scoreBox}>
            <Text style={s.teamLabel}>{getTeamName(0)}</Text>
            <Text style={s.teamPts}>{cumScore[0]}</Text>
          </View>
          <Text style={s.vs}>vs</Text>
          <View style={s.scoreBox}>
            <Text style={s.teamLabel}>{getTeamName(1)}</Text>
            <Text style={s.teamPts}>{cumScore[1]}</Text>
          </View>
        </View>

        {/* Message */}
        {!!message && (
          <View style={s.msgBar}><Text style={s.msgText}>{message}</Text></View>
        )}

        {/* ───────── Phase ENCHÈRES ───────── */}
        {coinche.phase === 'auction' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
            <Text style={s.sectionTitle}>
              Enchères {coinche.bids.length}/{PLAYERS_COUNT}
              {highestBid ? ` · plus haute : ${highestBid}` : ''}
            </Text>
            {/* Historique bids */}
            {coinche.bids.map((b, i) => {
              const p = state.players.find((pp) => pp.id === b.playerId);
              return (
                <View key={i} style={s.bidRow}>
                  <Text style={s.bidPlayer}>{p?.name}</Text>
                  <Text style={s.bidValue}>
                    {b.contract === null ? 'PASSE' : `${b.contract === 252 ? 'CAPOT' : b.contract} ${SUIT_NAMES[b.suit!]}`}
                  </Text>
                </View>
              );
            })}

            {isMyBidTurn && (
              <View style={{ marginTop: 18 }}>
                <Text style={s.sectionTitle}>À vous : choisir un contrat</Text>
                {/* Contrats possibles */}
                <View style={s.contractGrid}>
                  {CONTRACT_STEPS.filter((c) => !highestBid || c > highestBid).map((c) => (
                    <View key={c} style={{ marginBottom: 8 }}>
                      <Text style={s.contractLabel}>{c === 252 ? 'CAPOT' : c}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {SUITS.map((suit) => (
                          <TouchableOpacity
                            key={`${c}-${suit}`}
                            style={s.suitBtn}
                            onPress={() => handlePlayerBid(c, suit)}
                          >
                            <Text style={s.suitBtnText}>{SUIT_NAMES[suit][0]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={s.passBtn} onPress={() => handlePlayerBid(null, null)}>
                  <Text style={s.passBtnText}>Passer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Aperçu main pendant enchères */}
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Votre main</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {humanPlayer?.hand.map((card) => (
                <Image key={card.id} source={getCardImage(card.id)} style={s.miniCard} />
              ))}
            </ScrollView>

            {/* Suggestion bot pour la main du joueur */}
            {isMyBidTurn && humanPlayer && (
              <View style={s.hintBox}>
                <Ionicons name="bulb-outline" size={14} color="#F59E0B" />
                <Text style={s.hintText}>
                  Conseil : {(() => {
                    let best: { c: number; s: Suit } | null = null;
                    for (const suit of SUITS) {
                      const ev = evaluateContract(humanPlayer.hand, suit);
                      if (ev && (!best || ev > best.c)) best = { c: ev, s: suit };
                    }
                    return best ? `${best.c} ${SUIT_NAMES[best.s]}` : 'passer';
                  })()}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* ───────── Phase PLAYING ───────── */}
        {coinche.phase === 'playing' && (
          <View style={{ flex: 1, padding: 14 }}>
            {/* Bouton coinche disponible une fois pour l'adversaire */}
            {coinche.contre === 0 && takerNow && state.players.find((p) => p.id === takerNow.playerId)?.team !== humanPlayer?.team && (
              <TouchableOpacity onPress={handleCoinche} style={s.coincheBtn}>
                <Text style={s.coincheBtnText}>⚡ COINCHER (x2)</Text>
              </TouchableOpacity>
            )}

            {/* Pli courant */}
            <View style={s.trickArea}>
              <Text style={s.trickLabel}>Pli {state.tricks.length + 1}/8</Text>
              <View style={s.trickRow}>
                {state.currentTrick.map((e) => (
                  <View key={e.card.id} style={{ alignItems: 'center' }}>
                    <Image source={getCardImage(e.card.id)} style={s.trickCard} />
                    <Text style={s.trickName}>{state.players.find((p) => p.id === e.playerId)?.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Main */}
            <Text style={s.handLabel}>
              {isMyPlayTurn ? 'À vous de jouer' : `${getCurrentPlayer(state)?.name} joue...`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 6 }}>
              {humanPlayer?.hand.map((card) => {
                const playable = playableCards.some((c) => c.id === card.id);
                const isTrump = card.suit === state.trumpSuit;
                return (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => handleCardPress(card.id)}
                    disabled={!isMyPlayTurn}
                    style={[
                      s.handCardWrap,
                      playable && isMyPlayTurn && s.playable,
                      !playable && isMyPlayTurn && { opacity: 0.4 },
                    ]}
                  >
                    <Image source={getCardImage(card.id)} style={s.handCard} />
                    {isTrump && <View style={s.trumpDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ───────── Modal fin de manche ───────── */}
        <Modal visible={showRoundOver} transparent animationType="fade">
          <View style={s.modalBg}>
            <LinearGradient colors={['#1F2937', '#111827']} style={s.modalCard}>
              <Ionicons
                name={lastScore?.contractMet ? 'checkmark-circle' : 'close-circle'}
                size={56}
                color={lastScore?.contractMet ? '#10B981' : '#EF4444'}
              />
              <Text style={s.modalTitle}>
                {lastScore?.contractMet ? 'Contrat tenu !' : 'CHUTE !'}
              </Text>
              <Text style={s.modalSub}>
                {takerNow?.contract === 252 ? 'CAPOT' : takerNow?.contract} {SUIT_NAMES[takerNow?.suit ?? 'oros']}
                {coinche.contre === 1 ? ' coinché' : coinche.contre === 2 ? ' sur-coinché' : ''}
              </Text>
              <View style={s.scoreSummary}>
                <Text style={s.scoreLine}>{getTeamName(0)} : <Text style={{ color: '#FCD34D', fontWeight: '900' }}>{lastScore?.team0 ?? 0}</Text></Text>
                <Text style={s.scoreLine}>{getTeamName(1)} : <Text style={{ color: '#FCD34D', fontWeight: '900' }}>{lastScore?.team1 ?? 0}</Text></Text>
              </View>
              <TouchableOpacity style={s.actionBtn} onPress={handleNextRound}>
                <Text style={s.actionBtnText}>Manche suivante</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#FCD34D', fontSize: 11, fontWeight: '700', marginTop: 2 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  scores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 8 },
  scoreBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 10, minWidth: 90 },
  teamLabel: { color: '#888', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  teamPts: { color: '#fff', fontSize: 22, fontWeight: '900' },
  vs: { color: '#555', fontSize: 12, fontWeight: '700' },

  msgBar: { padding: 8, backgroundColor: 'rgba(252,211,77,0.12)', marginHorizontal: 14, borderRadius: 8, marginBottom: 6 },
  msgText: { color: '#FCD34D', fontSize: 13, fontWeight: '700', textAlign: 'center' },

  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 4 },
  bidPlayer: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bidValue: { color: '#10B981', fontSize: 13, fontWeight: '800' },

  contractGrid: { marginTop: 4 },
  contractLabel: { color: '#FCD34D', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  suitBtn: { flex: 1, backgroundColor: '#3498db', paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  suitBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  passBtn: { backgroundColor: '#555', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  passBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 8, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8 },
  hintText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },

  miniCard: { width: 42, height: 62, borderRadius: 4 },

  coincheBtn: { backgroundColor: '#DC2626', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  coincheBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  trickArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trickLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 8 },
  trickRow: { flexDirection: 'row', gap: 8 },
  trickCard: { width: 58, height: 87, borderRadius: 6 },
  trickName: { color: '#888', fontSize: 9, marginTop: 2 },

  handLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  handCardWrap: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  playable: { borderColor: '#3498db' },
  handCard: { width: 58, height: 87, borderRadius: 6 },
  trumpDot: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FCD34D' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#FCD34D', minWidth: 290 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  modalSub: { color: '#FCD34D', fontSize: 13, fontWeight: '700', marginTop: 4 },
  scoreSummary: { marginTop: 14, gap: 4 },
  scoreLine: { color: '#fff', fontSize: 14 },
  actionBtn: { backgroundColor: '#FCD34D', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  actionBtnText: { color: '#0A1F44', fontSize: 14, fontWeight: '900' },
});
