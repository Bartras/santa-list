# Liste de Noël

Site statique (GitHub Pages) + Firebase Firestore pour le partage temps réel des « cadeau pris par … ».

## Mise en place (≈10 min)
1. **Firebase** : console.firebase.google.com → créer un projet → *Build > Firestore Database* (mode production, région `eur3`).
2. *Build > Authentication* → activer **Email/Mot de passe** → ajouter ton compte (email + mot de passe) puis **vérifier l'email** (rules exigent `email_verified`; sinon enlève cette ligne dans `firestore.rules`).
3. *Paramètres du projet > Tes applications > Web (</>)* → copier la config dans `firebase-config.js`.
4. *Firestore > Règles* → coller `firestore.rules` en remplaçant `TON_EMAIL@exemple.fr` → Publier.
5. *Authentication > Paramètres > Domaines autorisés* → ajouter `TON_PSEUDO.github.io`.
6. **GitHub Pages** : Settings > Pages > Deploy from branch > `main` / root.
7. Ouvre le site → lien « Admin » en bas → connecte-toi → « + Ajouter un cadeau ».

## Sécurité
- Lecture publique ; création/édition/suppression réservées à ton compte (règles Firestore).
- Les visiteurs ne peuvent modifier que `takenBy`/`takenAt` (réserver un cadeau libre, ou libérer).
- Photo « depuis l'appareil » : redimensionnée en JPEG ≤700 px et stockée dans le document (pas de Firebase Storage, qui est payant désormais).
