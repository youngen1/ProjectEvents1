const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'upload'); // Correct path: same directory as upload.js

    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
  limits: {
    fileSize: 1024 * 1024 * 50 // 50MB limit (in bytes)
  }
}).single('event_video'); // Handles a *single* file upload with the field name 'event_video'

function checkFileType(file, cb) {
  const filetypes = /mp4|mov|avi|mkv|webm/; // Allowed video extensions
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true); // File is valid
  } else {
    cb('Error: Videos Only (mp4, mov, avi, mkv, webm)!'); // Error message
  }
}

module.exports = upload;