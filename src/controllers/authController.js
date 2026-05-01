const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const pool = require('../config/db');

const register = async (req, res) => {
  const { name, phone, password, role, skills, latitude, longitude } = req.body;

  try {
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'User already exists with this phone number' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, password, role, skills, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, hashedPassword, role, skills || null, latitude || null, longitude || null]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  const { phone, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const user = users[0];
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
    const [users] = await pool.query('SELECT id, name, phone, role, skills, latitude, longitude FROM users WHERE id = ?', [req.user.id]);
    if(users.length === 0) return res.status(404).json({message: 'User not found'});
    res.json(users[0]);
  } catch(error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, getProfile };
