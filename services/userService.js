// server/services/userService.js
const User = require('../models/User');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

/**
 * Filters an object by allowed fields.
 * @param {object} obj - The object to filter.
 * @param  {...string} allowedFields - Fields to keep.
 * @returns {object} - The filtered object.
 */
const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};


/**
 * Fetches multiple users by their IDs.
 * @param {string[]} ids - Array of user IDs.
 * @returns {Promise<Array>} - Array of user documents (basic fields).
 */
exports.fetchUsersByIds = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }
    // Validate IDs before querying
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
        return [];
    }

    return await User.find({ _id: { $in: validIds } })
        .select('_id firstName lastName email avatarUrl') // Select fields needed for display
        .lean(); // Use lean for performance
};

/**
 * Fetches all users (consider pagination for large numbers).
 * @returns {Promise<Array>} - Array of all user documents.
 */
exports.fetchAllUsers = async () => {
    // TODO: Implement pagination, filtering, sorting (e.g., using ApiFeatures class)
    return await User.find().lean();
};

/**
 * Fetches a single user by ID.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object|null>} - The user document or null if not found.
 */
exports.fetchUserById = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
         throw new AppError('Invalid user ID format.', 400);
    }
    return await User.findById(userId).lean();
};

/**
 * Updates a user's data (Admin use).
 * @param {string} userId - The ID of the user to update.
 * @param {object} updateData - Data to update.
 * @returns {Promise<object>} - The updated user document.
 * @throws {AppError} If user not found or validation fails.
 */
exports.updateUserAsAdmin = async (userId, updateData) => {
     if (!mongoose.Types.ObjectId.isValid(userId)) {
         throw new AppError('Invalid user ID format.', 400);
    }
    // Ensure password is not updated via this route
    if (updateData.password || updateData.passwordConfirm) {
       delete updateData.password;
       delete updateData.passwordConfirm;
       console.warn(`Attempted to update password via admin route for user ${userId}. Ignoring password fields.`);
    }
    // Add any other restricted field filtering if necessary

    const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true
    });
    if (!user) {
        throw new AppError('No user found with that ID', 404);
    }
    return user; // Return Mongoose document if further methods needed, otherwise .lean()
};

/**
 * Deletes a user (Admin use).
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<boolean>} - True if deleted, false otherwise.
 * @throws {AppError} If user not found.
 */
exports.deleteUserAsAdmin = async (userId) => {
     if (!mongoose.Types.ObjectId.isValid(userId)) {
         throw new AppError('Invalid user ID format.', 400);
    }
    // TODO: Consider adding cleanup logic similar to authService.deleteUserAccount if needed here
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
        throw new AppError('No user found with that ID', 404);
    }
    return true;
};

/**
 * Updates the profile data for the currently logged-in user.
 * @param {string} userId - The ID of the user.
 * @param {object} updateData - Data to update.
 * @returns {Promise<object>} - The updated user document.
 * @throws {AppError} If password update attempted or user not found.
 */
exports.updateUserProfile = async (userId, updateData) => {
    if (updateData.password || updateData.passwordConfirm) {
        throw new AppError('This route is not for password updates. Please use /updateMyPassword.', 400);
    }

    // Define fields allowed for self-update
    const allowedFields = ['firstName', 'lastName', 'email', 'bio', 'experience', 'specialties', 'qualifications', 'avatarUrl', 'socialLinks', 'sport', 'level', 'height', 'weight', 'birthdate'];
    const filteredBody = filterObj(updateData, ...allowedFields);

    const updatedUser = await User.findByIdAndUpdate(userId, filteredBody, {
        new: true,
        runValidators: true
    });
     if (!updatedUser) {
        throw new AppError('User not found.', 404); // Should not happen if protect middleware ran
    }
    return updatedUser;
};

/**
 * Marks the currently logged-in user as inactive.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<boolean>} - True if successful.
 * @throws {AppError} If user not found.
 */
exports.deactivateUserAccount = async (userId) => {
    // Consider if a full delete (like in authService) is more appropriate than just deactivation
    const user = await User.findByIdAndUpdate(userId, { active: false }); // Assumes 'active' field exists
     if (!user) {
        throw new AppError('User not found.', 404);
    }
    return true;
};

/**
 * Assigns a coach to an athlete.
 * @param {string} athleteId
 * @param {string} coachId
 * @returns {Promise<{athlete: object, coach: object}>}
 * @throws {AppError} If users not found, roles invalid, or update fails.
 */
