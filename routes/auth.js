const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const { isLoggedIn } = require('../middleware');
const appleSignin = require('apple-signin-auth');

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
router.get('/register', (req, res) => res.render('auth/register'));

router.post('/register', async (req, res, next) => {
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
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        failureFlash:    true,
        keepSessionInfo: true,
    }),
    async (req, res) => {
        req.flash('success', `Welcome, ${req.user.username}!`);
        try {
            const teams = await Team.find({ owner: req.user._id });
            if (teams.length === 0) return res.redirect('/teams/new?onboarding=1');
        } catch (e) {}
        res.redirect('/');
    }
);
// ── Apple Sign In ─────────────────────────────────────────────
router.get('/auth/apple', (req, res) => {
    const params = new URLSearchParams({
        client_id:     process.env.APPLE_CLIENT_ID,
        redirect_uri:  process.env.APPLE_CALLBACK_URL,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope:         'name email',
        state:         'state',
    });
    res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

router.post('/auth/apple/callback', async (req, res) => {
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

        // Apple only sends name on first login — grab it if present
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
            req.session.appleSignup = { appleId, email: email || '', firstName, lastName };
            return res.redirect('/auth/choose-username');
        }

        req.login(user, async err => {
            if (err) {
                req.flash('error', 'Login failed. Please try again.');
                return res.redirect('/login');
            }
            req.flash('success', `Welcome, ${user.username}!`);
            try {
                const teams = await Team.find({ owner: user._id });
                if (teams.length === 0) return res.redirect('/teams/new?onboarding=1');
            } catch (_) {}
            res.redirect('/');
        });
    } catch (e) {
        console.error('Apple Sign In error:', e);
        req.flash('error', 'Apple Sign In failed. Please try again.');
        res.redirect('/login');
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
