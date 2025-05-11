const express = require('express');
const path = require('path');

const configureStaticServing = (app) => {
    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '..', 'public')));
    
    // Serve uploaded files from uploads directory with CORS headers
    app.use('/uploads', (req, res, next) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        express.static(path.join(__dirname, '..', 'uploads'))(req, res, next);
    });
};

module.exports = configureStaticServing; 