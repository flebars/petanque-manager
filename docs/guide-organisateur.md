# Guide de l'organisateur — Types de concours 🏆

📚 Ce document explique, en français, les différents types de concours gérés par l'application Petanque Manager, leurs règles opérationnelles et les décisions à prendre lors de la configuration. Il s'adresse aux organisateurs, arbitres et développeurs.

---

## Table des matières 🗂️

- Introduction
- Règles communes
- Glossaire rapide
- MELEE (Swiss) ⚖️
  - Description
  - Paramètres et modes de constitution
  - Déroulement et règles de tirage
  - Bye et contraintes
  - Scénarios d'exemple
- COUPE (Élimination) 🥇
  - Description
  - Génération de tableau et byes
  - Consolante / repêchage
  - Scénarios d'exemple
- CHAMPIONNAT (Poules → Tableau) 🏅
  - Description
  - Phase de poules (round-robin)
  - Qualification et phase finale
  - Scénarios d'exemple
- Règles de score et forfaits ⚠️
- Classements et départages 🧾
- Conseils opérationnels pour l'organisateur 🔧
- Exemple de configuration (YAML) 🧩
- Checklist avant démarrage ✅

---

## Introduction ✨

L'application supporte trois formats de tournoi principaux adaptés à des besoins différents :

1. MELEE — rounds suisses (Swiss) — idéal pour un grand nombre de participants.
2. COUPE — élimination directe — rapide, idéal pour phases finales.
3. CHAMPIONNAT — poules puis tableau — combine round-robin et phase à élimination.

