const express = require('express');
const path = require('path');

const configureStaticFiles = (app) => {
    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '..', 'public')));
    
    // Serve uploaded files from uploads directory
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
};

module.exports = configureStaticFiles; 