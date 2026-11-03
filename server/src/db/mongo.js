// MongoDB store using Mongoose. Used when MONGODB_URI is set (for example
// a free MongoDB Atlas cluster). Same functions as memory.js.
import mongoose from 'mongoose';

const { Schema } = mongoose;

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  role: { type: String, enum: ['student', 'landlord', 'admin'], required: true },
  passwordHash: { type: String, required: true },
  verified: { type: Boolean, default: false }, // email confirmed
  verifyTokenHash: { type: String, index: true },
  verifyTokenExpires: Date,
  verifyTokenSentAt: Date,
  resetTokenHash: { type: String, index: true }, // "forgot password" link
  resetTokenExpires: Date,
  resetTokenSentAt: Date,
  sessionVersion: { type: Number, default: 0 }, // raised on password reset, which logs out old logins
  premiumUntil: Date, // Semester Match Pass end date
  referralCode: { type: String, index: true },
  referredBy: { type: String, index: true },
  referralRewarded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}));

const Profile = mongoose.model('Profile', new Schema({
  userId: { type: String, required: true, unique: true },
  cleanliness: Number,
  sleep: Number,
  noise: Number,
  social: Number,
  study: Number,
  guests: Number,
  culturalOpenness: Number,
  budgetMin: Number,
  budgetMax: Number,
  smoking: String,
  food: String,
  gender: String,
  genderPref: String,
  languages: [String],
  campus: String,
}));

const Listing = mongoose.model('Listing', new Schema({
  ownerId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  type: String,
  price: Number,
  beds: Number,
  distanceKm: Number,
  amenities: [String],
  campus: String,
  verified: { type: Boolean, default: false },
  verifiedAt: Date, // used for Premium early access
  featuredUntil: Date, // paid Featured Listing end date
  photoIds: [String], // ids in the Photo collection, first one is the cover
  createdAt: { type: Date, default: Date.now },
}));

const Message = mongoose.model('Message', new Schema({
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  at: { type: Date, default: Date.now },
}));

// One Semester Match Pass purchase. The slip photo is stored as a small
// compressed image (data URL), so no separate file storage is needed.
const Payment = mongoose.model('Payment', new Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['premium', 'featured'], default: 'premium' },
  listingId: String, // for Featured Listing payments
  plan: String,
  amount: Number,
  slip: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectReason: String,
  reviewedBy: String,
  reviewedAt: Date,
  createdAt: { type: Date, default: Date.now },
}));

// One row per (viewer, viewed) pair, with the latest time they viewed.
const View = mongoose.model('View', new Schema({
  viewerId: { type: String, required: true },
  viewedId: { type: String, required: true, index: true },
  at: { type: Date, default: Date.now },
}).index({ viewerId: 1, viewedId: 1 }, { unique: true }));

// Room photo as a compressed JPEG data URL. Stored apart from the listing,
// so loading the room list does not download every photo.
const Photo = mongoose.model('Photo', new Schema({
  listingId: { type: String, required: true, index: true },
  data: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}));

const Review = mongoose.model('Review', new Schema({
  listingId: { type: String, required: true, index: true },
  authorId: String,
  rating: Number,
  text: String,
  at: { type: Date, default: Date.now },
}));

// Turn a Mongo document into the same plain shape memory.js returns:
// "id" instead of "_id", and dates as ISO strings.
function clean(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc.toObject ? doc.toObject() : doc;
  for (const key of Object.keys(rest)) {
    if (rest[key] instanceof Date) rest[key] = rest[key].toISOString();
  }
  return { id: String(_id), ...rest };
}

// Ids in URLs come from users, so check them before asking Mongo.
const validId = (id) => mongoose.isValidObjectId(id);
const after = { returnDocument: 'after' };

