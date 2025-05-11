const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const regimenController = require('../controllers/regimenController');
const authController = require('../controllers/authController');

// Protect all routes
router.use(protect);

// Coach routes - only accessible by coaches who created the regimens
router.get('/coach', restrictTo('coach'), regimenController.getCoachRegimens);
router.post('/', restrictTo('coach'), regimenController.createRegimen);
router.patch('/:id', restrictTo('coach'), regimenController.updateRegimen);
router.delete('/:id', restrictTo('coach'), regimenController.deleteRegimen);
router.post('/:id/assign', restrictTo('coach'), regimenController.assignRegimen);
router.post('/:id/remove-athlete', restrictTo('coach'), regimenController.removeAthlete);

// Athlete routes - only accessible by athletes assigned to the regimens
router.get('/athlete', restrictTo('athlete'), regimenController.getAthleteRegimens);

// New route to validate regimen IDs
router.get('/validate', async (req, res) => {
  try {
    const { ids } = req.query;
    console.log(`Validating regimen IDs: ${ids}`);
    
    if (!ids) {
      return res.status(400).json({
        status: 'fail',
        message: 'No regimen IDs provided'
      });
    }
    
    const idArray = ids.split(',').filter(Boolean);
    console.log(`Parsed ${idArray.length} regimen IDs for validation`);
    
    // Find all regimens that still exist with these IDs
    const Regimen = require('../models/Regimen');
    const regimens = await Regimen.find({
      _id: { $in: idArray }
    }).select('_id name');
    
    console.log(`Found ${regimens.length} existing regimens out of ${idArray.length} requested`);
    
    return res.status(200).json({
      status: 'success',
      data: regimens
    });
  } catch (error) {
    console.error('Error validating regimen IDs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while validating regimen IDs',
      error: error.message
    });
  }
});

// Root route - handle based on user role (MUST come after the specific routes)
router.get('/', (req, res, next) => {
  console.log('----------------------------------------------');
  console.log(`ROOT REGIMENS ROUTE: ${req.originalUrl}`);
  console.log(`User: ${req.user.email} (${req.user._id})`);
  console.log(`Role: ${req.user.role}`);
  console.log('----------------------------------------------');
  
  // If user is a coach, get their regimens
  if (req.user.role === 'coach') {
    console.log('Redirecting coach to getCoachRegimens controller');
    
    // Explicitly check that this is a coach account
    if (!req.user._id) {
      return res.status(403).json({
        status: 'fail',
        message: 'Coach account is required'
      });
    }
    
    return regimenController.getCoachRegimens(req, res, next);
  }
  // If user is an athlete, get their assigned regimens
  else if (req.user.role === 'athlete') {
    console.log('Redirecting athlete to getAthleteRegimens controller');
    return regimenController.getAthleteRegimens(req, res, next);
  }
  // If role is not recognized, return an error
  else {
    console.log(`Unrecognized role: ${req.user.role}`);
    return res.status(403).json({
      status: 'fail',
      message: 'You do not have permission to access regimens'
    });
  }
});

// Shared routes - accessible by both coaches and athletes with proper access checks
// This MUST be the last route to avoid capturing 'coach' or 'athlete' as an ID
router.get('/:id', regimenController.getRegimenById);

// Add special route for test regimens
router.delete(
  '/admin-delete/:id', 
  regimenController.adminDeleteRegimen
);

module.exports = router; 