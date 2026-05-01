const express = require('express');
const router = express.Router();
const { createJob, getJobsForEmployer, getAvailableJobsForWorker, acceptJob, completeJob, getJobById, getMapKey, getJobsForWorker, createCheckoutSession, confirmPayment, verifyPayment } = require('../controllers/jobController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes
router.get('/mapkey', getMapKey);

// Employer routes (static paths BEFORE wildcard /:id)
router.post('/', authorize('employer'), createJob);
router.get('/employer', authorize('employer'), getJobsForEmployer);
router.post('/verify-payment', authorize('employer'), verifyPayment);
router.post('/confirm-payment', authorize('employer'), confirmPayment);

// Worker routes (static paths BEFORE wildcard /:id)
router.get('/available', authorize('worker'), getAvailableJobsForWorker);
router.get('/worker-jobs', authorize('worker'), getJobsForWorker);

// Wildcard /:id routes MUST come LAST
router.get('/:id', authenticate, getJobById);
router.put('/:id/complete', authorize('employer'), completeJob);
router.post('/:id/create-checkout-session', authorize('employer'), createCheckoutSession);
router.post('/:id/accept', authorize('worker'), acceptJob);

module.exports = router;
