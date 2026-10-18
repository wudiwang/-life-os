import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const courseUrl = new URL('./thaiLessons.js', import.meta.url);

test('Thai speaking course supplies a complete, consistent 30-day reading curriculum', async (t) => {
  assert.ok(existsSync(courseUrl), 'The 30-day Thai course data module must exist');
  const { THAI_COURSE_VERSION, THAI_LESSONS, THAI_READING_GUIDE } = await import(courseUrl.href);

  await t.test('course version and pronunciation guide are available', () => {
    assert.equal(THAI_COURSE_VERSION, '2026-10-18-v1');
    assert.ok(Array.isArray(THAI_READING_GUIDE) && THAI_READING_GUIDE.length >= 2);
    assert.ok(THAI_READING_GUIDE.every((note) => typeof note === 'string' && note.trim()));
    assert.match(THAI_READING_GUIDE.join(' '), /ครับ.*ค่ะ.*คะ/u);
  });

  await t.test('all 30 days have exactly three words and four dialogue lines', () => {
    assert.equal(THAI_LESSONS.length, 30);
    assert.deepEqual(THAI_LESSONS.map(({ day }) => day), Array.from({ length: 30 }, (_, i) => i + 1));
    for (const lesson of THAI_LESSONS) {
      for (const key of ['title', 'goal', 'tip']) {
        assert.ok(typeof lesson[key] === 'string' && lesson[key].trim(), `Day ${lesson.day}: ${key}`);
      }
      assert.equal(lesson.words.length, 3, `Day ${lesson.day}: words`);
      assert.equal(lesson.dialogue.length, 4, `Day ${lesson.day}: dialogue`);
      assert.ok(lesson.dialogue.every(({ role }) => typeof role === 'string' && role.trim()));
    }
  });

  await t.test('every audio item has a stable unique ID and all three language fields', () => {
    const ids = new Set();
    for (const lesson of THAI_LESSONS) {
      const prefix = `d${String(lesson.day).padStart(2, '0')}`;
      for (const [kind, entries] of [['w', lesson.words], ['l', lesson.dialogue]]) {
        entries.forEach((entry, index) => {
          assert.equal(entry.id, `${prefix}-${kind}${index + 1}`);
          assert.ok(!ids.has(entry.id), `Duplicate ID: ${entry.id}`);
          ids.add(entry.id);
          for (const key of ['th', 'roman', 'zh']) {
            assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `${entry.id}: ${key}`);
          }
          assert.match(entry.th, /[\u0E00-\u0E7F]/u);
          assert.doesNotMatch(entry.roman, /[\u0E00-\u0E7F\u4E00-\u9FFF]/u);
          assert.match(entry.zh, /[\u4E00-\u9FFF]/u);
        });
      }
    }
    assert.equal(ids.size, 210);
  });

  await t.test('the same Thai text always has the same pronunciation hint', () => {
    const pronunciations = new Map();
    for (const lesson of THAI_LESSONS) {
      for (const entry of [...lesson.words, ...lesson.dialogue]) {
        const previous = pronunciations.get(entry.th);
        if (previous) assert.equal(entry.roman, previous, entry.th);
        pronunciations.set(entry.th, entry.roman);
      }
    }
  });

  await t.test('core vocabulary preserves checked tone and vowel-length distinctions', () => {
    const words = new Map(THAI_LESSONS.flatMap(({ words: entries }) => entries.map(({ th, roman }) => [th, roman])));
    for (const [thai, roman] of [
      ['สวัสดี', 'sà-wàt-dii'],
      ['สบายดี', 'sà-baai dii'],
      ['น้อย', 'náawy'],
      ['สถานี', 'sà-thǎa-nii'],
      ['โรงพยาบาล', 'roong phá-yaa-baan'],
      ['ข้าวผัด', 'khâao phàt'],
      ['ไม่เข้าใจ', 'mâi khâo jai'],
    ]) assert.equal(words.get(thai), roman, thai);
  });

  await t.test('each day places its three keywords in the spoken dialogue', () => {
    for (const lesson of THAI_LESSONS) {
      const dialogue = lesson.dialogue.map(({ th }) => th).join(' ');
      for (const word of lesson.words) {
        assert.ok(dialogue.includes(word.th), `Day ${lesson.day}: dialogue should use ${word.th}`);
      }
    }
  });

  await t.test('every fifth day revisits vocabulary from earlier lessons', () => {
    for (const lesson of THAI_LESSONS.filter(({ day }) => day % 5 === 0)) {
      const earlier = THAI_LESSONS.filter(({ day }) => day < lesson.day)
        .flatMap(({ words }) => words.map(({ th }) => th));
      assert.ok(lesson.words.every(({ th }) => earlier.includes(th)), `Day ${lesson.day}: review vocabulary`);
    }
  });

  await t.test('course content contains no unfinished placeholders', () => {
    assert.doesNotMatch(readFileSync(courseUrl, 'utf8'), /\b(?:TODO|FIXME|TBD|placeholder)\b|待补充|待填写/iu);
  });
});
