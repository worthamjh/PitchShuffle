const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const { isLoggedIn, blockNativeSignup, isNativeApp } = require('../middleware');
const { createNativeAuthToken, verifyNativeAuthToken } = require('../utilities/nativeAuth');
const appleSignin = require('apple-signin-auth');
const { sendWelcomeEmail } = require('../utilities/email');

function setTeamLocals(res, team) {
    res.locals.teamColor          = team.primaryColor   || '#1a2e4a';
    res.locals.teamSecondaryColor = team.secondaryColor || '#4a7fa5';
    res.locals.teamStrikeColor    = team.strikeColor    || '#c8ecd4';
    res.locals.teamChaseColor     = team.chaseColor     || '#fef3cd';
}

const BASEBALL_PITCHES = [
    { name: 'Fastball',  abbreviation: 'FB' },
    { name: 'Curveball', abbreviation: 'CB' },
    { name: 'Changeup',  abbreviation: 'CH' },
    { name: 'Slider',    abbreviation: 'SL' },
];

const SOFTBALL_PITCHES = [
    { name: 'Fastball',  abbreviation: 'FB' },
    { name: 'Riseball',  abbreviation: 'RB' },
    { name: 'Dropball',  abbreviation: 'DB' },
    { name: 'Changeup',  abbreviation: 'CH' },
];

// ── Home ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.render('home');
    res.redirect('/login');
});

// ── Quick Game ────────────────────────────────────────────────
router.get('/quick-game', isLoggedIn, (req, res) => {
    const sport = req.query.sport === 'softball' ? 'softball' : 'baseball';
    const quickPitcher = {
        number: 1,
        name:   'Pitcher',
        throws: 'R',
        sport,
        pitchTypes: sport === 'softball' ? SOFTBALL_PITCHES : BASEBALL_PITCHES,
        zone: {
            availableLocations: [
                { name: 'glove-up',       type: 'strike', enabled: true },
                { name: 'mid-up',         type: 'strike', enabled: true },
                { name: 'arm-up',         type: 'strike', enabled: true },
                { name: 'glove-mid',      type: 'strike', enabled: true },
                { name: 'mid-mid',        type: 'strike', enabled: true },
                { name: 'arm-mid',        type: 'strike', enabled: true },
                { name: 'glove-down',     type: 'strike', enabled: true },
                { name: 'mid-down',       type: 'strike', enabled: true },
                { name: 'arm-down',       type: 'strike', enabled: true },
                { name: 'glove-out-up',   type: 'chase',  enabled: true },
                { name: 'up-out',         type: 'chase',  enabled: true },
                { name: 'arm-out-up',     type: 'chase',  enabled: true },
                { name: 'glove-out-mid',  type: 'chase',  enabled: true },
                { name: 'arm-out-mid',    type: 'chase',  enabled: true },
                { name: 'glove-out-down', type: 'chase',  enabled: true },
                { name: 'down-out',       type: 'chase',  enabled: true },
                { name: 'arm-out-down',   type: 'chase',  enabled: true },
            ]
        }
    };
    res.render('pitchers/quick-game', { pitcher: quickPitcher, sport });
});

// ── Game flow ─────────────────────────────────────────────────
router.get('/game', isLoggedIn, async (req, res, next) => {
    try {
        const teams = await Team.find({ owner: req.user._id }).populate('pitchers');
        res.render('game/select-team', { teams });
    } catch (e) {
        next(e);
    }
});

router.get('/game/:teamId', isLoggedIn, async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        if (!team) {
            req.flash('error', 'Team not found.');
            return res.redirect('/game');
        }
        if (!team.owner.equals(req.user._id)) {
            req.flash('error', 'You do not have permission to do that.');
            return res.redirect('/game');
        }
        setTeamLocals(res, team);
        res.render('game/select-pitcher', { team });
    } catch (e) {
        next(e);
    }
});

// ── Auth ──────────────────────────────────────────────────────
router.get('/register', blockNativeSignup, (req, res) => res.render('auth/register'));

router.post('/register', blockNativeSignup, async (req, res, next) => {
    try {
        const { email, username, password, zoneTerminology } = req.body;
        if (!username || !username.trim()) {
            req.flash('error', 'Username is required.');
            return res.redirect('/register');
        }
        if (!password || password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect('/register');
        }
        const safeTerminology = ['arm-glove', 'inside-away'].includes(zoneTerminology)
            ? zoneTerminology
            : 'arm-glove';
        const user = new User({
            email,
            username,
            preferences: { zoneTerminology: safeTerminology }
        });
        const registeredUser = await User.register(user, password);
        sendWelcomeEmail(registeredUser.email, registeredUser.username).catch(err =>
            console.error('Welcome email failed:', err)
        );
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', `Welcome to PitchShuffle, ${registeredUser.username}!`);
            res.redirect('/teams/new?onboarding=1');
        });
    } catch (e) {
        req.flash('error', e.message || 'Registration failed. Please try again.');
        res.redirect('/register');
    }
});

