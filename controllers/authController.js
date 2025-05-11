const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/email');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const Regimen = require('../models/Regimen');
const Notification = require('../models/Notification');
const authService = require('../services/authService');
const { createSendToken } = require('../utils/authUtils');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = catchAsync(async (req, res, next) => {
  console.log('📝 Register request received:', req.body);
  
  const { firstName, lastName, email, password, role } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    console.log('❌ Registration failed: User already exists', email);
    return next(new AppError('User with that email already exists', 400));
  }

  // Create user
  try {
    console.log('👤 Creating new user:', { firstName, lastName, email, role });
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'athlete'
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationURL = `${req.protocol}://${req.get(
      'host'
    )}/auth/verify/${verificationToken}`;

    // Create message
    const message = `
      Hi ${firstName},
      
      Thanks for signing up! Please verify your email address by clicking the link below:
      
      ${verificationURL}
      
      If you didn't create an account, please ignore this email.
    `;

    try {
      // Log verification URL in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('==== VERIFICATION TOKEN ====');
        console.log(verificationToken);
        console.log('============================');
        console.log('Verification URL:');
        console.log(verificationURL);
        console.log('============================');
      }

      // Send verification email
      await sendEmail({
        email: user.email,
        subject: 'Your Email Verification Link (Valid for 24 hours)',
        message
      });

      console.log('✅ User registered successfully:', user.email);
      
      // For development, include verification token in response
      const devResponse = process.env.NODE_ENV === 'development' ? { verificationToken } : {};

      res.status(201).json({
        status: 'success',
        message: 'Verification email sent',
        ...devResponse
      });
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
      
      // If email sending fails, reset verification token fields
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(
        new AppError('There was an error sending the verification email. Try again later.', 500)
      );
    }
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return next(new AppError(`Error creating user: ${error.message}`, 500));
  }
});

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
exports.verifyEmail = catchAsync(async (req, res, next) => {
  // Get token from URL and hash it
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // Find user with token and check if token is expired
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  // If no user found or token expired
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // Update user
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // Redirect to frontend verification success page
  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully'
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = catchAsync(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) If everything ok, send token to client
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = catchAsync(async (req, res, next) => {
  try {
    console.log('Getting current user, user ID:', req.user.id);
    
    if (!req.user || !req.user.id) {
      console.error('No user found in request');
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('User not found in database:', req.user.id);
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    console.log('User found:', user.email);
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving user data'
    });
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('No user found with that email', 404));
  }

  // Generate reset token
  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/auth/reset-password/${resetToken}`;

  // Create message
  const message = `
    Forgot your password? Submit a request with your new password to: ${resetURL}
    
    If you didn't forget your password, please ignore this email.
  `;

  try {
    // Send email
    await sendEmail({
      email: user.email,
      subject: 'Your Password Reset Token (Valid for 10 minutes)',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset email sent'
    });
  } catch (error) {
    // If email sending fails, reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the reset email. Try again later.', 500)
    );
  }
});

// @desc    Reset password
// @route   PATCH /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = catchAsync(async (req, res, next) => {
  // Get token from URL and hash it
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // Find user with token and check if token is expired
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  // If no user found or token expired
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // Update password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Create and send token
  createSendToken(user, 200, req, res);
});

// @desc    Update password
// @route   PATCH /api/auth/update-password
// @access  Private
exports.updatePassword = catchAsync(async (req, res, next) => {
  // Get user from database with password
  const user = await User.findById(req.user.id).select('+password');

  // Check if current password is correct
  if (!(await user.isPasswordCorrect(req.body.currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = req.body.newPassword;
  await user.save();

  // Create and send token
  createSendToken(user, 200, req, res);
});

// @desc    Update user details
// @route   PATCH /api/auth/update-me
// @access  Private
exports.updateMe = catchAsync(async (req, res, next) => {
  // Check if user is trying to update password
  if (req.body.password) {
    return next(new AppError('This route is not for password updates. Please use /update-password.', 400));
  }

  // Filter fields to update
  const allowedFields = ['firstName', 'lastName', 'email'];
  const filteredBody = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  // Update user
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// @desc    Delete user
// @route   DELETE /api/auth/delete-account
// @access  Private
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  // If user is a coach, clean up all associated data
  if (userRole === 'coach') {
    // 1. Remove coach reference from all athletes
    await User.updateMany(
      { coachId: userId },
      { $unset: { coachId: "" } }
    );

    // 2. Delete all regimens created by the coach
    const regimens = await Regimen.find({ createdBy: userId });
    
    // 3. Remove regimen references from all athletes
    for (const regimen of regimens) {
      await User.updateMany(
        { _id: { $in: regimen.assignedTo } },
        { $pull: { regimens: regimen._id } }
      );
    }
    
    // 4. Delete all regimens
    await Regimen.deleteMany({ createdBy: userId });

    // 5. Delete all notifications
    await Notification.deleteMany({ user: userId });
  }

  // Delete the user account
  await User.findByIdAndDelete(userId);

  // Clear JWT cookie
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  // Clear JWT cookie
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({ status: 'success' });
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('No user found with that email', 404));
  }

  // Check if already verified
  if (user.isEmailVerified) {
    return next(new AppError('Email is already verified', 400));
  }

  // Generate verification token
  const verificationToken = user.generateVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const verificationURL = `${req.protocol}://${req.get(
    'host'
  )}/auth/verify/${verificationToken}`;

  // Create message
  const message = `
    Hi ${user.firstName},
    
    Please verify your email address by clicking the link below:
    
    ${verificationURL}
    
    If you didn't create an account, please ignore this email.
  `;

  try {
    // Send verification email
    await sendEmail({
      email: user.email,
      subject: 'Your Email Verification Link (Valid for 24 hours)',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent'
    });
  } catch (error) {
    // If email sending fails, reset verification token fields
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the verification email. Try again later.', 500)
    );
  }
});

// @desc    Check if user is logged in - protected route middleware
// @access  Private
exports.protect = catchAsync(async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in', 401));
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to restrict routes to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array like ['admin', 'coach'].
    // Check if the user's role is included in the allowed roles.
    if (!req.user || !req.user.role) {
        // This should technically be caught by 'protect' middleware first
        return next(
            new AppError('Authentication error. User role not found.', 401)
        );
    }
    
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    // If role is allowed, grant access to the next middleware/route handler
    next();
  };
};

// @desc    Invite athlete
// @route   POST /api/auth/invite-athlete
// @access  Private/Coach
exports.inviteAthlete = catchAsync(async (req, res, next) => {
  const { email, firstName, lastName } = req.body;

  // Check if user making request is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can invite athletes', 403));
  }

  // Check if user already exists
  let athlete = await User.findOne({ email });
  let isNewUser = false;

  if (athlete) {
    // If the athlete is already in the coach's athletes array, return success with a message
    if (req.user.athletes && req.user.athletes.some(id => id.equals(athlete._id))) {
      return res.status(200).json({
        status: 'success',
        message: `Athlete ${athlete.firstName} ${athlete.lastName} is already in your team`,
        data: {
          athlete: {
            id: athlete._id,
            email: athlete.email,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            isNewUser: false
          }
        }
      });
    }
    
    // Initialize coaches array if it doesn't exist
    if (!athlete.coaches) {
      athlete.coaches = [];
    }
  } else {
    // Create temporary password for new user
    const tempPassword = crypto.randomBytes(8).toString('hex');
    
    // Create new user with athlete role
    athlete = await User.create({
      email,
      firstName,
      lastName,
      password: tempPassword,
      role: 'athlete',
      coachId: req.user._id,
      primaryCoachId: req.user._id,
      coaches: [req.user._id],
      isEmailVerified: false // Require email verification
    });
    
    isNewUser = true;
  }

  // Generate verification token
  const verificationToken = athlete.generateVerificationToken();
  
  // If existing user, update coach references
  if (!isNewUser) {
    // For backward compatibility, if no coachId is set, set it
    if (!athlete.coachId) {
      athlete.coachId = req.user._id;
    }
    
    // Set primaryCoachId if it's not set
    if (!athlete.primaryCoachId) {
      athlete.primaryCoachId = athlete.coachId;
    }
    
    // Add this coach to the coaches array if not already there
    if (!athlete.coaches.some(id => id.toString() === req.user._id.toString())) {
      athlete.coaches.push(req.user._id);
    }
    
    await athlete.save({ validateBeforeSave: false });
  }
  
  // Update coach's athletes array if needed
  const coachNeedsUpdate = !req.user.athletes.some(id => id.equals(athlete._id));
  if (coachNeedsUpdate) {
    if (!req.user.athletes) {
      req.user.athletes = [];
    }
    req.user.athletes.push(athlete._id);
    await req.user.save({ validateBeforeSave: false });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Added athlete ${athlete._id} to coach's athletes array`);
      console.log(`Coach now has ${req.user.athletes.length} athletes`);
    }
  }

  // Create verification URL
  const verificationURL = `${req.protocol}://${req.get('host')}/auth/verify/${verificationToken}`;

  // Create message
  const message = isNewUser 
    ? `
      Hi ${firstName},
      
      ${req.user.firstName} ${req.user.lastName} has invited you to join their team on CoachShare.
      
      To accept this invitation and verify your account, please click the link below:
      
      ${verificationURL}
      
      Your temporary password is: ${tempPassword}
      
      Please change your password after logging in.
      
      If you didn't expect this invitation, please ignore this email.
    `
    : `
      Hi ${athlete.firstName},
      
      ${req.user.firstName} ${req.user.lastName} has invited you to join their team on CoachShare.
      
      To accept this invitation, please click the link below:
      
      ${verificationURL}
      
      If you didn't expect this invitation, please ignore this email.
    `;

  try {
    // Log verification URL in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('==== INVITATION DETAILS ====');
      console.log('Verification Token:', verificationToken);
      console.log('Verification URL:', verificationURL);
      if (isNewUser) {
        console.log('Temporary Password:', tempPassword);
      }
      console.log('============================');
    }

    // Send invitation email
    await sendEmail({
      email: athlete.email,
      subject: `${req.user.firstName} ${req.user.lastName} has invited you to CoachShare`,
      message
    });

    console.log(`✅ Invitation sent to ${athlete.email}`);
    
    // For development, include verification token in response
    const devResponse = process.env.NODE_ENV === 'development' 
      ? { 
          verificationToken,
          tempPassword: isNewUser ? tempPassword : undefined
        } 
      : {};

    res.status(200).json({
      status: 'success',
      message: `Invitation sent to ${athlete.email}`,
      data: {
        athlete: {
          id: athlete._id,
          email: athlete.email,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          isNewUser
        }
      },
      ...devResponse
    });
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    
    // If email sending fails, reset verification token fields
    athlete.emailVerificationToken = undefined;
    athlete.emailVerificationExpires = undefined;
    await athlete.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the invitation email. Try again later.', 500)
    );
  }
});

