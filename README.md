# Around You

Around You is a premium, modern web platform designed to connect employers with daily wage workers. Featuring a sleek, voxr.ai-inspired dark theme with glassmorphism, animated particle backgrounds, real-time map integration, and a simulated secure payment gateway.

## Features

- **Real-time Job Matching:** Employers can post jobs, and workers can accept them instantly.
- **Live Location Tracking:** Integrated with Google Maps for real-time navigation from the worker to the job site.
- **Multiple Payment Methods:** Simulated checkout flow supporting Card, UPI, Net Banking, and Cash After Work.
- **Premium UI/UX:** Voxr.ai inspired design with electric purple accents, aurora glow effects, and interactive particle backgrounds.
- **Role-based Dashboards:** Dedicated dashboards for Employers and Workers.

## Prerequisites

Before running this application, ensure you have the following installed on your machine:

1. **Node.js** (v14 or higher) - [Download Node.js](https://nodejs.org/)
2. **MySQL** - Ensure you have a MySQL server running locally.

## Setup Instructions

Follow these steps to run Around You on your Mac terminal (or any terminal):

### 1. Clone or Navigate to the Project Directory

Open your terminal and navigate to the project directory:

```bash
cd /path/to/pro
```

### 2. Install Dependencies

Install the required Node.js packages using npm:

```bash
npm install
```

### 3. Database Setup

You need to set up the MySQL database and the required tables.

1. Log in to your MySQL server:
   ```bash
   mysql -u root -p
   ```
2. Create the database:
   ```sql
   CREATE DATABASE kaamsetu_db;
   USE kaamsetu_db;
   ```
3. Import the schema (if a schema file exists, e.g., `database/schema.sql`):
   ```bash
   mysql -u root -p kaamsetu_db < database/schema.sql
   ```
   *(Alternatively, the application might auto-create tables upon connection if configured that way, but running the provided schema is recommended).*

### 4. Environment Variables Configuration

Create a `.env` file in the root directory of the project and configure the necessary environment variables. You can copy the existing configuration if you have one, or create a new one:

```bash
touch .env
```

Open the `.env` file and add the following configuration (replace with your actual credentials where necessary):

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=kaamsetu_db

# Application Secrets
JWT_SECRET=aroundyou_super_secret_key_123!
PORT=3000

# API Keys
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
# (Optional) STRIPE_SECRET_KEY=sk_test_...
```

### 5. Start the Server

Once everything is set up, you can start the Node.js server. Run the following command in your terminal:

```bash
node src/server.js
```
*Note: If you have `nodemon` installed, you can use `nodemon src/server.js` for automatic restarts during development.*

### 6. Access the Application

Open your web browser and navigate to:

```text
http://localhost:3000
```

## Testing the Flow

1. **Sign Up/Log In:** Create an account as an Employer or a Worker.
2. **Employer Flow:** Post a job with a title, description, price, and location.
3. **Worker Flow:** Log in as a worker, view available jobs, and accept one. View the map for directions.
4. **Payment Flow:** Once the worker completes the job, the employer can click "Pay Worker" from their dashboard to test the simulated checkout process.
# Around-You
# Around-You
