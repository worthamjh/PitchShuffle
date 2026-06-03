const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const { isLoggedIn } = require('../middleware');

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
            res.redirect('/');
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
        failureFlash:    'Google sign-in failed. Please try again.',
        keepSessionInfo: true,
    }),
    (req, res) => {
        req.flash('success', `Welcome, ${req.user.username}!`);
        res.redirect('/');
    }
);

router.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        failureFlash:    true,
        keepSessionInfo: true,
    }),
    (req, res) => {
        req.flash('success', `Welcome, ${req.user.username}!`);
        res.redirect('/');
    }
);
module.exports = router;
