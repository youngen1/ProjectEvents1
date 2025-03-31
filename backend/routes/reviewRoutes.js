const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const authMiddleware = require("../middleware/auth");

// Add a review
router.post("/:eventId", authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const eventId = req.params.eventId;
    const userId = req.user.id;

    // Check if user has already reviewed this event
    const existingReview = await Review.findOne({ user: userId, event: eventId });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this event" });
    }

    const review = await Review.create({
      rating,
      comment,
      user: userId,
      event: eventId,
    });

    const populatedReview = await Review.findById(review._id).populate("user", "fullname profile_picture");
    res.status(201).json(populatedReview);
  } catch (error) {
    console.error("Review creation error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get all reviews for an event
router.get("/:eventId", async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const reviews = await Review.find({ event: eventId })
      .populate("user", "fullname profile_picture")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a review
router.put("/:reviewId", authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this review" });
    }

    review.rating = rating;
    review.comment = comment;
    await review.save();
    
    const populatedReview = await Review.findById(review._id).populate("user", "fullname profile_picture");
    res.json(populatedReview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a review
router.delete("/:reviewId", authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    await Review.findByIdAndDelete(req.params.reviewId);
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 