const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Public routes
router.get('/avatar/:filename', (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(path.join(__dirname, '..', 'uploads', 'avatars', req.params.filename));
});

// Public routes (if any, e.g., for checking email availability) could go here

// Protect all routes after this middleware
router.use(authController.protect);

// Route to get multiple users by ID - useful for populating lists
// Should be defined before generic /:id routes if applicable
router.get('/batch', userController.getUsersByIds);

// Route for managing coach-athlete connections (assuming these exist)
router.post('/assign-coach', authController.restrictTo('admin', 'coach'), userController.assignCoachToAthlete);
router.post('/remove-coach', authController.restrictTo('admin', 'coach'), userController.removeCoachFromAthlete);

// Get current user profile (uses /me alias)
router.get('/me', userController.getMe, userController.getUser);

// Upload profile picture
router.post('/upload-avatar', upload.single('avatar'), userController.uploadAvatar);

// Update current user profile
router.patch('/updateMe', userController.updateMe);

// Update current user password
router.patch('/updateMyPassword', authController.updatePassword);

// Delete current user account
router.delete('/deleteMe', userController.deleteMe);

// Update notification preferences
router
  .route('/notification-preferences')
  .patch(authMiddleware.protect, userController.updateNotificationPreferences);

// --- Admin/Coach Routes ---
router.use(authController.restrictTo('admin', 'coach'));

// Standard REST routes for users (admins/coaches managing other users)
router.route('/')
    .get(userController.getAllUsers)
    .post(userController.createUser); // Or handle creation via signup route?

router.route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

module.exports = router; 