const mongoose = require('mongoose');
const Event = require('../models/Event'); // Adjust path if needed
const User = require('../models/User');   // Adjust path if needed
const PlatformEarning = require('../models/PlatformEarning'); // Adjust path if needed
const { DateTime } = require('luxon');
const crypto = require('crypto');
const admin = require('firebase-admin'); // Ensure firebase-admin is installed and initialized
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is installed (npm i uuid)
const Joi = require('joi');
const { initializePayment, verifyPayment } = require('../utils/paystack'); // Import the payment functions

// --- Environment Variables ---
// Make sure FRONTEND_URL is set in your .env file or environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Provide a default for safety

// --- Firebase Storage Bucket ---
// IMPORTANT: Ensure Firebase Admin SDK is initialized in your main server file (e.g., app.js or server.js)
// Example initialization (should be done ONCE at startup):
/*
  const admin = require('firebase-admin');
  const serviceAccount = require('./path/to/your/serviceAccountKey.json'); // !! SECURE THIS FILE !!

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "YOUR_STORAGE_BUCKET_URL" // e.g., "your-project-id.appspot.com"
  });
*/
// Get the storage bucket instance (assuming admin is initialized)
let bucket;
try {
    bucket = admin.storage().bucket();
} catch (initError) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! Firebase Admin SDK not initialized properly before !!!");
    console.error("!!! obtaining the storage bucket. Check server init. !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    // You might want to throw the error or exit if Firebase is critical
    // throw initError;
}


// --- Helper Function (Synchronous) ---
function calculateAge(dateOfBirth) {
    if (!dateOfBirth) { return null; } // Return null if no DOB
    try {
        const birth = DateTime.fromJSDate(new Date(dateOfBirth));
        if (!birth.isValid) return null; // Invalid date
        const now = DateTime.now();
        const diff = now.diff(birth, 'years');
        return Math.floor(diff.years);
    } catch (e) {
        console.error("Error calculating age:", e);
        return null;
    }
}

// --- Joi Validation Schemas ---

// Schema for the NEW UPLOAD ROUTE's req.body (validates non-file fields)
const createEventWithUploadBodySchema = Joi.object({
    event_title: Joi.string().required().min(3).max(255),
    category: Joi.string().required(),
    event_date_and_time: Joi.string().isoDate().required(), // Expect ISO string from frontend
    event_address: Joi.string().required(), // Expect stringified JSON
    additional_info: Joi.string().allow('').optional(), // Make optional if needed
    ticket_price: Joi.number().required().min(0),
    event_description: Joi.string().required(),
    event_duration: Joi.number().required().min(0.5),
    event_max_capacity: Joi.number().required().min(1).integer(),
    age_restriction: Joi.string().required(),    // Expect stringified JSON array
    gender_restriction: Joi.string().required(), // Expect stringified JSON array
    // created_by comes from req.user (auth middleware)
}).options({ stripUnknown: true }); // Ignore fields not defined (like files)


// Original schema (for reference, not used by the new upload route)
const originalCreateEventSchema = Joi.object({
    event_title: Joi.string().required().min(3).max(255),
    category: Joi.string().required(),
    event_date_and_time: Joi.date().required(),
    event_address: Joi.object({
        address: Joi.string().required(),
        longitude: Joi.number().required(),
        latitude: Joi.number().required(),
    }).required(),
    additional_info: Joi.string().allow(''),
    ticket_price: Joi.number().required().min(0),
    event_description: Joi.string().required(),
    event_duration: Joi.number().required(),
    event_max_capacity: Joi.number().required().min(1),
    event_video: Joi.string().allow(''), // Expected URL
    thumbnail: Joi.string().allow(''),   // Expected URL
    age_restriction: Joi.array().items(Joi.string()).required(),
    gender_restriction: Joi.array().items(Joi.string()).required(),
});

// Schema for updates (may need modification if updates involve file changes)
const updateEventSchema = Joi.object({
    event_title: Joi.string().min(3).max(255),
    category: Joi.string(),
    event_date_and_time: Joi.date(),
    event_address: Joi.object({ // Allow partial updates
        address: Joi.string(),
        longitude: Joi.number(),
        latitude: Joi.number(),
    }).min(1), // Require at least one field if object is provided
    additional_info: Joi.string().allow(''),
    ticket_price: Joi.number().min(0),
    event_description: Joi.string(),
    event_duration: Joi.number().min(0.5),
    event_max_capacity: Joi.number().min(1).integer(),
    // Note: Updating event_video/thumbnail via this route currently expects URLs.
    // Handling file updates would require a separate mechanism or modification here.
    event_video: Joi.string().allow(''),
    thumbnail: Joi.string().allow(''),
    age_restriction: Joi.array().items(Joi.string()),
    gender_restriction: Joi.array().items(Joi.string()),
}).min(1); // Require at least one field to be updated

// --- Helper to delete Firebase file (for potential error cleanup) ---
// NOTE: Requires careful implementation based on how URLs are stored/parsed
/*
async function deleteFileFromFirebase(fileUrl) {
    if (!fileUrl || !bucket) return;
    try {
        const url = new URL(fileUrl);
        // Assumes URL is like https://storage.googleapis.com/BUCKET_NAME/FILE_PATH
        const filePath = decodeURIComponent(url.pathname.substring(url.pathname.indexOf('/', 1) + 1)); // Extract path after bucket name
        if (filePath) {
            console.log(`Attempting to delete Firebase file: ${filePath}`);
            await bucket.file(filePath).delete();
            console.log(`Successfully deleted Firebase file: ${filePath}`);
        }
    } catch (error) {
        // Log error but don't crash the main process over cleanup failure
        console.error(`Failed to delete Firebase file ${fileUrl}:`, error.message);
    }
}
*/

