import assert from 'node:assert/strict'
import test from 'node:test'
import { largestPhoto, groupMessages, buildPhotoPrompt } from './tg-photo.mjs'

test('picks the largest photo size', () => {
  const sizes = [{ file_id: 's', width: 90, height: 90, file_size: 1000 }, { file_id: 'l', width: 1280, height: 960, file_size: 90000 }, { file_id: 'm', width: 320, height: 240, file_size: 9000 }]
  assert.equal(largestPhoto(sizes).file_id, 'l')
  assert.equal(largestPhoto([{ file_id: 'a', width: 10, height: 10 }, { file_id: 'b', width: 20, height: 20 }]).file_id, 'b')
  assert.equal(largestPhoto([]), null)
})

test('merges an album into one unit and keeps other messages in order', () => {
  const units = groupMessages([
    { message_id: 1, text: '打卡' },
    { message_id: 2, media_group_id: 'g', photo: [{ file_id: 'p1' }], caption: '午餐' },
    { message_id: 3, media_group_id: 'g', photo: [{ file_id: 'p2' }] },
    { message_id: 4, photo: [{ file_id: 'p3' }], caption: '711 鸡胸肉' },
    { message_id: 5, media_group_id: 'g', photo: [{ file_id: 'p4' }], caption: '少放了油' },
  ])
  assert.equal(units.length, 3)
  assert.deepEqual(units.map(u => u.msg.message_id), [1, 2, 4])
  assert.equal(units[0].caption, '打卡')
  assert.equal(units[0].photos.length, 0)
  assert.equal(units[1].photos.length, 3)
  assert.equal(units[1].caption, '午餐\n少放了油')
  assert.equal(units[2].caption, '711 鸡胸肉')
})

test('photo prompt lists every path and points to the entry rules', () => {
  const p = buildPhotoPrompt({ paths: ['C:\\a.jpg', 'C:\\b.jpg'], caption: '' })
  assert.match(p, /2 张照片/)
  assert.match(p, /C:\\a\.jpg[\s\S]*C:\\b\.jpg/)
  assert.match(p, /（没写）/)
  assert.match(p, /塑形数据录入总则/)
})
