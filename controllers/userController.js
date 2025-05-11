const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const userService = require('../services/userService');
const mongoose = require('mongoose');

// --- Utility to filter object fields ---
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// --- Controller Functions ---

// Get basic details for multiple users by ID
exports.getUsersByIds = catchAsync(async (req, res, next) => {
  const idsQuery = req.query.ids;
  if (!idsQuery) {
    return next(new AppError('Please provide user IDs in the \'ids\' query parameter.', 400));
  }
  const ids = idsQuery.split(',');

  const users = await userService.fetchUsersByIds(ids);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

// Get all users (Admin/Coach only - Authorization done in route)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  // TODO: Add pagination from service if implemented
  const users = await userService.fetchAllUsers();
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

// Get single user (Admin/Coach only - Authorization done in route)
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await userService.fetchUserById(req.params.id);
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }
  res.status(200).json({ status: 'success', data: { user } });
});

// Create user (Admin/Coach only - Typically not used, signup preferred)
exports.createUser = (req, res, next) => {
  // Delegate to register function or keep disabled
  return next(new AppError('This route is not for user creation. Please use /api/auth/register.', 501)); // 501 Not Implemented
};

// Update user (Admin/Coach only - Authorization done in route)
exports.updateUser = catchAsync(async (req, res, next) => {
  const updatedUser = await userService.updateUserAsAdmin(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: { user: updatedUser } });
});

// Delete user (Admin/Coach only - Authorization done in route)
exports.deleteUser = catchAsync(async (req, res, next) => {
  await userService.deleteUserAsAdmin(req.params.id);
  res.status(204).json({ status: 'success', data: null }); // 204 No Content
});

// Get current user profile ('me' route)
// Middleware to set req.params.id = req.user.id
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

// Update current user profile data (not password)
exports.updateMe = catchAsync(async (req, res, next) => {
  const updatedUser = await userService.updateUserProfile(req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// Delete current user account ('me' route)
exports.deleteMe = catchAsync(async (req, res, next) => {
  await userService.deactivateUserAccount(req.user.id);
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Assign a coach to an athlete (by Coach/Admin - Authorization done in route)
exports.assignCoachToAthlete = catchAsync(async (req, res, next) => {
  const { athleteId, coachId } = req.body;
  if (!athleteId || !coachId) {
    return next(new AppError('Please provide both athleteId and coachId', 400));
  }

  const { athlete, coach } = await userService.assignCoach(athleteId, coachId);

  res.status(200).json({
    status: 'success',
    message: `Coach ${coach.firstName} assigned to athlete ${athlete.firstName}.`
    // Optionally return updated athlete/coach data
  });
});

// Remove a coach from an athlete (by Coach/Admin - Authorization done in route)
exports.removeCoachFromAthlete = catchAsync(async (req, res, next) => {
  const { athleteId, coachId } = req.body; // Coach to remove
  // Authorization check should ideally happen here or in middleware
  // Example: Check if req.user.id === coachId OR req.user.role === 'admin'
  if (req.user.role === 'coach' && req.user.id !== coachId) {
    return next(new AppError('Coaches can only remove themselves from an athlete.', 403));
  }
  if (!athleteId || !coachId) {
    return next(new AppError('Please provide both athleteId and coachId to remove', 400));
  }

  const modified = await userService.removeCoach(athleteId, coachId);

  res.status(200).json({
    status: 'success',
    message: modified ? `Coach removed from athlete.` : `Coach was not assigned to athlete.`
  });
});

// @desc    Upload user avatar
// @route   POST /api/users/upload-avatar
// @access  Private
exports.uploadAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image file', 400));
  }

  // Store the full URL in the database
  const avatarUrl = `http://localhost:8000/api/users/avatar/${req.file.filename}`;
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { avatarUrl },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    message: 'Avatar uploaded successfully',
    data: {
      avatarUrl
    }
  });
});

exports.updateNotificationPreferences = catchAsync(async (req, res, next) => {
  const allowedPreferences = [
    'programAssigned',
    'workoutReminder',
    'coachMessage',
    'progressUpdate',
    'system',
    'email',
    'push'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedPreferences.includes(key)) {
      updates[`notificationPreferences.${key}`] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
}); 