// @desc    Get athletes
// @route   GET /api/auth/athletes
// @access  Private/Coach
exports.getAthletes = catchAsync(async (req, res, next) => {
  // Check if user making request is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can access this route', 403));
  }

  // Find all athletes both by coachId and in the coach's athletes array
  const athletesByCoachId = await User.find({ 
    coachId: req.user._id, 
    role: 'athlete' 
  }).select('-__v');

  // Also find athletes by their _id in the coach's athletes array
  let additionalAthletes = [];
  if (req.user.athletes && req.user.athletes.length > 0) {
    additionalAthletes = await User.find({
      _id: { $in: req.user.athletes },
      role: 'athlete',
      // Don't duplicate athletes that already have coachId set
      $or: [
        { coachId: { $exists: false } },
        { coachId: null },
        { coachId: { $ne: req.user._id } }
      ]
    }).select('-__v');
  }

  // Combine both sets of athletes, ensuring no duplicates
  const athleteIds = new Set();
  const allAthletes = [];

  // Add athletes found by coachId
  athletesByCoachId.forEach(athlete => {
    athleteIds.add(athlete._id.toString());
    allAthletes.push(athlete);
  });

  // Add additional athletes found in the coach's athletes array (avoiding duplicates)
  additionalAthletes.forEach(athlete => {
    if (!athleteIds.has(athlete._id.toString())) {
      allAthletes.push(athlete);
    }
  });

  // Add debugging info in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`Found ${athletesByCoachId.length} athletes by coachId`);
    console.log(`Found ${additionalAthletes.length} additional athletes in coach's athletes array`);
    console.log(`Total unique athletes: ${allAthletes.length}`);
  }

  res.status(200).json({
    status: 'success',
    results: allAthletes.length,
    data: {
      athletes: allAthletes
    }
  });
});

