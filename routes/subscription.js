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
            req.flash('error', 'Invalid plan selected.');
            return res.redirect('/subscription');
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
        res.redirect(303, session.url);
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
router.post('/portal', isLoggedIn, async (req, res, next) => {
    try {
        const customerId = req.user.subscription?.stripeCustomerId;
        if (!customerId) {
            req.flash('error', 'No subscription found.');
            return res.redirect('/subscription');
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const session = await stripe.billingPortal.sessions.create({
            customer:   customerId,
            return_url: `${baseUrl}/profile`,
        });
        res.redirect(303, session.url);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
