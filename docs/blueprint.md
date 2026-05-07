# **App Name**: School Click

## Core Features:

- School Search & Selection: Allow users to search for schools using keywords (powered by NEIS API) and select their institution to view its details and ranking status.
- Interactive Clicker Button: Provide a prominent and engaging button for users to 'click' and increment their chosen school's popularity score in real-time.
- Real-time School Performance Display: Display the current click count and national rank for the user's selected school, updating dynamically as scores change.
- National Ranking Leaderboard: Present a dynamic top 10 leaderboard showing schools ordered by their total accumulated clicks, encouraging friendly competition.
- AI School Slogan Tool: Leverage a generative AI tool to create fun and unique slogans or taglines for selected schools, fostering school spirit and identity.
- Persistent School Data Storage: Securely store and manage school names, click scores, and ranking data in a Supabase database.
- Basic School Statistics: Display relevant engagement statistics such as 'student count' (randomized for MVP), estimated 'online users', and 'total clicks' across all participating schools.

## Style Guidelines:

- Color Palette Theme: A modern, dark aesthetic is employed to convey an energetic and focused environment suitable for a community engagement app.
- Primary Color: A vibrant, deep blue for key interactive elements and calls to action (HSL: 219, 89%, 54%, Hex: #2563eb). This hue emphasizes a sense of trustworthiness and community.
- Background Color: A very dark, subtly tinted blue-grey to provide a rich and immersive canvas for content (HSL: 219, 58%, 11%, Hex: #0f172a). It creates a harmonious contrast with the primary color.
- Accent Color: A clear, energetic cyan is used for secondary highlights, subtle indicators, and score values (HSL: 189, 70%, 60%, Hex: #4dd7ea). This analogous hue provides visual distinction while maintaining harmony.
- All text: 'Pretendard', a proportional sans-serif typeface, used for its modern, clean lines, and excellent legibility across all text sizes. Note: currently only Google Fonts are supported.
- Iconography should be simple, clear, and modern, using outline or emoji-style visuals to maintain a consistent aesthetic and easy recognition.
- Content is centrally aligned within a maximum width for optimal readability. Components are organized into 'card' elements with frosted glass effects (backdrop-filter) for clear content separation, complemented by a grid layout for displaying statistics.
- Subtle interaction animations, such as a gentle scale transform on active buttons, are incorporated to provide engaging tactile feedback without causing distraction.