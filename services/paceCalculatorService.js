const AppError = require('../utils/appError');

/**
 * Parses a time string (MM:SS.ms, SS.ms, or seconds) into total seconds.
 * @param {string|number} timeInput - The time string or number of seconds.
 * @returns {number} - Time in seconds.
 * @throws {AppError} If the format is invalid.
 */
const parseTimeToSeconds = (timeInput) => {
    if (typeof timeInput === 'number') {
        if (isNaN(timeInput) || timeInput < 0) {
           throw new AppError('Invalid time input (must be non-negative number).', 400);
        }
        return timeInput;
    }
    if (typeof timeInput !== 'string') {
        throw new AppError('Invalid time input type.', 400);
    }

    const timeString = timeInput.trim();
    if (!timeString) {
       throw new AppError('Time input cannot be empty.', 400);
    }
    
    // Check for MM:SS.ms format
    if (timeString.includes(':')) {
        const parts = timeString.split(':');
        if (parts.length !== 2) {
            throw new AppError('Invalid time format (use MM:SS.ms or SS.ms).', 400);
        }
        const minutes = parseFloat(parts[0]);
        const seconds = parseFloat(parts[1]);
        if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
            throw new AppError('Invalid minute or second values in time.', 400);
        }
        return minutes * 60 + seconds;
    } else {
        // Assume SS.ms format or just seconds
        const seconds = parseFloat(timeString);
        if (isNaN(seconds) || seconds < 0) {
            throw new AppError('Invalid time format (must be non-negative seconds).', 400);
        }
        return seconds;
    }
};

/**
 * Formats seconds into a readable time string (SS.ms).
 * @param {number} totalSeconds - Time in seconds.
 * @returns {string} - Formatted time string (e.g., "10.53").
 */
const formatSecondsToTime = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
        return "N/A"; // Or handle error appropriately
    }
    // Format to 2 decimal places for milliseconds
    return totalSeconds.toFixed(2);
};

/**
 * Generates standard segment distances based on the total distance.
 * @param {number} totalDistance - The total distance.
 * @returns {Array<number>} - Array of segment distances.
 */
const generateStandardSegments = (totalDistance) => {
    const segments = new Set();
    const interval = 50; // Generate splits every 50m

    // Add intervals up to the total distance
    for (let d = interval; d < totalDistance; d += interval) {
        segments.add(d);
    }
    // Always include the total distance
    segments.add(totalDistance);
    
    // Convert set to sorted array
    return Array.from(segments).sort((a, b) => a - b);
};

/**
 * Calculates training segment times based on target pace and effort.
 * Segments are generated automatically.
 * @param {number} totalDistance - The total distance of the PB/target race (e.g., 100).
 * @param {string|number} targetTimeString - The target time for the total distance (e.g., "10.10").
 * @param {number} effortPercentage - The desired effort level (e.g., 90).
 * @returns {Promise<Array<{distance: number, time: string}>>} - Array of segments with calculated times.
 * @throws {AppError} If inputs are invalid or calculation fails.
 */
exports.calculatePace = async (totalDistance, targetTimeString, effortPercentage) => {
    // 1. Validate Inputs (excluding segmentDistances)
    if (typeof totalDistance !== 'number' || totalDistance <= 0) {
        throw new AppError('Total distance must be a positive number.', 400);
    }
    if (typeof effortPercentage !== 'number' || effortPercentage <= 0 || effortPercentage > 100) {
        throw new AppError('Effort percentage must be between 1 and 100.', 400);
    }

    let targetTimeInSeconds;
    try {
        targetTimeInSeconds = parseTimeToSeconds(targetTimeString);
    } catch (error) {
        throw new AppError(`Invalid target time: ${error.message}`, 400);
    }

    if (targetTimeInSeconds <= 0) {
        throw new AppError('Target time must be greater than zero.', 400);
    }

    // 2. Calculate Target Pace (meters per second)
    const targetPaceMS = totalDistance / targetTimeInSeconds; // m/s

    // 3. Calculate Required Training Pace based on effort
    const trainingPaceMS = targetPaceMS * (effortPercentage / 100); // m/s

    if (trainingPaceMS <= 0 || !isFinite(trainingPaceMS)) {
         throw new AppError('Could not calculate a valid training pace. Check inputs.', 400);
    }

    // 4. Generate Standard Segments
    const generatedSegmentDistances = generateStandardSegments(totalDistance);
    console.log("Generated segments:", generatedSegmentDistances); // For debugging

    // 5. Calculate Time for each Generated Segment
    const results = generatedSegmentDistances.map(segmentDistance => {
        const segmentTimeSeconds = segmentDistance / trainingPaceMS;
        return {
            distance: segmentDistance,
            time: formatSecondsToTime(segmentTimeSeconds)
        };
    });

    return results;
}; 