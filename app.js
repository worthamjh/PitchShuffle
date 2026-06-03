require('dotenv').config();
require('./cloudinary');
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/user');

const authRoutes         = require('./routes/auth');
const teamRoutes         = require('./routes/teams');
const pitcherRoutes      = require('./routes/pitchers');
const profileRoutes      = require('./routes/profile');
const subscriptionRoutes = require('./routes/subscription');
const webhookRoutes      = require('./routes/webhook');

mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => { console.log('Database connected'); });

app.engine('ejs', ejsMate);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// !! Webhook route MUST be mounted before express.urlencoded so it gets the raw body
app.use('/webhook/stripe', webhookRoutes);

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
// app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = { secret: process.env.SESSION_SECRET || 'yoursecret', resave: false, saveUninitialized: true };
app.use(session(sessionConfig));
app.use(flash());

// ── Passport local strategy ───────────────────────────────────
passport.use(new LocalStrategy(User.authenticate()));

// ── Passport Google strategy ──────────────────────────────────
passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;

        // Check if user already exists by googleId
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Check if user exists with same email (registered manually)
        if (email) {
            user = await User.findOne({ email });
            if (user) {
                // Link Google account to existing user
                user.googleId = profile.id;
                if (!user.avatar && profile.photos?.[0]?.value) {
                    user.avatar = profile.photos[0].value;
                }
                await user.save();
                return done(null, user);
            }
        }

        // Create new user
        const username = profile.displayName.replace(/\s+/g, '').toLowerCase() +
            Math.floor(Math.random() * 1000);
        const newUser = new User({
            googleId: profile.id,
            email:    email || '',
            username,
            avatar:   profile.photos?.[0]?.value || '',
        });
        await newUser.save();
        return done(null, newUser);
    } catch (e) {
        return done(e);
    }
}));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (e) {
        done(e);
    }
});
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.currentUser        = req.user;
    res.locals.success            = req.flash('success');
    res.locals.error              = req.flash('error');
    res.locals.warning            = req.flash('warning');
    res.locals.teamColor          = null;
    res.locals.teamSecondaryColor = null;
    res.locals.teamStrikeColor    = null;
    res.locals.teamChaseColor     = null;
    next();
});

app.use('/',                       authRoutes);
app.use('/teams',                  teamRoutes);
app.use('/teams/:teamId/pitchers', pitcherRoutes);
app.use('/profile',                profileRoutes);
app.use('/subscription',           subscriptionRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('error', { statusCode: 404, message: 'Page not found.' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.status || 500;
    const message    = err.message || 'Something went wrong.';
    res.status(statusCode).render('error', { statusCode, message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`App is listening on port ${port}`); });
// redeploy