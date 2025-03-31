
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const Event = require('./models/Event');  // Import your Event model
const User = require('./models/User');

// Database connection string (replace with your actual connection string)
const dbUrl = process.env.MONGODB_URI;

// Connect to MongoDB (ONCE, outside of any function)
mongoose.connect(dbUrl)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

exports.create = functions.https.onRequest(async (req, res) => {
  try {
    // Get the user ID from the authenticated request
    const userId = req.user.uid;

    // Get the event data from the request body
    const eventData = req.body;

    // Create a new Event instance
    const newEvent = new Event({
      ...eventData, // All the event data
      created_by: userId, // <-- Link the event to the user!
    });

    // Save the new event to the database
    await newEvent.save();

    // Send a success response
    res.status(201).send({ id: newEvent._id });
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.name === 'ValidationError') {
        // Handle Mongoose validation errors
        const errorMessages = Object.values(error.errors).map(err => err.message);
        res.status(400).send({ error: 'Validation failed', messages: errorMessages });
    } else {
        res.status(500).send({ error: 'Failed to create event' });
    }
  }
});