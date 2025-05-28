//pg admin
const { Pool } = require("pg");

const pool = new Pool({
    user: 'acc_servis',
    host: 'localhost',
    database: 'ProjektZgrada',
    password: 'Qw234!*2?',
    port: 5433,
    idleTimeoutMillis: 300
});

module.exports = pool;