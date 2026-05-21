const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { isLoggedIn } = require('../middleware');

// ── Pricing page ──────────────────────────────────────────────
router.get('/', isLoggedIn, (req, res) => {
    res.render('subscription/pricing', {
        user:           req.user,
        priceMonthly:   process.env.STRIPE_PRICE_MONTHLY,
    });
});

// ── Create Stripe Checkout session ───────────────────────────
router.post('/checkout', isLoggedIn, async (req, res, next) => {
    try {
        const user = req.user;
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // Reuse existing Stripe customer if we have one
        let customerId = user.subscription?.stripeCustomerId || null;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email:    user.email,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            user.subscription.stripeCustomerId = customerId;
            await user.save();
        }

        const session = await stripe.checkout.sessions.create({
            customer:             customerId,
            payment_method_types: ['card'],
            mode:                 'subscription',
            line_items: [{
                price:    process.env.STRIPE_PRICE_MONTHLY,
                quantity: 1,
            }],
            subscription_data: {
                trial_period_days: 30,
            },
            success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${baseUrl}/subscription`,
        });

        res.redirect(303, session.url);
    } catch (e) {
        next(e);
    }
});

// ── Success page (after Stripe redirects back) ────────────────
router.get('/success', isLoggedIn, (req, res) => {
    res.render('subscription/success');
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
