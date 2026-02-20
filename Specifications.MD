# Spécifications : Application de Gestion de Concours de Pétanque

## 1. Contexte et règles de la Ligue Française (FFPJP)

### Formats de concours

La FFPJP reconnaît plusieurs formats officiels :

#### Par composition des équipes

- Tête-à-tête (1 vs 1) — 3 boules par joueur
- Doublette (2 vs 2) — 3 boules par joueur
- Triplette (3 vs 3) — 2 boules par joueur

#### Par format de compétition

- Concours en tête (mêlée) : les équipes sont tirées au sort à chaque tour
- Concours en coupe (tableau) : élimination directe
- Concours en championnat : poules puis phase finale

### Scores par partie

- Une partie se joue en 13 points (règle officielle)
- Score minimum possible pour le perdant : 0
- Saisie obligatoire des deux scores (ex: 13-7, 13-0, etc.)
- Validation : la somme des scores doit être cohérente (le gagnant a exactement 13 points)

---

## 2. Gestion des joueurs et équipes

### Joueurs

- Profil : nom, prénom, genre, numéro de licence FFPJP, club d'appartenance, date de naissance
- Catégories : Senior, Vétéran (+60 ans), Féminin, Jeune (-18 ans)
- Vérification que les joueurs sont licenciés (import ou saisie manuelle)
- Un joueur ne peut jouer que dans une seule équipe par concours

### Équipes

- Constitution selon le format (1, 2 ou 3 joueurs)
- Nom d'équipe optionnel
- Numéro de tirage au sort attribué à l'inscription
- Statut : inscrite, présente, forfait, disqualifiée

Il existe 3 modes de constitution des équipes:

- Mêlée - démêlée : Chaque joueur s'insrit individuellement. Les équipes sont constituées aléatoirement à chaque tour. Ce type de constitution d'équipe n'est utilisable que dans les concours en tête (mêlée).
- Mêlée : Chaque joueur s'insrit individuellement. Les équipes sont constituées aléatoirement à la fin des inscription. Les équipes ainsi constituées restent identique tout au long du concours. Ce type de constitution est compatible avec tous les types de concours.
- Montée : les équipes sont déjà constitutées et l'inscription se fait par équipe. Ce type de constitution est compatible avec tous les types de concours.

La taille des équipes (1, 2 ou 3 joueurs) doit être définie à la création du concours. En cas de constitution Mêlée ou Mêlée - Démêlée, le tirage cherche à consituer un maximum d'équipes avec la taille définie et complète éventuellement avec des équipes comptant 1 joueur de moins.

### Inscriptions

