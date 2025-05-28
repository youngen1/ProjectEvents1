// backend/routes/eventRoutes.js
const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth'); // Assuming correct path
// const adminMiddleware = require('../middlewares/admin'); // Not used in provided routes, keep if needed elsewhere



// --- Import the configured multer instance ---
const upload = require('../middleware/multerConfig'); // Adjust path as needed

// --- Event Routes ---

// --- MODIFIED ROUTE for Creating Event ---
// This route now handles multipart/form-data with video and thumbnail files
router.post(
    // '/create-with-upload', // You can use a new path like this OR replace '/create'
    '/create', // Replacing the old '/create' path
    authMiddleware,      // 1. Check authentication
    upload.fields([      // 2. Use multer to process specific file fields
        { name: 'event_video', maxCount: 1 },
        { name: 'thumbnail_file', maxCount: 1 } // Accept optional thumbnail
    ]),
    eventController.createEventWithUpload // 3. Call the NEW controller function
);


// --- Other Routes (Keep as they were unless they need file handling) ---

// Get all events (public route)
router.get('/viewAll', eventController.getEvents);

// Get a specific event by ID (public route)
router.get('/view/:eventId', eventController.getEventById);

// Book an event (protected route)
router.post('/book/:eventId', authMiddleware, eventController.bookEvent);

// Verify payment (callback route - usually public or uses specific token, not standard user auth)
router.get('/payment/verify', eventController.verifyPaymentCallback); // Added based on controller

// Get events created/booked by the logged-in user (protected)
router.get('/getUserEvents', authMiddleware, eventController.getUserEvents);

// Get event guests (protected - adjust auth if needed)
router.get('/guests/:eventId', authMiddleware, eventController.getEventGuests);

// Featured events route (public)
router.get('/featured', eventController.getFeaturedEvents);

// Get events by a specific user ID (public or protected depending on requirements)
// If public profile, remove authMiddleware. If only for logged-in users, keep it.
router.get('/getEventsByUserId/:userId', eventController.getEventsByUserId); // Removed auth for public profile view?

// Delete an event (protected - event creator only)
router.delete('/:eventId', authMiddleware, eventController.deleteEvent);

// Update an event (protected - event creator only)
// ** NOTE: This route still uses eventController.updateEvent and does NOT handle file uploads.**
// If you need to update video/thumbnail, this route needs multer middleware too.
router.put('/update/:eventId', authMiddleware, eventController.updateEvent);

// --- Admin Routes 
router.get('/admin/earnings', authMiddleware,  eventController.getPlatformEarnings);
// router.delete('/admin/delete-all', authMiddleware, adminMiddleware, eventController.deleteAllEvents);


module.exports = router;
