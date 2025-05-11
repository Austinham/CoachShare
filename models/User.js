const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please provide your first name'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Please provide your last name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false, // Don't return password in queries by default
  },
  role: {
    type: String,
    enum: ['admin', 'coach', 'client'],
    default: 'client'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Fields for athletes
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  coaches: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  primaryCoachId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  height: Number,
  weight: Number,
  birthdate: Date,
  sport: {
    type: String,
    trim: true
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'],
    trim: true
  },
  regimens: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Regimen'
  }],
  // Fields for coaches
  athletes: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  specialties: [String],
  // New fields for coach profile
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  experience: String,
  qualifications: [{
    title: {
      type: String,
      required: true
    },
    institution: String,
    year: String
  }],
  avatarUrl: String,
  socialLinks: {
    website: String,
    linkedin: String,
    instagram: String,
    twitter: String,
    facebook: String,
    youtube: String
  },
  notificationPreferences: {
    programAssigned: {
      type: Boolean,
      default: true
    },
    workoutReminder: {
      type: Boolean,
      default: true
    },
    coachMessage: {
      type: Boolean,
      default: true
    },
    progressUpdate: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password with salt
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if password is correct
UserSchema.methods.isPasswordCorrect = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
UserSchema.methods.generateVerificationToken = function() {
  // Create random token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Hash token and set to verificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set token expiry (24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

// Generate password reset token
UserSchema.methods.generateResetToken = function() {
  // Create random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiry (10 minutes)
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', UserSchema);

module.exports = User; 