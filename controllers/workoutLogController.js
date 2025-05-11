const workoutLogService = require('../services/workoutLogService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const WorkoutLog = require('../models/WorkoutLog');
const Regimen = require('../models/Regimen');

// Create a new workout log
exports.createWorkoutLog = catchAsync(async (req, res, next) => {
  const athleteId = req.user._id; // Log belongs to the authenticated user (athlete)
  const logData = req.body; // Pass the entire body to the service for handling

  // Call the service function to create the log
  const newLog = await workoutLogService.createWorkoutLog(athleteId, logData);

  // Service handles validation and creation. If it returns, it was successful.
  res.status(201).json({
    status: 'success',
    data: newLog
  });
});

// Get all workout logs shared with the requesting coach
exports.getCoachWorkoutLogs = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can view shared workout logs', 403));
  }
  const coachId = req.user._id;
  console.log(`[DEBUG] Getting logs shared with coach: ${req.user.email} (ID: ${coachId})`);

  // --- NEW ACCESS LOGIC --- 
  const sharedLogs = await workoutLogService.getLogsForCoach(coachId);

  console.log(`[DEBUG] Found ${sharedLogs.length} logs explicitly shared with coach ${coachId}`);

  // Process logs to add athlete details
  const processedLogs = sharedLogs.map(log => {
    return log;
  });

  res.status(200).json({
    status: 'success',
    data: processedLogs
  });
});

// Get workout logs for a specific athlete
exports.getAthleteWorkoutLogs = catchAsync(async (req, res, next) => {
  const { athleteId } = req.params;
  
  // Check if user is authorized
  if (req.user.role === 'athlete' && req.user._id.toString() !== athleteId) {
    return next(new AppError('You can only view your own workout logs', 403));
  }
  
  if (req.user.role === 'coach') {
    // Check if this athlete is coached by this coach
    const athlete = await workoutLogService.getAthlete(athleteId);
    
    if (!athlete) {
      return next(new AppError('Athlete not found', 404));
    }
    
    if (!athlete.coaches.includes(req.user._id)) {
      return next(new AppError('This athlete is not assigned to you', 403));
    }
  }
  
  // Fetch workout logs
  const workoutLogs = await workoutLogService.getAthleteWorkoutLogs(athleteId);
  
  res.status(200).json({
    status: 'success',
    data: workoutLogs
  });
});

// Get workout statistics based on logs shared with the coach
exports.getWorkoutLogStats = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can view workout statistics', 403));
  }
  const coachId = req.user._id;
  console.log(`[DEBUG] Getting stats for logs shared with coach: ${req.user.email} (ID: ${coachId})`);

  const statsData = await workoutLogService.getStatsForCoach(coachId);

  console.log(`[DEBUG] Stats calculated by service:`, statsData);

  res.status(200).json({
    status: 'success',
    data: statsData
  });
});

// Get a single workout log
exports.getWorkoutLog = catchAsync(async (req, res, next) => {
  const logId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  // Use the new service function which includes authorization
  const workoutLog = await workoutLogService.fetchWorkoutLogById(logId, userId, userRole);
  
  // No need for separate auth checks here, service handles it
  // If the service didn't throw an error, the user is authorized and log exists
  
  res.status(200).json({
    status: 'success',
    data: workoutLog
  });
});

// Update a workout log
exports.updateWorkoutLog = catchAsync(async (req, res, next) => {
  const logId = req.params.id;
  const userId = req.user._id; // ID of the user making the request
  const updateData = req.body;

  // ** Important: Need to fetch the log with auth check BEFORE updating **
  // Use the same service function to ensure user has rights before proceeding
  const log = await workoutLogService.fetchWorkoutLogById(logId, userId, req.user.role);

  // If fetchWorkoutLogById didn't throw, we know the log exists and the user is the athlete owner (or potentially a coach, need to refine logic for update)
  // Let's restrict update to athlete owner ONLY for now.
  if (req.user.role !== 'athlete' || log.athleteId._id.toString() !== userId.toString()) {
     return next(new AppError('Only the athlete owner can update their workout log.', 403));
  }

  // Filter updates (This part might need to move to the service layer too)
  const allowedUpdates = ['rating', 'notes', 'difficulty', 'completed', 'duration', 'exercises', 'sharedWith'];
  const filteredUpdateData = {};
  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
        // Special handling for sharedWith to ensure valid ObjectIds
        if (key === 'sharedWith' && Array.isArray(updateData.sharedWith)) {
            const validSharedWith = updateData.sharedWith
                .filter(id => mongoose.Types.ObjectId.isValid(id)) // Ensure mongoose is imported or available
                .map(id => new mongoose.Types.ObjectId(id));
            // Ensure athlete doesn't share with themselves
            filteredUpdateData[key] = validSharedWith.filter(id => !id.equals(log.athleteId._id));
        } else if (key !== 'sharedWith') {
             filteredUpdateData[key] = updateData[key];
        }
    }
  });

  const updatedLog = await workoutLogService.updateWorkoutLog(logId, filteredUpdateData);

  res.status(200).json({
    status: 'success',
    data: updatedLog
  });
});

