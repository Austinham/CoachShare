// server/services/regimenService.js
const Regimen = require('../models/Regimen');
const User = require('../models/User');
const workoutLogService = require('../services/workoutLogService'); // For deleting logs
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // For creating string IDs

/**
 * Fetches all regimens created by a specific coach.
 * @param {string} coachId - The ID of the coach.
 * @returns {Promise<Array>} - Array of regimen documents.
 */
exports.fetchRegimensByCoach = async (coachId) => {
    if (!mongoose.Types.ObjectId.isValid(coachId)) {
        // Or handle appropriately if coachId might not be ObjectId
        return [];
    }
    const coachObjectId = new mongoose.Types.ObjectId(coachId.toString());

    return await Regimen.find({ createdBy: coachObjectId })
        .populate('createdBy', 'firstName lastName email _id') // Select needed fields
        .populate('assignedTo', 'firstName lastName email _id')
        .sort('-createdAt')
        .lean(); // Use lean for performance
};

/**
 * Fetches all regimens assigned to a specific athlete.
 * @param {string} athleteId - The ID of the athlete.
 * @returns {Promise<Array>} - Array of regimen documents.
 */
exports.fetchRegimensForAthlete = async (athleteId) => {
     if (!mongoose.Types.ObjectId.isValid(athleteId)) {
        return [];
    }
    const athleteObjectId = new mongoose.Types.ObjectId(athleteId.toString());
    // Fetch regimens where athleteId is in the assignedTo array
    // Alternatively, could fetch from athlete.regimens array if that's reliably maintained
    return await Regimen.find({ assignedTo: athleteObjectId })
        .populate('createdBy', 'firstName lastName email _id')
        .sort('-createdAt')
        .lean();
};

/**
 * Fetches a single regimen by ID (string UUID or ObjectId) and performs access control.
 * @param {string} regimenId - The ID (UUID or ObjectId) of the regimen.
 * @param {object} requestingUser - The user object making the request (from protect middleware).
 * @returns {Promise<object>} - The regimen document.
 * @throws {AppError} If regimen not found or user lacks access.
 */
exports.fetchRegimenByIdWithAccessCheck = async (regimenId, requestingUser) => {
    let regimen;
    // Try finding by string ID first
    if (typeof regimenId === 'string' && regimenId.length > 24) { // Basic check for UUID format
         regimen = await Regimen.findOne({ id: regimenId })
            .populate('createdBy', 'firstName lastName email _id')
            .populate('assignedTo', 'firstName lastName email _id');
    }

    // If not found or ID is likely an ObjectId, try finding by _id
    if (!regimen && mongoose.Types.ObjectId.isValid(regimenId)) {
        regimen = await Regimen.findById(regimenId)
            .populate('createdBy', 'firstName lastName email _id')
            .populate('assignedTo', 'firstName lastName email _id');
    }

    if (!regimen) {
        throw new AppError('Regimen not found', 404);
    }

    // --- Access Control ---
    const requestingUserId = requestingUser._id.toString();

    if (requestingUser.role === 'coach') {
        const isCreator = regimen.createdBy?._id?.toString() === requestingUserId;
        if (!isCreator) {
            throw new AppError('You do not have permission to access this regimen (not creator)', 403);
        }
    } else if (requestingUser.role === 'athlete') {
         const isAssigned = regimen.assignedTo?.some(athlete =>
            athlete._id?.toString() === requestingUserId
        );
        if (!isAssigned) {
             throw new AppError('You do not have permission to access this regimen (not assigned)', 403);
        }
    } else if (requestingUser.role !== 'admin') {
        // Fallback for unexpected roles
        throw new AppError('You do not have permission to access this resource', 403);
    }

    // If access checks pass, return the regimen (consider using .lean() if modifications aren't needed)
    return regimen;
};


/**
 * Creates a new regimen.
 * @param {object} regimenData - Data for the new regimen (from req.body).
 * @param {string} coachId - The ID of the coach creating the regimen.
 * @returns {Promise<object>} - The created regimen document.
 */
exports.createRegimen = async (regimenData, coachId) => {
    const dataToCreate = {
        id: uuidv4(), // Generate string ID
        ...regimenData,
        createdBy: coachId,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedTo: [] // Ensure assignedTo is initialized
    };
    // Consider adding validation logic here or using Mongoose validation
    const newRegimen = await Regimen.create(dataToCreate);
    return newRegimen; // Return Mongoose document
};

/**
 * Updates an existing regimen.
 * @param {string} regimenId - The ID (UUID or ObjectId) of the regimen to update.
 * @param {object} updateData - Data to update (from req.body).
 * @param {string} requestingCoachId - The ID of the coach making the request.
 * @returns {Promise<object>} - The updated regimen document.
 * @throws {AppError} If regimen not found, user not creator, or validation fails.
 */
