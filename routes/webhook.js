const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User    = require('../models/user');

// !! This route needs raw body — must be registered BEFORE express.urlencoded in app.js

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
        console.error('Webhook signature verification failed:', e.message);
        return res.status(400).send(`Webhook Error: ${e.message}`);
    }

    try {
        switch (event.type) {

            case 'checkout.session.completed': {
                const session = event.data.object;

                if (session.mode === 'payment') {
                    // ── Season pass — grant 90 days ──────────────
                    const user = await User.findOne({
                        'subscription.stripeCustomerId': session.customer
                    });
                    if (user) {
                        const seasonEndsAt = new Date();
                        seasonEndsAt.setDate(seasonEndsAt.getDate() + 90);
                        user.subscription.seasonEndsAt = seasonEndsAt;
                        await user.save();
                    }

                } else if (session.mode === 'subscription') {
                    // ── Monthly/annual — set trial status ─────────
                    const user = await User.findOne({
                        'subscription.stripeCustomerId': session.customer
                    });
                    if (!user) break;
                    user.subscription.stripeSubId = session.subscription;
                    user.subscription.status      = 'trialing';
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    user.subscription.trialEndsAt       = sub.trial_end
                        ? new Date(sub.trial_end * 1000)
                        : null;
                    user.subscription.currentPeriodEnds = sub.current_period_end
                        ? new Date(sub.current_period_end * 1000)
                        : null;
                    await user.save();
                }
                break;
            }

            case 'customer.subscription.updated': {
                const sub  = event.data.object;
                const user = await User.findOne({
                    'subscription.stripeCustomerId': sub.customer
                });
                if (!user) break;
                user.subscription.status            = sub.status;
                user.subscription.trialEndsAt       = sub.trial_end
                    ? new Date(sub.trial_end * 1000)
                    : null;
                user.subscription.currentPeriodEnds = sub.current_period_end
                    ? new Date(sub.current_period_end * 1000)
                    : null;
                await user.save();
                break;
            }

            case 'customer.subscription.deleted': {
                const sub  = event.data.object;
                const user = await User.findOne({
                    'subscription.stripeCustomerId': sub.customer
                });
                if (!user) break;
                user.subscription.status      = 'cancelled';
                user.subscription.stripeSubId = null;
                await user.save();
                break;
            }

            default:
                break;
        }
    } catch (e) {
        console.error('Webhook handler error:', e);
        return res.status(500).send('Internal error processing webhook.');
    }

    res.json({ received: true });
});

module.exports = router;
