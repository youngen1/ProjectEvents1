// middleware/multerConfig.js
const multer = require('multer');
const path = require('path');

const MAX_VIDEO_SIZE_MB = 500;
// const MAX_THUMBNAIL_SIZE_MB = 10; // Not directly used in overall limits, but good for reference

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log(`[Multer FileFilter] Field: ${file.fieldname}, Original Name: ${file.originalname}, Mimetype: ${file.mimetype}, Size: ${file.size} bytes`);

    if (file.fieldname === 'event_video') {
        const isVideoMimetype = file.mimetype.startsWith('video/');
        // Extensions are a weaker check, but can be a fallback or secondary check
        // const allowedVideoExtensions = /mp4|mov|avi|wmv|mkv|webm|quicktime/;
        // const hasAllowedExtension = allowedVideoExtensions.test(path.extname(file.originalname).toLowerCase());

        if (isVideoMimetype) {
            console.log(`[Multer FileFilter] Accepted event_video: ${file.originalname} (Mimetype: ${file.mimetype})`);
            cb(null, true);
        } else {
            console.warn(`[Multer FileFilter] Rejected event_video: ${file.originalname}. Invalid mimetype: ${file.mimetype}. Expected video/*.`);
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Event video must be a video file (received ${file.mimetype}).`), false);
        }
    } else if (file.fieldname === 'thumbnail_file') {
        const isImageMimetype = file.mimetype.startsWith('image/');
        // const allowedImageExtensions = /jpeg|jpg|png|gif|webp/;
        // const hasAllowedExtension = allowedImageExtensions.test(path.extname(file.originalname).toLowerCase());

        if (isImageMimetype) {
            console.log(`[Multer FileFilter] Accepted thumbnail_file: ${file.originalname} (Mimetype: ${file.mimetype})`);
            cb(null, true);
        } else {
            console.warn(`[Multer FileFilter] Rejected thumbnail_file: ${file.originalname}. Invalid mimetype: ${file.mimetype}. Expected image/*.`);
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Thumbnail must be an image file (received ${file.mimetype}).`), false);
        }
    } else {
        console.warn(`[Multer FileFilter] Rejected unexpected file field: ${file.fieldname}`);
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unexpected file field: ${file.fieldname}`), false);
    }
};

const limits = {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024, // Overall limit for any single file
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
});

// The line `upload._fileFilter = fileFilter;` is unnecessary as multer uses the one passed in the options.
// You can remove it.

module.exports = upload;