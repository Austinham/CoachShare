const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for exercises
const ExerciseSchema = new Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  name: {
    type: String,
    required: [true, 'Exercise name is required']
  },
  sets: {
    type: Number,
    default: 3
  },
  isReps: {
    type: Boolean,
    default: true
  },
  reps: {
    type: Number,
    default: 0
  },
  duration: {
    type: String,
    default: ''
  },
  distance: {
    type: String,
    default: ''
  },
  restInterval: {
    type: String,
    default: '01:00'
  },
  notes: {
    type: String
  },
  perSide: {
    type: Boolean,
    default: false
  },
  mediaLinks: [{
    url: String
  }]
});

// Schema for days
const DaySchema = new Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  name: {
    type: String,
    default: 'Workout Day',
    required: false
  },
  date: {
    type: String,
    required: [true, 'Day date is required']
  },
  intensity: {
    type: String,
    default: 'Medium'
  },
  exercises: [ExerciseSchema]
});

// Main Regimen schema
const RegimenSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  exercises: [{
    name: String,
    sets: Number,
    reps: Number,
    weight: Number,
    notes: String
  }],
  customIntensities: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    default: 'General'
  },
  sport: {
    type: String
  },
  level: {
    type: String,
    default: 'Intermediate'
  },
  days: [DaySchema]
});

// Add index for faster queries
RegimenSchema.index({ createdBy: 1 });
RegimenSchema.index({ assignedTo: 1 });

// Add method to check if a user has access to this regimen
RegimenSchema.methods.hasAccess = async function(userId, userRole) {
  if (userRole === 'coach') {
    return this.createdBy.equals(userId);
  } else if (userRole === 'athlete') {
    return this.assignedTo.includes(userId);
  }
  return false;
};

// Create model from schema
const Regimen = mongoose.model('Regimen', RegimenSchema);

module.exports = Regimen; 