export const mongoStore = {
  name: 'mongo',

  // Atlas connection strings often have no database name, and then MongoDB
  // quietly uses one called "test". Use defaultDbName in that case instead.
  async connect(uri, { defaultDbName = 'uninest' } = {}) {
    const dbName = dbNameFromUri(uri) || defaultDbName;
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    await Promise.all([User, Profile, Listing, Message, Review, Payment, View, Photo].map((m) => m.init()));
  },

  async disconnect() {
    await mongoose.disconnect();
  },

  get dbName() {
    return mongoose.connection.name;
  },

  // Only used by the tests. Refuses to wipe a database whose name
  // does not contain "test", so real data is never deleted by accident.
  async reset() {
    const dbName = mongoose.connection.name;
    if (!dbName.includes('test')) throw new Error(`Refusing to reset database "${dbName}"`);
    await Promise.all([User, Profile, Listing, Message, Review, Payment, View, Photo].map((m) => m.deleteMany({})));
  },

  users: {
    async count() {
      return User.countDocuments();
    },
    async create(data) {
      return clean(await User.create(data));
    },
    async findById(id) {
      return validId(id) ? clean(await User.findById(id).lean()) : null;
    },
    async findByEmail(email) {
      return clean(await User.findOne({ email: String(email).toLowerCase() }).lean());
    },
    async findByIds(ids) {
      const rows = await User.find({ _id: { $in: ids.filter(validId) } }).lean();
      return rows.map(clean);
    },
    async findByVerifyTokenHash(hash) {
      return clean(await User.findOne({ verifyTokenHash: hash }).lean());
    },
    async all() {
      const rows = await User.find().lean();
      return rows.map(clean);
    },
    async find(filter = {}) {
      const rows = await User.find(filter).lean();
      return rows.map(clean);
    },
    async update(id, fields) {
      if (!validId(id)) return null;
      return clean(await User.findByIdAndUpdate(id, fields, after).lean());
    },
  },

  profiles: {
    async get(userId) {
      return stripProfile(await Profile.findOne({ userId }).lean());
    },
    async save(userId, profile) {
      const doc = await Profile.findOneAndUpdate(
        { userId },
        { ...profile, userId },
        { ...after, upsert: true }
      ).lean();
      return stripProfile(doc);
    },
    async all() {
      const rows = await Profile.find().lean();
      return rows.map(stripProfile);
    },
  },

  listings: {
    async create(data) {
      return clean(await Listing.create(data));
    },
    async get(id) {
      return validId(id) ? clean(await Listing.findById(id).lean()) : null;
    },
    async find(filter = {}) {
      const rows = await Listing.find(filter).lean();
      return rows.map(clean);
    },
    async update(id, fields) {
      if (!validId(id)) return null;
      return clean(await Listing.findByIdAndUpdate(id, fields, after).lean());
    },
  },

  messages: {
    async create({ from, to, text }) {
      return clean(await Message.create({ from, to, text }));
    },
    async forUser(userId) {
      const rows = await Message.find({ $or: [{ from: userId }, { to: userId }] }).sort({ at: 1 }).lean();
      return rows.map(clean);
    },
    async between(a, b) {
      const rows = await Message.find({
        $or: [{ from: a, to: b }, { from: b, to: a }],
      }).sort({ at: 1 }).lean();
      return rows.map(clean);
    },
    async markRead(from, to) {
      await Message.updateMany({ from, to, read: false }, { read: true });
    },
    async senders() {
      return Message.distinct('from');
    },
  },

  views: {
    async record(viewerId, viewedId) {
      await View.updateOne({ viewerId, viewedId }, { at: new Date() }, { upsert: true });
    },
    async forViewed(viewedId) {
      const rows = await View.find({ viewedId }).sort({ at: -1 }).lean();
      return rows.map(clean);
    },
  },

  payments: {
    async create(data) {
      return clean(await Payment.create(data));
    },
    async get(id) {
      return validId(id) ? clean(await Payment.findById(id).lean()) : null;
    },
    async find(filter = {}) {
      const rows = await Payment.find(filter).sort({ createdAt: -1 }).lean();
      return rows.map(clean);
    },
    async update(id, fields) {
      if (!validId(id)) return null;
      return clean(await Payment.findByIdAndUpdate(id, fields, after).lean());
    },
  },

  photos: {
    async create(data) {
      return clean(await Photo.create(data));
    },
    async get(id) {
      return validId(id) ? clean(await Photo.findById(id).lean()) : null;
    },
    async delete(id) {
      if (validId(id)) await Photo.findByIdAndDelete(id);
    },
  },

  reviews: {
    async create(data) {
      return clean(await Review.create(data));
    },
    async forListing(listingId) {
      const rows = await Review.find({ listingId }).sort({ at: 1 }).lean();
      return rows.map(clean);
    },
    async find(filter = {}) {
      const rows = await Review.find(filter).lean();
      return rows.map(clean);
    },
    async update(id, fields) {
      if (!validId(id)) return null;
      return clean(await Review.findByIdAndUpdate(id, fields, after).lean());
    },
  },
};

function dbNameFromUri(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

// Profiles are looked up by userId, so the Mongo _id is not needed.
function stripProfile(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}