// --- NEW Controller for Handling File Uploads and Event Creation ---
// NOTE: Assumes 'multer().fields(...)' middleware is used in the ROUTER before this runs
exports.createEventWithUpload = async (req, res) => {
    // --- 1. Check if Firebase SDK/Bucket is ready ---

    if (!bucket) {
        console.error("Firebase Storage Bucket is not initialized.");
        return res.status(500).json({ message: "Server configuration error: Storage service unavailable." });
    }

    // --- 2. Validate non-file fields from req.body ---

    console.log(" in createEventWithUpload, req.body: ", req.body);
    const { error: bodyError, value: validatedBody } = createEventWithUploadBodySchema.validate(req.body);
    if (bodyError) {
        const errorMessages = bodyError.details.map(detail => detail.message);
        console.log(" the errors in createEventWithUploadBodySchema: ", errorMessages);
        return res.status(400).json({ message: "Validation Error", errors: errorMessages });
    }

    // --- 3. Check for files provided by multer ---


    if (!req.files || !req.files.event_video || req.files.event_video.length === 0) {
        return res.status(400).json({ message: 'Event video file is required.' });
    }
    const videoFile = req.files.event_video[0];
    console.log(" video file: ", videoFile);
    const thumbnailFile = req.files.thumbnail

    let videoURL = null;
    let thumbnailURL = null;
    const created_by = req.user?.id; // Get user ID from authentication middleware (ensure req.user exists)

    if (!created_by) {
         return res.status(401).json({ message: 'Authentication required: User ID not found.' });
    }

    try {
        // --- 4. Upload Video to Firebase ---
        console.log(`[${new Date().toISOString()}] Uploading video: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);
        const videoFileName = `videos/event-${uuidv4()}-${videoFile.originalname.replace(/[^a-zA-Z0-9.]+/g, '_')}`; // Sanitize filename
        const videoBlob = bucket.file(videoFileName);
        const videoBlobStream = videoBlob.createWriteStream({
            metadata: { contentType: videoFile.mimetype },
            public: true, // Make file publicly readable
            resumable: false, // Consider 'true' for large files, but adds complexity
        });

        const videoUploadPromise = new Promise((resolve, reject) => {
            videoBlobStream.on('error', err => reject(new Error(`Video upload stream error: ${err.message}`)));
            videoBlobStream.on('finish', () => {
                // Construct the public URL
                videoURL = `https://storage.googleapis.com/${bucket.name}/${videoFileName}`;
                console.log(`[${new Date().toISOString()}] Video uploaded successfully: ${videoURL}`);
                resolve();
            });
            // Write the buffer from memoryStorage
            videoBlobStream.end(videoFile.buffer);
        });

        await videoUploadPromise; // Wait for video upload

        // --- 5. Upload Thumbnail (if exists) ---
        if (thumbnailFile) {
            console.log(`[${new Date().toISOString()}] Uploading thumbnail: ${thumbnailFile.originalname} (${(thumbnailFile.size / 1024).toFixed(1)} KB)`);
            const thumbFileName = `thumbnails/event-${uuidv4()}-${thumbnailFile.originalname.replace(/[^a-zA-Z0-9.]+/g, '_')}`; // Sanitize filename
            const thumbBlob = bucket.file(thumbFileName);
            const thumbBlobStream = thumbBlob.createWriteStream({
                metadata: { contentType: thumbnailFile.mimetype },
                public: true,
                 resumable: false,
            });

            const thumbUploadPromise = new Promise((resolve, reject) => {
                thumbBlobStream.on('error', err => reject(new Error(`Thumbnail upload stream error: ${err.message}`)));
                thumbBlobStream.on('finish', () => {
                    thumbnailURL = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;
                    console.log(`[${new Date().toISOString()}] Thumbnail uploaded successfully: ${thumbnailURL}`);
                    resolve();
                });
                thumbBlobStream.end(thumbnailFile.buffer);
            });
            await thumbUploadPromise; // Wait for thumbnail upload
        } else {
            console.log("No thumbnail file provided by client. Thumbnail URL will be null.");
            thumbnailURL = null; // Or assign a default placeholder URL if desired
        }

        // --- 6. Parse JSON string fields from validatedBody ---
        let parsedAddress, parsedAgeRestriction, parsedGenderRestriction;
        try {
            parsedAddress = JSON.parse(validatedBody.event_address);
            // Ensure arrays are parsed correctly, provide empty array as default
            parsedAgeRestriction = validatedBody.age_restriction ? JSON.parse(validatedBody.age_restriction) : [];
            parsedGenderRestriction = validatedBody.gender_restriction ? JSON.parse(validatedBody.gender_restriction) : [];

            // Basic validation on parsed address
            if (!parsedAddress || typeof parsedAddress.address !== 'string' || typeof parsedAddress.longitude !== 'number' || typeof parsedAddress.latitude !== 'number') {
                throw new Error('Invalid event_address structure');
            }

        } catch (parseError) {
            console.error("Error parsing JSON fields from body:", parseError);
            return res.status(400).json({ message: 'Invalid format for address, age, or gender restriction string.' });
        }

        // --- 7. Create Event Document in MongoDB ---
        const newEvent = new Event({
            // Spread validated non-file fields
            ...validatedBody,
            // Overwrite/set specific fields
            event_address: { // Store parsed object
                address: parsedAddress.address,
                longitude: parsedAddress.longitude,
                latitude: parsedAddress.latitude,
            },
            age_restriction: parsedAgeRestriction, // Store parsed array
            gender_restriction: parsedGenderRestriction, // Store parsed array
            created_by: created_by, // Use ID from auth
            // --- Save the URLs from Firebase ---
            event_video: videoURL,
            thumbnail: thumbnailURL,
            // ticketsSold defaults to 0 from schema
        });

        console.log(`[${new Date().toISOString()}] Saving event to database for user ${created_by}...`);
        const savedEvent = await newEvent.save();
        console.log(`[${new Date().toISOString()}] Event saved successfully: ${savedEvent._id}`);

        // --- 8. Send Success Response ---
        res.status(201).json({
            message: 'Event created successfully!',
            event: savedEvent, // Send back the full event object
            videoURL: videoURL, // Also confirm the URLs used
            thumbnailURL: thumbnailURL,
        });

    } catch (error) {
        // --- Robust Error Handling ---
        console.error(`[${new Date().toISOString()}] Error in createEventWithUpload:`, error);

        // Optional: Attempt to delete uploaded files from Firebase if DB save fails or other error occurs
        // Important: Implement deleteFileFromFirebase carefully based on URL structure
        // if (videoURL) await deleteFileFromFirebase(videoURL).catch(e => console.error("Firebase cleanup failed for video", e.message));
        // if (thumbnailURL) await deleteFileFromFirebase(thumbnailURL).catch(e => console.error("Firebase cleanup failed for thumbnail", e.message));

        // Provide more specific feedback
        if (error.message.includes("upload stream error")) {
             res.status(500).json({ message: 'Server error during file upload.', details: error.message });
        } else if (error.name === 'ValidationError') { // Mongoose validation error
             res.status(400).json({ message: 'Database validation failed.', details: error.message });
        } else if (error.code === 'storage/object-not-found' || error.code === 404) { // Potential Firebase errors during upload step (less likely with streams)
             res.status(500).json({ message: 'Storage error during file processing.', details: error.message });
        }
        else {
             res.status(500).json({ message: 'Internal server error creating event.', details: error.message });
        }
    }
};


