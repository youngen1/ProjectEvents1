require('dotenv').config(); // This must be at the very top

// Model imports - keep these early
require('./models/User');
require('./models/Event');
require('./models/PlatformEarning');

const express = require("express");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
  console.log("Attempting to initialize Firebase Admin SDK..."); // Log: Start
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucketEnv = process.env.FIREBASE_STORAGE_BUCKET; // Explicitly get this

  // Log status of each environment variable
  console.log(`FIREBASE_PROJECT_ID: ${projectId ? `SET (Value: ${projectId})` : 'NOT SET'}`);
  console.log(`FIREBASE_CLIENT_EMAIL: ${clientEmail ? `SET (Value: ${clientEmail})` : 'NOT SET'}`);
  console.log(`FIREBASE_PRIVATE_KEY: ${privateKeyEnv ? `SET (Length: ${privateKeyEnv.length})` : 'NOT SET'}`);
  console.log(`FIREBASE_STORAGE_BUCKET (from env): ${storageBucketEnv ? `SET (Value: ${storageBucketEnv})` : 'NOT SET or using default'}`);

  const effectiveStorageBucket = storageBucketEnv || "event-management-1a68f.appspot.com"; // Determine effective bucket
  console.log(`Effective FIREBASE_STORAGE_BUCKET to be used: ${effectiveStorageBucket}`);


  if (!projectId || !clientEmail || !privateKeyEnv || !effectiveStorageBucket) { // Check effectiveStorageBucket
    console.error("FATAL ERROR: One or more critical Firebase Admin SDK or Storage Bucket environment variables are effectively missing.");
    console.error("Firebase Admin SDK will NOT be initialized.");
    global.firebaseAdminInitialized = false;
  } else {
    try {
      const firebaseConfig = {
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKeyEnv.replace(/\\n/g, '\n'),
      };
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        storageBucket: effectiveStorageBucket // Use the determined effective bucket
      });
      console.log("SUCCESS: Firebase Admin SDK initialized successfully.");
      if (admin.app().name) { // Check if app exists before accessing properties
        console.log("Default app name:", admin.app().name);
      } else {
        console.warn("Firebase app object not found after initialization attempt.");
      }
      // Check storage bucket directly after initialization
      try {
        const bucket = admin.storage().bucket();
        console.log("Storage bucket configured and accessible via admin.storage().bucket():", bucket.name);
      } catch (storageError) {
        console.error("ERROR accessing storage bucket post-initialization:", storageError.message);
        console.error("This likely means the storageBucket property in initializeApp was problematic or permissions are incorrect.");
      }
      global.firebaseAdminInitialized = true;
    } catch (initError) {
      console.error("FATAL ERROR: Firebase Admin SDK initializeApp FAILED.");
      console.error("Error Message:", initError.message);
      console.error("Error Stack:", initError.stack);
      global.firebaseAdminInitialized = false;
    }
  }
} else {
  console.log("Firebase Admin SDK already initialized (admin.apps.length > 0).");
  // Assuming if already initialized, it was successful before.
  // Re-check storage just in case, if possible (though admin.storage() might not be available if init failed earlier in a previous invocation but app object persisted)
  if (admin.apps.length > 0 && typeof admin.storage === 'function') {
    try {
      const bucket = admin.storage().bucket();
      console.log("Re-confirming: Storage bucket accessible:", bucket.name);
      global.firebaseAdminInitialized = true;
    } catch (e) {
      console.warn("Re-confirming: Could not access storage bucket on already initialized app.", e.message);
      global.firebaseAdminInitialized = false; // Mark as false if storage check fails
    }
  } else {
    global.firebaseAdminInitialized = false; // If admin.storage is not a function, something is wrong.
  }
}

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'https://www.eventcircle.site',
  'https://eventcircle.site',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://localhost:3000');
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && !origin) ) {
      callback(null, true);
    } else {
      console.error('CORS Error: Request from origin', origin, 'is not allowed.');
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-device-type', 'Accept', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- Security Headers with Helmet ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com", `https://${process.env.FIREBASE_STORAGE_BUCKET || 'event-management-1a68f.appspot.com'}`, "https://maps.gstatic.com", "https://maps.googleapis.com"],
      connectSrc: ["'self'", ...allowedOrigins, "https://maps.googleapis.com"],
      frameSrc: ["'self'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
}));

// --- Body Parsing Middleware ---
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Database Connection ---
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  const dbUrl = process.env.MONGODB_URI;
  if (!dbUrl) {
    console.error("FATAL ERROR: MongoDB connection string (MONGODB_URI) is not defined.");
    throw new Error("MongoDB connection string is not defined.");
  }
  try {
    mongoose.set('strictQuery', true);
    const client = await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    cachedDb = client;
    console.log("MongoDB connected successfully.");
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database connection middleware error:", error.message);
    next(error);
  }
});

// --- Route Imports ---
const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const sendEmailRoute = require('./routes/sendEmail');

// --- API Routes ---
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/tickets", ticketRoutes);
app.use('/api/send', sendEmailRoute);

// --- Static Files ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Health Check / Root Route ---
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    message: 'EventCircle API is healthy!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    NODE_ENV: process.env.NODE_ENV,
    firebaseAdminInitialized: global.firebaseAdminInitialized === true // Expose status
  });
});

// --- Global Error Handling Middleware (must be last) ---
app.use((err, req, res, next) => {
  console.error("\n--- GLOBAL ERROR HANDLER ---");
  console.error("Timestamp:", new Date().toISOString());
  console.error("Request URL:", req.originalUrl);
  console.error("Request Method:", req.method);
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  if (err.stack && process.env.NODE_ENV === 'development') {
    // console.error("Error Stack:", err.stack); // Can be very verbose
  }
  console.error("--- END GLOBAL ERROR HANDLER ---\n");

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS Policy Violation', message: 'Access denied.' });
  }

  // Check for Multer errors specifically
  if (err instanceof require('multer').MulterError) {
    return res.status(400).json({ error: 'FileUploadError', message: err.message, field: err.field });
  }


  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// --- Local Development Server Start ---
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on http://localhost:${PORT}`);
    console.log(`CORS allows: ${allowedOrigins.join(', ')}`);
    console.log(`Firebase Initialized Status (global flag): ${global.firebaseAdminInitialized}`);
  });
}

// --- Export the app for Vercel ---
module.exports = app;