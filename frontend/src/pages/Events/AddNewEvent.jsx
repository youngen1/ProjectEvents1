import React, { useState, useRef, useEffect } from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { DatePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import axiosInstance from "../../utils/axiosInstance"; // Your existing axios instance
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

// --- Thumbnail Generation (Keep your existing function) ---
const generateThumbnailFromVideo = (videoFile) => {
    return new Promise((resolve, reject) => {
        if (!videoFile?.type.startsWith('video/')) {
            return reject(new Error('Please select a valid video file'));
        }
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;
        video.muted = true;
        video.onloadedmetadata = () => {
            const thumbnailTime = video.duration * 0.1;
            canvas.width = 320;
            canvas.height = (320 / video.videoWidth) * video.videoHeight;
            video.currentTime = thumbnailTime;
        };
        video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('Failed to create thumbnail'));
                const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                const previewUrl = URL.createObjectURL(blob);
                URL.revokeObjectURL(videoUrl);
                resolve({ file: thumbnailFile, previewUrl });
            }, 'image/jpeg', 0.8);
        };
        video.onerror = () => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error('Error processing video'));
        };
    });
};

export default function AddNewEvent() {
    const [uploadProgress, setUploadProgress] = useState({ video: 0, thumbnail: 0 }); // Separate progress
    const [address, setAddress] = useState("");
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
    const navigate = useNavigate();
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);
    const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
    const [selectedVideoFile, setSelectedVideoFile] = useState(null); // To store the selected video file
    const [generatedThumbnailFile, setGeneratedThumbnailFile] = useState(null); // To store the generated thumbnail file

    const { user } = useAuth();
    const plyrRef = useRef(null);

    useEffect(() => {
        if (plyrRef.current && plyrRef.current.plyr && thumbnailPreviewUrl) {
            plyrRef.current.plyr.poster = thumbnailPreviewUrl;
        }
    }, [thumbnailPreviewUrl]);

    const handleVideoChange = async (event) => {
        const file = event.currentTarget.files[0];
        setSelectedVideoFile(file); // Store the selected video file
        setGeneratedThumbnailFile(null); // Reset previous thumbnail file
        setThumbnailPreviewUrl(null);
        setUploadProgress({ video: 0, thumbnail: 0 }); // Reset progress

        if (file) {
            formik.setFieldValue("event_video_file_input", file); // For Yup validation of presence
            setIsGeneratingThumbnail(true);
            try {
                const result = await generateThumbnailFromVideo(file);
                if (result) {
                    setGeneratedThumbnailFile(result.file); // Store generated thumbnail File object
                    if (result.previewUrl) {
                        setThumbnailPreviewUrl(result.previewUrl);
                    }
                    toast.success("Thumbnail generated.");
                }
            } catch (error) {
                console.error("Thumbnail generation failed:", error);
                toast.error(`Failed to generate thumbnail: ${error.message}`);
            } finally {
                setIsGeneratingThumbnail(false);
            }
        } else {
            formik.setFieldValue("event_video_file_input", null);
            setIsGeneratingThumbnail(false);
        }
    };

    // --- Helper function to get signed URL from backend ---
    const getSignedUploadUrl = async (file, type) => {
        try {
            const response = await axiosInstance.post('/events/generate-upload-url', {
                filename: file.name,
                contentType: file.type,
                type: type // 'video' or 'thumbnail'
            });
            return response.data; // { signedUrl, publicUrl, uniqueFilename }
        } catch (error) {
            toast.error(`Failed to get upload URL for ${type}.`);
            console.error(`Error getting signed URL for ${type}:`, error);
            throw error;
        }
    };

    // --- Helper function to upload file to Google Cloud Storage ---
    const uploadFileToGCS = async (file, signedUrl, type) => {
        try {
            await axiosInstance.put(signedUrl, file, {
                headers: {
                    'Content-Type': file.type,
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(prev => ({ ...prev, [type]: percentCompleted }));
                },
            });
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
        } catch (error) {
            toast.error(`Failed to upload ${type}.`);
            console.error(`Error uploading ${type} to GCS:`, error);
            throw error;
        }
    };


    const formik = useFormik({
        initialValues: {
            event_title: "",
            category: "",
            event_date_and_time: null,
            event_duration: "",
            event_address: "", // Will be stringified JSON object before final submit
            additional_info: "",
            ticket_price: "",
            event_description: "",
            event_max_capacity: "",
            // These are for managing file inputs and validation, not directly submitted
            event_video_file_input: null, // For the file input element
            // Final URLs will be added to the payload before submitting to /events/create
            age_restriction: [],
            gender_restriction: [],
        },
        validationSchema: Yup.object({
            event_title: Yup.string().required("Event title is required"),
            category: Yup.string().required("Category is required"),
            event_date_and_time: Yup.date().required("Event date and time are required").typeError("Valid date/time required."),
            event_duration: Yup.number().required("Duration required").min(0.5, "Min 0.5 hours").typeError("Valid number required"),
            event_address: Yup.string().required("Event address is required"),
            additional_info: Yup.string(),
            ticket_price: Yup.number().required("Price required").min(0, "Price cannot be negative"),
            event_description: Yup.string().required("Description required"),
            event_max_capacity: Yup.number().required("Capacity required").integer("Must be whole number").min(1, "Min 1"),
            event_video_file_input: Yup.mixed().required("Event video is required") // Validate presence of selected file
                .test("fileType", "Unsupported video format", (value) => value && value.type && value.type.startsWith("video/")),
            // age_restriction, gender_restriction can have Yup.array()...
        }),
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            setSubmitting(true);
            setUploadProgress({ video: 0, thumbnail: 0 }); // Reset progress

            if (!user) {
                toast.error("You must be logged in.");
                setSubmitting(false);
                return;
            }

            if (!selectedVideoFile) { // Check the state variable holding the File object
                toast.error("Please select a video file.");
                setSubmitting(false);
                return;
            }

            let finalVideoUrl = null;
            let finalThumbnailUrl = null;

            try {
                // --- 1. Upload Video ---
                toast.info("Preparing video for upload...");
                const videoUploadData = await getSignedUploadUrl(selectedVideoFile, 'video');
                finalVideoUrl = videoUploadData.publicUrl; // Store public URL
                await uploadFileToGCS(selectedVideoFile, videoUploadData.signedUrl, 'video');

                // --- 2. Upload Thumbnail (if exists) ---
                if (generatedThumbnailFile) {
                    toast.info("Preparing thumbnail for upload...");
                    const thumbnailUploadData = await getSignedUploadUrl(generatedThumbnailFile, 'thumbnail');
                    finalThumbnailUrl = thumbnailUploadData.publicUrl; // Store public URL
                    await uploadFileToGCS(generatedThumbnailFile, thumbnailUploadData.signedUrl, 'thumbnail');
                } else {
                    toast.info("No thumbnail to upload or generation failed.");
                }

                // --- 3. Prepare data for creating the event (with URLs) ---
                const eventDataPayload = {
                    event_title: values.event_title,
                    category: values.category,
                    event_date_and_time: values.event_date_and_time.toISOString(),
                    event_duration: values.event_duration,
                    event_address: JSON.stringify({
                        address: address, // From PlacesAutocomplete state
                        longitude: coordinates.lng,
                        latitude: coordinates.lat,
                    }),
                    additional_info: values.additional_info || '',
                    ticket_price: values.ticket_price,
                    event_description: values.event_description,
                    event_max_capacity: values.event_max_capacity,
                    age_restriction: JSON.stringify(values.age_restriction || []),
                    gender_restriction: JSON.stringify(values.gender_restriction || []),
                    created_by: user._id,
                    event_video_url: finalVideoUrl, // Use the public URL from GCS
                    thumbnail_url: finalThumbnailUrl, // Use the public URL from GCS (can be null)
                };
                console.log("Payload to /api/events/create:", JSON.stringify(eventDataPayload));
                console.log("Estimated payload size (bytes):", new TextEncoder().encode(JSON.stringify(eventDataPayload)).length);
                // --- 4. Create the event document with the URLs ---
                toast.info("Creating event document...");
                const createResponse = await axiosInstance.post('/events/create', eventDataPayload, {
                    headers: { 'Content-Type': 'application/json' } // Sending JSON now
                });

                console.log("Event creation successful:", createResponse.data);
                toast.success("Event created successfully!");
                resetForm();
                setSelectedVideoFile(null);
                setGeneratedThumbnailFile(null);
                setThumbnailPreviewUrl(null);
                setAddress('');
                setCoordinates({ lat: null, lng: null });
                setUploadProgress({ video: 0, thumbnail: 0 });
                // navigate("/events"); // Optional: navigate after success

            } catch (error) {
                console.error("Error during event creation process:", error);
                // Error might be from getSignedUrl, uploadFileToGCS, or final event creation
                toast.error(error.response?.data?.message || "An error occurred. Please check details and try again.");
                // No need to reset progress here as it reflects the state of the failed upload attempt
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleSelect = async (value) => {
        // ... (your existing handleSelect for PlacesAutocomplete)
        try {
            if (!window.google) throw new Error('Google Maps API not loaded');
            const results = await geocodeByAddress(value);
            if (results && results.length > 0) {
                const latLng = await getLatLng(results[0]);
                setAddress(value);
                setCoordinates(latLng);
                formik.setFieldValue("event_address", value); // For display/validation trigger
            } else {
                toast.warn("Could not find coordinates for the selected address.");
                setAddress(value);
                formik.setFieldValue("event_address", value);
            }
        } catch (error) {
            console.error('[Geocoding Error]', error);
            toast.error("Error processing address.");
            setAddress(value);
            formik.setFieldValue("event_address", value);
        }
    };

    const handleCancel = () => {
        // ... (your existing handleCancel)
        formik.resetForm();
        setSelectedVideoFile(null);
        setGeneratedThumbnailFile(null);
        setUploadProgress({ video: 0, thumbnail: 0 });
        setThumbnailPreviewUrl(null);
        setAddress("");
        setCoordinates({ lat: null, lng: null });
    };

    const categories = ["Recreational", "Religious", "Sports", "Cultural", "Concert", "Conference", "Workshop", "Meetup", "Party"];
    const ageOptions = ["<18", "18 - 29", "30 - 39", "40 <"];
    const genderOptions = ["Male", "Female", "Other"];

    // --- JSX (largely the same, but progress bar might need adjustment) ---
    return (
        <div>
            <Toaster richColors position="top-center" />
            <NavBar />
            <div className="pt-32 lg:px-0 px-3 w-full">
                <form
                    onSubmit={formik.handleSubmit}
                    className="max-w-4xl mx-auto flex flex-col gap-y-4 mb-10"
                >
                    {/* Back Link */}
                    <div className="w-full">
                        <Link to="/events" className="text-sm text-gray-700 hover:text-gray-500 flex items-center mb-4">
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
                                    {formik.touched.event_title && formik.errors.event_title ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_title}</div> : null}
                                </div>
                            </div>

                            {/* Category */}
                            <div className="sm:col-span-3">
                                <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-900">Category *</label>
                                <div className="mt-2">
                                    <select id="category" name="category" {...formik.getFieldProps("category")} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                                        <option value="">Select category</option>
                                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                                    </select>
                                    {formik.touched.category && formik.errors.category ? <div className="text-red-500 text-xs mt-1">{formik.errors.category}</div> : null}
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="sm:col-span-3">
                                <label htmlFor="event_date_and_time" className="block text-sm font-medium leading-6 text-gray-900">Event Date & Time *</label>
                                <div className="mt-2">
                                    <DatePicker id="event_date_and_time" name="event_date_and_time" value={formik.values.event_date_and_time} onChange={(date) => formik.setFieldValue("event_date_and_time", date)} onBlur={() => formik.setFieldTouched("event_date_and_time", true)} format="yyyy-MM-dd HH:mm" placeholder="YYYY-MM-DD HH:mm" caretAs={FaCalendar} style={{ width: '100%' }} className="rs-input" />
                                    {formik.touched.event_date_and_time && formik.errors.event_date_and_time ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_date_and_time}</div> : null}
                                </div>
                            </div>

                            {/* Duration */}
                            <div className="sm:col-span-3">
                                <label htmlFor="event_duration" className="block text-sm font-medium leading-6 text-gray-900">Duration (hours, e.g., 1.5) *</label>
                                <div className="mt-2">
                                    <input type="number" id="event_duration" name="event_duration" min="0.5" step="0.1" {...formik.getFieldProps('event_duration')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_duration && formik.errors.event_duration ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_duration}</div> : null}
                                </div>
                            </div>

                            {/* Address */}
                            <div className="col-span-full">
                                <label htmlFor="event_address_input" className="block text-sm font-medium leading-6 text-gray-900">Event Address *</label> {/* Changed htmlFor to avoid conflict */}
                                <div className="mt-2">
                                    <PlacesAutocomplete value={address} onChange={setAddress} onSelect={handleSelect} searchOptions={{ componentRestrictions: { country: ['ZA'] } }}>
                                        {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
                                            <div className="relative">
                                                <input {...getInputProps({ placeholder: 'Search Places ...', className: 'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6', onBlur: () => formik.setFieldTouched("event_address", true) })} id="event_address_input" name="event_address_input" /> {/* Changed id and name */}
                                                {formik.touched.event_address && formik.errors.event_address && !address ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_address}</div> : null}
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
                                    {formik.touched.ticket_price && formik.errors.ticket_price ? <div className="text-red-500 text-xs mt-1">{formik.errors.ticket_price}</div> : null}
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="event_max_capacity" className="block text-sm font-medium leading-6 text-gray-900">Max Capacity *</label>
                                <div className="mt-2">
                                    <input type="number" id="event_max_capacity" name="event_max_capacity" min="1" step="1" {...formik.getFieldProps('event_max_capacity')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_max_capacity && formik.errors.event_max_capacity ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_max_capacity}</div> : null}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="col-span-full">
                                <label htmlFor="event_description" className="block text-sm font-medium leading-6 text-gray-900">Event Description *</label>
                                <div className="mt-2">
                                    <textarea id="event_description" name="event_description" rows={4} {...formik.getFieldProps('event_description')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.event_description && formik.errors.event_description ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_description}</div> : null}
                                </div>
                                <p className="mt-3 text-sm leading-6 text-gray-600">Write a few sentences about the event.</p>
                            </div>

                            {/* Additional Info */}
                            <div className="col-span-full">
                                <label htmlFor="additional_info" className="block text-sm font-medium leading-6 text-gray-900">Additional Info (Optional)</label>
                                <div className="mt-2">
                                    <input type="text" id="additional_info" name="additional_info" {...formik.getFieldProps('additional_info')} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                                    {formik.touched.additional_info && formik.errors.additional_info ? <div className="text-red-500 text-xs mt-1">{formik.errors.additional_info}</div> : null}
                                </div>
                            </div>

                            {/* Video Upload & Thumbnail Preview */}
                            <div className="col-span-full">
                                <label htmlFor="event_video_file_input" className="block text-sm font-medium leading-6 text-gray-900">Event Video *</label>
                                <div className="mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                                    {thumbnailPreviewUrl && (<div className="mb-4"><p className="text-sm font-medium text-gray-700 mb-2">Thumbnail Preview:</p><img src={thumbnailPreviewUrl} alt="Video thumbnail preview" className="max-w-xs max-h-40 rounded border border-gray-300" /></div>)}
                                    {isGeneratingThumbnail && (<p className="text-sm text-indigo-600 mb-2">Generating thumbnail...</p>)}
                                    <div className="text-center">
                                        <label htmlFor="event_video_file_input" className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                                            <span>{selectedVideoFile ? "Change video" : "Upload a video"}</span>
                                            <input id="event_video_file_input" name="event_video_file_input" type="file" className="sr-only" accept="video/*" onChange={handleVideoChange} />
                                        </label>
                                        <p className="pl-1 text-xs leading-5 text-gray-600">{selectedVideoFile ? selectedVideoFile.name : "MP4, AVI, MOV up to 500MB"}</p>
                                        {formik.touched.event_video_file_input && formik.errors.event_video_file_input ? <div className="text-red-500 text-xs mt-1">{formik.errors.event_video_file_input}</div> : null}
                                    </div>
                                    {/* Progress Bar for Video */}
                                    {uploadProgress.video > 0 && (
                                        <div className="w-full mt-4">
                                            <p className="text-sm text-gray-700 mb-1">Video Upload: {uploadProgress.video}%</p>
                                            <div className="bg-gray-200 rounded-full h-2.5">
                                                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress.video}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Progress Bar for Thumbnail */}
                                    {uploadProgress.thumbnail > 0 && generatedThumbnailFile && (
                                        <div className="w-full mt-2">
                                            <p className="text-sm text-gray-700 mb-1">Thumbnail Upload: {uploadProgress.thumbnail}%</p>
                                            <div className="bg-gray-200 rounded-full h-2.5">
                                                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${uploadProgress.thumbnail}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Restrictions (Age & Gender) - Keep your existing JSX */}
                            <fieldset className="sm:col-span-3">
                                <legend className="text-sm font-semibold leading-6 text-gray-900">Age Restrictions</legend>
                                <div className="mt-4 space-y-2">
                                    {ageOptions.map((age) => (<div key={age} className="relative flex gap-x-3"><div className="flex h-6 items-center"><input id={`age-${age}`} name="age_restriction" type="checkbox" value={age} checked={formik.values.age_restriction.includes(age)} onChange={formik.handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" /></div><div className="text-sm leading-6"><label htmlFor={`age-${age}`} className="font-medium text-gray-900">{age}</label></div></div>))}
                                </div>
                            </fieldset>
                            <fieldset className="sm:col-span-3">
                                <legend className="text-sm font-semibold leading-6 text-gray-900">Gender Restrictions</legend>
                                <p className="mt-1 text-sm leading-6 text-gray-600">Select one option.</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-x-3"><input id="gender-none" name="gender_restriction" type="radio" value="" checked={formik.values.gender_restriction.length === 0 || formik.values.gender_restriction[0] === ''} onChange={() => formik.setFieldValue("gender_restriction", [])} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" /><label htmlFor="gender-none" className="block text-sm font-medium leading-6 text-gray-900">No Restriction</label></div>
                                    {genderOptions.map((gender) => (<div key={gender} className="flex items-center gap-x-3"><input id={`gender-${gender}`} name="gender_restriction" type="radio" value={gender} checked={formik.values.gender_restriction[0] === gender} onChange={() => formik.setFieldValue("gender_restriction", [gender])} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" /><label htmlFor={`gender-${gender}`} className="block text-sm font-medium leading-6 text-gray-900">{gender}</label></div>))}
                                </div>
                            </fieldset>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex items-center justify-end gap-x-6">
                        <button type="button" onClick={handleCancel} className="text-sm font-semibold leading-6 text-gray-900">Cancel</button>
                        <button type="submit" disabled={formik.isSubmitting || isGeneratingThumbnail || uploadProgress.video > 0 && uploadProgress.video < 100 || uploadProgress.thumbnail > 0 && uploadProgress.thumbnail < 100} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
                            {formik.isSubmitting ? "Submitting..." : (isGeneratingThumbnail ? "Processing..." : "Save Event")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}