# Configuration des credentials Community Agent sur Render

## Variables d'environnement à configurer dans Render

Aller sur : https://dashboard.render.com/web/srv-xxx/env (remplacer srv-xxx par l'ID du service)

### 1. Credentials obligatoires

#### Wallet de l'agent (pour payer les appels x402)
- **AGENT_PRIVATE_KEY** : Clé privée d'un wallet Base avec ~0.50 USDC
  - Créer un nouveau wallet dédié pour l'agent
  - Transférer 0.50 USDC sur Base mainnet
  - Format : `0x...` (64 caractères hex)

#### IA pour génération de contenu
- **GEMINI_API_KEY** : Obtenir sur https://aistudio.google.com/apikey
  - Gratuit jusqu'à 2M tokens/mois
  - Remplace OpenAI pour réduire les coûts

### 2. Plateformes sociales (au moins 1-2 pour commencer)

#### Telegram (recommandé pour les previews)
- **TELEGRAM_BOT_TOKEN** : Créer un bot via @BotFather
- **TELEGRAM_CHAT_ID** : ID de ton chat privé avec le bot (pour approvals)
- **TELEGRAM_CHANNEL_ID** : @nom_du_canal public x402

#### Discord (facile à configurer)
- **DISCORD_WEBHOOK_URL** : Dans les paramètres du canal → Intégrations → Webhooks

#### Dev.to (gratuit et simple)
- **DEVTO_API_KEY** : https://dev.to/settings/extensions → Generate API Key

### 3. Plateformes optionnelles (plus complexes)

#### Twitter/X (nécessite $100/mois Basic tier)
- **TWITTER_API_KEY**, **TWITTER_API_SECRET**
- **TWITTER_ACCESS_TOKEN**, **TWITTER_ACCESS_SECRET**
- Créer une app sur https://developer.twitter.com/

#### Reddit (OAuth2)
- **REDDIT_CLIENT_ID**, **REDDIT_CLIENT_SECRET**
- **REDDIT_USERNAME**, **REDDIT_PASSWORD**
- Créer une app sur https://www.reddit.com/prefs/apps

#### LinkedIn (OAuth2 complexe)
- **LINKEDIN_ACCESS_TOKEN** : Nécessite OAuth flow manuel

#### Farcaster
- **FARCASTER_SIGNER_KEY** : Via Neynar ou Warpcast
- **FARCASTER_FID** : Ton ID Farcaster
- **NEYNAR_API_KEY** : Si utilisation de Neynar

## Ordre de priorité recommandé

1. **Phase 1** (minimum viable) :
   - AGENT_PRIVATE_KEY ✓
   - GEMINI_API_KEY ✓
   - TELEGRAM_* (pour preview/approval) ✓
   - DISCORD_WEBHOOK_URL ✓

2. **Phase 2** (expansion) :
   - DEVTO_API_KEY
   - REDDIT_*

3. **Phase 3** (premium) :
   - TWITTER_* (coût mensuel)
   - LINKEDIN_*
   - FARCASTER_*

## Test local avant déploiement

```bash
# Créer .env avec les credentials
cp .env.example .env
# Éditer .env avec les vraies valeurs

# Tester en mode preview
node agent.js --preview

# Si OK, push vers GitHub → auto-deploy Render
git add .env  # NON ! Ne jamais commit .env
git push origin main
```

## Vérification après configuration

1. Aller sur https://x402-community-agent.onrender.com (ou l'URL de ton service)
2. Dashboard devrait s'afficher sur le port configuré
3. Vérifier les logs Render pour voir si l'agent démarre correctement
4. Lancer une stratégie manuelle depuis le dashboard

## Notes

- Les credentials avec `sync: false` ne sont PAS inclus dans le code
- Render chiffre automatiquement les variables d'environnement
- Pour mettre à jour : changer dans Render UI → redémarrer le service
- Budget par défaut : 0.50 USDC (configurable via MAX_BUDGET_USDC)