router.get('/login', (req, res) => res.render('auth/login'));

router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash:    'Invalid username or password.',
    keepSessionInfo: true
}), (req, res) => {
    req.flash('success', `Welcome back, ${req.user.username}!`);
    res.redirect('/');
});

router.post('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) return next(err);
        req.flash('success', 'Logged out successfully.');
        res.redirect('/login');
    });
});

// ── Google OAuth ──────────────────────────────────────────────
// The OAuth handshake leaves our WebView entirely (Google refuses to run
// inside an embedded webview and forces a handoff to system Safari), so
// the native User-Agent tag doesn't survive the round trip. We carry the
// "this came from the native app" signal through OAuth's `state` param
// instead, which Google echoes back on /auth/google/callback.
router.get('/auth/google',
    (req, res, next) => {
        const state = req.query.native === '1' ? 'native' : undefined;
        passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
    }
);

router.get('/auth/google/callback', (req, res, next) => {
    // Custom callback (rather than the failureRedirect/failureFlash
    // shorthand) so we can send native sessions back through the
    // pitchshuffle:// URL scheme instead of a plain https redirect. The
    // OAuth screen ran in system Safari, so this response is what closes
    // that sheet and hands control back to the app (see the appUrlOpen
    // listener in boilerplate.ejs).
    const isNative = req.query.state === 'native';
    passport.authenticate('google', { keepSessionInfo: true }, (err, user, info) => {
        if (err || !user) {
            const msg = (info && info.message) || 'Google sign-in failed. Please try again.';
            req.flash('error', msg);
            // The message is also passed as a query param on the custom
            // scheme (not just via session flash) since the session cookie
            // set by this response may not reliably be visible yet by the
            // time the app's WebView makes its next request — belt and
            // suspenders so the user always sees why they got bounced back.
            return res.redirect(isNative ? `pitchshuffle://auth-failed?message=${encodeURIComponent(msg)}` : '/login');
        }
        req.login(user, async loginErr => {
            if (loginErr) {
                const msg = 'Login failed. Please try again.';
                req.flash('error', msg);
                return res.redirect(isNative ? `pitchshuffle://auth-failed?message=${encodeURIComponent(msg)}` : '/login');
            }
            req.flash('success', `Welcome, ${user.username}!`);
            let next = '/';
            try {
                const teams = await Team.find({ owner: user._id });
                if (teams.length === 0) next = '/teams/new?onboarding=1';
            } catch (e) {}
            if (isNative) {
                // Don't rely on the session cookie set on *this* response
                // (made inside the OAuth sheet's browsing context) carrying
                // over to the app's own WebView — hand off a one-time token
                // instead and let the app's WebView establish its own
                // session via /auth/native-exchange.
                const token = createNativeAuthToken(user._id.toString());
                return res.redirect(`pitchshuffle://auth-success?token=${token}&next=${encodeURIComponent(next)}`);
            }
            res.redirect(next);
        });
    })(req, res, next);
});

// ── Native auth token exchange ──────────────────────────────────
// The app's own WebView hits this (not the OAuth sheet) to turn a
// short-lived token from the pitchshuffle:// return into a real login
// session, established directly in this request's own context.
router.get('/auth/native-exchange', async (req, res) => {
    const { token, next } = req.query;
    const safeNext = (typeof next === 'string' && next.startsWith('/')) ? next : '/';
    const userId = token && verifyNativeAuthToken(token);
    if (!userId) {
        req.flash('error', 'Sign-in expired. Please try again.');
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error', 'Account not found. Please try again.');
            return res.redirect('/login');
        }
        req.login(user, err => {
            if (err) {
                req.flash('error', 'Login failed. Please try again.');
                return res.redirect('/login');
            }
            res.redirect(safeNext);
        });
    } catch (e) {
        console.error('Native auth exchange error:', e);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/login');
    }
});

