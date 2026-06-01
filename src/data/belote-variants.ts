/**
 * @file belote-variants.ts
 * @description Catalogue centralisé des 7 grandes variantes officielles de
 * la Belote. Chaque variante définit : nb de joueurs supportés, type de
 * deck (32 / 36), enchères, primes, scoring, exceptions de règles, et un
 * paragraphe de présentation traduit FR / EN / AR / ES / Darija.
 *
 * Source : règles officielles FFB (Fédération Française de Belote),
 * Wikipedia (FR/EN), Académie des Jeux Hubert (variantes Maghreb),
 * Bridge & Belote — Encyclopédie des jeux de cartes (Pole Editions).
 *
 * Utilisé par :
 *   - apps/mobile/belote/app/rules.tsx          → écran règles
 *   - apps/mobile/belote/app/room/create.tsx    → picker variante
 *   - apps/mobile/belote/app/game/local.tsx     → moteur scoring
 *   - apps/api/src/modules/games/belote.service → règles serveur autorité
 */

export type Lang = 'fr' | 'en' | 'ar' | 'es' | 'darija';
export type VariantId =
  | 'classique'       // 4j 2v2, contrat simple "je prends / passe"
  | 'coinche'         // 4j 2v2, enchères 80→Capot+coinche/surcoinche
  | 'contree'         // 4j 2v2, variante de Coinche FR (contre/sur-contre)
  | 'belote-bridgee'  // 4j 2v2, contrats nommés type bridge
  | 'belote-3j'       // 3 joueurs, chacun pour soi, 24 cartes (sans 7-8)
  | 'belote-5j'       // 5 joueurs, 1 contre 4 ("la mort" tournante)
  | 'belote-marocaine'; // 4j 2v2, Darija/Maghreb : annonces orales, 16 cartes

export interface VariantTexts {
  name:        Record<Lang, string>;
  tagline:     Record<Lang, string>;
  overview:    Record<Lang, string>;
  bidding:     Record<Lang, string>;
  scoring:     Record<Lang, string>;
  bonuses:     Record<Lang, string>;
  endgame:     Record<Lang, string>;
}

export interface Variant {
  id:          VariantId;
  emoji:       string;
  // joueurs supportés (modes acceptés à la création de salon)
  players:     number[];
  // jeu : 32 = 7→A (4 couleurs), 24 = 9→A (3j), 16 = T→A (Marocaine simplifiée)
  deckSize:    32 | 24 | 16;
  // target score d'une partie complète (en points-belote)
  target:      number;
  // possibilité de jouer en "tout atout" / "sans atout"
  hasAllTrump: boolean;
  hasNoTrump:  boolean;
  // enchères chiffrées (Coinche/Contrée) vs simple "prends/passe"
  numericBid:  boolean;
  // peut être contrée (x2) et sur-contrée (x4)
  canCoinche:  boolean;
  // multiplicateur de jeu pour Capot (toutes les levées)
  capotPoints: number;
  // Belote+Rebelote (R+Q d'atout dans la même main)
  beloteBonus: number;
  // dix-de-der (10 pts au dernier pli)
  dixDeDer:    number;
  // annonces (carré, tierce, quinte, etc.)
  hasAnnounces: boolean;
  // texts par langue
  i18n:        VariantTexts;
}

// ─────────────────────────────────────────────────────────────────────────
// 1) BELOTE CLASSIQUE  (variante par défaut, la plus jouée en France)
// ─────────────────────────────────────────────────────────────────────────
const CLASSIQUE: Variant = {
  id: 'classique',
  emoji: '♠️',
  players: [4],
  deckSize: 32,
  target: 501,
  hasAllTrump: false,
  hasNoTrump: false,
  numericBid: false,
  canCoinche: false,
  capotPoints: 250,
  beloteBonus: 20,
  dixDeDer: 10,
  hasAnnounces: true,
  i18n: {
    name: {
      fr: 'Belote Classique',
      en: 'Classic Belote',
      ar: 'بلوت كلاسيكية',
      es: 'Belote Clásica',
      darija: 'البلوت العادية',
    },
    tagline: {
      fr: '4 joueurs · 2v2 · 32 cartes · contrat simple',
      en: '4 players · 2v2 · 32 cards · simple contract',
      ar: '٤ لاعبين · ٢×٢ · ٣٢ ورقة · عقد بسيط',
      es: '4 jugadores · 2v2 · 32 cartas · contrato simple',
      darija: '4 لاعبين · زوج ضد زوج · 32 ورقة',
    },
    overview: {
      fr: 'La Belote classique se joue à 4 en équipes de 2 (Nord/Sud contre Est/Ouest), avec un jeu de 32 cartes (7 à As dans les 4 couleurs). On distribue 5 cartes par joueur (3+2), on retourne la 33ème pour proposer l\'atout. Premier tour : chacun peut "prendre" la carte retournée comme atout ; deuxième tour : on peut choisir un autre atout. Si tout le monde passe, on redistribue.',
      en: 'Classic Belote is played by 4 in teams of 2 (North/South vs East/West) with a 32-card deck (7 to Ace in all 4 suits). Each player gets 5 cards (3+2) and the 33rd is flipped to propose trump. First round: anyone may "take" the flipped card as trump; second round: anyone may pick a different trump. If everyone passes, redeal.',
      ar: 'تُلعب البلوت الكلاسيكية بأربعة لاعبين في فريقين من اثنين (الشمال/الجنوب ضد الشرق/الغرب) بمجموعة من ٣٢ ورقة (٧ إلى الآس في الأربعة ألوان). يحصل كل لاعب على ٥ أوراق (٣+٢)، وتُقلب الورقة الثالثة والثلاثون لاقتراح الأتو.',
      es: 'La Belote clásica se juega entre 4 en equipos de 2 (Norte/Sur contra Este/Oeste) con una baraja de 32 cartas (7 al As en los 4 palos). Cada jugador recibe 5 cartas (3+2) y la carta 33 se voltea para proponer el triunfo.',
      darija: 'البلوت العادية كتلعب 4 ديال اللاعبين، زوج ضد زوج. كل لاعب كياخد 5 ديال الأوراق. كنقلبو ورقة باش نشوفو شكون كياخد الأتو.',
    },
    bidding: {
      fr: 'Tour 1 : chaque joueur dans le sens des aiguilles peut dire "Je prends" (= la carte retournée devient son atout) ou "Passe". Tour 2 : si tout le monde a passé, chacun peut nommer une autre couleur comme atout. Le preneur reçoit la carte retournée + 2 cartes ; les autres reçoivent 3 cartes.',
      en: 'Round 1: each player (clockwise) may say "I take" (the flipped card becomes their trump) or "Pass". Round 2: if everyone passed, each may name a different suit as trump. The taker gets the flipped card + 2; others get 3 cards.',
      ar: 'الجولة الأولى: كل لاعب يستطيع قول "آخذ" (الورقة المقلوبة تصبح أتو) أو "أمرر". الجولة الثانية: إذا مرّ الجميع، يمكن لكل لاعب اختيار لون آخر أتواً.',
      es: 'Ronda 1: cada jugador (en sentido horario) puede decir "Tomo" (la carta volteada se vuelve su triunfo) o "Paso". Ronda 2: si todos pasaron, cada uno puede nombrar otro palo como triunfo.',
      darija: 'الدورة الأولى: كل لاعب يقدر يقول "خاد" (الأتو) أو "باسي". إيلا باسات الكل، تجي الدورة 2 وكل واحد يقدر يختار لون آخر.',
    },
    scoring: {
      fr: 'Total des points dans le deck = 152 + 10 (dix-de-der) = 162. À l\'atout : V=20, 9=14, A=11, 10=10, R=4, D=3, 8=0, 7=0. Hors atout : A=11, 10=10, R=4, D=3, V=2, 9=0, 8=0, 7=0. L\'équipe preneuse doit faire AU MOINS la moitié des points pour réussir le contrat.',
      en: 'Total points in the deck = 152 + 10 (last trick) = 162. At trump: J=20, 9=14, A=11, 10=10, K=4, Q=3, 8=0, 7=0. Off trump: A=11, 10=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0. The taking team must score AT LEAST half the points to make the contract.',
      ar: 'مجموع النقاط في المجموعة = ١٥٢ + ١٠ (آخر يد) = ١٦٢. في الأتو: الولد=٢٠، التسعة=١٤، الآس=١١، العشرة=١٠، الملك=٤، الملكة=٣.',
      es: 'Puntos totales en la baraja = 152 + 10 (última baza) = 162. En triunfo: J=20, 9=14, A=11, 10=10, R=4, D=3. Fuera de triunfo: A=11, 10=10, R=4, D=3, J=2.',
      darija: 'مجموع النقط 162. فالأتو الولد كياخد 20 والتسعة 14 والآس 11 والعشرة 10. خارج الأتو الآس 11 والعشرة 10.',
    },
    bonuses: {
      fr: 'Belote-Rebelote : +20 si vous avez Roi+Dame d\'atout dans la même main (annoncez "Belote" en jouant le premier, "Rebelote" en jouant le second). Annonces : tierce (3 cartes consécutives même couleur) = 20, quarte = 50, quinte = 100, carré (4 cartes même valeur) = 100, carré de 9 = 150, carré de Valet = 200. Capot (toutes les 8 levées) = +90.',
      en: 'Belote-Rebelote: +20 if you have K+Q of trump in the same hand (announce "Belote" on the first played, "Rebelote" on the second). Sequences: tierce (3 in a row same suit) = 20, quarte = 50, quinte = 100, four-of-a-kind = 100, four 9s = 150, four Jacks = 200. Capot (all 8 tricks) = +90.',
      ar: 'بلوت-ريبلوت: +٢٠ إذا كان لديك ملك+ملكة الأتو في نفس اليد. الإعلانات: ثلاثية=٢٠، رباعية=٥٠، خماسية=١٠٠، أربعة من نفس النوع=١٠٠، أربعة تسعات=١٥٠، أربعة أولاد=٢٠٠. الكابو (كل اليدين)=+٩٠.',
      es: 'Belote-Rebelote: +20 si tienes Rey+Dama de triunfo en la misma mano. Secuencias: terna=20, cuarta=50, quinta=100, póker=100, póker de 9=150, póker de J=200. Capote (todas las bazas)=+90.',
      darija: 'بلوت-ريبلوت = +20 إيلا عندك الملك والملكة ديال الأتو. الإعلانات: تيرس=20، كاطر=50، شواهد كبار=100، كرّي=100.',
    },
    endgame: {
      fr: 'Le contrat est "rempli" si l\'équipe preneuse fait > 81 pts (la moitié + 1). Sinon "chute" : 0 pt pour le preneur, 162 pour les défenseurs. Premier à 501 points (en cumulant les manches) gagne la partie.',
      en: 'The contract is "made" if the taking team scores > 81 pts (half + 1). Otherwise "down": 0 pts to the taker, 162 to defenders. First to 501 points (across multiple rounds) wins the game.',
      ar: 'العقد "محقق" إذا حقق الفريق الآخذ > ٨١ نقطة. وإلا "ساقط": ٠ للآخذ، ١٦٢ للمدافعين. أول من يصل إلى ٥٠١ نقطة يفوز.',
      es: 'El contrato se "cumple" si el equipo tomador hace > 81 ptos (la mitad + 1). Si no se "cae": 0 ptos al tomador, 162 al defensor. El primero en 501 puntos gana la partida.',
      darija: 'العقد كيتدار ميا ميا إيلا الفريق الآخذ دار أكثر من 81. إيلا لا، 0 ليه و162 للأعداء. أول واحد كيوصل ل501 كيربح.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 2) COINCHE (Belote contrée, version la plus jouée en compétition FR)
// ─────────────────────────────────────────────────────────────────────────
const COINCHE: Variant = {
  id: 'coinche',
  emoji: '🎯',
  players: [4],
  deckSize: 32,
  target: 1000,
  hasAllTrump: true,
  hasNoTrump: true,
  numericBid: true,
  canCoinche: true,
  capotPoints: 250,
  beloteBonus: 20,
  dixDeDer: 10,
  hasAnnounces: true,
  i18n: {
    name: {
      fr: 'Coinche', en: 'Coinche', ar: 'كوانش', es: 'Coinche', darija: 'كوانش',
    },
    tagline: {
      fr: 'Enchères 80→Capot · contre x2 · surcontre x4',
      en: 'Bids 80→Capot · double x2 · redouble x4',
      ar: 'مزايدات ٨٠←كابو · مضاعفة ×٢ · إعادة ×٤',
      es: 'Apuestas 80→Capot · contra x2 · sobre-contra x4',
      darija: 'مزايدات من 80 حتى كابو، كنتر x2',
    },
    overview: {
      fr: 'La Coinche (ou Belote contrée) est la version compétition. Au lieu de "Je prends", on annonce un contrat chiffré (80, 90, 100… jusqu\'à Capot=250 ou Général=500). Le contrat indique le minimum de points que l\'équipe preneuse s\'engage à faire dans la couleur d\'atout choisie. Les adversaires peuvent "coincher" (contrer) pour doubler les enjeux, et le preneur peut "surcoincher" pour les quadrupler.',
      en: 'Coinche (a.k.a. contred Belote) is the competition version. Instead of "I take", you announce a numeric contract (80, 90, 100… up to Capot=250 or Generale=500). The contract states the minimum points the taking team commits to score in the chosen trump suit. Opponents may "coinche" (double) the stakes; the taker may "surcoinche" to quadruple them.',
      ar: 'الكوانش (البلوت المضاعفة) هي نسخة المنافسة. بدل قول "آخذ"، تُعلن عقداً رقمياً (٨٠، ٩٠، ١٠٠… حتى الكابو=٢٥٠). يستطيع المعارضون "الكوانش" لمضاعفة الرهان.',
      es: 'La Coinche es la versión de competición. En vez de "Tomo", se anuncia un contrato numérico (80, 90, 100… hasta Capote=250 o General=500). Los oponentes pueden "coinche" para doblar, y el tomador "surcoinche" para cuadruplicar.',
      darija: 'الكوانش هي البلوت ديال البطولات. عوض ما تقول "خاد"، كتعلن رقم: 80، 90، 100... حتى كابو 250. الأعداء يقدرو يكونتروك x2.',
    },
    bidding: {
      fr: 'Enchères chiffrées par paliers de 10 : 80, 90, 100, 110, 120, 130, 140, 150, 160, Capot (250), Général/Tout-Capot (500). On peut enchérir Sans-Atout ou Tout-Atout. Tout joueur adverse peut coincher après le dernier appel ; le preneur peut surcoincher dans la foulée. Si tout le monde passe, redistribution.',
      en: 'Numeric bids in steps of 10: 80, 90, 100, 110, 120, 130, 140, 150, 160, Capot (250), Generale/Full-Capot (500). You can bid No-Trump or All-Trump. Any opponent may coinche after the last call; the taker may surcoinche right after. If everyone passes, redeal.',
      ar: 'المزايدات بقفزات ١٠: ٨٠، ٩٠، ١٠٠... حتى الكابو ٢٥٠. يمكن المزايدة بدون أتو أو بكل الألوان أتواً.',
      es: 'Apuestas numéricas en pasos de 10: 80, 90, 100... hasta Capote 250 o General 500. Se puede apostar Sin-Triunfo o Todo-Triunfo.',
      darija: 'كنتزايدو من 80 ل 160 بقفزة 10، ومن بعد كابو 250. تقدر تعلن سان آتو ولا تو آتو.',
    },
    scoring: {
      fr: 'Identique à la Belote classique pour les valeurs. Sans-Atout : V=2, 9=0 (comme hors atout), valeur totale de 130 + dix-de-der. Tout-Atout : chaque valeur d\'atout est moitié + arrondi (V=14, 9=9), total 248.',
      en: 'Same card values as Classic. No-Trump: J=2, 9=0 (like off-trump), total 130 + last trick. All-Trump: each trump value halved+rounded (J=14, 9=9), total 248.',
      ar: 'نفس قيم البلوت العادية. بدون أتو: الولد=٢ والتسعة=٠، المجموع ١٣٠+آخر يد. بكل الألوان أتواً: الولد=١٤ والتسعة=٩، المجموع ٢٤٨.',
      es: 'Mismos valores. Sin-Triunfo: J=2, 9=0, total 130 + última baza. Todo-Triunfo: cada valor de triunfo a mitad (J=14, 9=9), total 248.',
      darija: 'نفس النقط. سان آتو: الولد 2 والتسعة 0. تو آتو: الولد 14 والتسعة 9.',
    },
    bonuses: {
      fr: 'Belote-Rebelote +20. Annonces +20/50/100. Coinche : multiplie le score final par 2. Surcoinche : x4. Capot annoncé tenu = +250 (au lieu de +90). Capot non annoncé mais réalisé = +90 (bonus surprise).',
      en: 'Belote-Rebelote +20. Sequences +20/50/100. Coinche multiplies final score by 2. Surcoinche x4. Announced Capot made = +250 (instead of +90). Unannounced Capot made = +90 (surprise bonus).',
      ar: 'بلوت-ريبلوت +٢٠. الإعلانات +٢٠/٥٠/١٠٠. الكوانش ×٢. الإعادة ×٤. الكابو المُعلن المُحقق = +٢٥٠.',
      es: 'Belote-Rebelote +20. Secuencias +20/50/100. Coinche multiplica x2. Sobre-contra x4. Capote anunciado y cumplido = +250.',
      darija: 'بلوت-ريبلوت +20. الإعلانات +20/50/100. الكوانش x2 والسوركوانش x4.',
    },
    endgame: {
      fr: 'Contrat rempli : preneur marque le score réalisé (multiplié par coinche/surcoinche) + bonus annoncés. Chute : adversaires marquent 162 + le contrat annoncé (multiplié). Premier à 1000 points gagne.',
      en: 'Contract made: taker scores the points made (multiplied by coinche/surcoinche) + announced bonuses. Contract down: opponents score 162 + the announced contract (multiplied). First to 1000 wins.',
      ar: 'العقد المحقق: يسجل الآخذ النقاط × المضاعف. السقوط: ١٦٢ + قيمة العقد × المضاعف للمعارضين. أول من يصل ١٠٠٠ يفوز.',
      es: 'Contrato cumplido: el tomador anota los puntos × multiplicador. Caída: 162 + el contrato × multiplicador para los oponentes. Primero a 1000 gana.',
      darija: 'إيلا دار العقد كياخد النقط × الكوانش. إيلا طاح: الأعداء كياخدو 162 + قيمة العقد × الكوانش. أول واحد كيوصل ل1000 كيربح.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 3) CONTRÉE (variante FR de la Coinche, plus stricte sur le contre)
// ─────────────────────────────────────────────────────────────────────────
const CONTREE: Variant = {
  ...COINCHE,
  id: 'contree',
  emoji: '⚔️',
  i18n: {
    ...COINCHE.i18n,
    name: {
      fr: 'Contrée', en: 'Contree', ar: 'كونتري', es: 'Contrée', darija: 'كونتري',
    },
    tagline: {
      fr: 'Variante FR stricte de la Coinche (contre = engagement)',
      en: 'Strict French variant of Coinche (contre = commitment)',
      ar: 'نسخة فرنسية صارمة من الكوانش',
      es: 'Variante francesa estricta de la Coinche',
      darija: 'كونتري: نسخة فرنسية صارمة من الكوانش',
    },
    overview: {
      fr: 'La Contrée est très proche de la Coinche mais le "contre" est un engagement formel : si l\'équipe qui contre perd, elle subit la pénalité doublée. Variante populaire dans le Sud-Ouest de la France et en Belgique francophone.',
      en: 'Contrée is very close to Coinche but the "contre" is a formal commitment: if the contring team loses, they pay double penalty. Popular variant in Southwest France and French-speaking Belgium.',
      ar: 'الكونتري قريبة جداً من الكوانش لكن المضاعفة فيها التزام: إذا خسر الفريق المضاعِف يدفع ضعف العقوبة.',
      es: 'La Contrée es muy similar a la Coinche pero el "contra" es un compromiso: si el equipo que contra pierde, paga doble penalidad.',
      darija: 'الكونتري قريبة من الكوانش لكن إيلا كنترتي وخسرتي، خاص تخلص ضعفين.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 4) BELOTE BRIDGÉE (contrats nommés type bridge — moins répandue)
// ─────────────────────────────────────────────────────────────────────────
const BRIDGEE: Variant = {
  ...CLASSIQUE,
  id: 'belote-bridgee',
  emoji: '🌉',
  numericBid: false,
  hasNoTrump: true,
  i18n: {
    ...CLASSIQUE.i18n,
    name: {
      fr: 'Belote Bridgée', en: 'Bridged Belote', ar: 'بلوت الجسر',
      es: 'Belote Puente', darija: 'البلوت المجسرة',
    },
    tagline: {
      fr: 'Contrats nommés (Petite/Grande/Sans-Atout) — esprit bridge',
      en: 'Named contracts (Small/Big/No-Trump) — bridge-like',
      ar: 'عقود مسماة (صغير/كبير/بدون أتو)',
      es: 'Contratos nombrados (Pequeño/Grande/Sin-Triunfo)',
      darija: 'عقود مسمية: صغير، كبير، بلا أتو',
    },
    overview: {
      fr: 'La Belote bridgée emprunte au bridge la nomenclature des contrats : Petite Belote (= contrat simple), Grande Belote (= +contre), Sans-Atout (toutes les couleurs valent pareil). Moins répandue que la Coinche mais appréciée des bridgeurs.',
      en: 'Bridged Belote borrows bridge contract naming: Little Belote (= simple contract), Big Belote (= +double), No-Trump (all suits equal). Less popular than Coinche but appreciated by bridge players.',
      ar: 'البلوت المجسرة تستعير من البريدج تسمية العقود.',
      es: 'La Belote Puente toma del bridge la nomenclatura de los contratos.',
      darija: 'البلوت المجسرة كتستعير من البريدج الأسماء ديال العقود.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 5) BELOTE À 3 JOUEURS
// ─────────────────────────────────────────────────────────────────────────
const TROIS_J: Variant = {
  id: 'belote-3j',
  emoji: '👥',
  players: [3],
  deckSize: 24,
  target: 501,
  hasAllTrump: false,
  hasNoTrump: false,
  numericBid: false,
  canCoinche: false,
  capotPoints: 250,
  beloteBonus: 20,
  dixDeDer: 10,
  hasAnnounces: false,
  i18n: {
    name: {
      fr: 'Belote 3 joueurs', en: 'Belote 3-player', ar: 'بلوت ٣ لاعبين',
      es: 'Belote 3 jugadores', darija: 'بلوت 3 لاعبين',
    },
    tagline: {
      fr: 'Chacun pour soi · 24 cartes (9→As) · pas d\'équipe',
      en: 'Every-man-for-himself · 24 cards (9→Ace) · no teams',
      ar: 'كل واحد لوحده · ٢٤ ورقة · بدون فرق',
      es: 'Cada uno para sí · 24 cartas · sin equipos',
      darija: 'كل واحد لوحدو · 24 ورقة · بلا فريق',
    },
    overview: {
      fr: 'Variante à 3 joueurs sans partenaire. On retire les 7 et 8, il reste 24 cartes (9 à As). Distribution 8 cartes par joueur (4+4). Le preneur joue seul contre les 2 autres mais marque pour lui seul.',
      en: 'Three-player variant with no partner. Remove 7s and 8s, leaving 24 cards (9 to Ace). Deal 8 cards each (4+4). The taker plays alone against the 2 others and scores solo.',
      ar: 'نسخة ٣ لاعبين بدون شريك. تُزال السبعات والثمانيات، يبقى ٢٤ ورقة.',
      es: 'Variante a 3 sin pareja. Se quitan 7 y 8, quedan 24 cartas. El tomador juega solo contra los otros 2.',
      darija: 'بلا شريك. كنحييدو 7 و8، كيبقا 24 ورقة. الآخذ كيلعب وحدو ضد التانيين.',
    },
    bidding: {
      fr: 'Mécanique identique au classique mais on joue à 3 : un preneur, 2 défenseurs. Chaque joueur reçoit 8 cartes.',
      en: 'Same bidding as Classic but with 3 players: one taker, two defenders. Each player gets 8 cards.',
      ar: 'نفس المزايدة لكن بثلاثة لاعبين: آخذ ومدافعان. كل لاعب ٨ أوراق.',
      es: 'Misma puja que la clásica pero con 3: un tomador, dos defensores. Cada uno con 8 cartas.',
      darija: 'نفس المزايدة لكن بثلاث لاعبين. كل واحد كياخد 8 أوراق.',
    },
    scoring: {
      fr: 'Mêmes valeurs de cartes. Total disponible : 130 + dix-de-der (car pas de 7-8 = -22 pts). Le preneur doit faire > 65 pts pour réussir.',
      en: 'Same card values. Total available: 130 + last trick (no 7-8 = -22 pts). Taker needs > 65 pts to make.',
      ar: 'نفس القيم. المجموع المتاح: ١٣٠+آخر يد. الآخذ يحتاج > ٦٥ نقطة.',
      es: 'Mismos valores. Total disponible: 130 + última baza. El tomador necesita > 65 ptos.',
      darija: 'نفس النقط. المجموع 130. الآخذ خاصو ياخد أكثر من 65.',
    },
    bonuses: {
      fr: 'Belote-Rebelote +20. Pas d\'annonces (carré, tierce…) pour simplifier.',
      en: 'Belote-Rebelote +20. No sequence announces (to simplify).',
      ar: 'بلوت-ريبلوت +٢٠. بدون إعلانات تسلسلات.',
      es: 'Belote-Rebelote +20. Sin secuencias para simplificar.',
      darija: 'بلوت-ريبلوت +20. بلا إعلانات.',
    },
    endgame: {
      fr: 'Premier à 501 points (cumulés) gagne. Si le preneur chute, les défenseurs SE PARTAGENT les 130 pts (65 chacun).',
      en: 'First to 501 (cumulative) wins. If the taker fails, defenders SPLIT the 130 pts (65 each).',
      ar: 'أول من يصل إلى ٥٠١ يفوز. إذا سقط الآخذ، يتقاسم المدافعان ١٣٠ نقطة.',
      es: 'Primero a 501 (acumulados) gana. Si el tomador falla, los defensores reparten 130 ptos (65 c/u).',
      darija: 'أول واحد يوصل ل501 كيربح. إيلا طاح الآخذ، التانيين كيتقاسمو 130 (65 لكل واحد).',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 6) BELOTE À 5 JOUEURS
// ─────────────────────────────────────────────────────────────────────────
const CINQ_J: Variant = {
  id: 'belote-5j',
  emoji: '🎲',
  players: [5],
  deckSize: 32,
  target: 1000,
  hasAllTrump: false,
  hasNoTrump: false,
  numericBid: true,
  canCoinche: false,
  capotPoints: 500,
  beloteBonus: 20,
  dixDeDer: 10,
  hasAnnounces: true,
  i18n: {
    name: {
      fr: 'Belote 5 joueurs', en: 'Belote 5-player', ar: 'بلوت ٥ لاعبين',
      es: 'Belote 5 jugadores', darija: 'بلوت 5 لاعبين',
    },
    tagline: {
      fr: '1 preneur contre 4 défenseurs · alliance secrète',
      en: '1 taker vs 4 defenders · secret ally',
      ar: 'آخذ ضد أربعة مدافعين · حليف سري',
      es: '1 tomador vs 4 defensores · aliado secreto',
      darija: 'واحد ضد 4 · شريك سري',
    },
    overview: {
      fr: 'À 5 joueurs avec 32 cartes (6 cartes par joueur + 2 cartes au chien). Le preneur annonce un contrat ET appelle un Roi (le porteur devient son partenaire secret jusqu\'au moment où il joue le Roi appelé). Variante festive très populaire dans le Nord.',
      en: 'With 5 players and 32 cards (6 cards each + 2 in the talon). The taker announces a contract AND calls a King (the holder becomes secret partner until they play the called King). Festive variant popular in Northern France.',
      ar: '٥ لاعبين بـ٣٢ ورقة (٦ لكل واحد + ٢ في الكنز). الآخذ يعلن عقداً ويستدعي ملكاً.',
      es: 'Con 5 jugadores y 32 cartas (6 cada uno + 2 en el talón). El tomador anuncia un contrato y "llama" a un Rey.',
      darija: '5 لاعبين، 32 ورقة. الآخذ كيدعي ملك، اللي عندو الملك كيولي شريك سري.',
    },
    bidding: {
      fr: 'Enchères chiffrées 80→Capot (500). Le preneur annonce ensuite la couleur du Roi qu\'il appelle (sans le savoir qui le détient).',
      en: 'Numeric bids 80→Capot (500). The taker then announces the suit of the called King (without knowing who holds it).',
      ar: 'مزايدات رقمية ٨٠←كابو (٥٠٠). ثم يعلن لون الملك المستدعى.',
      es: 'Apuestas numéricas 80→Capote (500). Después se llama al Rey de un palo.',
      darija: 'مزايدات من 80 ل كابو 500. ومن بعد كيدعي ملك ديال لون معين.',
    },
    scoring: {
      fr: 'Mêmes valeurs. Total 162. Le preneur+son allié partagent leurs points ; les 3 autres défenseurs aussi. Tant que le Roi appelé n\'est pas joué, l\'allié reste secret.',
      en: 'Same values. Total 162. Taker+ally share points; the 3 defenders share theirs. The ally remains secret until the called King is played.',
      ar: 'نفس القيم. الآخذ والحليف يتشاركان النقاط، المدافعون الثلاثة كذلك.',
      es: 'Mismos valores. Total 162. Tomador y aliado comparten ptos; los 3 defensores también.',
      darija: 'نفس النقط. الآخذ والشريك السري كيتقاسمو، والتلاتة لخرين تاني.',
    },
    bonuses: {
      fr: 'Belote-Rebelote +20 (uniquement pour le porteur). Annonces classiques. Capot annoncé = +500.',
      en: 'Belote-Rebelote +20 (only for the holder). Standard sequences. Announced Capot = +500.',
      ar: 'بلوت-ريبلوت +٢٠. إعلانات قياسية. كابو معلن = +٥٠٠.',
      es: 'Belote-Rebelote +20. Secuencias estándar. Capote anunciado = +500.',
      darija: 'بلوت-ريبلوت +20. الإعلانات العادية. كابو معلن = +500.',
    },
    endgame: {
      fr: 'Premier joueur à 1000 points gagne (les points sont individuels).',
      en: 'First player to 1000 points wins (points are per-player).',
      ar: 'أول لاعب يصل ١٠٠٠ يفوز (النقاط فردية).',
      es: 'El primer jugador en alcanzar 1000 ptos gana (ptos individuales).',
      darija: 'أول لاعب يوصل ل1000 كيربح. النقط فردية.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 7) BELOTE MAROCAINE (Maghreb · darija "البلوت")
// ─────────────────────────────────────────────────────────────────────────
const MAROCAINE: Variant = {
  id: 'belote-marocaine',
  emoji: '🇲🇦',
  players: [2, 4],
  deckSize: 32,
  target: 401,
  hasAllTrump: false,
  hasNoTrump: false,
  numericBid: false,
  canCoinche: false,
  capotPoints: 162,
  beloteBonus: 20,
  dixDeDer: 10,
  hasAnnounces: true,
  i18n: {
    name: {
      fr: 'Belote Marocaine', en: 'Moroccan Belote', ar: 'البلوت المغربية',
      es: 'Belote Marroquí', darija: 'البلوت المغربية',
    },
    tagline: {
      fr: 'Variante darija · annonces orales · convivialité',
      en: 'Darija variant · oral announces · convivial',
      ar: 'نسخة مغربية · إعلانات شفهية · ودية',
      es: 'Variante darija · anuncios orales',
      darija: 'النسخة المغربية · سهلة · ودية',
    },
    overview: {
      fr: 'La version marocaine se joue principalement à 4 (2v2) ou à 2 (heads-up). Plus rapide que la française : 401 pts. Les annonces se font à l\'oral pendant le jeu ("ndi belote!", "khallini ndakhel!"). Très populaire dans les cafés et soirées familiales.',
      en: 'Moroccan version is played mainly 4-handed (2v2) or 2-player. Faster than the French: 401 pts. Announces are made out loud during play ("ndi belote!", "khallini ndakhel!"). Very popular in cafés and family evenings.',
      ar: 'النسخة المغربية تُلعب أساساً بأربعة (٢×٢) أو اثنين. أسرع من الفرنسية: ٤٠١ نقطة. الإعلانات شفوية أثناء اللعب.',
      es: 'La versión marroquí se juega principalmente a 4 (2v2) o a 2. Más rápida: 401 ptos. Anuncios orales durante el juego.',
      darija: 'البلوت المغربية كتلعب أكثر زوج ضد زوج، ولا 2 لاعبين. أسرع من الفرنسية: 401 نقطة. الإعلانات بالكلام أثناء اللعب.',
    },
    bidding: {
      fr: 'Tour 1 : "ndakhel" (je prends) ou "msuat" (je passe). Tour 2 : "wahad ndakhel" (sans atout) ou choix d\'une autre couleur. Le donneur a un veto sur le tour 1.',
      en: 'Round 1: "ndakhel" (I take) or "msuat" (pass). Round 2: "wahad ndakhel" (no-trump) or pick another suit. The dealer has a veto on round 1.',
      ar: 'الجولة ١: "نداخل" (آخذ) أو "مسوات" (أمرر). الجولة ٢: لون آخر أو بدون أتو.',
      es: 'Ronda 1: "ndakhel" (tomo) o "msuat" (paso). Ronda 2: otro palo o sin triunfo.',
      darija: 'الدورة 1: "نداخل" ولا "مسوات". الدورة 2: لون آخر ولا "واحد نداخل" (سان آتو).',
    },
    scoring: {
      fr: 'Identique à la française. Total 162. Le preneur doit faire > 81 pts. Capot = double score (324) sans bonus annoncé séparé.',
      en: 'Same as French. Total 162. Taker needs > 81 pts. Capot = double score (324) without separate announced bonus.',
      ar: 'نفس القيم. ١٦٢. الآخذ يحتاج > ٨١.',
      es: 'Igual que francesa. 162. Tomador necesita > 81.',
      darija: 'نفس النقط. 162. الآخذ خاصو > 81.',
    },
    bonuses: {
      fr: 'Belote-Rebelote +20 (annoncée). Annonces : tierce 20, quarte 50, quinte 100, carré 100/150/200 selon valeur. Spécifique Darija : "hkim" (challenge sportif au perdant) en option.',
      en: 'Belote-Rebelote +20 (announced). Sequences: tierce 20, quarte 50, quinte 100, four-of-kind 100/150/200. Darija-specific: optional "hkim" (sport challenge for loser).',
      ar: 'بلوت-ريبلوت +٢٠. تسلسلات قياسية. خاصية مغربية: "حكم" (تحدي رياضي للخاسر).',
      es: 'Belote-Rebelote +20. Secuencias estándar. Especial darija: "hkim" (reto deportivo al perdedor).',
      darija: 'بلوت-ريبلوت +20. الإعلانات العادية. خاصية ديالنا: الحكم (تحدي رياضي للخاسر).',
    },
    endgame: {
      fr: 'Premier à 401 points gagne (plus rapide qu\'en France). Le perdant peut être condamné à un "hkim" — un challenge sportif (course, marche, défi) tracé sur la carte. Une fois fait, il partage le trajet sur les réseaux sociaux.',
      en: 'First to 401 wins (faster than French). The loser may be sentenced to a "hkim" — a sport challenge (run, walk, dare) traced on the map. Once done, they share the route on social media.',
      ar: 'أول من يصل ٤٠١ يفوز. الخاسر يمكن أن يُحكم عليه بـ"حكم" - تحدي رياضي مرسوم على الخريطة.',
      es: 'Primero a 401 gana. El perdedor puede ser condenado a un "hkim" — un reto deportivo en el mapa.',
      darija: 'أول واحد يوصل ل401 كيربح. الخاسر تيجي ليه حكم: تحدي رياضي على الخريطة، ومنين كيكملو كيشير الطريق فالشبكات الاجتماعية.',
    },
  },
};

export const VARIANTS: Variant[] = [
  CLASSIQUE, COINCHE, CONTREE, BRIDGEE, TROIS_J, CINQ_J, MAROCAINE,
];

export function getVariant(id: VariantId): Variant {
  return VARIANTS.find(v => v.id === id) || CLASSIQUE;
}

export function variantsForPlayerCount(n: number): Variant[] {
  return VARIANTS.filter(v => v.players.includes(n));
}
