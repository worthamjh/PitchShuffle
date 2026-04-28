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
const User = require('./models/user');

// Routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const pitcherRoutes = require('./routes/pitchers');

// Database
mongoose.connect('mongodb://localhost:27017/pitchShuffle');
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Database connected');
});

// App settings
app.engine('ejs', ejsMate);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Session
const sessionConfig = {
    secret: 'yoursecret',
    resave: false,
    saveUninitialized: true,
};
app.use(session(sessionConfig));
app.use(flash());

// Passport
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/teams', teamRoutes);
app.use('/teams/:teamId/pitchers', pitcherRoutes);

app.listen(3000, () => {
    console.log('App is listening on port 3000');
});
