const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const customStatePath = path.join(__dirname, '../mymosquitto/state.json');

try {
    if (fs.existsSync(customStatePath)) {
        console.log(`Reading state from ${customStatePath}...`);
        const content = fs.readFileSync(customStatePath, 'utf-8');
        const state = JSON.parse(content);

        console.log('Current dashboard users:', state.dashboard_users);

        // Clear dashboard users
        state.dashboard_users = [];

        console.log('Clearing dashboard_users to force regeneration on next startup...');

        fs.writeFileSync(customStatePath, JSON.stringify(state, null, 2));
        console.log('✅ state.json updated. Please RESTART the container now.');
        console.log('   The "admin" user will be recreated with default credentials (admin/admin).');
    } else {
        console.error('❌ state.json not found at expected path!');
    }
} catch (e) {
    console.error('Failed to reset:', e);
}
