# Taste & Learn

An interactive video quiz application where users watch synchronized video content and answer timed questions. Features real-time broadcasting, admin controls, and a comprehensive authentication system.

## Features

### User Experience

- **Synchronized Video Quiz**: Video player with questions that appear at specific timestamps
- **Timed Questions**: 30-second countdown timer per question with auto-submit
- **Real-time Sync**: Admin-controlled video playback synchronized across all users
- **Seek Prevention**: Users cannot skip ahead in the video
- **Anonymous Authentication**: Users can participate without registration
- **404 Page**: Custom not-found page for undefined routes

### Admin Features

- **Broadcast Controls**: Admin controls video playback (play/pause/seek) for all users
- **Leaderboard Access**: View comprehensive user statistics and rankings
  - **Admins**: See all users with full details (name, score, attempts)
- **Question Management**: Access and manage quiz questions
- **User Analytics**: Track user performance and quiz sessions
- **QR Code Sharing**: Generate QR codes for easy mobile access

### Authentication & Security

- **Anonymous Login**: Quick access without email/password
- **Admin Login**: Secure authentication for admin users
- **Protected Routes**: All routes except `/login` require authentication
- **Role-Based Access**: Admin-only routes (`/admin`, `/leaderboard`)
- **Smart Redirects**: Saves attempted routes and redirects after login
- **Login Guard**: Authenticated users automatically redirected from `/login`
- **XSS Protection**: DOMPurify sanitization for user-generated content

## Tech Stack

