const pool = require('../config/db');
let getIo;
try {
  getIo = require('../sockets/jobSockets').getIo;
} catch (e) {
  getIo = () => null;
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createJob = async (req, res) => {
  const { title, description, category, price, latitude, longitude } = req.body;
  const employer_id = req.user.id;

  try {
    const [result] = await pool.query(
      'INSERT INTO jobs (employer_id, title, description, category, price, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employer_id, title, description, category || 'General', price, latitude, longitude, 'pending']
    );

    const jobId = result.insertId;
    const [newJobArr] = await pool.query(`
      SELECT j.*, u.name as employer_name, u.phone as employer_phone 
      FROM jobs j
      JOIN users u ON j.employer_id = u.id
      WHERE j.id = ?
    `, [jobId]);

    const newJob = newJobArr[0];

    // Emit event to workers
    const io = getIo();
    if(io) {
      io.emit('new_job_posted', newJob);
    }

    res.status(201).json({ message: 'Job posted successfully', job: newJob });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error creating job' });
  }
};

const getJobsForEmployer = async (req, res) => {
  const employer_id = req.user.id;
  try {
    const [jobs] = await pool.query(
      `SELECT j.*, w.name as worker_name, w.phone as worker_phone, w.skills as worker_skills, w.avg_rating as worker_rating
       FROM jobs j
       LEFT JOIN users w ON j.assigned_worker_id = w.id
       WHERE j.employer_id = ? 
       ORDER BY j.created_at DESC`,
      [employer_id]
    );
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching employer jobs' });
  }
};

const getAvailableJobsForWorker = async (req, res) => {
  try {
    const [jobs] = await pool.query(`
      SELECT j.*, u.name as employer_name, u.phone as employer_phone
      FROM jobs j
      JOIN users u ON j.employer_id = u.id
      WHERE j.status = 'pending'
      ORDER BY j.created_at DESC
    `);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching jobs' });
  }
};

const acceptJob = async (req, res) => {
  const { id } = req.params; // job id
  const worker_id = req.user.id;

  try {
    // Transaction to ensure atomicity
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check job status with FOR UPDATE
    const [jobs] = await connection.query('SELECT status FROM jobs WHERE id = ? FOR UPDATE', [id]);
    
    if (jobs.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Job not found' });
    }

    if (jobs[0].status !== 'pending') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Job already accepted or completed' });
    }

    // Update job
    await connection.query(
      'UPDATE jobs SET status = ?, assigned_worker_id = ? WHERE id = ?',
      ['accepted', worker_id, id]
    );

    // Record application history
    await connection.query(
      'INSERT INTO applications (job_id, worker_id, status) VALUES (?, ?, ?)',
      [id, worker_id, 'accepted']
    );

    await connection.commit();
    connection.release();

    // Emit event that job is taken
    const io = getIo();
    if(io) {
      io.emit('job_accepted', { jobId: id, workerId: worker_id });
    }

    res.json({ message: 'Job accepted successfully', jobId: id });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ message: 'Server error accepting job' });
  }
};

const completeJob = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE jobs SET status = ? WHERE id = ?', ['completed', id]);
    res.json({ message: 'Job marked as completed' });
  } catch(error) {
    res.status(500).json({ message: 'Server error' });
  }
}