exports.assignCoach = async (athleteId, coachId) => {
    if (!mongoose.Types.ObjectId.isValid(athleteId) || !mongoose.Types.ObjectId.isValid(coachId)) {
        throw new AppError('Invalid athlete or coach ID format.', 400);
    }

    const [athlete, coach] = await Promise.all([
        User.findById(athleteId),
        User.findById(coachId)
    ]);

    if (!athlete || athlete.role !== 'athlete') {
        throw new AppError('Athlete not found or user is not an athlete.', 404);
    }
    if (!coach || coach.role !== 'coach') {
        throw new AppError('Coach not found or user is not a coach.', 404);
    }

    // --- Update Athlete ---
    if (!athlete.coaches) athlete.coaches = [];
    let athleteNeedsSave = false;
    // Add coach to array if not present
    if (!athlete.coaches.some(cId => cId.equals(coach._id))) {
        athlete.coaches.push(coach._id);
        athleteNeedsSave = true;
    }
    // Set primary/legacy coach if not set
    if (!athlete.primaryCoachId) {
        athlete.primaryCoachId = coach._id;
        athleteNeedsSave = true;
    }
    if (!athlete.coachId) { // Legacy support
        athlete.coachId = coach._id;
        athleteNeedsSave = true;
    }

    // --- Update Coach ---
    if (!coach.athletes) coach.athletes = [];
    let coachNeedsSave = false;
    // Add athlete to array if not present
    if (!coach.athletes.some(aId => aId.equals(athlete._id))) {
        coach.athletes.push(athlete._id);
        coachNeedsSave = true;
    }

    // --- Save if changes occurred ---
    // Use Promise.all for concurrent saves
    const savePromises = [];
    if (athleteNeedsSave) savePromises.push(athlete.save({ validateBeforeSave: false }));
    if (coachNeedsSave) savePromises.push(coach.save({ validateBeforeSave: false }));

    if (savePromises.length > 0) {
        await Promise.all(savePromises);
    }

    return { athlete, coach }; // Return updated docs
};

/**
 * Removes a coach from an athlete.
 * @param {string} athleteId
 * @param {string} coachIdToRemove
 * @returns {Promise<boolean>} - True if relationship was modified.
 * @throws {AppError} If users not found or roles invalid.
 */
exports.removeCoach = async (athleteId, coachIdToRemove) => {
     if (!mongoose.Types.ObjectId.isValid(athleteId) || !mongoose.Types.ObjectId.isValid(coachIdToRemove)) {
        throw new AppError('Invalid athlete or coach ID format.', 400);
    }

    const [athlete, coachToRemove] = await Promise.all([
        User.findById(athleteId),
        User.findById(coachIdToRemove)
    ]);

     if (!athlete || athlete.role !== 'athlete') {
        throw new AppError('Athlete not found.', 404);
    }
    if (!coachToRemove || coachToRemove.role !== 'coach') {
        throw new AppError('Coach to remove not found.', 404);
    }

    let athleteModified = false;
    let coachModified = false;

    // --- Update Athlete ---
    if (athlete.coaches && athlete.coaches.length > 0) {
        const initialLength = athlete.coaches.length;
        athlete.coaches = athlete.coaches.filter(cId => !cId.equals(coachToRemove._id));
        if (athlete.coaches.length < initialLength) {
            athleteModified = true;
            // If primary coach was removed, assign a new primary (e.g., the first in the list)
            if (athlete.primaryCoachId && athlete.primaryCoachId.equals(coachToRemove._id)) {
                athlete.primaryCoachId = athlete.coaches.length > 0 ? athlete.coaches[0] : undefined;
            }
            // Sync legacy coachId
             if (athlete.coachId && athlete.coachId.equals(coachToRemove._id)) {
                athlete.coachId = athlete.primaryCoachId || undefined;
             }
        }
    }
     // Also check legacy field just in case coaches array was empty
    if (athlete.coachId && athlete.coachId.equals(coachToRemove._id)) {
        athlete.coachId = undefined;
        athlete.primaryCoachId = undefined; // Clear primary if legacy matched
        athleteModified = true;
    }


    // --- Update Coach ---
    if (coachToRemove.athletes && coachToRemove.athletes.length > 0) {
         const initialLength = coachToRemove.athletes.length;
         coachToRemove.athletes = coachToRemove.athletes.filter(aId => !aId.equals(athlete._id));
         if (coachToRemove.athletes.length < initialLength) {
            coachModified = true;
         }
    }

    // --- Save if changes occurred ---
    const savePromises = [];
    if (athleteModified) savePromises.push(athlete.save({ validateBeforeSave: false }));
    if (coachModified) savePromises.push(coachToRemove.save({ validateBeforeSave: false }));

    if (savePromises.length > 0) {
        await Promise.all(savePromises);
        return true; // Indicate modification happened
    }

    return false; // Indicate no modification happened
}; 