exports.updateRegimen = async (regimenId, updateData, requestingCoachId) => {
     let query;
     // Determine if searching by UUID or ObjectId
     if (typeof regimenId === 'string' && regimenId.length > 24) {
         query = { id: regimenId };
     } else if (mongoose.Types.ObjectId.isValid(regimenId)) {
         query = { _id: regimenId };
     } else {
          throw new AppError('Invalid regimen ID format provided.', 400);
     }

    // Find the regimen first to check ownership
    const regimen = await Regimen.findOne(query).select('+createdBy'); // Ensure createdBy is selected
    if (!regimen) {
        throw new AppError('Regimen not found', 404);
    }

    // Verify ownership
    if (regimen.createdBy?.toString() !== requestingCoachId.toString()) {
        throw new AppError('You can only update regimens you created', 403);
    }

    // Update the regimen
    const dataToUpdate = { ...updateData, updatedAt: Date.now() };
    // Prevent updating certain fields like 'id' or 'createdBy'
    delete dataToUpdate.id;
    delete dataToUpdate.createdBy;
    delete dataToUpdate.createdAt;

    const updatedRegimen = await Regimen.findByIdAndUpdate(regimen._id, dataToUpdate, {
        new: true, // Return the modified document
        runValidators: true // Run schema validators
    });

     if (!updatedRegimen) {
        // This might happen in a race condition, unlikely but possible
        throw new AppError('Regimen update failed unexpectedly.', 500);
    }

    return updatedRegimen;
};

/**
 * Deletes a regimen and associated data (athlete references, workout logs).
 * @param {string} regimenId - The ID (UUID or ObjectId) of the regimen.
 * @param {string} requestingUserId - ID of the user requesting deletion.
 * @param {string} requestingUserRole - Role of the user requesting deletion.
 * @returns {Promise<boolean>} - True if deletion was successful.
 * @throws {AppError} If regimen not found or user lacks permission.
 */
exports.deleteRegimen = async (regimenId, requestingUserId, requestingUserRole) => {
    let query;
    if (typeof regimenId === 'string' && regimenId.length > 24) {
        query = { id: regimenId };
    } else if (mongoose.Types.ObjectId.isValid(regimenId)) {
        query = { _id: regimenId };
    } else {
         throw new AppError('Invalid regimen ID format provided.', 400);
    }

    const regimen = await Regimen.findOne(query).select('+createdBy +assignedTo');
     if (!regimen) {
        throw new AppError('Regimen not found', 404);
    }

    // Authorization Check
    const isCreator = regimen.createdBy?.toString() === requestingUserId.toString();
    const isAdmin = requestingUserRole === 'admin';

    if (!isAdmin && !isCreator) {
        throw new AppError('You do not have permission to delete this regimen', 403);
    }

    const regimenMongoId = regimen._id; // Store ObjectId before deleting
    const assignedAthleteIds = regimen.assignedTo || [];

    // 1. Delete the regimen itself
    await Regimen.deleteOne({ _id: regimenMongoId });
    console.log(`Service: Deleted regimen ${regimen.name} (${regimenMongoId})`);

    // 2. Clean up references in User documents (run concurrently)
    const updateUserPromise = User.updateMany(
        { _id: { $in: assignedAthleteIds } },
        { $pull: { regimens: regimenMongoId } }
    );

    // 3. Clean up associated WorkoutLogs (run concurrently)
    const deleteLogsPromise = workoutLogService.deleteLogsByRegimen(regimenMongoId.toString());

    // Wait for cleanup operations
    try {
        const [userUpdateResult, logDeleteResult] = await Promise.all([updateUserPromise, deleteLogsPromise]);
        console.log(`Service: Removed regimen ${regimenMongoId} reference from ${userUpdateResult.modifiedCount} athletes.`);
        console.log(`Service: Deleted ${logDeleteResult} workout logs for regimen ${regimenMongoId}.`);
    } catch (cleanupError) {
        console.error(`Service: Error during cleanup for regimen ${regimenMongoId}:`, cleanupError);
        // Log error but don't throw, as regimen is already deleted
    }

    return true;
};


/**
 * Assigns a regimen to an athlete, ensuring coach owns regimen and athlete.
 * @param {string} regimenId - The ID (UUID or ObjectId) of the regimen.
 * @param {string} athleteId - The ID of the athlete.
 * @param {string} requestingCoachId - The ID of the coach making the assignment.
 * @returns {Promise<{regimen: object, athlete: object}>} - Updated regimen and athlete docs.
 * @throws {AppError} If entities not found, coach lacks ownership/connection, or update fails.
 */
