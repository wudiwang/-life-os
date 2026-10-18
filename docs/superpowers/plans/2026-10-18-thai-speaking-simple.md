# Thai Speaking Simple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. User explicitly waived another design review; execute directly.

**Goal:** Open a lesson, read three words and four dialogue lines, tap audio and finish.
**Architecture:** Static30 lessons + bundledMP3; focusedReact page; pure audio/progress helpers; scoped Supabase table via db; sharedTelegram keyboard.
**Tech Stack:** React19, Vite, inline styles, Node test runner, nativeAudio, Supabase.

## Verification status

2026-10-18: Course, audio, progress storage, page and Telegram keyboard code are implemented. Independent specification and code-quality reviews passed after fixing navigation synchronization. Browser checks passed in the local demo at mobile and desktop sizes: playback reached the playing state; Chinese can be hidden; manual practice survives refresh; continue advances to the next unpracticed day; day 30 returns to the directory; browser Back restores the correct module. No fake practice was written to production. All 210 audio files passed mapping, hash and decode checks. The scoped database migration is applied. Publication and live keyboard activation remain the final release steps.

## Task1 Course
Files: src/pages/Thai/thaiLessons.js and thaiLessons.test.mjs.
- [ ] Write and run failing tests:30 consecutive days, exactly3words/4dialogue lines, uniqueIDs, nonemptyth/roman/zh, consistent repeatedThai pronunciation.
- [ ] Export THAI_COURSE_VERSION='2026-10-18-v1', THAI_LESSONS=[{day,title,goal,tip,words:[{id,th,roman,zh}],dialogue:[{id,role,th,roman,zh}]}]; IDs d01-w1, d01-l1.
- [ ] Fill all30 beginner scenarios from simplifiedspec, natural short speech, tone/length-marked transliteration. Explicitly explain polite forms, no learner gender inference.
- [ ] Run node --test src/pages/Thai/thaiLessons.test.mjs; separate language review.

## Task2 Audio
Files: scripts/generate-thai-audio.py, public/audio/thai/*.mp3, manifest.json, docs/learning/thai-audio.md.
- [ ] Verify free synthesis provider/voice and a sample using current source documentation.
- [ ] Generate fixedid MP3 from exported courseJSON, bounded requests, resumable verified files, deduplicate same text; no secrets/private text.
- [ ] Validate all210 playable assets with ffprobe duration>0, matching text manifest; report listening limitations honestly.

## Task3 Core logic
Files: src/pages/Thai/thaiProgress.js/test.mjs, thaiAudio.js/test.mjs, supabase/v16_thai_learning.sql.
- [ ] Tests first: invalid/hash day, firstunpracticed/all30, staleversion, Bangkok date, oneaudio, staleevents, playreject,dispose.
- [ ] Implement parseLessonDay(hash), nextLessonDay(rows), practiceRow(day,now) and use db.upsert unique(course_version,lesson_day).
- [ ] Implement createThaiAudioPlayer({createAudio,onChange}): play(id),stop(),dispose(); singleAudio + generationguard; idle/loading/playing/error.
- [ ] SQL add idUUID, course_versionTEXT, lesson_dayINTEGER check1..30, practiced_atTIMESTAMPTZ, practiced_onDATE, created_atTIMESTAMPTZ, unique(course_version,lesson_day). Follow existingpermission model; add ALL_TABLES.
- [ ] Verify via node --test src/pages/Thai/*.test.mjs then apply only this migration with existing credentials.

## Task4 UI/entries
Files: src/pages/Thai/ThaiPage.jsx, src/pages/registry.js, src/lib/constants.js, src/pages/Dashboard/DailyBoard.jsx, package.json.
- [ ] Failing entry tests; directory has continue+30days, daypage has3words/4lines, speakers, hideChinese, practiced,next.
- [ ] hashday URL route with back/forward, invalidday fallback; stopaudio/resetChinese on daychange/unmount; min44px targets,max720px.
- [ ] Fetch/write via db; loading/error/retry; browsing/audio independent ofDB; no optimisticsuccess; noautocompletion.
- [ ] Register Thai page/navigation/home link and test:thai script.

## Task5 Telegram and QA
Files: scripts/tg-keyboard.mjs/test.mjs, scripts/tg-bot.mjs.
- [ ] Test buildQuickKeyboard(baseURL): fourexistingentries, thaiWebApp, checkintext,HTTPSvalidation.
- [ ] Extract builder, import into bot; do not execute/import bot for tests.
- [ ] Run alltests, npm run build, npx eslint src api; browser checks on own localdemo, never fake productionpractice.
- [ ] Separate speccompliance and codequality reviews; resolvefindings.
- [ ] Scoped commits only; suppressautopush whileincomplete; publish viaexistingchain onlyafterverification.
- [ ] Record exactdeliveredstate inprivate memory, no false completion/deployment.
