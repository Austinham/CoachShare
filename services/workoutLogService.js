// server/services/workoutLogService.js
const WorkoutLog = require('../models/WorkoutLog');
const User = require('../models/User');
const Regimen = require('../models/Regimen');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

/**
 * Creates a new workout log.
 * @param {string} athleteId - The ID of the athlete creating the log.
 * @param {object} logData - Data for the new workout log.
 * @param {string} logData.regimenId - ID of the regimen.
 * @param {string} logData.dayId - ID of the day within the regimen.
 * @param {string} [logData.regimenName] - Name of the regimen.
 * @param {string} [logData.dayName] - Name of the day.
 * @param {number} [logData.rating] - Workout rating.
 * @param {string} [logData.notes] - Overall workout notes.
 * @param {string} [logData.difficulty] - Perceived difficulty.
 * @param {boolean} [logData.completed=true] - Whether the workout was completed.
 * @param {Date} [logData.completedAt=new Date()] - Timestamp of completion.
 * @param {number} [logData.duration] - Duration of the workout.
 * @param {Array<object>} [logData.exercises] - Array of exercise logs.
 * @param {Array<string>} [logData.sharedWith=[]] - Array of coach IDs to share with.
 * @returns {Promise<object>} - The newly created workout log document.
 * @throws {AppError} If required fields are missing or invalid.
 */
exports.createWorkoutLog = async (athleteId, logData) => {
    const {
        regimenId,
        dayId,
        sharedWith = [],
        ...restOfLogData // Capture other fields
    } = logData;

    // Basic validation (Moved from controller)
    if (!regimenId || !dayId) {
        throw new AppError('Regimen ID and Day ID are required', 400);
    }

    // Validate sharedWith contains valid ObjectIds (Moved from controller)
    const validSharedWith = sharedWith
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

    // Ensure athlete doesn't share with themselves (Moved from controller)
    const finalSharedWith = validSharedWith.filter(id => !id.equals(athleteId));

    // Create the log
    const newLog = await WorkoutLog.create({
        athleteId,
        regimenId,
        dayId,
        sharedWith: finalSharedWith,
        ...restOfLogData // Spread remaining validated/provided data
    });

    if (!newLog) {
         throw new AppError('Failed to create workout log', 500); // Or handle error appropriately
    }

    return newLog;
};

/**
 * Fetches workout logs for athletes coached by a specific coach.
 * @param {string} coachId - The ID of the coach.
 * @param {string} filter - Filter type ('myAthletes', potentially 'all' in the future).
 * @returns {Promise<Array>} - A promise that resolves to an array of workout logs.
 */
exports.getLogsForCoach = async (coachId, filter = 'myAthletes') => {
    // 1. Find Athletes for the Coach
    const athletes = await User.find({
        role: 'athlete',
        coachId: coachId // TODO: Adjust logic if 'all' filter needs different behavior
    }).select('_id').lean(); // Use lean for performance

    if (!athletes || athletes.length === 0) {
        return []; // Return empty array
    }
    const athleteIds = athletes.map(athlete => athlete._id);

    // 2. Find Workout Logs for those Athletes
    const workoutLogs = await WorkoutLog.find({
        athleteId: { $in: athleteIds }
    })
    .populate('athleteId', 'firstName lastName avatarUrl') // Populate necessary fields
    .sort({ completedAt: -1 })
    .lean(); // Use lean

    // 3. Process/Format Logs (Example: adding athleteName)
    const processedLogs = workoutLogs.map(log => ({
        ...log,
        athleteName: (log.athleteId && typeof log.athleteId === 'object')
                     ? `${log.athleteId.firstName} ${log.athleteId.lastName}`.trim()
                     : 'Unknown Athlete',
        athleteProfilePic: (log.athleteId && typeof log.athleteId === 'object')
                           ? log.athleteId.avatarUrl
                           : undefined,
        isDirectlyCoached: true // Based on current query logic
    }));

    return processedLogs;
};

