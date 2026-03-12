**Now**
Refactor the toaster to not display the firestore messages directly as texts, and instead display information useful to the user like wrong credentials or bad network, retry




**Soon**
Decide on how stats from past quiz trials are saved, analyzed, and displayed.



**Eventually**
Modify the search function to also backcheck against course names so if a course name or part of it is typed, it's associated quizzes will be shown. But make that search as 'lazy' as possible so it only happens after the normal results have been collected and shown

Add a bad network view if loading quizzes or anything else fails due to internet connection

Decide on a system of login persistence

Allow a code to be typed from any user profile to turn on dev settings. The code should be stored as a hash in firestore to prevent authorization by peeking in the code in console.

Make the quiz cards more responsive



**Done**
Edit the guest identifier logic in dev tools users page to fit the current plan
Add a users schema in the schemas folder in a similar format as the other schemas to outline the structure of a users object, be it registered or guest
Write a temporary script to remove all previous guest user objects of the lasty structure (with guest identifier and all that)


create a primary landing page with a hero section and links to the other pages, description of the site and all that

I need to add a guest user feature to my existing quiz application. The goal is to let unauthenticated users try the app before signing up. Here’s the desired behavior:
First Quiz Attempt: When an unauthenticated user takes a quiz, the system should automatically create a guest user record in the database and associate all subsequent activity with that guest via a persistent cookie (or similar mechanism). No sign-up form is shown at this point.
Quiz Limit: Each guest is allowed a maximum of any  2 quiz attempts. On a third attempt,  redirect the user to the sign-up page. Registered users have no such limit. 
The app should retrieve attempts using the guest identifier from the cookie.
Sign-Up & Data Retention: When a guest decides to sign up (by providing email/password), their existing guest record should be upgraded to a registered user (i.e., email/password added, type changed to registered). All past quiz attempts must remain linked to the same user record. If the user signs up without having a guest cookie (e.g., a new user), a normal registered account is created.
Guest Cleanup (Dev Mode): Create a users page in dev mode to show all users and to list all guest users, filter by inactivity (e.g., last active more than 30 days ago), and delete selected guests along with their quiz attempts. This helps keep the database clean. 
Edge Cases:
Existing registered users must be unaffected.
If a guest clears cookies, they become a new guest and lose access to previous attempts – that’s acceptable.
The system should update a "last active" timestamp for guests on each quiz attempt to support inactivity cleanup.
Please implement this feature in my existing codebase. Adapt the changes to my current stack (you may need to ask about specific technologies if unclear). The goal is a seamless experience where users can try the app immediately and only hit a sign-up wall after their second free quiz.

Make the action buttons in the content page in dev mode(such as archive, add...., etc) more responsive with progress bars showing current operations or something perhaps

The start quiz, proceed and submit buttons are all exceedingly slow now. Optimize the whole website even more for much more improved performance. Remove any feature that isn't entirely essential



Update the intermediary page between clicking start quiz and quiz starting for the user to customize their experience. Either for 0.5x,1x,1.5x, or 2x the speed, or untimed altogether. In the case where a quiz is untimed, the timer should rather start from 00:00 and keep track of how long the user takes. They should also be given the option to be allowed breaks or not. After selecting their choices a proceed button will start the current three second countdown and then the quiz starts.
The attempt information should therefore encode the configuration used during the attempt.

Questions should be shuffled during attempt and they should not be grouped by question type(mcq, numeric, etc)

Enter should simulate clicking next during the quiz for all question types
There should be a bar to navigate directly to any question on the test so the user isn't restricted in order and it should show when a question has been answered or not.
There should also be a mark for review feature to mark a question.
On clicking submit the quiz page should be cleared altogether with a spinner or something to show progress





Make the dev features on button design the same as when it was a badge with this classlist "<Badge className="bg-amber-600 hover:bg-amber-600 text-white">"

Generally speed up the app with as much lady loading as feasible to not slow down low memory devices. The the all courses and quizzes pages for instance take too long to load. Same for the detail pages, and virtually every other page.





Make the 'Dev Features On' chip in the nav bar a button to disable and enable the dev features



Create some sort of page generator pages that generate a page for each course and for each quiz. The pages can just take the course or quiz ids as arguments and return the relevant page.
In line with that create or add some detail to the description fields of both objects to display on the given page.





Add a search feature in all available quizzes
Since a quiz can have more than one course association, the course association fields in bulk edit quizzes and quizzes should reflect that. It should probably have the same type of input field as the current quiz questions in the quiz section.





Change all text that is black to be brighter in dark mode for visibility including but not limited to the toaster text and the quit quiz button text
Add a bulk upload questions tab in the dev content page to upload the same type of json to automatically batch create question objects
Change the bulk upload quiz tab to bulk edit quiz so that the bulk upload quiz functionality works the same but when an existing quiz is selected, the questions linked to that quiz will be generated in the same format they're uploaded to be edited and pasted back such that all changes affect all involved questions.





Standardize the quiz card heights and sort courses by the number of associated quizzes on the courses page
Standardize the start quiz button instead of making it relative to the card width

Add a small bar at the top to filter through the courses by selecting them with a clear all filters button
Make the long sections in the results page dropdowns each like areas for improvement and topic breakdown

