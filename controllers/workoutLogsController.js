const WorkoutLog = require('../models/WorkoutLog');
const User = require('../models/User');
const mongoose = require('mongoose');
const Regimen = require('../models/Regimen');

// Get all workout logs for a coach's athletes
exports.getCoachWorkoutLogs = async (req, res) => {
  try {
    // Get coach ID from the authenticated user or from query params
    const coachId = req.query.coachId || req.user._id;
    const filter = req.query.filter || 'myAthletes'; // Added filter parameter ('myAthletes' or 'all')

    console.log(`Fetching coach workout logs for coach: ${coachId}, filter: ${filter}`);

    if (!coachId) {
      return res.status(400).json({
        status: 'error',
        message: 'Coach ID is required'
      });
    }

    // TODO: In the future, adjust the query based on the 'filter'
    // For now, 'all' and 'myAthletes' return the same - only directly coached athletes.

    // Get all athletes assigned to this coach
    const athletes = await User.find({
      role: 'athlete',
      coachId: coachId // This currently limits logs to directly coached athletes
    }).select('_id');

    if (!athletes || athletes.length === 0) {
      console.log(`No athletes found for coach ${coachId}`);
      return res.json({
        status: 'success',
        data: [],
        message: 'No athletes found for this coach'
      });
    }

    const athleteIds = athletes.map(athlete => athlete._id);

    // Find all workout logs for these athletes
    const workoutLogs = await WorkoutLog.find({
      athleteId: { $in: athleteIds }
    })
    .populate('athleteId', 'firstName lastName') // Populate athlete name
    .sort({ completedAt: -1 });

    // Add the isDirectlyCoached flag before sending
    const logsWithFlag = workoutLogs.map(log => {
      // Convert Mongoose document to plain object if necessary
      const logObject = log.toObject ? log.toObject() : log;
      return {
        ...logObject,
        isDirectlyCoached: true // Always true based on current query
      };
    });

    console.log(`Returning ${logsWithFlag.length} workout logs with isDirectlyCoached flag.`);

    return res.json({
      status: 'success',
      data: logsWithFlag,
      message: `Retrieved ${logsWithFlag.length} workout logs`
    });

  } catch (error) {
    console.error('Error getting coach workout logs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get coach workout logs'
    });
  }
};

// Get workout log statistics
exports.getWorkoutLogStats = async (req, res) => {
  try {
    // Get coach ID from the authenticated user or from query params
    const coachId = req.query.coachId || req.user._id;

    if (!coachId) {
      return res.status(400).json({
        status: 'error',
        message: 'Coach ID is required'
      });
    }

    // First, get all athletes assigned to this coach
    const athletes = await User.find({ 
      role: 'athlete',
      coachId: coachId
    }).select('_id');

    if (!athletes || athletes.length === 0) {
      return res.json({
        status: 'success',
        data: {
          totalWorkouts: 0,
          averageRating: 0,
          averageDuration: 0,
          completionRate: 0,
          recentLogs: []
        },
        message: 'No athletes found for this coach'
      });
    }

    // Get the athlete IDs
    const athleteIds = athletes.map(athlete => athlete._id);

    // Now find all workout logs for these athletes only
    const workoutLogs = await WorkoutLog.find({
      athleteId: { $in: athleteIds }
    }).sort({ completedAt: -1 });

    // Calculate statistics
    const totalWorkouts = workoutLogs.length;
    
    // Calculate average rating (if no logs, default to 0)
    const sumRatings = workoutLogs.reduce((sum, log) => sum + (log.rating || 0), 0);
    const averageRating = totalWorkouts > 0 ? sumRatings / totalWorkouts : 0;
    
    // Calculate average duration (if no logs, default to 0)
    const sumDuration = workoutLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const averageDuration = totalWorkouts > 0 ? sumDuration / totalWorkouts : 0;
    
    // Calculate completion rate
    const completedExercisesCount = workoutLogs.reduce((sum, log) => {
      const totalExercises = log.exercises ? log.exercises.length : 0;
      const completedExercises = log.exercises ? log.exercises.filter(ex => ex.completed).length : 0;
      return sum + (completedExercises / totalExercises) || 0;
    }, 0);
    
    const completionRate = totalWorkouts > 0 ? Math.round((completedExercisesCount / totalWorkouts) * 100) : 0;
    
    // Get 5 most recent logs
    const recentLogs = workoutLogs.slice(0, 5);
    
    return res.json({
      status: 'success',
      data: {
        totalWorkouts,
        averageRating,
        averageDuration,
        completionRate,
        recentLogs
      }
    });
  } catch (error) {
    console.error('Error getting workout log stats:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get workout log statistics'
    });
  }
};