const getJobById = async (req, res) => {
  const { id } = req.params;
  try {
    const [jobs] = await pool.query(`
      SELECT j.*, u.name as employer_name, u.phone as employer_phone
      FROM jobs j
      JOIN users u ON j.employer_id = u.id
      WHERE j.id = ?
    `, [id]);
    if(jobs.length === 0) return res.status(404).json({ message: 'Job not found' });
    res.json(jobs[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getMapKey = (req, res) => {
  res.json({ key: process.env.GOOGLE_MAPS_API_KEY || '' });
};

const getJobsForWorker = async (req, res) => {
  const worker_id = req.user.id;
  try {
    const [jobs] = await pool.query(`
      SELECT j.*, u.name as employer_name, u.phone as employer_phone
      FROM jobs j
      JOIN users u ON j.employer_id = u.id
      WHERE j.assigned_worker_id = ?
      ORDER BY j.created_at DESC
    `, [worker_id]);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching worker jobs' });
  }
};

// ========== JOB Q&A SYSTEM ==========

/**
 * Worker asks a question about a job before accepting
 * POST /api/jobs/:id/ask
 */
const askQuestion = async (req, res) => {
  const { id } = req.params;
  const worker_id = req.user.id;
  const { question } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ message: 'Question cannot be empty' });
  }

  try {
    // Verify job exists and is pending
    const [jobs] = await pool.query('SELECT employer_id, status FROM jobs WHERE id = ?', [id]);
    if (jobs.length === 0) return res.status(404).json({ message: 'Job not found' });
    if (jobs[0].status !== 'pending') return res.status(400).json({ message: 'You can only ask questions about pending jobs' });

    const [result] = await pool.query(
      'INSERT INTO job_questions (job_id, worker_id, question) VALUES (?, ?, ?)',
      [id, worker_id, question.trim()]
    );

    // Notify employer via socket
    const io = getIo();
    if (io) {
      io.emit('new_question', { 
        jobId: id, 
        questionId: result.insertId,
        workerName: req.user.name,
        question: question.trim()
      });
    }

    res.status(201).json({ 
      message: 'Question sent to employer!',
      questionId: result.insertId
    });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Employer answers a question
 * POST /api/jobs/questions/:questionId/answer
 */
const answerQuestion = async (req, res) => {
  const { questionId } = req.params;
  const { answer } = req.body;
  const employer_id = req.user.id;

  if (!answer || answer.trim().length === 0) {
    return res.status(400).json({ message: 'Answer cannot be empty' });
  }

  try {
    // Verify employer owns the job this question is about
    const [questions] = await pool.query(`
      SELECT jq.*, j.employer_id 
      FROM job_questions jq 
      JOIN jobs j ON jq.job_id = j.id 
      WHERE jq.id = ?
    `, [questionId]);

    if (questions.length === 0) return res.status(404).json({ message: 'Question not found' });
    if (questions[0].employer_id !== employer_id) return res.status(403).json({ message: 'Not authorized' });

    await pool.query(
      'UPDATE job_questions SET answer = ?, answered_at = NOW() WHERE id = ?',
      [answer.trim(), questionId]
    );

    // Notify worker via socket
    const io = getIo();
    if (io) {
      io.emit('question_answered', { 
        questionId,
        jobId: questions[0].job_id,
        workerId: questions[0].worker_id,
        answer: answer.trim()
      });
    }

    res.json({ message: 'Answer posted!' });
  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get all questions for a job
 * GET /api/jobs/:id/questions
 */
const getJobQuestions = async (req, res) => {
  const { id } = req.params;
  try {
    const [questions] = await pool.query(`
      SELECT jq.*, u.name as worker_name
      FROM job_questions jq
      JOIN users u ON jq.worker_id = u.id
      WHERE jq.job_id = ?
      ORDER BY jq.created_at DESC
    `, [id]);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching questions' });
  }
};

/**
 * Get unanswered questions for an employer's jobs
 * GET /api/jobs/my-questions
 */
const getEmployerQuestions = async (req, res) => {
  const employer_id = req.user.id;
  try {
    const [questions] = await pool.query(`
      SELECT jq.*, j.title as job_title, u.name as worker_name
      FROM job_questions jq
      JOIN jobs j ON jq.job_id = j.id
      JOIN users u ON jq.worker_id = u.id
      WHERE j.employer_id = ?
      ORDER BY jq.created_at DESC
    `, [employer_id]);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ========== RATING SYSTEM ==========

/**
 * Submit a rating for a completed job
 * POST /api/jobs/:id/rate
 */
const rateUser = async (req, res) => {
  const { id } = req.params;
  const from_user_id = req.user.id;
  const { rating, review } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    // Get job details
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    if (jobs.length === 0) return res.status(404).json({ message: 'Job not found' });

    const job = jobs[0];
    if (job.status !== 'completed') return res.status(400).json({ message: 'Can only rate completed jobs' });

    // Determine who is being rated
    let to_user_id;
    if (from_user_id === job.employer_id) {
      to_user_id = job.assigned_worker_id; // Employer rates worker
    } else if (from_user_id === job.assigned_worker_id) {
      to_user_id = job.employer_id; // Worker rates employer
    } else {
      return res.status(403).json({ message: 'You are not part of this job' });
    }

    if (!to_user_id) return res.status(400).json({ message: 'Cannot rate — no assigned worker' });

    // Check if already rated
    const [existingRating] = await pool.query(
      'SELECT id FROM ratings WHERE from_user_id = ? AND job_id = ?',
      [from_user_id, id]
    );
    if (existingRating.length > 0) {
      return res.status(400).json({ message: 'You have already rated this job' });
    }

    // Insert rating
    await pool.query(
      'INSERT INTO ratings (from_user_id, to_user_id, job_id, rating, review) VALUES (?, ?, ?, ?, ?)',
      [from_user_id, to_user_id, id, rating, review || null]
    );

    // Update average rating for the rated user
    const [avgResult] = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM ratings WHERE to_user_id = ?',
      [to_user_id]
    );
    const newAvg = parseFloat(avgResult[0].avg_rating || 0).toFixed(1);
    await pool.query('UPDATE users SET avg_rating = ? WHERE id = ?', [newAvg, to_user_id]);

    res.json({ message: 'Rating submitted successfully!' });
  } catch (error) {
    console.error('Rate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ========== PAYMENT (EXISTING) ==========

const createCheckoutSession = async (req, res) => {
  const { id } = req.params;
  try {
    const [jobs] = await pool.query('SELECT title, status, assigned_worker_id, payment_status, price FROM jobs WHERE id = ?', [id]);
    
    if (jobs.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (jobs[0].payment_status === 'paid') {
      return res.status(400).json({ message: 'Job is already paid' });
    }

    // Generate a unique session token for this payment
    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(24).toString('hex');

    // Store session info temporarily (in-memory for demo)
    if (!global._paymentSessions) global._paymentSessions = {};
    global._paymentSessions[sessionToken] = {
      jobId: id,
      amount: jobs[0].price,
      title: jobs[0].title,
      createdAt: Date.now(),
      status: 'pending'
    };

    // Redirect to our own checkout page
    const checkoutUrl = `/checkout.html?session=${sessionToken}&job_id=${id}&amount=${jobs[0].price}&title=${encodeURIComponent(jobs[0].title)}`;
    res.json({ session_url: checkoutUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating payment session' });
  }
};

// API to confirm the simulated payment (called from checkout page)
const confirmPayment = async (req, res) => {
  const { session_token, card_last4 } = req.body;
  
  if (!global._paymentSessions || !global._paymentSessions[session_token]) {
    return res.status(400).json({ success: false, message: 'Invalid or expired session' });
  }

  const session = global._paymentSessions[session_token];
  
  if (session.status === 'paid') {
    return res.status(400).json({ success: false, message: 'Already paid' });
  }

  // Mark session as paid
  session.status = 'paid';
  session.paidAt = Date.now();
  session.cardLast4 = card_last4;

  try {
    // Update job in database
    await pool.query('UPDATE jobs SET status = ?, payment_status = ? WHERE id = ?', ['completed', 'paid', session.jobId]);
    
    const [jobs] = await pool.query('SELECT assigned_worker_id, price FROM jobs WHERE id = ?', [session.jobId]);

    // Update worker's total_jobs_completed
    if (jobs[0] && jobs[0].assigned_worker_id) {
      await pool.query('UPDATE users SET total_jobs_completed = total_jobs_completed + 1 WHERE id = ?', [jobs[0].assigned_worker_id]);
    }
    
    // Notify worker via socket
    const io = getIo();
    if (io && jobs[0] && jobs[0].assigned_worker_id) {
      io.emit('payment_received', { jobId: session.jobId, amount: jobs[0].price });
    }

    // Clean up session after 5 minutes
    setTimeout(() => {
      if (global._paymentSessions) delete global._paymentSessions[session_token];
    }, 300000);

    return res.json({ success: true, message: 'Payment successful!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
};

const verifyPayment = async (req, res) => {
  const { session_id, job_id } = req.body;
  
  try {
    // Check if this session exists and was paid
    if (global._paymentSessions && global._paymentSessions[session_id]) {
      const session = global._paymentSessions[session_id];
      if (session.status === 'paid') {
        return res.json({ success: true, message: 'Payment verified successfully.' });
      }
    }

    // Also check DB directly in case payment was already processed
    const [jobs] = await pool.query('SELECT payment_status FROM jobs WHERE id = ?', [job_id]);
    if (jobs.length > 0 && jobs[0].payment_status === 'paid') {
      return res.json({ success: true, message: 'Payment verified successfully.' });
    }

    return res.status(400).json({ success: false, message: 'Payment not completed.' });
  } catch(error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

module.exports = { 
  createJob, getJobsForEmployer, getAvailableJobsForWorker, acceptJob, completeJob, 
  getJobById, getMapKey, getJobsForWorker, createCheckoutSession, confirmPayment, verifyPayment,
  askQuestion, answerQuestion, getJobQuestions, getEmployerQuestions, rateUser
};
