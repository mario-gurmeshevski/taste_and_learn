# Interactive Video Quiz Website

An interactive video quiz website built with Vite, React, TypeScript, Tailwind CSS, and Supabase.

## Features

- Video player with custom controls that prevent seeking beyond furthest watched time
- Interactive quiz with timed questions (30 seconds per question)
- Real-time leaderboard with podium-style visualization
- Supabase backend for user management and score tracking
- Fully responsive design with Tailwind CSS

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up Supabase:
   - Create a new project at [supabase.io](https://supabase.io)
   - Run the SQL schema from `supabase_schema.sql` in your Supabase SQL Editor
   - Copy your Project URL and Anonymous Key from Project Settings > API

3. Configure environment variables:
   - Rename `.env.example` to `.env`
   - Add your Supabase credentials to `.env`

4. Run the development server:
   ```bash
   npm run dev
   ```