// Delete all workout logs associated with a specific regimen ID
exports.deleteWorkoutLogsByRegimenId = async (regimenId) => {
  if (!regimenId) {
    console.error('Attempted to delete workout logs without providing a regimen ID.');
    return; // Or throw an error
  }

  try {
    console.log(`Attempting to delete workout logs for regimen ID: ${regimenId}`);
    // Use the string regimenId to match WorkoutLog schema which might store it as string or ObjectId
    // It's safer to delete based on the string ID if it's consistently stored
    const result = await WorkoutLog.deleteMany({ regimenId: regimenId });
    console.log(`Deleted ${result.deletedCount} workout logs for regimen ID: ${regimenId}`);
    return result;
  } catch (error) {
    console.error(`Error deleting workout logs for regimen ID ${regimenId}:`, error);
    // Rethrow the error so the calling function knows deletion failed
    throw error; 
  }
};

// Handle request to clean up orphaned workout logs
exports.handleCleanupRequest = async (req, res) => {
  try {
    console.log('Starting orphaned workout log cleanup...');

    // 1. Get all distinct regimenIds from WorkoutLogs
    const logRegimenIds = await WorkoutLog.distinct('regimenId');
    console.log(`Found ${logRegimenIds.length} distinct regimen IDs in workout logs.`);

    // Filter out any null or undefined values just in case
    const validLogRegimenIds = logRegimenIds.filter(id => id != null);
    if (validLogRegimenIds.length !== logRegimenIds.length) {
        console.warn(`Filtered out ${logRegimenIds.length - validLogRegimenIds.length} null/undefined regimen IDs from logs.`);
    }

    // 2. Get all existing Regimen _ids
    // Convert ObjectId to string for comparison if regimen IDs in logs are stored as strings
    const existingRegimenDocs = await Regimen.find({}, '_id');
    const existingRegimenIds = new Set(existingRegimenDocs.map(doc => doc._id.toString()));
    console.log(`Found ${existingRegimenIds.size} existing regimens.`);

    // 3. Identify orphaned regimenIds
    const orphanedRegimenIds = validLogRegimenIds.filter(logRegimenId => {
        // Check if the ID from the log exists in the Set of existing regimen IDs
        // Handle potential ObjectId vs String comparison
        const logIdStr = typeof logRegimenId === 'string' ? logRegimenId : logRegimenId.toString();
        return !existingRegimenIds.has(logIdStr);
    });

    console.log(`Identified ${orphanedRegimenIds.length} orphaned regimen IDs:`, orphanedRegimenIds);

    if (orphanedRegimenIds.length === 0) {
      console.log('No orphaned workout logs found.');
      return res.status(200).json({
        success: true,
        message: 'No orphaned workout logs found to clean up.',
        deletedCount: 0
      });
    }

    // 4. Delete WorkoutLogs associated with orphaned regimenIds
    const deleteResult = await WorkoutLog.deleteMany({
      regimenId: { $in: orphanedRegimenIds }
    });

    console.log(`Successfully deleted ${deleteResult.deletedCount} orphaned workout logs.`);

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} orphaned workout logs.`,
      deletedCount: deleteResult.deletedCount,
      orphanedIds: orphanedRegimenIds // Optional: return the IDs that were cleaned up
    });

  } catch (error) {
    console.error('Error during orphaned workout log cleanup:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during cleanup.',
      error: error.message
    });
  }
}; 