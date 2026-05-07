/**
 * @file game/local.tsx
 * @description Local Belote game screen (1 human + 3 bots, 2 teams)
 * @project SallyCards - Belote
 */

import React, { useReducer, useCallback, useEffect, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  GameState,
  GameAction,
  Suit,
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
import { getCardImage, getCardBackImage } from '../../src/game/cardAssets';

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
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [message, setMessage] = useState<string>('');
  const [showStuck, setShowStuck] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Bot bidding
  useEffect(() => {
    if (state.phase !== 'bidding') return;
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;

    botTimerRef.current = setTimeout(() => {
      const suit = botBid(current, state.bids);
      dispatch({ type: 'BID', playerId: current.id, suit });
      if (suit) {
        setMessage(`${current.name} propose ${SUIT_NAMES[suit]}!`);
      } else {
        setMessage(`${current.name} passe`);
      }
    }, 800 + Math.random() * 600);

    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [state.phase, state.currentPlayerIndex, state.bids.length]);

  // Bot play logic
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const current = getCurrentPlayer(state);
    if (!current || !current.isBot) return;

    botTimerRef.current = setTimeout(() => {
      try {
        const move = botPlay(state);
        dispatch({ type: 'PLAY_CARD', playerId: current.id, cardId: move.cardId });
      } catch {
        // Bot error
      }
    }, 800 + Math.random() * 700);

    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [state.phase, state.currentPlayerIndex, state.currentTrick.length]);

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
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Manche {state.roundNumber}</Text>
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
  trickArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trickLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
  trickCards: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    minHeight: CARD_HEIGHT + 20,
  },
  trickCardWrapper: { alignItems: 'center' },
  trickCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  trickPlayerName: { color: '#888', fontSize: 9, marginTop: 2 },
  emptyTrick: { color: 'rgba(255,255,255,0.2)', fontSize: 13, fontStyle: 'italic' },
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
});