// @desc    Update athlete
// @route   PATCH /api/auth/update-athlete/:id
// @access  Private/Coach
exports.updateAthlete = catchAsync(async (req, res, next) => {
  // Check if user making request is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can update athletes', 403));
  }

  const { id } = req.params;
  const { sport, level } = req.body;

  // Find the athlete by ID
  const athlete = await User.findById(id);

  if (!athlete) {
    return next(new AppError('Athlete not found', 404));
  }

  // Check if this athlete is connected to this coach in any way
  const isConnected = 
    (athlete.coachId && athlete.coachId.equals(req.user._id)) || // Legacy check
    (athlete.primaryCoachId && athlete.primaryCoachId.equals(req.user._id)) || // Primary coach check
    (athlete.coaches && athlete.coaches.some(coachId => coachId.equals(req.user._id))); // Coaches array check

  if (!isConnected) {
    console.log(`Unauthorized update attempt: Coach ${req.user.email} trying to update athlete ${athlete.email}`);
    console.log(`- Athlete's coachId: ${athlete.coachId || 'none'}`);
    console.log(`- Athlete's primaryCoachId: ${athlete.primaryCoachId || 'none'}`);
    console.log(`- Athlete's coaches array: ${athlete.coaches ? JSON.stringify(athlete.coaches) : 'none'}`);
    console.log(`- Requesting coach ID: ${req.user._id}`);
    return next(new AppError('You are not authorized to update this athlete', 403));
  }

  // Update athlete fields
  if (sport !== undefined) athlete.sport = sport;
  if (level !== undefined) athlete.level = level;

  await athlete.save({ validateBeforeSave: false });

  // Return the updated athlete
  res.status(200).json({
    status: 'success',
    message: 'Athlete updated successfully',
    data: {
      athlete
    }
  });
});

