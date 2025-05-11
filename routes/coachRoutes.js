const express = require('express');
const router = express.Router();

// Basic coach routes
router.get('/', (req, res) => {
  res.json({ message: 'Coach routes working' });
});

module.exports = router; 