- **Frontend**: React 19.2 + TypeScript, Vite 7.2
- **Styling**: Tailwind CSS 4.1
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **Video**: Plyr React 6.0 (hosted on Cloudflare R2)
- **Real-time**: Supabase Realtime subscriptions
- **Routing**: React Router DOM 7.12
- **Animations**: Framer Motion 12.26
- **UI Libraries**: React Icons, React Hot Toast, QRCode.React
- **Security**: DOMPurify for XSS protection

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.io](https://supabase.io)
2. Run the database schema:
   ```sql
   -- Execute contents of sql/supabase_schema.sql
   ```
3. Seed sample questions (optional):
   ```sql
   -- Execute contents of sql/questions.sql
   ```
4. Copy your credentials from Project Settings > API:
   - Project URL
   - Anonymous/Public Key

### 3. Configure Environment Variables

Rename `.env.example` to `.env` and add your credentials:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-anon-key
VITE_VIDEO_URL=your-cloudflare-r2-video-url
```

### 4. Set Up Video Hosting

Upload your video file to **Cloudflare R2** (or any CDN) and add the public URL to your `.env` file as `VITE_VIDEO_URL`.

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Set Up Admin User

To enable admin features, manually update a user's role in Supabase:

```sql
UPDATE users SET role = 'admin' WHERE id = 'user-uuid';
```

## Development Commands

```bash
npm run dev          # Start dev server (localhost)
npm run host         # Start dev server with network access
npm run build        # TypeScript check + production build
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

### Deployment

The app includes a `vercel.json` configuration file for easy deployment to Vercel. Simply connect your Git repository and deploy with default settings.

## Project Structure

```
src/
├── App.tsx                      # Main app with routing configuration
├── main.tsx                     # Application entry point
├── config/
│   ├── types.ts                 # TypeScript type definitions
│   └── constants.ts             # Application constants (timing, DB tables, etc.)
├── components/
│   ├── Home.tsx                 # Video player with synchronized quiz overlay
│   ├── Quiz.tsx                 # Main quiz component with state management
│   ├── Leaderboard.tsx          # Leaderboard display with podium view
│   ├── LeaderboardPage.tsx      # Leaderboard page wrapper with auth
│   ├── AdminPanel.tsx           # Admin controls for broadcast & questions
│   ├── Login.tsx                # Anonymous & admin authentication
│   ├── Navbar.tsx               # Navigation bar with user info
│   ├── ProtectedRoute.tsx       # Auth guard component for protected routes
│   ├── NotFound.tsx             # 404 not found page
│   ├── ErrorBoundary.tsx        # Error handling wrapper
│   ├── Skeleton.tsx             # Loading skeleton component
│   ├── admin/                   # Admin panel components
│   │   ├── VideoControls.tsx    # Play/pause/seek controls
│   │   ├── BroadcastStatus.tsx  # Current broadcast state display
│   │   ├── VideoPlayer.tsx      # Admin video player
│   │   └── QRCodeModal.tsx      # QR code generation for sharing
│   └── quiz/                    # Quiz component modules
│       ├── QuizState.ts         # Quiz reducer & state management
│       ├── QuizLoading.tsx      # Loading state
│       ├── QuizError.tsx        # Error handling
│       ├── QuizComplete.tsx     # Completion screen
│       ├── QuizWaiting.tsx      # Waiting state
│       ├── QuizHeader.tsx       # Timer and question counter
│       ├── QuizQuestion.tsx     # Main question display
│       └── QuizAnswerButton.tsx # Answer option button
├── contexts/
│   └── BroadcastContext.tsx     # Global broadcast state provider
├── hooks/
│   ├── useBroadcastState.ts     # Realtime subscription + polling fallback
│   ├── useBroadcast.ts          # Hook for accessing broadcast context
│   ├── useVideoSync.ts          # Client-side interpolation & drift correction
│   └── useAbortController.ts    # Cleanup utility for async operations
└── lib/
    ├── supabase.ts              # Supabase client configuration
    ├── sanitize.ts              # DOMPurify integration for XSS protection
    └── animations.ts            # Consistent Framer Motion props

sql/
├── supabase_schema.sql          # Database schema with RLS policies
├── questions.sql                # Sample quiz questions data
└── users.sql                    # User management queries
```

## Authentication Flow

### User Login

1. User enters name → Creates anonymous account with 4-digit discriminator
2. Redirects to `/quiz` or saved route
3. Can participate in quizzes and view their scores

### Admin Login

1. User enters email/password
2. Redirects to `/admin` or saved route
3. Full access to admin panel and leaderboard

### Route Protection

- **Public Routes**: `/login`
- **Protected Routes**: `/`, `/quiz` (require authentication)
- **Admin Routes**: `/admin`, `/leaderboard` (require admin role)
- **Catch-All**: All undefined routes → 404 page (or login if unauthenticated)

## Database Schema

### Key Tables

**users**

- `id` (UUID, links to auth.users)
- `name` (TEXT)
- `discriminator` (TEXT) - 4-digit unique code (e.g., "1234")
- `role` (TEXT: 'user' or 'admin')
- `created_at` (TIMESTAMP)

**questions**

- `id` (BIGINT, auto-increment)
- `question_text` (TEXT)
- `options` (JSONB array of answer options) - supports multi-language content
- `correct_answer_index` (INTEGER) - 0-based index of correct answer
- `start_timestamp` (INTEGER) - question appears at this video time (seconds)
- `end_timestamp` (INTEGER) - question disappears at this video time (seconds)
- `created_at` (TIMESTAMP)

**answers**

- `id` (BIGINT, auto-increment)
- `user_id` (UUID, foreign key)
- `question_id` (BIGINT, foreign key)
- `selected_option` (INTEGER)
- `is_correct` (BOOLEAN)
- `score` (INTEGER)
- `created_at` (TIMESTAMP)

**quiz_sessions**

- `id` (BIGINT, auto-increment)
- `user_id` (UUID, foreign key)
- `started_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP)
- `total_score` (INTEGER)
- `questions_count` (INTEGER)

**quiz_session_questions**

- Junction table linking quiz sessions to specific questions
- Tracks user answers per question in a session

**public_broadcast_state**

- Single-row table for real-time video synchronization
- `current_position` (DECIMAL) - current video position in seconds
- `is_playing` (BOOLEAN) - playback state
- `updated_by` (UUID) - admin who last updated the state
- `updated_at` (TIMESTAMP)

## Real-time Architecture

The application uses a sophisticated dual-sync mechanism for video synchronization:

1. **Primary**: Supabase Realtime subscriptions to `public_broadcast_state`
2. **Fallback**: 5-second polling if real-time fails
3. **Client-side interpolation**: Calculates expected position between syncs for smooth playback
4. **Drift detection**: Corrects time drift when it exceeds 1-second tolerance

When the admin controls the video:

1. Admin updates `public_broadcast_state` table via AdminPanel
2. Real-time subscription pushes changes to all subscribed clients
3. Video players sync to the broadcast state using client-side interpolation
4. Quiz questions activate based on video timestamps

This architecture ensures synchronization works even if the real-time connection fails.

## Adding Questions

To add new quiz questions:

```sql
INSERT INTO questions (
  question_text,
  options,
  correct_answer_index,
  start_timestamp,
  end_timestamp
) VALUES (
  'Your question text?',
  '["Option 1", "Option 2", "Option 3", "Option 4"]'::jsonb,
  0,  -- index of correct answer (0-based)
  30, -- appear at 30 seconds of the video
  60  -- disappear at 60 seconds of the video
);
```

### Question Timing

- Questions appear when `video.currentTime >= question.start_timestamp`
- Questions disappear when `video.currentTime > question.end_timestamp`
- Quiz overlay appears automatically based on video timestamps
- 30-second timer starts when question becomes visible
- Auto-submits when timer expires
- Video seeking is blocked to prevent skipping unanswered questions

## Architecture Highlights

### Modular Component Structure

The application uses a modular architecture with:

- **Context API** for global broadcast state management
- **Custom hooks** for reusable logic (broadcast state, video sync, abort controller)
- **Component composition** with dedicated quiz and admin sub-components
- **Error boundaries** for graceful error handling

### Performance Optimizations

- **Code splitting**: Large libraries loaded in separate chunks
- **Lazy loading**: Plyr video player loaded on-demand
- **Memoization**: Expensive computations cached with useMemo
- **Efficient sync**: Client-side interpolation reduces server calls

### Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **XSS Protection**: DOMPurify sanitizes all user-generated content
- **Role-based access**: Admin routes protected both client-side and server-side
- **Anonymous auth**: Persistent user identities without password management

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