// @desc    Remove athlete
// @route   DELETE /api/auth/remove-athlete/:id
// @access  Private/Coach
exports.removeAthlete = catchAsync(async (req, res, next) => {
  console.log('⭐️ removeAthlete controller called - nodemon test');
  // Check if user making request is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can remove athletes', 403));
  }

  const { id } = req.params;

  // Find the athlete by ID
  const athlete = await User.findById(id);

  if (!athlete) {
    return next(new AppError('Athlete not found', 404));
  }

  // Check if this athlete is connected to this coach in any way
  const isConnected = 
    (athlete.coachId && athlete.coachId.equals(req.user._id)) || // Legacy check
    (athlete.primaryCoachId && athlete.primaryCoachId.equals(req.user._id)) || // Primary coach check
    (athlete.coaches && athlete.coaches.some(coachId => coachId.equals(req.user._id))); // Coaches array check

  if (!isConnected) {
    console.log(`Unauthorized removal attempt: Coach ${req.user.email} trying to remove athlete ${athlete.email}`);
    console.log(`- Athlete's coachId: ${athlete.coachId || 'none'}`);
    console.log(`- Athlete's primaryCoachId: ${athlete.primaryCoachId || 'none'}`);
    console.log(`- Athlete's coaches array: ${athlete.coaches ? JSON.stringify(athlete.coaches) : 'none'}`);
    console.log(`- Requesting coach ID: ${req.user._id}`);
    return next(new AppError('You are not authorized to remove this athlete', 403));
  }

  // For primary coach management
  const isAthletesPrimaryCoach = athlete.primaryCoachId && athlete.primaryCoachId.equals(req.user._id);
  const isAthletesLegacyCoach = athlete.coachId && athlete.coachId.equals(req.user._id);
  
  // Remove coach from athlete's coaches array if present
  if (athlete.coaches && athlete.coaches.length) {
    athlete.coaches = athlete.coaches.filter(
      coachId => !coachId.equals(req.user._id)
    );
  }
  
  // If this was the athlete's primary/legacy coach, update those references
  if (isAthletesPrimaryCoach || isAthletesLegacyCoach) {
    // If there are other coaches, set the first one as the new primary coach
    if (athlete.coaches && athlete.coaches.length > 0) {
      athlete.primaryCoachId = athlete.coaches[0];
      athlete.coachId = athlete.coaches[0]; // for legacy support
    } else {
      // If no other coaches, remove both references
      athlete.primaryCoachId = undefined;
      athlete.coachId = undefined;
    }
  }
  
  await athlete.save({ validateBeforeSave: false });

  // Remove athlete from coach's athletes array
  if (req.user.athletes && req.user.athletes.length) {
    req.user.athletes = req.user.athletes.filter(
      athleteId => !athleteId.equals(athlete._id)
    );
    await req.user.save({ validateBeforeSave: false });
  }

  console.log(`Removed athlete ${athlete.firstName} ${athlete.lastName} from coach ${req.user.firstName}'s team`);

  // Return success response
  res.status(200).json({
    status: 'success',
    message: `Athlete ${athlete.firstName} ${athlete.lastName} removed from your team`,
    data: {
      athleteId: id
    }
  });
});

