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

// Export all controller functions as a module
const eventController = {};

// --- Environment Variables ---
// Make sure FRONTEND_URL is set in your .env file or environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Provide a default for safety



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

    event_video: Joi.string().allow(''),
    thumbnail: Joi.string().allow(''),
    age_restriction: Joi.array().items(Joi.string()),
    gender_restriction: Joi.array().items(Joi.string()),
}).min(1); // Require at least one field to be updated



eventController.createEventWithUpload = async (req, res, next) => { // Added next for error handling
    // ... (initial checks and body validation from your code) ...
    // Ensure req.user.id exists
    const created_by = req.user?.id;
    if (!created_by) {
         return res.status(401).json({ message: 'Authentication required: User ID not found.' });
    }

    // --- 3. Get files from multer ---
    // Ensure field names match your multer setup
    const videoFile = (req.files && req.files.event_video && req.files.event_video[0]) ? req.files.event_video[0] : null;
    const thumbnailFile = (req.files && req.files.thumbnail_file && req.files.thumbnail_file[0]) ? req.files.thumbnail_file[0] : null; // Adjusted field name based on your log

    if (!videoFile) {
        return res.status(400).json({ message: 'Event video file is required.' });
    }

    // Check for supported video formats
    const supportedVideoFormats = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!supportedVideoFormats.includes(videoFile.mimetype)) {
        return res.status(400).json({ 
            message: 'Unsupported video format.', 
            details: 'Please upload a video in MP4, WebM, or OGG format.' 
        });
    }

    console.log("Video file object:", videoFile);
    if (thumbnailFile) console.log("Thumbnail file object:", thumbnailFile);


    let videoURL = null;
    let thumbnailURL = null;

    try {
        // --- 4. Upload Video to Firebase ---
        console.log(`[${new Date().toISOString()}] Uploading video: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);
        const videoFileName = `event_videos/${created_by}/${uuidv4()}-${videoFile.originalname.replace(/[^a-zA-Z0-9.]+/g, '_')}`;
        const videoBlob = bucket.file(videoFileName);
        const videoBlobStream = videoBlob.createWriteStream({
            metadata: {
                contentType: videoFile.mimetype,
                // You can add custom metadata here if needed
                // customMetadata: { uploadedBy: created_by }
            },
            // resumable: false, // Default is usually fine for files of this size. Can omit.
        });

        const videoUploadPromise = new Promise((resolve, reject) => {
            videoBlobStream.on('error', (err) => { // This is line ~161
                console.error(`[STREAM ERROR - VIDEO] ${err.message}`, err); // Log the full error
                reject(new Error(`Video upload stream error: ${err.message}`));
            });
            videoBlobStream.on('finish', () => {
                videoURL = `https://storage.googleapis.com/${bucket.name}/${videoFileName}`;
                console.log(`[${new Date().toISOString()}] Video uploaded, attempting to make public: ${videoURL}`);
                // Make the file public *after* upload finishes
                videoBlob.makePublic().then(() => {
                    console.log(`[${new Date().toISOString()}] Video made public: ${videoURL}`);
                    resolve();
                }).catch(pubErr => {
                    console.error(`[PUBLIC ERROR - VIDEO] ${pubErr.message}`, pubErr);
                    reject(new Error(`Video uploaded but failed to make public: ${pubErr.message}`));
                });
            });
            videoBlobStream.end(videoFile.buffer);
        });

        await videoUploadPromise;

        // --- 5. Upload Thumbnail (if exists) ---
        if (thumbnailFile) {
            console.log(`[${new Date().toISOString()}] Uploading thumbnail: ${thumbnailFile.originalname}`);
            const thumbFileName = `event_thumbnails/${created_by}/${uuidv4()}-${thumbnailFile.originalname.replace(/[^a-zA-Z0-9.]+/g, '_')}`;
            const thumbBlob = bucket.file(thumbFileName);
            const thumbBlobStream = thumbBlob.createWriteStream({
                metadata: { contentType: thumbnailFile.mimetype },
            });

            const thumbUploadPromise = new Promise((resolve, reject) => {
                thumbBlobStream.on('error', (err) => {
                    console.error(`[STREAM ERROR - THUMBNAIL] ${err.message}`, err);
                    reject(new Error(`Thumbnail upload stream error: ${err.message}`));
                });
                thumbBlobStream.on('finish', () => {
                    thumbnailURL = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;
                    console.log(`[${new Date().toISOString()}] Thumbnail uploaded, attempting to make public: ${thumbnailURL}`);
                    thumbBlob.makePublic().then(() => {
                        console.log(`[${new Date().toISOString()}] Thumbnail made public: ${thumbnailURL}`);
                        resolve();
                    }).catch(pubErr => {
                        console.error(`[PUBLIC ERROR - THUMBNAIL] ${pubErr.message}`, pubErr);
                        reject(new Error(`Thumbnail uploaded but failed to make public: ${pubErr.message}`));
                    });
                });
                thumbBlobStream.end(thumbnailFile.buffer);
            });
            await thumbUploadPromise;
        } else {
            console.log("No thumbnail file provided.");
        }

        // ... (your JSON parsing and MongoDB save logic from your code - looks okay) ...
        // --- 6. Parse JSON string fields ---
        // ...
        // --- 7. Create Event Document in MongoDB ---
        // ...

        res.status(201).json({
            message: 'Event created successfully!',
            event: savedEvent, // Assuming savedEvent is defined after newEvent.save()
            videoURL: videoURL,
            thumbnailURL: thumbnailURL,
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] CATCH BLOCK in createEventWithUpload:`, error.message, error.stack);
        // Pass to global error handler or handle as you were
        // The specific error messages you had were good.
        if (!res.headersSent) { // Ensure headers haven't been sent by a stream error already
            if (error.message.includes("upload stream error")) {
                 res.status(500).json({ message: 'Server error during file upload.', details: error.message });
            } else if (error.name === 'ValidationError') {
                 res.status(400).json({ message: 'Database validation failed.', details: error.message });
            }
            // ... other specific error checks
            else {
                 res.status(500).json({ message: 'Internal server error creating event.', details: error.message });
            }
        } else {
            console.error("Error occurred after headers were sent. This shouldn't happen if promises are awaited correctly.");
        }
        // Or simply use next(error) if you have a good global error handler
        // next(error);
    }
};


eventController.getEvents = async (req, res) => {
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


eventController.bookEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user?.id; // Use optional chaining

    if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
    }

    // Validate eventId format before querying DB
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID format." });
    }

    const callbackUrl = `${FRONTEND_URL}/verify-payment?eventId=${eventId}&userId=${userId}`;

    try {
        const user = await User.findById(userId, 'email dateOfBirth gender').lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const event = await Event.findById(eventId, 'ticket_price event_max_capacity age_restriction gender_restriction booked_tickets').lean();
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // --- Pre-payment Checks ---
        if (event.event_max_capacity <= 0) {
            return res.status(400).json({ message: "Event is fully booked" });
        }

        const userAge = calculateAge(user.dateOfBirth);

        // Check age restrictions
        let ageRestricted = false;
        if (userAge !== null && event.age_restriction && event.age_restriction.length > 0) {
            if (event.age_restriction.includes('<18') && userAge < 18) ageRestricted = true;
            else if (event.age_restriction.includes('18 - 29') && (userAge < 18 || userAge > 29)) ageRestricted = true;
            else if (event.age_restriction.includes('30 - 39') && (userAge < 30 || userAge > 39)) ageRestricted = true;
            else if (event.age_restriction.includes('40 <') && userAge < 40) ageRestricted = true;
        }

        if (ageRestricted) {
            return res.status(403).json({ message: "You do not meet the age requirements for this event." });
        }

        // Check gender restrictions
        if (user.gender && Array.isArray(event.gender_restriction)) {
            if (event.gender_restriction.includes(user.gender)) {
                return res.status(403).json({ message: "This event has gender restrictions you do not meet." });
            }
        }

        // Handle free events
        if (event.ticket_price === 0) {
            if (event.booked_tickets.includes(userId)) {
                return res.status(400).json({ message: "You have already booked this event." });
            }

            // Start a session for transaction
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
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

                return res.status(200).json({ message: "You have successfully booked this free event." });
            } catch (error) {
                // Abort transaction on error
                await session.abortTransaction();
                session.endSession();
                throw error; // Re-throw to be caught by the outer catch block
            }
        }

        // Handle paid events
        const amount = event.ticket_price;

        if (amount <= 0) {
            return res.status(400).json({ message: "Ticket price must be greater than zero to initiate payment." });
        }

        const paymentData = await initializePayment(amount, user.email, callbackUrl);

        if (!paymentData || !paymentData.status || !paymentData.data || !paymentData.data.authorization_url || !paymentData.data.reference) {
            return res.status(500).json({ message: "Failed to initiate payment with provider." });
        }

        const { authorization_url, reference } = paymentData.data;
        res.status(200).json({ authorization_url, reference });

    } catch (error) {
        res.status(500).json({ message: "An error occurred while initiating the booking process." });
    }
};


eventController.verifyPaymentCallback = async (req, res) => {
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
eventController.getEventById = async (req, res) => {
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
eventController.deleteAllEvents = async (req, res) => {
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
eventController.getUserEvents = async (req, res) => {
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
eventController.getFeaturedEvents = async (req, res) => {
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
eventController.getEventGuests = async (req, res) => {
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
eventController.getEventsByUserId = async (req, res) => {
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
eventController.getPlatformEarnings = async (req, res) => {
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
eventController.deleteEvent = async (req, res) => {
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
eventController.updateEvent = async (req, res) => {
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
// Export the controller object
module.exports = eventController;
