import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool(config.db);

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