// --- Old Create Event (Commented Out - Not compatible with file uploads) ---
/*
exports.createEvent = async (req, res) => {
    // THIS FUNCTION EXPECTS URLS IN req.body, NOT FILES
    try {
        // Use the original Joi schema that expects URLs
        const { value, error } = originalCreateEventSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({ message: "Validation Error", errors: errorMessages });
        }

        const created_by = req.user.id; // Assumes auth middleware sets req.user

        // Basic check for address structure if needed (Joi already does this)
        if (!value.event_address || typeof value.event_address.address !== 'string') {
             return res.status(400).json({ message: "Invalid address structure."});
        }

        const newEvent = new Event({
            ...value, // Spread validated data (including string URLs)
            created_by,
        });

        await newEvent.save();
        res.status(201).json({ message: "Event created successfully (using old method)", event: newEvent });
    } catch (error) {
        console.error("Error creating event (old method):", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
*/


// --- Get All Events (with Pagination & Filtering) ---
// exports.getEvents = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const skip = (page - 1) * limit;

//         const filter = {};
//         const searchTerm = req.query.searchTerm?.trim(); // Trim whitespace
//         const searchType = req.query.searchType;

//         // Build filter based on search term and type
//         if (searchTerm) {
//             const regex = { $regex: searchTerm, $options: 'i' }; // Case-insensitive regex

//             if (searchType === "location" && filter["event_address.address"] === undefined) { // Check if already set
//                 filter["event_address.address"] = regex;
//             } else if (searchType === "event" && filter.event_title === undefined) {
//                 filter.event_title = regex;
//             }
//             // Username search needs special handling after population
//         }

//         if (req.query.category && filter.category === undefined) {
//             filter.category = req.query.category;
//         }

//         // Date filtering
//         if (req.query.dateFilter && filter.event_date_and_time === undefined) {
//             const today = DateTime.now().startOf('day'); // Use Luxon for consistency
//             if (req.query.dateFilter === 'today') {
//                 const tomorrow = today.plus({ days: 1 });
//                 filter.event_date_and_time = { $gte: today.toJSDate(), $lt: tomorrow.toJSDate() };
//             } else if (req.query.dateFilter === 'upcoming') {
//                 filter.event_date_and_time = { $gte: today.toJSDate() };
//             }
//         }

//         // Count total documents matching the filter *before* pagination
//         // Note: Count doesn't perfectly reflect post-population username filter results
//         const totalMatchingFilter = await Event.countDocuments(filter);

//         // Base query with population
//         let query = Event.find(filter)
//             .populate("created_by", "fullname email profile_picture username") // Select needed fields
//             .populate("booked_tickets", "fullname email profile_picture")     // Select needed fields
//             .sort({ event_date_and_time: 1 }) // Sort before skip/limit
//             .skip(skip)
//             .limit(limit);

//         let events = await query.exec();

//         // Apply username filter *after* population if needed
//         if (searchTerm && searchType === 'username') {
//             events = events.filter(event =>
//                 event.created_by?.username?.toLowerCase().includes(searchTerm.toLowerCase())
//             );
//             // Note: 'total' count won't reflect this post-filtering accurately.
//             // A more complex aggregation pipeline would be needed for perfect count + filter + pagination.
//         }

//         res.json({
//             events: events,
//             total: totalMatchingFilter, // Total matching the initial filter
//             page: page,
//             limit: limit,
//             //totalPages: Math.ceil(totalMatchingFilter / limit) // Can calculate on frontend too
//         });
//     } catch (error) {
//         console.error("Error fetching events:", error);
//         res.status(500).json({ message: "Error fetching events", error: error.message });
//     }
// };

exports.getEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Initialize aggregation pipeline
        const pipeline = [];

        // Base match stage
        const matchStage = {};

        // Handle category filter
        if (req.query.category) {
            matchStage.category = req.query.category;
        }

        // Handle date filters
        if (req.query.dateFilter) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (req.query.dateFilter === 'today') {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                matchStage.event_date_and_time = { 
                    $gte: today, 
                    $lt: tomorrow 
                };
            } else if (req.query.dateFilter === 'upcoming') {
                matchStage.event_date_and_time = { $gte: today };
            }
        }

        // Handle search term with different search types
        if (req.query.searchTerm?.trim()) {
            const searchTerm = req.query.searchTerm.trim();
            const searchType = req.query.searchType || 'event';

            if (searchType === 'location') {
                matchStage['event_address.address'] = { 
                    $regex: searchTerm, 
                    $options: 'i' 
                };
            } else if (searchType === 'event') {
                matchStage.event_title = { 
                    $regex: searchTerm, 
                    $options: 'i' 
                };
            } else if (searchType === 'username') {
                // Will handle this in a later stage after population
            }
        }

        // Add match stage if filters exist
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Add lookup for created_by (replaces populate)
        pipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'created_by'
                }
            },
            { $unwind: '$created_by' }
        );

        // Add lookup for booked_tickets (replaces populate)
        pipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'booked_tickets',
                    foreignField: '_id',
                    as: 'booked_tickets'
                }
            }
        );

        // Handle username search after population if needed
        if (req.query.searchTerm?.trim() && req.query.searchType === 'username') {
            pipeline.push({
                $match: {
                    'created_by.username': {
                        $regex: req.query.searchTerm.trim(),
                        $options: 'i'
                    }
                }
            });
        }

        // Clone pipeline for counting before adding pagination stages
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: 'total' });

        // Add sorting and pagination
        pipeline.push(
    { $sort: { createdAt: -1 } }, // Sort by newest first based on creation timestamp
    { $skip: skip },
    { $limit: limit }
);

        // Execute both pipelines in parallel
        const [events, countResult] = await Promise.all([
            Event.aggregate(pipeline),
            Event.aggregate(countPipeline)
        ]);

        const total = countResult[0]?.total || 0;

        // Project only needed fields
        const projectedEvents = events.map(event => ({
            ...event,
            created_by: {
                _id: event.created_by._id,
                fullname: event.created_by.fullname,
                email: event.created_by.email,
                profile_picture: event.created_by.profile_picture,
                username: event.created_by.username
            },
            booked_tickets: event.booked_tickets.map(user => ({
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                profile_picture: user.profile_picture
            }))
        }));

        res.json({
            events: projectedEvents,
            total,
            page,
            limit
        });

    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ 
            message: "Error fetching events", 
            error: error.message 
        });
    }
};

// --- Book Event (Initiate Payment) ---
// exports.bookEvent = async (req, res) => {
//     const { eventId } = req.params;
//     const userId = req.user?.id; // Use optional chaining

