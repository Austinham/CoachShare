const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose'); // Keep for ID validation if needed in controller

// Create a new notification (Called internally or via specific routes?)
// Ensure proper authorization if exposed via route
exports.createNotification = catchAsync(async (req, res, next) => {
    // Basic validation (more robust validation recommended)
    const { title, message, type, userId, relatedId } = req.body;
    if (!title || !message || !type || !userId) {
        return next(new AppError('Missing required notification fields (title, message, type, userId).', 400));
    }

    console.log(`Controller: Creating notification for user ${userId}`);
    const notification = await notificationService.createNotification(req.body);

    res.status(201).json({
        status: 'success',
        data: { notification }
    });
});

// Get notifications for the current user
exports.getUserNotifications = catchAsync(async (req, res, next) => {
    const userId = req.user.id; // Assumes protect middleware ran
    console.log(`Controller: Fetching notifications for user ${userId}`);

    const { notifications, total, totalPages, currentPage } =
        await notificationService.fetchUserNotifications(userId, req.query);

    res.status(200).json({
        status: 'success',
        results: notifications.length,
        totalPages,
        currentPage,
        total,
        data: { notifications }
    });
});

// Mark a notification as read
exports.markAsRead = catchAsync(async (req, res, next) => {
    const notificationId = req.params.id; // Get ID from route parameter
    const userId = req.user.id;

    // Remove potential prefix if frontend sends it (safer to handle in controller)
    const actualId = notificationId.startsWith('notification-')
        ? notificationId.replace('notification-', '')
        : notificationId;

    console.log(`Controller: Marking notification ${actualId} as read for user ${userId}`);
    const notification = await notificationService.markNotificationAsRead(actualId, userId);

    res.status(200).json({
        status: 'success',
        data: { notification }
    });
});

// Mark all notifications as read
exports.markAllAsRead = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    console.log(`Controller: Marking all notifications as read for user ${userId}`);
    const modifiedCount = await notificationService.markAllUserNotificationsAsRead(userId);

    res.status(200).json({
        status: 'success',
        message: `Marked ${modifiedCount} notifications as read.`,
        data: { modifiedCount }
    });
});

// Delete a notification
exports.deleteNotification = catchAsync(async (req, res, next) => {
    const notificationId = req.params.id; // Get ID from route parameter
    const userId = req.user.id;

     // Remove potential prefix
    const actualId = notificationId.startsWith('notification-')
        ? notificationId.replace('notification-', '')
        : notificationId;

    console.log(`Controller: Deleting notification ${actualId} for user ${userId}`);
    await notificationService.deleteUserNotification(actualId, userId);

    res.status(204).json({ // 204 No Content
        status: 'success',
        data: null
    });
}); 