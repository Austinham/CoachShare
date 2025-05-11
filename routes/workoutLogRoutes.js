const express = require('express');
const workoutLogController = require('../controllers/workoutLogController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware - require authentication
router.use(authController.protect);

// Route for athlete to get their own workout logs
router.get('/my-logs', workoutLogController.getMyWorkoutLogs);

// Route for coaches to get logs for a specific athlete
router.get('/coach/athlete/:athleteId', 
    authController.restrictTo('coach'),
    workoutLogController.getAthleteWorkoutLogs // Reusing this - might need specific logic later
);

// Route for coaches to get logs for their assigned athletes
router.get('/coach/my-athletes', 
    authController.restrictTo('coach'),
    workoutLogController.getCoachWorkoutLogs // Fetch logs for all athletes assigned to the coach
);

// Route for coaches to get workout stats for their dashboard
router.get('/coach/stats', 
    authController.restrictTo('coach'),
    workoutLogController.getWorkoutLogStats
);

// Routes for workout logs
router.route('/')
  .post(workoutLogController.createWorkoutLog);

// Get workout logs shared with the athlete
router.get('/athlete/shared', workoutLogController.getAthleteSharedLogs);

// DEBUG ENDPOINT: Get all workout logs with detailed info (coach or admin only)
// Add role restriction middleware
router.get('/debug', authController.restrictTo('coach', 'admin'), workoutLogController.debugWorkoutLogs);

// Get orphaned logs before cleanup
router.get('/orphaned', workoutLogController.getOrphanedLogs);

// Must be defined BEFORE the general /:id route
router.delete('/cleanup', workoutLogController.handleCleanupRequest);

// Delete all workout logs for a specific regimen (might be less used now)
router.delete('/regimen/:regimenId', workoutLogController.deleteWorkoutLogsByRegimen);

// Routes for specific workout logs (e.g., /:logId)
// MUST be last to avoid catching specific routes like /cleanup or /debug
router.route('/:id')
  .get(workoutLogController.getWorkoutLog)
  .patch(workoutLogController.updateWorkoutLog)
  .delete(workoutLogController.deleteWorkoutLog);

module.exports = router; 