//     if (!userId) {
//         return res.status(401).json({ message: "Authentication required." });
//     }

//     // Validate eventId format before querying DB
//      if (!mongoose.Types.ObjectId.isValid(eventId)) {
//         return res.status(400).json({ message: "Invalid Event ID format." });
//     }

//     const callbackUrl = `${FRONTEND_URL}/verify-payment?eventId=${eventId}&userId=${userId}`;

//     // No transaction needed here, just initiating payment
//     try {
//         const user = await User.findById(userId, 'email dateOfBirth gender').lean(); // Fetch only needed fields, lean for performance
//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         const event = await Event.findById(eventId, 'ticket_price event_max_capacity age_restriction gender_restriction booked_tickets').lean(); // Fetch only needed fields
//         if (!event) {
//             return res.status(404).json({ message: "Event not found" });
//         }

//         // --- Pre-payment Checks ---
//         if (event.event_max_capacity <= 0) {
//             return res.status(400).json({ message: "Event is fully booked" });
//         }

//         const userAge = calculateAge(user.dateOfBirth);

//         // Refined Age Check (assuming schema uses specific strings)
//         let ageRestricted = false;
//         if (userAge !== null && event.age_restriction && event.age_restriction.length > 0) {
//              if (event.age_restriction.includes('<18') && userAge < 18) ageRestricted = true;
//              else if (event.age_restriction.includes('18 - 29') && (userAge < 18 || userAge > 29)) ageRestricted = true;
//              else if (event.age_restriction.includes('30 - 39') && (userAge < 30 || userAge > 39)) ageRestricted = true;
//              else if (event.age_restriction.includes('40 <') && userAge < 40) ageRestricted = true;
//              // Add more specific checks if your age strings are different
//         }
//          if (ageRestricted) {
//              return res.status(403).json({ message: "You do not meet the age requirements for this event." });
//         }


//         // Gender Check (Only restrict if user's gender is explicitly listed for restriction)
//         // Assumes gender_restriction holds genders NOT allowed (adjust if it means ONLY allowed)
//       // Gender Check (Only restrict if user's gender is explicitly listed for restriction)

//       console.log(" the event :- " , event , " and the gender restriction :- " , event.gender_restriction)
//       console.log(" user's gender :- " , user.gender , " is gender_restriction an array ? " , Array.isArray(event.gender_restriction))
//       console.log(" does it include a normal string ? " ,  event.gender_restriction.includes("abcd") );
//       console.log(" does it include user.gender ? " ,  event.gender_restriction.includes(user.gender) );
// if (user.gender && Array.isArray(event.gender_restriction) && event.gender_restriction.includes(user.gender)) {
//     return res.status(403).json({ message: "This event has gender restrictions you do not meet." });
// }


//         // --- Initiate Payment ---
//       if (event.ticket_price === 0) {
//             // Check if user is already booked
//             if (event.booked_tickets.includes(userId)) {
//                 return res.status(400).json({ message: "You have already booked this event." });
//             }

//             // Add user to booked tickets
//             await Event.findByIdAndUpdate(eventId, {
//                 $push: { booked_tickets: userId },
//                 $inc: { ticketsSold: 1 }
//             });

//             return res.status(200).json({ message: "You have successfully booked this free event." });
//         }

//         // Ensure ticket price is handled correctly (e.g., convert to kobo for Paystack)
//         const amountInKobo = event.ticket_price;
//         if (amountInKobo <= 0) {

//              return res.status(400).json({ message: "Ticket price must be greater than zero to initiate payment." });
//         }

//         const paymentData = await initializePayment(amountInKobo, user.email, callbackUrl);

//         // Check Paystack response structure
//         if (!paymentData || !paymentData.status || !paymentData.data || !paymentData.data.authorization_url || !paymentData.data.reference) {
//              console.error("Invalid response from Paystack initialization:", paymentData);
//              return res.status(500).json({ message: "Failed to initiate payment with provider." });
//         }

//         const { authorization_url, reference } = paymentData.data;

//         // Optionally store the reference temporarily if needed before verification
//         // e.g., link reference to eventId/userId in a temporary collection or cache

//         res.status(200).json({ authorization_url, reference });

