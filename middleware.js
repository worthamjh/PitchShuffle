const Team    = require('./models/team');
const Pitcher = require('./models/pitcher');

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be logged in to do that.');
        return res.redirect('/login');
    }
    next();
};

// Verify the logged-in user owns the team in :teamId / :id
module.exports.isOwner = async (req, res, next) => {
    try {
        const teamId = req.params.teamId || req.params.id;
        const team   = await Team.findById(teamId);
        if (!team) {
            req.flash('error', 'Team not found.');
            return res.redirect('/teams');
        }
        if (!team.owner.equals(req.user._id)) {
            req.flash('error', 'You do not have permission to do that.');
            return res.redirect('/teams');
        }
        res.locals.team = team;
        next();
    } catch (e) {
        next(e);
    }
};

// Verify the pitcher belongs to the team (prevents cross-team pitcher access)
module.exports.isPitcherInTeam = async (req, res, next) => {
    try {
        const { teamId, pitcherId } = req.params;
        const team = await Team.findById(teamId);
        if (!team) {
            req.flash('error', 'Team not found.');
            return res.redirect('/teams');
        }
        if (!team.pitchers.map(String).includes(pitcherId)) {
            req.flash('error', 'Pitcher not found on this team.');
            return res.redirect(`/teams/${teamId}`);
        }
        next();
    } catch (e) {
        next(e);
    }
};

// Gate routes behind an active subscription or valid trial
module.exports.isSubscribed = (req, res, next) => {
    if (req.user && req.user.isActive()) return next();
    req.flash('error', 'A PitchShuffle subscription is required to access that.');
    res.redirect('/subscription');
};

// True when the request is coming from the native iOS app shell
// (Capacitor is configured with ios.appendUserAgent = "PitchShuffleNativeApp").
module.exports.isNativeApp = (req) => {
    const ua = req.headers['user-agent'] || '';
    return ua.includes('PitchShuffleNativeApp');
};

// Apple Guideline 3.1.1 / 3.1.3(a): the native app must not allow creating
// new accounts that can access paid content. Block registration and OAuth
// sign-up entry points server-side when the request comes from the app —
// hiding the UI with client-side JS alone is not sufficient, since the
// routes themselves remain reachable. Existing users may still log in.
module.exports.blockNativeSignup = (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    if (ua.includes('PitchShuffleNativeApp')) {
        req.flash('error', 'New accounts are created at pitchshuffle.com. Please log in below if you already have an account.');
        return res.redirect('/login');
    }
    next();
};
