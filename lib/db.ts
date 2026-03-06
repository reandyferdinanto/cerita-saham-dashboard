import mongoose from "mongoose";

// Augment global to cache the connection
declare global {
  // eslint-disable-next-line no-var
  var _mongoConn: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

let cached = global._mongoConn;
if (!cached) {
  cached = global._mongoConn = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  // Resolve URI lazily so module-level throw doesn't break static generation
  const MONGODB_URI =
    (process.env.MONGODB_URI_DIRECT || process.env.MONGODB_URI) as string;

  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 — fixes Windows Node.js SRV DNS resolution
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