//     } catch (error) {
//         console.error("Error initiating event booking:", error);
//         // Check for specific Paystack errors if possible
//         res.status(500).json({ message: "An error occurred while initiating the booking process." });
//     }
// };
exports.bookEvent = async (req, res) => {
    console.log('--- START OF bookEvent FUNCTION ---');
    console.log('Request received at:', new Date().toISOString());
    console.log('Request params:', req.params);
    console.log('Request user:', req.user);

    const { eventId } = req.params;
    const userId = req.user?.id; // Use optional chaining

    console.log('Extracted eventId:', eventId);
    console.log('Extracted userId:', userId);

    if (!userId) {
        console.log('No userId found - authentication required');
        return res.status(401).json({ message: "Authentication required." });
    }

    // Validate eventId format before querying DB
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        console.log('Invalid Event ID format:', eventId);
        return res.status(400).json({ message: "Invalid Event ID format." });
    }

    const callbackUrl = `${FRONTEND_URL}/verify-payment?eventId=${eventId}&userId=${userId}`;
    console.log('Generated callback URL:', callbackUrl);

    try {
        console.log('Attempting to find user with ID:', userId);
        const user = await User.findById(userId, 'email dateOfBirth gender').lean();
        if (!user) {
            console.log('User not found with ID:', userId);
            return res.status(404).json({ message: "User not found" });
        }
        console.log('Found user:', { email: user.email, dateOfBirth: user.dateOfBirth, gender: user.gender });

        console.log('Attempting to find event with ID:', eventId);
        const event = await Event.findById(eventId, 'ticket_price event_max_capacity age_restriction gender_restriction booked_tickets').lean();
        if (!event) {
            console.log('Event not found with ID:', eventId);
            return res.status(404).json({ message: "Event not found" });
        }
        console.log('Found event:', { 
            ticket_price: event.ticket_price, 
            capacity: event.event_max_capacity,
            age_restriction: event.age_restriction,
            gender_restriction: event.gender_restriction,
            booked_tickets_count: event.booked_tickets ? event.booked_tickets.length : 0
        });

        // --- Pre-payment Checks ---
        console.log('Checking event capacity...');
        if (event.event_max_capacity <= 0) {
            console.log('Event is fully booked. Capacity:', event.event_max_capacity);
            return res.status(400).json({ message: "Event is fully booked" });
        }

        console.log('Calculating user age...');
        const userAge = calculateAge(user.dateOfBirth);
        console.log('User age calculated:', userAge);

        console.log('Checking age restrictions...');
        let ageRestricted = false;
        if (userAge !== null && event.age_restriction && event.age_restriction.length > 0) {
            console.log('Age restrictions exist:', event.age_restriction);
            if (event.age_restriction.includes('<18') && userAge < 18) ageRestricted = true;
            else if (event.age_restriction.includes('18 - 29') && (userAge < 18 || userAge > 29)) ageRestricted = true;
            else if (event.age_restriction.includes('30 - 39') && (userAge < 30 || userAge > 39)) ageRestricted = true;
            else if (event.age_restriction.includes('40 <') && userAge < 40) ageRestricted = true;
        }
        console.log('Age restriction check result:', ageRestricted);

        if (ageRestricted) {
            console.log('User does not meet age requirements. User age:', userAge, 'Restrictions:', event.age_restriction);
            return res.status(403).json({ message: "You do not meet the age requirements for this event." });
        }

        console.log('Checking gender restrictions...');
        console.log("Event gender restrictions:", event.gender_restriction);
        console.log("User gender:", user.gender);
        console.log("Is gender_restriction an array?", Array.isArray(event.gender_restriction));

        if (user.gender && Array.isArray(event.gender_restriction)) {
            console.log('Gender restriction is an array. Checking if user gender is restricted...');
            console.log('Does restriction include test string "abcd"?', event.gender_restriction.includes("abcd"));
            console.log('Does restriction include user gender?', event.gender_restriction.includes(user.gender));

            if (event.gender_restriction.includes(user.gender)) {
                console.log('User gender is restricted. User gender:', user.gender, 'Restrictions:', event.gender_restriction);
                return res.status(403).json({ message: "This event has gender restrictions you do not meet." });
            }
        }

        console.log('Checking ticket price...');
        if (event.ticket_price === 0) {
            console.log('Free event detected. Checking if user is already booked...');
            if (event.booked_tickets.includes(userId)) {
                console.log('User already booked this free event. User ID:', userId);
                return res.status(400).json({ message: "You have already booked this event." });
            }

            // Start a session for transaction
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                console.log('Booking user for free event...');
                await Event.findByIdAndUpdate(eventId, {
                    $push: { booked_tickets: userId },
                    $inc: { ticketsSold: 1 }
                }, { session });

                // Update User's my_tickets
                await User.updateOne(
                    { _id: userId },
                    { $addToSet: { my_tickets: eventId } }
                ).session(session);

                // Get event creator
                const eventCreator = await User.findById(event.created_by).select('total_earnings').session(session);
                if (!eventCreator) {
                    throw new Error("Event creator not found.");
                }

                // For free events, platform commission is 0
                const platformCommission = 0;
                // For free events, earnings are also 0
                const earnings = 0;

                // Update event creator's total earnings
                eventCreator.total_earnings = (eventCreator.total_earnings || 0) + earnings;
                await eventCreator.save({ session });

                // Create and save platform earning record
                const platformEarning = new PlatformEarning({
                    event: eventId,
                    amount: platformCommission,
                    transaction_date: new Date(),
                });
                await platformEarning.save({ session });

                // Commit the transaction
                await session.commitTransaction();
                session.endSession();

                console.log('Successfully booked free event for user:', userId);
                return res.status(200).json({ message: "You have successfully booked this free event." });
            } catch (error) {
                // Abort transaction on error
                await session.abortTransaction();
                session.endSession();
                console.error("Error booking free event:", error);
                throw error; // Re-throw to be caught by the outer catch block
            }
        }

        console.log('Paid event detected. Using ticket price...');
        const amount = event.ticket_price;
        console.log('Amount:', amount);

        if (amount <= 0) {
            console.log('Invalid ticket price:', amount);
            return res.status(400).json({ message: "Ticket price must be greater than zero to initiate payment." });
        }

        console.log('Initializing payment with Paystack...');
        console.log('Payment details:', {
            amount: amount,
            email: user.email,
            callbackUrl: callbackUrl
        });

        const paymentData = await initializePayment(amount, user.email, callbackUrl);
        console.log('Paystack response:', paymentData);

        if (!paymentData || !paymentData.status || !paymentData.data || !paymentData.data.authorization_url || !paymentData.data.reference) {
            console.error("Invalid response from Paystack initialization:", paymentData);
            return res.status(500).json({ message: "Failed to initiate payment with provider." });
        }


        const { authorization_url, reference } = paymentData.data;
        console.log('Payment initialized successfully. Authorization URL:', authorization_url);
        console.log('Payment reference:', reference);

        res.status(200).json({ authorization_url, reference });

    } catch (error) {
        console.error("Error in bookEvent function:", {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ message: "An error occurred while initiating the booking process." });
    } finally {
        console.log('--- END OF bookEvent FUNCTION ---');
    }
};
// --- Verify Payment Callback (Handles Booking Logic Post-Payment) ---
// exports.verifyPaymentCallback = async (req, res) => {
//     const { reference, eventId, userId } = req.query;

//     if (!reference || !eventId || !userId) {
//         return res.status(400).json({ message: "Missing required query parameters (reference, eventId, userId)." });
//     }

//     // Validate IDs
//     if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid Event or User ID format." });
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         // --- Verify Payment with Paystack ---
//         console.log(`Verifying payment with reference: ${reference}`);
//         const paymentVerification = await verifyPayment(reference);

//         // Check Paystack response structure and status
//         if (!paymentVerification || !paymentVerification.status || !paymentVerification.data || paymentVerification.data.status !== "success") {
//             console.error("Payment verification failed or invalid response:", paymentVerification);
//             await session.abortTransaction();
//             session.endSession();
//             // Redirect user to a failure page on the frontend
//             return res.redirect(`${FRONTEND_URL}/payment-failed?reason=verification_failed`);
//             // OR return res.status(400).json({ message: "Payment verification failed" });
//         }

//         console.log("Payment verification successful.");
//         const expectedAmountKobo = Math.round(paymentVerification.data.amount); // Amount is in kobo from Paystack

//         // --- Fetch Event and User (within transaction) ---
//         // Select fields needed for update to minimize data transfer
//         const event = await Event.findById(eventId)
//             .select('event_max_capacity booked_tickets created_by ticket_price ticketsSold') // Added ticketsSold
//             .session(session);

//         if (!event) {
//             throw new Error("Event not found during verification."); // Throw error to abort transaction
//         }

