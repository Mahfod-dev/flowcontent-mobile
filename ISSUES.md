# FlowContent Mobile — Issues à corriger

## 1. ~~Typewriter effect trop rapide~~ ✅
- Ralenti de 4chars/12ms → 2chars/20ms

## 2. ~~Filtre par site~~ ✅
- Site switcher chips dans la sidebar (GET /site-domains)

## 3. ~~Barre de recherche conversations~~ ✅
- Barre de recherche dans la sidebar

## 4. Connexion Google
- Ajouter le login via Google (OAuth) en plus de l'email/password
- Backend déjà prêt (google-auth module)

## 5. Upgrade / Paiement
- Permettre à l'utilisateur de gérer son abonnement depuis l'app
- Backend: credits module existant

## 6. ~~Connecteurs (intégrations)~~ ✅ (affichage)
- Liste des intégrations connectées visible dans le profil
- OAuth flow à implémenter plus tard (nécessite WebView)

## 7. Gestion de médias (dossier)
- Permettre de stocker/organiser ses images, vidéos et fichiers dans des dossiers

## 8. ~~Notifications~~ ✅
- Écran notifications complet avec badge, priorités, mark read
- Badge compteur dans la sidebar

## 9. ~~Entrée vocale (speech-to-text)~~ ✅
- Bouton micro dans le chat, reconnaissance vocale FR

## 10. ~~Profil utilisateur~~ ✅
- Écran profil avec édition (nom, site, entreprise, bio)
- Affichage des intégrations connectées

## 11. ~~Copier / Partager le contenu~~ ✅
- Long press → menu Copier / Partager (Share sheet natif)

## 12. ~~Rendu Markdown~~ ✅ (déjà implémenté)

## 13. ~~Haptic feedback~~ ✅
- Vibrations sur envoi, copie, long press

## 14. Swipe actions sur les conversations
- Swipe gauche supprimer ✅ (déjà fait)
- Swipe droite épingler (à faire)

## 15. ~~Upload de fichiers~~ ✅
- Bouton "+" → Photo/Galerie ou Document (PDF, DOCX, etc.)
- Upload vers backend + envoi avec le message
