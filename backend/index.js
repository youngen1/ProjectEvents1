require('dotenv').config(); // This must be at the very top
require('./models/User');
require('./models/Event');
require('./models/PlatformEarning');

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");




if (!admin.apps.length) {
  // Use environment variables for sensitive information
  // For local development, these should be in .env file
  // For production, these should be set in the hosting environment
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || "event-management-1a68f",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-7tfgz@event-management-1a68f.iam.gserviceaccount.com",
    // In production, use the environment variable
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
      process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpwQRN/wNniBGc\nFwGWhzRghPQMqTM17HtsRTErUbl9aBgWlMq3NbAOlbPsmkKjM7bASHbLXRYF1clq\nVVfu+vBP5AEfj3T/JVtSI0yjC5WNXBAT7gcLJziTU8a1Jfox+714/hgq8HeBj8N/\nzqPDRF8Op9m1LSLpxjjHe417pNEHkf0y1/vJU4koJ1jEytft7Mp6VBmOufJZ6gDW\n9SOnpTtc9LFODEpx1b9Te5qenVBCFEfYTlivvkWwRjGA5vUvd1g0+AdzRSYd2CQt\nEbdy0ffN/lkfdOVPTRFnEZ4fihlqWR753kQ5wtqP9ERl2Gy2qu+y9XnFVFXKI2YW\ntztkIAwdAgMBAAECggEABNWo9Dm3lJrE+Z+UHX/jR35x3uxwt2/xQe+ki1nMARzW\nVspNDbO7PGcaFTp9fF1sLoTB0V/o0Si6EEu28ej2sCfLumThDaU4ORolRB1/2GNP\nV+n3DGPFEjkYFy+qNQM47bm64XowxSFdjYXKlzKaynWQVz8eV+8bzd6gdG2IwIDl\nhiwmufeo4XPTE9osX081vctWRubvCMsar8iQL1jglrQotyII9Sf2CrdH+L2JPPOO\nsNtEH3CSFXHzMStvISZ2vs7ZNkTEcY9Jz0rmR4TUwq5EtnlOkgobCpJ/uiBr0FP4\nj6NjPr9Y2N/+tq37pcfOBbflBDwi8b00u1ND/yYv8QKBgQDXhXdRTVMeWg/ztsnH\nCLxr5W+zlNLynnqmlMlEJCrYs7TW+aYYs30S0RuwTzsF2qlXh4BoF+tCa3X1K8y/\nldMk4rKad2G1N/Ezwm6fjl8Gkc4AW4p4NvPYlHPwF+Melwz3Ff2PuMyBmYkl/xfn\nMS806gGiE6yK/FMosDmSIz6S2QKBgQDJov+S8i0mjhSUNjmLCMT4VPeXHQ3BBWlA\nfR0iHVuIx3VJLfYgTHNBOs3RwaISGoBz2/RHCocpq4m4GTeFAFuXVrdC/5gurQT+\ndr8htc0VX7VDv1F9/HtczTFa0/439l7Ba5mJn88+zdeYprU633aukzL4Y0AUD9VA\nAIQzT84w5QKBgQCTR9/8LW1pxn40PGuzmmK5ETe+byuhJXAHupG4AUdOg7BHYJ+D\nLdWBMGlNmTdqjr0+1ZiIih/5adpYSzBGlKqQAGOxb3fUEYDBsFNMskx5/tXaJLSB\n5nvJO9nm70wEMZFooRyARPdscXHqB2NcWJ47+NZY3j0BVeG2YodVOMSgMQKBgFwQ\nS0bpwkm/R5AgbgeYOm70RJO/lT8TXGowdfPUma2K/HcsQBuhLGKVGdJy6bAAX7QG\nsrMZEHurMddX1Cyq7CbeVhCGKRLutsAEseIPYxMmPtou6WNvu1e07Jr+/izJFZyU\np2baC8MuMwkk3MyDqWmuFfCpSGGglQqC8dmHz6otAoGAPLegqqHHyjAzr24Ih5rs\nAOldF6GdUhihyKZhQFpN5m4fqIafov56a4tLD6d2/woJdQodOmUD4Zjv0pDEopjB\nHqPYRFBG8VTnokTKykJ3/Xork1fdaL8FLIPxGxLnxHzVbCgjSsewybNcVqIiyorW\njObTxo6XIyYef4tCL8MJhgY=\n-----END PRIVATE KEY-----\n"
  };

  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "event-management-1a68f.appspot.com"
  });
}

const app = express();

const allowedOrigins = [
  'https://www.eventcircle.site',
  'https://eventcircle.site',
  'http://localhost:5173' // For development
];

// Apply Helmet middleware for security headers
// Configure CSP to work with the application's requirements
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com"],
      connectSrc: ["'self'", ...allowedOrigins]
    }
  },
  // Set strict transport security with long max age
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  // Prevent browsers from incorrectly detecting non-scripts as scripts
  noSniff: true,
  // Don't put the application in an iframe
  frameguard: {
    action: 'deny'
  },
  // XSS Protection
  xssFilter: true
}));

const corsOptions = {
  origin: function (origin, callback) {
    // In production, strictly validate origin
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow requests with no origin (like Postman or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'x-device-type',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-CSRF-Token',
    'X-Api-Version'
  ],
  exposedHeaders: [
    'Content-Length', 
    'Content-Type', 
    'X-Rate-Limit'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours in seconds - how long the results of a preflight request can be cached
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; 
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const sendEmail = require('./routes/sendEmail');

// Database connection with caching
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  const dbUrl = process.env.MONGODB_URI;
  if (!dbUrl) {
    console.error("FATAL ERROR: MongoDB connection string is not defined.");
    throw new Error("MongoDB connection string is not defined.");
  }

  try {
    const client = await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 10000,
      bufferCommands: false,
    });

    cachedDb = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Database middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/tickets", ticketRoutes);
app.use('/api/send', sendEmail);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get('/', (req, res) => {
  res.status(200).send('Server is healthy');
});

// Error handling
app.use((err, req, res, next) => {
  console.log("\n=== ERROR HANDLER TRIGGERED ===");
  console.log("\n=== Error Details ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request URL:", req.originalUrl);
  console.log("Request Method:", req.method);
  console.log("Error Message:", err.message);
  console.log("Error Stack:", err.stack);
  console.log("Request Body:", JSON.stringify(req.body, null, 2));
  console.log("==================\n");

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Local development server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS configured for: ${allowedOrigins.join(', ')}`);
  });
}

// Export for Vercel
module.exports = app;
