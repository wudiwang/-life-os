import test from 'node:test'
import assert from 'node:assert/strict'
import { actionsForDay, bangkokDay } from './dailyActions.js'

test('Bangkok midnight changes date independently of device timezone', () => {
  assert.equal(bangkokDay(new Date('2026-09-08T16:59:59Z')), '2026-09-08')
  assert.equal(bangkokDay(new Date('2026-09-08T17:00:00Z')), '2026-09-09')
})
test('repeated completion belongs only to the recorded date', () => {
  const todos = [{ id: 'a', repeat_weekdays: [1,2,3,4,5,6], status: 'open' }]
  const entries = [{ todo_id: 'a', log_date: '2026-09-08', state: 'done' }]
  assert.equal(actionsForDay(todos, entries, '2026-09-08')[0].dayState, 'done')
  assert.equal(actionsForDay(todos, entries, '2026-09-09')[0].dayState, 'open')
  assert.equal(actionsForDay(todos, entries, '2026-09-13').length, 0)
})
test('future tasks do not appear before their date or creation', () => {
  assert.equal(actionsForDay([{ id:'a', due_date:'2026-09-09' }], [], '2026-09-08').length, 0)
  assert.equal(actionsForDay([{ id:'a', created_at:'2026-09-09T01:00:00Z' }], [], '2026-09-08').length, 0)
})
test('day feedback stays visible after changing a recurrence schedule', () => {
  const result = actionsForDay([{ id:'a', repeat_weekdays:[1] }], [{todo_id:'a',log_date:'2026-09-08',state:'skipped',feedback:'休息'}], '2026-09-08')
  assert.equal(result[0].entry.feedback, '休息')
  assert.equal(result[0].dayState, 'skipped')
})
test('one-time completed tasks are not reintroduced tomorrow', () => {
  const todo = { id:'a', status:'done', done_at:'2026-09-08T10:00:00Z' }
  assert.equal(actionsForDay([todo], [], '2026-09-08')[0].dayState, 'done')
  assert.equal(actionsForDay([todo], [], '2026-09-09').length, 0)
})
test('legacy work page completion and undo stay authoritative for single tasks', () => {
  const entry = { todo_id:'a', log_date:'2026-09-08', state:'open' }
  assert.equal(actionsForDay([{id:'a',status:'done',done_at:'2026-09-08T10:00:00Z'}], [entry], '2026-09-08')[0].dayState, 'done')
  assert.equal(actionsForDay([{id:'a',status:'open'}], [{...entry,state:'done'}], '2026-09-08')[0].dayState, 'open')
})
test('historical day uses the recorded state instead of later task changes', () => {
  assert.equal(actionsForDay([{id:'a',status:'open'}], [{todo_id:'a',log_date:'2026-09-08',state:'done'}], '2026-09-08', true)[0].dayState, 'done')
})
