/**
 * @file variants.ts — Catalogue de toutes les variantes Belote.
 * Note : tous les modes >1 joueur conservent le flow socket+STUN/TURN+Jitsi
 * existant via /room/create et /room/join. Le mode `vs-ai` est solo.
 */

export type VariantKey =
  | 'belote-classique-4p' | 'belote-courte-501' | 'belote-longue-1500'
  | 'coinche' | 'contree' | 'belote-bridgee'
  | 'sans-atout' | 'tout-atout'
  | 'belote-marocaine' | 'belote-2p' | 'belote-3p' | 'belote-5p'
  | 'vs-ai';

export interface Variant {
  key: VariantKey;
  engine: 'belote' | 'coinche' | 'sans-atout' | 'tout-atout' | 'belote-2p' | 'belote-3p' | 'belote-5p' | 'vs-ai';
  emoji: string;
  name: string;
  shortDesc: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  winRate: string;
  duration: string;
  cards: number;
  rules: { title: string; body: string }[];
  available: boolean;
  options?: { players?: 2|3|4|5; targetScore?: number; multi?: boolean; coinche?: boolean };
}

export const VARIANTS: Variant[] = [
  {
    key: 'belote-classique-4p', engine: 'belote',
    emoji: '🃏', name: 'Belote Classique',
    shortDesc: '4 joueurs en 2 équipes face-à-face — 1000 points.',
    difficulty: 3, winRate: '~50%', duration: '~1h', cards: 32,
    available: true, options: { players: 4, targetScore: 1000, multi: true },
    rules: [
      { title: 'Objectif', body: 'Atteindre 1000 points en plusieurs manches en équipe (2v2, partenaires face-à-face).' },
      { title: 'Cartes', body: '32 cartes : 7, 8, 9, 10, V, D, R, A dans les 4 couleurs ♠♥♦♣.' },
      { title: 'Hiérarchie à l\'atout', body: 'V (20 pts), 9 (14), A (11), 10 (10), R (4), D (3), 8 (0), 7 (0). Le Valet est le plus fort, surprise.' },
      { title: 'Hiérarchie hors atout', body: 'A (11), 10 (10), R (4), D (3), V (2), 9/8/7 (0). Total : 152 pts + 10 dix de der = 162.' },
      { title: 'Distribution', body: '5 + 3 cartes. La 21e carte est retournée comme atout proposé.' },
      { title: 'Phase d\'enchères', body: '2 tours : "Je prends" sur la couleur retournée puis sur une autre couleur. Si tout le monde passe → redistribution.' },
      { title: 'Annonces', body: 'Tierce (3 consécutives, +20), Cinquante (4, +50), Cent (5+, +100). Carrés : Valets +200, 9 +150, A/10/R/D +100.' },
      { title: 'Belote-Rebelote', body: 'R + D d\'atout dans la même main → +20 points (annoncer "Belote" puis "Rebelote" en jouant).' },
      { title: 'Règles strictes', body: 'Fournir la couleur. Si tu coupes, tu dois monter (atout supérieur si possible). Si partenaire est maître, tu peux pisser.' },
      { title: 'Preneur réussi', body: 'L\'équipe preneuse doit faire >81 points. Sinon "dedans" : tous les 162 pts vont à l\'adversaire.' },
      { title: 'Capot', body: 'Tous les 8 plis pour une équipe → +90 pts bonus.' },
      { title: 'Victoire', body: 'Première équipe à 1000 points.' },
    ],
  },
  {
    key: 'belote-courte-501', engine: 'belote', emoji: '⚡', name: 'Belote Courte',
    shortDesc: '501 points — partie rapide ~30 min.',
    difficulty: 2, winRate: '~50%', duration: '30 min', cards: 32, available: true,
    options: { players: 4, targetScore: 501, multi: true },
    rules: [
      { title: 'Différence', body: 'Mêmes règles que Belote classique mais score cible = 501 points.' },
      { title: 'Durée', body: '~30 min, idéal pour une pause café.' },
    ],
  },
  {
    key: 'belote-longue-1500', engine: 'belote', emoji: '⏳', name: 'Belote Longue',
    shortDesc: '1500 ou 2000 points — partie épique ~2h.',
    difficulty: 3, winRate: '~50%', duration: '~2h', cards: 32, available: true,
    options: { players: 4, targetScore: 1500, multi: true },
    rules: [
      { title: 'Différence', body: 'Score cible 1500 (parfois 2000). Plus de manches → plus de stratégie longue.' },
    ],
  },
  {
    key: 'coinche', engine: 'coinche', emoji: '🎯', name: 'Coinche',
    shortDesc: 'Belote avec enchères et multiplicateurs (×2, ×4).',
    difficulty: 4, winRate: '~50%', duration: '~1h', cards: 32, available: true,
    options: { players: 4, targetScore: 1000, multi: true, coinche: true },
    rules: [
      { title: 'Différence majeure', body: 'Avant la prise, on annonce un contrat en points (à partir de 80, par paliers de 10).' },
      { title: 'Coinche', body: 'L\'équipe adverse peut "coincher" (×2) si elle pense que tu ne réussiras pas.' },
      { title: 'Surcoinche', body: 'Le preneur peut "surcoincher" (×4).' },
      { title: 'Sans-atout / Tout-atout', body: 'Annonçables aussi avec hiérarchies spéciales.' },
      { title: 'Stratégie', body: 'Évaluation précise du contrat = clé. Annoncer trop haut = chute coûteuse.' },
    ],
  },
  {
    key: 'contree', engine: 'coinche', emoji: '⚔️', name: 'Contrée',
    shortDesc: 'Synonyme/variante de Coinche, contrats à partir de 80.',
    difficulty: 4, winRate: '~50%', duration: '~1h', cards: 32, available: true,
    options: { players: 4, targetScore: 1000, multi: true, coinche: true },
    rules: [
      { title: 'Variante', body: 'Très proche de la Coinche. Différences mineures selon les régions.' },
    ],
  },
  {
    key: 'belote-bridgee', engine: 'coinche', emoji: '🌉', name: 'Belote Bridgée',
    shortDesc: 'Annonces complexes façon bridge avant le jeu.',
    difficulty: 5, winRate: '~50%', duration: '~1h30', cards: 32, available: true,
    options: { players: 4, targetScore: 1000, multi: true },
    rules: [
      { title: 'Annonces', body: 'Système d\'annonces façon bridge (signaux entre partenaires).' },
      { title: 'Niveau', body: 'Pour joueurs expérimentés. Demande mémoire et logique.' },
    ],
  },
  {
    key: 'sans-atout', engine: 'sans-atout', emoji: '🚫', name: 'Sans-Atout',
    shortDesc: 'Pas d\'atout. As 19, 10 10, R 4, D 3, V 2, 9/8/7 0.',
    difficulty: 4, winRate: '~50%', duration: '~1h', cards: 32, available: true,
    options: { players: 4, targetScore: 1000, multi: true },
    rules: [
      { title: 'Mode', body: 'Aucune couleur n\'est atout. Hiérarchie unique pour toutes les couleurs.' },
      { title: 'Valeurs', body: 'As=19, 10=10, Roi=4, Dame=3, Valet=2, 9/8/7=0.' },
      { title: 'Total', body: '4 × 38 = 152 + 10 dix de der = 162.' },
    ],
  },
  {
    key: 'tout-atout', engine: 'tout-atout', emoji: '🌟', name: 'Tout-Atout',
    shortDesc: 'Toutes les couleurs sont atout (V 14, 9 9, A 6, 10 5, R 3, D 2).',
    difficulty: 4, winRate: '~50%', duration: '~1h', cards: 32, available: true,
    options: { players: 4, targetScore: 1000, multi: true },
    rules: [
      { title: 'Mode', body: 'Toutes les couleurs sont atout. Tu dois fournir + monter dans la couleur demandée.' },
      { title: 'Valeurs', body: 'Valet=14, 9=9, As=6, 10=5, Roi=3, Dame=2, 8/7=0.' },
      { title: 'Total', body: '4 × 39 = 156 + 10 dix de der = 162.' },
    ],
  },
  {
    key: 'belote-marocaine', engine: 'belote', emoji: '🇲🇦', name: 'Belote Marocaine',
    shortDesc: 'Variante populaire au Maroc, souvent rapide 501 pts.',
    difficulty: 3, winRate: '~50%', duration: '~30 min', cards: 32, available: true,
    options: { players: 4, targetScore: 501, multi: true },
    rules: [
      { title: 'Variante régionale', body: 'Bonus pour cartes maîtresses. Annonces parfois simplifiées.' },
      { title: 'Score', body: 'Souvent 501 points (rapide).' },
    ],
  },
  {
    key: 'belote-2p', engine: 'belote-2p', emoji: '👤', name: 'Belote à 2',
    shortDesc: 'Duel 2 joueurs avec pioche après chaque pli.',
    difficulty: 3, winRate: '~50%', duration: '~30 min', cards: 32, available: true,
    options: { players: 2, targetScore: 1000, multi: true },
    rules: [
      { title: 'Mode', body: '2 joueurs, 8 cartes chacun. Après chaque pli, on pioche dans le talon.' },
      { title: 'Hiérarchie', body: 'Identique à Belote 4 joueurs.' },
    ],
  },
  {
    key: 'belote-3p', engine: 'belote-3p', emoji: '👥', name: 'Belote à 3',
    shortDesc: '3 joueurs individuels, chacun pour soi.',
    difficulty: 3, winRate: '~33%', duration: '~45 min', cards: 32, available: true,
    options: { players: 3, targetScore: 1000, multi: true },
    rules: [
      { title: 'Mode', body: '3 joueurs, partie individuelle (pas d\'équipe).' },
      { title: 'Stratégie', body: 'Tactique différente : alliances temporaires en jeu.' },
    ],
  },
  {
    key: 'belote-5p', engine: 'belote-5p', emoji: '🎲', name: 'Belote à 5',
    shortDesc: '5 joueurs avec partenaire appelé (Roi appelé).',
    difficulty: 4, winRate: '~50%', duration: '~1h', cards: 32, available: true,
    options: { players: 5, targetScore: 1000, multi: true },
    rules: [
      { title: 'Mode', body: '5 joueurs. Le preneur "appelle" un partenaire en demandant un Roi (ex : "Roi de cœur").' },
      { title: 'Partenaire secret', body: 'Celui qui a ce Roi devient son partenaire (révélé au moment où il joue la carte).' },
      { title: 'Dynamique', body: '2v3 unique : tu peux ne pas savoir qui est ton partenaire au début.' },
    ],
  },
  {
    key: 'vs-ai', engine: 'vs-ai', emoji: '🤖', name: 'Solo vs IA',
    shortDesc: 'Solo contre 3 IA — entraînement sans socket.',
    difficulty: 3, winRate: '~50%', duration: '~30 min', cards: 32, available: true,
    options: { players: 4, targetScore: 1000 },
    rules: [
      { title: 'Mode', body: 'Solo : tu joues avec 1 IA partenaire face à 2 IA adverses.' },
      { title: 'Difficulté', body: 'IA "expert" qui suit les règles strictes (forcing, monter à l\'atout, signal partenaire).' },
      { title: 'Pas de socket', body: 'Mode hors-ligne, idéal pour s\'entraîner.' },
    ],
  },
];

export const AVAILABLE_VARIANTS = VARIANTS.filter((v) => v.available);
export function findVariant(key: string): Variant | undefined {
  return VARIANTS.find((v) => v.key === key);
}
