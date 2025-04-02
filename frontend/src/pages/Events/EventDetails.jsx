import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import moment from "moment";
import NavBar from "../../components/NavBar";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/AuthContext";
import { toast, Toaster } from "sonner";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { FaStar } from "react-icons/fa";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventDetails, setEventDetails] = useState(null);
  const [guests, setGuests] = useState([]);
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [averageRating, setAverageRating] = useState(0);

  const defaultAvatar = "/default-avatar.png"; // Need to add a default avatar

  useEffect(() => {
    // Fetch event details
    axiosInstance
      .get(`/events/view/${id}`)
      .then((res) => {
        setEventDetails(res?.data);
      })
      .catch((error) => {
        console.log(error);
      });

    // Fetch guests attending the event
    axiosInstance
      .get(`/events/guests/${id}`)
      .then((res) => {
        const uniqueGuests = res?.data?.guests.filter(
          (guest, index, self) =>
            index === self.findIndex((g) => g._id === guest._id)
        );
        setGuests(uniqueGuests);
      })
      .catch((error) => {
        console.log("Error fetching guests: ", error);
      });

    // Fetch reviews
    axiosInstance
      .get(`/reviews/${id}`)
      .then((res) => {
        setReviews(res.data);
        // Calculate average rating
        if (res.data.length > 0) {
          const total = res.data.reduce((acc, review) => acc + review.rating, 0);
          setAverageRating(total / res.data.length);
        }
        // Check if user has already reviewed
        if (user) {
          const hasReviewed = res.data.some(review => review.user._id === user._id);
          setUserHasReviewed(hasReviewed);
        }
      })
      .catch((error) => {
        console.log("Error fetching reviews: ", error);
      });
  }, [id, user]);

  const handleBookTicket = async (eventId) => {
    console.log(" array of booked tickets ", eventDetails?.booked_tickets);
    console.log(" current userid ", user?._id);
    console.log(" our check, should be true :- " , eventDetails.booked_tickets.some(ticket => ticket._id === user?._id))
 
    if (user?._id === eventDetails?.created_by?._id) {
      toast.error("You cannot buy/book your own ticket");
    } else if(eventDetails.event_max_capacity - eventDetails.booked_tickets.length === 0) {
      toast.error("Event is fully booked");

    } else if(eventDetails.booked_tickets.some(ticket => ticket._id === user?._id)){
     
        toast.error("You already have a ticket for this event");
        return;
    
    }  else {
      try {
        const res = await axiosInstance.post(`/events/book/${eventId}`);
        if (res?.data?.authorization_url) {
          window.location.href = res.data.authorization_url;
        } else {
          toast.success(res?.data?.message);
          
        }
      } catch (error) {
        console.log(error);
        toast.error(error?.response?.data?.message);
      }
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error("Please login to submit a review");
      return;
    }

    if (!newReview.comment.trim()) {
      toast.error("Please enter a review comment");
      return;
    }

    try {
      const res = await axiosInstance.post(`/reviews/${id}`, {
        rating: newReview.rating,
        comment: newReview.comment
      });

      // Update reviews state with the new review
      const updatedReviews = [res.data, ...reviews];
      setReviews(updatedReviews);
      setNewReview({ rating: 5, comment: "" });
      setUserHasReviewed(true);

      // Calculate new average rating
      const total = updatedReviews.reduce((acc, review) => acc + review.rating, 0);
      setAverageRating(total / updatedReviews.length);

      toast.success("Review submitted successfully");
    } catch (error) {
      console.error("Review submission error:", error);
      toast.error(error?.response?.data?.message || "Error submitting review");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    try {
      await axiosInstance.delete(`/reviews/${reviewId}`);

      // Update reviews state after successful deletion
      const updatedReviews = reviews.filter(review => review._id !== reviewId);
      setReviews(updatedReviews);
      setUserHasReviewed(false);

      // Recalculate average rating
      if (updatedReviews.length > 0) {
        const total = updatedReviews.reduce((acc, review) => acc + review.rating, 0);
        setAverageRating(total / updatedReviews.length);
      } else {
        setAverageRating(0);
      }

      toast.success("Review deleted successfully");
    } catch (error) {
      console.error("Delete review error:", error);
      toast.error(error?.response?.data?.message || "Error deleting review");
    }
  };

    const videoOptions = {
    controls: [
      "play-large",
      "restart",
      "rewind",
      "play",
      "fast-forward",
      "progress",
      "current-time",
      "duration",
      "mute",
      "volume",
      "settings",
      "fullscreen",
    ],
    settings: ["quality", "speed"],
    quality: {
      default: 1080,
      options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240],
    },
  };

  // Use the thumbnail as the poster
  const videoSource = {
    type: "video",
    sources: [
      {
        src: eventDetails?.event_video,
        type: "video/mp4",
      },
    ],
    poster: eventDetails?.thumbnail, //  Add the poster attribute here!
  };

  if (!eventDetails) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Toaster richColors />
      <NavBar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 lg:pt-24 pt-24">
        <div className="w-full lg:bg-white bg-gray-100  p-0">
          <div className="bg-white">
            <div className="flex flex-col lg:flex-col md:flex-row justify-center items-center">
              <div className="w-full">
                <Link
                  to="/events"
                  className="text-sm text-gray-700 hover:text-gray-500 flex items-center"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                  Back
                </Link>
                <h2 className="text-3xl font-bold text-gray-900 mt-4">
                  {eventDetails.event_title}
                </h2>
                <p className="text-sm text-gray-700 mt-2">
                  By {eventDetails.created_by.fullname}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  {eventDetails.event_address.address}
                </p>
              </div>
              <div className="w-full py-4">
                <div className="aspect-w-16 aspect-h-9">
                  <Plyr source={videoSource} options={videoOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Description
            </h2>
            <p className="text-gray-700 mb-4">
              {eventDetails.event_description}
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Event Details
            </h2>
            <p className="text-gray-700 mb-1">
              Date and Time:{" "}
              <span className="font-semibold">
                {moment(eventDetails.event_date_and_time).format("DD MMM YYYY HH:mm")}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Duration:{" "}
              <span className="font-semibold">
              {eventDetails?.event_duration ? `${eventDetails.event_duration} ${eventDetails.event_duration === 1 ? 'hour' : 'hours'}` : 'Not Specified'}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Location:{" "}
              <span className="font-semibold">
                {eventDetails.event_address.address}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Category:{" "}
              <span className="font-semibold">{eventDetails.category}</span>
            </p>
            <p className="text-gray-700 mb-1">
              Maximum Capacity:{" "}
              <span className="font-semibold">
                {eventDetails.event_max_capacity}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Additional Info:{" "}
              <span className="font-semibold">
                {eventDetails.additional_info}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Ticket Price:{" "}
              <span className="font-semibold">
                R{eventDetails.ticket_price}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Age Restriction:{" "}
              <span className="font-semibold">
                {eventDetails.age_restriction ? `${eventDetails.age_restriction}+` : "None"}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
              Gender Restriction:{" "}
              <span className="font-semibold">
                {eventDetails.gender_restriction || "None"}
              </span>
            </p>
            <p className="text-gray-700 mb-1">
                Remaining Tickets:{" "}
                <span className="font-semibold">
                  {eventDetails.event_max_capacity - eventDetails.booked_tickets.length}
                </span>
              </p>
          </div>

          <div className="flex flex-col items-start gap-y-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Organizer Contact
              </h2>
              <div className="flex items-center space-x-2">
                <img
                  src={eventDetails.created_by.profile_picture || defaultAvatar}
                  alt={eventDetails.created_by.fullname}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="font-semibold">{eventDetails.created_by.fullname}</p>
                  <p className="text-gray-600">@{eventDetails.created_by.username}</p>
                </div>
              </div>
              <p className="text-gray-700 mb-1">
                Email:{" "}
                <span className="font-semibold">
                  {eventDetails.created_by.email}
                </span>
              </p>
              <p className="text-gray-700 mb-1">
                Phone:{" "}
                <span className="font-semibold">
                  {eventDetails.created_by.phone_number}
                </span>
              </p>
              <p className="text-gray-700 mb-1">
                Date of Birth:{" "}
                <span className="font-semibold">
                  {moment(eventDetails.created_by.dateOfBirth).format("ll")}
                </span>
              </p>
              
            </div>
            <button
              onClick={() => handleBookTicket(eventDetails._id)}
              className="bg-purple-500 text-white px-4 py-2 rounded lg:block hidden w-full hover:bg-purple-600"
            >
              Book Ticket
            </button>
          </div>
        </div>

        {/* Google Map */}
        <div className="flex flex-col items-start w-full py-6">
          <iframe
            className="w-full rounded-lg h-60 sm:h-96"
            marginHeight="0"
            marginWidth="0"
            src={`https://maps.google.com/maps?q=${eventDetails?.event_address?.latitude},${eventDetails?.event_address?.longitude}&hl=en&z=14&output=embed`}
            allowFullScreen=""
            loading="lazy"
            title="Event Location"
          ></iframe>
        </div>

        {/* Guest List Table */}
        <div className="flex flex-col mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Guests Attending
          </h2>
          {guests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white shadow-md rounded-lg">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">
                      Profile Picture
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">
                      Full Name
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">
                      Gender
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">
                      Phone #
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="px-4 py-2">
                        <img
                          src={guest.profile_picture}
                          alt={guest.fullname}
                          className="h-10 w-10 rounded-full"
                        />
                      </td>
                      <td className="px-4 py-2">{guest.fullname}</td>
                      <td className="px-4 py-2">{guest.email}</td>
                      <td className="px-4 py-2 capitalize">{guest.gender}</td>
                      <td className="px-4 py-2">{guest.phone_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700">No guests have joined yet.</p>
          )}
        </div>

        {/* Reviews Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Reviews</h2>

          {/* Average Rating */}
          <div className="flex items-center mb-4">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar
                  key={star}
                  className={`w-5 h-5 ${
                    star <= averageRating
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="ml-2 text-gray-600">
              {averageRating.toFixed(1)} ({reviews.length} reviews)
            </span>
          </div>

          {/* Add Review Form */}
          {user && !userHasReviewed && moment().isAfter(eventDetails.event_date_and_time) && (
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
              <div className="flex items-center mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar
                    key={star}
                    className={`w-6 h-6 cursor-pointer ${
                      star <= newReview.rating
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }`}
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                  />
                ))}
              </div>
              <textarea
                value={newReview.comment}
                onChange={(e) =>
                  setNewReview({ ...newReview, comment: e.target.value })
                }
                placeholder="Write your review here..."
                className="w-full p-2 border border-gray-300 rounded-md mb-4"
                rows="4"
              />
              <button
                onClick={handleSubmitReview}
                className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
              >
                Submit Review
              </button>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review._id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {review.user.profile_picture ? (
                      <img
                        src={review.user.profile_picture}
                        alt={review.user.fullname}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center mr-3">
                        {review.user.fullname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{review.user.fullname}</p>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FaStar
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? "text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                        <span className="text-sm text-gray-500 ml-2">
                          {moment(review.createdAt).fromNow()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {user && user._id === review.user._id && (
                    <button
                      onClick={() => handleDeleteReview(review._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-2 text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => handleBookTicket(eventDetails._id)}
          className="bg-purple-500 text-white px-4 py-2 rounded lg:hidden block w-full hover:bg-purple-600 mt-6"
        >
          Book Ticket
        </button>
      </div>
      <Footer/>
    </div>
  );
};

export default EventDetails;
