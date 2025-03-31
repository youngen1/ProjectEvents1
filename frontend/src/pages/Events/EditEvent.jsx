import React, { useState, useEffect } from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { DatePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import axiosInstance from "../../utils/axiosInstance"; // Your Axios instance
import NavBar from "../../components/NavBar";
// import Footer from "../../components/Footer"; // Footer isn't used
import { FaCalendar } from "react-icons/fa";
import { toast, Toaster } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import PlacesAutocomplete from "react-places-autocomplete";
import { FiMapPin } from "react-icons/fi";
import { geocodeByAddress, getLatLng } from "react-places-autocomplete";

export default function EditEvent() {
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [videoPreview, setVideoPreview] = useState(null);
    const [address, setAddress] = useState("");
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
    const [uploadTask, setUploadTask] = useState(null);  //Keep the upload task
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);
    const navigate = useNavigate();
    const { eventId } = useParams();


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

    const formik = useFormik({
        initialValues: {
            event_title: "",
            category: "",
            event_date_and_time: null,
            event_duration: "",  // Initialize as string
            event_address: "",
            additional_info: "",
            ticket_price: "",
            event_description: "",
            event_max_capacity: "",
            event_video: null, // Keep as null initially
            age_restriction: [],
            gender_restriction: [],
        },
        validationSchema: Yup.object({
            event_title: Yup.string().required("Event title is required"),
            category: Yup.string().required("Category is required"),
            event_date_and_time: Yup.date()
                .required("Event date and time are required")
                .typeError("Please enter a valid date and time (e.g., DD MMM YYYY HH:mm)."),
           event_duration: Yup.number() // Change validation to string
                .required("Event duration is required")
                .test(
                    "is-valid-duration",
                    "Duration must be at least 0.5 hours (e.g., '0.5', '1', '2.5')",
                    (value) => {
                        if (!value) return false; // Required already handles empty
                        const numValue = parseFloat(value);
                        return !isNaN(numValue) && numValue >= 0.5;
                    }
                ),
            event_address: Yup.string().required("Event address is required"),
            additional_info: Yup.string(),
            ticket_price: Yup.number().required("Ticket price is required"),
            event_description: Yup.string().required("Event description is required"),
            event_max_capacity: Yup.number().required("Event max capacity is required"),
            event_video: Yup.mixed().nullable(),  // Allow null for the video
        }),

        onSubmit: async (values, { setSubmitting }) => {
            setSubmitting(true);
            let videoURL = null;

            // 1. Handle video upload (if a NEW video is selected)
            if (isUpdatingVideo && values.event_video) {
                // Only upload if isUpdatingVideo is TRUE *and* a file is selected
                const formData = new FormData();
                formData.append("event_video", values.event_video);

                try {
                    const uploadResponse = await axiosInstance.post("/upload-video", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            setVideoUploadProgress(percentCompleted);
                        },
                    });
                    videoURL = uploadResponse.data.videoURL;  // Use the URL from the response
                } catch (uploadError) {
                    console.error("Video upload failed: ", uploadError);
                    setSubmitting(false);
                    toast.error("Video upload failed");
                    return; //  Exit early if upload fails
                }
            } else if (!isUpdatingVideo && typeof formik.initialValues.event_video === 'string' ) {
                videoURL = formik.initialValues.event_video;
            } else {
                videoURL = '';
            }


            // 2. Prepare event data
            const eventData = {
                ...values,
                event_address: JSON.stringify({
                    address: address,
                    longitude: coordinates.lng,
                    latitude: coordinates.lat,
                }),
                 age_restriction: JSON.stringify(values.age_restriction), // Convert array to string
                gender_restriction: JSON.stringify(values.gender_restriction),// Convert array to string
                event_date_and_time: values.event_date_and_time.toISOString(),
                event_video: videoURL, // Use the correct video URL (existing or new)

            };


            // 3. Send update request to the backend
            try {
                await axiosInstance.put(`/events/update/${eventId}`, eventData);
                setSubmitting(false);
                toast.success("Event updated successfully");
                navigate("/events"); // Redirect to events list

            } catch (updateError) {
                console.error("Event update failed:", updateError);
                setSubmitting(false);
                toast.error("Event update failed");
            }
        },
    });


  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await axiosInstance.get(`/events/view/${eventId}`);
        const eventData = response.data;

        // Initialize address and coordinates
        setAddress(eventData.event_address.address);
        setCoordinates({
          lat: eventData.event_address.latitude,
          lng: eventData.event_address.longitude,
        });
        setVideoPreview(eventData.event_video)

        // Populate Formik's initialValues
        formik.setValues({
          event_title: eventData.event_title,
          category: eventData.category,
          event_date_and_time: new Date(eventData.event_date_and_time),
          event_duration: eventData.event_duration,
          event_address: eventData.event_address.address,
          additional_info: eventData.additional_info || "",
          ticket_price: eventData.ticket_price,
          event_description: eventData.event_description,
          event_max_capacity: eventData.event_max_capacity,
          event_video: eventData.event_video,
          age_restriction: eventData.age_restriction || [],
          gender_restriction: eventData.gender_restriction || [],
        });
        setLoading(false);
      } catch (error) {
        if(error.isAxiosError && error.response.status === 401){
          navigate('/login', {replace: true})
          return;
        }
        setError("Failed to fetch event.");
        setLoading(false);
        console.error(error);
      }
    };

    fetchEvent();
  }, [eventId, formik.setValues, navigate]);

    const handleVideoChange = (event) => {
        const file = event.currentTarget.files[0];
        if (file) {
            formik.setFieldValue("event_video", file);
             const fileURL = URL.createObjectURL(file);
             setVideoPreview(fileURL);
            setIsUpdatingVideo(true);  // User is changing the video
        } else {
            // Handle clearing the selection if needed
            setIsUpdatingVideo(false)
        }
    };


    const handleSelect = async (value) => {
        const results = await geocodeByAddress(value);
        const latLng = await getLatLng(results[0]);
        setAddress(value);
        setCoordinates(latLng);
        formik.setFieldValue("event_address", value);
    };


    const handleCancel = () => {
        if (uploadTask) {
            uploadTask.cancel(); // Cancel the Firebase upload
            toast.error("You have canceled the submission.");
        }
        navigate("/events"); // Go back to the events list
    };

    const categories = ["Recreational", "Religious", "Sports", "Cultural", "Concert", "Conference", "Workshop", "Meetup", "Party"];
    const ageOptions = ["<18", "18 - 29", "30 - 39", "40 <"];
    const genderOptions = ["Male", "Female", "Other"];

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }


    return (
        <div>
            <Toaster richColors />
            <NavBar />
            <div className="pt-32 lg:px-0 px-3 w-full ">
                <form
                    onSubmit={formik.handleSubmit}
                    className="max-w-4xl mx-auto flex flex-col gap-y-4"
                >
                    <div className="w-full">
                        <div className="flex flex-col items-start gap-y-3">
                            <Link
                                to="/events"
                                className="text-sm text-gray-700 hover:text-gray-500 flex items-center mb-4"
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
                            <h2 className="text-xl font-semibold leading-7 text-gray-900">
                                Edit Event Information
                            </h2>
                            <div className="w-full pt-6 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-6">
                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_title"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Title
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="event_title"
                                            name="event_title"
                                            type="text"
                                            {...formik.getFieldProps("event_title")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.event_title && formik.errors.event_title ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_title}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="category"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Category
                                    </label>
                                    <div className="mt-2">
                                        <select
                                            id="category"
                                            name="category"
                                            {...formik.getFieldProps("category")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        >
                                            <option value="" label="Select category" />
                                            {categories.map((category) => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                        {formik.touched.category && formik.errors.category ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.category}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_date_and_time"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Date and Time
                                    </label>
                                    <div className="mt-2">
                                        <DatePicker
                                            id="event_date_and_time"
                                            name="event_date_and_time"
                                            value={formik.values.event_date_and_time}
                                            onChange={(date) =>
                                                formik.setFieldValue("event_date_and_time", date)
                                            }
                                            caretAs={FaCalendar}
                                            format="dd MMM yyyy HH:mm:ss"
                                            className="w-full"
                                        />
                                        {formik.touched.event_date_and_time &&
                                            formik.errors.event_date_and_time ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_date_and_time}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_duration"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Duration (in hours)
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="event_duration"
                                            name="event_duration"
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            {...formik.getFieldProps("event_duration")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.event_duration && formik.errors.event_duration ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_duration}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_address"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Address
                                    </label>
                                    <div className="mt-2">
                                        <PlacesAutocomplete
                                            value={address}
                                            onChange={setAddress}
                                            onSelect={handleSelect}
                                            searchOptions={{
                                                componentRestrictions: { country: ["ZA"] },
                                            }}
                                        >
                                            {({
                                                getInputProps,
                                                suggestions,
                                                getSuggestionItemProps,
                                                loading,
                                            }) => (
                                                <div className="w-full relative">
                                                    <input
                                                        {...getInputProps({
                                                            placeholder: "Search by Location",
                                                            className:
                                                                "block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6",
                                                        })}
                                                    />
                                                    <div className="absolute top-full left-0 mt-2 w-full bg-white shadow-lg rounded-lg z-10 max-h-60 overflow-y-auto">
                                                        {loading && <div className="p-2">Loading...</div>}
                                                        {suggestions.map((suggestion, index) => {
                                                            const className = suggestion.active
                                                                ? "cursor-pointer bg-purple-500 text-white px-4 py-2"
                                                                : "cursor-pointer bg-gray-100 text-black px-4 py-2";
                                                            return (
                                                                <div
                                                                    {...getSuggestionItemProps(suggestion, {
                                                                        className,
                                                                    })}
                                                                    key={index}
                                                                >
                                                                    <div className="flex items-center">
                                                                        <FiMapPin className="mr-2" />
                                                                        {suggestion.description}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </PlacesAutocomplete>
                                        {formik.touched.event_address &&
                                            formik.errors.event_address ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_address}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="additional_info"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Additional Info
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="additional_info"
                                            name="additional_info"
                                            type="text"
                                            {...formik.getFieldProps("additional_info")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.additional_info &&
                                            formik.errors.additional_info ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.additional_info}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="ticket_price"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Ticket Price
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="ticket_price"
                                            name="ticket_price"
                                            type="number"
                                            {...formik.getFieldProps("ticket_price")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.ticket_price &&
                                            formik.errors.ticket_price ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.ticket_price}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_description"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Description
                                    </label>
                                    <div className="mt-2">
                                        <textarea
                                            id="event_description"
                                            name="event_description"
                                            rows={3}
                                            {...formik.getFieldProps("event_description")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.event_description &&
                                            formik.errors.event_description ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_description}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label
                                        htmlFor="event_max_capacity"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Event Max Capacity
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="event_max_capacity"
                                            name="event_max_capacity"
                                            type="number"
                                            {...formik.getFieldProps("event_max_capacity")}
                                            className="block w-full rounded-md border-0 bg-gray-900/5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-900/10 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                        />
                                        {formik.touched.event_max_capacity &&
                                            formik.errors.event_max_capacity ? (
                                            <div className="text-red-500 text-sm mt-1">
                                                {formik.errors.event_max_capacity}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Age Restriction - Use Checkboxes */}
                                <div className="col-span-full mt-2">
                                    <label
                                        htmlFor="age_restriction"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Age Restriction
                                    </label>
                                    <div className="mt-2 flex gap-x-4">
                                        {ageOptions.map((age) => (
                                            <label key={age} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    name="age_restriction"
                                                    value={age}
                                                    checked={formik.values.age_restriction.includes(age)}
                                                    onChange={(e) => {
                                                        const selectedAges = formik.values.age_restriction;
                                                        if (e.target.checked) {
                                                            formik.setFieldValue("age_restriction", [
                                                                ...selectedAges,
                                                                age,
                                                            ]);
                                                        } else {
                                                            formik.setFieldValue(
                                                                "age_restriction",
                                                                selectedAges.filter((item) => item !== age)
                                                            );
                                                        }
                                                    }}
                                                    className="mr-2"
                                                />
                                                {age}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Gender Restriction - Use Radio Buttons */}
                                <div className="col-span-full mt-2">
                                    <label
                                        htmlFor="gender_restriction"
                                        className="block text-sm font-medium leading-6 text-gray-900"
                                    >
                                        Gender Restriction
                                    </label>
                                    <div className="mt-2 flex gap-x-4">
                                        {genderOptions.map((gender) => (
                                            <label key={gender} className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="gender_restriction"
                                                    value={gender}
                                                    checked={formik.values.gender_restriction.includes(
                                                        gender
                                                    )}
                                                    onChange={(e) => {
                                                        formik.setFieldValue("gender_restriction", [
                                                            e.target.value,
                                                        ]);
                                                    }}
                                                    className="mr-2"
                                                />
                                                {gender}
                                            </label>
                                        ))}
                                        {/* Option for no gender restriction */}
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="gender_restriction"
                                                value=""
                                                checked={formik.values.gender_restriction.length === 0}
                                                onChange={() =>
                                                    formik.setFieldValue("gender_restriction", [])
                                                }
                                                className="mr-2"
                                            />
                                            No Restriction
                                        </label>
                                    </div>
                                </div>

                <div className="col-span-full mt-2">
                  <label htmlFor="event_video" className="block text-sm font-medium leading-6 text-gray-900">
                    Event Video
                  </label>
                  <div className="mt-2 flex flex-col justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                    {!isUpdatingVideo && videoPreview && (
                        <div className="mb-4">
                            <div className="aspect-w-16 aspect-h-9">
                                <Plyr
                                    source={{
                                        type: "video",
                                        sources: [{ src: videoPreview, type: "video/mp4" }],
                                    }}
                                    options={videoOptions}
                                />
                            </div>
                        </div>
                    )}

                      {isUpdatingVideo && (
                        <>
                         <div className="text-center">
                        <input
                          id="event_video"
                          name="event_video"
                          type="file"
                          accept="video/*"
                          onChange={handleVideoChange}
                          className="sr-only"
                        />
                        <label
                          htmlFor="event_video"
                          className="relative cursor-pointer rounded-md bg-purple-500 font-semibold text-white p-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-600 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:bg-purple-600"
                        >
                          <span>Upload a video</span>
                        </label>
                        </div>
                        </>
                      )}


                    {!isUpdatingVideo && (
                      <button
                        type="button"
                        onClick={() => setIsUpdatingVideo(true)}
                        className="mt-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                      >
                        Update Video
                      </button>
                    )}
                       {isUpdatingVideo && videoPreview && (
                      <div className="mt-4">
                        <div className="aspect-w-16 aspect-h-9">
                          <Plyr
                            source={{
                              type: "video",
                              sources: [
                                { src: videoPreview, type: "video/mp4" },
                              ],
                            }}
                            options={videoOptions}
                          />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsUpdatingVideo(false);
                                setVideoPreview(formik.initialValues.event_video);
                                formik.setFieldValue('event_video', formik.initialValues.event_video)
                            }} //Revert to no updating
                            className="mt-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            Cancel Update
                        </button>
                      </div>
                    )}

                    {videoUploadProgress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                        <div
                          className="bg-purple-500 h-4 rounded-full"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-x-6 pt-10">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="rounded-md bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-md bg-purple-500 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                        >
                            Update
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}