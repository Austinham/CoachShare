const Regimen = require('../models/Regimen');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const regimenService = require('../services/regimenService');

// Get all regimens for the logged-in coach
exports.getCoachRegimens = catchAsync(async (req, res, next) => {
    const coachId = req.user._id; // From protect middleware
    console.log(`Controller: Fetching regimens for coach ${req.user.email}`);
    const regimens = await regimenService.fetchRegimensByCoach(coachId);
    res.status(200).json({
        status: 'success',
        results: regimens.length,
        data: { regimens } // Keep consistent nesting
    });
});

// Get all regimens assigned to the logged-in athlete
exports.getAthleteRegimens = catchAsync(async (req, res, next) => {
    const athleteId = req.user._id; // From protect middleware
    console.log(`Controller: Fetching regimens for athlete ${req.user.email}`);
    const regimens = await regimenService.fetchRegimensForAthlete(athleteId);
     res.status(200).json({
        status: 'success',
        results: regimens.length,
        data: { regimens } // Keep consistent nesting
    });
});

// Get a single regimen (access control handled by service)
exports.getRegimenById = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id;
    const requestingUser = req.user; // From protect middleware
    console.log(`Controller: Fetching regimen ${regimenId} for user ${requestingUser.email}`);
    const regimen = await regimenService.fetchRegimenByIdWithAccessCheck(regimenId, requestingUser);
    res.status(200).json({
        status: 'success',
        data: { regimen } // Keep consistent nesting
    });
});

// Create a new regimen (coach only - checked by route middleware)
exports.createRegimen = catchAsync(async (req, res, next) => {
    const coachId = req.user._id;
    console.log(`Controller: Creating regimen for coach ${req.user.email}`);
    const newRegimen = await regimenService.createRegimen(req.body, coachId);
    res.status(201).json({
        status: 'success',
        data: { regimen: newRegimen } // Keep consistent nesting
    });
});

// Update a regimen (coach only, owner check in service)
exports.updateRegimen = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id;
    const requestingCoachId = req.user._id;
    console.log(`Controller: Updating regimen ${regimenId} by coach ${req.user.email}`);
    const updatedRegimen = await regimenService.updateRegimen(regimenId, req.body, requestingCoachId);
    res.status(200).json({
        status: 'success',
        data: { regimen: updatedRegimen }
    });
});

// Delete a regimen (coach/admin - permission check in service)
exports.deleteRegimen = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id;
    const requestingUser = req.user;
    console.log(`Controller: Deleting regimen ${regimenId} by user ${requestingUser.email}`);
    await regimenService.deleteRegimen(regimenId, requestingUser._id, requestingUser.role);
    res.status(204).json({ // 204 No Content
        status: 'success',
        data: null
    });
});

// Assign regimen to athlete (coach only, ownership/connection check in service)
exports.assignRegimen = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id; // Get regimen from URL param
    const { athleteId } = req.body;
    const requestingCoachId = req.user._id;

     if (!athleteId) {
        return next(new AppError('Please provide the athleteId in the request body', 400));
    }
    console.log(`Controller: Assigning regimen ${regimenId} to athlete ${athleteId} by coach ${req.user.email}`);

    const { regimen, athlete } = await regimenService.assignRegimenToAthlete(regimenId, athleteId, requestingCoachId);

    res.status(200).json({
        status: 'success',
        message: `Regimen "${regimen.name}" assigned to ${athlete.firstName} ${athlete.lastName}.`,
        // Optionally return data
        // data: { regimen, athlete }
    });
});

// Remove athlete from regimen (coach only, ownership check in service)
exports.removeAthlete = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id; // Get regimen from URL param
    const { athleteId } = req.body; // Get athlete from body
    const requestingCoachId = req.user._id;

     if (!athleteId) {
        return next(new AppError('Please provide the athleteId in the request body', 400));
    }
    console.log(`Controller: Removing athlete ${athleteId} from regimen ${regimenId} by coach ${req.user.email}`);

    const modified = await regimenService.removeAthleteFromRegimen(regimenId, athleteId, requestingCoachId);

    res.status(200).json({
        status: 'success',
        message: modified ? `Athlete removed from regimen.` : `Athlete was not assigned to this regimen.`
    });
});

// Admin delete regimen (Admin only - route check, service handles deletion)
// Note: The service deleteRegimen handles admin permission via role check
exports.adminDeleteRegimen = catchAsync(async (req, res, next) => {
    const regimenId = req.params.id;
    const requestingUser = req.user; // Must be admin (checked by route)
    console.log(`Controller: ADMIN Deleting regimen ${regimenId} by user ${requestingUser.email}`);
    await regimenService.deleteRegimen(regimenId, requestingUser._id, requestingUser.role);
     res.status(204).json({ // 204 No Content
        status: 'success',
        data: null
    });
});