//         // --- Cross-check Payment Amount (Important!) ---
//         const eventPriceKobo = Math.round(event.ticket_price * 100);
//         if (expectedAmountKobo !== eventPriceKobo) {
//              console.warn(`Payment amount mismatch! Expected ${eventPriceKobo} kobo, received ${expectedAmountKobo} kobo for reference ${reference}.`);
//              // Decide how to handle: abort, log, flag? Aborting is safest.
//              throw new Error("Payment amount mismatch.");
//         }

//         // --- Check Capacity and if User Already Booked (Idempotency) ---
//         if (event.event_max_capacity <= 0) {
//             console.warn(`Attempted booking for full event (ID: ${eventId}) after payment success (Ref: ${reference}).`);
//             // Decide how to handle: maybe refund is needed? For now, abort.
//             throw new Error("Event is fully booked (capacity check failed post-payment).");
//         }
//         if (event.booked_tickets.map(id => id.toString()).includes(userId)) {
//             console.warn(`User ${userId} already booked event ${eventId} (Ref: ${reference}). Possible duplicate callback.`);
//             // If already booked, commit transaction without changes? Or abort?
//             // Safest is often to commit if the state is already correct, preventing multiple charges.
//             // Let's assume idempotency: if already booked, treat as success without modification.
//              await session.commitTransaction();
//              session.endSession();
//              console.log("User already booked, considered successful (idempotency).");
//               // Redirect user to a success page
//              return res.redirect(`${FRONTEND_URL}/booking-success?eventId=${eventId}`);
//              // OR return res.status(200).json({ message: "Already booked", eventId: eventId });
//         }

//         // --- Update Event and User ---
//         event.booked_tickets.push(userId);
//         event.event_max_capacity -= 1;
//         event.ticketsSold += 1; // Increment ticketsSold
//         await event.save({ session });

//         const userUpdateResult = await User.updateOne(
//             { _id: userId },
//             { $addToSet: { my_tickets: eventId } } // Use $addToSet to prevent duplicates
//         ).session(session);

//          if (userUpdateResult.matchedCount === 0) {
//              throw new Error("User not found for updating tickets.");
//          }

//         // --- Update Creator Earnings and Platform Commission ---
//         const eventCreator = await User.findById(event.created_by).select('total_earnings').session(session);
//         if (!eventCreator) {
//              throw new Error("Event creator not found.");
//         }
//         const ticketPrice = event.ticket_price;
//         const platformCommissionRate = 0.13; // 13%
//         const platformCommission = ticketPrice * platformCommissionRate;
//         const earnings = ticketPrice - platformCommission;

//         eventCreator.total_earnings = (eventCreator.total_earnings || 0) + earnings;
//         await eventCreator.save({ session });

//         const platformEarning = new PlatformEarning({
//             event: eventId,
//             amount: platformCommission,
//             transaction_date: new Date(),
//         });
//         await platformEarning.save({ session });

//         console.log(`Booking successful for User ${userId}, Event ${eventId}.`);

//         // --- Commit Transaction ---
//         await session.commitTransaction();
//         session.endSession();

//         // --- Redirect to Frontend Success Page ---
//         // Sending JSON is less common for backend redirects after payment
//         res.redirect(`${FRONTEND_URL}/booking-success?eventId=${eventId}`);

//     } catch (error) {
//         console.error("Error during payment verification/booking:", error);
//         // Ensure transaction is aborted on any error
//         if (session.inTransaction()) {
//             await session.abortTransaction();
//         }
//         session.endSession();
//          // Redirect user to a failure page
//         res.redirect(`${FRONTEND_URL}/payment-failed?reason=${encodeURIComponent(error.message || 'internal_error')}`);
//         // OR res.status(500).json({ message: "An error occurred during payment verification.", details: error.message });
//     }
// };

exports.verifyPaymentCallback = async (req, res) => {
    console.log("Received request for payment verification with query params:", req.query);
    const { reference, eventId, userId } = req.query;

    if (!reference || !eventId || !userId) {
        console.error("Missing required query parameters!", { reference, eventId, userId });
        return res.status(400).json({ message: "Missing required query parameters (reference, eventId, userId)." });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
        console.error("Invalid ID format detected:", { eventId, userId });
        return res.status(400).json({ message: "Invalid Event or User ID format." });
    }

    console.log("Starting database transaction...");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log(`Verifying payment with Paystack. Reference: ${reference}`);
        const paymentVerification = await verifyPayment(reference);
        console.log("Paystack response:", JSON.stringify(paymentVerification, null, 2));

        if (!paymentVerification || !paymentVerification.status || !paymentVerification.data || paymentVerification.data.status !== "success") {
            console.error("Payment verification failed! Response:", paymentVerification);
            await session.abortTransaction();
            session.endSession();
            return res.redirect(`${FRONTEND_URL}/payment-failed?reason=verification_failed`);
        }

        console.log("Payment verification successful!");
        const expectedAmountKobo = Math.round(paymentVerification.data.amount);

        console.log("Fetching event details from database...");
        const event = await Event.findById(eventId)
            .select('event_max_capacity booked_tickets created_by ticket_price ticketsSold')
            .session(session);

        if (!event) {
            console.error("Event not found in the database!", { eventId });
            throw new Error("Event not found during verification.");
        }

        const eventPriceKobo = Math.round(event.ticket_price * 100);
        if (expectedAmountKobo !== eventPriceKobo) {
            console.warn("Payment amount mismatch!", {
                expected: eventPriceKobo,
                received: expectedAmountKobo,
                reference
            });
            throw new Error("Payment amount mismatch.");
        }

        console.log("Checking if event is fully booked or user already has a ticket...");
        if (event.event_max_capacity <= 0) {
            console.warn("Event is already at full capacity!", { eventId });
            throw new Error("Event is fully booked.");
        }
        if (event.booked_tickets.includes(userId)) {
            console.warn("User already booked this event!", { userId, eventId });
            await session.commitTransaction();
            session.endSession();
            return res.redirect(`${FRONTEND_URL}/booking-success?eventId=${eventId}`);
        }

        console.log("Updating event and user details...");
        event.booked_tickets.push(userId);
        event.event_max_capacity -= 1;
        event.ticketsSold += 1;
        await event.save({ session });

        const userUpdateResult = await User.updateOne(
            { _id: userId },
            { $addToSet: { my_tickets: eventId } }
        ).session(session);

        if (userUpdateResult.matchedCount === 0) {
            console.error("User not found while updating tickets!", { userId });
            throw new Error("User not found for updating tickets.");
        }

        console.log("Fetching event creator details...");
        const eventCreator = await User.findById(event.created_by)
            .select('total_earnings')
            .session(session);

        if (!eventCreator) {
            console.error("Event creator not found!", { eventCreatorId: event.created_by });
            throw new Error("Event creator not found.");
        }

        console.log("Calculating earnings...");
        const ticketPrice = event.ticket_price;
        const platformCommissionRate = 0.13;
        const platformCommission = ticketPrice * platformCommissionRate;
        const earnings = ticketPrice - platformCommission;

        console.log("Updating event creator earnings...");
        eventCreator.total_earnings = (eventCreator.total_earnings || 0) + earnings;
        await eventCreator.save({ session });

        console.log("Recording platform commission...");
        const platformEarning = new PlatformEarning({
            event: eventId,
            amount: platformCommission,
            transaction_date: new Date(),
        });
        await platformEarning.save({ session });

        console.log("Booking successful! User and event details updated.", { userId, eventId });
        await session.commitTransaction();
        return res.json({
            success: true,
            message: "Ticket booked successfully",
            redirectUrl: `${FRONTEND_URL}/booking-success?eventId=${eventId}`
        });



    } catch (error) {
        console.error("Critical error during payment verification!", error);
        await session.abortTransaction();
        // Ensure transaction is aborted on any error
        return res.status(500).json({
            success: false,
            message: error.message,
            redirectUrl: `${FRONTEND_URL}/payment-failed?reason=${encodeURIComponent(error.message || 'server_error')}`
        });
    }finally {
        session.endSession();
    }
};