/**
 * Calculates workout statistics for a coach's athletes.
 * @param {string} coachId - The ID of the coach.
 * @returns {Promise<Object>} - Statistics object.
 */
exports.getStatsForCoach = async (coachId) => {
     const athletes = await User.find({
        role: 'athlete',
        coachId: coachId
    }).select('_id').lean();

    const defaultStats = {
        totalWorkouts: 0,
        averageRating: 0,
        averageDuration: 0,
        completionRate: 0,
        recentLogs: [],
        hasData: false
    };

    if (!athletes || athletes.length === 0) {
        return defaultStats;
    }
    const athleteIds = athletes.map(athlete => athlete._id);

    const workoutLogs = await WorkoutLog.find({
        athleteId: { $in: athleteIds }
    })
    .populate('athleteId', 'firstName lastName avatarUrl') // Populate for recent logs
    .sort({ completedAt: -1 })
    .lean(); // Use lean for calculations

    const totalWorkouts = workoutLogs.length;
    if (totalWorkouts === 0) {
        return defaultStats;
    }

    const sumRatings = workoutLogs.reduce((sum, log) => sum + (log.rating || 0), 0);
    const averageRating = totalWorkouts > 0 ? sumRatings / totalWorkouts : 0;

    const sumDuration = workoutLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const averageDuration = totalWorkouts > 0 ? sumDuration / totalWorkouts : 0;

    // Note: Completion rate calculation might need adjustment based on actual data structure
    const completedExercisesCount = workoutLogs.reduce((sum, log) => {
        const totalExercises = log.exercises ? log.exercises.length : 0;
        if (totalExercises === 0) return sum;
        const completedExercises = log.exercises ? log.exercises.filter(ex => ex.completed).length : 0;
        return sum + (completedExercises / totalExercises);
    }, 0);
    const completionRate = totalWorkouts > 0 ? Math.round((completedExercisesCount / totalWorkouts) * 100) : 0;

    const recentLogs = workoutLogs.slice(0, 5).map(log => ({ // Process recent logs similarly
        ...log,
        athleteName: (log.athleteId && typeof log.athleteId === 'object')
                     ? `${log.athleteId.firstName} ${log.athleteId.lastName}`.trim()
                     : 'Unknown Athlete',
        athleteProfilePic: (log.athleteId && typeof log.athleteId === 'object')
                           ? log.athleteId.avatarUrl
                           : undefined,
    }));


    return {
        totalWorkouts,
        averageRating,
        averageDuration,
        completionRate,
        recentLogs,
        hasData: true
    };
};

/**
 * Deletes workout logs associated with non-existent regimens.
 * @returns {Promise<number>} - The number of deleted logs.
 */
exports.deleteOrphanedLogs = async () => {
    console.log('Service: Starting orphaned workout log cleanup...');

    const logRegimenIds = await WorkoutLog.distinct('regimenId');
    const validLogRegimenIds = logRegimenIds.filter(id => id != null); 
    console.log(`Service: Found ${validLogRegimenIds.length} unique regimen IDs in logs:`, validLogRegimenIds.map(id => id?.toString())); // Log found log regimen IDs

    const existingRegimenDocs = await Regimen.find({}, '_id').lean();
    const existingRegimenIdsSet = new Set(existingRegimenDocs.map(doc => doc._id.toString()));
    console.log(`Service: Found ${existingRegimenIdsSet.size} existing regimen IDs:`, Array.from(existingRegimenIdsSet)); // Log existing regimen IDs

    const orphanedRegimenIds = validLogRegimenIds.filter(logRegimenId => {
        const logIdStr = typeof logRegimenId === 'string' ? logRegimenId : logRegimenId?.toString();
        return logIdStr && !existingRegimenIdsSet.has(logIdStr); 
    });
    console.log(`Service: Identified ${orphanedRegimenIds.length} orphaned regimen IDs to target for deletion:`, orphanedRegimenIds.map(id => id?.toString())); // Log the IDs being targeted

    if (orphanedRegimenIds.length === 0) {
        console.log('Service: No orphaned logs found to delete.');
        return 0; 
    }

    console.log(`Service: Preparing to delete logs with regimenId IN [${orphanedRegimenIds.map(id => id?.toString()).join(', ')}]`); // Log before delete
    const deleteResult = await WorkoutLog.deleteMany({
        regimenId: { $in: orphanedRegimenIds }
    });

    console.log(`Service: Successfully deleted ${deleteResult.deletedCount} orphaned workout logs.`);
    return deleteResult.deletedCount;
};