exports.assignRegimenToAthlete = async (regimenId, athleteId, requestingCoachId) => {
     if (!mongoose.Types.ObjectId.isValid(athleteId) || !mongoose.Types.ObjectId.isValid(requestingCoachId)) {
         throw new AppError('Invalid athlete or coach ID format.', 400);
    }

     // 1. Fetch Regimen and check ownership
     let regimenQuery;
     if (typeof regimenId === 'string' && regimenId.length > 24) {
         regimenQuery = { id: regimenId };
     } else if (mongoose.Types.ObjectId.isValid(regimenId)) {
         regimenQuery = { _id: regimenId };
     } else {
          throw new AppError('Invalid regimen ID format provided.', 400);
     }
     const regimen = await Regimen.findOne(regimenQuery).select('+createdBy +assignedTo');
     if (!regimen) throw new AppError('Regimen not found.', 404);
     if (regimen.createdBy?.toString() !== requestingCoachId.toString()) {
         throw new AppError('You can only assign regimens you created.', 403);
     }

     // 2. Fetch Athlete and check connection to coach
     const athlete = await User.findOne({
         _id: athleteId,
         role: 'athlete',
         coaches: requestingCoachId // Ensure coach is in athlete's coaches list
     }).select('+regimens'); // Select regimens to check if already assigned
     if (!athlete) throw new AppError('Athlete not found or not assigned to you.', 404);


     // 3. Update Regimen (add athlete to assignedTo)
     let regimenNeedsSave = false;
     if (!regimen.assignedTo) regimen.assignedTo = [];
     if (!regimen.assignedTo.some(id => id.equals(athlete._id))) {
         regimen.assignedTo.push(athlete._id);
         regimenNeedsSave = true;
     }

     // 4. Update Athlete (add regimen to regimens)
     let athleteNeedsSave = false;
     if (!athlete.regimens) athlete.regimens = [];
     if (!athlete.regimens.some(id => id.equals(regimen._id))) {
         athlete.regimens.push(regimen._id);
         athleteNeedsSave = true;
     }

     // 5. Save if changes occurred
     const savePromises = [];
     if (regimenNeedsSave) savePromises.push(regimen.save());
     if (athleteNeedsSave) savePromises.push(athlete.save({ validateBeforeSave: false })); // Athlete updates might not need full validation here

     if (savePromises.length > 0) {
         await Promise.all(savePromises);
     } else {
         console.log(`Regimen ${regimen.name} already assigned to athlete ${athlete.email}`);
     }

     return { regimen, athlete };
};

/**
 * Removes an athlete from a regimen's assignment list.
 * @param {string} regimenId - The ID (UUID or ObjectId) of the regimen.
 * @param {string} athleteId - The ID of the athlete to remove.
 * @param {string} requestingCoachId - The ID of the coach requesting removal.
 * @returns {Promise<boolean>} - True if the relationship was modified.
 * @throws {AppError} If entities not found or coach lacks ownership.
 */
exports.removeAthleteFromRegimen = async (regimenId, athleteId, requestingCoachId) => {
      if (!mongoose.Types.ObjectId.isValid(athleteId) || !mongoose.Types.ObjectId.isValid(requestingCoachId)) {
         throw new AppError('Invalid athlete or coach ID format.', 400);
    }

     // 1. Fetch Regimen and check ownership
     let regimenQuery;
     if (typeof regimenId === 'string' && regimenId.length > 24) {
         regimenQuery = { id: regimenId };
     } else if (mongoose.Types.ObjectId.isValid(regimenId)) {
         regimenQuery = { _id: regimenId };
     } else {
          throw new AppError('Invalid regimen ID format provided.', 400);
     }
     const regimen = await Regimen.findOne(regimenQuery).select('+createdBy +assignedTo');
     if (!regimen) throw new AppError('Regimen not found.', 404);
     if (regimen.createdBy?.toString() !== requestingCoachId.toString()) {
         throw new AppError('You can only modify regimens you created.', 403);
     }

      // 2. Fetch Athlete (optional, but good for logging/confirmation)
     // const athlete = await User.findById(athleteId).select('email');
     // if (!athlete) throw new AppError('Athlete not found.', 404);

     // 3. Update Regimen (remove athlete from assignedTo)
     let regimenModified = false;
     if (regimen.assignedTo && regimen.assignedTo.length > 0) {
         const initialLength = regimen.assignedTo.length;
         regimen.assignedTo = regimen.assignedTo.filter(id => !id.equals(athleteId));
         if (regimen.assignedTo.length < initialLength) {
             regimenModified = true;
         }
     }

     // 4. Update Athlete (remove regimen from regimens)
     // Use update directly on User model for efficiency
     const athleteUpdateResult = await User.updateOne(
        { _id: athleteId },
        { $pull: { regimens: regimen._id } }
     );
     const athleteModified = athleteUpdateResult.modifiedCount > 0;

     // 5. Save Regimen if modified
     if (regimenModified) {
         await regimen.save();
     }

     return regimenModified || athleteModified; // Return true if anything changed
}; 