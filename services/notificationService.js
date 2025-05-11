// server/services/notificationService.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const websocketService = require('./websocketService');

/**
 * Creates a new notification for a user.
 * @param {object} notificationData - Data including title, message, type, userId, relatedId.
 * @returns {Promise<object>} - The created notification document.
 * @throws {AppError} If user does not exist.
 */
exports.createNotification = async (notificationData) => {
    const { userId, title, message, type, relatedId } = notificationData;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid User ID format provided for notification.', 400);
    }
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
        throw new AppError(`User with ID ${userId} not found. Cannot create notification.`, 404);
    }

    // Create notification
    const notification = await Notification.create({
        user: userId,
        title,
        message,
        type,
        relatedId,
        read: false,
        createdAt: new Date()
    });

    // Send real-time notification via WebSocket
    try {
        websocketService.sendNotification(userId, notification);
    } catch (error) {
        console.error('Error sending real-time notification:', error);
        // Don't throw error, as the notification was still created in the database
    }

    return notification;
};

/**
 * Fetches notifications for a specific user with pagination and filtering.
 * @param {string} userId - The ID of the user.
 * @param {object} queryParams - Object containing query parameters like read, limit, page.
 * @returns {Promise<{notifications: Array, total: number, totalPages: number, currentPage: number}>}
 */
exports.fetchUserNotifications = async (userId, queryParams) => {
    const { read, limit = 10, page = 1 } = queryParams;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const queryObj = { user: userId };
    if (read !== undefined) {
        queryObj.read = read === 'true' || read === true; // Handle boolean or string 'true'
    }

    // Use Promise.all for concurrent count and find queries
    const [notifications, total] = await Promise.all([
        Notification.find(queryObj)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(), // Use lean for read operations
        Notification.countDocuments(queryObj)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    return {
        notifications,
        total,
        totalPages,
        currentPage: parseInt(page)
    };
};

/**
 * Marks a specific notification as read for a user.
 * @param {string} notificationId - The ID of the notification.
 * @param {string} userId - The ID of the user owning the notification.
 * @returns {Promise<object>} - The updated notification document.
 * @throws {AppError} If notification not found or ID invalid.
 */
exports.markNotificationAsRead = async (notificationId, userId) => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new AppError(`Invalid notification ID format: ${notificationId}`, 400);
    }

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId }, // Ensure user owns the notification
        { read: true },
        { new: true, runValidators: true } // Return updated doc
    );

    if (!notification) {
        // Could be not found OR user doesn't own it
        throw new AppError('Notification not found or you do not have permission to access it.', 404);
    }

    return notification;
};

/**
 * Marks all unread notifications as read for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<number>} - The number of notifications marked as read.
 */
exports.markAllUserNotificationsAsRead = async (userId) => {
     if (!mongoose.Types.ObjectId.isValid(userId)) {
         throw new AppError('Invalid user ID format.', 400);
    }
    const result = await Notification.updateMany(
        { user: userId, read: false },
        { read: true }
    );
    return result.modifiedCount || 0; // Return the count of modified documents
};

/**
 * Deletes a specific notification for a user.
 * @param {string} notificationId - The ID of the notification.
 * @param {string} userId - The ID of the user owning the notification.
 * @returns {Promise<boolean>} - True if deletion was successful.
 * @throws {AppError} If notification not found or ID invalid.
 */
exports.deleteUserNotification = async (notificationId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new AppError(`Invalid notification ID format: ${notificationId}`, 400);
    }

    const result = await Notification.findOneAndDelete({
        _id: notificationId,
        user: userId // Ensure user owns the notification
    });

    if (!result) {
        // Could be not found OR user doesn't own it
        throw new AppError('Notification not found or you do not have permission to delete it.', 404);
    }

    return true; // Indicate successful deletion
}; 