import React, { memo, useEffect, useRef, useState } from "react";
import moment from "moment";
import { IoShareSocialOutline } from "react-icons/io5";

import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useInView } from "react-intersection-observer"; // Import hook

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
    fullscreen: {
        enabled: false,
        fallback: true,
        iosNative: true,
    },
    clickToPlay: true,
    ratio: "16:9",
    previewThumbnails: { enabled: false }, 
};

const EventCard = ({
    _id,
    event_title,
    event_description,
    created_by,
    event_video,
    thumbnail,
    category,
    ticket_price,
    event_date_and_time,
    event_duration,
    event_address,
    booked_tickets,
    handleFetchJoinedMembers,
    handleEventClick,
    handleShare,
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { ref: videoRef, inView: isInView } = useInView({ threshold: 0.1 }); // Detect when in view (reduced threshold)

    const playerRef = useRef(null);
    const [player, setPlayer] = useState(null);
    const [showVideo, setShowVideo] = useState(false); // State to control video display
    const [videoError, setVideoError] = useState(false);


    useEffect(() => {
        if (isInView && playerRef.current && !player) {
            setPlayer(playerRef.current.plyr);
        }

        return () => {
            if (player) {
                player.destroy(); // Destroy on unmount or when out of view
                setPlayer(null); // Clear player instance
            }
        };
    }, [isInView, player]);


    const handlePlayClick = () => {
        if (player) {
          setShowVideo(true); // Show the video player
            player.play();    // Autoplay
        } else {
          console.error("Plyr instance not available."); //Handle cases where player isn't ready.
        }

    };

    const handleImageError = () => {
        console.error("Error loading image:", thumbnail);
    };

    const handleVideoError = (e) => {
      console.error("Error playing video:", e);
      setVideoError(true);
      setShowVideo(false); // Hide video player on error, show thumbnail instead
    }

    return (
        <div className="relative" ref={videoRef}>
            <div
                className="absolute -top-5 -right-2 z-[1000] cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    if (user) {
                        navigate(`/user-profile/${created_by?._id}`);
                    } else {
                        toast.error("Please login to view user profile");
                        navigate("/login");
                    }
                }}
            >
                {created_by?.profile_picture ? (
                    <img
                        src={created_by?.profile_picture}
                        alt="profile"
                        loading="lazy"
                        className="w-12 h-12 rounded-full bg-gray-100 object-cover object-center"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
                        {created_by?.fullname?.charAt(0)?.toUpperCase()}
                    </div>
                )}
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">

              <div className="w-full h-[200px] md:h-[250px] lg:h-[300px] overflow-hidden">
                    {/* Show Thumbnail Initially */}
                    {!showVideo && thumbnail && (
                        <img
                            src={thumbnail}
                            alt={event_title + " Thumbnail"}
                            className="w-full h-full object-cover object-center cursor-pointer"
                            onClick={handlePlayClick}
                            onError={handleImageError}
                        />
                    )}

                   {!showVideo && !thumbnail && (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                          No Thumbnail
                        </div>
                   )}

                    {/* Show Video Player on Click (and if in view) */}
                    {showVideo && isInView && (
                        <Plyr
                            ref={playerRef}
                            source={{
                                type: "video",
                                sources: [{ src: event_video, type: "video/mp4" }],
                            }}
                            options={videoOptions}
                            onError={handleVideoError} // Handle video errors
                        />
                    )}
                    {videoError && (<div className="w-full h-full bg-red-200 flex items-center justify-center text-red-500">Error Loading Video.</div>)}
                </div>

                <div
                    onClick={() => handleEventClick(_id)}
                    className="p-4 cursor-pointer"
                >
                    <div className="flex justify-between items-center mb-2">
                        <span
                            className={`text-sm ${ticket_price === 0 ? "bg-green-500" : "bg-purple-500"
                                } text-white px-2 py-1 rounded font-semibold`}
                        >
                            {ticket_price === 0 ? "Free" : `R${ticket_price}`}
                        </span>
                        <span className="text-purple-700 bg-purple-100 px-2 py-1 rounded-full text-sm font-semibold">
                            {category}
                        </span>
                    </div>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            {moment(event_date_and_time).format("DD MMM YYYY HH:mm")}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900 mt-1">
                            {event_title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {event_address?.address}
                        </p>
                        <p className="text-sm text-gray-500 mt-2 line-clamp-3">{event_description}</p>
                    </div>
                </div>

                {/* Show Booked Users or No Attendees Message */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-x-3">
                            {booked_tickets && booked_tickets.length > 0 ? (
                                <div
                                    className="flex -space-x-1 overflow-hidden cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (user) {
                                            handleFetchJoinedMembers(_id);
                                        } else {
                                            toast.error("Please login to view members");
                                            navigate("/login");
                                        }
                                    }}
                                >
                                    {booked_tickets
                                        ?.filter(
                                            (user, index, self) =>
                                                index === self.findIndex((u) => u._id === user._id)
                                        )
                                        ?.slice(0, 3)
                                        ?.map((user, index) => (
                                            <div key={index}>
                                                <img
                                                    alt={user.fullname}
                                                    src={user.profile_picture}
													loading="lazy"
                                                    className="inline-block h-6 w-6 object-center object-cover rounded-full "
                                                />
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No one has joined yet</p>
                            )}
                            <p className="text-sm text-gray-500">
                                {booked_tickets && booked_tickets.length > 0
                                    ? `${booked_tickets.length} Members Joined`
                                    : ""}
                            </p>
                        </div>
                        {/* Share Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleShare(event_title, event_description, _id);
                            }}
                            className="bg-purple-500 text-white px-4 flex items-center gap-x-2 py-1.5 rounded-md font-medium hover:bg-purple-600"
                        >
                            <IoShareSocialOutline />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(EventCard);