// --- Get Event by ID ---
exports.getEventById = async (req, res) => {
    const { eventId } = req.params;
     if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID format." });
    }
    try {
        // Populate necessary fields
        const event = await Event.findById(eventId)
            .populate("created_by", "fullname username email profile_picture") // Populate creator details
            .populate("booked_tickets", "fullname username profile_picture"); // Populate guest previews

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.status(200).json(event);
    } catch (error) {
        console.error(`Error fetching event by ID ${eventId}:`, error);
        res.status(500).json({ message: "Error fetching event details.", error: error.message });
    }
};

// --- Delete All Events (Use with extreme caution!) ---
exports.deleteAllEvents = async (req, res) => {
    // !! Add strong authentication/authorization checks here !!
    // Example: Check if the user is an admin
    // if (req.user?.role !== 'admin') {
    //     return res.status(403).json({ message: "Unauthorized: Only admins can delete all events." });
    // }
    console.warn("!!!! ATTEMPTING TO DELETE ALL EVENTS !!!!");
    try {
        const deleteResult = await Event.deleteMany({});
        console.log(`Deleted ${deleteResult.deletedCount} events.`);
        // Consider deleting related PlatformEarnings too?
        await PlatformEarning.deleteMany({});
        // Consider removing event IDs from user 'my_tickets' arrays? (More complex)
        res.status(200).json({ message: `All events (${deleteResult.deletedCount}) and related earnings deleted successfully` });
    } catch (error) {
        console.error("Error deleting all events:", error);
        res.status(500).json({ message: "Error deleting all events.", error: error.message });
    }
};

// --- Get User Events (Logged-in User's Created & Booked) ---
exports.getUserEvents = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

      const requestingUser = await User.findById(userId).select('-password');
        console.log('\n=== REQUESTING USER ===');
        console.log(JSON.stringify(requestingUser.toObject(), null, 2));

        const createdEvents = await Event.find({ created_by: userId })
            .sort({ event_date_and_time: -1 }) // Sort by date descending
            .populate("created_by", "fullname username profile_picture")
            .populate("booked_tickets", "fullname username profile_picture");

        const bookedEvents = await Event.find({ booked_tickets: userId })
            .sort({ event_date_and_time: -1 }) // Sort by date descending
            .populate("created_by", "fullname username profile_picture")
            .populate("booked_tickets", "fullname username profile_picture");

        res.status(200).json({
            createdEvents,
            bookedEvents,
        });
    } catch (error) {
        console.error("Error fetching user events:", error);
        res.status(500).json({ message: "Error fetching user events", error: error.message });
    }
};

// --- Get Featured Events ---
exports.getFeaturedEvents = async (req, res) => {
    try {
        const now = new Date();
        const featuredEvents = await Event.find({
            event_date_and_time: { $gte: now }, // Only upcoming events
        })
            .sort({ ticketsSold: -1, event_date_and_time: 1 }) // Sort by popularity, then date
            .limit(8) // Limit the number of featured events
            .populate("created_by", "fullname username profile_picture") // Populate creator info
            .select( // Select only necessary fields for the featured list
                "event_title event_description event_date_and_time event_address.address ticket_price event_video thumbnail ticketsSold category"
            );

        res.status(200).json(featuredEvents);
    } catch (error) {
        console.error("Error fetching featured events:", error);
        res.status(500).json({ message: "Error fetching featured events", error: error.message });
    }
};

// --- Get Event Guests ---
exports.getEventGuests = async (req, res) => {
    const { eventId } = req.params;
     if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID format." });
    }

    try {
        const event = await Event.findById(eventId)
            .select('booked_tickets created_by') // Select only needed fields
            .populate(
                "booked_tickets",
                "fullname username email profile_picture gender" // Specify fields to populate for guests
            );

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Optional: Add authorization check - only event creator can see guests?
        // if (req.user?.id !== event.created_by.toString()) {
        //     return res.status(403).json({ message: "Unauthorized: Only the event creator can view the guest list." });
        // }

        res.status(200).json({
            message: "Guests retrieved successfully",
            guests: event.booked_tickets || [], // Ensure guests is an array
        });
    } catch (error) {
         console.error(`Error fetching guests for event ${eventId}:`, error);
        res.status(500).json({ message: "Error fetching event guests.", error: error.message });
    }
};

// --- Get Events by User ID (for viewing another user's profile) ---
exports.getEventsByUserId = async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Valid User ID parameter is required" });
        }

        // Find events *created* by this user
        const createdEvents = await Event.find({ created_by: userId })
            .sort({ event_date_and_time: -1 })
            .populate("created_by", "fullname username profile_picture")
            .populate("booked_tickets", "fullname username profile_picture"); // Maybe limit guest info here?

        // Find events *booked* by this user (Optional - depends if you want to show this on their profile)
        const bookedEvents = await Event.find({ booked_tickets: userId })
            .sort({ event_date_and_time: -1 })
            .populate("created_by", "fullname username profile_picture")
            .populate("booked_tickets", "fullname username profile_picture"); // Limited info

        res.status(200).json({
            createdEvents: createdEvents || [], // Ensure arrays are returned
            bookedEvents: bookedEvents || [],   // Ensure arrays are returned
        });
    } catch (error) {
        console.error(`Error fetching events for user ${req.params.userId}:`, error);
        res.status(500).json({ message: "Error fetching user events", error: error.message });
    }
};