// Delete a workout log
exports.deleteWorkoutLog = catchAsync(async (req, res, next) => {
  const logId = req.params.id;
  const userId = req.user._id;
  const userRole = req.user.role;

  // Fetch the log using the auth-checking service function first
  // Note: fetchWorkoutLogById checks if the user is the athlete OR their coach.
  // We might need more specific logic for deletion (e.g., only athlete owner or maybe admin?)
  await workoutLogService.fetchWorkoutLogById(logId, userId, userRole);

  // If the above didn't throw, the user has permission to view.
  // Now, decide if they have permission to DELETE.
  // For now, let's assume the permissions checked by fetchWorkoutLogById are sufficient for delete.
  // TODO: Revisit delete permissions (maybe only athlete owner?)

  await workoutLogService.deleteWorkoutLog(logId);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Delete all workout logs for a specific regimen (API endpoint)
exports.deleteWorkoutLogsByRegimen = catchAsync(async (req, res, next) => {
  const { regimenId } = req.params;
  
  // Find the regimen to verify it exists and check permissions
  const regimen = await workoutLogService.getRegimen(regimenId);
  
  if (!regimen) {
    return next(new AppError('Regimen not found', 404));
  }
  
  // Check if the user has permission to delete logs for this regimen
  if (req.user.role === 'coach') {
    // For coaches, check if they created the regimen
    if (regimen.createdBy.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only delete logs for regimens you created', 403));
    }
  } else {
    // Only coaches can bulk delete logs
    return next(new AppError('Only coaches can delete all logs for a regimen', 403));
  }
  
  // Delete all workout logs for this regimen
  const result = await workoutLogService.deleteWorkoutLogsByRegimen(regimenId);
  
  res.status(200).json({
    status: 'success',
    message: `${result.deletedCount} workout logs deleted successfully`,
    data: null
  });
});

// Direct function call for internal use (no request/response)
exports.deleteWorkoutLogsByRegimenId = async (regimenId) => {
  try {
    console.log(`[INTERNAL] Deleting all workout logs for regimen ID: ${regimenId}`);
    const result = await workoutLogService.deleteWorkoutLogsByRegimen(regimenId);
    console.log(`[INTERNAL] Successfully deleted ${result.deletedCount} workout logs for regimen ${regimenId}`);
    return result;
  } catch (error) {
    console.error(`Error deleting workout logs for regimen ${regimenId}:`, error);
    throw error;
  }
};

// DEBUG ENDPOINT: Get all workout logs with detailed information
exports.debugWorkoutLogs = catchAsync(async (req, res, next) => {
  // Only coaches and admins can access this debug endpoint
  if (req.user.role !== 'coach' && req.user.role !== 'admin') {
    return next(new AppError('Only coaches and admins can access this debug endpoint', 403));
  }

  console.log(`[DEBUG] Debug endpoint called by ${req.user.email} (${req.user._id})`);
  
  // Get all workout logs in the system
  const allLogs = await workoutLogService.getAllWorkoutLogs();
  
  console.log(`[DEBUG] Found ${allLogs.length} total workout logs in the system`);
  
  // Get all regimens referenced in these logs
  const regimenIds = [...new Set(allLogs.map(log => log.regimenId))];
  const regimens = await workoutLogService.getRegimens(regimenIds);
  
  // Create a map of regimen details by ID
  const regimenMap = {};
  regimens.forEach(regimen => {
    regimenMap[regimen._id.toString()] = {
      id: regimen.id, // UUID
      mongoId: regimen._id.toString(),
      name: regimen.name,
      createdBy: regimen.createdBy,
      assignedTo: regimen.assignedTo?.map(id => id.toString()) || []
    };
  });
  
  // Get all athletes referenced in the logs
  const athleteIds = [...new Set(allLogs.map(log => log.athleteId))];
  const athletes = await workoutLogService.getAthletes(athleteIds);
  
  // Create a map of athlete details by ID
  const athleteMap = {};
  athletes.forEach(athlete => {
    athleteMap[athlete._id.toString()] = {
      id: athlete._id.toString(),
      email: athlete.email,
      name: athlete.firstName && athlete.lastName 
        ? `${athlete.firstName} ${athlete.lastName}` 
        : athlete.email || 'Unknown',
      coaches: athlete.coaches?.map(id => id.toString()) || []
    };
  });
  
  // Get all coaches
  const coachIds = [...new Set(regimens.map(r => r.createdBy?.toString()).filter(Boolean))];
  const coaches = await workoutLogService.getCoaches(coachIds);
  
  // Create a map of coach details by ID
  const coachMap = {};
  coaches.forEach(coach => {
    coachMap[coach._id.toString()] = {
      id: coach._id.toString(),
      email: coach.email,
      name: coach.firstName && coach.lastName 
        ? `${coach.firstName} ${coach.lastName}` 
        : coach.email || 'Unknown',
      athletes: coach.athletes?.map(id => id.toString()) || []
    };
  });
  
  // Enrich logs with detailed information
  const enrichedLogs = allLogs.map(log => {
    const logRegimenId = log.regimenId?.toString();
    const logAthleteId = log.athleteId?.toString();
    const regimen = regimenMap[logRegimenId] || { id: 'Not found', name: 'Unknown Regimen' };
    const athlete = athleteMap[logAthleteId] || { id: 'Not found', name: 'Unknown Athlete' };
    const coach = coachMap[regimen.createdBy?.toString()] || { id: 'Not found', name: 'Unknown Coach' };
    
    // Check relationship status
    const coachHasAthlete = coach.athletes?.includes(logAthleteId);
    const athleteHasCoach = athlete.coaches?.includes(coach.id);
    const regimenHasAthlete = regimen.assignedTo?.includes(logAthleteId);
    
    return {
      ...log,
      _id: log._id.toString(),
      regimenId: log.regimenId?.toString(),
      athleteId: log.athleteId?.toString(),
      regimenDetails: regimen,
      athleteDetails: athlete,
      coachDetails: coach,
      relationshipStatus: {
        coachHasAthlete,
        athleteHasCoach,
        regimenHasAthlete,
        relationshipsComplete: coachHasAthlete && athleteHasCoach && regimenHasAthlete
      }
    };
  });
  
  // Calculate summary statistics
  const completeLogs = enrichedLogs.filter(log => log.relationshipStatus.relationshipsComplete);
  const incompleteLogs = enrichedLogs.filter(log => !log.relationshipStatus.relationshipsComplete);
  
  const summary = {
    totalLogs: enrichedLogs.length,
    completeRelationships: completeLogs.length,
    incompleteRelationships: incompleteLogs.length,
    currentCoachId: req.user._id.toString(),
    coachLogsCount: enrichedLogs.filter(log => 
      log.regimenDetails.createdBy?.toString() === req.user._id.toString()
    ).length,
    regimenCounts: Object.values(regimenMap).reduce((acc, regimen) => {
      acc[regimen.name] = (acc[regimen.name] || 0) + 1;
      return acc;
    }, {}),
    relationshipIssues: {
      missingCoachToAthlete: incompleteLogs.filter(log => !log.relationshipStatus.coachHasAthlete).length,
      missingAthleteToCoach: incompleteLogs.filter(log => !log.relationshipStatus.athleteHasCoach).length,
      missingRegimenToAthlete: incompleteLogs.filter(log => !log.relationshipStatus.regimenHasAthlete).length
    }
  };
  
  // Return the detailed information
  res.status(200).json({
    status: 'success',
    summary,
    data: enrichedLogs
  });
});

// Controller function for the DELETE /cleanup route
exports.handleCleanupRequest = catchAsync(async (req, res, next) => {
  // Basic authorization: Check if user is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can perform this cleanup action.', 403));
  }

  console.log(`[INFO] Orphaned log cleanup requested by coach: ${req.user.email} (${req.user._id})`);

  // Get the list of log IDs to delete from the request body
  const { logIds } = req.body;

  // If logIds is provided, delete only those specific logs
  if (logIds && Array.isArray(logIds)) {
    console.log(`[INFO] Deleting specific logs: ${logIds.length} logs requested`);
    
    // Verify these logs are actually orphaned
    const logs = await WorkoutLog.find({ _id: { $in: logIds } });
    
    // Use Promise.all to handle async operations in filter
    const orphanedLogs = await Promise.all(
      logs.map(async (log) => {
        const regimenExists = await Regimen.exists({ _id: log.regimenId });
        return regimenExists ? null : log;
      })
    ).then(results => results.filter(log => log !== null));

    if (orphanedLogs.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No orphaned logs found among the selected logs.',
        deletedCount: 0
      });
    }

    // Delete only the orphaned logs
    const deleteResult = await WorkoutLog.deleteMany({
      _id: { $in: orphanedLogs.map(log => log._id) }
    });

    return res.status(200).json({
      status: 'success',
      message: `Successfully deleted ${deleteResult.deletedCount} orphaned logs.`,
      deletedCount: deleteResult.deletedCount
    });
  }

  // If no specific logs are provided, delete all orphaned logs
  const result = await workoutLogService.deleteOrphanedLogs();
  
  res.status(200).json({
    status: 'success',
    message: `Successfully deleted ${result.deletedCount} orphaned logs.`,
    deletedCount: result.deletedCount
  });
});

