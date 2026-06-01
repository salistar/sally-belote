/**
 * @file game/local.tsx
 * @description Local Belote game screen (1 human + 3 bots, 2 teams)
 * @project SallyCards - Belote
 */

import React, { useReducer, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  GameState,
  GameAction,
  Suit,
  Card,
  gameReducer,
  createInitialState,
  getCurrentPlayer,
  isPlayerTurn,
  createBots,
  botPlay,
  botBid,
  getPlayableCards,
  getTeamName,
  detectStuck,
  SUIT_NAMES,
  SUITS,
} from '../../src/game/beloteEngine';
import {
  AdvancedGameState,
  Annonce,
  BOT_PRESETS,
  BotDifficulty,
  botBidAdvanced,
  botPlayAdvanced,
  detectAnnonces,
  hasBelote,
  resolveAnnonces,
  cardPoints,
} from '../../src/game/beloteEngine.advanced';
import { getCardImage, getCardBackImage } from '../../src/game/cardAssets';

function annonceLabel(a: Annonce): string {
  switch (a.type) {
    case 'tierce': return 'Tierce';
    case 'cinquante': return 'Cinquante';
    case 'cent': return 'Cent';
    case 'carre-valets': return 'Carré de Valets';
    case 'carre-neufs': return 'Carré de Neufs';
    case 'carre-autres': return 'Carré';
    case 'belote': return 'Belote';
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 58;
const CARD_HEIGHT = 87;

const PLAYER_ID = 'player-1';
const PLAYER_NAME = 'Vous';
const BRAND_COLOR = '#3498db';

const SUIT_SYMBOLS: Record<Suit, string> = {
  bastos: 'B',
  copas: 'C',
  espadas: 'E',
  oros: 'O',
};

export default function BeloteLocalScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ difficulty?: string }>();
  // Mapping URL param → preset bot. 'expert' (passé par la home) → 'hard'.
  const difficulty: BotDifficulty = useMemo(() => {
    const d = (params.difficulty || '').toLowerCase();
    if (d === 'easy') return 'easy';
    if (d === 'medium') return 'medium';
    if (d === 'expert' || d === 'hard') return 'hard';
    return 'medium';
  }, [params.difficulty]);
  const botConfig = BOT_PRESETS[difficulty];

  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [message, setMessage] = useState<string>('');
  const [showStuck, setShowStuck] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== État du moteur avancé (overlay, n'altère pas le reducer) =====
  /** Toutes les cartes déjà jouées dans la manche en cours (pour card-counting). */
  const [playedCards, setPlayedCards] = useState<Card[]>([]);
  /** Annonces détectées au début de la manche (toutes mains). */
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  /** Joueur qui a déclaré Belote (R+D atout). */
  const [beloteBy, setBeloteBy] = useState<string | null>(null);
  /** Bannière "Belote!" / "Rebelote!" temporaire. */
  const [beloteFlash, setBeloteFlash] = useState<'belote' | 'rebelote' | null>(null);
  /** Modal affichant les annonces gagnantes en début de manche. */
  const [showAnnoncesModal, setShowAnnoncesModal] = useState(false);

  // AdvancedGameState dérivé — utilisé par le bot pour card-counting + heuristique
  const advState: AdvancedGameState = useMemo(
    () => ({
      ...state,
      playedCards,
      annonces,
      beloteBy,
      contract: null,
      contre: 0 as const,
    }),
    [state, playedCards, annonces, beloteBy],
  );

  // Détection blocage : tous les joueurs ont passé aux 2 tours d'enchères
  useEffect(() => {
    if (showStuck) return;
    if (detectStuck(state) === 'allPassed') setShowStuck(true);
  }, [state, showStuck]);

  // Initialize game: 1 human (team 0) + 3 bots
  useEffect(() => {
    dispatch({ type: 'JOIN', playerId: PLAYER_ID, playerName: PLAYER_NAME, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-1', playerName: 'Pierre', isBot: true, team: 1 });
    dispatch({ type: 'JOIN', playerId: 'bot-2', playerName: 'Marie', isBot: true, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-3', playerName: 'Jean', isBot: true, team: 1 });
    const timer = setTimeout(() => dispatch({ type: 'START_GAME' }), 500);
    return () => {
      clearTimeout(timer);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, []);

  // Bot bidding — moteur avancé (botBidAdvanced avec niveau + humanisation)
  useEffect(() => {
    if (state.phase !== 'bidding') return;
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;

    botTimerRef.current = setTimeout(() => {
      const suit = botBidAdvanced(current, state.bids, botConfig);
      dispatch({ type: 'BID', playerId: current.id, suit });
      if (suit) {
        setMessage(`${current.name} propose ${SUIT_NAMES[suit]}!`);
      } else {
        setMessage(`${current.name} passe`);
      }
    }, 800 + Math.random() * 600);

    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [state.phase, state.currentPlayerIndex, state.bids.length, botConfig]);

  // Bot play logic — moteur avancé (botPlayAdvanced avec card-counting)
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;

    botTimerRef.current = setTimeout(() => {
      try {
        const move = botPlayAdvanced(advState, botConfig);
        dispatch({ type: 'PLAY_CARD', playerId: current.id, cardId: move.cardId });
      } catch {
        // fallback : si l'avancé plante (état partiel), retombe sur le bot simple
        try {
          const move = botPlay(state);
          dispatch({ type: 'PLAY_CARD', playerId: current.id, cardId: move.cardId });
        } catch { /* no-op */ }
      }
    }, 800 + Math.random() * 700);

    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [state.phase, state.currentPlayerIndex, state.currentTrick.length, advState, botConfig]);

  // ===== Détection annonces au début de la manche (phase: bidding→playing) =====
  // Quand le trumpSuit est fixé, on calcule les annonces de chaque main et
  // on les présente au joueur. C'est purement informatif (pas de scoring auto).
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (!state.trumpSuit) return;
    if (annonces.length > 0) return; // déjà calculé pour cette manche
    const allAnnonces: Annonce[] = [];
    for (const p of state.players) {
      allAnnonces.push(...detectAnnonces(p, state.trumpSuit));
    }
    if (allAnnonces.length === 0) return;
    setAnnonces(allAnnonces);
    // N'affiche la modale que s'il y a au moins une annonce ≥ tierce
    setShowAnnoncesModal(true);
  }, [state.phase, state.trumpSuit, state.players, annonces.length]);

  // ===== Tracking playedCards (toutes les cartes posées dans la manche) =====
  useEffect(() => {
    // Quand un pli se termine, on rajoute ses cartes au pool "joué"
    if (state.tricks.length === 0) return;
    const last = state.tricks[state.tricks.length - 1];
    setPlayedCards((prev) => {
      const existing = new Set(prev.map((c) => c.id));
      const merged = [...prev];
      for (const e of last.cards) if (!existing.has(e.card.id)) merged.push(e.card);
      return merged;
    });
  }, [state.tricks.length]);

  // ===== Détection Belote/Rebelote (R+D atout joués par le même joueur) =====
  // Quand une carte est posée dans le pli courant, si c'est R ou D d'atout
  // et que ce joueur a Belote (R+D), on déclenche le flash + on mémorise.
  useEffect(() => {
    if (state.currentTrick.length === 0) return;
    if (!state.trumpSuit) return;
    const last = state.currentTrick[state.currentTrick.length - 1];
    const isTrumpKingOrQueen = last.card.suit === state.trumpSuit
      && (last.card.value === 12 || last.card.value === 11);
    if (!isTrumpKingOrQueen) return;
    const player = state.players.find((p) => p.id === last.playerId);
    if (!player) return;
    // Avant ce coup, le joueur avait-il R+D atout dans sa main ? On recompose.
    const cardsStillInHand = player.hand;
    const cardsHePlayedSoFar = [
      ...state.tricks.flatMap((t) => t.cards.filter((c) => c.playerId === player.id).map((c) => c.card)),
      ...state.currentTrick.filter((c) => c.playerId === player.id).map((c) => c.card),
    ];
    const trumpKQ = [...cardsStillInHand, ...cardsHePlayedSoFar]
      .filter((c) => c.suit === state.trumpSuit && (c.value === 11 || c.value === 12));
    const uniqueValues = new Set(trumpKQ.map((c) => c.value));
    if (uniqueValues.size === 2) {
      // Ce joueur détient Belote
      if (beloteBy !== player.id) {
        setBeloteBy(player.id);
        setBeloteFlash('belote');
        setMessage(`${player.name === 'Vous' ? 'Vous' : player.name} : Belote!`);
      } else {
        setBeloteFlash('rebelote');
        setMessage(`${player.name === 'Vous' ? 'Vous' : player.name} : Rebelote!`);
      }
    }
  }, [state.currentTrick.length, state.trumpSuit]);

  // Reset état avancé à chaque nouvelle manche
  useEffect(() => {
    if (state.phase === 'bidding' && state.roundNumber > 0 && state.tricks.length === 0) {
      // On vient de relancer une manche → reset overlay
      setPlayedCards([]);
      setAnnonces([]);
      setBeloteBy(null);
      setBeloteFlash(null);
      setShowAnnoncesModal(false);
    }
  }, [state.phase, state.roundNumber]);

  // Auto-clear flash
  useEffect(() => {
    if (!beloteFlash) return;
    const t = setTimeout(() => setBeloteFlash(null), 1800);
    return () => clearTimeout(t);
  }, [beloteFlash]);

  // Auto-advance after trick
  useEffect(() => {
    if (state.phase !== 'trick_end') return;
    const winner = state.players.find((p) => p.id === state.lastTrickWinner);
    setMessage(`${winner?.name || '?'} remporte le pli!`);
    const timer = setTimeout(() => {
      dispatch({ type: 'NEXT_TRICK' });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.phase, state.tricks.length]);

  // Clear message
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  const handleBid = useCallback((suit: Suit | null) => {
    dispatch({ type: 'BID', playerId: PLAYER_ID, suit });
    if (suit) {
      setMessage(`Vous proposez ${SUIT_NAMES[suit]}!`);
    }
  }, []);

  const handleCardPress = useCallback((cardId: string) => {
    if (state.phase !== 'playing') return;
    if (!isPlayerTurn(state, PLAYER_ID)) return;

    const player = state.players.find((p) => p.id === PLAYER_ID);
    if (!player) return;

    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const playable = getPlayableCards(player.hand, leadSuit, state.trumpSuit, state.currentTrick);

    if (!playable.some((c) => c.id === cardId)) {
      setMessage('Vous devez suivre la couleur!');
      return;
    }

    dispatch({ type: 'PLAY_CARD', playerId: PLAYER_ID, cardId });
  }, [state]);

  const handleNewRound = useCallback(() => {
    dispatch({ type: 'NEW_ROUND' });
    setMessage('');
  }, []);

  const handlePlayAgain = useCallback(() => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'JOIN', playerId: PLAYER_ID, playerName: PLAYER_NAME, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-1', playerName: 'Pierre', isBot: true, team: 1 });
    dispatch({ type: 'JOIN', playerId: 'bot-2', playerName: 'Marie', isBot: true, team: 0 });
    dispatch({ type: 'JOIN', playerId: 'bot-3', playerName: 'Jean', isBot: true, team: 1 });
    setTimeout(() => dispatch({ type: 'START_GAME' }), 300);
  }, []);

  const humanPlayer = state.players.find((p) => p.id === PLAYER_ID);
  const isMyTurn = isPlayerTurn(state, PLAYER_ID);
  const isBiddingTurn = state.phase === 'bidding' && getCurrentPlayer(state)?.id === PLAYER_ID;

  // Get opponents (other players)
  const otherPlayers = state.players.filter((p) => p.id !== PLAYER_ID);
  const partner = state.players.find((p) => p.id !== PLAYER_ID && p.team === humanPlayer?.team);

  // Playable cards
  const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
  const playableCards = humanPlayer
    ? getPlayableCards(humanPlayer.hand, leadSuit, state.trumpSuit, state.currentTrick)
    : [];

  return (
    <LinearGradient colors={['#0a0a1a', '#111128', '#0a0a1a']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Belote</Text>
            {state.trumpSuit && (
              <Text style={styles.trumpText}>Atout: {SUIT_NAMES[state.trumpSuit]}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>Manche {state.roundNumber}</Text>
            </View>
            <View style={[styles.diffBadge, {
              backgroundColor: difficulty === 'hard' ? '#DC2626'
                : difficulty === 'medium' ? '#F59E0B' : '#10B981',
            }]}>
              <Text style={styles.diffBadgeText}>
                {difficulty === 'hard' ? t('diffHard') : difficulty === 'medium' ? t('diffMedium') : t('diffEasy')}
              </Text>
            </View>
          </View>
        </View>

        {/* Team scores */}
        <View style={styles.teamScores}>
          <View style={[styles.teamScore, humanPlayer?.team === 0 && styles.myTeam]}>
            <Text style={styles.teamName}>{getTeamName(0)}</Text>
            <Text style={styles.teamPoints}>{state.teamScores[0]}</Text>
          </View>
          <Text style={styles.vsText}>vs</Text>
          <View style={[styles.teamScore, humanPlayer?.team === 1 && styles.myTeam]}>
            <Text style={styles.teamName}>{getTeamName(1)}</Text>
            <Text style={styles.teamPoints}>{state.teamScores[1]}</Text>
          </View>
        </View>

        {/* Felt-green table containing opponents + trick area */}
        <LinearGradient
          colors={['#0F6B3F', '#0B4D2C', '#073521']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.feltTable}
        >
          {/* Decorative suit watermarks in the 4 table corners */}
          <Text style={[styles.feltSuit, { top: 6,    left: 10,  color: 'rgba(255,255,255,0.06)' }]}>♠</Text>
          <Text style={[styles.feltSuit, { top: 6,    right: 10, color: 'rgba(255,255,255,0.06)' }]}>♣</Text>
          <Text style={[styles.feltSuit, { bottom: 6, left: 10,  color: 'rgba(239,68,68,0.10)' }]}>♥</Text>
          <Text style={[styles.feltSuit, { bottom: 6, right: 10, color: 'rgba(239,68,68,0.10)' }]}>♦</Text>
          <View style={styles.feltInnerRing} pointerEvents="none" />

          {/* Trump chip (top right floating) */}
          {state.trumpSuit && state.phase !== 'bidding' && (
            <View style={styles.trumpChipFloat}>
              <Text style={styles.trumpChipText}>Atout {state.trumpSuit}</Text>
            </View>
          )}

          {/* Opponents */}
          <View style={styles.opponentsRow}>
            {otherPlayers.map((p) => (
              <View key={p.id} style={styles.opponentSlot}>
                <Text style={[styles.opponentName, p.team === humanPlayer?.team && styles.partnerName]}>
                  {p.name} {p.team === humanPlayer?.team ? '(E)' : ''}
                </Text>
                <View style={styles.opponentCards}>
                  {p.hand.map((_, i) => (
                    <Image key={i} source={getCardBackImage()} style={styles.tinyCard} />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Current trick area */}
          <View style={styles.trickArea}>
            <Text style={styles.trickLabel}>
              {state.phase === 'playing' ? `Pli ${state.tricks.length + 1}` : 'Pli'}
            </Text>
            <View style={styles.trickCards}>
              {state.currentTrick.map((entry) => {
                const p = state.players.find((pl) => pl.id === entry.playerId);
                return (
                  <View key={entry.card.id} style={styles.trickCardWrapper}>
                    <Image source={getCardImage(entry.card.id)} style={styles.trickCard} />
                    <Text style={styles.trickPlayerName}>{p?.name || '?'}</Text>
                  </View>
                );
              })}
              {state.currentTrick.length === 0 && state.phase === 'playing' && (
                <Text style={styles.emptyTrick}>En attente...</Text>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Status / Bidding */}
        <View style={styles.statusBar}>
          {state.phase === 'bidding' && isBiddingTurn ? (
            <View style={styles.biddingBar}>
              <Text style={styles.statusText}>Choisir l'atout:</Text>
              <View style={styles.bidButtons}>
                {SUITS.map((suit) => (
                  <TouchableOpacity
                    key={suit}
                    style={styles.bidButton}
                    onPress={() => handleBid(suit)}
                  >
                    <Text style={styles.bidButtonText}>{SUIT_NAMES[suit]}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.bidButton, styles.passButton]}
                  onPress={() => handleBid(null)}
                >
                  <Text style={styles.bidButtonText}>Passer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : state.phase === 'bidding' ? (
            <Text style={styles.statusText}>
              {getCurrentPlayer(state)?.name} encherit...
            </Text>
          ) : message ? (
            <Text style={styles.messageText}>{message}</Text>
          ) : state.phase === 'playing' ? (
            <Text style={styles.statusText}>
              {isMyTurn ? 'Votre tour - Jouez une carte' : `${getCurrentPlayer(state)?.name} joue...`}
            </Text>
          ) : state.phase === 'round_end' ? (
            <View style={styles.roundEndBar}>
              <Text style={styles.statusText}>
                Manche terminee! {getTeamName(0)}: {state.teamScores[0]} - {getTeamName(1)}: {state.teamScores[1]}
              </Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleNewRound}>
                <Text style={styles.actionButtonText}>Manche suivante</Text>
              </TouchableOpacity>
            </View>
          ) : state.phase === 'game_over' ? (
            <View style={styles.gameOverBar}>
              <Text style={styles.gameOverText}>
                {state.winnerId === `team-${humanPlayer?.team}` ? 'Votre equipe a gagne!' : 'L\'equipe adverse a gagne!'}
              </Text>
              <Text style={styles.finalScore}>
                {getTeamName(0)}: {state.teamScores[0]} - {getTeamName(1)}: {state.teamScores[1]}
              </Text>
              <TouchableOpacity style={styles.actionButton} onPress={handlePlayAgain}>
                <Text style={styles.actionButtonText}>Rejouer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.statusText}>En attente...</Text>
          )}
        </View>

        {/* Player hand */}
        <View style={styles.handArea}>
          <View style={styles.handLabel}>
            <Text style={styles.handLabelText}>Votre main ({humanPlayer?.hand.length || 0})</Text>
            {partner && <Text style={styles.partnerText}>Partenaire: {partner.name}</Text>}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handContainer}
          >
            {humanPlayer?.hand.map((card) => {
              const isPlayable = playableCards.some((c) => c.id === card.id);
              const isTrump = card.suit === state.trumpSuit;

              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => handleCardPress(card.id)}
                  disabled={!isMyTurn || state.phase !== 'playing'}
                  activeOpacity={0.7}
                  style={[
                    styles.handCardWrapper,
                    isPlayable && isMyTurn && styles.playableCard,
                    !isPlayable && isMyTurn && styles.unplayableCard,
                    isTrump && styles.trumpCard,
                  ]}
                >
                  <Image source={getCardImage(card.id)} style={styles.handCard} />
                  {isTrump && (
                    <View style={styles.trumpBadge}>
                      <Text style={styles.trumpBadgeText}>A</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Flash Belote/Rebelote (overlay temporaire) */}
        {beloteFlash && (
          <View pointerEvents="none" style={styles.beloteFlash}>
            <LinearGradient colors={['#F59E0B', '#DC2626']} style={styles.beloteFlashInner}>
              <Ionicons name="heart" size={22} color="#fff" />
              <Text style={styles.beloteFlashText}>
                {beloteFlash === 'belote' ? t('belote') : t('rebelote')}
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Modal annonces au début de la manche */}
        <Modal visible={showAnnoncesModal} transparent animationType="fade" onRequestClose={() => setShowAnnoncesModal(false)}>
          <View style={styles.modalBg}>
            <LinearGradient colors={['#1F2937', '#111827']} style={styles.modalCard}>
              <Ionicons name="trophy" size={42} color="#F59E0B" />
              <Text style={styles.modalTitle}>{t('annoncesTitle')}</Text>
              <Text style={styles.modalSub}>
                {(() => {
                  if (!state.trumpSuit) return '';
                  const r = resolveAnnonces(annonces, state.players, state.players[0].id);
                  if (r.winningTeam < 0) return t('annoncesNone');
                  return t('annoncesTeamGain', { team: getTeamName(r.winningTeam), points: r.totalPoints });
                })()}
              </Text>
              <ScrollView style={{ maxHeight: 200, alignSelf: 'stretch', marginTop: 12 }}>
                {annonces.map((a, i) => {
                  const p = state.players.find((pp) => pp.id === a.playerId);
                  return (
                    <View key={i} style={styles.annonceRow}>
                      <Text style={styles.annonceLabel}>{annonceLabel(a)}</Text>
                      <Text style={styles.annoncePlayer}>{p?.name ?? '?'}</Text>
                      <Text style={styles.annoncePts}>+{a.points}</Text>
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowAnnoncesModal(false)}
                style={[styles.actionButton, { marginTop: 14 }]}
              >
                <Text style={styles.actionButtonText}>OK</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* Modal blocage Belote : tous ont passé aux 2 tours */}
        <Modal visible={showStuck} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['#1F2937', '#111827']} style={{ padding: 28, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#F59E0B', minWidth: 280, maxWidth: 360 }}>
              <Text style={{ fontSize: 56 }}>↩️</Text>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>{t('stuck.title')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{t('stuck.body')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => { setShowStuck(false); dispatch({ type: 'START_GAME' } as GameAction); }} style={{ backgroundColor: '#F59E0B', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>🔄 {t('stuck.again')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowStuck(false)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{t('stuck.continue')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  trumpText: { color: BRAND_COLOR, fontSize: 11, fontWeight: '700' },
  scoreContainer: {
    backgroundColor: `${BRAND_COLOR}22`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  scoreLabel: { color: BRAND_COLOR, fontSize: 12, fontWeight: '700' },
  teamScores: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  teamScore: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  myTeam: {
    borderWidth: 1,
    borderColor: `${BRAND_COLOR}66`,
  },
  teamName: { color: '#888', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  teamPoints: { color: '#fff', fontSize: 22, fontWeight: '900' },
  vsText: { color: '#555', fontSize: 12, fontWeight: '700' },
  opponentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  opponentSlot: { alignItems: 'center' },
  opponentName: { color: '#888', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  partnerName: { color: BRAND_COLOR },
  opponentCards: {
    flexDirection: 'row',
    gap: 1,
  },
  tinyCard: { width: 22, height: 33, borderRadius: 3 },
  feltTable: {
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 24, borderWidth: 4, borderColor: '#3a230f',
    paddingHorizontal: 14, paddingVertical: 16,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  feltSuit: { position: 'absolute', fontSize: 90, fontWeight: '900' },
  feltInnerRing: {
    position: 'absolute', top: 18, left: 18, right: 18, bottom: 18,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  trumpChipFloat: {
    position: 'absolute', top: 12, right: 14, zIndex: 5,
    backgroundColor: 'rgba(252,211,77,0.95)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  trumpChipText: { color: '#0A1535', fontWeight: '900', fontSize: 11, letterSpacing: 0.4 },
  trickArea: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  trickLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10, letterSpacing: 1.2,
  },
  trickCards: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minHeight: CARD_HEIGHT + 20,
  },
  trickCardWrapper: { alignItems: 'center' },
  trickCard: {
    width: CARD_WIDTH + 6,
    height: CARD_HEIGHT + 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  trickPlayerName: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, fontWeight: '600' },
  emptyTrick: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontStyle: 'italic' },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  biddingBar: { alignItems: 'center', gap: 8 },
  bidButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  bidButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  passButton: { backgroundColor: '#555' },
  bidButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  roundEndBar: { alignItems: 'center', gap: 8 },
  gameOverBar: { alignItems: 'center', gap: 6 },
  gameOverText: { color: '#fbbf24', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  finalScore: { color: '#888', fontSize: 13 },
  actionButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  handArea: {
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  handLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  handLabelText: { color: '#888', fontSize: 11 },
  partnerText: { color: BRAND_COLOR, fontSize: 11 },
  handContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  handCardWrapper: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playableCard: {
    borderColor: `${BRAND_COLOR}88`,
  },
  unplayableCard: {
    opacity: 0.4,
  },
  trumpCard: {},
  handCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 6,
  },
  trumpBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f39c12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trumpBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  // === Badge difficulté (header) ===
  diffBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6,
  },
  diffBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  // === Flash Belote/Rebelote (overlay) ===
  beloteFlash: {
    position: 'absolute',
    top: '40%',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  beloteFlashInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 26, paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  beloteFlashText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },

  // === Modal annonces ===
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 380,
    padding: 24, borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2, borderColor: '#F59E0B',
  },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  modalSub: { color: '#F59E0B', fontSize: 14, fontWeight: '700', marginTop: 4 },
  annonceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 6,
  },
  annonceLabel: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  annoncePlayer: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginRight: 10 },
  annoncePts: { color: '#10B981', fontSize: 14, fontWeight: '900' },
});
