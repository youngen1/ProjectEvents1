import React, { memo, useEffect, useRef, useState } from "react";
import moment from "moment";
import { IoShareSocialOutline } from "react-icons/io5";

import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useInView } from "react-intersection-observer";

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
        enabled: true,
        fallback: true,
        iosNative: true,
    },
    clickToPlay: true, // This is good, but we're manually triggering play initially
    ratio: "16:9",
    // previewThumbnails: { enabled: false }, // Not needed if we use our own thumbnail logic
    autoplay: false, // We will manually play
};

const EventCard = ({
                       _id,
                       event_title,
                       // ... other props
                       event_video,
                       thumbnail,
                       created_by,
                       category,
                       ticket_price,
                       event_date_and_time,
                       booked_tickets,
                       handleFetchJoinedMembers,
                       handleEventClick,
                       handleShare,
                       event_description,
                       event_address
                   }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { ref: cardRef, inView: isInView } = useInView({ threshold: 0.1, triggerOnce: false }); // Keep observing

    const plyrRef = useRef(null); // Ref for the Plyr component instance
    const [showVideo, setShowVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [isPlyrReady, setIsPlyrReady] = useState(false); // Track if Plyr internal player is ready

    // Effect to play video when showVideo becomes true and Plyr is ready
    useEffect(() => {
        if (showVideo && isInView && plyrRef.current && isPlyrReady) {
            const playerInstance = plyrRef.current?.plyr;
            if (playerInstance) {
                playerInstance.play()
                    .catch(error => console.error("Error attempting to play video:", error));
            } else {
                console.warn("Plyr instance not found when trying to play.");
            }
        }
    }, [showVideo, isInView, isPlyrReady]); // Depend on isPlyrReady

    // Effect to destroy Plyr instance when component unmounts or video is hidden
    useEffect(() => {
        return () => {
            if (plyrRef.current?.plyr) {
                try {
                    plyrRef.current.plyr.destroy();
                    console.log("Plyr instance destroyed for event:", event_title);
                } catch (error) {
                    console.error("Error destroying Plyr instance:", error);
                }
                plyrRef.current = null; // Clear the ref
                setIsPlyrReady(false); // Reset ready state
            }
        };
    }, [event_title]); // Re-run if event_title changes (if card is reused for different event)

    const handlePlayClick = () => {
        if (event_video) {
            setShowVideo(true); // This will trigger the rendering of the Plyr component
            setVideoError(false); // Reset video error state
        } else {
            toast.error("No video available for this event.");
        }
    };

    const handleImageError = () => {
        console.error("Error loading thumbnail image:", thumbnail);
        // Optionally set a flag to show a placeholder if thumbnail fails
    };

    const handleVideoError = (e) => {
        console.error("Plyr video error event:", e);
        setVideoError(true);
        setShowVideo(false); // Hide video player on error, show thumbnail again
        setIsPlyrReady(false); // Reset ready state on error
    };

    // This callback is provided by plyr-react to get the instance
    // It's more reliable than trying to grab it from the ref immediately
    const handlePlayerReady = (player) => {
        // `player` here is the actual Plyr API instance
        if (player) {
            setIsPlyrReady(true);
            // You could store `player` in a ref if you need to access it elsewhere directly,
            // but for simple play/pause, useEffect based on state is often cleaner.
            // For example: internalPlayerRef.current = player;
            console.log("Plyr instance ready for event:", event_title);

            // Optional: Add event listeners directly if needed
            // player.on('error', (event) => handleVideoError(event.detail.plyr.source));
            player.on('ended', () => {
                console.log("Video ended for event:", event_title);
                setShowVideo(false); // Optionally hide player when video ends
                setIsPlyrReady(false);
            });
        }
    };


    return (
        <div className="relative" ref={cardRef}>
            {/* User Profile Avatar */}
            <div
                className="absolute -top-5 -right-2 z-[1000] cursor-pointer"
                onClick={(e) => { /* ... your navigation logic ... */ }}
            >
                {/* ... your avatar JSX ... */}
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">
                <div className="w-full h-[200px] md:h-[250px] lg:h-[300px] overflow-hidden bg-black"> {/* Added bg-black for better video transition */}
                    {!showVideo && (
                        thumbnail ? (
                            <img
                                src={thumbnail}
                                alt={event_title + " Thumbnail"}
                                className="w-full h-full object-cover object-center cursor-pointer"
                                onClick={handlePlayClick}
                                onError={handleImageError}
                                loading="lazy" // Good for performance
                            />
                        ) : (
                            <div
                                className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 cursor-pointer"
                                onClick={handlePlayClick} // Allow click even if no thumbnail
                            >
                                {event_video ? "Play Video" : "No Preview Available"}
                            </div>
                        )
                    )}

                    {showVideo && isInView && event_video && !videoError && (
                        <Plyr
                            ref={plyrRef} // Attach ref
                            source={{
                                type: "video",
                                sources: [{ src: event_video, provider: 'html5', type: "video/mp4" }], // Specify provider
                            }}
                            options={videoOptions}
                            onReady={handlePlayerReady} // Use the onReady callback
                            onError={(error) => handleVideoError(error)} // Plyr's own error event
                        />
                    )}

                    {videoError && (
                        <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-red-500 p-4 text-center">
                            <p>Video could not be loaded.</p>
                            <button
                                onClick={() => {
                                    setVideoError(false);
                                    setShowVideo(false); // Go back to thumbnail
                                }}
                                className="mt-2 px-3 py-1 bg-purple-500 text-white rounded text-sm"
                            >
                                Show Thumbnail
                            </button>
                        </div>
                    )}
                </div>

                {/* Event Details */}
                <div
                    onClick={() => handleEventClick(_id)}
                    className="p-4 cursor-pointer"
                >
                    {/* ... your event details JSX ... */}
                </div>

                {/* Booked Users & Share */}
                <div className="p-4 border-t border-gray-200">
                    {/* ... your booked users & share JSX ... */}
                </div>
            </div>
        </div>
    );
};

export default memo(EventCard);