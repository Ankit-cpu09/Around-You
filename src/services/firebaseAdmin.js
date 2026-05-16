/**
 * Firebase Admin SDK initialization for backend token verification.
 * Uses Application Default Credentials (no service account file needed for basic auth).
 */
const admin = require('firebase-admin');

// Initialize with project ID only (works for Auth verification without service account)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'around-a0f2f'
  });
}

/**
 * Verify a Firebase ID token from the frontend
 * @param {string} idToken - The Firebase ID token to verify
 * @returns {object|null} - Decoded token with uid, phone_number, email, etc.
 */
async function verifyFirebaseToken(idToken) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    return null;
  }
}

/**
 * Get Firebase user by UID
 * @param {string} uid - Firebase user UID
 * @returns {object|null} - Firebase user record
 */
async function getFirebaseUser(uid) {
  try {
    return await admin.auth().getUser(uid);
  } catch (error) {
    console.error('Get Firebase user failed:', error.message);
    return null;
  }
}

module.exports = { admin, verifyFirebaseToken, getFirebaseUser };
