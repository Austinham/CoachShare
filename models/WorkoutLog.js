const mongoose = require('mongoose');
const { Schema } = mongoose;

const exerciseLogSchema = new Schema({
  exerciseId: {
    type: String,
    required: [true, 'Exercise ID is required']
  },
  name: {
    type: String,
    required: [true, 'Exercise name is required']
  },
  sets: {
    type: Number,
    default: 0
  },
  reps: {
    type: Number,
    default: 0
  },
  weight: {
    type: String
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  notes: String
}, { _id: false });

const workoutLogSchema = new Schema({
  athleteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Athlete ID is required']
  },
  regimenId: {
    type: String,
    required: false
  },
  regimenName: String,
  dayId: {
    type: String,
    required: [true, 'Day ID is required']
  },
  dayName: String,
  rating: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'Very Hard'],
    default: 'Medium'
  },
  notes: String,
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  exercises: [exerciseLogSchema],
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
workoutLogSchema.index({ athleteId: 1, completedAt: -1 });
workoutLogSchema.index({ sharedWith: 1 });

// Virtual populate
// workoutLogSchema.virtual('regimen', {
//   ref: 'Regimen',
//   localField: 'regimenId',
//   foreignField: '_id',
//   justOne: true
// });

// Pre-save hook example (can be used for validation or defaults)
workoutLogSchema.pre('save', function(next) {
  if (this.sharedWith && this.athleteId) {
    this.sharedWith = this.sharedWith.filter(id => !id.equals(this.athleteId));
  }
  next();
});

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

module.exports = WorkoutLog; 