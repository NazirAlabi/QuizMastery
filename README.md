# QuizMastery

## Overview
QuizMastery is a comprehensive quiz application designed to offer users an engaging and interactive platform for testing their knowledge across various subjects.

## Features
- User authentication and profile management
- Diverse range of quiz categories
- Timed quizzes with score tracking
- User-generated quizzes
- Real-time performance analytics

## Tech Stack
- **Frontend:** React.js, Redux
- **Backend:** Node.js, Express
- **Database:** Firebase Firestore
- **Authentication:** Firebase Authentication
- **Hosting:** Firebase Hosting

## Installation
1. Clone the repository:  
   `git clone https://github.com/NazirAlabi/QuizMastery.git`
2. Navigate to the project directory:  
   `cd QuizMastery`
3. Install dependencies:  
   `npm install`
4. Start the development server:  
   `npm start`

## Development
- Ensure you have Node.js installed.  
- Follow the installation steps above to set up the local environment.
- Use the below commands to run common tasks:
  - `npm run build`: Compile the project for production.
  - `npm test`: Run tests.

## Firebase Configuration
1. Create a Firebase project on the [Firebase Console](https://console.firebase.google.com/).
2. Add a web application and copy the provided Firebase configuration object.
3. Update the Firebase configuration in your application:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
4. Initialize Firebase in your application following the Firebase documentation.

## Project Structure
```
QuizMastery/
├── src/
│   ├── components/   # React components
│   ├── pages/        # Application pages
│   ├── utils/        # Utility functions
│   ├── services/     # API service calls
│   └── styles/       # Stylesheets
├── public/           # Static files (index.html)
├── package.json      # Project metadata and dependencies
└── README.md         # Project documentation
```