// @desc    Request coach connection
// @route   POST /api/auth/request-coach
// @access  Private/Athlete
exports.requestCoach = catchAsync(async (req, res, next) => {
  // Check if user making request is an athlete
  if (req.user.role !== 'athlete') {
    return next(new AppError('Only athletes can request coach connections', 403));
  }

  const { coachId } = req.body;

  if (!coachId) {
    return next(new AppError('Please provide a coachId', 400));
  }

  // Find the coach
  const coach = await User.findById(coachId);
  if (!coach) {
    return next(new AppError('Coach not found', 404));
  }

  // Check if coach has correct role
  if (coach.role !== 'coach') {
    return next(new AppError('The selected user is not a coach', 400));
  }

  // Check if athlete already has this coach
  if (req.user.coachId && req.user.coachId.equals(coach._id)) {
    return res.status(200).json({
      status: 'success',
      message: 'You are already connected with this coach',
      data: {
        coach: {
          id: coach._id,
          firstName: coach.firstName,
          lastName: coach.lastName,
          email: coach.email
        }
      }
    });
  }

  // If athlete already has a different coach, remove that connection
  if (req.user.coachId) {
    const previousCoach = await User.findById(req.user.coachId);
    if (previousCoach) {
      // Remove athlete from previous coach's athletes array
      if (previousCoach.athletes && previousCoach.athletes.length) {
        previousCoach.athletes = previousCoach.athletes.filter(
          athleteId => !athleteId.equals(req.user._id)
        );
        await previousCoach.save({ validateBeforeSave: false });
        console.log(`Removed athlete ${req.user.firstName} from coach ${previousCoach.firstName}'s team`);
      }
    }
  }

  // Update athlete's coachId
  req.user.coachId = coach._id;
  await req.user.save({ validateBeforeSave: false });

  // Add athlete to coach's athletes array if not already there
  if (!coach.athletes) {
    coach.athletes = [];
  }

  if (!coach.athletes.some(id => id.equals(req.user._id))) {
    coach.athletes.push(req.user._id);
    await coach.save({ validateBeforeSave: false });
  }

  // TODO: In a real app, we might implement an approval workflow,
  // where the coach needs to accept the request.
  // For simplicity, we're auto-accepting all requests.

  console.log(`Connected athlete ${req.user.firstName} ${req.user.lastName} with coach ${coach.firstName} ${coach.lastName}`);

  // Return success response
  res.status(200).json({
    status: 'success',
    message: `You are now connected with coach ${coach.firstName} ${coach.lastName}`,
    data: {
      coach: {
        id: coach._id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        email: coach.email
      }
    }
  });
});

// @desc    Get available coaches
// @route   GET /api/auth/coaches
// @access  Private
exports.getCoaches = catchAsync(async (req, res, next) => {
  // Find all coaches
  const coaches = await User.find({ 
    role: 'coach',
  }).select('firstName lastName specialties bio createdAt');
  
  res.status(200).json({
    status: 'success',
    results: coaches.length,
    data: {
      coaches
    }
  });
});

