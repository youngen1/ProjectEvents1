require('dotenv').config(); // This must be at the very top

// Model imports - keep these early
require('./models/User');
require('./models/Event');
require('./models/PlatformEarning');

const express = require("express");
const mongoose = require("mongoose");
// const bodyParser = require("body-parser"); // Can be removed if only using express.json/urlencoded
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
  const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const hasAllConfig = process.env.FIREBASE_PROJECT_ID && 
                       process.env.FIREBASE_CLIENT_EMAIL && 
                       firebasePrivateKey;

  if (!hasAllConfig) {
    console.warn("WARNING: Missing Firebase Admin SDK configuration environment variables.");
    console.warn("Firebase Admin SDK will NOT be initialized. Some features may be unavailable.");
  } else {
    try {
      const firebaseConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Ensure privateKey is correctly formatted (replace escaped newlines)
        privateKey: firebasePrivateKey.replace(/\\n/g, '\n'),
      };

      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "event-management-1a68f.appspot.com" // Provide a default only if it makes sense for dev
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error.message);
      console.warn("Firebase Admin SDK NOT initialized. Some features may be unavailable.");
    }
  }
}

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'https://www.eventcircle.site',
  'https://eventcircle.site', // Good to have both www and non-www
  // Add your Vercel preview deployment URLs if needed, e.g., /.*\.vercel\.app$/ using a regex
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173'); // Vite dev server
  allowedOrigins.push('http://localhost:3000'); // Common React dev server
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests) during development or if origin is in allowedOrigins
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && !origin) ) {
      callback(null, true);
    } else {
      console.error('CORS Error: Request from origin', origin, 'is not allowed.');
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Ensure OPTIONS is here
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-device-type', // Keep custom headers
    'Accept',
    'Origin',
    'Cache-Control',
    // 'X-CSRF-Token', // Only if you are using CSRF tokens this way
    // 'X-Api-Version'  // Only if you are using API versioning this way
  ],
  exposedHeaders: [ // Headers the client will be able to access
    'Content-Length',
    'Content-Type',
    // 'X-Rate-Limit' // If you implement rate limiting and want client to see it
  ],
  credentials: true, // Important if you're sending cookies or Authorization headers
  maxAge: 86400, // 24 hours - cache preflight requests
  optionsSuccessStatus: 200 // For compatibility
};

// Apply CORS middleware globally, handle preflight requests
// This should be one of the first middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle OPTIONS for all routes

// --- Security Headers with Helmet ---
// CSP should be configured carefully. `unsafe-inline` and `unsafe-eval` for scripts can be risky.
// Try to minimize their use if possible.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"], // Example for Google Maps
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com", `https://${process.env.FIREBASE_STORAGE_BUCKET}`, "https://maps.gstatic.com", "https://maps.googleapis.com"], // Allow Firebase Storage & Google Maps
      connectSrc: ["'self'", ...allowedOrigins, "https://maps.googleapis.com"], // Allow connections to your API origins and Google Maps
      frameSrc: ["'self'"], // Consider what iframes you need, e.g., Google Maps might require its own domain
      // ... other directives
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' }, // Good default
  xssFilter: true, // Modern browsers have this built-in, but doesn't hurt
}));


// --- Body Parsing Middleware ---
// For 'application/json'
app.use(express.json({
  limit: '10mb', // Adjust if you expect large JSON payloads
  verify: (req, res, buf) => { // Keep if you need rawBody for webhook verification etc.
    req.rawBody = buf;
  }
}));
// For 'application/x-www-form-urlencoded'
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NOTE: 'multipart/form-data' (for file uploads) is NOT handled here.
// It needs to be handled by `multer` on the specific routes. (e.g., in eventRoutes.js)


// --- Database Connection ---
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    // console.log("Using cached DB connection");
    return cachedDb;
  }
  const dbUrl = process.env.MONGODB_URI;
  if (!dbUrl) {
    console.error("FATAL ERROR: MongoDB connection string (MONGODB_URI) is not defined.");
    throw new Error("MongoDB connection string is not defined.");
  }
  try {
    // console.log("Connecting to MongoDB...");
    mongoose.set('strictQuery', true); // Recommended for Mongoose 7+
    const client = await mongoose.connect(dbUrl, {
      // useNewUrlParser: true, // No longer needed in modern Mongoose
      // useUnifiedTopology: true, // No longer needed
      serverSelectionTimeoutMS: 5000, // Keep
      socketTimeoutMS: 45000,         // Keep or adjust
      maxPoolSize: 10,                // Keep
      // minPoolSize: 5,              // Optional
      // maxIdleTimeMS: 10000,        // Optional
      // bufferCommands: false,       // Good for production, ensures connection before operations
    });
    cachedDb = client;
    console.log("MongoDB connected successfully.");
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Propagate the error to be caught by Vercel or your error handler
    throw error;
  }
}

// Database connection middleware (runs for every request)
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database connection middleware error:", error.message);
    // Pass error to the global error handler
    next(error); // This will go to your global error handler
  }
});


// --- Route Imports ---
const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const sendEmailRoute = require('./routes/sendEmail'); // Renamed for clarity

// --- API Routes ---
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes); // This is where multer should be used for /create
app.use("/api/reviews", reviewRoutes);
app.use("/api/tickets", ticketRoutes);
app.use('/api/send', sendEmailRoute);

// --- Static Files (if any served directly by this app) ---
// Generally, for Vercel, static assets are better handled by Vercel's CDN.
// This might be for user uploads if you store them locally (not recommended for serverless).
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Health Check / Root Route ---
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    message: 'EventCircle API is healthy and running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    NODE_ENV: process.env.NODE_ENV
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
    console.error("Error Stack:", err.stack);
  }
  if (req.body && Object.keys(req.body).length > 0) {
    // Be careful logging sensitive data from req.body in production
    // console.error("Request Body:", JSON.stringify(req.body, null, 2));
  }
  console.error("--- END GLOBAL ERROR HANDLER ---\n");

  // For CORS errors specifically, they might already have a status code
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Policy Violation',
      message: 'Access to this resource is denied from your origin.'
    });
  }

  // Send a generic error response
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the server.',
    // Provide stack trace in development for easier debugging
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// --- Local Development Server Start ---
// This block will not run on Vercel, Vercel handles the server instantiation
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on http://localhost:${PORT}`);
    console.log(`CORS allows requests from: ${allowedOrigins.join(', ')}`);
    console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
  });
}

// --- Export the app for Vercel ---
module.exports = app;
