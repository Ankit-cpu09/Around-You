const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const pool = require('../config/db');
const { generateOTP, sendSMS, sendEmail, verifyOTP } = require('../services/otpService');

/**
 * Normalize phone number — strip leading 0, +91, spaces, dashes
 * So "07895419194", "+917895419194", "7895419194" all become "7895419194"
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let p = phone.toString().trim().replace(/[\s\-\(\)]/g, '');
  // Remove +91 prefix
  if (p.startsWith('+91')) p = p.slice(3);
  // Remove leading 0
  if (p.startsWith('0') && p.length > 10) p = p.slice(1);
  return p;
}

/**
 * Find user by phone — tries exact match first, then normalized variants
 */
async function findUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  
  // Try exact match first
  let [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
  if (users.length > 0) return users[0];
  
  // Try normalized
  [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [normalized]);
  if (users.length > 0) return users[0];
  
  // Try with leading 0
  [users] = await pool.query('SELECT * FROM users WHERE phone = ?', ['0' + normalized]);
  if (users.length > 0) return users[0];
  
  // Try with +91
  [users] = await pool.query('SELECT * FROM users WHERE phone = ?', ['+91' + normalized]);
  if (users.length > 0) return users[0];
  
  return null;
}

const register = async (req, res) => {
  const { name, email, password, role, skills, latitude, longitude } = req.body;
  const phone = normalizePhone(req.body.phone);

  try {
    // Check if user exists (flexible lookup)
    const existingUser = await findUserByPhone(phone);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this phone number' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with normalized phone
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, password, role, skills, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, phone, email || null, hashedPassword, role, skills || null, latitude || null, longitude || null]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;

  try {
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    // Generate JWT
    const token = jsonwebtoken.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

const getProfile = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, phone, email, role, skills, latitude, longitude, avg_rating, total_jobs_completed FROM users WHERE id = ?', [req.user.id]);
    if(users.length === 0) return res.status(404).json({message: 'User not found'});
    res.json(users[0]);
  } catch(error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ========== OTP LOGIN ==========

/**
 * Send OTP for passwordless login
 * POST /api/auth/send-otp
 * Body: { phone }
 */
const sendLoginOTP = async (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    // Check if user exists (flexible lookup)
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number. Please register first.' });
    }

    // Use the DB phone for OTP storage consistency
    const dbPhone = user.phone;

    // Generate and send OTP
    const { code } = await generateOTP(dbPhone, 'login');
    const result = await sendSMS(dbPhone, code, 'login');

    res.json({ 
      message: 'OTP sent successfully',
      method: result.method,
      // Include code in response only for simulated mode (demo purposes)
      ...(result.method === 'simulated' ? { otp_code: code } : {})
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
};

/**
 * Verify OTP and login
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 */
const verifyLoginOTP = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ message: 'Phone and OTP code are required' });
  }

  try {
    // Find user first to get DB phone
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const dbPhone = user.phone;
    const isValid = await verifyOTP(dbPhone, code, 'login');
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const token = jsonwebtoken.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'OTP verified — login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
};

// ========== FORGOT / RESET PASSWORD ==========

/**
 * Send OTP for password reset (via SMS or Email)
 * POST /api/auth/forgot-password
 * Body: { phone, method: 'sms' | 'email' }
 */
const forgotPassword = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { method } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    // Check if user exists (flexible lookup)
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number.' });
    }

    const dbPhone = user.phone;

    // Generate OTP using DB phone for consistency
    const { code } = await generateOTP(dbPhone, 'reset_password');

    let result;
    if (method === 'email') {
      const email = user.email;
      if (!email) {
        return res.status(400).json({ message: 'No email address linked to this account. Please use SMS.' });
      }
      result = await sendEmail(email, code);
    } else {
      result = await sendSMS(dbPhone, code, 'reset_password');
    }

    res.json({ 
      message: `Password reset OTP sent via ${result.method}`,
      method: result.method,
      ...(result.method === 'simulated' ? { otp_code: code } : {})
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset OTP. Please try again.' });
  }
};

/**
 * Verify OTP and reset password
 * POST /api/auth/reset-password
 * Body: { phone, code, newPassword }
 */
const resetPassword = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { code, newPassword } = req.body;

  if (!phone || !code || !newPassword) {
    return res.status(400).json({ message: 'Phone, OTP code, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Find user to get DB phone
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const dbPhone = user.phone;
    const isValid = await verifyOTP(dbPhone, code, 'reset_password');
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    res.json({ message: 'Password reset successful! You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Password reset failed. Please try again.' });
  }
};

// ========== FIREBASE AUTH ==========

/**
 * Login/Register via Firebase Authentication
 * Frontend does Firebase phone auth, then sends the ID token here.
 * Backend verifies the token and issues our own JWT.
 * POST /api/auth/firebase-login
 * Body: { idToken, name?, role?, skills? }
 */
const firebaseLogin = async (req, res) => {
  const { idToken, name, role, skills } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required' });
  }

  try {
    // Verify Firebase token
    const { verifyFirebaseToken } = require('../services/firebaseAdmin');
    const decoded = await verifyFirebaseToken(idToken);

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired Firebase token' });
    }

    // Extract phone or email from Firebase token
    const firebasePhone = decoded.phone_number || '';
    const firebaseEmail = decoded.email || '';
    const firebaseUid = decoded.uid;

    // Normalize phone (Firebase returns +91XXXXXXXXXX format)
    const phone = normalizePhone(firebasePhone);

    if (!phone && !firebaseEmail) {
      return res.status(400).json({ message: 'No phone number or email found in Firebase token' });
    }

    // Check if user already exists in our DB
    let user = null;
    if (phone) {
      user = await findUserByPhone(phone);
    }
    if (!user && firebaseEmail) {
      const [emailUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [firebaseEmail]);
      if (emailUsers.length > 0) user = emailUsers[0];
    }

    if (user) {
      // Existing user — login
      const token = jsonwebtoken.sign(
        { id: user.id, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Login successful!',
        token,
        isNewUser: false,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          phone: user.phone
        }
      });
    }

    // New user — auto-register
    if (!name || !role) {
      // Need more info to create account
      return res.json({
        message: 'Phone verified! Please complete your profile.',
        needsRegistration: true,
        verifiedPhone: phone || firebasePhone,
        verifiedEmail: firebaseEmail,
        firebaseUid
      });
    }

    // Create user with a random password (they'll use Firebase auth going forward)
    const randomPassword = require('crypto').randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, password, role, skills) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone || firebasePhone, firebaseEmail || null, hashedPassword, role, skills || null]
    );

    const token = jsonwebtoken.sign(
      { id: result.insertId, role, name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      isNewUser: true,
      user: {
        id: result.insertId,
        name,
        role,
        phone: phone || firebasePhone
      }
    });
  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ message: 'Authentication failed. Please try again.' });
  }
};

module.exports = { register, login, getProfile, sendLoginOTP, verifyLoginOTP, forgotPassword, resetPassword, firebaseLogin };
