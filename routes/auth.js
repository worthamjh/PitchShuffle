const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');

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
            res.redirect('/teams');
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
    res.redirect('/teams');
});

// Logout
router.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;