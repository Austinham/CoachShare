# CoachShare Server

Backend API for the CoachShare application.

## Multiple Coaches Feature

### Overview

The application now supports multiple coaches per athlete, allowing different coaches to assign regimens to the same athlete. This enhances collaboration and flexibility in training programs.

### Model Changes

- Added `coaches` array to the User model to store multiple coach references
- Added `primaryCoachId` to maintain backward compatibility and identify the main coach
- Maintained legacy `coachId` for backward compatibility

### Key Functions Updated

1. **requestCoach** - Athletes can now connect with multiple coaches without losing existing connections
2. **assignRegimen** - Coaches can assign regimens to athletes connected to them (primary or secondary)
3. **getAthleteRegimens** - Athletes can see regimens from all connected coaches
4. **removeAthlete** - Enhanced security checks to verify coach-athlete relationship

### Migration

A migration script has been provided to update existing athletes to the new model:

```bash
# Run migration script
npm run migrate-coaches
```

The migration script:
- Identifies athletes with a coach but without populated coaches array
- Sets their existing coach as the primary coach
- Adds the coach to the coaches array
- Preserves all existing relationships

### Security Considerations

- Access control checks have been updated to validate relationships through the new model
- Backward compatibility is maintained for existing features
- All API endpoints validate proper coach-athlete relationships before allowing regimen assignments

### Testing

After migration, verify that:
1. Existing athlete-coach relationships are preserved
2. Athletes can connect with multiple coaches
3. Each coach can assign regimens to their athletes
4. Athletes can view regimens from all connected coaches 