# Location Moto (PWA)
React + TypeScript + Vite · Supabase · Vercel

1. **Supabase** : créer un projet, exécuter `supabase/schema.sql` dans le SQL Editor.
2. `cp .env.example .env` et renseigner l'URL et la clé anon (Project Settings > API).
3. `npm install && npm run dev`
4. **Icônes** : ajouter `public/icon-192.png` et `public/icon-512.png` (à générer depuis `icon.svg`).
5. **Vercel** : importer le dépôt, ajouter les 2 variables `VITE_SUPABASE_*`, déployer.

Rappels : notification à l'ouverture de l'app + export `.ics` (alarme calendrier la veille de chaque paiement).

## Mise à jour 2 : rappels automatiques, photos/documents, édition
1. Exécuter `supabase/migration-2.sql` (remplacer `PROJECT_REF` et `SERVICE_ROLE_KEY` dans la dernière requête).
2. Générer les clés VAPID : `npx web-push generate-vapid-keys`.
3. Mettre la clé publique dans `.env` et sur Vercel : `VITE_VAPID_PUBLIC_KEY`.
4. Déployer la fonction :
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:vous@exemple.com`
   `supabase functions deploy send-reminders`
5. Dans l'app, onglet Échéances > « Activer les rappels automatiques » sur chaque appareil.
Sur iPhone, la PWA doit d'abord être ajoutée à l'écran d'accueil pour recevoir les notifications.

## Connexion
L'inscription publique est retirée : créez les utilisateurs dans Supabase (Authentication > Users > Add user, cochez « Auto Confirm User »).
Si la connexion échoue : vérifiez les variables `VITE_SUPABASE_*` sur Vercel (puis **Redeploy**) et que l'utilisateur est confirmé.

## Paiements le dimanche et fiche détaillée
- Les échéances tombent chaque dimanche (premier dimanche après le début, jusqu'à la date de fin).
- Contrats > « Détails » : résumé, infos chauffeur et véhicule, échéancier complet. « Imprimer / PDF » ouvre la boîte d'impression : choisir « Enregistrer au format PDF ».
- Contrats créés avant cette mise à jour : ouvrir « Modifier » puis « Enregistrer » pour recalculer les échéances non payées en dimanches.

## Reçus et WhatsApp
- Détails du contrat > ligne payée > « Reçu » : reçu imprimable (PDF) avec n°, montant et reste à payer, envoyable par WhatsApp.
- « WhatsApp » (onglet Échéances ou échéancier) ouvre un message de rappel prêt à envoyer. Numéros à 8 chiffres : le préfixe 509 est ajouté automatiquement.
