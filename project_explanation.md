# Around You Project Explanation

This document provides a comprehensive overview of the Around You project, explaining its architecture, features, and the technologies used.

## 1. Overview
Around You is a premium, modern web platform designed to connect employers with daily wage workers. It allows employers to post jobs, and workers can find and accept these jobs in real-time. The application features a simulated payment gateway, real-time map integration for navigation, and an animated, highly-polished UI.

## 2. Technology Stack
- **Backend:** Node.js, Express.js
- **Database:** MySQL (using `mysql2` package)
- **Real-time Communication:** Socket.io
- **Authentication:** JSON Web Tokens (JWT) & bcrypt (for password hashing)
- **Frontend:** HTML, Vanilla CSS (Premium UI with Glassmorphism), Vanilla JavaScript
- **Payment Gateway:** Custom simulated checkout flow (built to mimic real-world gateways like Stripe)

## 3. Project Structure
The project is primarily divided into backend (`src` and `database`) and frontend (`public`).

### Backend (`src/`)
- **`server.js`**: The main entry point of the application. It initializes the Express server, integrates Socket.io, sets up middleware (like CORS and JSON parsing), and defines the main API routes (`/api/auth` and `/api/jobs`).
- **`config/db.js`**: Configures the connection pool to the MySQL database.
- **`controllers/`**: Contains the business logic for handling API requests.
  - `authController.js`: Handles user registration, user login, and fetching user profiles.
  - `jobController.js`: Handles creating jobs, fetching jobs for employers/workers, accepting jobs, completing jobs, and managing payment checkout sessions.
- **`routes/`**: Maps HTTP endpoints to specific controller functions.
  - `authRoutes.js`: Defines authentication routes (`/register`, `/login`, `/profile`).
  - `jobRoutes.js`: Defines job-related routes.
- **`middleware/auth.js`**: Middleware used to protect routes. It verifies the JWT token sent from the frontend and authorizes users based on their role (`employer` or `worker`).
- **`sockets/jobSockets.js`**: Manages real-time WebSocket connections. It handles events such as users joining their role-based rooms, emitting notifications for new jobs, and notifying workers when payments are received.

### Frontend (`public/`)
- **`index.html`**: The landing page containing the login and registration forms.
- **`employer-dashboard.html`**: The dashboard for employers to post jobs, view active jobs, and check past job history.
- **`worker-dashboard.html`**: The dashboard for workers to find available jobs, see their accepted jobs, and view real-time popups for new opportunities.
- **`checkout.html`**: A highly designed, simulated secure payment gateway page that supports multiple simulated methods (Card, UPI, Net Banking, Cash).
- **`map.html`**: Uses Google Maps to display real-time directions for a worker to travel to the job location.
- **`css/style.css`**: The core stylesheet featuring a dark theme, aurora glow effects, glassmorphism, and responsive design.
- **`js/`**: Client-side JavaScript files handling interactivity:
  - `app.js`: Authentication logic (handling login and registration forms).
  - `employer.js` & `worker.js`: Dashboard logic (fetching jobs, interacting with sockets, updating the UI).
  - `map.js`: Google Maps initialization and routing logic.
  - `particles.js`: Renders the animated particle background on the HTML canvas.

### Database (`database/`)
- **`schema.sql`**: Contains the SQL commands to create the necessary tables (`users`, `jobs`, `applications`, `ratings`).

## 4. Key Features & Workflows

### Authentication Flow
1. Users register as either an **Employer** or a **Worker**. Passwords are encrypted using `bcrypt`.
2. Upon login, the backend verifies credentials and issues a JWT token.
3. The frontend stores this token in `localStorage` and attaches it to the `Authorization` header for all subsequent API requests.

### Real-Time Job Posting & Acceptance
1. An employer creates a job via the dashboard. The job details and GPS coordinates are saved to the database.
2. The backend emits a `new_job_posted` event via Socket.io.
3. All workers currently online receive this event, and a pop-up appears on their screen showing the new job and its payout.
4. If a worker clicks "Accept", a request is sent to the backend to assign the worker to the job. Other workers will no longer be able to accept it.

### Simulated Payment Flow
1. Once a job is finished, the employer clicks "Pay Worker" on their dashboard.
2. A temporary checkout session is created on the backend, and the employer is redirected to `checkout.html`.
3. The employer inputs simulated payment details (e.g., test card numbers or UPI IDs) and submits the payment.
4. The backend marks the job as `paid` and emits a `payment_received` Socket.io event directly to the worker, triggering an alert on the worker's screen.

### Navigation (Google Maps)
When a worker accepts a job, they can click "View Map". The `map.html` page calculates the distance and estimated travel time from the worker's current location to the job site using Google Maps APIs.

## 5. Database Architecture

- **`users` Table**: Stores basic details (name, phone, hashed password), the user's role (`employer` or `worker`), and their geographic coordinates (`latitude`, `longitude`).
- **`jobs` Table**: Links to an employer (`employer_id`). Stores the job title, price, location, status (`pending`, `accepted`, `completed`), and the assigned worker (`assigned_worker_id`).
- **`applications` Table**: A junction table intended to track the history of workers applying to or accepting jobs.
- **`ratings` Table**: Designed for a feedback system where users can rate each other post-job.
