const express = require('express');
const router = express.Router();

// Basic client routes
router.get('/', (req, res) => {
  res.json({ message: 'Client routes working' });
});

module.exports = router; 