const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const Event = require('./models/Event'); // Ensure this path is correct
const fs = require('fs/promises');
const admin = require('firebase-admin'); // Import firebase-admin

// --- Firebase Admin SDK Initialization ---
// Ensure this path points to your actual service account key file
const serviceAccount = require('./service_account/event-management-1a68f-firebase-adminsdk-7tfgz-119fb4ef0b.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "event-management-1a68f.appspot.com", // Your storage bucket
});

const bucket = admin.storage().bucket();

// --- Configuration ---
const TEMP_DIRECTORY = path.join(__dirname, 'temp');
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;
const THUMBNAIL_TIME = 5;

// --- Helper Functions ---

/**
 * Extracts the relative storage path from a Firebase Storage download URL.
 */
function getPathFromStorageUrl(url) {
    if (!url || typeof url !== 'string') {
        console.warn(`[getPathFromStorageUrl] Invalid URL input: ${url}`);
        return null;
    }
    try {
        const parsedUrl = new URL(url);
        // Pathname looks like: /v0/b/YOUR_BUCKET/o/videos%2Fmy-video.mp4
        const pathPrefix = `/v0/b/${bucket.name}/o/`;
        if (parsedUrl.pathname.startsWith(pathPrefix)) {
            const encodedPath = parsedUrl.pathname.substring(pathPrefix.length);
            return decodeURIComponent(encodedPath); // Decode URL encoding (e.g., %2F -> /)
        }
        // Handle cases where the URL might already be just the path (less common but possible)
        if (!url.startsWith('http') && !url.startsWith('/')) {
             // Assume it might already be the relative path if it doesn't look like a URL
             // You might need more robust checking depending on your data consistency
             console.log(`[getPathFromStorageUrl] Input doesn't look like a full URL, assuming relative path: ${url}`);
             return url;
        }
        console.warn(`[getPathFromStorageUrl] URL did not match expected format: ${url}`);
        return null;
    } catch (e) {
        // If URL parsing fails, it might already be a relative path or invalid
        if (!url.startsWith('http') && !url.startsWith('/')) {
            console.log(`[getPathFromStorageUrl] Assuming relative path after URL parse error: ${url}`);
            return url;
        }
        console.error(`[getPathFromStorageUrl] Error parsing URL: ${url}`, e);
        return null;
    }
}


/**
 * Downloads a file from Firebase Storage (Admin SDK version).
 */
async function downloadFileFromStorage(storagePath, localPath) {
    try {
        await bucket.file(storagePath).download({ destination: localPath });
        console.log(`File downloaded from ${storagePath} to ${localPath}`);
    } catch (error) {
        console.error(`Error downloading file from ${storagePath}:`, error);
        throw error; // Re-throw for handling in the main loop
    }
}

/**
 * Generates a thumbnail. (No change needed)
 */
async function generateThumbnail(videoPath, eventId) {
    const thumbnailFilename = `thumbnail-${eventId}.jpg`;
    const thumbnailPath = path.join(TEMP_DIRECTORY, thumbnailFilename);

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [THUMBNAIL_TIME],
                filename: thumbnailFilename,
                folder: TEMP_DIRECTORY,
                size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`,
            })
            .on('end', () => resolve(thumbnailPath))
            .on('error', (err) => reject(err));
    });
}

/**
 * Uploads a file to Firebase Storage (Admin SDK version).
 */
async function uploadFileToStorage(localFilePath, storagePath) {
    try {
        const [file] = await bucket.upload(localFilePath, {
            destination: storagePath,
            public: true, // Make the uploaded file publicly accessible
        });
         // Using getSignedUrl is often more robust for public access URLs
         const [publicUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491' // A date very far in the future
        });
        console.log(`File uploaded to ${storagePath}, public URL: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error(`Error uploading file ${localFilePath} to ${storagePath}:`, error);
        throw error;
    }
}

async function ensureDirectoriesExist() {
    try {
        await fs.mkdir(TEMP_DIRECTORY, { recursive: true });
    } catch (error) {
        console.error("Error creating directories:", error);
        throw error;
    }
}

// Helper to safely delete a file, ignoring ENOENT errors
async function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
        console.log(`Successfully deleted temporary file: ${filePath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Error deleting temporary file ${filePath}:`, error);
        }
    }
}

// --- Main Script ---

async function generateThumbnailsForExistingVideos() {
    try {
        await ensureDirectoriesExist();

        // Corrected mongoose.connect syntax and removed deprecated options
        await mongoose.connect(
            'mongodb+srv://event:123@ac-eg4umfm.vltaguz.mongodb.net/event-circle?authSource=admin&retryWrites=true&w=majority&appName=Cluster0'
           
        );
        console.log('Connected to MongoDB Atlas');

        const eventsWithoutThumbnails = await Event.find({
            thumbnail: { $exists: false },
            event_video: { $exists: true, $ne: "" }
        });

        console.log(`Found ${eventsWithoutThumbnails.length} events without thumbnails.`);

        for (const event of eventsWithoutThumbnails) {
            let localVideoPath = null;
            let localThumbnailPath = null;

            try {
                const fullVideoUrl = event.event_video;
                // **CRITICAL FIX: Extract the relative path**
                const storageVideoPath = getPathFromStorageUrl(fullVideoUrl);

                if (!storageVideoPath) {
                    console.error(`Could not extract valid storage path from URL for event ${event._id}: ${fullVideoUrl}. Skipping.`);
                    continue; // Skip to the next event if path extraction fails
                }

                // Use original extension if possible, default to .mp4
                const videoExtension = path.extname(storageVideoPath) || '.mp4';
                localVideoPath = path.join(TEMP_DIRECTORY, `tempvideo-${event._id}${videoExtension}`);

                // Download using the relative path
                await downloadFileFromStorage(storageVideoPath, localVideoPath);
                // Download successful

                // Generate thumbnail
                localThumbnailPath = await generateThumbnail(localVideoPath, event._id);
                console.log(`Generated thumbnail for event ${event._id} at ${localThumbnailPath}`);

                // Upload thumbnail
                const storageThumbnailPath = `thumbnails/${path.basename(localThumbnailPath)}`;
                const downloadURL = await uploadFileToStorage(localThumbnailPath, storageThumbnailPath);

                // Update database
                event.thumbnail = downloadURL;
                await event.save();
                console.log(`Updated event ${event._id} with thumbnail URL: ${downloadURL}`);

            } catch (error) {
                console.error(`Error processing event ${event._id}:`, error);
                 if (error.code === 404 || (error.code === 'storage/object-not-found')) {
                     console.error(`Failed URL was likely: ${event.event_video} (extracted path: ${getPathFromStorageUrl(event.event_video)})`);
                 }
            } finally {
                // **CRITICAL FIX: Use safeUnlink for cleanup**
                await safeUnlink(localVideoPath);
                await safeUnlink(localThumbnailPath);
            }
        }

        console.log('Thumbnail generation process completed.');

    } catch (err) {
        console.error('An overall script error occurred:', err);
    } finally {
        // Ensure disconnection even if errors occurred
        if (mongoose.connection.readyState === 1) { // 1 means connected
             await mongoose.disconnect();
             console.log('Disconnected from MongoDB');
        } else {
            console.log('MongoDB was not connected, skipping disconnect.');
        }
    }
}

// --- Run the script ---
generateThumbnailsForExistingVideos();