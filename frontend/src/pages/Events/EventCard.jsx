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
        enabled: true,
        fallback: true,
        iosNative: true,
    },
    clickToPlay: false,
    ratio: "16:9",
    autoplay: false
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

    const { ref: cardVisibilityRef, inView: isInView } = useInView({ threshold: 0.1, triggerOnce: false }); // Detect when in view (reduced threshold)
    const plyrApiInstanceRef = useRef(null);
    const playerRef = useRef(null);
    const [player, setPlayer] = useState(null);
    const [showVideo, setShowVideo] = useState(false); // State to control video display
    const [videoError, setVideoError] = useState(false);
    const [isPlyrComponentActive, setIsPlyrComponentActive] = useState(false)

    // Initialize player when video is shown and in view
    useEffect(() => {
        // Only initialize player when video is shown and in view
        if (showVideo && isInView && event_video && !videoError) {

            if(!isPlyrComponentActive){
                console.log(`[${event_title}] Mounting Plyr component.`);
                setIsPlyrComponentActive(true);
            } else{
                if (isPlyrComponentActive){
                    console.log(`[${event_title}] Unmounting Plyr component`)
                    setIsPlyrComponentActive(false);
                }
            }
            if (plyrApiInstanceRef.current){
                console.log(`[${event_title}] Destroying Plyr API instance (due to showVideo/isInView/videoError change)`);
                try{
                    plyrApiInstanceRef.current._destroy();

                } catch (e) {
                    console.error(`[${event_title}] Error during explicit Plyr API destroy:`, e)
                }
                plyrApiInstanceRef.current = null;
            }
        }

        // Cleanup function to destroy player when component unmounts
        return () => {
            if (plyrApiInstanceRef.current) {
                console.log(`[${event_title}] Destroying Plyr API instance on EventCard unmount`);
                try {
                    plyrApiInstanceRef.current.destroy();
                } catch (e) {
                    console.error(`[${event_title}] Error during unmount Plyr API destroy:`, e);
                }
                 plyrApiInstanceRef.current = null;
            }
        };
    },  [showVideo, isInView, event_video, videoError, event_title, isPlyrComponentActive]);

    useEffect(() => {
        if (isPlyrComponentActive && showVideo && isInView && plyrApiInstanceRef.current && !videoError) {
            console.log(`[${event_title}] API instance ready, attempting to play.`);
            plyrApiInstanceRef.current.play()
                .catch(error => console.error(`[${event_title}] Error attempting to play video:`, error));
        }
    }, [isPlyrComponentActive, showVideo, isInView, videoError, event_title]);
    
    const handlePlayerReady = (player) => { // 'player' IS the Plyr API instance
        if (player) {
            console.log(`[${event_title}] Plyr onReady called, API instance received.`);
            plyrApiInstanceRef.current = player; // Store the API instance

            player.on('ended', () => {
                console.log(`[${event_title}] Video ended.`);
                setShowVideo(false); // Will trigger the lifecycle useEffect to destroy player
            });

            player.on('error', (event) => {
                console.error(`[${event_title}] Plyr API instance 'error' event:`, event.detail?.plyr?.source, event);
                setVideoError(true); // Will trigger the lifecycle useEffect
            });
        }
    }
    
    const handlePlayClick = () => {
        if (event_video) {
            console.log(`[${event_title}] Thumbnail clicked, setting showVideo=true.`);
            setShowVideo(true);
            setVideoError(false); // Reset error state on new play attempt
        } else {
            toast.error("No video available for this event.");
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
        <div className="relative" ref={cardVisibilityRef}>
            {/* User Profile Avatar */}
            <div className="avatar-wrapper">
                {created_by?.profile_picture ? (
                    <img src={created_by.profile_picture} alt="Profile" className="avatar" />
                ) : (
                    <div className="avatar-initial"></div>
                )}
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">
                <div className="w-full h-[200px] md:h-[250px] lg:h-[300px] overflow-hidden bg-black">
                    {(!showVideo || videoError) && ( // Show thumbnail if not showing video OR if there's a video error
                        thumbnail ? (
                            <img
                                src={thumbnail}
                                alt={event_title + " Thumbnail"}
                                className="w-full h-full object-cover object-center cursor-pointer"
                                onClick={handlePlayClick}
                                onError={handleImageError}
                                loading="lazy"
                            />
                        ) : (
                            <div
                                className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 cursor-pointer"
                                onClick={handlePlayClick}
                            >
                                {event_video ? "Play Video" : "No Preview Available"}
                            </div>
                        )
                    )}

                    {isPlyrComponentActive && !videoError && event_video && (
                        <Plyr
                            key={event_video} // Important for re-initialization if video source changes
                            source={{
                                type: "video",
                                sources: [{ src: event_video, provider: 'html5', type: "video/mp4" }],
                            }}
                            options={{ ...videoOptions }} // Spread options, ensure autoplay is false here if controlled by effect
                            onReady={handlePlayerReady}
                            onError={(error) => { // This is for plyr-react component wrapper errors
                                console.error(`[${event_title}] Plyr Component onError Prop:`, error);
                                setVideoError(true);
                            }}
                        />
                    )}

                    {videoError && showVideo && ( // Message if we tried to show video but failed
                        <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-red-500 p-4 text-center">
                            <p>Video could not be loaded.</p>
                        </div>
                    )}
                </div>

                {/* Event Details */}
                <div onClick={() => handleEventClick(_id)} className="p-4 cursor-pointer">
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