const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(toEmail, username) {
    if (!toEmail) return;
    await resend.emails.send({
        from: 'PitchShuffle <noreply@pitchshuffle.com>',
        to: toEmail,
        subject: 'Welcome to PitchShuffle!',
        html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <img src="https://www.pitchshuffle.com/images/pitchshuffle-logo.svg"
                     alt="PitchShuffle" style="height:40px;margin-bottom:24px;">
                <h2 style="color:#1a2e4a;">Welcome, ${username}!</h2>
                <p>Thanks for creating a PitchShuffle account. Your 7-day free trial is now active — no credit card required.</p>
                <p>PitchShuffle wirelessly delivers pitch calls from your phone to your catcher's Bluetooth earpiece, keeping your signs completely hidden from the opposing team.</p>
                <h3 style="color:#1a2e4a;">Getting started</h3>
                <ol>
                    <li>Create a team and add your pitchers</li>
                    <li>Pair a Bluetooth earpiece to your device</li>
                    <li>Open a game and start calling pitches</li>
                </ol>
                <p>After your trial, you can subscribe at any time to keep full access:</p>
                <a href="https://www.pitchshuffle.com/subscription"
                   style="display:inline-block;background:#1a2e4a;color:#fff;padding:12px 24px;
                          border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0;">
                    View Plans &amp; Subscribe
                </a>
                <p style="color:#6c757d;font-size:0.85rem;margin-top:24px;">
                    Questions? Reply to this email or visit
                    <a href="https://www.pitchshuffle.com">pitchshuffle.com</a>.
                </p>
            </div>
        `
    });
}

module.exports = { sendWelcomeEmail };