// Modify the existing assignRegimen function to auto-connect athletes with coaches
// @desc    Assign regimen to athlete
// @route   POST /api/auth/assign-regimen
// @access  Private/Coach
exports.assignRegimen = catchAsync(async (req, res, next) => {
  // Check if user making request is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can assign regimens', 403));
  }

  const { athleteId, regimenId } = req.body;

  if (!athleteId || !regimenId) {
    return next(new AppError('Please provide both athleteId and regimenId', 400));
  }

  // Find the athlete
  const athlete = await User.findById(athleteId);
  if (!athlete) {
    return next(new AppError('Athlete not found', 404));
  }

  // Initialize coaches array if it doesn't exist
  if (!athlete.coaches) {
    athlete.coaches = [];
  }

  // Check if athlete is already connected with this coach
  const isConnected = athlete.coaches.some(id => id.toString() === req.user._id.toString()) ||
    (athlete.coachId && athlete.coachId.toString() === req.user._id.toString()) ||
    (athlete.primaryCoachId && athlete.primaryCoachId.toString() === req.user._id.toString());

  // Auto-connect athlete with coach if not already connected
  let connectionMessage = '';

  if (!isConnected) {
    // For backward compatibility
    if (!athlete.coachId) {
      athlete.coachId = req.user._id;
      athlete.primaryCoachId = req.user._id; // Set as primary coach if they don't have one
    } else if (!athlete.primaryCoachId) {
      athlete.primaryCoachId = athlete.coachId; // Ensure primary coach is set if they have a coach
    }

    // Add coach to athlete's coaches array
    athlete.coaches.push(req.user._id);

    // Add athlete to coach's athletes array if not already there
    if (!req.user.athletes) {
      req.user.athletes = [];
    }

    if (!req.user.athletes.some(id => id.equals(athlete._id))) {
      req.user.athletes.push(athlete._id);
      await req.user.save({ validateBeforeSave: false });
    }

    connectionMessage = ` and connected with you as their coach`;
    console.log(`Connected athlete ${athlete.firstName} ${athlete.lastName} with coach ${req.user.firstName} ${req.user.lastName}`);
  }

  // Find the regimen
  let regimen;
  
  // Try to find by id (string UUID) first
  regimen = await Regimen.findOne({ id: regimenId });
  
  // If not found by id, try MongoDB's _id
  if (!regimen && mongoose.Types.ObjectId.isValid(regimenId)) {
    regimen = await Regimen.findById(regimenId);
  }

  if (!regimen) {
    return next(new AppError('Regimen not found', 404));
  }

  // Add regimen to athlete's regimens array if not already there
  if (!athlete.regimens) {
    athlete.regimens = [];
  }

  // Check if regimen is already assigned to athlete
  const isAlreadyAssigned = athlete.regimens.some(
    r => r.toString() === regimen._id.toString()
  );

  if (isAlreadyAssigned) {
    return next(new AppError('This regimen is already assigned to the athlete', 400));
  }

  // Add regimen to athlete
  athlete.regimens.push(regimen._id);
  await athlete.save({ validateBeforeSave: false });

  console.log(`Assigned regimen "${regimen.name}" to athlete ${athlete.firstName} ${athlete.lastName}`);

  // Return success response
  res.status(200).json({
    status: 'success',
    message: `Regimen "${regimen.name}" assigned to ${athlete.firstName} ${athlete.lastName}${connectionMessage}`,
    data: {
      athlete: {
        id: athlete._id,
        name: `${athlete.firstName} ${athlete.lastName}`,
        email: athlete.email
      },
      regimen: {
        id: regimen.id || regimen._id,
        name: regimen.name
      }
    }
  });
});