// <<< NEW FUNCTION: Get logs created by the athlete, populating shared coaches >>>
exports.getAthleteSharedLogs = catchAsync(async (req, res, next) => {
  const athleteId = req.user._id; // Get ID from authenticated user

  console.log(`[DEBUG] Getting shared logs for athlete: ${req.user.email} (ID: ${athleteId})`);

  // Find logs created by this athlete
  const logs = await workoutLogService.getAthleteSharedLogs(athleteId);

  if (!logs) {
      // This case might not happen with find, it would return []
      return res.status(200).json({ status: 'success', data: [] });
  }

  console.log(`[DEBUG] Found ${logs.length} logs for athlete ${athleteId}, populated sharedWith.`);

  // We can send the logs directly as populate handles adding coach details
  res.status(200).json({
    status: 'success',
    results: logs.length,
    data: logs
  });
});

// Get workout logs for the currently logged-in athlete
exports.getMyWorkoutLogs = catchAsync(async (req, res, next) => {
    // Ensure the user is an athlete
    if (req.user.role !== 'athlete') {
        return next(new AppError('Only athletes can access their own logs this way.', 403));
    }
    
    const athleteId = req.user._id; // Get ID from authenticated user
    console.log(`Controller: Fetching logs for athlete ${req.user.email}`);

    const logs = await workoutLogService.fetchMyWorkoutLogs(athleteId);

    res.status(200).json({
        status: 'success',
        results: logs.length,
        data: logs // Send logs directly, not nested like { logs: logs }
    });
});

