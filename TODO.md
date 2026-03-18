**Now**


**Soon**
Allow a code to be typed in settings from any user profile to turn on dev mode. The code should be stored as a hash in firestore to prevent authorization by peeking in the code in console. And the feature should be in some Advanced in settings


**Eventually**


**Done**
Add a button above the current content of the generate ai prompt in json schema mode in create new quiz from upload to copy the prompt the quiz description prompt text currently in the relevant file in prompts in public. You can do it the same way as the templates, just copy and paste the text as the assignment of some variable in dev content and use that directly

1.Make it so if no requested data objects are gotten due to bad connection in any page, an overlay blurs out the relevant parts of the page and shows that there's none or bad connection with a button to retry.
2.Add some refresh button show whenever a change is made in the dev content dash or any such relevant place.
3.Remove or update all unused parts of the project folder like calltoaction and heroimage.
4.Add schema files in the schema folder for all data objects that are absent from the folder.
5.Increase the persistence of an account logged in by keeping some relevant information for the UI saved to localstorage or something so it doesn't appear empty on every reload before signing in but make sure it's correctly cleared or updated when signing in, creating another account or just signing out. 
6.Add a check or something of the sort in the login and register modals to stay logged in or not that'll toggle the any auth persistence or not. (be it cookie or the localstorage item)
7.The feedback doesn't send it seems. Error toast pops up to say insufficient permissions even when attempted from a dev account. Perhaps the firestore rules need updating still?
8.Allow the general size of ui and text to be adjusted between three modes in settings with mobile screens defaulting to a larger size to stop safari from auto zooming because of sm

1.The log in page does not display anything without any erros. Similar issues were seen recently and fixed by altering the firestore rules to allow some actions for any user so it's suspected that the problem is similar. After fixing, add some indicator in the code to log some error if an unexteced response is gotten from a firestore query because of insufficient permissions or anything of the sort.
2.Abstract the latex error functions from the dev content file
3.Make the blurred out colors in the "Master concepts faster" card in the landing page animated so they move about and twinkle in some subtle way.
4.Make the part of the navbar with the page links automatically become a scroll container if it doesn't comfortable contain the links again.
5. Make the footer customization card in dev mode only show when some button is pressed. 
6. Add some feedback button site wide to allow the user to give feedback by optionally choosing from some list of expected messages or reasons, optionally selecting an urgency level out of three, and perhaps optionally specifying what the feedback or problem is about, whether technical or content or whatever else. The way the feedback system works should be relative to where it's being used. For instance in the courses page, it could recommend a message about requesting a course or flagging some existing course for some recommended reasons. To prevent complexity, you can just add the button for it to every relevant element. So perhaps the quiz runner page could have it at the top-right to send feedback about the quiz and the question card could have it too to send feedback about a question. Also add a page to dev mode to view all of this and categorize this in however many ways.
6.Make the view password button in the password field in the login and register pages visible and add a forgot password feature that allows the password to be reset if the display name and email are typed correctly
7.Remove the wallpaper alternator button from mobile and put it in the settings. It should be in settings for all screen sizes, just with a hint below it on md screens that informs them about the button on the screen.
8.On md screens move the question navigator to the right side of the question card without changing the current position of the question card at all
9.Refactor the quizcard component to make it simpler cause I think it's overcomplicated currently. Keep the layout, behaviour, look and stuff like that the same. Details like the inputs to the card can be changed as long as they don't affect the layout and all the places where the component is used are updated

To prevent complications with the attempts history. just make the function there display any available attempts with fallbacks for problematic errors to avoid breaking the app flow and avoid destructive error toasts and instead add a button somewhere relevant in dev mode to clear all attempts still labeled as in progress from over an hour ago or any other criteria that will be imposed later. You can add it to the users page.

Instead of redirecting the user to the whole review page let each attempt card just be an accordion button that expands to show the percentage of questions gotten wrong, the distributions across skill, topic and difficulty, and the time information(how much time it took or how much time they used versus the time allocated and  multiplier used if any.
Also, any attempts that seem to be 'In progress' from over an hour ago should just be assumed to have some error and should be deleted from the records after displaying the valid ones.

Change the insights page to a general Progress and History page to view any past attempts and get insights across quizzes by topics, difficulty and skills

Create a feature to copy the prompt like the one used to create a new quiz by upload entirely by json for the quiz variation prompt generation by selecting the desired difficulty and injecting that along with the current json and difficulty and allowing the user to copy with a button. 
It should only show after the user clicks the button to create a difficulty variation
Also update both of the prompt templates being used to match the current contents of the relevant text files

1. Refactor the courses page to only show the first six courses on md and the first four on all screens below md. 2. Then add a link after the displayed courses to navigate to the course details page for that course
3. In the course details page below the topic, course code and linked quizzes count and above the quiz cards, add a filter area exactly like the one in the course page that displays the quiz topics and groups by them instead.
4. Add a toggle in the courses page, above the filter bar, to display the quizzes in a grid with two columns to show more at once or display them as they are currently(one column)
4.In bulk edit quiz, when an existing quiz is selected, include an option to create new difficulty variation that produces the current quiz question json in a field to be copied, made easier or harder to fit the new variation's difficulty level, and pasted back, and has a difficulty field to set the difficulty of the new variation.
5. Then when create from upload is clicked, a new quiz object should be created with all the same information just with the new question list and difficulty assignment.
6.Before creation, a check should be made to compare the new question list to the old one and terminate the process if they are exactly the same
7.Also check and confirm the difficulty variants will not be flagged as duplicates by the remove duplicate functions and cleared when they are run.
6.Then for quizzes with different difficulty variations, the difficulty badge, with the same design, should be a dropdown to select difficulty from the available variations before selecting start quiz, and the difficulty should still be customizable in the quiz ready page.

Refactor the toaster to not display the firestore messages directly as texts, and instead display information useful to the user like wrong credentials or bad network, retry

The 'signed in as...' UI shouldn't show when not logged in as any user yet. When logged in as a registered user, it should be "signed in as *email*". If registered but with no email somehow, it shouldn't show at all. When using a guest profile it should just be "Guest", no signed in.
The greeting should just be without a name in the absence of one. Therefore the comma should be moved into the conditional so if it fails, there'll be no comma

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

Decide on how stats from past quiz trials are saved, analyzed, and displayed.

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

