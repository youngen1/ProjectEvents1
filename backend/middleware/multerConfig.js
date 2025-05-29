// const multer = require('multer');
// const path = require('path');

// // --- Configuration ---
// const MAX_VIDEO_SIZE_MB = 500; // Maximum allowed video size in Megabytes
// const MAX_THUMBNAIL_SIZE_MB = 10;  // Maximum allowed thumbnail size in Megabytes

// // === Storage Engine ===
// // Use memoryStorage to keep the file as a buffer in memory.
// // This is efficient if you are immediately uploading it to another service (like Firebase)
// // and don't need to save it temporarily to disk.
// const storage = multer.memoryStorage();

// // === File Filter ===
// // This function checks the file type to ensure only allowed types are uploaded.
// const fileFilter = (req, file, cb) => {
//     // Check the fieldname to apply specific type checks
//     if (file.fieldname === 'event_video') {
//         // Allowed video mimetypes (add more if needed)
//         const allowedVideoTypes = /mp4|mov|avi|wmv|mkv|webm/;
//         const mimetype = file.mimetype.startsWith('video/');
//         const extname = allowedVideoTypes.test(path.extname(file.originalname).toLowerCase());

//         if (mimetype && extname) {
//             cb(null, true); // Accept the file
//         } else {
//             cb(new Error('Invalid file type for video. Only video formats (mp4, mov, avi, etc.) are allowed.'), false); // Reject the file
//         }
//     } else if (file.fieldname === 'thumbnail_file') {
//         // Allowed image mimetypes
//         const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
//         const mimetype = file.mimetype.startsWith('image/');
//         const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());

//         if (mimetype && extname) {
//             cb(null, true); // Accept the file
//         } else {
//             cb(new Error('Invalid file type for thumbnail. Only image formats (jpg, png, gif, webp) are allowed.'), false); // Reject the file
//         }
//     } else {
//         // If the fieldname doesn't match expected fields, reject it
//         cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
//     }
// };

// // === Limits ===
// // Define limits for file uploads to prevent abuse.
// const limits = {
//     fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024, // Apply the largest limit overall (video size)
//     // You could add more specific limits like 'files' (max number of files), etc.
// };


// // === Multer Instance ===
// // Create the Multer instance with the defined storage, fileFilter, and limits.
// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: limits
// });

// // Export the configured Multer instance
// module.exports = upload;

const multer = require('multer');
const path = require('path');

const MAX_VIDEO_SIZE_MB = 500;
const MAX_THUMBNAIL_SIZE_MB = 10;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log(`Processing file: ${file.fieldname} - ${file.originalname}`);
  console.log(`MIME type: ${file.mimetype}`);
  console.log(`File size: ${file.size} bytes`);

  if (file.fieldname === 'event_video') {
        // Allowed video mimetypes/extensions
        const allowedVideoTypes = /mp4|mov|avi|wmv|mkv|webm|quicktime/; // Added quicktime
        const mimetype = file.mimetype.startsWith('video/');
        const extname = allowedVideoTypes.test(path.extname(file.originalname).toLowerCase());
    console.log('Checking video file');
     if (mimetype) { // Primarily rely on mimetype if available
             cb(null, true);
        } else if(extname) { // Fallback to extension
             cb(null, true);
        }
         else {
            cb(new Error('Invalid file type for video.'), false);
        }
  } else if (file.fieldname === 'thumbnail_file') {
    console.log('Checking thumbnail file');
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = file.mimetype.startsWith('image/');
    const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      console.log('Thumbnail file accepted');
      cb(null, true);
    } else {
      console.log('Invalid thumbnail file type');
      cb(new Error('Invalid file type for thumbnail. Only image formats (jpg, png, gif, webp) are allowed.'), false);
    }
  } else {
    console.log(`Unexpected file field: ${file.fieldname}`);
    cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
  }
};

const limits = {
  fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

upload._fileFilter = fileFilter;

module.exports = upload;
