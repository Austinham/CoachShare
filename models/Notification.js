const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'A notification must have a title'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'A notification must have a message'],
    trim: true
  },
  type: {
    type: String,
    enum: ['program_assigned', 'workout_reminder', 'coach_message', 'progress_update', 'system'],
    default: 'system'
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A notification must belong to a user']
  },
  relatedId: {
    type: String,
    default: null
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 