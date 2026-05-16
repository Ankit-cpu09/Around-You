# Around You (KaamSetu) - Comprehensive Project Report

## 1. Executive Summary
"Around You" (formerly KaamSetu) is a premium, modern, real-time web platform engineered to bridge the gap between employers and daily wage workers. In an increasingly gig-economy-driven world, finding reliable local labor for short-term tasks remains a friction-filled process. "Around You" solves this by providing a highly responsive, location-aware platform where employers can post tasks, and nearby workers can instantly accept them. 

The platform distinguishes itself through a "cyber-minimalist" design aesthetic inspired by modern AI tools (like voxr.ai), ensuring that even utility-focused applications provide a high-fidelity user experience. Core functionalities include real-time job matching via WebSockets, robust Firebase Phone Authentication, integrated Google Maps routing, a comprehensive Q&A system, and a simulated secure payment gateway.

## 2. Introduction
### 2.1 Problem Statement
The unorganized sector, particularly daily wage labor, suffers from severe information asymmetry. Employers struggle to find immediate help for tasks (e.g., plumbing, cleaning, loading), while workers spend significant time waiting at physical labor "chowks" (squares) without a guarantee of work. Existing platforms are often tailored for long-term employment or high-skill freelancing, leaving a gap for hyper-local, immediate task execution.

### 2.2 Objective
To develop a scalable, secure, and user-friendly web application that digitizes the local labor market. The platform aims to reduce the time-to-hire from hours to minutes, provide transparent pricing, and ensure trust through a rating system.

### 2.3 Scope
The current iteration encompasses:
*   Role-based user accounts (Employer and Worker).
*   Phone number verification via Firebase Identity Platform.
*   Real-time job posting and broadcasting.
*   Instant job acceptance mechanism.
*   In-app communication (Q&A system).
*   Simulated payment processing.
*   Post-job rating and review system.

## 3. Technology Stack
The platform is built on a robust, modern JavaScript-centric stack (MERN-adjacent, utilizing MySQL instead of MongoDB).

