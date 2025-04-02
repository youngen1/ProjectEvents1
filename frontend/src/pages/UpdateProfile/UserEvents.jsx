import React from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import moment from "moment";
import { IoShareSocialOutline } from "react-icons/io5";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";


const UserEvents = ({ events, isOwnProfile, onDeleteEvent }) => {
  const navigate = useNavigate();
  const videoOptions = {
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "mute",
      "volume",
      "fullscreen",
    ],
  };

  const handleShare = (event) => {
    const shareData = {
      title: event.event_title,
      text: event.event_description,
      url: window.location.origin + `/single-event/${event?._id}`,
    };

    if (navigator.share) {
      navigator
        .share(shareData)
        .then(() => console.log("Event shared successfully"))
        .catch((error) => console.error("Error sharing event", error));
    } else {
      alert("Sharing is not supported on this browser.");
    }
  };
    const handleEditClick = (eventId) => {
    navigate(`/events/edit/${eventId}`); // Corrected navigation path
  };

  const EventCard = ({ event }) => (
<div key={event._id} className="relative">
      <div
        className="absolute -top-5 -right-2 z-[1000] cursor-pointer"
        onClick={(e) => {
            e.stopPropagation();
            navigate(`/user-profile/${event?.created_by?._id}`)
        }}
      >
        {event?.created_by?.profile_picture ? (
          <img
            src={event?.created_by?.profile_picture}
            alt="profile"
            className="w-12 h-12 rounded-full bg-gray-100 object-cover object-center"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
            {event?.created_by?.fullname?.charAt(0)?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">
        <div className="aspect-w-16 aspect-h-9">
          {event?.event_video && (
            <Plyr
              source={{
                type: "video",
                sources: [{ src: event.event_video, type: "video/mp4" }],
              }}
              options={videoOptions}
            />
          )}
        </div>
        <div
          onClick={() => navigate(`/single-event/${event?._id}`)}
          className="p-4 cursor-pointer"
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className={`text-sm ${
                event.ticket_price === 0 ? "bg-green-500" : "bg-purple-500"
              } text-white px-2 py-1 rounded font-semibold`}
            >
              {event.ticket_price === 0 ? "Free" : `R${event.ticket_price}`}
            </span>
            <span className="text-purple-700 bg-purple-100 px-2 py-1 rounded-full text-sm font-semibold">
              {event.category}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {moment(event.event_date_and_time).format("lll")}
            </p>
            <h3 className="text-lg font-semibold text-gray-900 mt-1">
              {event.event_title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {event?.event_address?.address}
            </p>
            <p className="text-sm text-gray-500 mt-2">{event.event_description}</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-x-3">
              {event.booked_tickets && event.booked_tickets.length > 0 ? (
                <div className="flex -space-x-1 overflow-hidden">
                  {event.booked_tickets
                    ?.filter(
                      (user, index, self) =>
                        index === self.findIndex((u) => u._id === user._id)
                    )
                    ?.slice(0, 3)
                    ?.map((user, index) => (
                      <Link to={`/user-profile/${user?._id}`} key={index}>
                        <img
                          alt={user.fullname}
                          src={user.profile_picture}
                          className="inline-block h-6 w-6 object-center object-cover rounded-full ring-2 ring-white"
                        />
                      </Link>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No one has joined yet</p>
              )}
              <p className="text-sm text-gray-500">
                {event.booked_tickets && event.booked_tickets.length > 0
                  ? "Members Joined"
                  : ""}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare(event);
              }}
              className="bg-purple-500 text-white px-4 flex items-center gap-x-2 py-1.5 rounded-md font-medium hover:bg-purple-600"
            >
              <IoShareSocialOutline />
            </button>
          </div>
        </div>
      
        {isOwnProfile && (
          <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
             <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(event._id);
              }}
              className="text-blue-500 hover:text-blue-700"
              title="Edit Event"
            >
              <FaEdit size={20} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEvent(event._id);
              }}
              className="text-red-500 hover:text-red-700"
              title="Delete Event"
            >
              <FaTrash size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const createdEvents = events?.createdEvents || [];
  const bookedEvents = events?.bookedEvents || [];

  return (
    <div>
      <h2 className="text-base font-semibold leading-7 text-gray-900">Events</h2>
      
      {/* Show created events */}
      <div className="mt-6">
        <h3 className="text-lg font-medium">Created Events</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {createdEvents.length > 0 ? (
            createdEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))
          ) : (
            <p className="text-gray-500">No created events</p>
          )}
        </div>
      </div>

      {/* Show booked events */}
      <div className="mt-6">
        <h3 className="text-lg font-medium">Booked Events</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookedEvents.length > 0 ? (
            bookedEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))
          ) : (
            <p className="text-gray-500">No booked events</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserEvents;
