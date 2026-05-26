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
/**
 * Delete an asset from Cloudinary by its public_id.
 * Extracts public_id from a full Cloudinary URL if needed.
 * Fails silently — a missing asset shouldn't break a delete operation.
 */
async function deleteFromCloudinary(urlOrPublicId) {
    if (!urlOrPublicId) return;
    try {
        // If it's a full URL, extract the public_id
        // Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/image/upload/v123/<folder/public_id>.ext
        let publicId = urlOrPublicId;
        if (urlOrPublicId.startsWith('http')) {
            const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            if (!match) return;
            publicId = match[1]; // e.g. "pitchshuffle/avatars/avatar_abc123"
        }
        await cloudinary.uploader.destroy(publicId);
    } catch (e) {
        console.error('Cloudinary delete failed (non-fatal):', e.message);
    }
}

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary };
