const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// Public routes
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/verify/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.get('/logout', authController.logout);

// Special route - accessible without authentication
router.get('/link-athlete/:email', async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Find the athlete by email
    const athleteEmail = req.params.email;
    const athlete = await User.findOne({ email: athleteEmail });
    
    if (!athlete) {
      return res.status(404).json({
        status: 'error',
        message: `No athlete found with email ${athleteEmail}`
      });
    }
    
    // Find coach account
    const coach = await User.findOne({ email: 'austin-hamilton17@hotmail.com' });
    
    if (!coach) {
      return res.status(404).json({
        status: 'error',
        message: 'Coach account not found'
      });
    }
    
    // Link athlete to coach
    athlete.coachId = coach._id;
    await athlete.save();
    
    // Add athlete to coach's athletes array if not already there
    if (!coach.athletes) {
      coach.athletes = [];
    }
    
    if (!coach.athletes.some(id => id.equals(athlete._id))) {
      coach.athletes.push(athlete._id);
      await coach.save();
    }
    
    return res.status(200).json({
      status: 'success',
      message: `Successfully linked ${athleteEmail} to coach account`,
      data: {
        athlete: {
          id: athlete._id,
          email: athlete.email,
          firstName: athlete.firstName,
          lastName: athlete.lastName
        }
      }
    });
  } catch (error) {
    console.error('Error linking athlete:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Protected routes
router.use(authMiddleware.protect); // All routes after this middleware require authentication

// Add token refresh endpoint
router.post('/refresh-token', (req, res) => {
  try {
    // User is already authenticated through middleware
    // Generate a new token
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
    
    // Set cookie options
    const cookieOptions = {
      expires: new Date(
        Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      path: '/'
    };
    
    // Send JWT in cookie and response
    res.cookie('jwt', token, cookieOptions);
    
    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refresh token'
    });
  }
});

// Simple auth check endpoint
router.get('/check', (req, res) => {
  // If middleware passes, user is authenticated
  res.status(200).json({
    status: 'success',
    authenticated: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Profile routes
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

router.post('/update-profile', authController.updateCoachProfile);

// Coach routes
router.get('/coaches', authController.getCoaches);
router.get('/my-coach', authController.getMyCoach);
router.get('/my-coaches', authController.getMyCoaches);
router.get('/coach-history', authController.getCoachHistory);
router.post('/request-coach', authController.requestCoach);

router.patch('/update-me', authController.updateMe);
router.patch('/update-password', authController.updatePassword);
router.delete('/delete-account', authController.deleteAccount);

// Coach-specific routes
router.post('/invite-athlete', authController.inviteAthlete);
router.get('/athletes', authController.getAthletes);
router.patch('/update-athlete/:id', authController.updateAthlete);
router.delete('/remove-athlete/:id', authController.removeAthlete);

// Coach routes with role restriction
router.post('/assign-regimen', authMiddleware.restrictTo('coach'), authController.assignRegimen);
router.post('/assign-regimen-bulk', authMiddleware.restrictTo('coach'), authController.assignRegimenBulk);

module.exports = router;
