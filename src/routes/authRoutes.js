const express = require('express');
const router = express.Router();
const { register, login, getProfile, sendLoginOTP, verifyLoginOTP, forgotPassword, resetPassword, firebaseLogin } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Standard auth
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);

// Firebase auth (phone OTP via Firebase)
router.post('/firebase-login', firebaseLogin);

// OTP login
router.post('/send-otp', sendLoginOTP);
router.post('/verify-otp', verifyLoginOTP);

// Forgot / Reset password
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
