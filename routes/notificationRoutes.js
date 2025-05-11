const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(authMiddleware.protect);

// Routes for user's own notifications
router
  .route('/')
  .get(notificationController.getUserNotifications);

// Mark all notifications as read
router
  .route('/mark-all-read')
  .patch(notificationController.markAllAsRead);

// Mark one notification as read
router
  .route('/:id/mark-read')
  .patch(notificationController.markAsRead);

// Delete a notification
router
  .route('/:id')
  .delete(notificationController.deleteNotification);

// Only admin and coaches can create notifications for users
router.use(authMiddleware.restrictTo('admin', 'coach'));

router
  .route('/create')
  .post(notificationController.createNotification);

module.exports = router; 