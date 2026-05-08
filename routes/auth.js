const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Team = require('../models/team');
const Pitcher = require('../models/pitcher');
const { isLoggedIn } = require('../middleware');

// ── Home ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.render('home');
    }
    res.redirect('/login');
});

// ── Game flow ─────────────────────────────────────────────────

// Step 1 — select team
router.get('/game', isLoggedIn, async (req, res) => {
    try {
        const teams = await Team.find({ owner: req.user._id }).populate('pitchers');
        res.render('game/select-team', { teams });
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

// Step 2 — select pitcher from chosen team
router.get('/game/:teamId', isLoggedIn, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('pitchers');
        if (!team) return res.redirect('/game');
        res.render('game/select-pitcher', { team });
    } catch (e) {
        console.error(e);
        res.redirect('/game');
    }
});

// ── Auth ──────────────────────────────────────────────────────

// Register form
router.get('/register', (req, res) => {
    res.render('auth/register');
});

// Register logic
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect('/');
        });
    } catch (e) {
        res.redirect('/register');
    }
});

// Login form
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Login logic
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    keepSessionInfo: true
}), (req, res) => {
    res.redirect('/');
});

// Logout
router.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;
