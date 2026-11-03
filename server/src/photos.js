// Room photos. Landlords upload them one at a time (already shrunk in the
// browser), and anyone can view them by id, so they work in <img src="...">.
import { db } from './db/index.js';

export const MAX_PHOTOS = 6;
const MAX_PHOTO_LENGTH = 1_500_000; // about 1.1 MB image as a data URL
const PHOTO_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export function addPhotoRoutes(app, { auth, requireRole }) {
  async function ownListing(req, res) {
    const listing = await db.listings.get(req.params.id);
    if (!listing || listing.ownerId !== req.user.id) {
      res.status(404).json({ error: 'Listing not found' });
      return null;
    }
    return listing;
  }

  app.post('/api/listings/:id/photos', auth, requireRole('landlord'), async (req, res) => {
    const listing = await ownListing(req, res);
    if (!listing) return;
    const photoIds = listing.photoIds || [];
    if (photoIds.length >= MAX_PHOTOS) return res.status(400).json({ error: `A room can have up to ${MAX_PHOTOS} photos.` });

    const data = String(req.body?.photo || '');
    if (!PHOTO_PATTERN.test(data)) return res.status(400).json({ error: 'Please choose a photo (JPG, PNG or WebP).' });
    if (data.length > MAX_PHOTO_LENGTH) return res.status(400).json({ error: 'This photo is too large. Please use a smaller one.' });

    const photo = await db.photos.create({ listingId: listing.id, data });
    const updated = await db.listings.update(listing.id, { photoIds: [...photoIds, photo.id] });
    res.status(201).json({ photoIds: updated.photoIds });
  });

  app.delete('/api/listings/:id/photos/:photoId', auth, requireRole('landlord'), async (req, res) => {
    const listing = await ownListing(req, res);
    if (!listing) return;
    const photoIds = (listing.photoIds || []).filter((id) => id !== req.params.photoId);
    await db.photos.delete(req.params.photoId);
    const updated = await db.listings.update(listing.id, { photoIds });
    res.json({ photoIds: updated.photoIds });
  });

  // The image itself. A photo never changes, so browsers may keep it for a long time.
  app.get('/api/photos/:photoId', async (req, res) => {
    const photo = await db.photos.get(req.params.photoId);
    const m = photo && PHOTO_PATTERN.exec(photo.data);
    if (!m) return res.status(404).json({ error: 'Photo not found' });
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  });
}
