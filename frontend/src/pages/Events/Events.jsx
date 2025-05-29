import { useEffect, useState, useRef } from "react";
import NavBar from "../../components/NavBar";
import Footer from "../../components/Footer";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { FaPlus } from "react-icons/fa";
import MembersModel from "../../components/MembersModel";
import "plyr-react/plyr.css";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import EventCard from "./EventCard";
import useDebounce from "../../hooks/useDebounce";

const Events = () => {
    const searchInputRef = useRef(null);
    const [events, setEvents] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState("location");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    // const [filteredEvents, setFilteredEvents] = useState([]); // Still needed for filtering
    // const [isFiltering, setIsFiltering] = useState(false);
    const navigate = useNavigate();
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [joinedMembers, setJoinedMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // Adjust as needed
    const [totalEvents, setTotalEvents] = useState(0);

    const categories = [
        "Recreational",
        "Religious",
        "Sports",
        "Cultural",
        "Concert",
        "Conference",
        "Workshop",
        "Meetup",
        "Party",
    ];

    const { user } = useAuth();
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // const filtersRef = useRef({
    //     searchTerm: "",
    //     searchType: "location",
    //     selectedCategory: "",
    //     dateFilter: "",
    // });

    useEffect(() => {
        const searchInput = searchInputRef.current;
        if (!searchInput) return;

        const handleInput = (e) => {
            // window.requestAnimationFrame(() => {
                setSearchTerm(e.target.value);
            // });
        };

        searchInput.addEventListener("input", handleInput);

        return () => {
            searchInput.removeEventListener("input", handleInput);
        };
    }, []);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setIsLoading(true);
                const response = await axiosInstance.get("/events/viewAll", {
                    params: {
                        page: currentPage,
                        limit: itemsPerPage,
                        searchTerm: debouncedSearchTerm || undefined,
                        searchType,
                        category: selectedCategory || undefined,
                        dateFilter: dateFilter || undefined,
                    },
                });

                setEvents(response.data.events);
                setTotalEvents(response.data.total);
            } catch (error) {
                console.error("Error fetching events:", error);
                toast.error("Failed to fetch events");
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchEvents, 300);
        return () => clearTimeout(timer);
    }, [currentPage, itemsPerPage, debouncedSearchTerm, searchType, selectedCategory, dateFilter]);

    // useEffect(() => {
    //     filtersRef.current = {
    //         searchTerm: debouncedSearchTerm,
    //         searchType,
    //         selectedCategory,
    //         dateFilter,
    //     };
    //     // Reset to page 1 whenever filters change
    //     setCurrentPage(1);
    // }, [debouncedSearchTerm, searchType, selectedCategory, dateFilter]);

    // Fetch events on component mount AND when currentPage/itemsPerPage change
    useEffect(() => {
        // fetchEvents();
        setCurrentPage(1)
    }, [debouncedSearchTerm, searchType, selectedCategory, dateFilter]);

    // useEffect(() => {
    //     if (events.length === 0) return;

    //     setIsFiltering(true);
    //     const idleCallback = window.requestIdleCallback || setTimeout;

    //     idleCallback(() => {
    //         applyFilters();
    //         setIsFiltering(false);
    //     });
    //      return () => {
    //        if (window.cancelIdleCallback) {
    //          window.cancelIdleCallback(idleCallback);
    //        }
    //      };
    // }, [debouncedSearchTerm, searchType, selectedCategory, dateFilter, events]);


    const fetchEvents = async () => {
        try {
            setIsLoading(true);
            // Include page and limit parameters in the API request
            const response = await axiosInstance.get("/events/viewAll", {
                params: {
                    page: currentPage,
                    limit: itemsPerPage,
                    // Pass filter values to the backend (optional, for server-side filtering)
                    searchTerm: debouncedSearchTerm || undefined,
        searchType,
        category: selectedCategory || undefined,
        dateFilter: dateFilter || undefined,
                    // ...(debouncedSearchTerm && { searchTerm: debouncedSearchTerm }),
                    // ...(searchType && { searchType }),
                    // ...(selectedCategory && { category: selectedCategory }),
                    // ...(dateFilter && { dateFilter }),
                },
            });

            // Assuming your backend returns { events: [], total: number }
            setEvents(response.data.events);
            // setFilteredEvents(response.data.events); // Initialize filteredEvents
            setTotalEvents(response.data.total);

        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error("Failed to fetch events");
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        const { searchTerm, searchType, selectedCategory, dateFilter } = filtersRef.current;
        const filtered = events.filter((event) => {
            if (selectedCategory && event.category !== selectedCategory) { return false; }
            if (dateFilter) {
                const eventDate = new Date(event.event_date_and_time);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if ((dateFilter === "today" && (eventDate < today || eventDate >= new Date(today.setDate(today.getDate() + 1)))) ||
                    (dateFilter === "upcoming" && eventDate < today)) {
                    return false;
                }
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase().replace(/\s+/g, "");
                if (searchType === "location") {
                    return event?.event_address?.address?.toLowerCase().replace(/\s+/g, "").includes(term) || false;
                } else if (searchType === "username") {
                    return event?.created_by?.username?.toLowerCase().replace(/\s+/g, "").includes(term) || false;
                } else if (searchType === "event") {
                    return event?.event_title?.toLowerCase().replace(/\s+/g, "").includes(term) || false;
                }
                return false;
            }
            return true;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setEvents(filtered);
        // setFilteredEvents(filtered);
    };

    const handleCategoryFilter = (category) => {
        setSelectedCategory(category === selectedCategory ? "" : category);
        //setCurrentPage(1); // Reset to page 1 when filters change
    };

    const handleDateFilter = (filter) => {
        setDateFilter(filter === dateFilter ? "" : filter);
        //setCurrentPage(1); // Reset to page 1 when filters change
    };

    const handleFetchJoinedMembers = async (eventId) => {
        try {
            const response = await axiosInstance.get(`/events/guests/${eventId}`);
            setJoinedMembers(response.data.guests);
            setIsMembersModalOpen(true);
        } catch (error) {
            console.error("Error fetching joined members:", error);
        }
    };

    const handleShare = (event_title, event_description, _id) => {
        const shareData = {
            title: event_title,
            text: event_description,
            url: window.location.origin + `/single-event/${_id}`,
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

    const handleEventClick = (eventId) => {
        if (!user) {
            toast.error("Please login to view event details");
            navigate("/login");
            return;
        }
        navigate(`/single-event/${eventId}`);
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalEvents / itemsPerPage);

    // Function to handle page changes
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    return (
        <div>
            <NavBar />
            <div className="container mx-auto px-4 pt-32">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Events</h1>
                    {user && (
                        <Link
                            to="/add-event"
                            className="bg-purple-500 text-white px-6 py-2 rounded-xl hover:bg-purple-600 transition duration-200 flex items-center gap-2"
                        >
                            <FaPlus />
                            Add Event
                        </Link>
                    )}
                </div>
                <div className="w-full max-w-4xl mx-auto mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                            <div className="relative w-full">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg
                                        className="h-5 w-5 text-purple-400"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    defaultValue={searchTerm}
                                    placeholder={`Search by ${searchType}`}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <select
                                    value={searchType}
                                    onChange={(e) => setSearchType(e.target.value)}
                                    className="w-full sm:w-56 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white appearance-none bg-no-repeat transition-all duration-200"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                        backgroundPosition: "right 1rem center",
                                        backgroundSize: "1em",
                                        paddingRight: "2.5rem",
                                    }}
                                >
                                    <option value="location" className="py-2">
                                        Search by Location
                                    </option>
                                    <option value="username" className="py-2">
                                        Search by Username
                                    </option>
                                    <option value="event" className="py-2">
                                        Search by Event Name
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700 mb-2">
                                    Categories
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map((category) => (
                                        <button
                                            key={category}
                                            onClick={() => handleCategoryFilter(category)}
                                            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${selectedCategory === category
                                                ? "bg-purple-500 text-white shadow-md hover:bg-purple-600"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                }`}
                                        >
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700 mb-2">
                                    Date Filter
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleDateFilter("today")}
                                        className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${dateFilter === "today"
                                            ? "bg-purple-500 text-white shadow-md hover:bg-purple-600"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => handleDateFilter("upcoming")}
                                        className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${dateFilter === "upcoming"
                                            ? "bg-purple-500 text-white shadow-md hover:bg-purple-600"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        Upcoming
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:py-10 py-2">
                    {isLoading ?(
                        <div className="flex justify-center items-center min-h-[400px]">
                            <div className="relative w-20 h-20">
                                <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-200 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
                            </div>
                        </div>
                    ) : events.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
                            {events.map((event) => (
                                <EventCard
                                    {...event}
                                    handleEventClick={handleEventClick}
                                    handleShare={handleShare}
                                    handleFetchJoinedMembers={handleFetchJoinedMembers}
                                    key={event._id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <h3 className="text-lg font-semibold text-gray-900">
                                No Data Found
                            </h3>
                            <p className="text-sm text-gray-500">
                                Try adjusting your search or filter criteria.
                            </p>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-8">
                            <nav className="inline-flex rounded-md shadow">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
                                        }`}
                                >
                                    Previous
                                </button>

                                {/* Generate an array of page numbers */}
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                                    (page) => (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`px-3 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium ${currentPage === page
                                                ? "text-purple-600 bg-purple-50"
                                                : "text-gray-700 hover:bg-gray-50"
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    )
                                )}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === totalPages
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                        }`}
                                >
                                    Next
                                </button>
                            </nav>
                        </div>
                    )}
                </div>
            </div>
            {isMembersModalOpen && (
                <MembersModel
                    isOpen={isMembersModalOpen}
                    onClose={() => setIsMembersModalOpen(false)}
                    members={joinedMembers}
                />
            )}
            <Footer />
        </div>
    );
};

export default Events;