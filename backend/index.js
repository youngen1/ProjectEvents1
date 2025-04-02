// require('dotenv').config(); // Keep this for local development
// require('./models/User');
// require('./models/Event');
// require('./models/PlatformEarning');
// const functions = require("firebase-functions");
// const express = require("express");
// const mongoose = require("mongoose");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const path = require("path");
// const admin = require("firebase-admin");

// admin.initializeApp();
// const app = express();
// app.use(cors());
// app.use(express.json({
//       verify: (req, res, buf) => {
//           req.rawBody = buf; // Store the raw request body
//       }
//   }));
// // Import routes


// // CORS configuration
// // const allowedOrigins = [
// //   "https://www.eventcircle.site",
// //   "http://localhost:5173",
// //   "https://event-management-1a68f.web.app",
// //   "https://event-management-1a68f.firebaseapp.com",
// // ];

// // app.use(
// //   cors({
// //     origin: function (origin, callback) {
// //       if (!origin || allowedOrigins.includes(origin)) {
// //         callback(null, true);
// //       } else {
// //         callback(new Error("Not allowed by CORS"));
// //       }
// //     },
// //     credentials: true,
// //     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
// //     allowedHeaders: [
// //       "X-CSRF-Token",
// //       "X-Requested-With",
// //       "Accept",
// //       "Accept-Version",
// //       "Content-Length",
// //       "Content-MD5",
// //       "Content-Type",
// //       "Date",
// //       "X-Api-Version",
// //       "Authorization",
// //       "x-device-type",
// //       "Cache-Control",
// //       "Pragma",
// //     ],
// //   })
// // );

// const corsOptions = {
//   origin: 'http://localhost:5173',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   credentials: true,
//   optionsSuccessStatus: 200 // Some legacy browsers choke on 204
// };

// app.use(cors(corsOptions));

// // Handle preflight requests
// app.options('*', cors(corsOptions));
// // app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Handle preflight requests
// app.options('*', cors());

// const userRoutes = require("./routes/userRoutes");
// const eventRoutes = require("./routes/eventRoutes");
// const reviewRoutes = require("./routes/reviewRoutes");
// const ticketRoutes = require("./routes/ticketRoutes");
// const sendEmail = require('./routes/sendEmail');


// // --- MongoDB Connection (using functions.config()) ---
// let cachedDb = null;

// async function connectToDatabase() {
//   if (cachedDb && mongoose.connection.readyState === 1) {
//     return cachedDb;
//   }

//   // *** ACCESS SECRETS USING functions.config() ***
//   const dbUrl = process.env.MONGODB_URI; // Use optional chaining

//   if (!dbUrl) {
//     console.error("FATAL ERROR: MongoDB connection string is not defined in functions.config().");
//     throw new Error("MongoDB connection string is not defined.");
//   }

//   try {
//     const client = await mongoose.connect(dbUrl, {
//       serverSelectionTimeoutMS: 5000,
//       socketTimeoutMS: 30000,
//       maxPoolSize: 10,
//       minPoolSize: 5,
//       maxIdleTimeMS: 10000,
//       bufferCommands: false,
//     });
    
//     cachedDb = client;
//     return client;
//   } catch (error) {
//     console.error('MongoDB connection error:', error);
//     throw error;
//   }
// }

// // Connect to database before handling requests
// app.use(async (req, res, next) => {
//   try {
//     await connectToDatabase();
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // --- Route Registration ---
// app.use("/api/users", userRoutes);
// app.use("/api/events", eventRoutes);
// app.use("/api/reviews", reviewRoutes);
// app.use("/api/tickets", ticketRoutes);
// app.use('/api/send', sendEmail);

// // Serve static files
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Health check endpoint
// app.get('/', (req, res) => {
//   res.status(200).send('Server is healthy');
// });

// // --- Error Handling Middleware ---
// app.use((err, req, res, next) => {
//   console.log("\n=== ERROR HANDLER TRIGGERED! ===");
//   console.log("\n=== Error Details ===");
//   console.log("Timestamp:", new Date().toISOString());
//   console.log("Request URL:", req.originalUrl);
//   console.log("Request Method:", req.method);
//   console.log("Error Message:", err.message);
//   console.log("Error Stack:", err.stack);
//   console.log("Request Body:", JSON.stringify(req.body, null, 2));
//   console.log("==================\n");

//   res.status(500).json({
//     error: 'Internal Server Error',
//     message: err.message || 'Something went wrong',
//     details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// exports.api = functions.https.onRequest(app);

require('dotenv').config(); // This must be at the very top
require('./models/User');
require('./models/Event');
require('./models/PlatformEarning');

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();

// CORS configuration - update origins for production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL, 'https://project-events1-86ns.vercel.app' , 'https://www.eventcircle.site' , 'https://eventcircle.site']
  : ['http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-device-type'],
  credentials: true,
  optionsSuccessStatus: 200
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
