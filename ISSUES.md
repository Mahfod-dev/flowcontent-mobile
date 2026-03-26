# FlowContent Mobile — Issues à corriger

## 1. ~~Typewriter effect trop rapide~~ ✅
- Ralenti de 4chars/12ms → 2chars/20ms

## 2. Filtre par suite (comme le frontend) ⏳ backend requis
- Ajouter un filtre/sélecteur de suite dans la sidebar ou le chat
- Nécessite d'abord un lien session↔domaine côté backend

## 3. Barre de recherche conversations
- Ajouter une barre de recherche dans la sidebar pour chercher parmi les conversations

## 4. Connexion Google ⏳ backend requis
- Ajouter le login via Google (OAuth) en plus de l'email/password

## 5. Upgrade / Paiement ⏳ backend requis
- Permettre à l'utilisateur de gérer son abonnement / upgrader son plan depuis l'app

## 6. Connecteurs (intégrations) ⏳ backend requis
- Permettre à l'utilisateur de connecter ses comptes (réseaux sociaux, etc.) comme sur le frontend web
- Sur mobile c'est potentiellement plus simple (OAuth natif, partage système, etc.)

## 7. Gestion de médias (dossier) ⏳ backend requis
- Permettre à l'utilisateur de stocker/organiser ses images, vidéos et autres fichiers dans des dossiers
- Bibliothèque de contenus générés accessible depuis l'app

## 8. Notifications push ⏳ backend requis
- Notifier l'utilisateur quand une tâche/génération est terminée
- Même si l'app est en arrière-plan ou fermée

## 9. Entrée vocale (speech-to-text)
- L'utilisateur parle à l'app et sa voix est retranscrite en texte dans le champ de message
- Plus rapide et pratique sur mobile

## 10. Profil utilisateur (user.md) ⏳ backend requis
- Permettre de modifier son user.md (profil agent : ton, style, infos sur l'utilisateur, préférences de contenu)
- L'agent utilise ce profil pour personnaliser ses réponses et le contenu généré

## 11. ~~Copier / Partager le contenu~~ ✅ (déjà implémenté)
- Long press → copie. Ajouter le partage natif (Share sheet)

## 12. ~~Rendu Markdown dans les messages~~ ✅ (déjà implémenté)
- react-native-markdown-display avec styles complets

## 13. Haptic feedback
- Vibrations subtiles sur les actions (envoi message, nouvelle réponse, etc.) pour un feel plus natif

## 14. Swipe actions sur les conversations
- Swipe gauche pour supprimer, swipe droite pour épingler une conversation
