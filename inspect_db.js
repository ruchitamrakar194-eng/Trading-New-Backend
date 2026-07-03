const db = require('./src/config/db');

async function check() {
    try {
        const [tables] = await db.query('SHOW TABLES');
        console.log(tables);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