// @desc    Assign regimen to multiple athletes
// @route   POST /api/auth/assign-regimen-bulk
// @access  Private/Coach
exports.assignRegimenBulk = catchAsync(async (req, res, next) => {
  const { regimenId, athleteIds } = req.body;
  const coachId = req.user._id; // Requesting user MUST be a coach (enforced by restrictTo)

  console.log(`[Assign Bulk] Coach ${coachId} attempting to assign regimen ${regimenId} to athletes: ${athleteIds}`);

  // Validate input
  if (!regimenId || !Array.isArray(athleteIds) || athleteIds.length === 0) {
    return next(new AppError('Regimen ID and a non-empty array of Athlete IDs are required.', 400));
  }

  // 1. Find the regimen and verify coach created it
  const regimen = await Regimen.findById(regimenId); // Assuming regimenId is ObjectId
  if (!regimen) {
    return next(new AppError('Regimen not found.', 404));
  }
  if (regimen.createdBy.toString() !== coachId.toString()) {
    console.warn(`[Assign Bulk] Failed: Coach ${coachId} does not own regimen ${regimenId}`);
    return next(new AppError('You can only assign regimens you created.', 403));
  }

  // 2. Find the athletes and verify they belong to the coach
  const validAthleteIds = athleteIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validAthleteIds.length !== athleteIds.length) {
      console.warn(`[Assign Bulk] Some provided athlete IDs were invalid.`);
      // Optionally continue with valid ones or return error
  }
  
  const athletes = await User.find({
    _id: { $in: validAthleteIds },
    role: 'athlete',
    coaches: coachId // <<< CRITICAL: Ensure athlete is coached by this coach
  }).select('_id'); // Select only ID

  const foundAthleteIds = athletes.map(a => a._id.toString());
  const notFoundOrUnassignedIds = validAthleteIds.filter(id => !foundAthleteIds.includes(id.toString()));

  if (notFoundOrUnassignedIds.length > 0) {
      console.warn(`[Assign Bulk] Athletes not found or not assigned to coach ${coachId}: ${notFoundOrUnassignedIds.join(', ')}`);
      // Decide: return error or proceed with found athletes?
      // Proceeding with found athletes for now.
      if (foundAthleteIds.length === 0) {
          return next(new AppError('None of the selected athletes could be found or belong to you.', 400));
      }
  }

  console.log(`[Assign Bulk] Valid athletes found: ${foundAthleteIds.length}`);

  // 3. Update Athletes: Add regimenId to each athlete's regimens array
  // Use $addToSet to avoid duplicates
  const athleteUpdateResult = await User.updateMany(
    { _id: { $in: foundAthleteIds } },
    { $addToSet: { regimens: regimen._id } } 
  );
  console.log(`[Assign Bulk] Athlete update result: ${athleteUpdateResult.modifiedCount} modified`);

  // 4. Update Regimen: Add athlete IDs to the regimen's assignedTo array
  // Use $addToSet to avoid duplicates
  const regimenUpdateResult = await Regimen.findByIdAndUpdate(
    regimen._id,
    { $addToSet: { assignedTo: { $each: foundAthleteIds } } },
    { new: true } // Optional: return updated doc
  );
  console.log(`[Assign Bulk] Regimen assignedTo update result: ${regimenUpdateResult.assignedTo.length} total assigned`);


  res.status(200).json({
    status: 'success',
    message: `Regimen successfully assigned to ${foundAthleteIds.length} athletes.`,
    assignedAthleteIds: foundAthleteIds
    // Optionally include notFoundOrUnassignedIds
  });
});

// @desc    Get athlete's current coach
// @route   GET /api/auth/my-coach
// @access  Private/Athlete
exports.getMyCoach = catchAsync(async (req, res, next) => {
  try {
    if (req.user.role !== 'athlete') {
      return res.status(403).json({
        status: 'error',
        message: 'Only athletes can access their coach information'
      });
    }

    if (!req.user.coachId) {
      return res.status(404).json({
        status: 'error',
        message: 'You do not have a coach assigned'
      });
    }

    const coach = await User.findById(req.user.coachId)
      .select('firstName lastName email role specialties bio experience qualifications avatarUrl socialLinks');

    if (!coach) {
      return res.status(404).json({
        status: 'error',
        message: 'Coach not found'
      });
    }

    // Format the coach data to match the frontend expectations
    const formattedCoach = {
      id: coach._id,
      firstName: coach.firstName || '',
      lastName: coach.lastName || '',
      email: coach.email || '',
      role: coach.role || 'coach',
      specialties: Array.isArray(coach.specialties) ? coach.specialties : [],
      bio: coach.bio || '',
      experience: coach.experience || '',
      qualifications: Array.isArray(coach.qualifications) ? coach.qualifications : [],
      avatarUrl: coach.avatarUrl || '',
      socialLinks: coach.socialLinks || {}
    };

    res.status(200).json({
      status: 'success',
      data: {
        coach: formattedCoach
      }
    });
  } catch (error) {
    console.error('Error in getMyCoach:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching coach information'
    });
  }
});

