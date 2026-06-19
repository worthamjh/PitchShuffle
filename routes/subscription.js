const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { isLoggedIn } = require('../middleware');

// ── Pricing page ──────────────────────────────────────────────
router.get('/', isLoggedIn, (req, res) => {
    res.render('subscription/pricing', { user: req.user });
});

// ── Helper: get or create Stripe customer ─────────────────────
async function getOrCreateCustomer(user) {
    if (user.subscription?.stripeCustomerId) return user.subscription.stripeCustomerId;
    const customer = await stripe.customers.create({
        email:    user.email,
        metadata: { userId: user._id.toString() }
    });
    user.subscription.stripeCustomerId = customer.id;
    await user.save();
    return customer.id;
}

// ── Create Stripe Checkout session ────────────────────────────
// plan = 'monthly' | 'annual' | 'season'
// Returns JSON { url } instead of redirecting server-side, so the
// client can decide how to open it (normal nav on web, system
// browser via Capacitor on the native iOS app).
router.post('/checkout', isLoggedIn, async (req, res, next) => {
    try {
        const { plan = 'monthly' } = req.body;
        const user      = req.user;
        const baseUrl   = `${req.protocol}://${req.get('host')}`;
        const customerId = await getOrCreateCustomer(user);

        const PRICES = {
            monthly: process.env.STRIPE_PRICE_MONTHLY,
            annual:  process.env.STRIPE_PRICE_ANNUAL,
            season:  process.env.STRIPE_PRICE_SEASON,
        };

        const priceId = PRICES[plan];
        if (!priceId) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const isSeason = plan === 'season';

        const sessionParams = {
            customer:             customerId,
            payment_method_types: ['card'],
            mode:                 isSeason ? 'payment' : 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
            cancel_url:  `${baseUrl}/subscription`,
        };

        // Add trial only for monthly/annual, not season pass
        if (!isSeason) {
            sessionParams.subscription_data = { trial_period_days: 7 };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        res.json({ url: session.url });
    } catch (e) {
        next(e);
    }
});

// ── Success page ──────────────────────────────────────────────
router.get('/success', isLoggedIn, async (req, res, next) => {
    try {
        const { plan, session_id } = req.query;

        // For season pass, grant 90 days access immediately on success
        if (plan === 'season' && session_id) {
            const session = await stripe.checkout.sessions.retrieve(session_id);
            if (session.payment_status === 'paid') {
                const seasonEndsAt = new Date();
                seasonEndsAt.setDate(seasonEndsAt.getDate() + 90);
                req.user.subscription.seasonEndsAt = seasonEndsAt;
                await req.user.save();
            }
        }

        res.render('subscription/success', { plan });
    } catch (e) {
        next(e);
    }
});

// ── Customer portal (manage/cancel subscription) ──────────────
// Also returns JSON { url } now, for the same reason as /checkout.
router.post('/portal', isLoggedIn, async (req, res, next) => {
    try {
        const customerId = req.user.subscription?.stripeCustomerId;
        if (!customerId) {
            return res.status(400).json({ error: 'No subscription found.' });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const session = await stripe.billingPortal.sessions.create({
            customer:   customerId,
            return_url: `${baseUrl}/profile`,
        });
        res.json({ url: session.url });
    } catch (e) {
        next(e);
    }
});

module.exports = router;