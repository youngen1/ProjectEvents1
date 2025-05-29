import React, { useState, useRef, useEffect } from "react"; // Added useRef, useEffect
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { useFormik } from "formik";
import * as Yup from "yup";
import { DatePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import axiosInstance from "../../utils/axiosInstance"; // Your Axios instance
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

// --- Thumbnail Generation Configuration ---
const generateThumbnailFromVideo = (videoFile) => {
  return new Promise((resolve, reject) => {
    // Basic validation
    if (!videoFile?.type.startsWith('video/')) {
      return reject(new Error('Please select a valid video file'));
    }

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const videoUrl = URL.createObjectURL(videoFile);

    video.src = videoUrl;
    video.muted = true; // Required for some browsers to allow playback
    
    video.onloadedmetadata = () => {
      // Calculate 10% of video duration
      const thumbnailTime = video.duration * 0.1;
      
      // Set canvas dimensions (320px width, maintaining aspect ratio)
      canvas.width = 320;
      canvas.height = (320 / video.videoWidth) * video.videoHeight;
      
      // Seek to our calculated time
      video.currentTime = thumbnailTime;
    };

    video.onseeked = () => {
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to JPEG blob
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Failed to create thumbnail'));
        
        // Create thumbnail file
        const thumbnailFile = new File([blob], 'thumbnail.jpg', {
          type: 'image/jpeg'
        });
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(blob);
        
        // Clean up video URL
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
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const navigate = useNavigate();
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null); // For displaying generated thumbnail
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false); // Loading state

  const { user } = useAuth();
  const plyrRef = useRef(null); // Ref for Plyr instance

  // Update Plyr poster when thumbnailPreviewUrl changes
  useEffect(() => {
    if (plyrRef.current && plyrRef.current.plyr && thumbnailPreviewUrl) {
       plyrRef.current.plyr.poster = thumbnailPreviewUrl;
    }
  }, [thumbnailPreviewUrl]);

  // When video changes, generate thumbnail
  const handleVideoChange = async (event) => {
    const file = event.currentTarget.files[0];
    if (file) {
      formik.setFieldValue("event_video", file);
      formik.setFieldValue("thumbnail_file", null); // Reset previous thumbnail
      setThumbnailPreviewUrl(null); // Clear preview
      setIsGeneratingThumbnail(true); // Show loading indicator (optional)
       setVideoUploadProgress(0); // Reset progress on new file select


      try {
        const result = await generateThumbnailFromVideo(file);
        if (result) {
           formik.setFieldValue("thumbnail_file", result.file); // Store the generated thumbnail File
          if (result.previewUrl) {
             setThumbnailPreviewUrl(result.previewUrl); // Set state for preview
          }
           toast.success("Thumbnail generated.");
        }
      } catch (error) {
        console.error("Thumbnail generation failed:", error);
        toast.error(`Failed to generate thumbnail: ${error.message}`);
         formik.setFieldValue("thumbnail_file", null); // Ensure it's null on error
         setThumbnailPreviewUrl(null);
      } finally {
        setIsGeneratingThumbnail(false); // Hide loading indicator
      }
    } else {
      // Handle case where user cancels file selection
      formik.setFieldValue("event_video", null);
      formik.setFieldValue("thumbnail_file", null);
      setThumbnailPreviewUrl(null);
      setIsGeneratingThumbnail(false);
      setVideoUploadProgress(0);
    }
  };

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
      event_video: null, // Will hold the original video File
      thumbnail_file: null, // Will hold the generated thumbnail File
      age_restriction: [],
      gender_restriction: [],
    },
    validationSchema: Yup.object({
      // ... (keep existing validation rules)
      event_title: Yup.string().required("Event title is required"),
      category: Yup.string().required("Category is required"),
      event_date_and_time: Yup.date()
        .required("Event date and time are required")
        .typeError("Please enter a valid date and time (e.g., DD MMM YYYY HH:mm)."),
      event_duration: Yup.number()
        .required("Event duration is required")
        .min(0.5, "Duration must be at least 0.5 hours")
        .typeError("Please enter a valid number for duration"), // Simplified duration validation
      event_address: Yup.string().required("Event address is required"), // Keep simple, geocoding handles complexity
      additional_info: Yup.string(),
      ticket_price: Yup.number().required("Ticket price is required").min(0, "Price cannot be negative"),
      event_description: Yup.string().required("Event description is required"),
      event_max_capacity: Yup.number().required("Event max capacity is required").integer("Must be a whole number").min(1, "Capacity must be at least 1"),
      event_video: Yup.mixed()
        .required("Event video is required")
        .test("fileType", "Unsupported video format", (value) => {
            return value && value.type && value.type.startsWith("video/");
        }),
      thumbnail_file: Yup.mixed().nullable(), // Thumbnail is generated, might not require explicit user validation unless generation fails
      // Consider adding validation for age/gender if needed
    }),
    onSubmit: async (values, { setSubmitting, resetForm }) => { // Added resetForm
      setSubmitting(true);
      setVideoUploadProgress(0); // Reset progress on submit


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
         // Allow submission without thumbnail if generation failed,
         // backend should handle this (maybe use default or skip)
         toast.warning("Thumbnail not generated. Proceeding without it.");
         // Or uncomment below to make it mandatory
         // toast.error("Thumbnail generation failed or is missing. Cannot create event.");
         // setSubmitting(false);
         // return;
      }

      // --- Use FormData to send BOTH files to your backend ---
      const formData = new FormData();
      formData.append('event_video', values.event_video); // Original video
      if(values.thumbnail_file) { // Only append if thumbnail exists
         formData.append('thumbnail_file', values.thumbnail_file); // Generated thumbnail
      }

      // Append other NON-FILE form data *after* files
      // IMPORTANT: Send other data as separate fields, not nested JSON initially
      // unless your backend is specifically set up to parse JSON within FormData
      formData.append('event_title', values.event_title);
      formData.append('category', values.category);
      formData.append('event_date_and_time', values.event_date_and_time.toISOString());
      formData.append('event_duration', values.event_duration);
      formData.append('event_address', JSON.stringify({ // Send address object as JSON string
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
        // --- 1. Upload BOTH video and thumbnail to YOUR backend ---
        // *** YOU NEED TO UPDATE YOUR BACKEND '/upload-media' (or similar)
        //     TO ACCEPT BOTH 'event_video' and 'thumbnail_file' ***
    
        const uploadResponse = await axiosInstance.post('/events/create', formData, { // Use a new or updated endpoint
          headers: {
             'Content-Type': 'multipart/form-data'
            // Content-Type is set automatically by browser for FormData
          },
          onUploadProgress: (progressEvent) => {
            // --- More Robust Progress Calculation ---
            let percentCompleted = 0;
            const loaded = typeof progressEvent.loaded === 'number' ? progressEvent.loaded : -1;
            const currentVideoFileSize = values.event_video?.size; // Get size safely
            const totalSize = progressEvent.total > 0 ? progressEvent.total : (currentVideoFileSize || 0);
    
            // Log values for debugging if needed
            // console.log('[onUploadProgress] Values:', { loaded, total: progressEvent.total, videoFileSize: currentVideoFileSize, calculatedTotal: totalSize });
    
            if (totalSize > 0 && loaded >= 0) {
                percentCompleted = Math.round((loaded * 100) / totalSize);
            } else {
                console.warn("Upload progress total size unknown or invalid.", { loaded, total: totalSize });
                // Handle indeterminate progress if desired (e.g., set to 1 if loaded > 0)
            }
    
            percentCompleted = Math.min(Math.max(percentCompleted, 0), 100); // Clamp 0-100
    
            // console.log('[onUploadProgress] Calculated Percent:', percentCompleted);
            setVideoUploadProgress(percentCompleted);
            // --- End of Robust Calculation ---
        },
        });

        // --- 2. Your backend should process both, save them (e.g., to Firebase), ---
        //     and return the final URLs in the response data.
        const { videoURL, thumbnailURL } = uploadResponse.data; // Assuming backend returns these


        // --- 3. Create the event document using the final URLs ---
        // NOTE: We already sent most data with the upload. If your backend
        // creates the event during upload, this step might not be needed OR
        // it might just need the IDs/URLs. Adjust based on your backend logic.

        // Example: If backend ONLY uploads and returns URLs, create event separately:
        /*
        const createResponse = await axiosInstance.post('/events/create', {
          event_title: values.event_title,
          category: values.category,
          event_date_and_time: values.event_date_and_time.toISOString(),
          event_duration: values.event_duration,
          event_address: JSON.stringify({ address: address, longitude: coordinates.lng, latitude: coordinates.lat }),
          additional_info: values.additional_info,
          ticket_price: values.ticket_price,
          event_description: values.event_description,
          event_max_capacity: values.event_max_capacity,
          age_restriction: JSON.stringify(values.age_restriction),
          gender_restriction: JSON.stringify(values.gender_restriction),
          event_video: videoURL, // Final video URL from backend
          thumbnail: thumbnailURL, // Final thumbnail URL from backend
          created_by: user._id,
        });
        */
       // Assuming the '/upload-event-media' endpoint handles event creation:
        console.log("Upload and creation successful (assuming backend handled it):", uploadResponse.data);


        setSubmitting(false);
        toast.success("Event created successfully!");
        resetForm(); // Reset form fields
        setThumbnailPreviewUrl(null); // Clear preview
        setAddress(''); // Clear address state
        setCoordinates({ lat: null, lng: null }); // Clear coordinates
        setVideoUploadProgress(0); // Reset progress bar
        // navigate("/events"); // Consider delaying navigation or showing success message differently

      } catch (error) {
        console.error("Error uploading media or creating event:", error);
        toast.error(error.response?.data?.message || "An error occurred during event creation.");
        setSubmitting(false);
         setVideoUploadProgress(0); // Reset progress on error
      }
    },
  });

  // ... (rest of handleSelect, handleCancel, categories, options remain the same)
  const handleSelect = async (value) => {
  console.log('[Address Selection] Starting handleSelect with value:', value);
  
  try {
    // 1. Check if Google Maps API is loaded
    if (!window.google) {
      const errorMsg = 'Google Maps API not loaded - window.google is undefined';
      console.error(errorMsg);
      toast.error('Map services not available. Please refresh the page.');
      throw new Error(errorMsg);
    } else {
      console.log('[Google API] window.google exists:', window.google);
    }

    // 2. Log before geocoding
    console.log('[Geocoding] Starting geocodeByAddress for:', value);
    const results = await geocodeByAddress(value);
    console.log('[Geocoding] Results:', results);

    if (results && results.length > 0) {
      console.log('[Geocoding] First result geometry:', results[0].geometry);
      
      // 3. Log before getting lat/lng
      console.log('[Coordinates] Getting lat/lng...');
      const latLng = await getLatLng(results[0]);
      console.log('[Coordinates] Received:', latLng);

      setAddress(value);
      setCoordinates(latLng);
      formik.setFieldValue("event_address", value);
      console.log('[State Update] Address and coordinates set successfully');
    } else {
      const errorMsg = 'No results returned from geocoding';
      console.warn(errorMsg, results);
      toast.error("Could not find coordinates for the selected address.");
      setAddress(value);
      formik.setFieldValue("event_address", value);
    }
  } catch (error) {
    console.error(
      '[Error] Full geocoding error:',
      error,
      '\nError details:',
      error.message,
      '\nStack:',
      error.stack
    );
    
    // Enhanced error logging
    if (error.message.includes('InvalidValueError')) {
      console.error('[Google API] Likely API key or quota issue');
    } else if (error.message.includes('ZERO_RESULTS')) {
      console.warn('[Google API] No results for this address');
    }

    toast.error("Error processing address. See console for details.");
    setAddress(value);
    formik.setFieldValue("event_address", value);
  }
};
  //  const handleSelect = async (value) => {
  //   try {
  //       const results = await geocodeByAddress(value);
  //       if (results && results.length > 0) {
  //           const latLng = await getLatLng(results[0]);
  //           setAddress(value);
  //           setCoordinates(latLng);
  //           formik.setFieldValue("event_address", value); // Keep this simple for display/validation
  //       } else {
  //            toast.error("Could not find coordinates for the selected address.");
  //            setAddress(value); // Still set address for display
  //            formik.setFieldValue("event_address", value);
  //       }
  //   } catch (error) {
  //        console.error('Error during geocoding:', error);
  //        toast.error("Error finding coordinates for the address.");
  //        setAddress(value); // Still set address for display
  //        formik.setFieldValue("event_address", value);
  //   }
  // };

  const handleCancel = () => {
     formik.resetForm();
        setVideoUploadProgress(0);
        setThumbnailPreviewUrl(null); // Reset thumbnail preview
        setAddress("");
        setCoordinates({ lat: null, lng: null });
        // Maybe navigate back or show confirmation
  };

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
  const ageOptions = ["<18", "18 - 29", "30 - 39", "40 <"];
  const genderOptions = ["Male", "Female", "Other"];


  // --- JSX ---
  return (
    <div>
      <Toaster richColors position="top-center" /> {/* Centered toaster */}
      <NavBar />
      <div className="pt-32 lg:px-0 px-3 w-full ">
        <form
          onSubmit={formik.handleSubmit}
          className="max-w-4xl mx-auto flex flex-col gap-y-4 mb-10" // Added bottom margin
        >
          {/* Back Link */}
          <div className="w-full">
             <Link
                to="/events"
                className="text-sm text-gray-700 hover:text-gray-500 flex items-center mb-4"
              >
                <svg
                  className="w-4 h-4 mr-1" // Added margin
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
                Back to Events
              </Link>
          </div>


          {/* Event Info Section */}
          <div className="border-b border-gray-900/10 pb-12">
            <h2 className="text-base font-semibold leading-7 text-gray-900">
              Event Information
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Provide details about your event.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              {/* Fields */}
                 <div className="col-span-full">
                  <label
                    for="event_title"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Event Title *
                  </label>
                  <div className="mt-2">
                    <input
                      id="event_title"
                      name="event_title"
                      type="text"
                      {...formik.getFieldProps("event_title")}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                    {formik.touched.event_title && formik.errors.event_title ? (
                      <div className="text-red-500 text-xs mt-1">
                        {formik.errors.event_title}
                      </div>
                    ) : null}
                  </div>
                </div>

                 {/* Category */}
                <div className="sm:col-span-3">
                  <label
                    for="category"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Category *
                  </label>
                  <div className="mt-2">
                    <select
                      id="category"
                      name="category"
                      {...formik.getFieldProps("category")}
                     className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                     {formik.touched.category && formik.errors.category ? (
                      <div className="text-red-500 text-xs mt-1">{formik.errors.category}</div>
                    ) : null}
                  </div>
                </div>

                  {/* Date & Time */}
                <div className="sm:col-span-3">
                  <label
                    for="event_date_and_time"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Event Date & Time *
                  </label>
                  <div className="mt-2">
                     <DatePicker
                      id="event_date_and_time"
                      name="event_date_and_time"
                      value={formik.values.event_date_and_time}
                      onChange={(date) => formik.setFieldValue("event_date_and_time", date)}
                      onBlur={() => formik.setFieldTouched("event_date_and_time", true)} // Trigger touch on blur
                      format="yyyy-MM-dd HH:mm" // Standard format
                      placeholder="YYYY-MM-DD HH:mm"
                      caretAs={FaCalendar}
                      style={{ width: '100%' }} // Use style for width with rsuite
                      className="rs-input" // Add rsuite class if needed for styling consistency
                    />
                    {formik.touched.event_date_and_time && formik.errors.event_date_and_time ? (
                      <div className="text-red-500 text-xs mt-1">{formik.errors.event_date_and_time}</div>
                    ) : null}
                  </div>
                </div>

                {/* Duration */}
                 <div className="sm:col-span-3">
                  <label for="event_duration" className="block text-sm font-medium leading-6 text-gray-900">
                    Duration (hours, e.g., 1.5) *
                  </label>
                  <div className="mt-2">
                    <input
                      type="number"
                      id="event_duration"
                      name="event_duration"
                      min="0.5"
                      step="0.1" // Allow finer steps like 1.5, 2.1 etc. if needed
                      {...formik.getFieldProps('event_duration')}
                       className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                     {formik.touched.event_duration && formik.errors.event_duration ? (
                        <div className="text-red-500 text-xs mt-1">{formik.errors.event_duration}</div>
                      ) : null}
                  </div>
                </div>

                 {/* Address */}
                <div className="col-span-full">
                  <label For="event_address" className="block text-sm font-medium leading-6 text-gray-900">
                    Event Address *
                  </label>
                  <div className="mt-2">
                     <PlacesAutocomplete
                        value={address}
                        onChange={setAddress}
                        onSelect={handleSelect}
                         searchOptions={{ componentRestrictions: { country: ['ZA'] } }} // Restrict suggestions
                      >
                      {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
                        <div className="relative">
                          <input
                            {...getInputProps({
                              placeholder: 'Search Places ...',
                              className: 'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6',
                              onBlur: () => formik.setFieldTouched("event_address", true) // Trigger touch on blur
                            })}
                             id="event_address" // Ensure ID matches label
                             name="event_address" // Ensure name matches Formik field if needed directly
                          />
                           {formik.touched.event_address && formik.errors.event_address && !address ? ( // Show error only if field was touched and address is empty
                              <div className="text-red-500 text-xs mt-1">{formik.errors.event_address}</div>
                            ) : null}
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                            {loading && <div className="px-4 py-2 text-gray-500">Loading...</div>}
                            {suggestions.map(suggestion => {
                              const className = suggestion.active
                                ? 'suggestion-item--active px-4 py-2 bg-indigo-100 cursor-pointer'
                                : 'suggestion-item px-4 py-2 hover:bg-gray-100 cursor-pointer';
                              return (
                                <div
                                  {...getSuggestionItemProps(suggestion, { className })}
                                  key={suggestion.placeId || suggestion.description} // Use placeId if available
                                >
                                   <span className="flex items-center"><FiMapPin className="mr-2 text-gray-400" />{suggestion.description}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </PlacesAutocomplete>
                  </div>
                </div>


                 {/* Ticket Price & Capacity */}
                <div className="sm:col-span-3">
                    <label For="ticket_price" className="block text-sm font-medium leading-6 text-gray-900">
                        Ticket Price (ZAR) *
                    </label>
                    <div className="mt-2">
                        <input
                            type="number"
                            id="ticket_price"
                            name="ticket_price"
                            min="0"
                            step="0.01" // Allow cents
                            {...formik.getFieldProps('ticket_price')}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                         {formik.touched.ticket_price && formik.errors.ticket_price ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.ticket_price}</div>
                          ) : null}
                    </div>
                </div>
                 <div className="sm:col-span-3">
                    <label For="event_max_capacity" className="block text-sm font-medium leading-6 text-gray-900">
                        Max Capacity *
                    </label>
                    <div className="mt-2">
                        <input
                            type="number"
                            id="event_max_capacity"
                            name="event_max_capacity"
                            min="1"
                            step="1"
                           {...formik.getFieldProps('event_max_capacity')}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                         {formik.touched.event_max_capacity && formik.errors.event_max_capacity ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.event_max_capacity}</div>
                          ) : null}
                    </div>
                </div>

                 {/* Description */}
                 <div className="col-span-full">
                    <label For="event_description" className="block text-sm font-medium leading-6 text-gray-900">
                        Event Description *
                    </label>
                    <div className="mt-2">
                        <textarea
                            id="event_description"
                            name="event_description"
                            rows={4}
                             {...formik.getFieldProps('event_description')}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                         />
                          {formik.touched.event_description && formik.errors.event_description ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.event_description}</div>
                          ) : null}
                    </div>
                     <p className="mt-3 text-sm leading-6 text-gray-600">Write a few sentences about the event.</p>
                </div>

                {/* Additional Info */}
                <div className="col-span-full">
                    <label for="additional_info" className="block text-sm font-medium leading-6 text-gray-900">
                        Additional Info (Optional)
                    </label>
                    <div className="mt-2">
                        <input
                            type="text"
                            id="additional_info"
                            name="additional_info"
                           {...formik.getFieldProps('additional_info')}
                           className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                          {formik.touched.additional_info && formik.errors.additional_info ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.additional_info}</div>
                          ) : null}
                    </div>
                </div>

                 {/* Video Upload & Thumbnail Preview */}
                 <div className="col-span-full">
                    <label for="event_video" className="block text-sm font-medium leading-6 text-gray-900">
                      Event Video *
                    </label>
                    <div className="mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                       {/* Thumbnail Preview Area */}
                       {thumbnailPreviewUrl && (
                         <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Thumbnail Preview:</p>
                            <img src={thumbnailPreviewUrl} alt="Video thumbnail preview" className="max-w-xs max-h-40 rounded border border-gray-300" />
                         </div>
                       )}
                       {isGeneratingThumbnail && (
                          <p className="text-sm text-indigo-600 mb-2">Generating thumbnail...</p>
                       )}

                      <div className="text-center">
                        {/* Icon removed for simplicity, focus on label */}
                        <label for="event_video" className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                          <span>{formik.values.event_video ? "Change video" : "Upload a video"}</span>
                          <input id="event_video" name="event_video" type="file" className="sr-only" accept="video/*" onChange={handleVideoChange} />
                        </label>
                        <p className="pl-1 text-xs leading-5 text-gray-600">{formik.values.event_video ? formik.values.event_video.name : "MP4, AVI, MOV up to 500MB"}</p>
                         {formik.touched.event_video && formik.errors.event_video ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.event_video}</div>
                          ) : null}
                      </div>
                       {/* Progress Bar */}
                        {videoUploadProgress > 0 && videoUploadProgress < 100 && (
                           <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${videoUploadProgress}%` }}></div>
                          </div>
                        )}
                        {videoUploadProgress === 100 && (
                           <p className="text-sm text-green-600 mt-2">Upload complete!</p>
                        )}
                    </div>
                  </div>


                  {/* Restrictions */}
                  <fieldset className="sm:col-span-3">
                    <legend className="text-sm font-semibold leading-6 text-gray-900">Age Restrictions</legend>
                     <div className="mt-4 space-y-2">
                      {ageOptions.map((age) => (
                        <div key={age} className="relative flex gap-x-3">
                          <div className="flex h-6 items-center">
                            <input
                              id={`age-${age}`}
                              name="age_restriction"
                              type="checkbox"
                              value={age}
                              checked={formik.values.age_restriction.includes(age)}
                              onChange={formik.handleChange} // Formik handles checkbox groups well
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            />
                          </div>
                          <div className="text-sm leading-6">
                            <label for={`age-${age}`} className="font-medium text-gray-900">{age}</label>
                          </div>
                        </div>
                       ))}
                    </div>
                  </fieldset>

                  <fieldset className="sm:col-span-3">
                     <legend className="text-sm font-semibold leading-6 text-gray-900">Gender Restrictions</legend>
                      <p className="mt-1 text-sm leading-6 text-gray-600">Select one option.</p>
                      <div className="mt-4 space-y-2">
                         {/* No Restriction Option */}
                         <div className="flex items-center gap-x-3">
                             <input
                                id="gender-none"
                                name="gender_restriction" // Same name for radio group
                                type="radio"
                                value="" // Empty value means no specific gender
                                checked={formik.values.gender_restriction.length === 0 || formik.values.gender_restriction[0] === ''}
                                onChange={() => formik.setFieldValue("gender_restriction", [])} // Set to empty array for "none"
                                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                             />
                             <label for="gender-none" className="block text-sm font-medium leading-6 text-gray-900">No Restriction</label>
                         </div>
                         {/* Specific Gender Options */}
                         {genderOptions.map((gender) => (
                             <div key={gender} className="flex items-center gap-x-3">
                                 <input
                                    id={`gender-${gender}`}
                                    name="gender_restriction" // Same name
                                    type="radio"
                                    value={gender}
                                    checked={formik.values.gender_restriction[0] === gender} // Check if the first element matches
                                    onChange={() => formik.setFieldValue("gender_restriction", [gender])} // Set as array with one element
                                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                 />
                                 <label for={`gender-${gender}`} className="block text-sm font-medium leading-6 text-gray-900">{gender}</label>
                             </div>
                         ))}
                      </div>
                  </fieldset>


            </div>
          </div>


          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-x-6">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm font-semibold leading-6 text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formik.isSubmitting || isGeneratingThumbnail}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {formik.isSubmitting ? "Saving..." : (isGeneratingThumbnail ? "Processing..." : "Save Event")}
            </button>
          </div>
        </form>
      </div>
     
    </div>
  );
}