/**
 * Deletes all workout logs for a specific regimen ID.
 * @param {string} regimenId - The ID of the regimen.
 * @returns {Promise<number>} - The number of deleted logs.
 * @throws {AppError} If regimenId is not provided.
 */
exports.deleteLogsByRegimen = async (regimenId) => {
    if (!regimenId) {
        // Use AppError for consistency - though this might be better handled in controller/route validation
        throw new AppError('Regimen ID is required to delete logs.', 400);
    }
    console.log(`Service: Attempting to delete logs for regimen ID: ${regimenId}`);
    const result = await WorkoutLog.deleteMany({ regimenId: regimenId });
    console.log(`Service: Deleted ${result.deletedCount} logs for regimen ID: ${regimenId}`);
    return result.deletedCount;
};

/**
 * Fetches all workout logs for a specific athlete.
 * @param {string} athleteId - The ID of the athlete.
 * @returns {Promise<Array>} - Array of workout log documents, sorted by completion date.
 * @throws {AppError} If athleteId is invalid.
 */
exports.fetchMyWorkoutLogs = async (athleteId) => {
    if (!mongoose.Types.ObjectId.isValid(athleteId)) {
        throw new AppError('Invalid athlete ID provided.', 400);
    }

    const logs = await WorkoutLog.find({ athleteId: athleteId })
        .sort({ completedAt: -1 }) // Sort by most recent first
        .lean(); // Use lean for performance if modifications aren't needed

    return logs;
};

/**
 * Fetches a single workout log by its ID, performing authorization checks.
 * @param {string} logId - The ID of the workout log to fetch.
 * @param {string} requestingUserId - The ID of the user requesting the log.
 * @param {string} requestingUserRole - The role ('athlete' or 'coach') of the user requesting the log.
 * @returns {Promise<object>} - The workout log document if found and authorized.
 * @throws {AppError} If the log is not found, or the user is not authorized.
 */
exports.fetchWorkoutLogById = async (logId, requestingUserId, requestingUserRole) => {
    if (!mongoose.Types.ObjectId.isValid(logId)) {
        throw new AppError('Invalid workout log ID format.', 400);
    }

    const workoutLog = await WorkoutLog.findById(logId)
        .populate('athleteId', 'firstName lastName email coaches') // Populate needed athlete details
        .lean(); // Use lean if we don't need mongoose doc methods after this

    if (!workoutLog) {
        throw new AppError('Workout log not found', 404);
    }

    // Authorization Checks
    const athleteOwnerId = workoutLog.athleteId?._id.toString();

    // Case 1: Requesting user is the athlete who owns the log
    if (requestingUserRole === 'athlete' && athleteOwnerId === requestingUserId.toString()) {
        return workoutLog;
    }

    // Case 2: Requesting user is a coach
    if (requestingUserRole === 'coach') {
        // Check if the requesting coach is in the athlete's list of coaches
        const isCoachAssigned = workoutLog.athleteId?.coaches?.some(
            coachId => coachId.toString() === requestingUserId.toString()
        );
        if (isCoachAssigned) {
            return workoutLog;
        }
    }
    
    // If none of the above conditions are met, the user is not authorized
    throw new AppError('You do not have permission to view this workout log', 403);
}; 