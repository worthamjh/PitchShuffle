const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User    = require('../models/user');

// !! This route needs raw body — must be registered BEFORE express.urlencoded in app.js
// See app.js comment for how to mount this correctly.

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig    = req.headers['stripe-signature'];
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
                // Only handle subscription checkouts
                if (session.mode !== 'subscription') break;
                const user = await User.findOne({
                    'subscription.stripeCustomerId': session.customer
                });
                if (!user) break;
                user.subscription.stripeSubId = session.subscription;
                user.subscription.status      = 'trialing';
                // Trial end comes from the subscription object — fetch it
                const sub = await stripe.subscriptions.retrieve(session.subscription);
                user.subscription.trialEndsAt       = sub.trial_end
                    ? new Date(sub.trial_end * 1000)
                    : null;
                user.subscription.currentPeriodEnds = new Date(sub.current_period_end * 1000);user.subscription.currentPeriodEnds = sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null;
                await user.save();
                break;
            }

            case 'customer.subscription.updated': {
                const sub  = event.data.object;
                const user = await User.findOne({
                    'subscription.stripeCustomerId': sub.customer
                });
                if (!user) break;
                user.subscription.status            = sub.status; // active, past_due, etc.
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
                // Ignore other events
                break;
        }
    } catch (e) {
        console.error('Webhook handler error:', e);
        return res.status(500).send('Internal error processing webhook.');
    }

    res.json({ received: true });
});

module.exports = router;
