// server/services/authService.js
const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { sendEmail } = require('../utils/email'); // Assuming email utility exists
const Regimen = require('../models/Regimen');
const Notification = require('../models/Notification');


/**
 * Registers a new user.
 * @param {object} userData - User data (firstName, lastName, email, password, role).
 * @returns {Promise<object>} - The created user object (without password).
 * @throws {AppError} If email already exists or user creation fails.
 */
exports.registerUser = async (userData) => {
    const { firstName, lastName, email, password, role } = userData;

    // Check if email exists first
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('User with that email already exists', 400);
    }

    // Create user (password hashing is handled by pre-save hook in User model)
    const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        role: role || 'athlete' // Default role
    });

    // Important: Don't return password hash
    user.password = undefined;
    return user;
};

/**
 * Generates a verification token for a user and saves it.
 * @param {object} user - Mongoose user document.
 * @returns {Promise<string>} - The unhashed verification token.
 */
exports.generateAndSaveVerificationToken = async (user) => {
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false }); // Save the user with the token
    return verificationToken;
};

/**
 * Sends the verification email.
 * @param {object} user - User object with email and firstName.
 * @param {string} verificationToken - The unhashed token.
 * @param {object} req - Express request object (for protocol/host).
 */
exports.sendVerificationEmail = async (user, verificationToken, req) => {
    const verificationURL = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`; // Use API route
    const message = `
      Hi ${user.firstName},\n\n
      Thanks for signing up! Please verify your email address by clicking the link below:\n\n
      ${verificationURL}\n\n
      If you didn't create an account, please ignore this email.
    `;

    // Log for development
    if (process.env.NODE_ENV === 'development') {
        console.log('==== EMAIL VERIFICATION ====\nToken:', verificationToken, '\nURL:', verificationURL, '\n============================');
    }

    try {
        await sendEmail({
            email: user.email,
            subject: 'Your Email Verification Link (Valid for 24 hours)',
            message
        });
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        // Clean up token fields if sending failed, allowing retry
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save({ validateBeforeSave: false });
        throw new AppError('There was an error sending the verification email. Try again later.', 500);
    }
};

/**
 * Verifies a user's email using a token.
 * @param {string} token - The verification token from the URL.
 * @returns {Promise<object>} - The verified user document.
 * @throws {AppError} If token is invalid or expired.
 */
exports.verifyUserEmail = async (token) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new AppError('Token is invalid or has expired', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return user;
};


/**
 * Authenticates a user.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<object>} - The authenticated user document.
 * @throws {AppError} If credentials incorrect or email not verified.
 */
exports.authenticateUser = async (email, password) => {
    if (!email || !password) {
        throw new AppError('Please provide email and password', 400);
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new AppError('Incorrect email or password', 401);
    }

    if (!user.isEmailVerified) {
        throw new AppError('Please verify your email before logging in', 401);
    }

    // Don't send password back
    user.password = undefined;
    return user;
};

/**
 * Generates and sends a password reset email.
 * @param {string} email - User's email.
 * @param {object} req - Express request object.
 * @throws {AppError} If no user found or email sending fails.
 */
exports.sendPasswordResetEmail = async (email, req) => {
    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal if user exists, but handle error
        // In a real app, you might just return success to prevent user enumeration
        throw new AppError('If an account with that email exists, a reset link has been sent.', 404); // Or 200 for security
    }

    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    // Use frontend URL for reset link if available, otherwise API route
    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}` || `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
    const message = `Forgot your password? Click the link to reset it: ${resetURL}\n\nIf you didn't forget your password, please ignore this email.`;

    try {
         // Log for development
        if (process.env.NODE_ENV === 'development') {
            console.log('==== PASSWORD RESET ====\nToken:', resetToken, '\nURL:', resetURL, '\n========================');
        }
        await sendEmail({
            email: user.email,
            subject: 'Your Password Reset Token (Valid for 10 minutes)',
            message
        });
    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save({ validateBeforeSave: false });
        throw new AppError('There was an error sending the password reset email. Try again later.', 500);
    }
};

/**
 * Resets a user's password using a token.
 * @param {string} token - The password reset token.
 * @param {string} newPassword - The new password.
 * @returns {Promise<object>} - The user document with the updated password.
 * @throws {AppError} If token is invalid/expired or save fails.
 */
exports.resetUserPassword = async (token, newPassword) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new AppError('Token is invalid or has expired', 400);
    }

    user.password = newPassword; // Hashing handled by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save(); // Runs validators including password confirmation if set up

    user.password = undefined; // Don't send password back
    return user;
};

/**
 * Updates the password for an authenticated user.
 * @param {string} userId - The ID of the user.
 * @param {string} currentPassword - The user's current password.
 * @param {string} newPassword - The desired new password.
 * @returns {Promise<object>} - The updated user document.
 * @throws {AppError} If current password incorrect or save fails.
 */
