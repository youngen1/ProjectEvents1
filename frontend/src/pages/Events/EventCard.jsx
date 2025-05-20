import React, { memo, useEffect, useRef, useState } from "react";
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
    clickToPlay: false,
    ratio: "16:9",
    autoplay: false,
};

const EventCard = ({
                       _id,
                       event_title,
                       event_description,
                       created_by,
                       event_video,
                       thumbnail,
                       // ... other props
                       handleFetchJoinedMembers,
                       handleEventClick,
                       handleShare,
                       booked_tickets, // Added for completeness from your example
                   }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { ref: cardVisibilityRef, inView: isInView } = useInView({
        threshold: 0.1,
        triggerOnce: false,
    });
    const plyrInstanceRef = useRef(null);

    const [showVideo, setShowVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);

    useEffect(() => {
        const player = plyrInstanceRef.current;
        if (player && showVideo && !videoError) {
            if (isInView) {
                if (player.paused) {
                    player.play().catch(error => {
                        if (error.name === 'NotAllowedError') {
                            console.warn(`[${event_title}] Autoplay was prevented.`);
                        } else {
                            console.error(`[${event_title}] Error attempting to play video:`, error);
                        }
                    });
                }
            } else {
                if (!player.paused && player.playing) {
                    player.pause();
                }
            }
        }
    }, [isInView, showVideo, videoError, event_title]);

    useEffect(() => {
        return () => {
            if (plyrInstanceRef.current) {
                try {
                    plyrInstanceRef.current.destroy();
                } catch (e) {
                    console.error(`[${event_title}] Error during unmount Plyr destroy:`, e);
                }
                plyrInstanceRef.current = null;
            }
        };
    }, [event_title]);

    const handlePlayerReady = (player) => {
        if (player) {
            plyrInstanceRef.current = player;
            player.on('ended', () => {
                setShowVideo(false);
            });
            player.on('error', (event) => {
                console.error(`[${event_title}] Plyr API instance 'error' event:`, event);
                setVideoError(true);
                setShowVideo(false);
            });
            if (showVideo && isInView && !videoError) {
                player.play().catch(error => {
                    if (error.name === 'NotAllowedError') {
                        console.warn(`[${event_title}] Initial autoplay onReady was prevented.`);
                    } else {
                        console.error(`[${event_title}] Error attempting initial play onReady:`, error);
                    }
                });
            }
        }
    };

    const handlePlayClick = () => {
        if (event_video) {
            if (plyrInstanceRef.current) {
                try {
                    plyrInstanceRef.current.destroy();
                } catch (e) {
                    console.error(`[${event_title}] Error destroying old instance:`, e);
                }
                plyrInstanceRef.current = null;
            }
            setShowVideo(true);
            setVideoError(false);
        } else {
            toast.error("No video available for this event.");
        }
    };

    const handleImageError = () => {
        console.error(`Error loading thumbnail for ${event_title}:`, thumbnail);
    };

    const handlePlyrComponentError = (error) => {
        console.error(`[${event_title}] Plyr Component onError Prop:`, error);
        setVideoError(true);
        setShowVideo(false);
    };

    const shouldRenderPlyr = showVideo && !videoError && event_video;

    return (
        // Main container for card + intersection observer
        <div className="relative" ref={cardVisibilityRef}> {/* This outer relative might not be needed unless you position something else against it */}
            {/* Event Card Content Box - THIS IS THE NEW PARENT FOR THE AVATAR */}
            <div className="relative bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">
                {/* User Profile Avatar - MOVED INSIDE and STYLED */}
                <div className="absolute top-2 right-2 z-10"> {/* Adjust top/right for precise positioning */}
                    {created_by?.profile_picture ? (
                        <img
                            src={created_by.profile_picture}
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" // Adjusted size and added border
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-lg font-semibold border-2 border-white shadow-sm">
                            {/* Display initials or a placeholder icon if no picture */}
                            {created_by?.username ? created_by.username.charAt(0).toUpperCase() : 'U'}
                        </div>
                    )}
                </div>

                {/* Video/Thumbnail Area */}
                <div className="w-full h-[200px] md:h-[250px] lg:h-[300px] overflow-hidden bg-black">
                    {!shouldRenderPlyr && (
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

                    {shouldRenderPlyr && (
                        <Plyr
                            key={event_video}
                            source={{
                                type: "video",
                                sources: [{ src: event_video, provider: 'html5', type: "video/mp4" }],
                            }}
                            options={{ ...videoOptions }}
                            onReady={handlePlayerReady}
                            onError={handlePlyrComponentError}
                        />
                    )}

                    {videoError && showVideo && !shouldRenderPlyr && (
                        <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-red-500 p-4 text-center">
                            <p>Video for "{event_title}" could not be loaded.</p>
                        </div>
                    )}
                </div>

                {/* Event Details */}
                <div onClick={() => handleEventClick(_id)} className="p-4 cursor-pointer">
                    <h3 className="text-lg font-semibold text-gray-800">{event_title}</h3>
                    <p className="text-sm text-gray-600 truncate">{event_description}</p>
                </div>

                {/* Booked Users & Share */}
                <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                    <button
                        onClick={() => handleFetchJoinedMembers && handleFetchJoinedMembers(_id)}
                        className="text-xs text-blue-500 hover:underline"
                    >
                        {booked_tickets?.length || 0} Joined
                    </button>
                    <IoShareSocialOutline
                        className="text-xl text-gray-500 hover:text-blue-500 cursor-pointer"
                        onClick={() => handleShare && handleShare(_id, event_title)}
                    />
                </div>
            </div>
        </div>
    );
};

export default memo(EventCard);