### 3.1 Frontend
*   **HTML5/CSS3:** Semantic markup with a highly customized Vanilla CSS architecture.
*   **JavaScript (ES6+):** Vanilla JavaScript handles DOM manipulation, API interactions, and WebSocket events without the overhead of heavy frameworks, ensuring blazing-fast load times.
*   **Design System:** "Cyber-Minimalist" aesthetic featuring:
    *   Deep dark backgrounds (#0a0a0f).
    *   Electric purple accents (#8b5cf6, #a78bfa).
    *   Glassmorphism (translucent backgrounds with background-blur).
    *   Interactive particle canvas backgrounds (`particles.js`).

### 3.2 Backend
*   **Node.js:** The runtime environment, chosen for its non-blocking I/O, making it ideal for real-time applications.
*   **Express.js:** A minimal and flexible Node.js web application framework used to build the RESTful API.
*   **Socket.io:** Enables real-time, bidirectional, and event-based communication between the browser and the server. Used for instant job notifications and payment alerts.

### 3.3 Database
*   **MySQL:** A relational database management system, chosen for its ACID compliance and structured schema, which is vital for transactional data like jobs and payments.
*   **TiDB Cloud / PlanetScale:** The platform is designed to be fully compatible with modern serverless MySQL cloud providers, utilizing connection pooling (`mysql2/promise`) and SSL.

### 3.4 Third-Party Integrations
*   **Firebase Authentication (Identity Platform):** Handles secure phone number verification via SMS OTPs, bypassing the need for manual Twilio integration and providing built-in rate limiting and reCAPTCHA protection.
*   **Google Maps API:** Used for geospatial rendering, calculating distances, and providing turn-by-turn navigation from the worker's location to the job site.
*   **JSON Web Tokens (JWT):** Secures API endpoints and manages user sessions statelessly.
*   **Bcrypt:** Hashes user passwords before storing them in the database.

## 4. System Architecture
The application follows a Client-Server architecture with a RESTful API and WebSocket channels.

### 4.1 Request Lifecycle
1.  **Client Request:** The user interacts with the UI (e.g., clicks "Post Job"). The frontend JS captures the event, packages the data into a JSON payload, and attaches the JWT to the `Authorization` header.
2.  **API Gateway / Express Server:** The request hits the Node.js server.
3.  **Middleware:** 
    *   `cors()`: Ensures cross-origin resource sharing is permitted.
    *   `express.json()`: Parses the incoming JSON payload.
    *   `authenticate`: Verifies the JWT signature.
    *   `authorize('employer')`: Ensures the user role has permission to access the endpoint.
4.  **Controller:** The route forwards the request to `jobController.js`, which executes the business logic.
5.  **Database Query:** The controller interacts with the MySQL database via the `mysql2` connection pool using parameterized SQL queries to prevent SQL injection.
6.  **Real-time Event:** If successful, the controller instructs the `jobSockets.js` module to emit a `new_job_posted` event to all connected clients in the "worker" room.
7.  **Response:** The server sends an HTTP 201 Created response back to the client.

## 5. Database Schema Design
The database is highly normalized to ensure data integrity.

### 5.1 `users` Table
Stores all authentication and profile data.
*   `id` (INT, PK, Auto Increment)
*   `name` (VARCHAR)
*   `phone` (VARCHAR, UNIQUE) - Normalized format.
*   `email` (VARCHAR, Nullable)
*   `password` (VARCHAR) - Bcrypt hash.
*   `role` (ENUM: 'employer', 'worker')
*   `skills` (VARCHAR, Nullable) - Used for worker profiles.
*   `latitude`, `longitude` (DECIMAL) - Last known location.
*   `avg_rating` (DECIMAL) - Aggregated rating score.
*   `total_jobs_completed` (INT)

### 5.2 `jobs` Table
The core entity representing a task.
*   `id` (INT, PK)
*   `employer_id` (INT, FK -> users.id)
*   `title`, `description`, `category` (VARCHAR/TEXT)
*   `price` (DECIMAL) - Payout for the task.
*   `latitude`, `longitude` (DECIMAL) - Exact location of the task.
*   `status` (ENUM: 'pending', 'accepted', 'completed')
*   `payment_status` (VARCHAR: 'unpaid', 'paid')
*   `assigned_worker_id` (INT, Nullable, FK -> users.id)

### 5.3 `applications` Table
Tracks the lifecycle of job interactions.
*   `job_id` (INT, FK)
*   `worker_id` (INT, FK)
*   `status` (ENUM: 'applied', 'accepted', 'rejected')
*   *Primary Key: Composite (job_id, worker_id)*

### 5.4 `ratings` Table
Facilitates the trust ecosystem.
*   `id` (INT, PK)
*   `from_user_id` (INT, FK)
*   `to_user_id` (INT, FK)
*   `job_id` (INT, FK)
*   `rating` (INT, 1-5)
*   `review` (TEXT)

### 5.5 `job_questions` Table
Enables pre-acceptance communication.
*   `id` (INT, PK)
*   `job_id` (INT, FK)
*   `worker_id` (INT, FK)
*   `question` (TEXT)
*   `answer` (TEXT, Nullable)

### 5.6 `otp_codes` Table (Legacy/Fallback)
Used prior to Firebase integration, or as a fallback for custom OTP logic.

## 6. Core Modules & Workflows

### 6.1 Authentication Module (Firebase Integration)
The platform transitioned from a custom Twilio-based OTP system to Firebase Identity Platform for enhanced reliability and security.

**Workflow:**
1.  User enters phone number on `index.html`.
2.  Frontend invokes `firebase.auth().signInWithPhoneNumber()`.
3.  Firebase bypasses reCAPTCHA (if configured for localhost testing via `appVerificationDisabledForTesting`) or displays a visible checkbox to prevent bot spam.
4.  Firebase sends a real SMS.
5.  User enters the 6-digit code.
6.  Frontend calls `confirmationResult.confirm(code)` to get a Firebase ID Token.
7.  Frontend sends ID Token to backend `POST /api/auth/firebase-login`.
8.  Backend uses `firebase-admin` to cryptographically verify the token.
9.  Backend looks up the normalized phone number. If it exists, a platform JWT is issued. If not, the frontend prompts for "Name" and "Role", and the backend creates a new user record.

### 6.2 Real-Time Job Matching Module
This is the heart of the platform, utilizing WebSockets for instant data propagation.

**Workflow:**
1.  Worker logs in. The frontend establishes a Socket.io connection and emits a `join` event with role `worker`. The backend places this socket in the `worker` room.
2.  Employer posts a job via the REST API.
3.  Database inserts the job.
4.  Backend `jobController.js` grabs the `io` instance and broadcasts: `io.emit('new_job_posted', jobData)`.
5.  Worker's browser receives `new_job_posted`. A sleek, glassmorphic toast notification slides in from the top right, playing a subtle notification sound.
6.  Worker clicks "Accept".
7.  Backend initiates a MySQL Transaction (`BEGIN`). It checks `SELECT status FROM jobs WHERE id = ? FOR UPDATE` to prevent race conditions (two workers clicking at the exact same millisecond).
8.  If pending, status is updated to `accepted`. Transaction is committed (`COMMIT`).
9.  Backend broadcasts `job_accepted` to remove the job from other workers' feeds.

### 6.3 Job Q&A Module
To reduce friction and cancellations, workers can ask questions before committing.
*   **Ask:** Worker sends a question. Socket.io alerts the employer instantly.
*   **Answer:** Employer responds. Socket.io alerts the worker instantly. The answer is stored and visible on the job card.

### 6.4 Simulated Payment Gateway
To handle payouts without integrating live financial data during development, a high-fidelity simulated checkout flow was built.
1.  Employer clicks "Pay Worker".
2.  Backend generates a cryptographically secure `sessionToken` (24 bytes hex) and stores it in memory (or Redis in production).
3.  Employer is redirected to `/checkout.html?session=...`.
4.  The checkout page features a highly polished UI with simulated card validation, UPI input, and Net Banking options.
5.  Upon submission, the frontend calls `/api/jobs/confirm-payment`.
6.  Backend validates the session, updates the job `payment_status` to `paid` in MySQL, increments the worker's `total_jobs_completed`, and deletes the session.
7.  A `payment_received` socket event triggers a celebratory animation on the worker's dashboard.

### 6.5 Geospatial Navigation (Map Module)
*   Utilizes the Google Maps JavaScript API.
*   When a job is accepted, the worker clicks "View Map".
*   The `map.js` script fetches the worker's current coordinates via the HTML5 Geolocation API.
*   It passes the worker's location and the job's `latitude`/`longitude` to `google.maps.DirectionsService`.
*   The route is rendered using `google.maps.DirectionsRenderer`, providing distance and ETA.

## 7. Security Implementations
*   **Token-Based Auth:** JWTs are stateless and signed. The `JWT_SECRET` is kept out of source control.
*   **Password Hashing:** `bcrypt` with a work factor of 10 ensures even if the database is compromised, passwords cannot be easily cracked via rainbow tables or brute force.
*   **SQL Injection Prevention:** All database interactions use `mysql2`'s parameterized queries (`?`), entirely mitigating SQL injection vectors.
*   **XSS Protection:** The frontend utilizes `textContent` instead of `innerHTML` when rendering user-generated content (like job titles or questions) to prevent Cross-Site Scripting.
*   **Firebase Admin Security:** Firebase tokens are verified server-side, preventing attackers from spoofing client-side authentication states.
*   **Race Condition Mitigation:** Database transactions and `FOR UPDATE` row-level locks prevent multiple workers from accepting the same job simultaneously.

## 8. Deployment Strategy
*   **Frontend & API:** Configured for seamless deployment on Vercel or Render. `vercel.json` provides the necessary rewrites to route `/api/*` traffic to the Express server while serving static files efficiently from the edge.
*   **Database:** Hosted on TiDB Cloud Serverless, providing MySQL compatibility with auto-scaling capabilities and connection pooling limits suitable for serverless functions.
*   **Environment Variables:** Managed securely via `.env` files locally and environment settings in the cloud console.

## 9. Future Scalability & Enhancements
While the current platform is robust, transitioning to a massive scale will require:
1.  **Redis Integration:** Replacing the in-memory payment session store with Redis for multi-node server deployments.
2.  **Geospatial Queries:** Modifying the MySQL schema to use `POINT` data types and Spatial Indexes (SPATIAL INDEX) to query jobs exclusively within a specific radius (e.g., 5km) of the worker, rather than loading all pending jobs.
3.  **Real Payment Processor:** Replacing the simulated gateway with Stripe Connect or Razorpay Route to handle split payments (platform fee + worker payout).
4.  **Mobile Applications:** Wrapping the frontend in React Native or Flutter for native push notifications (crucial for gig workers who may not have the web app open constantly).

## 10. Conclusion
The "Around You" platform successfully demonstrates a full-stack, real-time application capable of handling complex business logic, asynchronous communications, and secure authentication. The meticulous attention to the user interface ensures that the platform is not only functional but provides a premium, modern experience that elevates the standard for gig-economy applications.

---
*Report generated on: May 2026*
*Author: System Architecture & Development Team*