exports.updateUserPassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId).select('+password');
    if (!user) {
         throw new AppError('User not found.', 404); // Should not happen if protect middleware ran
    }

    if (!(await user.isPasswordCorrect(currentPassword))) {
        throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save(); // Hashing and validation handled by model/hooks

    user.password = undefined;
    return user;
};


/**
 * Updates non-password details for the currently logged-in user.
 * @param {string} userId - The ID of the user.
 * @param {object} updateData - Data containing fields to update (e.g., firstName, lastName, email).
 * @returns {Promise<object>} - The updated user document.
 * @throws {AppError} If trying to update password or validation fails.
 */
exports.updateUserDetails = async (userId, updateData) => {
    if (updateData.password) {
        throw new AppError('This route is not for password updates. Please use /update-password.', 400);
    }

    // Filter out fields not allowed to be updated here
    const allowedFields = ['firstName', 'lastName', 'email']; // Add other allowed fields like bio, etc.
    const filteredBody = {};
    Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
            filteredBody[key] = updateData[key];
        }
    });

    const updatedUser = await User.findByIdAndUpdate(userId, filteredBody, {
        new: true, // Return the updated document
        runValidators: true // Ensure schema validation runs
    });

     if (!updatedUser) {
        throw new AppError('User not found for update.', 404); // Should not happen normally
    }

    return updatedUser;
};

/**
 * Deletes a user account and performs necessary cleanup.
 * @param {string} userId - The ID of the user to delete.
 * @param {string} userRole - The role of the user ('coach' or 'athlete').
 */
exports.deleteUserAccount = async (userId, userRole) => {
    if (userRole === 'coach') {
        // TODO: Move cleanup logic potentially into User model pre-remove hook
        // Or keep here for explicit control
        console.log(`Cleanup initiated for coach: ${userId}`);
        // 1. Remove coach reference from athletes
        await User.updateMany({ coachId: userId }, { $unset: { coachId: "" } });
        // 2. Find regimens created by coach
        const regimens = await Regimen.find({ createdBy: userId }).select('_id assignedTo');
        // 3. Remove regimen references from athletes
        for (const regimen of regimens) {
            if (regimen.assignedTo && regimen.assignedTo.length > 0) {
                await User.updateMany(
                    { _id: { $in: regimen.assignedTo } },
                    { $pull: { regimens: regimen._id } }
                );
            }
        }
        // 4. Delete regimens
        await Regimen.deleteMany({ createdBy: userId });
        // 5. Delete notifications
        await Notification.deleteMany({ user: userId }); // Or recipient: userId depending on schema
        console.log(`Cleanup completed for coach: ${userId}`);
    } else if (userRole === 'athlete') {
        // Cleanup for athlete
        // 1. Remove athlete from coach's list
        await User.updateMany({ athletes: userId }, { $pull: { athletes: userId } });
        // 2. Remove athlete from assigned regimens
        await Regimen.updateMany({ assignedTo: userId }, { $pull: { assignedTo: userId } });
        // 3. Delete athlete's workout logs (or reassign/anonymize)
        // Make sure WorkoutLog model is available if used here
        // const WorkoutLog = require('../models/WorkoutLog');
        // await WorkoutLog.deleteMany({ athleteId: userId });
         // 4. Delete notifications
        await Notification.deleteMany({ user: userId });
        console.log(`Cleanup completed for athlete: ${userId}`);
    }

    // Finally, delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
        throw new AppError('User not found for deletion.', 404);
    }
    console.log(`User account deleted: ${userId}`);
};

/**
 * Refreshes the JWT token.
 * Expects a valid refresh token (e.g., from cookie or request body).
 * This is a simplified example; robust refresh token logic is complex.
 * @param {string} refreshToken - The provided refresh token.
 * @returns {Promise<object>} - { user, newAccessToken }
 * @throws {AppError} If refresh token is invalid or user not found.
 */
exports.refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) {
        throw new AppError('Refresh token not provided.', 401);
    }

    // 1. Verify the refresh token (assuming it's a JWT)
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET); // Use a SEPARATE secret for refresh tokens
    } catch (err) {
         throw new AppError('Invalid or expired refresh token.', 401);
    }

    // 2. Find user associated with token
    const user = await User.findById(decoded.id);
    if (!user) {
        throw new AppError('User for refresh token not found.', 401);
    }

    // 3. Optional: Check against a stored list of valid refresh tokens
    // (More secure, prevents reuse if token is compromised)

    // 4. Generate a new access token
    const newAccessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });

     // Don't send password back
    user.password = undefined;

    return { user, newAccessToken };
}; 