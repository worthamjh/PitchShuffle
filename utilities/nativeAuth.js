// Short-lived, signed token used to hand a login off from the Google/Apple
// OAuth sheet (a separate browsing context — SFSafariViewController) back
// into the app's own WebView. Cookie sharing between those two contexts
// isn't reliable, so instead of relying on the session cookie carrying
// over, the OAuth callback issues one of these single-use tokens and the
// app's WebView exchanges it for a real login session in its own request
// (see GET /auth/native-exchange in routes/auth.js) — no cross-context
// cookie behavior required at all.
const crypto = require('crypto');

const SECRET   = process.env.SESSION_SECRET || 'yoursecret';
const TTL_MS   = 2 * 60 * 1000; // 2 minutes — this only needs to survive the
                                 // brief moment between the OAuth sheet
                                 // closing and the app's next request.

function sign(payload) {
    return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

module.exports.createNativeAuthToken = (userId) => {
    const expires = Date.now() + TTL_MS;
    const payload = `${userId}.${expires}`;
    const sig = sign(payload);
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
};

module.exports.verifyNativeAuthToken = (token) => {
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf8');
        const parts = decoded.split('.');
        if (parts.length !== 3) return null;
        const [userId, expiresStr, sig] = parts;
        const expected = sign(`${userId}.${expiresStr}`);
        // Constant-time comparison to avoid timing side channels.
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
        if (Date.now() > Number(expiresStr)) return null;
        return userId;
    } catch (e) {
        return null;
    }
};
