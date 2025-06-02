const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const PlatformEarning = require('../models/PlatformEarning');
const { DateTime } = require('luxon');
require('crypto');
require('firebase-admin');
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is installed (npm i uuid)
const Joi = require('joi');
const { initializePayment, verifyPayment } = require('../utils/paystack');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Provide a default for safety

// --- Firebase Storage Bucket ---
// IMPORTANT: Ensure Firebase Admin SDK is initialized in your main server file (e.g., app.js or server.js)
// Example initialization (should be done ONCE at startup):
/*

*/
// Get the storage bucket instance (assuming admin is initialized)
let bucket;
try {
    const admin = require('firebase-admin');

    if (admin.apps.length){
        bucket = admin.storage().bucket();
    } else{
        console.error("Firebase Admin SDK not initialized. Please initialize it before using the storage bucket.");
    }
} catch (initError) {
  console.error("Error initializing Firebase Admin SDK:", initError.message);
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

exports.generateStorageSignedUrl = async (req, res) => {
    if (!bucket) {
        console.error("Firebase Storage Bucket is not initialized for generating signed URL.");
        return res.status(500).json({ message: "Server configuration error: Storage service unavailable." });
    }

    const { filename, contentType, type } = req.body; // type can be 'video' or 'thumbnail'

    if (!filename || !contentType || !type) {
        return res.status(400).json({ message: "Filename, contentType, and type (video/thumbnail) are required." });
    }

    // Define a path structure in your bucket
    const basePath = type === 'video' ? 'event_videos' : 'event_thumbnails';
    const uniqueFilename = `${basePath}/${uuidv4()}-${filename.replace(/[^a-zA-Z0-9.]+/g, '_')}`;

    const file = bucket.file(uniqueFilename);

    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes URL validity
        contentType: contentType,
    };

    try {
        console.log(`[${new Date().toISOString()}] Generating signed URL for: ${uniqueFilename}, type: ${type}`);
        const [signedUrl] = await file.getSignedUrl(options);
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFilename}`; // Construct public URL

        console.log(`[${new Date().toISOString()}] Signed URL generated: ${signedUrl}`);
        res.status(200).json({
            signedUrl,    // URL for client to PUT the file
            publicUrl,    // Publicly accessible URL after upload (to store in DB)
            uniqueFilename // The path in Firebase Storage
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error generating signed URL for ${type}:`, error);
        res.status(500).json({ message: `Could not generate upload URL for ${type}.`, details: error.message });
    }
};

const createEventBodySchema = Joi.object({
    event_title: Joi.string().required().min(3).max(255),
    category: Joi.string().required(),
    event_date_and_time: Joi.string().isoDate().required(),
    event_address: Joi.string().required(),
    additional_info: Joi.string().allow('').optional(),
    ticket_price: Joi.number().required().min(0),
    event_description: Joi.string().required(),
    event_duration: Joi.number().required().min(0.5),
    event_max_capacity: Joi.number().required().min(1).integer(),
    age_restriction: Joi.string().required(),
    gender_restriction: Joi.string().required(),

    event_video_url: Joi.string().uri().required(),
    thumbnail_url: Joi.string().uri().allow(null, ''),
}).options({ stripUnknown: true });

exports.createEventWithUpload = async (req, res) => {
    // --- 1. Validate req.body (which now includes event_video_url and thumbnail_url) ---
    console.log(`[${new Date().toISOString()}] createEventWithUpload received body: `, req.body);
    const { error: bodyError, value: validatedBody } = createEventBodySchema.validate(req.body);
    if (bodyError) {
        const errorMessages = bodyError.details.map(detail => detail.message);
        console.log(`[${new Date().toISOString()}] Validation errors: `, errorMessages);
        return res.status(400).json({ message: "Validation Error", errors: errorMessages });
    }

    const created_by = req.user?.id;
    if (!created_by) {
        console.log(`[${new Date().toISOString()}] Authentication required: User ID not found.`);
        return res.status(401).json({ message: 'Authentication required: User ID not found.' });
    }

    try {
        // --- URLs are now directly from validatedBody ---
        const videoURL = validatedBody.event_video_url;
        const thumbnailURL = validatedBody.thumbnail_url || null; // If optional and not provided

        console.log(`[${new Date().toISOString()}] Using Video URL: ${videoURL}`);
        console.log(`[${new Date().toISOString()}] Using Thumbnail URL: ${thumbnailURL}`);

        // --- 2. Parse JSON string fields from validatedBody ---
        let parsedAddress, parsedAgeRestriction, parsedGenderRestriction;
        try {
            parsedAddress = JSON.parse(validatedBody.event_address);
            parsedAgeRestriction = validatedBody.age_restriction ? JSON.parse(validatedBody.age_restriction) : [];
            parsedGenderRestriction = validatedBody.gender_restriction ? JSON.parse(validatedBody.gender_restriction) : [];

            if (!parsedAddress || typeof parsedAddress.address !== 'string' || typeof parsedAddress.longitude !== 'number' || typeof parsedAddress.latitude !== 'number') {
                throw new Error('Invalid event_address structure');
            }
        } catch (parseError) {
            console.error(`[${new Date().toISOString()}] Error parsing JSON fields from body:`, parseError);
            return res.status(400).json({ message: 'Invalid format for address, age, or gender restriction string.' });
        }

        // --- 3. Create Event Document in MongoDB ---
        const newEvent = new Event({
            ...validatedBody, // Spread validated fields (includes URLs now)
            event_address: {
                address: parsedAddress.address,
                longitude: parsedAddress.longitude,
                latitude: parsedAddress.latitude,
            },
            age_restriction: parsedAgeRestriction,
            gender_restriction: parsedGenderRestriction,
            created_by: created_by,
            // Overwrite with the explicit URL fields from validatedBody if schema names differ
            event_video: videoURL,    // Ensure your Event model schema field is 'event_video'
            thumbnail: thumbnailURL,  // Ensure your Event model schema field is 'thumbnail'
        });

        console.log(`[${new Date().toISOString()}] Saving event to database for user ${created_by}...`);
        const savedEvent = await newEvent.save();
        console.log(`[${new Date().toISOString()}] Event saved successfully: ${savedEvent._id}`);

        // --- 4. Send Success Response ---
        res.status(201).json({
            message: 'Event created successfully!',
            event: savedEvent,
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in createEventWithUpload:`, error);

        if (error.name === 'ValidationError') {
            res.status(400).json({ message: 'Database validation failed.', details: error.message });
        } else {
            res.status(500).json({ message: 'Internal server error creating event.', details: error.message });
        }
    }
};

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

// --- Export the Controller ---
module.exports = {
    createEventWithUpload,
    generateStorageSignedUrl,
    getEvents,
    bookEvent,
    verifyPaymentCallback,
    getEventById,
    deleteEvent,
}