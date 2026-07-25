import assert from "node:assert/strict";
import { test } from "node:test";

import { isTodoScopeCurrent, normalizeTodoList } from "./session-todo-state.mjs";

test("todo snapshots receive stable bounded ids and states", () => {
  assert.deepEqual(normalizeTodoList([
    { content: "first", status: "invalid" },
    { title: "second", status: "in_progress", activeForm: "Working" },
  ]), [
    { id: "todo-1", content: "first", activeForm: "", status: "pending" },
    { id: "todo-2", content: "second", activeForm: "Working", status: "in_progress" },
  ]);
});

test("preserves generated todo ids when a full snapshot is reordered", () => {
  const previous = normalizeTodoList([
    { content: "read source" },
    { content: "write tests" },
  ]);
  const reordered = normalizeTodoList([
    { content: "write tests" },
    { content: "read source" },
  ], 100, previous);
  assert.equal(reordered[0].id, previous[1].id);
  assert.equal(reordered[1].id, previous[0].id);
});

test("does not assign duplicate ids to repeated todo content", () => {
  const todos = normalizeTodoList([
    { content: "same" },
    { content: "same" },
  ]);
  assert.notEqual(todos[0].id, todos[1].id);
});

test("bounds duplicate long todo ids without looping", () => {
  const todos = normalizeTodoList([
    { id: "x".repeat(160), content: "first" },
    { id: "x".repeat(160), content: "second" },
  ]);
  assert.equal(todos.length, 2);
  assert.notEqual(todos[0].id, todos[1].id);
  assert.ok(todos.every((todo) => todo.id.length <= 160));
});

test("late todo updates cannot cross operation or session scope", () => {
  assert.equal(isTodoScopeCurrent({ operationId: "op-1", sessionId: "s-1", activeOperationId: "op-1", activeSessionId: "s-1" }), true);
  assert.equal(isTodoScopeCurrent({ operationId: "op-old", sessionId: "s-1", activeOperationId: "op-new", activeSessionId: "s-1" }), false);
  assert.equal(isTodoScopeCurrent({ operationId: "op-1", sessionId: "s-old", activeOperationId: "op-1", activeSessionId: "s-new" }), false);
});
