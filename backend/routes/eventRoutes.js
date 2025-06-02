// backend/routes/eventRoutes.js
const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth'); // Assuming correct path
// const adminMiddleware = require('../middlewares/admin'); // Keep if needed for other routes

// --- Remove Multer for General Routes ---
// 'upload' is no longer needed for the main '/create' route if using client-side uploads.
// const upload = require('../middleware/multerConfig'); // No longer needed here if create is URL-based

// --- Event Routes ---



// --- Updated Create Event Route ---

router.post(
    '/create',
    authMiddleware,      // 1. Ensure the user is authenticated
    eventController.createEventWithUpload // 2. Call the controller that expects URLs
);


// --- Other Routes (Remain Largely Unchanged) ---

// Get all events (public route)
router.get('/viewAll', eventController.getEvents);

// Get a specific event by ID (public route)
router.get('/view/:eventId', eventController.getEventById);

// Book an event (protected route)
router.post('/book/:eventId', authMiddleware, eventController.bookEvent);

// Verify payment (callback route - usually public or uses specific token)
router.get('/payment/verify', eventController.verifyPaymentCallback);

// Get events created/booked by the logged-in user (protected)
router.get('/getUserEvents', authMiddleware, eventController.getUserEvents);

// Get event guests (protected - adjust auth if needed)
router.get('/guests/:eventId', authMiddleware, eventController.getEventGuests);

// Featured events route (public)
router.get('/featured', eventController.getFeaturedEvents);

// Get events by a specific user ID (public or protected depending on requirements)
router.get('/getEventsByUserId/:userId', eventController.getEventsByUserId); // Assuming public profile view

// Delete an event (protected - event creator only)
router.delete('/:eventId', authMiddleware, eventController.deleteEvent);

router.put('/update/:eventId', authMiddleware, eventController.updateEvent);

// --- Admin Routes ---
// Ensure adminMiddleware is correctly implemented if used.
// For getPlatformEarnings, authMiddleware might be enough if it checks for an admin role.
router.get('/admin/earnings', authMiddleware, /* adminMiddleware (if needed), */ eventController.getPlatformEarnings);
// router.delete('/admin/delete-all', authMiddleware, adminMiddleware, eventController.deleteAllEvents); // Uncomment if you have adminMiddleware

module.exports = router;