// @desc    Get athlete's coach history
// @route   GET /api/auth/coach-history
// @access  Private/Athlete
exports.getCoachHistory = catchAsync(async (req, res, next) => {
  // Check if user making request is an athlete
  if (req.user.role !== 'athlete') {
    return next(new AppError('Only athletes can access their coach history', 403));
  }

  // If the athlete doesn't have a coach, return empty array
  if (!req.user.coachId) {
    return res.status(200).json({
      status: 'success',
      data: {
        coaches: []
      }
    });
  }

  // Find the coach
  const coach = await User.findById(req.user.coachId).select('firstName lastName specialties bio experience createdAt');
  
  if (!coach) {
    return res.status(200).json({
      status: 'success',
      data: {
        coaches: []
      }
    });
  }

  // Return only the current coach without any mock data
  res.status(200).json({
    status: 'success',
    data: {
      coaches: coach ? [{
        _id: coach._id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        specialties: coach.specialties || [],
        bio: coach.bio || '',
        experience: coach.experience || '',
        createdAt: coach.createdAt,
        current: true
      }] : []
    }
  });
});

// @desc    Update coach profile
// @route   POST /api/auth/update-profile
// @access  Private/Coach
exports.updateCoachProfile = catchAsync(async (req, res, next) => {
  // Check if user is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can update their profile information', 403));
  }

  // Fields allowed to be updated
  const allowedFields = {
    firstName: true,
    lastName: true,
    bio: true,
    experience: true,
    specialties: true,
    qualifications: true,
    avatarUrl: true,
    socialLinks: true
  };

  // Filter out only allowed fields
  const filteredBody = {};
  Object.keys(req.body).forEach(field => {
    if (allowedFields[field]) {
      filteredBody[field] = req.body[field];
    }
  });

  // Update the user document
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  );

  // Return updated profile
  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        bio: updatedUser.bio,
        experience: updatedUser.experience,
        specialties: updatedUser.specialties,
        qualifications: updatedUser.qualifications,
        avatarUrl: updatedUser.avatarUrl,
        socialLinks: updatedUser.socialLinks
      }
    }
  });
});

// @desc    Get athlete's coaches from the coaches array
// @route   GET /api/auth/my-coaches
// @access  Private/Athlete
exports.getMyCoaches = catchAsync(async (req, res, next) => {
  try {
    if (req.user.role !== 'athlete') {
      return res.status(403).json({
        status: 'error',
        message: 'Only athletes can access their coaches information'
      });
    }

    // If the athlete doesn't have any coaches, return empty array
    if (!req.user.coaches || req.user.coaches.length === 0) {
      console.log('User has no coaches in coaches array');
      return res.status(200).json({
        status: 'success',
        data: {
          coaches: []
        }
      });
    }

    console.log(`Fetching coaches for athlete: ${req.user.email}`);
    console.log(`Coaches array: ${JSON.stringify(req.user.coaches)}`);
    
    // Find all coaches in the coaches array
    const coaches = await User.find({
      _id: { $in: req.user.coaches },
      role: 'coach'
    }).select('firstName lastName email role specialties bio experience qualifications avatarUrl socialLinks');

    console.log(`Found ${coaches.length} coaches`);

    // Format the coaches data to match the frontend expectations
    const formattedCoaches = coaches.map(coach => ({
      id: coach._id,
      _id: coach._id, // Include both formats for compatibility
      firstName: coach.firstName || '',
      lastName: coach.lastName || '',
      email: coach.email || '',
      role: coach.role || 'coach',
      specialties: Array.isArray(coach.specialties) ? coach.specialties : [],
      bio: coach.bio || '',
      experience: coach.experience || '',
      qualifications: Array.isArray(coach.qualifications) ? coach.qualifications : [],
      avatarUrl: coach.avatarUrl || '',
      socialLinks: coach.socialLinks || {},
      isPrimary: req.user.primaryCoachId && coach._id.equals(req.user.primaryCoachId)
    }));

    res.status(200).json({
      status: 'success',
      data: {
        coaches: formattedCoaches
      }
    });
  } catch (error) {
    console.error('Error in getMyCoaches:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching coaches information'
    });
  }
}); 