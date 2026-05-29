// Run once: node migrate-pitcher-names.js
// Splits existing pitcher `name` field into `firstName` and `lastName`

require('dotenv').config();
const mongoose = require('mongoose');
const Pitcher  = require('./models/pitcher');

mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;

db.once('open', async () => {
    console.log('Connected. Starting migration...');
    const pitchers = await Pitcher.find({ firstName: { $exists: false } });
    console.log(`Found ${pitchers.length} pitchers to migrate.`);

    let updated = 0;
    for (const p of pitchers) {
        const parts = (p.name || '').trim().split(/\s+/);
        if (parts.length === 1) {
            // Single word — treat as last name
            p.firstName = '';
            p.lastName  = parts[0];
        } else {
            // Everything before the last word is first name
            p.lastName  = parts[parts.length - 1];
            p.firstName = parts.slice(0, -1).join(' ');
        }
        await p.save();
        console.log(`  ✓ "${p.name}" → "${p.firstName}" "${p.lastName}"`);
        updated++;
    }

    console.log(`\nMigration complete. ${updated} pitchers updated.`);
    mongoose.connection.close();
});
