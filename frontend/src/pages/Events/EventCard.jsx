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
    clickToPlay: false, // We handle click on thumbnail
    ratio: "16:9",
    autoplay: false, // We control play logic
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

    const { ref: cardVisibilityRef, inView: isInView } = useInView({
        threshold: 0.1,
        triggerOnce: false,
    });
    const plyrInstanceRef = useRef(null); // Stores the Plyr API instance

    const [showVideo, setShowVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);

    // Effect to play/pause video based on visibility and showVideo state
    useEffect(() => {
        const player = plyrInstanceRef.current;

        if (player && showVideo && !videoError) {
            if (isInView) {
                if (player.paused) { // Only play if paused
                    console.log(`[${event_title}] In view and paused, attempting to play.`);
                    player.play().catch(error => {
                        if (error.name === 'NotAllowedError') {
                            console.warn(`[${event_title}] Autoplay was prevented for ${event_title}.`);
                        } else {
                            console.error(`[${event_title}] Error attempting to play video for ${event_title}:`, error);
                        }
                    });
                }
            } else {
                if (!player.paused && player.playing) { // Only pause if playing
                    console.log(`[${event_title}] Out of view and playing, pausing ${event_title}.`);
                    player.pause();
                }
            }
        }
    }, [isInView, showVideo, videoError, event_title]);


    // Cleanup Plyr instance when EventCard unmounts
    useEffect(() => {
        // This effect runs once on mount and its cleanup runs once on unmount.
        return () => {
            if (plyrInstanceRef.current) {
                console.log(`[${event_title}] EventCard unmounting, destroying Plyr instance for ${event_title}.`);
                try {
                    plyrInstanceRef.current.destroy();
                } catch (e) {
                    console.error(`[${event_title}] Error during EventCard unmount Plyr destroy for ${event_title}:`, e);
                }
                plyrInstanceRef.current = null;
            }
        };
    }, [event_title]); // Add event_title to re-run cleanup if it changes, or use [] for pure mount/unmount

    const handlePlayerReady = (player) => {
        if (player) {
            console.log(`[${event_title}] Plyr onReady for ${event_title}.`);
            plyrInstanceRef.current = player;

            player.on('ended', () => {
                console.log(`[${event_title}] Video ended for ${event_title}.`);
                setShowVideo(false); // This will unmount <Plyr />
            });

            player.on('error', (event) => {
                console.error(`[${event_title}] Plyr API instance 'error' event for ${event_title}:`, event.detail?.plyr?.source, event);
                setVideoError(true);
                setShowVideo(false); // Hide player on error
            });

            // Attempt initial play if conditions met (card is visible, user clicked play)
            if (showVideo && isInView && !videoError) {
                console.log(`[${event_title}] Player ready and conditions met, attempting initial play for ${event_title}.`);
                player.play().catch(error => {
                    if (error.name === 'NotAllowedError') {
                        console.warn(`[${event_title}] Initial autoplay onReady was prevented for ${event_title}.`);
                    } else {
                        console.error(`[${event_title}] Error attempting initial play onReady for ${event_title}:`, error);
                    }
                });
            }
        } else {
            console.warn(`[${event_title}] Plyr onReady called with null player for ${event_title}.`);
        }
    };

    const handlePlayClick = () => {
        if (event_video) {
            console.log(`[${event_title}] Thumbnail clicked for ${event_title}, setting showVideo=true.`);
            // If a previous player instance exists and is somehow active, ensure it's cleaned up before creating a new one.
            // This is less likely with the current setup as showVideo=false should unmount it.
            if (plyrInstanceRef.current) {
                try {
                    console.log(`[${event_title}] Destroying existing Plyr instance before new play attempt.`);
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
        console.error(`[${event_title}] Plyr Component onError Prop for ${event_title}:`, error);
        setVideoError(true);
        setShowVideo(false);
    };

    const shouldRenderPlyr = showVideo && !videoError && event_video;
    // const shouldRenderPlyr = showVideo && isInView && !videoError && event_video; // Alternative: unmount Plyr if not in view

    return (
        <div className="relative" ref={cardVisibilityRef}>
            <div className="avatar-wrapper">
                {created_by?.profile_picture ? (
                    <img src={created_by.profile_picture} alt="Profile" className="avatar" />
                ) : (
                    <div className="avatar-initial"></div>
                )}
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden transition-transform transform hover:scale-105">
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
                            key={event_video} // Crucial for re-initialization if event_video changes
                            source={{
                                type: "video",
                                sources: [{ src: event_video, provider: 'html5', type: "video/mp4" }],
                            }}
                            options={{ ...videoOptions }}
                            onReady={handlePlayerReady}
                            onError={handlePlyrComponentError}
                        />
                    )}

                    {videoError && showVideo && !shouldRenderPlyr && ( // Error message if tried to show video but failed
                        <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-red-500 p-4 text-center">
                            <p>Video for "{event_title}" could not be loaded.</p>
                        </div>
                    )}
                </div>

                <div onClick={() => handleEventClick(_id)} className="p-4 cursor-pointer">
                    {/* ... your event details JSX ... */}
                    <h3 className="text-lg font-semibold text-gray-800">{event_title}</h3>
                    <p className="text-sm text-gray-600 truncate">{event_description}</p>
                    {/* ... more details */}
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
    );
};

export default memo(EventCard);