// Get orphaned workout logs
exports.getOrphanedLogs = catchAsync(async (req, res, next) => {
  // Basic authorization: Check if user is a coach
  if (req.user.role !== 'coach') {
    return next(new AppError('Only coaches can view orphaned logs.', 403));
  }

  console.log(`[INFO] Orphaned log fetch requested by coach: ${req.user.email} (${req.user._id})`);

  // Get all distinct regimenIds from WorkoutLogs
  const logRegimenIds = await WorkoutLog.distinct('regimenId');
  const validLogRegimenIds = logRegimenIds.filter(id => id != null);

  // Get all existing Regimen _ids
  const existingRegimenDocs = await Regimen.find({}, '_id');
  const existingRegimenIds = new Set(existingRegimenDocs.map(doc => doc._id.toString()));

  // Identify orphaned regimenIds
  const orphanedRegimenIds = validLogRegimenIds.filter(logRegimenId => {
    const logIdStr = typeof logRegimenId === 'string' ? logRegimenId : logRegimenId.toString();
    return !existingRegimenIds.has(logIdStr);
  });

  if (orphanedRegimenIds.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: []
    });
  }

  // Fetch the actual orphaned logs with details
  const orphanedLogs = await WorkoutLog.find({
    regimenId: { $in: orphanedRegimenIds }
  })
  .select('regimenId regimenName dayId dayName exercises completedAt')
  .sort('-completedAt')
  .lean();

  return res.status(200).json({
    status: 'success',
    data: orphanedLogs
  });
}); 