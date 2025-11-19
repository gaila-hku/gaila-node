import dotenv from 'dotenv';
import mysql, { Pool } from 'mysql2/promise';

dotenv.config();

mysql
  .createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })
  .catch(err => {
    if (err) {
      console.error('Error connecting: ' + JSON.stringify(err));
      return;
    }
  });

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  typeCast: function (field, next) {
    if (field.type == 'NEWDECIMAL') {
      const value = field.string();
      return value === null ? null : Number(value);
    }
    return next();
  },
});

export default pool;
