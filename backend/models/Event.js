const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    event_title: { type: String, required: true },
    event_video: {
      type: String,
      required: function () {
        return this.isNew;
      }, // Required only on creation
    },
    thumbnail: { type: String },
    event_images: [String],
    category: {
      type: String,
      required: true,
      enum: [
        "Recreational",
        "Religious",
        "Sports",
        "Cultural",
        "Concert",
        "Conference",
        "Workshop",
        "Meetup",
        "Party",
      ],
    },
    event_date_and_time: { type: Date, required: true },
    event_duration: { type: Number, required: true, min: 0.5, default: 1 }, // Default to 1 hour
    event_address: {
      address: { type: String, required: true },
      longitude: { type: Number, required: true },
      latitude: { type: Number, required: true },
    },
    additional_info: { type: String },
    ticket_price: { type: Number, required: true },
    event_description: { type: String, required: true },
    event_max_capacity: { type: Number, required: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    booked_tickets: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] },
    ],
    age_restriction: {
      type: [String],
      default: [],
    },
    gender_restriction: {
      type: [String],
      default: [],
    },
    ticketsSold: {type: Number, default: 0}
  },
  { timestamps: true }
);

eventSchema.index({ event_date_and_time: 1 }); 
eventSchema.index({ created_by: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ event_date_and_time: 1, category: 1});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;