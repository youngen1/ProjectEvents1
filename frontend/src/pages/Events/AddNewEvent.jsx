import React, { useState, useRef, useEffect } from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { DatePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import axiosInstance from "../../utils/axiosInstance";
import NavBar from "../../components/NavBar";
import { FaCalendar } from "react-icons/fa";
import { toast, Toaster } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import PlacesAutocomplete, {
    geocodeByAddress,
    getLatLng,
} from "react-places-autocomplete";
import { FiMapPin } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

// Thumbnail generation has been removed to require manual thumbnail selection

export default function AddNewEvent() {
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [address, setAddress] = useState("");
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
    const navigate = useNavigate();
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);

    const { user } = useAuth();
    const plyrRef = useRef(null);

    useEffect(() => {
        if (plyrRef.current?.plyr) {
            plyrRef.current.plyr.poster = thumbnailPreviewUrl || ''; // Set to URL or empty string to clear
        }
    }, [thumbnailPreviewUrl]);

    // Thumbnail generation functionality has been removed

    const handleVideoChange = async (event) => {
        const videoFile = event.currentTarget.files[0];
        formik.setFieldValue("event_video", videoFile);
        setVideoUploadProgress(0);

        // Mark thumbnail_file as touched to trigger validation
        formik.setFieldTouched("thumbnail_file", true);

        // Remind user to upload a thumbnail if they haven't already
        if (videoFile && !formik.values.thumbnail_file) {
            toast.info("Please don't forget to upload a thumbnail for your event.");
        }
    };

    const handleManualThumbnailChange = async (event) => {
        const manualFile = event.currentTarget.files[0];
        const manualThumbnailInput = document.getElementById('manual_thumbnail');

        // Mark thumbnail_file as touched to trigger validation
        formik.setFieldTouched("thumbnail_file", true);

        if (manualFile) {
            if (!manualFile.type.startsWith('image/')) {
                toast.error('Please select a valid image file (JPG, PNG, WEBP).');
                if (manualThumbnailInput) manualThumbnailInput.value = ""; // Clear invalid file from input
                return;
            }

            formik.setFieldValue("thumbnail_file", manualFile);
            const previewUrl = URL.createObjectURL(manualFile);
            setThumbnailPreviewUrl(previewUrl);
            toast.success("Thumbnail uploaded successfully.");
        } else {
            // Manual thumbnail input cleared by user (e.g., selected a file then cancelled)
            formik.setFieldValue("thumbnail_file", null);
            setThumbnailPreviewUrl(null);
            if (manualThumbnailInput) manualThumbnailInput.value = ""; // Ensure input is visually cleared

            toast.info("Thumbnail removed. Please upload a new thumbnail.");
        }
    };

    // The handleRemoveCustomThumbnail function has been removed as we now require manual thumbnail upload


    const formik = useFormik({
        initialValues: {
            event_title: "",
            category: "",
            event_date_and_time: null,
            event_duration: "",
            event_address: "",
            additional_info: "",
            ticket_price: "",
            event_description: "",
            event_max_capacity: "",
            event_video: null,
            thumbnail_file: null, // Will hold generated OR uploaded thumbnail File
            age_restriction: [],
            gender_restriction: [],
        },
        validationSchema: Yup.object({
            event_title: Yup.string().required("Event title is required"),
            category: Yup.string().required("Category is required"),
            event_date_and_time: Yup.date()
                .required("Event date and time are required")
                .typeError("Please enter a valid date and time."),
            event_duration: Yup.number()
                .required("Event duration is required")
                .min(0.5, "Duration must be at least 0.5 hours")
                .typeError("Please enter a valid number for duration"),
            event_address: Yup.string().required("Event address is required"),
            additional_info: Yup.string(),
            ticket_price: Yup.number().required("Ticket price is required").min(0, "Price cannot be negative"),
            event_description: Yup.string().required("Event description is required"),
            event_max_capacity: Yup.number().required("Event max capacity is required").integer("Must be a whole number").min(1, "Capacity must be at least 1"),
            event_video: Yup.mixed()
                .required("Event video is required")
                .test("fileType", "Unsupported video format", (value) => {
                    return value && value.type && value.type.startsWith("video/");
                }),
            thumbnail_file: Yup.mixed()
                .required("Thumbnail is required")
                .test("fileTypeImage", "Thumbnail must be an image (JPG, PNG, WEBP)", function(value) {
                    return value && value.type && value.type.startsWith("image/");
                }),
            // age_restriction: Yup.array(), // Add specific validation if needed
            // gender_restriction: Yup.array(), // Add specific validation if needed
        }),
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            setSubmitting(true);
            setVideoUploadProgress(0);

            if (!user) {
                toast.error("You must be logged in to create an event.");
                setSubmitting(false);
                return;
            }

            if (!values.event_video) {
                toast.error("Please select a video file.");
                setSubmitting(false);
                return;
            }

            if (!values.thumbnail_file) {
                // Prevent submission if thumbnail is missing
                toast.error("Thumbnail is missing. Cannot create event.");
                setSubmitting(false);
                return;
            }

            const formData = new FormData();
            formData.append('event_video', values.event_video);
            if(values.thumbnail_file) {
                formData.append('thumbnail_file', values.thumbnail_file);
            }

            formData.append('event_title', values.event_title);
            formData.append('category', values.category);
            formData.append('event_date_and_time', values.event_date_and_time.toISOString());
            formData.append('event_duration', values.event_duration);
            formData.append('event_address', JSON.stringify({
                address: address,
                longitude: coordinates.lng,
                latitude: coordinates.lat,
            }));
            formData.append('additional_info', values.additional_info || '');
            formData.append('ticket_price', values.ticket_price);
            formData.append('event_description', values.event_description);
            formData.append('event_max_capacity', values.event_max_capacity);
            formData.append('age_restriction', JSON.stringify(values.age_restriction || []));
            formData.append('gender_restriction', JSON.stringify(values.gender_restriction || []));
            formData.append('created_by', user._id);

            try {
                const uploadResponse = await axiosInstance.post('/events/create', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    onUploadProgress: (progressEvent) => {
                        let percentCompleted = 0;
                        const loaded = typeof progressEvent.loaded === 'number' ? progressEvent.loaded : -1;
                        const currentVideoFileSize = values.event_video?.size;
                        const totalSize = progressEvent.total > 0 ? progressEvent.total : (currentVideoFileSize || 0);
                        if (totalSize > 0 && loaded >= 0) {
                            percentCompleted = Math.round((loaded * 100) / totalSize);
                        }
                        percentCompleted = Math.min(Math.max(percentCompleted, 0), 100);
                        setVideoUploadProgress(percentCompleted);
                    },
                });

                console.log("Event creation/upload response:", uploadResponse.data);
                toast.success("Event created successfully!");

                // Reset form and state
                resetForm();
                setThumbnailPreviewUrl(null);
                setAddress('');
                setCoordinates({ lat: null, lng: null });
                setVideoUploadProgress(0);

                // Clear file input fields visually
                const videoInput = document.getElementById('event_video');
                if (videoInput) videoInput.value = "";
                const manualThumbnailInput = document.getElementById('manual_thumbnail');
                if (manualThumbnailInput) manualThumbnailInput.value = "";

                // navigate("/events"); // Optional: navigate after success

            } catch (error) {
                console.error("Error creating event:", error);
                toast.error(error.response?.data?.message || "An error occurred during event creation.");
                setVideoUploadProgress(0);
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleSelect = async (value) => {
        try {
            const results = await geocodeByAddress(value);
            if (results && results.length > 0) {
                const latLng = await getLatLng(results[0]);
                setAddress(value);
                setCoordinates(latLng);
                formik.setFieldValue("event_address", value);
            } else {
                toast.error("Could not find coordinates for the selected address.");
                setAddress(value);
                formik.setFieldValue("event_address", value);
            }
        } catch (error) {
            console.error('Error during geocoding:', error);
            toast.error("Error finding coordinates for the address.");
            setAddress(value);
            formik.setFieldValue("event_address", value);
        }
    };

    const handleCancel = () => {
        formik.resetForm();
        setVideoUploadProgress(0);
        setThumbnailPreviewUrl(null);
        setAddress("");
        setCoordinates({ lat: null, lng: null });

        // Clear file input fields visually
        const videoInput = document.getElementById('event_video');
        if (videoInput) videoInput.value = "";
        const manualThumbnailInput = document.getElementById('manual_thumbnail');
        if (manualThumbnailInput) manualThumbnailInput.value = "";
        // navigate("/events"); // Optional: navigate back
    };

    const categories = ["Recreational", "Religious", "Sports", "Cultural", "Concert", "Conference", "Workshop", "Meetup", "Party"];
    const ageOptions = ["<18", "18 - 29", "30 - 39", "40 <"];
    const genderOptions = ["Male", "Female", "Other"];

    return (
        <div>
            <Toaster richColors position="top-center" />
            <NavBar />
            <div className="pt-32 lg:px-0 px-3 w-full ">
                <form
                    onSubmit={formik.handleSubmit}
                    className="max-w-4xl mx-auto flex flex-col gap-y-4 mb-10"
                >
                    <div className="w-full">
                        <Link
                            to="/events"
                            className="text-sm text-gray-700 hover:text-gray-500 flex items-center mb-4"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Events
                        </Link>
                    </div>

                    {/* Event Info Section */}
                    <div className="border-b border-gray-900/10 pb-12">
                        <h2 className="text-base font-semibold leading-7 text-gray-900">Event Information</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600">Provide details about your event.</p>
                        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            {/* Event Title */}
                            <div className="col-span-full">
                                <label htmlFor="event_title" className="block text-sm font-medium leading-6 text-gray-900">Event Title *</label>
                                <div className="mt-2">
                                    <input id="event_title" name="event_title" type="text" {...formik.getFieldProps("event_title")} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_title && formik.errors.event_title ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_title}</div>) : null}
                                </div>
                            </div>
                            {/* Category */}
                            <div className="sm:col-span-3">
                                <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-900">Category *</label>
                                <div className="mt-2">
                                    <select id="category" name="category" {...formik.getFieldProps("category")} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                                        <option value="">Select category</option>
                                        {categories.map((category) => (<option key={category} value={category}>{category}</option>))}
                                    </select>
                                    {formik.touched.category && formik.errors.category ? (<div className="text-red-500 text-xs mt-1">{formik.errors.category}</div>) : null}
                                </div>
                            </div>
                            {/* Date & Time */}
                            <div className="sm:col-span-3">
                                <label htmlFor="event_date_and_time" className="block text-sm font-medium leading-6 text-gray-900">Event Date & Time *</label>
                                <div className="mt-2">
                                    <DatePicker
                                        id="event_date_and_time"
                                        name="event_date_and_time"
                                        value={formik.values.event_date_and_time}
                                        onChange={(date) => formik.setFieldValue("event_date_and_time", date)}
                                        onBlur={() => formik.setFieldTouched("event_date_and_time", true)}
                                        format="yyyy-MM-dd HH:mm"
                                        placeholder="YYYY-MM-DD HH:mm"
                                        caretAs={FaCalendar}
                                        style={{ width: '100%' }}
                                        className="rs-input"
                                    />
                                    {formik.touched.event_date_and_time && formik.errors.event_date_and_time ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_date_and_time}</div>) : null}
                                </div>
                            </div>
                            {/* Duration */}
                            <div className="sm:col-span-3">
                                <label htmlFor="event_duration" className="block text-sm font-medium leading-6 text-gray-900">Duration (hours, e.g., 1.5) *</label>
                                <div className="mt-2">
                                    <input type="number" id="event_duration" name="event_duration" min="0.5" step="0.1" {...formik.getFieldProps('event_duration')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_duration && formik.errors.event_duration ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_duration}</div>) : null}
                                </div>
                            </div>
                            {/* Address */}
                            <div className="col-span-full">
                                <label htmlFor="event_address_autocomplete" className="block text-sm font-medium leading-6 text-gray-900">Event Address *</label>
                                <div className="mt-2">
                                    <PlacesAutocomplete value={address} onChange={setAddress} onSelect={handleSelect} searchOptions={{ componentRestrictions: { country: ['ZA'] } }}>
                                        {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
                                            <div className="relative">
                                                <input {...getInputProps({ placeholder: 'Search Places ...', className: 'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6', onBlur: () => formik.setFieldTouched("event_address", true) })} id="event_address_autocomplete" name="event_address_autocomplete" />
                                                {formik.touched.event_address && formik.errors.event_address && !address ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_address}</div>) : null}
                                                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                                                    {loading && <div className="px-4 py-2 text-gray-500">Loading...</div>}
                                                    {suggestions.map(suggestion => (<div {...getSuggestionItemProps(suggestion, { className: suggestion.active ? 'suggestion-item--active px-4 py-2 bg-indigo-100 cursor-pointer' : 'suggestion-item px-4 py-2 hover:bg-gray-100 cursor-pointer' })} key={suggestion.placeId || suggestion.description}><span className="flex items-center"><FiMapPin className="mr-2 text-gray-400" />{suggestion.description}</span></div>))}
                                                </div>
                                            </div>
                                        )}
                                    </PlacesAutocomplete>
                                </div>
                            </div>
                            {/* Ticket Price & Capacity */}
                            <div className="sm:col-span-3">
                                <label htmlFor="ticket_price" className="block text-sm font-medium leading-6 text-gray-900">Ticket Price (ZAR) *</label>
                                <div className="mt-2">
                                    <input type="number" id="ticket_price" name="ticket_price" min="0" step="0.01" {...formik.getFieldProps('ticket_price')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.ticket_price && formik.errors.ticket_price ? (<div className="text-red-500 text-xs mt-1">{formik.errors.ticket_price}</div>) : null}
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="event_max_capacity" className="block text-sm font-medium leading-6 text-gray-900">Max Capacity *</label>
                                <div className="mt-2">
                                    <input type="number" id="event_max_capacity" name="event_max_capacity" min="1" step="1" {...formik.getFieldProps('event_max_capacity')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_max_capacity && formik.errors.event_max_capacity ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_max_capacity}</div>) : null}
                                </div>
                            </div>
                            {/* Description */}
                            <div className="col-span-full">
                                <label htmlFor="event_description" className="block text-sm font-medium leading-6 text-gray-900">Event Description *</label>
                                <div className="mt-2">
                                    <textarea id="event_description" name="event_description" rows={4} {...formik.getFieldProps('event_description')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_description && formik.errors.event_description ? (<div className="text-red-500 text-xs mt-1">{formik.errors.event_description}</div>) : null}
                                </div>
                                <p className="mt-3 text-sm leading-6 text-gray-600">Write a few sentences about the event.</p>
                            </div>
                            {/* Additional Info */}
                            <div className="col-span-full">
                                <label htmlFor="additional_info" className="block text-sm font-medium leading-6 text-gray-900">Additional Info (Optional)</label>
                                <div className="mt-2">
                                    <input type="text" id="additional_info" name="additional_info" {...formik.getFieldProps('additional_info')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.additional_info && formik.errors.additional_info ? (<div className="text-red-500 text-xs mt-1">{formik.errors.additional_info}</div>) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Event Media Section - NEW STRUCTURE */}
                    <div className="border-b border-gray-900/10 pb-12">
                        <h2 className="text-base font-semibold leading-7 text-gray-900">Event Media</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                            Upload your event video and an optional custom thumbnail.
                        </p>
                        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            {/* Video Upload */}
                            <div className="col-span-full sm:col-span-3">
                                <label htmlFor="event_video" className="block text-sm font-medium leading-6 text-gray-900">
                                    Event Video *
                                </label>
                                <div className="mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 h-full">
                                    <div className="text-center">
                                        <label htmlFor="event_video" className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                                            <span>{formik.values.event_video ? "Change video" : "Upload a video"}</span>
                                            <input id="event_video" name="event_video" type="file" className="sr-only" accept="video/*" onChange={handleVideoChange} />
                                        </label>
                                        <p className="pl-1 text-xs leading-5 text-gray-600">{formik.values.event_video ? formik.values.event_video.name : "MP4, AVI, MOV up to 500MB"}</p>
                                        {formik.touched.event_video && formik.errors.event_video ? (
                                            <div className="text-red-500 text-xs mt-1">{formik.errors.event_video}</div>
                                        ) : null}
                                    </div>
                                    {videoUploadProgress > 0 && videoUploadProgress < 100 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${videoUploadProgress}%` }}></div>
                                        </div>
                                    )}
                                    {videoUploadProgress === 100 && (
                                        <p className="text-sm text-green-600 mt-2">Video upload processing with form submission.</p>
                                    )}
                                </div>
                            </div>

                            {/* Thumbnail Upload & Preview Section */}
                            <div className="col-span-full sm:col-span-3">
                                <label htmlFor="manual_thumbnail" className="block text-sm font-medium leading-6 text-gray-900">
                                    Event Thumbnail *
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="manual_thumbnail"
                                        name="manual_thumbnail"
                                        type="file"
                                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none mb-2"
                                        accept="image/jpeg, image/png, image/webp"
                                        onChange={handleManualThumbnailChange}
                                    />
                                    <p className="text-xs text-gray-600">
                                        Required (JPG, PNG, WEBP). You must upload a thumbnail for your event.
                                    </p>
                                    {/* Error for thumbnail_file shown for all validation errors */}
                                    {formik.touched.thumbnail_file && formik.errors.thumbnail_file ? (
                                        <div className="text-red-500 text-xs mt-1">{formik.errors.thumbnail_file}</div>
                                    ) : null}
                                </div>

                                {thumbnailPreviewUrl && (
                                    <div className="mt-4">
                                        <p className="text-sm font-medium text-gray-700 mb-1">
                                            Thumbnail Preview:
                                        </p>
                                        <img
                                            src={thumbnailPreviewUrl}
                                            alt="Thumbnail preview"
                                            className="max-w-xs w-full max-h-48 rounded border border-gray-300 object-contain bg-gray-100"
                                        />
                                    </div>
                                )}
                                {!thumbnailPreviewUrl && (
                                    <p className="mt-4 text-sm text-gray-500">Please upload a thumbnail for your event.</p>
                                )}
                            </div>
                        </div>
                    </div>


                    {/* Restrictions Section */}
                    <div className="border-b border-gray-900/10 pb-12">
                        <h2 className="text-base font-semibold leading-7 text-gray-900">Restrictions</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600">Set age and gender restrictions for your event.</p>
                        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <fieldset className="sm:col-span-3">
                                <legend className="text-sm font-semibold leading-6 text-gray-900">Age Restrictions</legend>
                                <div className="mt-4 space-y-2">
                                    {ageOptions.map((age) => (
                                        <div key={age} className="relative flex gap-x-3">
                                            <div className="flex h-6 items-center">
                                                <input id={`age-${age}`} name="age_restriction" type="checkbox" value={age} checked={formik.values.age_restriction.includes(age)} onChange={formik.handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                                            </div>
                                            <div className="text-sm leading-6"><label htmlFor={`age-${age}`} className="font-medium text-gray-900">{age}</label></div>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>
                            <fieldset className="sm:col-span-3">
                                <legend className="text-sm font-semibold leading-6 text-gray-900">Gender Restrictions</legend>
                                <p className="mt-1 text-sm leading-6 text-gray-600">Select one option or no restriction.</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-x-3">
                                        <input id="gender-none" name="gender_restriction" type="radio" value="" checked={formik.values.gender_restriction.length === 0 || formik.values.gender_restriction[0] === ''} onChange={() => formik.setFieldValue("gender_restriction", [])} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                                        <label htmlFor="gender-none" className="block text-sm font-medium leading-6 text-gray-900">No Restriction</label>
                                    </div>
                                    {genderOptions.map((gender) => (
                                        <div key={gender} className="flex items-center gap-x-3">
                                            <input id={`gender-${gender}`} name="gender_restriction" type="radio" value={gender} checked={formik.values.gender_restriction[0] === gender} onChange={() => formik.setFieldValue("gender_restriction", [gender])} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                                            <label htmlFor={`gender-${gender}`} className="block text-sm font-medium leading-6 text-gray-900">{gender}</label>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex items-center justify-end gap-x-6">
                        <button type="button" onClick={handleCancel} className="text-sm font-semibold leading-6 text-gray-900">Cancel</button>
                        <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
                            {formik.isSubmitting ? "Saving..." : "Save Event"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
