const multer     = require('multer');
const cloudinary = require('./cloudinary');

// Store file in memory as a buffer — never touches disk
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter(req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer   - File buffer from multer memoryStorage
 * @param {string} folder   - Cloudinary folder (e.g. 'pitchshuffle/avatars')
 * @param {object} options  - Extra Cloudinary upload options
 * @returns {Promise<string>} - Secure URL of the uploaded image
 */
function uploadToCloudinary(buffer, folder, options = {}) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, ...options },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

module.exports = { upload, uploadToCloudinary };
