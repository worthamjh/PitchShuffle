const express = require('express');
const router  = express.Router();
const User    = require('../models/user');

// ── RevenueCat webhook ──────────────────────────────────────────
// Configure this URL (https://www.pitchshuffle.com/webhook/revenuecat)
// in the RevenueCat dashboard under Project Settings → Integrations →
// Webhooks, and set the "Authorization header value" there to match
// REVENUECAT_WEBHOOK_SECRET below — RevenueCat sends it back as a
// Bearer token on every request so we can verify the call actually
// came from RevenueCat and not somebody guessing the URL.
//
// The Capacitor app configures the RevenueCat SDK with our own Mongo
// user _id as the `appUserID` (see the pricing page purchase script),
// so `event.app_user_id` below IS the User document's _id — no separate
// mapping table needed.
//
// Docs: https://www.revenuecat.com/docs/integrations/webhooks

router.post('/', express.json(), async (req, res) => {
    const auth = req.headers['authorization'];
    if (!process.env.REVENUECAT_WEBHOOK_SECRET || auth !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
        return res.status(401).send('Unauthorized');
    }

    const event = req.body && req.body.event;
    if (!event || !event.app_user_id) {
        return res.status(400).send('Missing event.app_user_id');
    }

    try {
        const user = await User.findById(event.app_user_id).catch(() => null);
        if (!user) {
            // Not necessarily an error — RevenueCat also fires events for
            // its own internally-generated anonymous IDs before a user is
            // identified. Nothing to sync in that case.
            return res.json({ received: true });
        }

        switch (event.type) {

            // ── Auto-renewing subscriptions (monthly/annual) ────────
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE':
            case 'UNCANCELLATION': {
                user.subscription.iapStatus   = 'active';
                user.subscription.iapProductId = event.product_id || null;
                user.subscription.iapExpiresAt = event.expiration_at_ms
                    ? new Date(event.expiration_at_ms)
                    : null;
                user.subscription.revenueCatAppUserId = event.app_user_id;
                await user.save();
                break;
            }

            // ── One-time purchase (Season Pass) — no expiration_at_ms
            // from RevenueCat since it's non-renewing, so grant the same
            // 90 days used for the Stripe season pass. ─────────────────
            case 'NON_RENEWING_PURCHASE': {
                const seasonEndsAt = new Date();
                seasonEndsAt.setDate(seasonEndsAt.getDate() + 90);
                user.subscription.seasonEndsAt = seasonEndsAt;
                user.subscription.revenueCatAppUserId = event.app_user_id;
                await user.save();
                break;
            }

            // ── Cancellation still leaves access until expiration ───
            case 'CANCELLATION':
                // No immediate change — access continues until
                // iapExpiresAt naturally passes; EXPIRATION handles that.
                break;

            case 'EXPIRATION':
            case 'BILLING_ISSUE':
                user.subscription.iapStatus = 'expired';
                await user.save();
                break;

            default:
                break;
        }

        res.json({ received: true });
    } catch (e) {
        console.error('RevenueCat webhook handler error:', e);
        res.status(500).send('Internal error processing webhook.');
    }
});

module.exports = router;
