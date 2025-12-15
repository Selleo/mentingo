<a name="v3.23.0"></a>

## [v3.23.0] - 10.12.2025

### Features:

- enable multi-language user interface support for courses ([#1062](https://github.com/Selleo/mentingo/issues/1062))

- allow admins to unenroll groups from courses ([#1065](https://github.com/Selleo/mentingo/issues/1065))

- add log tracking to improve visibility into user actions ([#1038](https://github.com/Selleo/mentingo/issues/1038))

- prepare environment for multi-language course ([#969](https://github.com/Selleo/mentingo/issues/969))

- allow customizing the AI mentor’s appearance ([#1003](https://github.com/Selleo/mentingo/issues/1003))

- allow admin to unenroll users from courses ([#1017](https://github.com/Selleo/mentingo/issues/1017))

- allow assigning users to multiple groups ([#991](https://github.com/Selleo/mentingo/issues/991))

- allow admin to enforce sequential lesson progression for students ([#981](https://github.com/Selleo/mentingo/issues/981))

### Bug Fixes:

- handle unenrollment properly for students assigned to multiple groups ([#1069](https://github.com/Selleo/mentingo/issues/1069))

- ensure quiz completion is tracked correctly ([#1068](https://github.com/Selleo/mentingo/issues/1068))

- ensure AI mentor messages update correctly ([#1046](https://github.com/Selleo/mentingo/issues/1046))

- not working enforcing lesson sequence when creating a new course ([#1061](https://github.com/Selleo/mentingo/issues/1061))

- improve student dashboard layout on mobile ([#1042](https://github.com/Selleo/mentingo/issues/1042))

- auto-generate certificates when course certificate settings change ([#1053](https://github.com/Selleo/mentingo/issues/1053))

- improve button behavior in the mobile menu ([#1039](https://github.com/Selleo/mentingo/issues/1039))

- close the global search modal after selecting an item ([#1040](https://github.com/Selleo/mentingo/issues/1040))

- reduce excessive gaps between elements in texts ([#1047](https://github.com/Selleo/mentingo/issues/1047))

- improve horizontal spacing in course description ([#1048](https://github.com/Selleo/mentingo/issues/1048))

- certificate generation no longer ignores settings ([#1033](https://github.com/Selleo/mentingo/issues/1033))

- correctly display users with no groups in statistics ([#1029](https://github.com/Selleo/mentingo/issues/1029))

- ensure image uploads in text lessons handle links correctly ([#1022](https://github.com/Selleo/mentingo/issues/1022))

- make drag-and-drop in quizzes work properly on mobile ([#1015](https://github.com/Selleo/mentingo/issues/1015))

### Chores:

- clean up dependencies by removing intro.js ([#1063](https://github.com/Selleo/mentingo/issues/1063))

<a name="v3.22.0"></a>

## [v3.22.0] - 01.12.2025

### Features:

- allow admin to enroll a whole group to a course ([#841](https://github.com/Selleo/mentingo/issues/841))

- add email icons to improve notification appearance ([#992](https://github.com/Selleo/mentingo/issues/992))

- allow to add images to text lessons ([#926](https://github.com/Selleo/mentingo/issues/926))

- make email configuration easier and more reliable with updated email provider settings ([#983](https://github.com/Selleo/mentingo/issues/983))

- allow admin to set default interface language when creating users ([#972](https://github.com/Selleo/mentingo/issues/972))

- add Polish language support for email subjects and content ([#979](https://github.com/Selleo/mentingo/issues/979))

- show admins a warning when configuration is incomplete ([#919](https://github.com/Selleo/mentingo/issues/919))

- adjust users view to bigger volume of users ([#967](https://github.com/Selleo/mentingo/issues/967))

- allow admin to preview student conversations with AI mentor ([#851](https://github.com/Selleo/mentingo/issues/851))

- enhance email notifications for clarity and visual appeal ([#930](https://github.com/Selleo/mentingo/issues/930))

### Bug Fixes:

- step counter in setup script ([#1014](https://github.com/Selleo/mentingo/issues/1014))

- ensure messages thread update correctly after new messages in ai mentor preview ([#1013](https://github.com/Selleo/mentingo/issues/1013))

- ensure content creators can edit only their own courses ([#1008](https://github.com/Selleo/mentingo/issues/1008))

- improve message scrolling behavior in AI mentor lesson ([#1011](https://github.com/Selleo/mentingo/issues/1011))

- ensure cropped svg avatars display correctly ([#1009](https://github.com/Selleo/mentingo/issues/1009))

- improve display of true/false questions on mobile ([#1007](https://github.com/Selleo/mentingo/issues/1007))

- add option to drop files ([#896](https://github.com/Selleo/mentingo/issues/896))

- added error message for lesson title length limit ([#940](https://github.com/Selleo/mentingo/issues/940))

- sort lessons order in stats ([#914](https://github.com/Selleo/mentingo/issues/914))

- ensure SVG email icons load correctly ([#993](https://github.com/Selleo/mentingo/issues/993))

- stabilize end-to-end tests for more reliable checks ([#948](https://github.com/Selleo/mentingo/issues/948))

- prevent AI mentor lesson view from resizing content incorrectly ([#990](https://github.com/Selleo/mentingo/issues/990))

- long course title weirdly stretching UI ([#976](https://github.com/Selleo/mentingo/issues/976))

- improve alignment of the edit course button for clearer layout in student's view ([#982](https://github.com/Selleo/mentingo/issues/982))

- prevent long lesson titles from stretching the interface ([#942](https://github.com/Selleo/mentingo/issues/942))

- ensure consistent and reliable releases ([#966](https://github.com/Selleo/mentingo/issues/966))

- improve placement of the edit course button for admins ([#975](https://github.com/Selleo/mentingo/issues/975))

- keep the lesson editor visible while scrolling the chapters list ([#974](https://github.com/Selleo/mentingo/issues/974))

- annoying logo display while developing on local environment ([#925](https://github.com/Selleo/mentingo/issues/925))

- AI mentor not responding ([#970](https://github.com/Selleo/mentingo/issues/970))

### Chores:

- simplify project delivery by removing redundant files ([#1001](https://github.com/Selleo/mentingo/issues/1001))

### Code Refactoring:

- improve student deletion system ([#828](https://github.com/Selleo/mentingo/issues/828))

- certificates components ([#950](https://github.com/Selleo/mentingo/issues/950))

### Documentation:

- update changelog for version v3.22.0

- update documentation to clarify contributing to project ([#937](https://github.com/Selleo/mentingo/issues/937))

<a name="v3.21.0"></a>

## [v3.21.0] - 19.11.2025

### Features:

- add prompt management to tailor AI mentor's conversations to various needs ([#897](https://github.com/Selleo/mentingo/issues/897))

- improve selecting range of records in a table by holding shift button ([#913](https://github.com/Selleo/mentingo/issues/913))

- added emoji picker in ai mentor ([#912](https://github.com/Selleo/mentingo/issues/912))

- added evaluators and scores to langfuse ([#866](https://github.com/Selleo/mentingo/issues/866))

- enhance range of email notification triggers ([#822](https://github.com/Selleo/mentingo/issues/822))

- create script for easier local setup ([#917](https://github.com/Selleo/mentingo/issues/917))

### Bug Fixes:

- Tabs hidden from unregistered user ([#927](https://github.com/Selleo/mentingo/issues/927))

- added missing compose file ([#959](https://github.com/Selleo/mentingo/issues/959))

- broken sending message to AI mentor with return key ([#945](https://github.com/Selleo/mentingo/issues/945))

- simplify navigation by removing back button ([#946](https://github.com/Selleo/mentingo/issues/946))

- release command to work as it should ([#947](https://github.com/Selleo/mentingo/issues/947))

- improve platform quality by fixing E2E test configuration ([#949](https://github.com/Selleo/mentingo/issues/949))

- users unable to skip onboarding ([#885](https://github.com/Selleo/mentingo/issues/885))

- sorting in course statistics shows incorrect results ([#881](https://github.com/Selleo/mentingo/issues/881))

- incorrect display of course description in continue learning section ([#892](https://github.com/Selleo/mentingo/issues/892))

### Chores:

- added datasets for ai mentor ([#905](https://github.com/Selleo/mentingo/issues/905))

- adjust deployment process to include staging step

### Code Refactoring:

- make Stripe an optional service ([#872](https://github.com/Selleo/mentingo/issues/872))

### Documentation:

- update changelog for version v3.21.0

<a name="v3.20.0"></a>

## [v3.20.0] - 12.11.2025

### Features:

- Made ai mentor user message have profile picture ([#904](https://github.com/Selleo/mentingo/issues/904))

- simplify navigating in course list for admin ([#850](https://github.com/Selleo/mentingo/issues/850))

- quiz results preview mode for admin ([#846](https://github.com/Selleo/mentingo/issues/846))

### Bug Fixes:

- newly created admin doesnt get notification about his own registration ([#906](https://github.com/Selleo/mentingo/issues/906))

- fixed translations ([#903](https://github.com/Selleo/mentingo/issues/903))

- users not being able to change settings, because of validation errors ([#902](https://github.com/Selleo/mentingo/issues/902))

- payment modal not opening on enroll click ([#894](https://github.com/Selleo/mentingo/issues/894))

- added translations to freemium lessons ([#889](https://github.com/Selleo/mentingo/issues/889))

- fixed openai provider retrieval in file attach ([#887](https://github.com/Selleo/mentingo/issues/887))

- move profile page route ([#863](https://github.com/Selleo/mentingo/issues/863))

### Chores:

- update pull request template for clarity ([#893](https://github.com/Selleo/mentingo/issues/893))

- simplify local setup by introducing MinIO service ([#879](https://github.com/Selleo/mentingo/issues/879))

- update workflow files for deployment consistency after sentry changes ([#868](https://github.com/Selleo/mentingo/issues/868))

### Code Refactoring:

- made ai mentor input resize based on content ([#895](https://github.com/Selleo/mentingo/issues/895))

- removed certificate options and made preview on click ([#890](https://github.com/Selleo/mentingo/issues/890))

### Documentation:

- update changelog for version v3.20.0

<a name="v3.19.1"></a>

## [v3.19.1] - 06.11.2025

### Features:

- course statistics about AI mentor lessons for admin ([#844](https://github.com/Selleo/mentingo/issues/844))

- add students quiz results table in admin course view ([#843](https://github.com/Selleo/mentingo/issues/843))

### Bug Fixes:

- bold styling mismatch in lesson editor and lesson view ([#860](https://github.com/Selleo/mentingo/issues/860))

### Chores:

- increase character limits for course titles and descriptions ([#853](https://github.com/Selleo/mentingo/issues/853))

### Documentation:

- update changelog for version v3.19.1

<a name="v3.19.0"></a>

## [v3.19.0] - 01.11.2025

### Features:

- add inline category creation form and update category selection in course settings and add course view ([#855](https://github.com/Selleo/mentingo/issues/855))

- added language toggle to certificates ([#849](https://github.com/Selleo/mentingo/issues/849))

- course statistics about students progress for admin ([#834](https://github.com/Selleo/mentingo/issues/834))

- set default interface language according to browser settings ([#814](https://github.com/Selleo/mentingo/issues/814))

### Bug Fixes:

- Empty sections in content creator profile are hidden ([#873](https://github.com/Selleo/mentingo/issues/873))

- separated langfuse compose to separate file ([#864](https://github.com/Selleo/mentingo/issues/864))

- invalidation on logout ([#857](https://github.com/Selleo/mentingo/issues/857))

- failing tests after user onboarding feature ([#856](https://github.com/Selleo/mentingo/issues/856))

- fixed flickering logo ([#847](https://github.com/Selleo/mentingo/issues/847))

- fixed lesson status on completion ([#845](https://github.com/Selleo/mentingo/issues/845))

- allow admin to see all statistics regardless of the course creator ([#796](https://github.com/Selleo/mentingo/issues/796))

- getting back from course preview to course edit via back button ([#781](https://github.com/Selleo/mentingo/issues/781))

- archiving users should block their access to the platform ([#741](https://github.com/Selleo/mentingo/issues/741))

- use companyShortName instead of companyName in global search ([#842](https://github.com/Selleo/mentingo/issues/842))

### Chores:

- translate statuses to polish on courses page ([#861](https://github.com/Selleo/mentingo/issues/861))

### Documentation:

- update changelog for version v3.19.0

- update api .env.example ([#848](https://github.com/Selleo/mentingo/issues/848))

<a name="v3.18.0"></a>

## [v3.18.0] - 01.11.2025

### Features:

- implemented various types of AI mentor conversation ([#801](https://github.com/Selleo/mentingo/issues/801))

### Bug Fixes:

- Empty sections in content creator profile are hidden

### Documentation:

- update changelog for version v3.18.0

### Tests:

- sentry config ([#862](https://github.com/Selleo/mentingo/issues/862))

<a name="v3.17.0"></a>

## [v3.17.0] - 27.10.2025

### Features:

- implement student onboarding guides ([#820](https://github.com/Selleo/mentingo/issues/820))

- add course statistics overview for admin ([#813](https://github.com/Selleo/mentingo/issues/813))

### Bug Fixes:

- allow author to preview private/draft courses ([#818](https://github.com/Selleo/mentingo/issues/818))

### Documentation:

- update changelog for version v3.17.0

<a name="v3.16.0"></a>

## [v3.16.0] - 26.10.2025

### Features:

- Added markdown to ai mentor ([#803](https://github.com/Selleo/mentingo/issues/803))

- add tabs in course view and certificate modal instead of displayed certificate ([#812](https://github.com/Selleo/mentingo/issues/812))

- Implemented system for ai mentor evaluation ([#788](https://github.com/Selleo/mentingo/issues/788))

- update logo in unregistered view ([#810](https://github.com/Selleo/mentingo/issues/810))

### Bug Fixes:

- users import failing when empty record provided ([#808](https://github.com/Selleo/mentingo/issues/808))

### Chores:

- separated langfuse docker instance ([#829](https://github.com/Selleo/mentingo/issues/829))

### Documentation:

- update changelog for version v3.16.0

- update deployment docs ([#823](https://github.com/Selleo/mentingo/issues/823))

<a name="v3.15.0"></a>

## [v3.15.0] - 19.10.2025

### Features:

- adjust fonts to figma designs ([#806](https://github.com/Selleo/mentingo/issues/806))

- add bulk archive users option ([#774](https://github.com/Selleo/mentingo/issues/774))

### Bug Fixes:

- adjust sidebar navigation breakpoints ([#782](https://github.com/Selleo/mentingo/issues/782))

### Documentation:

- update changelog for version v3.15.0

### Tests:

- add e2e tests for groups ([#791](https://github.com/Selleo/mentingo/issues/791))

- add e2e tests for certificates ([#786](https://github.com/Selleo/mentingo/issues/786))

<a name="v3.14.1"></a>

## [v3.14.1] - 16.10.2025

### Features:

- redirect user to desired path after login ([#785](https://github.com/Selleo/mentingo/issues/785))

- customize font contrast color ([#777](https://github.com/Selleo/mentingo/issues/777))

- display text when there are no new announcements ([#779](https://github.com/Selleo/mentingo/issues/779))

### Bug Fixes:

- users import failing when email is provided as a link ([#802](https://github.com/Selleo/mentingo/issues/802))

- generate missing migration for contrast color using drizzle ([#795](https://github.com/Selleo/mentingo/issues/795))

- install multer module so apps can be properly served ([#794](https://github.com/Selleo/mentingo/issues/794))

- fix flickering logo ([#778](https://github.com/Selleo/mentingo/issues/778))

### Chores:

- removed posthog keys from env manager ([#798](https://github.com/Selleo/mentingo/issues/798))

- update create user tokens to expire after a year ([#789](https://github.com/Selleo/mentingo/issues/789))

- extend iframe load time to 30 secs ([#792](https://github.com/Selleo/mentingo/issues/792))

### Code Refactoring:

- refactor profile avatars ([#750](https://github.com/Selleo/mentingo/issues/750))

### Documentation:

- update changelog for version v3.14.1

- update changelog for version v3.13.0

<a name="v3.14.0"></a>

## [v3.14.0] - 15.10.2025

### Features:

- add ability to crop your avatar

### Bug Fixes:

- fix vite config

- fix web e2e tests

- fix not being able to crop uploaded avatar if you dont already have one

- make avatar preview square

### Chores:

- remove leftover console logs

### Code Refactoring:

- refactor file validation in api and image crop resizing in app

### Documentation:

- update changelog for version v3.14.0

<a name="v3.13.0"></a>

## [v3.13.0] - 14.10.2025

### Chores:

- update create user tokens to expire after a year ([#789](https://github.com/Selleo/mentingo/issues/789))

- extend iframe load time to 30 secs ([#792](https://github.com/Selleo/mentingo/issues/792))

### Documentation:

- update changelog for version v3.13.0

<a name="v3.12.0"></a>

## [v3.12.0] - 13.10.2025

### Documentation:

- update changelog for version v3.12.0

### Styles:

- adjust sidebar design ([#766](https://github.com/Selleo/mentingo/issues/766))

<a name="v3.11.0"></a>

## [v3.11.0] - 13.10.2025

### Features:

- collect number of page views using posthog ([#752](https://github.com/Selleo/mentingo/issues/752))

### Bug Fixes:

- adjust font color ([#753](https://github.com/Selleo/mentingo/issues/753))

- implemented callback url config and replaced usages ([#768](https://github.com/Selleo/mentingo/issues/768))

- fixed tests, types and translation ([#770](https://github.com/Selleo/mentingo/issues/770))

### Documentation:

- update changelog for version v3.11.0

<a name="v3.10.0"></a>

## [v3.10.0] - 13.10.2025

### Features:

- login background upload ([#747](https://github.com/Selleo/mentingo/issues/747))

- add filtering students by group in enrolled tab ([#742](https://github.com/Selleo/mentingo/issues/742))

### Bug Fixes:

- fix input losing focus while typing ([#749](https://github.com/Selleo/mentingo/issues/749))

- set default filter in course list ([#740](https://github.com/Selleo/mentingo/issues/740))

### Chores:

- added frontend and backend tests for env manager ([#759](https://github.com/Selleo/mentingo/issues/759))

- implemented e2e tests for env manager ([#760](https://github.com/Selleo/mentingo/issues/760))

- adjust gap fills and fill in the blanks creation to be more intuitive ([#707](https://github.com/Selleo/mentingo/issues/707))

- update changelog groups order ([#751](https://github.com/Selleo/mentingo/issues/751))

- add e2e run on merge me label ([#765](https://github.com/Selleo/mentingo/issues/765))

### Documentation:

- update changelog for version v3.10.0

- update installation in readme ([#748](https://github.com/Selleo/mentingo/issues/748))

### Tests:

- add announcements controller in e2e tests ([#758](https://github.com/Selleo/mentingo/issues/758))

- add unit test for remaining api utils ([#738](https://github.com/Selleo/mentingo/issues/738))

<a name="v3.8.2"></a>

## [v3.8.2] - 09.10.2025

### Bug Fixes:

- google oauth on all instances and update slack envs to be editable ([#755](https://github.com/Selleo/mentingo/issues/755))

### Documentation:

- update changelog for version v3.8.2

<a name="v3.8.1"></a>

## [v3.8.1] - 07.10.2025

### Bug Fixes:

- learn deploy workflow missing env ([#739](https://github.com/Selleo/mentingo/issues/739))

### Documentation:

- update changelog for version v3.8.1

<a name="v3.9.0"></a>

## [v3.9.0] - 06.10.2025

### Features:

- added settings to allow invite only registration ([#714](https://github.com/Selleo/mentingo/issues/714))

- allow creating category from course level ([#726](https://github.com/Selleo/mentingo/issues/726))

- Implemented Env Config Page to edit env's via platform ([#708](https://github.com/Selleo/mentingo/issues/708))

- implement global search functionality ([#717](https://github.com/Selleo/mentingo/issues/717))

### Bug Fixes:

- e2e tests ([#737](https://github.com/Selleo/mentingo/issues/737))

- add checks if category already exists and return a meaningful error ([#729](https://github.com/Selleo/mentingo/issues/729))

- show course overview for unregistered user if global setting is enabled ([#727](https://github.com/Selleo/mentingo/issues/727))

- add redirect from auth page if user is logged in ([#712](https://github.com/Selleo/mentingo/issues/712))

- editor initial height ([#701](https://github.com/Selleo/mentingo/issues/701))

### Code Refactoring:

- day streak translations ([#734](https://github.com/Selleo/mentingo/issues/734))

### Documentation:

- update changelog for version v3.9.0

### Tests:

- add config validator unit tests ([#720](https://github.com/Selleo/mentingo/issues/720))

- verify quiz access rules for attempts and cooldown ([#716](https://github.com/Selleo/mentingo/issues/716))

<a name="v3.8.0"></a>

## [v3.8.0] - 03.10.2025

### Features:

- create embed lesson type ([#705](https://github.com/Selleo/mentingo/issues/705))

### Bug Fixes:

- sso redirect on login to use current url ([#706](https://github.com/Selleo/mentingo/issues/706))

### Documentation:

- update changelog for version v3.8.0

<a name="v3.7.0"></a>

## [v3.7.0] - 29.09.2025

### Features:

- improve inserting links in rich text editor ([#684](https://github.com/Selleo/mentingo/issues/684))

- change max letter value in input, create better ux for error ha… ([#466](https://github.com/Selleo/mentingo/issues/466))

- implement slack authentication ([#686](https://github.com/Selleo/mentingo/issues/686))

### Bug Fixes:

- fixed platform logo for certificates and unified background image rendering ([#681](https://github.com/Selleo/mentingo/issues/681))

- fixed redirect on course edit mode ([#682](https://github.com/Selleo/mentingo/issues/682))

- logout with mfa enabled triggering infinite loader ([#698](https://github.com/Selleo/mentingo/issues/698))

### Chores:

- add stripe to create course seeds ([#699](https://github.com/Selleo/mentingo/issues/699))

- update github workflows to fix version mismatch ([#697](https://github.com/Selleo/mentingo/issues/697))

### Documentation:

- update changelog for version v3.7.0

<a name="v3.6.0"></a>

## [v3.6.0] - 26.09.2025

### Bug Fixes:

- added path to cookie deletion ([#690](https://github.com/Selleo/mentingo/issues/690))

- login using providers on deployed apps ([#692](https://github.com/Selleo/mentingo/issues/692))

- version generation on deploy to client instances ([#691](https://github.com/Selleo/mentingo/issues/691))

### Documentation:

- update changelog for version v3.6.0

<a name="v3.5.0"></a>

## [v3.5.0] - 24.09.2025

### Features:

- allow admin to change currency of course price ([#659](https://github.com/Selleo/mentingo/issues/659))

- users import from excel files ([#650](https://github.com/Selleo/mentingo/issues/650))

- added rag infrastracture with variable document removal and integration with ai mentor ([#670](https://github.com/Selleo/mentingo/issues/670))

- enhance course description handling with rich text ([#671](https://github.com/Selleo/mentingo/issues/671))

- add promo codes ([#649](https://github.com/Selleo/mentingo/issues/649))

- implement platform logo upload functionality ([#578](https://github.com/Selleo/mentingo/issues/578))

- add workflows for demo ([#652](https://github.com/Selleo/mentingo/issues/652))

- add announcements ([#637](https://github.com/Selleo/mentingo/issues/637))

### Bug Fixes:

- first chapter opens on order change ([#665](https://github.com/Selleo/mentingo/issues/665))

- user being logged out after short period of time ([#676](https://github.com/Selleo/mentingo/issues/676))

- app crash on /courses url enter ([#666](https://github.com/Selleo/mentingo/issues/666))

- dnd item moving back when refetching current display order ([#657](https://github.com/Selleo/mentingo/issues/657))

- enrolling to course on successful payment ([#655](https://github.com/Selleo/mentingo/issues/655))

- Downloading certificates in PDF ([#653](https://github.com/Selleo/mentingo/issues/653))

- Incorrect behavior when combining SSO with MFA login ([#647](https://github.com/Selleo/mentingo/issues/647))

### Chores:

- delete no new announcement popup ([#662](https://github.com/Selleo/mentingo/issues/662))

- adjust makefile release for tag releases ([#642](https://github.com/Selleo/mentingo/issues/642))

### Documentation:

- update changelog for version v3.5.0

- update changelog for version learn-v2025.09.16

<a name="v3.4.0"></a>

## [v3.4.0] - 16.09.2025

### Features:

- implement admin notifications about finished course ([#630](https://github.com/Selleo/mentingo/issues/630))

### Bug Fixes:

- archiving user and change default filter to archived user ([#643](https://github.com/Selleo/mentingo/issues/643))

### Documentation:

- update changelog for version v3.4.0

<a name="v3.3.0"></a>

## [v3.3.0] - 16.09.2025

### Features:

- generate certificates ([#538](https://github.com/Selleo/mentingo/issues/538))

### Bug Fixes:

- failing api tests and api e2e tests

- mfa after sso login

- add fetch depth of 0 to deploy ([#645](https://github.com/Selleo/mentingo/issues/645))

- add fetching tags on deploy to save version in file ([#644](https://github.com/Selleo/mentingo/issues/644))

### Documentation:

- update changelog for version v3.3.0

- update changelog for version learn-v2025.09.12

<a name="v3.2.1"></a>

## [v3.2.1] - 12.09.2025

### Features:

- add beta badges to ai mentor lesson ([#631](https://github.com/Selleo/mentingo/issues/631))

### Bug Fixes:

- add no verify on tag push ([#641](https://github.com/Selleo/mentingo/issues/641))

- automatic changelog generation and version saving ([#640](https://github.com/Selleo/mentingo/issues/640))

- block 403 when the admin has finished video ([#617](https://github.com/Selleo/mentingo/issues/617))

- s3 config being prioritized over aws in storage setup ([#632](https://github.com/Selleo/mentingo/issues/632))

- cancel on global settings query when logging out ([#633](https://github.com/Selleo/mentingo/issues/633))

- invalidate data after successful log out ([#634](https://github.com/Selleo/mentingo/issues/634))

### Chores:

- Drop unused demo ([#628](https://github.com/Selleo/mentingo/issues/628))

### Documentation:

- update changelog for version v3.2.1

<a name="v3.2.0"></a>

## [v3.2.0] - 12.09.2025

### Features:

- automate changelog generation and display of app version ([#638](https://github.com/Selleo/mentingo/issues/638))

- implement mfa enforcement ([#607](https://github.com/Selleo/mentingo/issues/607))

- implement mfa ([#583](https://github.com/Selleo/mentingo/issues/583))

- deployment guide ([#635](https://github.com/Selleo/mentingo/issues/635))

- add breadcrumbs to all views ([#605](https://github.com/Selleo/mentingo/issues/605))

- Adjust Course View ([#574](https://github.com/Selleo/mentingo/issues/574))

- Front-end for Provider Information section ([#550](https://github.com/Selleo/mentingo/issues/550))

- Add validation for user deletion based on quiz attempts ([#576](https://github.com/Selleo/mentingo/issues/576))

- implement sso enforcement ([#568](https://github.com/Selleo/mentingo/issues/568))

- Add company information settings for admin users ([#547](https://github.com/Selleo/mentingo/issues/547))

- [BE] Ability to customize platform logo ([#566](https://github.com/Selleo/mentingo/issues/566))

- Add setting to allow unregistered access ([#553](https://github.com/Selleo/mentingo/issues/553))

- Added assigning users to groups ([#556](https://github.com/Selleo/mentingo/issues/556))

- Created AI Mentor Lesson Preview Mode ([#571](https://github.com/Selleo/mentingo/issues/571))

- Quiz passing threshold ([#548](https://github.com/Selleo/mentingo/issues/548))

- added e2e tests for editing data in profile page ([#567](https://github.com/Selleo/mentingo/issues/567))

- added ai mentor student interaction ([#542](https://github.com/Selleo/mentingo/issues/542))

- enhance user profile handling with profile picture URLs in every place ([#562](https://github.com/Selleo/mentingo/issues/562))

- implement microsoft sso ([#539](https://github.com/Selleo/mentingo/issues/539))

- Email Notifications About New Users ([#535](https://github.com/Selleo/mentingo/issues/535))

- implement google sso ([#532](https://github.com/Selleo/mentingo/issues/532))

- Enforce Strong Password Policy ([#520](https://github.com/Selleo/mentingo/issues/520))

- implement avatar change ([#522](https://github.com/Selleo/mentingo/issues/522))

- Limit account creation reminders to 3 ([#537](https://github.com/Selleo/mentingo/issues/537))

- Added create ai mentor lesson type ([#519](https://github.com/Selleo/mentingo/issues/519))

- added group characteristics and implemented new design ([#515](https://github.com/Selleo/mentingo/issues/515))

- add user profile update functionality ([#518](https://github.com/Selleo/mentingo/issues/518))

- Add breadcrumbs to each view ([#495](https://github.com/Selleo/mentingo/issues/495))

- implement ability to change UI language ([#497](https://github.com/Selleo/mentingo/issues/497))

- added msw handler for profile page tests ([#504](https://github.com/Selleo/mentingo/issues/504))

- information about default user accounts and naming conventions for branches, commits, and pull requests ([#475](https://github.com/Selleo/mentingo/issues/475))

- student groups ([#453](https://github.com/Selleo/mentingo/issues/453))

- [FE] view for enrolling students to a course by admin ([#449](https://github.com/Selleo/mentingo/issues/449))

- roles translations added to layout, teacher translation changed to content creator ([#448](https://github.com/Selleo/mentingo/issues/448))

- Demo1 ([#431](https://github.com/Selleo/mentingo/issues/431))

### Bug Fixes:

- translations in fill in the blanks ([#629](https://github.com/Selleo/mentingo/issues/629))

- fixed translation in e2e data ([#604](https://github.com/Selleo/mentingo/issues/604))

- fixed query invalidation on freemium status update ([#602](https://github.com/Selleo/mentingo/issues/602))

- seed-prod script so everything works on new instances ([#603](https://github.com/Selleo/mentingo/issues/603))

- added possibility to play chapter in freemium lessons without enrollment and fixed bugs ([#598](https://github.com/Selleo/mentingo/issues/598))

- flaky tests ([#588](https://github.com/Selleo/mentingo/issues/588))

- failing e2e tests ([#585](https://github.com/Selleo/mentingo/issues/585))

- student navigation through lessons e2e test fix ([#581](https://github.com/Selleo/mentingo/issues/581))

- Improve lesson view responsive design ([#570](https://github.com/Selleo/mentingo/issues/570))

- Fix unproper type on useUserSettings hook ([#564](https://github.com/Selleo/mentingo/issues/564))

- translation key in profile page ([#565](https://github.com/Selleo/mentingo/issues/565))

- fixed free text crash and translations ([#563](https://github.com/Selleo/mentingo/issues/563))

- update password creation button text and remove error display ([#555](https://github.com/Selleo/mentingo/issues/555))

- add missing translations in student course view ([#456](https://github.com/Selleo/mentingo/issues/456))

- fixed translations ([#545](https://github.com/Selleo/mentingo/issues/545))

- made lesson container scrollable ([#543](https://github.com/Selleo/mentingo/issues/543))

- Fixed translation for content creator role not displaying in users ([#511](https://github.com/Selleo/mentingo/issues/511))

- Add roles and verifications to course editing ([#521](https://github.com/Selleo/mentingo/issues/521))

- enrolling student by admin ([#536](https://github.com/Selleo/mentingo/issues/536))

- Add missing translations and improve pie chart and charttooltips ([#496](https://github.com/Selleo/mentingo/issues/496))

- now freemium toggle doesn't cause reopening ([#499](https://github.com/Selleo/mentingo/issues/499))

- fixed selection on filtering in all lists with checkboxes ([#507](https://github.com/Selleo/mentingo/issues/507))

- remove translation of trueOrFalseRequired, trueorFalseChoice because this is not in code ([#505](https://github.com/Selleo/mentingo/issues/505))

- Assignined students, course, user, course categories list - statuses and data are not refreshed [#487](https://github.com/Selleo/mentingo/issues/487) ([#503](https://github.com/Selleo/mentingo/issues/503))

- fixed secondary styling for share button ([#493](https://github.com/Selleo/mentingo/issues/493))

- Update Profile URL and Navigation Text ([#510](https://github.com/Selleo/mentingo/issues/510))

- Removed unnecessary sections in profile for student and fixed undefined in breadcrumbs ([#480](https://github.com/Selleo/mentingo/issues/480))

- Implement profile view permissions ([#491](https://github.com/Selleo/mentingo/issues/491))

- missing translation in course controller api ([#481](https://github.com/Selleo/mentingo/issues/481))

- add queryclient to mutation for nagivgating user correctly ([#485](https://github.com/Selleo/mentingo/issues/485))

- Fix missing lessons translation ([#479](https://github.com/Selleo/mentingo/issues/479))

- add missing colon to translation ([#439](https://github.com/Selleo/mentingo/issues/439))

- multiword fillers in quiz now count as valid ([#446](https://github.com/Selleo/mentingo/issues/446))

- improve translations for buyfor and freemium ([#447](https://github.com/Selleo/mentingo/issues/447))

- lesson is not refreshed when switching between lessons ([#444](https://github.com/Selleo/mentingo/issues/444))

- improve confusing translation in confirmation modal ([#433](https://github.com/Selleo/mentingo/issues/433))

### Chores:

- added e2e tests for enrolling students to freemium lessons ([#606](https://github.com/Selleo/mentingo/issues/606))

- E2E tests for admin student flow when assigning students to courses ([#595](https://github.com/Selleo/mentingo/issues/595))

- improved course deletion error message ([#599](https://github.com/Selleo/mentingo/issues/599))

- update staging workflow to use github secrets for SSO ([#587](https://github.com/Selleo/mentingo/issues/587))

- created e2e tests for language switching and group crud ([#582](https://github.com/Selleo/mentingo/issues/582))

- created tests for ai repository and fixed ai mentor lesson design ([#580](https://github.com/Selleo/mentingo/issues/580))

- fine-tuned hyperparameters and system prompt for ai mentor and ai judge ([#577](https://github.com/Selleo/mentingo/issues/577))

- added forcepathstyle and everything seems to work fine ([#561](https://github.com/Selleo/mentingo/issues/561))

- change optional stripe module logic ([#454](https://github.com/Selleo/mentingo/issues/454))

- update s3 config ([#443](https://github.com/Selleo/mentingo/issues/443))

- make stripe module optional ([#441](https://github.com/Selleo/mentingo/issues/441))

- update translation and description column in lessons ([#437](https://github.com/Selleo/mentingo/issues/437))

- add hyperlinks to text editor ([#435](https://github.com/Selleo/mentingo/issues/435))

- increase file size upload limit ([#432](https://github.com/Selleo/mentingo/issues/432))

### Code Refactoring:

- clean up student and content creator profile according to design ([#508](https://github.com/Selleo/mentingo/issues/508))

- change h-_ w-_ classes to size-\* when the element is square ([#498](https://github.com/Selleo/mentingo/issues/498))

- rename teacher to content creator and migrate roles in database ([#484](https://github.com/Selleo/mentingo/issues/484))

### Documentation:

- update README.md with current available accounts ([#494](https://github.com/Selleo/mentingo/issues/494))

- update readme with improved features description ([#434](https://github.com/Selleo/mentingo/issues/434))

###

Also add admin notification when setting password.

- feat(settings): add user settings integration and admin notification toggle

* Rename AdminSettings to UserSettings and make fields optional
* Add settings to user schema and ensure settings are included in user responses
* Implement admin notification toggle endpoint and service method
* Update tests and factories to include default settings

- refactor(settings): consolidate default settings and remove unused schemas

* Add DEFAULT_USER_SETTINGS and DEFAULT_USER_ADMIN_SETTINGS constants
* Remove unused settings schemas and types
* Update tests and factories to use default settings constants
* Remove redundant POST endpoint for settings creation
* Fix admin notification endpoint decorator order

- fix(migrations): fix unproper migrations order

- refactor: clean up code and improve settings handling

* Simplify object property shorthand in email service
* Remove empty constructor spacing in settings service
* Clean up route decorators in settings controller
* Add default settings insertion during user seeding
* Remove redundant ensureUserSettings method in auth service

- refactor(settings): change admin_new_user_notification to camelCase

- feat(admin): add notification preferences for new users

Add admin notification settings panel with toggle for new user notifications
Introduce Switch component from radix-ui for toggle functionality
Extend user settings type to include admin preferences
Add API endpoint and mutation for updating notification preferences

- feat(settings): add default settings seeding and migration

Add migration to seed default settings for existing users and use DEFAULT_USER_SETTINGS constant in auth service

- refactor(auth): move new user notification to settings service

Move the notifyAdminsAboutNewUser functionality from AuthService to SettingsService

- refactor(settings): restructure user settings handling and remove default values

* move adminNewUserNotification in UserSettings type
* update settings controller to return BaseResponse
* update frontend to use improved settings functionality
* clean up unused test files and migrations
  -fix the majority of issues based on mentor's suggestions

- test(helpers): extract cookie generation logic to helper function

Refactor test files to use new cookieFor helper instead of duplicate login requests

- feat(user): add event-based admin notifications for new users and password creation

implement UserRegisteredEvent and UserPasswordCreatedEvent to handle notifications
replace direct admin notification calls with event publishing in auth service
add NotifyAdminsHandler to process new user events and send emails
update modules to support new event handlers and exports

- feat(settings): refactor settings service and schema for role-based defaults

* split settings schema into admin and student specific types
* add default settings based on user role
* move admin notification logic to user service
* update settings creation to use role-based defaults

- fix(settings): make language and admin notification fields required by deleting optionals from settings.schema.ts

- fix(migrations): fix migrations after rebase

- feat(settings): improve settings handling and schema structure

* Add default settings entry for NULL user_id in migrations
* Remove debug console.log from web settings page
* Refactor settings schemas to separate admin and student settings
* Update settings service to use raw SQL for JSON operations
* Implement proper JSON handling in seed script

- fix(settings): fix e2e settings tests

- fix(settings): remove try-catch blocks in settings service and controller

- refactor(settings): change HTTP method from PATCH to PUT for settings update

Replace manual JSON stringification with settingsToJsonBuildObject utility
Update tests and swagger schema to reflect the HTTP method change

- fix: fix after rebase

- fix(user): handle UserPasswordCreatedEvent in notify-admins handler

Extend NotifyAdminsHandler to support both UserRegisteredEvent and UserPasswordCreatedEvent for admin notifications

- refactor(settings): restructure settings types and update related code

* Split UserSettings into base and admin-specific types
* Update schema and tests to use new AllSettings type

- refactor(settings): extract default settings to constants for better maintainability

<a name="v3.1.0"></a>

## [v3.1.0] - 10.03.2025

### Features:

- Fix deploy ([#423](https://github.com/Selleo/mentingo/issues/423))

- lc 604 sentry integration ([#420](https://github.com/Selleo/mentingo/issues/420))

- add missing validation in text lesson ([#404](https://github.com/Selleo/mentingo/issues/404))

- Add sentry ([#421](https://github.com/Selleo/mentingo/issues/421))

- Deploy Learning HUB ([#417](https://github.com/Selleo/mentingo/issues/417))

- pnpm udpdate ([#412](https://github.com/Selleo/mentingo/issues/412))

- update pnpm ([#409](https://github.com/Selleo/mentingo/issues/409))

### Bug Fixes:

- add max length validation for description field with user feedback in NewLesson form ([#427](https://github.com/Selleo/mentingo/issues/427))

- enhance token refresh handling and add auth service ([#426](https://github.com/Selleo/mentingo/issues/426))

- reset password ([#419](https://github.com/Selleo/mentingo/issues/419))

- known app issues ([#418](https://github.com/Selleo/mentingo/issues/418))

- mailhog connection ([#408](https://github.com/Selleo/mentingo/issues/408))

### Chores:

- deploy update pnpm version ([#411](https://github.com/Selleo/mentingo/issues/411))

<a name="v3.0.6"></a>

## [v3.0.6] - 31.01.2025

### Features:

- test course endpoints ([#401](https://github.com/Selleo/mentingo/issues/401))

- add dev:test scripts for API, web, and reverse proxy, update E2E tests for better navigation and category verification ([#402](https://github.com/Selleo/mentingo/issues/402))

- add checklist support in RichText editor and viewer components ([#399](https://github.com/Selleo/mentingo/issues/399))

- student course workflow ([#398](https://github.com/Selleo/mentingo/issues/398))

- add test for admin settings and teacher edit chapter ([#400](https://github.com/Selleo/mentingo/issues/400))

- e2e course creation ([#396](https://github.com/Selleo/mentingo/issues/396))

- add test for adding questions ([#390](https://github.com/Selleo/mentingo/issues/390))

### Bug Fixes:

- update course e2e tests to rely on status messages ([#395](https://github.com/Selleo/mentingo/issues/395))

- remove photo question temporary ([#393](https://github.com/Selleo/mentingo/issues/393))

- e2e course creation ([#392](https://github.com/Selleo/mentingo/issues/392))

- remove fill in the blank from e2e temporary ([#391](https://github.com/Selleo/mentingo/issues/391))

### Code Refactoring:

- Course Preview + fixes ([#403](https://github.com/Selleo/mentingo/issues/403))

### Tests:

- course settings e2e test ([#394](https://github.com/Selleo/mentingo/issues/394))

<a name="v3.0.5"></a>

## [v3.0.5] - 17.01.2025

### Features:

- course creation e2e ([#386](https://github.com/Selleo/mentingo/issues/386))

- refactor next button disabled state ([#388](https://github.com/Selleo/mentingo/issues/388))

- add missing thumbnail, refactor course responses and missing user details ([#387](https://github.com/Selleo/mentingo/issues/387))

- batch of improvements after change db structure ([#380](https://github.com/Selleo/mentingo/issues/380))

### Bug Fixes:

- problem with dnd and order ([#374](https://github.com/Selleo/mentingo/issues/374))

- double progress bar ([#385](https://github.com/Selleo/mentingo/issues/385))

- Drag and drop reordering logic ([#376](https://github.com/Selleo/mentingo/issues/376))

- simplify file formats in upload components for consistency and clarity ([#384](https://github.com/Selleo/mentingo/issues/384))

- adjust CourseProgress for admin roles in sidebar ([#383](https://github.com/Selleo/mentingo/issues/383))

- lc-566 paid course price input ([#382](https://github.com/Selleo/mentingo/issues/382))

- improve ESLint rules and clean up unused imports in various components ([#381](https://github.com/Selleo/mentingo/issues/381))

- add validation and styles consistent ([#377](https://github.com/Selleo/mentingo/issues/377))

- local e2e config ([#378](https://github.com/Selleo/mentingo/issues/378))

### Chores:

- prettier config update ([#389](https://github.com/Selleo/mentingo/issues/389))

<a name="v3.0.4"></a>

## [v3.0.4] - 14.01.2025

### Chores:

- remove seed from production ([#375](https://github.com/Selleo/mentingo/issues/375))

<a name="v3.0.3"></a>

## [v3.0.3] - 14.01.2025

### Features:

- Validation for Quiz ([#373](https://github.com/Selleo/mentingo/issues/373))

- next chapter interaction ([#371](https://github.com/Selleo/mentingo/issues/371))

- refactor enroll to course ([#364](https://github.com/Selleo/mentingo/issues/364))

- i18n ([#360](https://github.com/Selleo/mentingo/issues/360))

- quiz evaluation improvements ([#357](https://github.com/Selleo/mentingo/issues/357))

- i18n ([#346](https://github.com/Selleo/mentingo/issues/346))

### Bug Fixes:

- restore previous checkbox version ([#372](https://github.com/Selleo/mentingo/issues/372))

- accordion problem ([#370](https://github.com/Selleo/mentingo/issues/370))

- visual fixes ([#369](https://github.com/Selleo/mentingo/issues/369))

- change chapter title ([#368](https://github.com/Selleo/mentingo/issues/368))

- update locales configuration for i18n ([#367](https://github.com/Selleo/mentingo/issues/367))

- image reupload

- course creation bug batch ([#362](https://github.com/Selleo/mentingo/issues/362))

- revert

- i18n ([#356](https://github.com/Selleo/mentingo/issues/356))

- update lesson sidebar to use lessonId and fetch course data dynamically ([#353](https://github.com/Selleo/mentingo/issues/353))

### Chores:

- add seed for production ([#354](https://github.com/Selleo/mentingo/issues/354))

### Code Refactoring:

- Batch of fixes ([#363](https://github.com/Selleo/mentingo/issues/363))

- Batch of fixes related to chapter view ([#361](https://github.com/Selleo/mentingo/issues/361))

- fix appearance of dropdown questions ([#355](https://github.com/Selleo/mentingo/issues/355))

### Documentation:

- update README ([#365](https://github.com/Selleo/mentingo/issues/365))

<a name="v3.0.2"></a>

## [v3.0.2] - 09.01.2025

### Features:

- update secrets for seed on production ([#352](https://github.com/Selleo/mentingo/issues/352))

<a name="v3.0.1"></a>

## [v3.0.1] - 09.01.2025

### Features:

- add seed for production ([#351](https://github.com/Selleo/mentingo/issues/351))

<a name="v3.0.0"></a>

## [v3.0.0] - 09.01.2025

### Features:

- update seed setup ([#349](https://github.com/Selleo/mentingo/issues/349))

- update seed and remove nextLessonChapterId ([#344](https://github.com/Selleo/mentingo/issues/344))

- improve student progress ([#337](https://github.com/Selleo/mentingo/issues/337))

- question answering improvements ([#333](https://github.com/Selleo/mentingo/issues/333))

- add isExternalUrl prop to Presentation component for handling external presentations ([#332](https://github.com/Selleo/mentingo/issues/332))

- Quiz lesson ([#329](https://github.com/Selleo/mentingo/issues/329))

- add isExternal flag to file lesson schema and related components for external content handling ([#328](https://github.com/Selleo/mentingo/issues/328))

- update lesson sidebar links to handle completed and not started statuses ([#325](https://github.com/Selleo/mentingo/issues/325))

- change lesson content navigation ([#324](https://github.com/Selleo/mentingo/issues/324))

- update statistics module ([#323](https://github.com/Selleo/mentingo/issues/323))

- answering on quiz ([#318](https://github.com/Selleo/mentingo/issues/318))

- update lesson navigation to handle first and last lesson states in Course ([#322](https://github.com/Selleo/mentingo/issues/322))

- add question scale type ([#321](https://github.com/Selleo/mentingo/issues/321))

- update CourseChapterLesson to use div instead of Link ([#320](https://github.com/Selleo/mentingo/issues/320))

- implement navigation to first not started lesson in CourseProgress component ([#319](https://github.com/Selleo/mentingo/issues/319))

- remove play button from CourseChapter component ([#317](https://github.com/Selleo/mentingo/issues/317))

- 519 question match words ([#316](https://github.com/Selleo/mentingo/issues/316))

- 517 secure form ([#315](https://github.com/Selleo/mentingo/issues/315))

- presentation lesson ([#313](https://github.com/Selleo/mentingo/issues/313))

- video lesson ([#311](https://github.com/Selleo/mentingo/issues/311))

- Lesson layout and lesson view ([#314](https://github.com/Selleo/mentingo/issues/314))

- 485 drag and drop ([#312](https://github.com/Selleo/mentingo/issues/312))

- lesson details and lesson progress ([#310](https://github.com/Selleo/mentingo/issues/310))

- integrate Chapter and Lesson modules into SCORM processing ([#302](https://github.com/Selleo/mentingo/issues/302))

- New Courses View ([#288](https://github.com/Selleo/mentingo/issues/288))

- adjustment user and auth module to new structure ([#301](https://github.com/Selleo/mentingo/issues/301))

- add confirmation modal ([#299](https://github.com/Selleo/mentingo/issues/299))

- automatically open chapter after adding a new one ([#295](https://github.com/Selleo/mentingo/issues/295))

- 445 quiz creation ([#291](https://github.com/Selleo/mentingo/issues/291))

- update seed, remove lorem ipsum elements on staging ([#293](https://github.com/Selleo/mentingo/issues/293))

- add SCORM course support with metadata retrieval and content serving ([#292](https://github.com/Selleo/mentingo/issues/292))

- connect create scorm form with be ([#289](https://github.com/Selleo/mentingo/issues/289))

- LC-430 scorm components ([#284](https://github.com/Selleo/mentingo/issues/284))

- add delete option for chapter and lesson ([#286](https://github.com/Selleo/mentingo/issues/286))

- remove unused hooks and pages ([#285](https://github.com/Selleo/mentingo/issues/285))

- update db structure ([#283](https://github.com/Selleo/mentingo/issues/283))

- implement SCORM upload and content serving functionality ([#281](https://github.com/Selleo/mentingo/issues/281))

- add chapter management ([#279](https://github.com/Selleo/mentingo/issues/279))

- add caching for api ([#277](https://github.com/Selleo/mentingo/issues/277))

- add model items count from table columns ([#278](https://github.com/Selleo/mentingo/issues/278))

- Enrollment Chart ([#273](https://github.com/Selleo/mentingo/issues/273))

- average score across all quizzes chart ([#272](https://github.com/Selleo/mentingo/issues/272))

- conversions after freemium lesson chart ([#269](https://github.com/Selleo/mentingo/issues/269))

- update seed, add teacher stats ([#271](https://github.com/Selleo/mentingo/issues/271))

- course completion percentage chart ([#267](https://github.com/Selleo/mentingo/issues/267))

- Five Most Popular Courses Chart ([#266](https://github.com/Selleo/mentingo/issues/266))

- batch of teacher statistics ([#265](https://github.com/Selleo/mentingo/issues/265))

- Layout for teacher dashboard ([#254](https://github.com/Selleo/mentingo/issues/254))

- new Dashboard Navigation ([#263](https://github.com/Selleo/mentingo/issues/263))

- courses completion for teacher statistics ([#258](https://github.com/Selleo/mentingo/issues/258))

- add most popular courses statistics ([#257](https://github.com/Selleo/mentingo/issues/257))

### Bug Fixes:

- repair test on web deployment ([#350](https://github.com/Selleo/mentingo/issues/350))

- course major fixes ([#348](https://github.com/Selleo/mentingo/issues/348))

- update AddCourse form to use fileUrl and thumbnailS3Key instead of imageUrl ([#342](https://github.com/Selleo/mentingo/issues/342))

- webserwer debug ([#340](https://github.com/Selleo/mentingo/issues/340))

- enable server reuse - enable debug ([#338](https://github.com/Selleo/mentingo/issues/338))

- bug batch

- problem with accordion and remove unused select ([#327](https://github.com/Selleo/mentingo/issues/327))

- thumbnail display ([#308](https://github.com/Selleo/mentingo/issues/308))

- splash screen ([#307](https://github.com/Selleo/mentingo/issues/307))

- caddy proxy update ([#306](https://github.com/Selleo/mentingo/issues/306))

- 490 curriculum styles ([#304](https://github.com/Selleo/mentingo/issues/304))

- get-student-courses endpoint ([#305](https://github.com/Selleo/mentingo/issues/305))

- chapter display order ([#303](https://github.com/Selleo/mentingo/issues/303))

- problem with options array ([#298](https://github.com/Selleo/mentingo/issues/298))

- add missing icon ([#296](https://github.com/Selleo/mentingo/issues/296))

- deployment ([#294](https://github.com/Selleo/mentingo/issues/294))

- filter course list for teacher ([#276](https://github.com/Selleo/mentingo/issues/276))

- update logout button selector ([#270](https://github.com/Selleo/mentingo/issues/270))

- remove sidebar from splashscreen ([#264](https://github.com/Selleo/mentingo/issues/264))

### Chores:

- enable next lesson ([#326](https://github.com/Selleo/mentingo/issues/326))

### Code Refactoring:

- Batch of Fill In The Blanks dnd improvements and bug fixes ([#347](https://github.com/Selleo/mentingo/issues/347))

- Merge navigation menus ([#343](https://github.com/Selleo/mentingo/issues/343))

- replace custom logic with react-hook-form ([#345](https://github.com/Selleo/mentingo/issues/345))

- update API client and playwright config for testing mode ([#339](https://github.com/Selleo/mentingo/issues/339))

- quiz Improvements and bug fixes ([#336](https://github.com/Selleo/mentingo/issues/336))

- unified e2e test on local and CI env ([#335](https://github.com/Selleo/mentingo/issues/335))

- remove unused files ([#331](https://github.com/Selleo/mentingo/issues/331))

- update API response types; remove deprecated question option queries and related mutations ([#330](https://github.com/Selleo/mentingo/issues/330))

- Apply QA feedback related to courses page ([#309](https://github.com/Selleo/mentingo/issues/309))

- update SCORM schemas and improve metadata handling in API responses ([#300](https://github.com/Selleo/mentingo/issues/300))

- add missing exports to svgs ([#297](https://github.com/Selleo/mentingo/issues/297))

- course creation flow adjustments ([#290](https://github.com/Selleo/mentingo/issues/290))

- Resolve bugs related to teacher page ([#287](https://github.com/Selleo/mentingo/issues/287))

- Batch of bugfixes ([#280](https://github.com/Selleo/mentingo/issues/280))

- change updateLessonItemCompletion function logic ([#274](https://github.com/Selleo/mentingo/issues/274))

- add profile tab to navigation and rename tutor components to teacher ([#275](https://github.com/Selleo/mentingo/issues/275))

<a name="v2.2.3"></a>

## [v2.2.3] - 28.11.2024

### Chores:

- update deploy API workflow to trigger on completion of web app deployment instead of on push events ([#262](https://github.com/Selleo/mentingo/issues/262))

<a name="v2.2.2"></a>

## [v2.2.2] - 28.11.2024

### Bug Fixes:

- refine conditional for Playwright tests workflow execution based on event type ([#260](https://github.com/Selleo/mentingo/issues/260))

### Chores:

- replace Playwright tests workflow reference and add production version ([#261](https://github.com/Selleo/mentingo/issues/261))

<a name="v2.2.1"></a>

## [v2.2.1] - 28.11.2024

### Bug Fixes:

- refine conditional for Playwright tests workflow execution based on event type

<a name="v2.2.0"></a>

## [v2.2.0] - 28.11.2024

### Features:

- add pricing and status view ([#253](https://github.com/Selleo/mentingo/issues/253))

- apply pr fedback, change string to constants ([#247](https://github.com/Selleo/mentingo/issues/247))

- Student Statistics Dashboard ([#234](https://github.com/Selleo/mentingo/issues/234))

- integrate Sentry for error tracking and performance monitoring in web app ([#245](https://github.com/Selleo/mentingo/issues/245))

- 321 completed lesson improvements ([#238](https://github.com/Selleo/mentingo/issues/238))

- implement LoginFixture for streamlined login/logout in e2e tests ([#236](https://github.com/Selleo/mentingo/issues/236))

- optimize video player import to use lazy loading in Video component ([#235](https://github.com/Selleo/mentingo/issues/235))

- backend logic to track statistics ([#233](https://github.com/Selleo/mentingo/issues/233))

- 361 allow to mark lessons in course as free ([#232](https://github.com/Selleo/mentingo/issues/232))

- add hints to every option in toolbar ([#229](https://github.com/Selleo/mentingo/issues/229))

- update teachers bio ([#227](https://github.com/Selleo/mentingo/issues/227))

- LC-330 limited admin panel for tutor ([#220](https://github.com/Selleo/mentingo/issues/220))

- check roles guard on endpoints ([#226](https://github.com/Selleo/mentingo/issues/226))

- tutor page ([#224](https://github.com/Selleo/mentingo/issues/224))

- lc-332 tutor courses endpoint ([#222](https://github.com/Selleo/mentingo/issues/222))

### Bug Fixes:

- set PLAYWRIGHT_BROWSERS_PATH for Playwright tests in workflow ([#259](https://github.com/Selleo/mentingo/issues/259))

- enable manual triggering for Playwright tests workflow ([#255](https://github.com/Selleo/mentingo/issues/255))

- playwright workflow ([#252](https://github.com/Selleo/mentingo/issues/252))

- Pages Layout and Dnd Blank and Word appearance ([#250](https://github.com/Selleo/mentingo/issues/250))

- Statistics page ([#251](https://github.com/Selleo/mentingo/issues/251))

- playwright workflow ([#249](https://github.com/Selleo/mentingo/issues/249))

- course test refactor ([#244](https://github.com/Selleo/mentingo/issues/244))

- simplify layout in Statistics components ([#246](https://github.com/Selleo/mentingo/issues/246))

- update condition for lesson answer ([#243](https://github.com/Selleo/mentingo/issues/243))

- test course ([#242](https://github.com/Selleo/mentingo/issues/242))

- add payment success check after completing purchase in course e2e tests ([#241](https://github.com/Selleo/mentingo/issues/241))

- course unenroll in test ([#240](https://github.com/Selleo/mentingo/issues/240))

- enhance quiz answer checks in e2e tests to verify input state and visibility of missing answers ([#239](https://github.com/Selleo/mentingo/issues/239))

- LC-345 create without image ([#231](https://github.com/Selleo/mentingo/issues/231))

- LC-346 course/lesson image display ([#230](https://github.com/Selleo/mentingo/issues/230))

- missing courseId in method ([#228](https://github.com/Selleo/mentingo/issues/228))

### Chores:

- run e2e tests during deployment ([#186](https://github.com/Selleo/mentingo/issues/186))

- update readme ([#215](https://github.com/Selleo/mentingo/issues/215))

### Tests:

- add E2E quiz lesson seed and update test implementations for course enrollment and payment validation ([#237](https://github.com/Selleo/mentingo/issues/237))

- LC-280 stripe tests ([#180](https://github.com/Selleo/mentingo/issues/180))

<a name="v2.1.2"></a>

## [v2.1.2] - 08.11.2024

### Features:

- add user details endpoint ([#216](https://github.com/Selleo/mentingo/issues/216))

### Bug Fixes:

- saving options for the question ([#225](https://github.com/Selleo/mentingo/issues/225))

### Chores:

- udpate deploy production config ([#221](https://github.com/Selleo/mentingo/issues/221))

### Code Refactoring:

- Quiz and dashboard appearance adjustments ([#223](https://github.com/Selleo/mentingo/issues/223))

<a name="v2.1.1"></a>

## [v2.1.1] - 08.11.2024

### Chores:

- add seed for production ([#219](https://github.com/Selleo/mentingo/issues/219))

<a name="v2.1.0"></a>

## [v2.1.0] - 07.11.2024

### Features:

- proper types for seeds ([#212](https://github.com/Selleo/mentingo/issues/212))

- implement Gravatar component for user avatars ([#214](https://github.com/Selleo/mentingo/issues/214))

- Show correct answer as a full text with bold keywords ([#210](https://github.com/Selleo/mentingo/issues/210))

- add fill in the blanks word template option to EditorToolbar.tsx ([#213](https://github.com/Selleo/mentingo/issues/213))

- disable dnd on completed quiz ([#209](https://github.com/Selleo/mentingo/issues/209))

### Chores:

- revert refactor seed directory ([#218](https://github.com/Selleo/mentingo/issues/218))

- add missing seed path ([#217](https://github.com/Selleo/mentingo/issues/217))

- prettier setup with code style fixes ([#211](https://github.com/Selleo/mentingo/issues/211))

### Code Refactoring:

- simplify error handling in queryClient retry function ([#208](https://github.com/Selleo/mentingo/issues/208))

### Styles:

- improve visibility and update conditional classes for TextBlank component ([#207](https://github.com/Selleo/mentingo/issues/207))

<a name="v2.0.0"></a>

## [v2.0.0] - 04.11.2024

### Features:

- update ses config ([#206](https://github.com/Selleo/mentingo/issues/206))

- blocking editing of lessons and questions with answers ([#203](https://github.com/Selleo/mentingo/issues/203))

- change condition in question answers for multimedia lesson ([#204](https://github.com/Selleo/mentingo/issues/204))

- evaluation fill in the blank questions ([#192](https://github.com/Selleo/mentingo/issues/192))

- richtext edior ([#198](https://github.com/Selleo/mentingo/issues/198))

- LC-290 resource filtering ([#194](https://github.com/Selleo/mentingo/issues/194))

### Bug Fixes:

- LC-313 logout fix ([#205](https://github.com/Selleo/mentingo/issues/205))

- admin bugs ([#201](https://github.com/Selleo/mentingo/issues/201))

### Code Refactoring:

- Use full page forms instead of modals ([#202](https://github.com/Selleo/mentingo/issues/202))

- Update seeds related to quiz and fill in the blanks ([#200](https://github.com/Selleo/mentingo/issues/200))

<a name="v1.1.1"></a>

## [v1.1.1] - 28.10.2024

### Chores:

- update deploy production path ([#197](https://github.com/Selleo/mentingo/issues/197))

- change deploy production trigger ([#196](https://github.com/Selleo/mentingo/issues/196))

<a name="v1.1.0"></a>

## [v1.1.0] - 28.10.2024

### Features:

- question item options ([#189](https://github.com/Selleo/mentingo/issues/189))

- Fill In The Blanks - dnd ([#187](https://github.com/Selleo/mentingo/issues/187))

- Batch of improvements ([#188](https://github.com/Selleo/mentingo/issues/188))

- new Fill In The Blanks question type ([#183](https://github.com/Selleo/mentingo/issues/183))

- Quiz lesson view ([#182](https://github.com/Selleo/mentingo/issues/182))

- implement role-based access control ([#181](https://github.com/Selleo/mentingo/issues/181))

- new admin - part 1 ([#179](https://github.com/Selleo/mentingo/issues/179))

### Bug Fixes:

- lesson summary styles ([#185](https://github.com/Selleo/mentingo/issues/185))

### Chores:

- remove adminjs ([#195](https://github.com/Selleo/mentingo/issues/195))

<a name="v1.0.0"></a>

## v1.0.0 - 15.10.2024

### Features:

- Responsive layout for student views ([#175](https://github.com/Selleo/mentingo/issues/175))

- Add currency ([#173](https://github.com/Selleo/mentingo/issues/173))

- update menu icon adminjs ([#174](https://github.com/Selleo/mentingo/issues/174))

- Lesson assignment drag and drop ([#169](https://github.com/Selleo/mentingo/issues/169))

- free courses without stripe form ([#168](https://github.com/Selleo/mentingo/issues/168))

- LC-263 stripe setup ([#165](https://github.com/Selleo/mentingo/issues/165))

- LC-273 course list ([#167](https://github.com/Selleo/mentingo/issues/167))

- Split Courses view into Available Courses and Your Courses ([#163](https://github.com/Selleo/mentingo/issues/163))

- Consistent progress for admin account ([#160](https://github.com/Selleo/mentingo/issues/160))

- Custom scrollbars ([#161](https://github.com/Selleo/mentingo/issues/161))

- Course card appearance adjustment ([#156](https://github.com/Selleo/mentingo/issues/156))

- develop firstName and lastName fields ([#157](https://github.com/Selleo/mentingo/issues/157))

- add tailwind-scrollbar package ([#158](https://github.com/Selleo/mentingo/issues/158))

- assign lesson item to lesson ([#159](https://github.com/Selleo/mentingo/issues/159))

- LC-239 course progress ([#152](https://github.com/Selleo/mentingo/issues/152))

- LC-228 lesson progress front ([#145](https://github.com/Selleo/mentingo/issues/145))

- display course preview based on assignment options ([#139](https://github.com/Selleo/mentingo/issues/139))

- add lesson_id to to completed lesson items ([#140](https://github.com/Selleo/mentingo/issues/140))

- add lessons component to course show ([#141](https://github.com/Selleo/mentingo/issues/141))

- improve lesson item completion handling ([#136](https://github.com/Selleo/mentingo/issues/136))

- LC-229 show user answers ([#133](https://github.com/Selleo/mentingo/issues/133))

- add Dashboard component for admin panel ([#138](https://github.com/Selleo/mentingo/issues/138))

- add desription to course list endpoint ([#121](https://github.com/Selleo/mentingo/issues/121))

- prepare api to return answers on questions ([#134](https://github.com/Selleo/mentingo/issues/134))

- prepare api to mark lesson items as done ([#131](https://github.com/Selleo/mentingo/issues/131))

- allow add file on create resource ([#130](https://github.com/Selleo/mentingo/issues/130))

- add answer on question endpoint ([#126](https://github.com/Selleo/mentingo/issues/126))

- improve dynamic file path determination in PhotoPreview component ([#123](https://github.com/Selleo/mentingo/issues/123))

- LC-224 add open question type ([#124](https://github.com/Selleo/mentingo/issues/124))

- add better seed for real looking course ([#116](https://github.com/Selleo/mentingo/issues/116))

- LC-204 add video preview ([#117](https://github.com/Selleo/mentingo/issues/117))

- LC-203 add presentation preview ([#114](https://github.com/Selleo/mentingo/issues/114))

- LC-129 enroll action ([#111](https://github.com/Selleo/mentingo/issues/111))

- LC-125 add lesson items layout ([#108](https://github.com/Selleo/mentingo/issues/108))

- LC-155 add course filtering ([#106](https://github.com/Selleo/mentingo/issues/106))

- LC-170 connect course view with api ([#105](https://github.com/Selleo/mentingo/issues/105))

- add enroll course endpoint ([#103](https://github.com/Selleo/mentingo/issues/103))

- add lesson detail endpoint ([#102](https://github.com/Selleo/mentingo/issues/102))

- add course endpoint ([#98](https://github.com/Selleo/mentingo/issues/98))

- LC-158 disallow tutors to create and update a user ([#99](https://github.com/Selleo/mentingo/issues/99))

- LC-169 course overview page ([#96](https://github.com/Selleo/mentingo/issues/96))

- update seed ([#92](https://github.com/Selleo/mentingo/issues/92))

- add relation course to lesson ([#91](https://github.com/Selleo/mentingo/issues/91))

- connect backend to course listing ([#90](https://github.com/Selleo/mentingo/issues/90))

- LC-178 add video formatts to files uplaod ([#93](https://github.com/Selleo/mentingo/issues/93))

- add courses list endpoint ([#83](https://github.com/Selleo/mentingo/issues/83))

- LC-171 add body text counter ([#86](https://github.com/Selleo/mentingo/issues/86))

- refactor admin resource config ([#75](https://github.com/Selleo/mentingo/issues/75))

- lesson form to create and update ([#70](https://github.com/Selleo/mentingo/issues/70))

- LC-96 add create and update user form validation ([#72](https://github.com/Selleo/mentingo/issues/72))

- add adminjs/relations plgin ([#69](https://github.com/Selleo/mentingo/issues/69))

- Create user form adjustments ([#46](https://github.com/Selleo/mentingo/issues/46))

- add created_at and updated_at properties ([#62](https://github.com/Selleo/mentingo/issues/62))

- add navigation and parent options ([#61](https://github.com/Selleo/mentingo/issues/61))

- update rootPath and session cookie options in AdminApp ([#56](https://github.com/Selleo/mentingo/issues/56))

- Deployment workflows ([#20](https://github.com/Selleo/mentingo/issues/20))

- LC-119 add validation to edit a category ([#45](https://github.com/Selleo/mentingo/issues/45))

- lc 62 add query for all categories for admins ([#10](https://github.com/Selleo/mentingo/issues/10))

- implement useCreateNewPassword hook

- implement userRecoverPassword hook

- update .gitignore

- add test and refactor recovery password

- LC-86 add password recovery endpoints

- login form forgot password label

- PasswordRecovery.page.tsx

- CreateNewPassword.page.tsx

- update .gitignore

- add courses

- LC-150 add custom validation and error in new category action

- add tables for lesson text blocks and notifications

- add tables for conversation messages, lesson questions, and notifications

- add tables for question answers and files

- add initial database schema

- adminjs add custom archive action to categories

- adminjs-fixes after rebase

- adminjs-self review

- adminjs-hide delete categories action

- adminjs-refactor files and add filtering categories

- adminjs add filtering by status

- add init categories filtering and status column

- add archived categories migration

- make category title unique

- adjust LC-62 and LC-64 to adminjs

- add test and refactor recovery password

- LC-86 add password recovery endpoints

- add user archivisation

- handle remember me option in backend

- add remember me option to login form

- [@radix](https://github.com/radix)-ui/react-checkbox dependency and checkbox component

- add first and last name to topbar

- add dotenv and faker packages

- add healthcheck endpoint to AdminApp class in app.ts ([#26](https://github.com/Selleo/mentingo/issues/26))

- add basic adminjs config

- add toaster as deleted table item info

- add "Kebab" case ro route

- added error page

- added carousel into dataTable.tsx

- Added an alert dropdown to confirm the deletion of a table item.

- Added the option to add video and text lessons.

- added routing for new text and new video lesson

- added ability to upload video from the Internet

- added modal for UploadVideo

- Added a working form for editing lessons.

- created LessonItems with preview and delete option

- Push Video

- add healthcheck endpoint ([#22](https://github.com/Selleo/mentingo/issues/22))

- add user name fields and faker for seed data

- extend user with first name and last name

- add firstName and lastName to user schema

- create basic app layout

- LC-61 pagination - wip

- LC-61 self review

- LC-61 add totalItems to response

- LC-61 add sorting filtering and pagination to query

- LC-61 add get all categories endpoint

- add gpush script for git push without verification

- add closeTestDatabase function to createUnitTest script

- configure HUSKY environment variable in workflows

- update test script and add CI workflow

- add admin role to user seed data

### Bug Fixes:

- migrations ([#178](https://github.com/Selleo/mentingo/issues/178))

- migrations order ([#177](https://github.com/Selleo/mentingo/issues/177))

- LC-272 course styling issue ([#172](https://github.com/Selleo/mentingo/issues/172))

- lesson path ([#171](https://github.com/Selleo/mentingo/issues/171))

- FE deploy ([#170](https://github.com/Selleo/mentingo/issues/170))

- lesson card in course view ([#166](https://github.com/Selleo/mentingo/issues/166))

- Correct totalItem count in course and category services ([#155](https://github.com/Selleo/mentingo/issues/155))

- LC-248 fix overview in smaller screens ([#153](https://github.com/Selleo/mentingo/issues/153))

- update markLessonItemAsCompleted to accept an object parameter ([#150](https://github.com/Selleo/mentingo/issues/150))

- correct course lesson count and admin file preview ([#148](https://github.com/Selleo/mentingo/issues/148))

- aws file display ([#143](https://github.com/Selleo/mentingo/issues/143))

- LC-195 fix after create user hook ([#144](https://github.com/Selleo/mentingo/issues/144))

- LC-237 add description do dashboard course card ([#142](https://github.com/Selleo/mentingo/issues/142))

- display favicon ([#122](https://github.com/Selleo/mentingo/issues/122))

- refresh token login ([#120](https://github.com/Selleo/mentingo/issues/120))

- missing refresh token ([#107](https://github.com/Selleo/mentingo/issues/107))

- course category select ([#112](https://github.com/Selleo/mentingo/issues/112))

- LC-196 and LC-197 remove author id from payload ([#101](https://github.com/Selleo/mentingo/issues/101))

- categories test bug ([#88](https://github.com/Selleo/mentingo/issues/88))

- LC-172 add proper text block validation msg ([#87](https://github.com/Selleo/mentingo/issues/87))

- LC-96 extract before hook to common folder ([#73](https://github.com/Selleo/mentingo/issues/73))

- remove non existing ArchiveFiter component ([#64](https://github.com/Selleo/mentingo/issues/64))

- archived type

- adminjs apply feedback

- fixed wrong password validation in login form

- Add babel dep ([#30](https://github.com/Selleo/mentingo/issues/30))

- LC-61 move pagination.ts to common folder

- LC-61 apply feedback

- LC-61 self review

- LC-61 add generic pagination

- update eslint-config-turbo version to 2.0.12

- LC-85 apply feedback

- LC-60 apply feedback

- LC-85 resolve migration conflicts

### Chores:

- rename directory ([#78](https://github.com/Selleo/mentingo/issues/78))

- updated selects with options across admin ([#63](https://github.com/Selleo/mentingo/issues/63))

- added readme for adminjs ([#53](https://github.com/Selleo/mentingo/issues/53))

- drizzle schema feedback ([#47](https://github.com/Selleo/mentingo/issues/47))

- update pull request template with guidelines and checklist

- update API endpoints and set global prefix

- rebase with main

- add TODO for swapping handleDelete with useDeleteLessonItem

- add TODO comments for database connection in multiple files

- remove [@vidstack](https://github.com/vidstack)/react

- change db url to env in drizzle config ([#23](https://github.com/Selleo/mentingo/issues/23))

- update .gitignore to include /test-results

- update database schema and migrations for first_name and last_name

- clean up Landing page

- remove unused code and files

- update test script for vitest command in package.json

- update ignore pattern for "ui/" directory

- update eslint configuration for ignoring UI files

- update ignore pattern for "ui" subdirectories

- update eslint ignore list and no-unused-vars rule

- update package.json, .husky/pre-push, pnpm-lock.yaml, and .github/workflows/ci.yml

- update lockfile

- fix eslint issues in web app

- LC-73 Update with boilerplate

- LC-73 Update with boilerplate

### Code Refactoring:

- remove navigation from settings view ([#164](https://github.com/Selleo/mentingo/issues/164))

- CourseLessonsShow component appearance adjustment ([#154](https://github.com/Selleo/mentingo/issues/154))

- change Breadcrumb component position to static ([#149](https://github.com/Selleo/mentingo/issues/149))

- Production seeds adjustment ([#147](https://github.com/Selleo/mentingo/issues/147))

- validation adjustment ([#109](https://github.com/Selleo/mentingo/issues/109))

- update package.json dependencies and devDependencies ([#55](https://github.com/Selleo/mentingo/issues/55))

- apply review feedback

- apply review feedback

- Moved links to wrap the entire dropdown in LessonItemsButton.tsx.

- improve module closure in unit test creation

- update eslint ignore patterns for ui directories

### Documentation:

- Legal notice ([#132](https://github.com/Selleo/mentingo/issues/132))

### Styles:

- Added icons to the table and

- move "New" button in DataTable

- added border radius into getPreview function

- added RWD into edit form

- added button into Dialog

### Tests:

- add tests for dashboard page ([#162](https://github.com/Selleo/mentingo/issues/162))

- add afterAll hook for cleaning up test context

[Unreleased]: https://github.com/Selleo/mentingo/compare/v3.23.0...HEAD
[v3.23.0]: https://github.com/Selleo/mentingo/compare/v3.22.0...v3.23.0
[v3.22.0]: https://github.com/Selleo/mentingo/compare/v3.21.0...v3.22.0
[v3.21.0]: https://github.com/Selleo/mentingo/compare/v3.20.0...v3.21.0
[v3.20.0]: https://github.com/Selleo/mentingo/compare/v3.19.1...v3.20.0
[v3.19.1]: https://github.com/Selleo/mentingo/compare/v3.19.0...v3.19.1
[v3.19.0]: https://github.com/Selleo/mentingo/compare/v3.18.0...v3.19.0
[v3.18.0]: https://github.com/Selleo/mentingo/compare/v3.17.0...v3.18.0
[v3.17.0]: https://github.com/Selleo/mentingo/compare/v3.16.0...v3.17.0
[v3.16.0]: https://github.com/Selleo/mentingo/compare/v3.15.0...v3.16.0
[v3.15.0]: https://github.com/Selleo/mentingo/compare/v3.14.1...v3.15.0
[v3.14.1]: https://github.com/Selleo/mentingo/compare/v3.14.0...v3.14.1
[v3.14.0]: https://github.com/Selleo/mentingo/compare/v3.13.0...v3.14.0
[v3.13.0]: https://github.com/Selleo/mentingo/compare/v3.12.0...v3.13.0
[v3.12.0]: https://github.com/Selleo/mentingo/compare/v3.11.0...v3.12.0
[v3.11.0]: https://github.com/Selleo/mentingo/compare/v3.10.0...v3.11.0
[v3.10.0]: https://github.com/Selleo/mentingo/compare/v3.8.2...v3.10.0
[v3.8.2]: https://github.com/Selleo/mentingo/compare/v3.8.1...v3.8.2
[v3.8.1]: https://github.com/Selleo/mentingo/compare/v3.9.0...v3.8.1
[v3.9.0]: https://github.com/Selleo/mentingo/compare/v3.8.0...v3.9.0
[v3.8.0]: https://github.com/Selleo/mentingo/compare/v3.7.0...v3.8.0
[v3.7.0]: https://github.com/Selleo/mentingo/compare/v3.6.0...v3.7.0
[v3.6.0]: https://github.com/Selleo/mentingo/compare/v3.5.0...v3.6.0
[v3.5.0]: https://github.com/Selleo/mentingo/compare/v3.4.0...v3.5.0
[v3.4.0]: https://github.com/Selleo/mentingo/compare/v3.3.0...v3.4.0
[v3.3.0]: https://github.com/Selleo/mentingo/compare/v3.2.1...v3.3.0
[v3.2.1]: https://github.com/Selleo/mentingo/compare/v3.2.0...v3.2.1
[v3.2.0]: https://github.com/Selleo/mentingo/compare/v3.1.0...v3.2.0
[v3.1.0]: https://github.com/Selleo/mentingo/compare/v3.0.6...v3.1.0
[v3.0.6]: https://github.com/Selleo/mentingo/compare/v3.0.5...v3.0.6
[v3.0.5]: https://github.com/Selleo/mentingo/compare/v3.0.4...v3.0.5
[v3.0.4]: https://github.com/Selleo/mentingo/compare/v3.0.3...v3.0.4
[v3.0.3]: https://github.com/Selleo/mentingo/compare/v3.0.2...v3.0.3
[v3.0.2]: https://github.com/Selleo/mentingo/compare/v3.0.1...v3.0.2
[v3.0.1]: https://github.com/Selleo/mentingo/compare/v3.0.0...v3.0.1
[v3.0.0]: https://github.com/Selleo/mentingo/compare/v2.2.3...v3.0.0
[v2.2.3]: https://github.com/Selleo/mentingo/compare/v2.2.2...v2.2.3
[v2.2.2]: https://github.com/Selleo/mentingo/compare/v2.2.1...v2.2.2
[v2.2.1]: https://github.com/Selleo/mentingo/compare/v2.2.0...v2.2.1
[v2.2.0]: https://github.com/Selleo/mentingo/compare/v2.1.2...v2.2.0
[v2.1.2]: https://github.com/Selleo/mentingo/compare/v2.1.1...v2.1.2
[v2.1.1]: https://github.com/Selleo/mentingo/compare/v2.1.0...v2.1.1
[v2.1.0]: https://github.com/Selleo/mentingo/compare/v2.0.0...v2.1.0
[v2.0.0]: https://github.com/Selleo/mentingo/compare/v1.1.1...v2.0.0
[v1.1.1]: https://github.com/Selleo/mentingo/compare/v1.1.0...v1.1.1
[v1.1.0]: https://github.com/Selleo/mentingo/compare/v1.0.0...v1.1.0
