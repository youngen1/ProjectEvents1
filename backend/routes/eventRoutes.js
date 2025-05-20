// backend/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin'); // Import admin for the check

const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/multerConfig');

// --- Event Routes ---

router.post(
    '/create',
    authMiddleware,
    upload.fields([
        { name: 'event_video', maxCount: 1 },
        { name: 'thumbnail_file', maxCount: 1 }
    ]),
    // Middleware to check Firebase initialization before controller
    (req, res, next) => {
        console.log('--- ENTERING /api/events/create Pre-Controller Check ---');
        console.log('Global Firebase Initialized Flag:', global.firebaseAdminInitialized);
        console.log('Firebase Admin Apps Length:', admin.apps.length);

        if (global.firebaseAdminInitialized !== true || !admin.apps.length) {
            console.error('CRITICAL PRE-STORAGE CHECK: Firebase Admin SDK not properly initialized.');
            return res.status(500).json({
                message: "Server configuration error: Firebase service initialization incomplete or failed.",
                details: {
                    globalFlag: global.firebaseAdminInitialized,
                    appsLength: admin.apps.length
                }
            });
        }

        // Try to access storage bucket to be absolutely sure
        try {
            const bucketName = admin.storage().bucket().name;
            console.log('Firebase Storage bucket check successful in route. Bucket name:', bucketName);
            next(); // Proceed to eventController.createEventWithUpload
        } catch (storageAccessError) {
            console.error('CRITICAL PRE-STORAGE CHECK: Failed to access Firebase Storage bucket in route.', storageAccessError.message);
            return res.status(500).json({
                message: "Server configuration error: Cannot access Firebase Storage bucket.",
                errorDetails: storageAccessError.message
            });
        }
    },
    eventController.createEventWithUpload
);

// Get all events (public route)
router.get('/viewAll', eventController.getEvents);
// Get a specific event by ID (public route)
router.get('/view/:eventId', eventController.getEventById);
// Book an event (protected route)
router.post('/book/:eventId', authMiddleware, eventController.bookEvent);
// Verify payment (callback route)
router.get('/payment/verify', eventController.verifyPaymentCallback);
// Get events created/booked by the logged-in user (protected)
router.get('/getUserEvents', authMiddleware, eventController.getUserEvents);
// Get event guests (protected)
router.get('/guests/:eventId', authMiddleware, eventController.getEventGuests);
// Featured events route (public)
router.get('/featured', eventController.getFeaturedEvents);
// Get events by a specific user ID
router.get('/getEventsByUserId/:userId', eventController.getEventsByUserId);
// Delete an event (protected)
router.delete('/:eventId', authMiddleware, eventController.deleteEvent);
// Update an event (protected - no file uploads here yet)
router.put('/update/:eventId', authMiddleware, eventController.updateEvent);
// Admin Routes
router.get('/admin/earnings', authMiddleware, eventController.getPlatformEarnings);

module.exports = router;