// ── Apple Sign In ─────────────────────────────────────────────
router.get('/auth/apple', (req, res) => {
    // Same cross-domain-redirect issue as Google: carry native-ness via
    // Apple's `state` param, which comes back in the callback's POST body.
    const state = req.query.native === '1' ? 'native' : 'web';
    const params = new URLSearchParams({
        client_id:     process.env.APPLE_CLIENT_ID,
        redirect_uri:  process.env.APPLE_CALLBACK_URL,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope:         'name email',
        state,
    });
    res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

router.post('/auth/apple/callback', async (req, res) => {
    const isNative = req.body.state === 'native';
    try {
        const { id_token, user: userJson } = req.body;
        const clientSecret = appleSignin.getClientSecret({
            clientID:   process.env.APPLE_CLIENT_ID,
            teamID:     process.env.APPLE_TEAM_ID,
            privateKey: Buffer.from(process.env.APPLE_PRIVATE_KEY, 'base64').toString('utf8'),
            keyIdentifier: process.env.APPLE_KEY_ID,
        });

        const { sub: appleId, email } = await appleSignin.verifyIdToken(id_token, {
            audience:  process.env.APPLE_CLIENT_ID,
            ignoreExpiration: false,
        });

        let firstName = '', lastName = '';
        if (userJson) {
            try {
                const parsed = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
                firstName = parsed?.name?.firstName || '';
                lastName  = parsed?.name?.lastName  || '';
            } catch (_) {}
        }

        let user = await User.findOne({ appleId });

        if (!user && email) {
            user = await User.findOne({ email });
            if (user) {
                user.appleId = appleId;
                await user.save();
            }
        }

        if (!user) {
            // Apple Guideline 3.1.1 / 3.1.3(a): existing users may log in
            // with Apple on native, but new accounts can't be created there.
            // isNativeApp(req) won't see the native UA tag here (Apple's
            // consent screen runs in system Safari, not our WebView), so
            // rely on the state param that made the round trip instead.
            if (isNative || isNativeApp(req)) {
                const msg = 'No PitchShuffle account found for that Apple ID. Please sign up at pitchshuffle.com.';
                req.flash('error', msg);
                return res.redirect(isNative ? `pitchshuffle://auth-failed?message=${encodeURIComponent(msg)}` : '/login');
            }
            req.session.appleSignup = { appleId, email: email || '', firstName, lastName };
            return res.redirect('/auth/choose-username');
        }

        req.login(user, async err => {
            if (err) {
                const msg = 'Login failed. Please try again.';
                req.flash('error', msg);
                return res.redirect(isNative ? `pitchshuffle://auth-failed?message=${encodeURIComponent(msg)}` : '/login');
            }
            req.flash('success', `Welcome, ${user.username}!`);
            let next = '/';
            try {
                const teams = await Team.find({ owner: user._id });
                if (teams.length === 0) next = '/teams/new?onboarding=1';
            } catch (_) {}
            if (isNative) {
                // Same cross-context cookie caveat as Google: hand off a
                // one-time token rather than relying on this response's
                // session cookie reaching the app's own WebView.
                const token = createNativeAuthToken(user._id.toString());
                return res.redirect(`pitchshuffle://auth-success?token=${token}&next=${encodeURIComponent(next)}`);
            }
            res.redirect(next);
        });
    } catch (e) {
        console.error('Apple Sign In error:', e);
        const msg = 'Apple Sign In failed. Please try again.';
        req.flash('error', msg);
        res.redirect(isNative ? `pitchshuffle://auth-failed?message=${encodeURIComponent(msg)}` : '/login');
    }
});

// ── Apple Choose Username ─────────────────────────────────────
router.get('/auth/choose-username', blockNativeSignup, (req, res) => {
    if (!req.session.appleSignup) return res.redirect('/login');
    const { firstName, lastName } = req.session.appleSignup;
    const suggested = (firstName || '').toLowerCase().replace(/\s+/g, '') || '';
    res.render('auth/choose-username', { suggested });
});

router.post('/auth/choose-username', blockNativeSignup, async (req, res, next) => {
    try {
        if (!req.session.appleSignup) return res.redirect('/login');
        const { appleId, email } = req.session.appleSignup;
        const username = (req.body.username || '').trim();
        if (!username || username.length < 3) {
            req.flash('error', 'Username must be at least 3 characters.');
            return res.redirect('/auth/choose-username');
        }
        const existing = await User.findOne({ username });
        if (existing) {
            req.flash('error', 'That username is taken. Please choose another.');
            return res.redirect('/auth/choose-username');
        }
        const user = new User({ appleId, email, username, avatar: '' });
        await user.save();
        sendWelcomeEmail(user.email, user.username).catch(err =>
            console.error('Welcome email failed:', err)
        );
        delete req.session.appleSignup;
        req.login(user, async err => {
            if (err) return next(err);
            req.flash('success', `Welcome to PitchShuffle, ${user.username}!`);
            res.redirect('/teams/new?onboarding=1');
        });
    } catch (e) {
        req.flash('error', e.message || 'Something went wrong. Please try again.');
        res.redirect('/auth/choose-username');
    }
});

// ── Onboarding complete ───────────────────────────────────────
router.get('/onboarding/complete', isLoggedIn, (req, res) => {
    const { teamId, pitcherId } = req.query;
    if (!teamId || !pitcherId) return res.redirect('/');
    res.render('onboarding/complete', { teamId, pitcherId });
});

// ── Legal ─────────────────────────────────────────────────────
router.get('/terms',   (req, res) => res.render('legal/terms'));
router.get('/privacy', (req, res) => res.render('legal/privacy'));

module.exports = router;