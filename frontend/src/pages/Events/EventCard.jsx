import React, { memo, useEffect, useRef, useState } from "react";
import { IoShareSocialOutline } from "react-icons/io5";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom"; // Make sure useNavigate is imported
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
                       booked_tickets,
                   }) => {
    const navigate = useNavigate(); // Initialize useNavigate
    const { user } = useAuth();

    const { ref: cardVisibilityRef, inView: isInView } = useInView({
        threshold: 0.1,
        triggerOnce: false,
    });
    const plyrInstanceRef = useRef(null);

    const [showVideo, setShowVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);

    // ... (useEffect hooks and handlers remain largely the same)
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

    const handleAvatarClick = (e) => {
        e.stopPropagation(); // Prevent triggering handleEventClick on the card below
        if (created_by && created_by._id) {
            console.log(`Navigating to profile: /profile/${created_by._id}`);
            navigate(`/profile/${created_by._id}`); // Or your specific profile route
        } else if (created_by && created_by.username) {
            // Fallback or alternative if ID is not primary identifier for profile route
            console.log(`Navigating to profile: /profile/${created_by.username}`);
            navigate(`/profile/${created_by.username}`);
        } else {
            console.warn("Cannot navigate to profile: created_by._id or created_by.username is missing.");
        }
    };


    return (
        <div className="mb-8" ref={cardVisibilityRef}> {/* Added mb-8 for spacing if avatars overlap next card, adjust as needed */}
            {/* New Relative Wrapper for Card and Avatar */}
            <div className="relative">
                {/* User Profile Avatar - Positioned absolutely relative to the new wrapper */}
                {created_by && (
                    <div
                        onClick={handleAvatarClick}
                        className="absolute top-0 right-0 z-20 cursor-pointer
                                   transform translate-x-1/3 -translate-y-1/3  /* Adjust these for precise 'outside' positioning */
                                   hover:scale-110 transition-transform"
                        title={`View ${created_by.username || 'creator'}'s profile`}
                    >
                        {created_by.profile_picture ? (
                            <img
                                src={created_by.profile_picture}
                                alt={`${created_by.username || 'Creator'}'s profile`}
                                className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-lg"
                            />
                        ) : (
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xl font-semibold border-2 border-white shadow-lg">
                                {created_by.username ? created_by.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                        )}
                    </div>
                )}

                {/* Event Card Content Box */}
                {/* Added z-10 so it's below the avatar if they were to perfectly overlap */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden transition-transform transform hover:scale-105 z-10">
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

                    <div onClick={() => handleEventClick(_id)} className="p-4 cursor-pointer">
                        <h3 className="text-lg font-semibold text-gray-800">{event_title}</h3>
                        <p className="text-sm text-gray-600 truncate">{event_description}</p>
                    </div>

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
        </div>
    );
};

export default memo(EventCard);