Chaque format a des contraintes (constitution d'équipes, tirages, gestion des byes, etc.). Ce guide détaille les règles et options de configuration.

---

## Règles communes ⚖️

- ⚠️ Score gagnant standard : le vainqueur doit marquer exactement `13` points ; le perdant `0–12`.
- 👥 Taille d'équipe : `TETE_A_TETE` = 1, `DOUBLETTE` = 2, `TRIPLETTE` = 3 joueurs.
- 🚫 Forfait pré-match : victoire administrative `13–0` pour l'adversaire.
- 🧊 Forfait en cours : score gelé, procédure arbitre (validation nécessaire).
- 🔎 Contrôles fréquents : éviter doublons d'inscription (même joueur dans plusieurs équipes permanentes), vérifier licences.
- 🧭 Contraintes de tirage : éviter rematches et rencontres same-club les premiers tours si activé.

---

## Glossaire rapide 📘

- Tour : un round (t) du concours.
- Tirage / Appariement : algorithme qui associe équipes par tour.
- Bye : équipe exemptée (nombre impair) ; reçoit victoire administrative `13–0`.
- Constitution :
  - `MELEE_DEMELEE` — équipes formées aléatoirement à chaque tour.
  - `MELEE` — équipes tirées aléatoirement une fois au départ.
  - `MONTEE` — équipes permanentes (pré-inscrites).
- Quotient : ratio `points_marques / points_encaisses` pour départage.

---

## MELEE (Swiss) ⚖️

### Description

Format Swiss adapté aux compétitions où chaque équipe/joueur joue plusieurs tours sans élimination directe. Classement par victoires, puis critères de départage.

### Quand l'utiliser

- 👥 Grand nombre de participants
- 🔁 On veut que tout le monde joue plusieurs parties
- 🏁 Objectif : classement général sur plusieurs tours

### Paramètres et modes de constitution

- ⏱️ Nombre de tours fixé (ex. : log2(nb équipes) + marge).
- Modes :
  1. `MELEE_DEMELEE` — équipes recomposées chaque tour (idéal pour concours individuels).
  2. `MELEE` — équipes tirées aléatoirement une seule fois.
  3. `MONTEE` — équipes permanentes fournies à l'inscription.
- ⚙️ Options : `eviterMemeClub`, `seed` (graine pour reproductibilité).

### Déroulement et règles de tirage

- 🔢 Groupement par nombre de victoires.
- 🎲 Pairing aléatoire à l'intérieur du groupe, en évitant les rematches.
- ➕ Si groupe impair → on récupère une équipe adjacente ou on attribue un bye.
- 🔐 Tirage déterministe si `seed` fourni (utile pour audit).

### Bye et contraintes

- 🟢 Bye (nombre impair) → victoire `13–0` et impact au classement.
- 🚫 Éviter same-club sur tours 1–2 si activé.
- 🔁 Prioriser appariements sans rematchs lorsque possible.

### Exemple de flux (MELEE)

1. 👥 Constitution des équipes.
2. 🎯 Lancement du tirage pour le tour 1.
3. 📝 Enregistrement des scores (validation arbitre).
4. 📊 Recalcul du classement.
5. 🔁 Lancement du tour suivant.

### Avantages / Inconvénients

- ➕ Permet à tous de jouer plusieurs parties
- ➕ Bon pour classement progressif
- ➖ Nécessite un algorithme de tirage plus complexe
- ➖ Gestion des byes/contraintes demande règles claires

---

## COUPE (Élimination) 🥇

### Description

Tableau à élimination directe (single-elimination), optionnellement complété par une consolante / repêchage.

### Quand l'utiliser

- ⚡ Concours rapide, élimination directe
- 🏆 Phases finales après poules

### Génération de tableau et byes

- 📐 Compléter jusqu'à la puissance de deux supérieure (ex. 12 → 16).
- 🎯 Byes attribués selon le seeding (favoriser têtes de séries).
- 🔀 Placement aléatoire ou basé sur seeding.

### Consolante / repêchage

- 🔁 Optionnel : consolante pour donner plus de parties aux éliminés.
- ⚠️ Repêchage nécessite logique d'avancement séparée.

### Exemple de flux (COUPE)

1. 📝 Inscription & seeding
2. 🧾 Génération du tableau
3. ✅ Validation des résultats → tour suivant
4. 🏁 Finale et remise des prix

### Avantages / Inconvénients

- ➕ Clair et rapide
- ➕ Facile à visualiser (bracket)
- ➖ Peu de parties pour éliminés tôt
- ➖ Consolante ajoute de la complexité

---

## CHAMPIONNAT (Poules → Tableau) 🏅

### Description

Phase de poules (round-robin) suivie d'une phase finale en tableau pour les qualifiés.

### Quand l'utiliser

- 🔁 On souhaite un classement de groupe avant élimination
- ⚖️ Combine régularité (poules) et moment fort (phases finales)

### Phase de poules (round-robin)

- 🔄 Chaque équipe affronte toutes les autres de la poule.
- 🥇 Points : victoire = 1 (ou 2), défaite = 0 (ou selon règle locale).
- 🧾 Classement interne → départages (quotient, différence, points marqués).

### Qualification et phase finale

- 🔢 Les X premiers de chaque poule se qualifient.
- 🧭 Tableau généré selon seeding basé sur classement de poules.
- 🛡️ Possibilité de protéger têtes de séries.

### Avantages / Inconvénients

- ➕ Assure plusieurs parties pour chaque équipe
- ➕ Meilleur tri avant phase éliminatoire
- ➖ Calendrier plus lourd
- ➖ Départage multi-égalité complexe

---

## Règles de score et forfaits (détaillé) 📏

- ✅ Validation : vainqueur doit avoir `13` pts, perdant `0–12`.
- 🚫 Forfait pré-match : `13–0` pour l'adversaire (impact au classement).
- 🧊 Forfait en cours : score gelé, décision arbitrale.
- 🛡️ Disputes : signaler la partie en litige, résolution par arbitre.

---

## Classements et départages 🧾

Ordre standard :

1. 🥇 Victoires (plus grand = meilleur)
2. ➗ Quotient = `points_marques / points_encaisses`
   - Si `points_encaisses = 0`, traiter quotient = `points_marques` (ou règle dédiée).
3. 🔢 Points marqués (total)
4. 🎲 Tirage aléatoire (seed) si égalité parfaite

Notes :
- 🔒 Quotient : arrondir pour affichage si besoin.
- 🟢 Byes comptent comme victoire (`13–0`).
- 🔁 En cas d'égalité multiple : confrontation directe → quotient → tirage.

---

## Conseils opérationnels pour l'organisateur 🔧

- ⚙️ Paramétrage : définir format, nb tours (MELEE), nb terrains, mode constitution.
- 🧾 Fournir `seed` pour reproductibilité des tirages.
- ⛳ Créer terrains avant démarrage et grouper matches par terrain.
- 🔐 Utiliser lock (ex: Redis SETNX) pour éviter tirages concurrents.
- 📢 Communiquer règles (13 pts, forfaits) aux capitaines.
- 💾 Sauvegarder `tirages_log` (seed, contraintes, appariements) et exporter PDF des feuilles de match.

---

## Checklist avant démarrage ✅

- [ ] Vérifier inscriptions et tailles d'équipes
- [ ] Configurer format & mode de constitution
- [ ] Créer terrains et définir plages horaires
- [ ] Activer contraintes club si nécessaire
- [ ] Définir seed (optionnel) pour traçabilité
- [ ] Préparer feuilles de match PDF / affichage TV
- [ ] Communiquer règles (13 points, forfaits) aux capitaines
- [ ] Assigner les arbitres par terrain

---

## Annexes / bonnes pratiques 📎

- 🔁 Toujours enregistrer le `seed` du tirage et les `contraintes` dans `tirages_log` pour audit.
- 👩‍⚖️ Pour grands tournois, désigner un responsable tirage unique.
- 📜 Documenter la politique de départage et la publier avant le début.
- 🧪 Recommander un test de tirage sur un échantillon avant l'ouverture officielle.

---

Fin du document.
