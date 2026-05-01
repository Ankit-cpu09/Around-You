const pool = require('../config/db');
let getIo;
try {
  getIo = require('../sockets/jobSockets').getIo;
} catch (e) {
  getIo = () => null;
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createJob = async (req, res) => {
  const { title, description, price, latitude, longitude } = req.body;
  const employer_id = req.user.id;

  try {
    const [result] = await pool.query(
      'INSERT INTO jobs (employer_id, title, description, price, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employer_id, title, description, price, latitude, longitude, 'pending']
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
      'SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC',
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
      SELECT j.*, u.name as employer_name 
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
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
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

module.exports = { createJob, getJobsForEmployer, getAvailableJobsForWorker, acceptJob, completeJob, getJobById, getMapKey, getJobsForWorker, createCheckoutSession, confirmPayment, verifyPayment };