// --- Get Platform Earnings (Admin Functionality) ---
exports.getPlatformEarnings = async (req, res) => {
     // !! Add strong authentication/authorization checks here !!
    // Example: Check if the user is an admin
    // if (req.user?.role !== 'admin') {
    //     return res.status(403).json({ message: "Unauthorized: Only admins can view platform earnings." });
    // }
    try {
        const platformEarningsResult = await PlatformEarning.aggregate([
            { // Sort first for potential optimization if many earnings records
                $sort: { transaction_date: -1 }
            },
            { // Lookup event details
                $lookup: {
                    from: "events", // The actual name of the events collection in MongoDB
                    localField: "event",
                    foreignField: "_id",
                    as: "eventDetails",
                },
            },
            { // Deconstruct the eventDetails array (should only be one match)
                $unwind: {
                    path: "$eventDetails",
                    preserveNullAndEmptyArrays: true, // Keep earnings even if event was deleted
                },
            },
            { // Project the desired fields
                $project: {
                    _id: 1,
                    amount: 1,
                    transaction_date: 1,
                    eventTitle: "$eventDetails.event_title", // Get specific fields
                    eventId: "$eventDetails._id",
                    // eventTicketPrice: "$eventDetails.ticket_price" // Optional
                },
            },
             { // Group to calculate total and format output
                $group: {
                    _id: null, // Group all documents together
                    totalEarnings: { $sum: "$amount" },
                    earningsList: { $push: "$$ROOT" }, // Push the projected documents into an array
                },
            },
            { // Project final output shape
                $project: {
                    _id: 0, // Exclude the group ID
                    totalEarnings: { $ifNull: ["$totalEarnings", 0] }, // Default to 0 if no earnings
                    earnings: { $ifNull: ["$earningsList", []] } // Default to empty array
                }
            }
        ]);

        // aggregate returns an array, take the first element (or default)
        const result = platformEarningsResult[0] || { totalEarnings: 0, earnings: [] };

      console.log(" the result of platform earning : " , result);

        res.status(200).json(result);

    } catch (error) {
        console.error("Error fetching platform earnings:", error);
        res.status(500).json({ message: "Error fetching platform earnings", error: error.message });
    }
};

// --- Delete Event (Created by User) ---
exports.deleteEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID format." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const event = await Event.findById(eventId).select('created_by event_video thumbnail').session(session); // Select fields needed

        if (!event) {
            throw new Error("Event not found.");
        }

        // Authorization Check
        if (event.created_by.toString() !== userId) {
            throw new Error("Unauthorized: You can only delete your own events.");
        }

        // 1. Delete associated Platform Earnings
        await PlatformEarning.deleteMany({ event: eventId }).session(session);

        // 2. Remove event ID from users' booked tickets
        await User.updateMany(
            { my_tickets: eventId },
            { $pull: { my_tickets: eventId } }
        ).session(session);

        // 3. Delete the Event document itself
        await Event.findByIdAndDelete(eventId).session(session);

        // --- 4. Delete Files from Firebase Storage (Optional but Recommended) ---
        // Important: Implement deleteFileFromFirebase helper carefully
        // if (event.event_video) await deleteFileFromFirebase(event.event_video).catch(e => console.error(`Firebase cleanup failed for video ${event.event_video}:`, e.message));
        // if (event.thumbnail) await deleteFileFromFirebase(event.thumbnail).catch(e => console.error(`Firebase cleanup failed for thumbnail ${event.thumbnail}:`, e.message));


        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Event and associated data deleted successfully" });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Error deleting event ${eventId}:`, error);
         if (error.message.startsWith("Unauthorized")) {
             res.status(403).json({ message: error.message });
         } else if (error.message === "Event not found."){
            res.status(404).json({ message: error.message });
         } else {
            res.status(500).json({ message: "Error deleting event", error: error.message });
         }
    }
};


// --- Update Event (Created by User) ---
// NOTE: This currently only updates text/data fields. Updating files (video/thumbnail)
// would require adding multer middleware to the corresponding PUT/PATCH route
// and logic here similar to createEventWithUpload to handle potential new file uploads.
exports.updateEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const updateData = req.body;

    if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
     if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID format." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // --- Validate Incoming Data ---
        // Use the update schema which allows partial updates
        const { value, error } = updateEventSchema.validate(updateData, { abortEarly: false });
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Validation Error", errors: errorMessages });
        }

        // --- Fetch Event & Authorize ---
        const event = await Event.findById(eventId).select('created_by').session(session); // Select only needed field for auth

        if (!event) {
             throw new Error("Event not found.");
        }

        if (event.created_by.toString() !== userId) {
             throw new Error("Unauthorized: You can only edit your own events.");
        }

        // --- Prepare Update Object ---
        // Filter out fields that shouldn't be directly updatable
        const disallowedFields = ["created_by", "booked_tickets", "_id", "createdAt", "updatedAt", "__v", "ticketsSold"];
        const filteredUpdateData = { ...value }; // Start with validated data
        disallowedFields.forEach(field => delete filteredUpdateData[field]);

        // Special handling for nested address object if provided
        if (filteredUpdateData.event_address) {
             // Ensure we update subfields correctly using dot notation if needed
             // Or just replace the whole object if that's intended
             // For simplicity here, assuming Joi validated the structure and we replace it
        }

        // Add logic here if handling file updates (check req.files, upload, update URLs)
        // e.g., if (req.files?.event_video) { /* upload logic */ filteredUpdateData.event_video = newVideoURL; }
        // e.g., if (req.files?.thumbnail_file) { /* upload logic */ filteredUpdateData.thumbnail = newThumbnailURL; }


        // --- Perform Update ---
        const updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            { $set: filteredUpdateData }, // Use $set for partial updates
            { new: true, runValidators: true, session } // Options: return updated doc, run schema validators
        ).populate("created_by", "fullname username profile_picture") // Populate for response
         .populate("booked_tickets", "fullname username profile_picture");


        if (!updatedEvent) {
             // Should not happen if findById worked, but good check
              throw new Error("Event found but failed to update.");
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Event updated successfully", event: updatedEvent });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Error updating event ${eventId}:`, error);
         if (error.message.startsWith("Unauthorized")) {
             res.status(403).json({ message: error.message });
         } else if (error.message === "Event not found."){
            res.status(404).json({ message: error.message });
         } else if (error.name === 'ValidationError') { // Mongoose validation error during update
             res.status(400).json({ message: 'Database validation failed during update.', details: error.message });
         } else {
            res.status(500).json({ message: "Error updating event", error: error.message });
         }
    }
};
