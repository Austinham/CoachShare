const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/appError');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars');
  },
  filename: (req, file, cb) => {
    // Generate random filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = process.env.ALLOWED_FILE_TYPES.split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Please upload only images.', 400), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  }
});

// Middleware to handle file upload errors
exports.handleFileUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 5MB.', 400));
    }
    return next(new AppError('Error uploading file.', 400));
  }
  next(err);
};

// Export configured upload middleware
exports.uploadSingle = upload.single('avatar');
exports.uploadMultiple = upload.array('files', 5); // Max 5 files 