- Ouverture/fermeture des inscriptions avec date limite
- Nombre maximum de participants paramétrable
- Gestion des paiements (droits d'engagement) — montant configurable
- Liste d'attente en cas de complet

---

## 3. Gestion des Concours

### Création des Concours

A la création des concours, les informations suivantes sont définies:

- Nom du concours
- Lieu
- Format du concours : sélectionner le format et définir les caractéristiques
- Taille des équipes
- Nombre maximum de participants (optionnel)
- Mode de constitution des équipes
- Nombre de terrains disponibles
- Dates du concours: Date-heure du début et Date-heure de fin

Lorsque le concours est créé, les inscriptions sont automatiquement ouvertes.

### Format du concours

#### Concours en tête (mêlée)

Dans ce format, un nombre de tour est prédéfini à l'avance. A tour, un tirage au sort défini les différentes parties.

##### Déroulement

Au démarrage du concours, la constitution des équipes est faite selon le mode de constitution sélectionné. Les parties du premier tour sont tiré au sort: 2 équipes + terrain. Un bouton permet de les démarrer, à la fin de la partie, les capitaines de chaque équipe vient indiquer le résultat à la table pour que celui ci ci soit saisie dans l'application. La saisie et la validation du score termine la partie. Lorsque toutes les parties sont terminées, le tour courant est terminé et le Le classement des équipes est alors mis à jour. Un bouton permet alors de lancer le tirage pour le tour suivant et de le démarrer. Le tirage au sort des tours suivants suit l'algorithme suivant:

  1. Grouper les équipes par nombre de victoires
  2. Dans chaque groupe, tirer aléatoirement les oppositions
  3. Éviter autant que possible les équipes qui se sont déjà rencontrées
  4. Si nombre impair d'équipes : une équipe reçoit un "bye" (victoire 13-0 offerte, comptabilisée)
  5. Contrainte géographique optionnelle : éviter équipes du même club en début de concours

##### Classement final

A la fin du dernier tour, le classement final est calculé (priorités dans l'ordre)

1. Nombre de victoires
2. Quotient de points : `points_marqués / points_encaissés`
3. Points marqués (si quotient égal)
4. Tirage au sort en dernier recours

### Concours en Coupe

Dans ce format, les équipes s'affrontent à travers un tableau à élimination directe jusqu'aux finales. Il y a une options possible: la "Consolante": les équipes gagnantes du premier tour rejoignent le tableau principal, les équipes perdantes du premier tour rejoignent un tableau alternatif appelé 'consolante'.

Au démarrage du concours, les parties du premier tour sont tirées au sort. A la fin de la partie, les capitaines de chaque équipe vient indiquer le résultat à la table pour que celui ci soit saisie dans l'application. La saisie et la validation du score termine la partie. Les équipes gagnantes sont déversés dans le tableau principal, les perdantes dans le tableau 'Consolante'.
A la suite du premier tour, il y a donc 2 tableaux parallèles et indépendants qui fonctionnent de la même façon.

#### Fonctionnement des tableaux

Lorsque toutes les parties du premier tour sont terminées, un bouton apparait pour lancer les 2 tableaux. Au lancement, les 2 tableaux complets sont lancés. Si le nombre d'équipes n'est pas une puissance de 2, des équipes tirées au sort sont exemptées du premier tour (byes).  A la fin de la partie, les capitaines de chaque équipe vient indiquer le résultat à la table pour que celui ci soit saisie dans l'application. La saisie et la validation du score termine la partie. L'équipe vainqueure est qualifiée pour le tour suivant. Lorsque les 2 équipes sont disponibles, la partie peut être lancée, l'affectation du terrain est calculée à ce moment là parmis les terrains disponibles. Si aucun terrain n'est disponible, un terrain est tiré au sort parmis les terrains avec le moins de partie à jouer.

A la fin des demi finales, les 2 équipes gagnantes s'affrontent dans la Grande finale et les 2 perdantes dans la petite finale pour déterminer le 3éme du concours et de la consolante.

### Concours en Championnat

Le concours en championnat commence par une phase de poule. Les équipes qualifiées lors de la phase de poule bascule dans le tableau final.

#### Phase de poule

A la création du concours, la taille des poules doit être définie (3, 4 ou 5 équipes).
Au démarrage du concours,  la constitution des équipes est faite selon le mode de constitution sélectionné (Montée ou Mêlée). Les poules sont constituées automatiquement par tirage au sort. L'algorithme crée un nombre de poules selon le nombre total des équipes et la taille de poules, le but étant de créer un maximum de poules avec le nombre cible. Par poule, les différentes parties sont générées pour que chaque équipe affronte toutes les autres équipes de la poule, les terrains sont également assignés aux différentes parties. Un classement est créé pour chaque poule.
Au début de la poule, les premières parties sont lancées. A la fin de la partie, les capitaines de chaque équipe vient indiquer le résultat à la table pour que celui ci soit saisie dans l'application. La saisie et la validation du score termine la partie et le classement de la poule est mis à jour. Lorsque les 2 équipes sont disponibles, les parties suivantes peuvent démarrer. Lorsque toutes les parties de la poule sont terminées, le classement définitif de la poule est calculé. Les 2 premières équipes sont inscrites au tableau final.

##### Classement de la phase de poule (priorités dans l'ordre)

1. Nombre de victoires
2. Quotient de points : `points_marqués / points_encaissés`
3. Points marqués (si quotient égal)
4. Tirage au sort en dernier recours

#### Tableau final

Lorsque toutes les poules sont terminées, un bouton apparait pour lancer le tableau final. Au lancement, le tableau complet est calculé jusqu'aux finales. Si le nombre d'équipes n'est pas une puissance de 2, les équipes avec le plus de points dans la phase de poules sont exemptées du premier tour (byes).  A la fin de la partie, les capitaines de chaque équipe vient indiquer le résultat à la table pour que celui ci soit saisie dans l'application. La saisie et la validation du score termine la partie. L'équipe vainqueure est qualifiée pour le tour suivant. Lorsque les 2 équipes sont disponibles, la partie peut être lancée, l'affectation du terrain est calculée à ce moment là parmis les terrains disponibles. Si aucun terrain n'est disponible, un terrain est tiré au sort parmis les terrains avec le moins de partie à jouer.

##### Les finales

A la fin des demi finales, les 2 équipes gagnantes s'affrontent dans la Grande finale et les 2 perdantes dans la petite finale pour déterminer le 3éme du concours.

## 4. Gestion du terrain et des parties

### Terrains

- Référencement des terrains disponibles (numéro, emplacement)
- Attribution automatique des terrains aux parties du tour en cours
- Affichage du plan de terrain (optionnel)

### Suivi des parties en temps réel

- Statut : à jouer, en cours, terminée, litige, forfait
- Heure de début estimée et réelle
- Saisie des scores : par l'organisateur
- Validation des scores

### Gestion des litiges et absences

- Forfait avant le début : l'adversaire obtient 13-0
- Forfait en cours de partie : score figé
- Procédure de litige : escalade vers l'arbitre, saisie de la décision

---

## 5. Communication et affichage

### Affichage public (écran/TV, impression)

- Tableau des résultats par tour
- Classement en temps réel
- Convocations du prochain tour (numéro terrain + adversaire)
- Résultats finaux et podium

### Notifications (si mobile)

- Convocation au prochain tour
- Score validé
- Résultat final et classement

### Export et impression

- Feuille de match imprimable (avec cases score, signatures)
- Classement final PDF
- Rapport de concours pour la ligue (format FFPJP si disponible)

---

## 6. Rôles utilisateurs

| Rôle | Droits |
| --- | --- |
| Super Admin | Gestion globale, paramètres, licences |
| Organisateur | Création/gestion d'un concours |
| Arbitre | Saisie et validation des scores, gestion litiges |
| Capitaine | Consultation, saisie des scores de son équipe |
| Spectateur | Consultation des résultats publics |

---

## 7. Modèle de données simplifié

```
Concours
  ├── format (mêlée / coupe / championnat)
  ├── type (tête-à-tête / doublette / triplette)
  ├── mode de constitution des équipes (Mêlée-Démêlée, Mêlée, Montée)
  ├── nombre maximum de participants (individus ou équipes selon mode de consitution)
  ├── date, lieu, organisateur
  ├── nombre de terrains
  ├── paramètres selon le format (nb_tours, taille des poules, consolante, etc.)
  └── statut (inscription / en_cours / terminé)

Joueur
  ├── email (unique)
  ├── licence_ffpjp, club
  ├── nom, prénom, date_naissance, gender (H/F)
  └── catégorie

Equipe
  ├── concours_id
  ├── joueurs[] (1, 2 ou 3)
  ├── numero_tirage
  └── statut

Poule
  ├── concours_id
  ├── equipes[] (3, 4 ou 5)
  ├── classement
  └── statut

Partie
  ├── tour, poule
  ├── equipe_a_id, equipe_b_id
  ├── terrain_id
  ├── score_a, score_b
  └── statut

Classement (calculé ou matérialisé)
  ├── equipe_id
  ├── victoires, points_marques, points_encaisses
  └── quotient
```

---

## 8. Architecture Technique Globale

### Vue d'ensemble

L'application repose sur une architecture trois tiers classique : un frontend web (et optionnellement mobile), un backend exposant une API REST, et une couche de persistance relationnelle. Les trois composants sont découplés et communiquent via des contrats d'interface stables, ce qui permet de les faire évoluer indépendamment. L'ensemble est conçu pour être hébergé sur une infrastructure cloud légère, cohérente avec le contexte d'un développeur indépendant (coûts maîtrisés, déploiement simplifié).

---

### Frontend

Le frontend est une **Single Page Application (SPA)** développée avec **React** , qui expose plusieurs vues adaptées aux différents rôles utilisateurs. L'interface est responsive et couvre deux usages distincts : la gestion back-office pour l'organisateur (paramétrage du concours, saisie des scores, gestion des litiges), et la consultation publique pour les joueurs et spectateurs (convocations, classements en temps réel, résultats).

Pour les affichages en temps réel — typiquement les convocations du tour suivant et la mise à jour du classement — le frontend établit une connexion **WebSocket** (ou utilise le mécanisme de **Server-Sent Events**) avec le backend afin d'éviter le polling répété. Les données moins dynamiques (liste des inscrits, résultats des tours passés) sont chargées via des appels REST classiques.

L'état global de l'application (concours courant, utilisateur connecté, tour en cours) est géré via un store centralisé (Redux, Zustand ou Pinia selon le framework). Le frontend ne contient aucune logique métier : toutes les règles de calcul de classement, de validation de score et d'algorithme de tirage sont déléguées au backend.

Une **version imprimable** des feuilles de match et du classement est générée côté client en PDF via une librairie dédiée (`react-pdf`), en consommant les données exposées par l'API.

---

### Backend

Le backend est une **API REST** développée avec **Node.js / NestJS** . Il constitue le cœur de l'application et concentre l'intégralité de la logique métier.

Les responsabilités du backend sont organisées en modules fonctionnels distincts :

**Module Concours** — création, paramétrage, cycle de vie (inscription → en cours → terminé), export du rapport final.

**Module Équipes & Joueurs** — inscription, vérification des licences, gestion des forfaits et des statuts.

**Module Tirage** — implémentation de l'algorithme de tirage avec backtracking, gestion des contraintes, journalisation de chaque tirage. Ce module est isolé sous forme de service pur (sans effet de bord) pour faciliter les tests unitaires exhaustifs.

**Module Parties** — attribution des terrains, saisie et validation des scores, gestion des litiges, calcul automatique du résultat.

**Module Classement** — calcul en temps réel du classement selon les priorités officielles (victoires, quotient, points marqués). Le classement peut être matérialisé en base après chaque tour pour des raisons de performance.

**Module Authentification** — gestion des sessions via **JWT** (JSON Web Token), avec des rôles encodés dans le token (organisateur, arbitre, capitaine, spectateur). Les routes sont protégées par un middleware de vérification des droits.

**Module Notifications** — émission des événements temps réel via WebSocket (ex: `socket.io`) à destination du frontend, déclenchés lors des changements d'état critiques (nouveau tour ouvert, score validé, classement mis à jour).

Le backend expose également un endpoint dédié à la **génération de PDF côté serveur** (via `puppeteer` ou `pdfkit`) pour les cas où une impression fiable et indépendante du navigateur est nécessaire (feuilles de match officielles).

---

### Couche de persistance

La base de données principale est **PostgreSQL**, choisie pour sa robustesse, sa gestion native des transactions ACID (indispensable pour la saisie concurrente des scores et les opérations de tirage), et sa capacité à exprimer des requêtes complexes de classement via des fonctions de fenêtrage SQL (`RANK`, `PARTITION BY`).

Le schéma suit fidèlement le modèle de données défini dans les spécifications fonctionnelles. Les points d'attention particuliers sont les suivants :

La table `parties` intègre une contrainte d'unicité composite sur `(concours_id, tour, equipe_a_id, equipe_b_id)` pour garantir qu'une même rencontre ne peut pas être enregistrée deux fois. La table `classements` peut être utilisée comme vue matérialisée rafraîchie après chaque validation de score, évitant de recalculer le classement complet à chaque requête d'affichage. L'historique des tirages est stocké dans une table `tirages_log` avec la graine aléatoire, les contraintes actives et les appariements générés, ce qui garantit la traçabilité et la rejouabilité.

Les migrations de schéma sont gérées par un outil dédié (**Flyway** ) afin de garantir la cohérence du schéma entre les environnements de développement, de staging et de production.

Une base **Redis** est ajoutée pour deux usages complémentaires : le stockage des sessions et tokens de rafraîchissement JWT d'une part, et la mise en cache des classements et convocations en cours de tour d'autre part. Redis permet également de gérer un verrou distribué (`SETNX`) lors de l'opération de tirage, pour éviter qu'un double-clic ou une requête concurrente ne déclenche deux tirages simultanés sur le même tour.

---

### Infrastructure et déploiement

L'ensemble des composants est conteneurisé via **Docker**, avec un fichier `docker-compose` couvrant les environnements de développement local (frontend, backend, PostgreSQL, Redis). En production, le déploiement cible une plateforme cloud simple à opérer : **Railway** avec un reverse proxy **Nginx** devant le backend et le frontend buildé servi en statique.

Les sauvegardes PostgreSQL sont automatisées quotidiennement avec rétention sur 30 jours. Les logs applicatifs sont centralisés via un outil léger comme **Grafana Loki** pour faciliter le débogage en production sans infrastructure lourde.

---

### Synthèse des choix technologiques

| Composant | Technologie recommandée |
| --- | --- |
| Frontend | React + Zustand + TailwindCSS |
| API Backend | Node.js + NestJS |
| Base de données | PostgreSQL |
| Cache & sessions | Redis |
| Temps réel | Socket.io (WebSocket) |
| Auth | JWT + Refresh Token |
| ORM | Prisma |
| Conteneurisation | Docker + docker-compose |
| PDF | pdfkit (serveur) ou react-pdf (client) |
| Hébergement | Railway |

## 9. Interface Utilisateur — Charte Graphique et Thème Visuel

### Philosophie générale

L'interface adopte un design moderne et épuré, inspiré des dashboards sportifs contemporains. L'objectif est de proposer une expérience claire et lisible dans des conditions d'utilisation parfois difficiles — plein soleil, grand écran de salle des fêtes, smartphone en extérieur — tout en dégageant une identité visuelle forte et professionnelle qui tranche avec les outils de gestion de concours traditionnellement austères. Le parti pris est une interface sombre en arrière-plan principal (**dark mode par défaut**), sur laquelle les couleurs vives de la palette ressortent avec un contraste maximal, facilitant la lecture rapide des scores et des classements.

---

### Palette de couleurs

La palette s'articule autour de trois couleurs d'accent sur un fond sombre neutre :

**Bleu profond** (`#1E3A5F` / `#2D6CDF`) — couleur primaire de l'application, utilisée pour la navigation, les en-têtes de section, les boutons d'action principaux et les éléments de structure. Il exprime la rigueur et la confiance, en cohérence avec le caractère officiel d'un concours fédéral.

**Vert émeraude** (`#1A7A4A` / `#2ECC71`) — couleur sémantique de succès et de validation, utilisée pour les scores gagnants, les équipes qualifiées, les statuts "partie terminée" et les confirmations d'action. Sa saturation élevée permet une identification instantanée sur fond sombre.

**Orange vif** (`#E07B20` / `#F39C12`) — couleur d'alerte et d'emphase, utilisée pour les convocations en attente, les parties en cours, les délais dépassés et les informations urgentes à destination des joueurs. Il attire naturellement le regard sans signifier une erreur, contrairement au rouge.

Le fond général repose sur une teinte **gris ardoise très sombre** (`#0F1923`) avec des surfaces de cartes légèrement plus claires (`#1C2B38`), créant une profondeur visuelle par élévation plutôt que par bordures. Les textes principaux sont en blanc cassé (`#E8EDF2`) et les textes secondaires en gris clair (`#7A9BB5`) pour hiérarchiser l'information sans surcharger visuellement.

---

### Composants clés et leur traitement visuel

**Tableau de bord** — Ecran d'accueil proposant une vue synthétique des concours et leur statut. Il est possible d'accéder directement au concours en cours.

**Gestion des Concours** - Accès aux concours créés et possibilité d'en créer de nouveaux.

**Phase d'inscription** - Possibilité d'inscrire des individus ou des équipes selon le mode de constitution sélectionnée pour le concours. Lors de l'ajout de joueur, si l'email est connu dans la base, les détails du joueur sont automatiquement complété.

**Déroulement du concours** - Vision sur les parties en cours. En cas de concours en tête, possibilité de visualiser les différents tours. Pour les championnats, visualisation des poules puis du tableau final. Pour les coupes, visualisation du tableau final et de la consolante.

**Tableau de classement** — Chaque ligne alterne subtilement de teinte pour améliorer la lisibilité. Le podium (positions 1, 2, 3) est mis en valeur par un badge coloré (or, argent, bronze) et une légère surbrillance de la ligne. Le quotient et le nombre de points sont affichés dans des pills colorées selon leur valeur relative (vert si au-dessus de la moyenne, orange si en dessous).

**Carte de partie** — Chaque rencontre est présentée sous forme de carte compacte affichant les deux équipes face à face, le terrain attribué, et le score en grand format central. Le score gagnant s'affiche en vert vif, le score perdant en gris atténué. Une barre de progression horizontale visualise le rapport de force entre les deux scores. Les parties en cours affichent un indicateur animé (point pulsant orange) pour signaler leur statut actif en temps réel.

**Convocations** — Affichées sous forme de bannière proéminente en haut de l'écran public, avec le numéro de terrain en très grand caractère (lisible à distance), les noms des équipes en dessous, et un compte à rebours orange si le délai de présentation approche de son terme.

**Navigation et structure** — Une barre latérale rétractable sur desktop, une bottom navigation bar sur mobile. Les icônes sont accompagnées de labels courts. L'onglet actif est mis en valeur par un indicateur bleu vif sur le bord gauche (desktop) ou une surbrillance complète (mobile).

---

### Typographie

La typographie repose sur deux familles complémentaires : **Inter** pour les textes d'interface, labels et corps de texte (excellente lisibilité à petite taille sur écran), et **Barlow Condensed** en gras pour les scores, classements et numéros de terrain — sa largeur réduite permet d'afficher des chiffres imposants sans sacrifier d'espace, idéal pour les affichages à distance. Les tailles de police suivent une échelle modulaire (base 16px) avec des paliers à 12, 14, 16, 20, 24, 32 et 48px. Les scores en cours de partie sont affichés en 48px minimum pour rester lisibles sur un écran de télévision à plusieurs mètres.

---

### Accessibilité et adaptabilité

Tous les couples de couleurs respectent un ratio de contraste minimum de **4.5:1** (WCAG AA) pour les textes courants et **3:1** pour les grands textes et éléments graphiques. Un mode **light** optionnel est prévu pour les organisateurs préférant une interface plus classique en intérieur, basculant les fonds sombres en blanc et gris clair tout en conservant la même palette d'accent. L'interface est entièrement responsive, avec trois breakpoints principaux : mobile (< 768px), tablette (768–1280px) et desktop large (> 1280px), ce dernier étant optimisé pour l'affichage public sur grand écran horizontal.
