// Loads settings from server/.env into process.env.
// Imported first in index.js so every other file sees the settings.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
