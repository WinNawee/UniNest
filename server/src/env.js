// Loads settings from server/.env into process.env.
// Imported first in index.js so every other file sees the settings.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Where links in emails open (the web app). Render sets RENDER_EXTERNAL_URL by itself.
export const APP_URL = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/$/, '');
