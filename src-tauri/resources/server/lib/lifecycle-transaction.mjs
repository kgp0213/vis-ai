/**
 * Small, domain-neutral lifecycle transaction primitive inspired by Kimi
 * Code's guarded async lifecycle machine. It coordinates state transitions;
 * it does not persist data, publish events, or start model work.
 */

export class LifecycleTransitionError extends Error {
  constructor({ reason, operation, state, expected, activeOperation } = {}) {
    super(formatError({ reason, operation, state, expected, activeOperation }));
    this.name = "LifecycleTransitionError";
    this.reason = reason;
    this.operation = operation;
    this.state = state;
    this.expected = expected;
    this.activeOperation = activeOperation;
  }
}

function formatError({ reason, operation, state, expected, activeOperation }) {
  if (reason === "transition_conflict") return `Lifecycle operation "${operation}" conflicts with active operation "${activeOperation}"`;
  if (reason === "invalid_state") return `Lifecycle operation "${operation}" is not allowed from state "${state}"`;
  if (reason === "missing_commit_state") return `Lifecycle operation "${operation}" did not select a commit state`;
  if (reason === "missing_rollback_state") return `Lifecycle operation "${operation}" did not select a rollback state`;
  if (reason === "already_committed") return `Lifecycle operation "${operation}" already selected a commit state`;
  if (reason === "already_rolled_back") return `Lifecycle operation "${operation}" already selected a rollback state`;
  return `Lifecycle operation "${operation}" failed from state "${state}"${expected ? ` (expected ${expected})` : ""}`;
}

async function runActions(actions) {
  const errors = [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    try {
      await actions[index]();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function aggregateErrors(errors, message) {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, message, { cause: errors[0] });
}

function expectedStates(value) {
  return Array.isArray(value) ? value : [value];
}

export function createLifecycleMachine(initialState) {
  let state = initialState;
  let activeOperation;

  function error(operation, reason, expected, active) {
    return new LifecycleTransitionError({
      reason,
      operation,
      state,
      expected,
      activeOperation: active,
    });
  }

  function assertIdle(operation) {
    if (activeOperation === undefined) return;
    throw error(operation, "transition_conflict", undefined, activeOperation);
  }

  function assertState(operation, expected) {
    if (expectedStates(expected).includes(state)) return;
    throw error(operation, "invalid_state", expected);
  }

  function switchState({ operation, from, to }) {
    assertIdle(operation);
    assertState(operation, from);
    state = to;
  }

  async function transaction({ operation, from, enter, commit, rollback }, callback) {
    assertIdle(operation);
    assertState(operation, from);
    const stateBefore = state;
    activeOperation = operation;
    state = enter;
    const deferred = [];
    const rollbacks = [];
    const afterCommit = [];
    let commitState = commit;
    let rollbackState = rollback;
    let commitSelected = false;
    let rollbackSelected = false;
    const control = {
      defer: (action) => deferred.push(action),
      rollback: (action) => rollbacks.push(action),
      afterCommit: (action) => afterCommit.push(action),
      commit: (nextState) => {
        if (commitSelected) throw error(operation, "already_committed");
        commitSelected = true;
        commitState = nextState;
      },
      rollbackTo: (nextState) => {
        if (rollbackSelected) throw error(operation, "already_rolled_back");
        rollbackSelected = true;
        rollbackState = nextState;
      },
    };
    try {
      let result;
      try {
        result = await callback(control);
      } catch (cause) {
        const errors = [cause, ...(await runActions(rollbacks)), ...(await runActions(deferred))];
        if (rollbackState === undefined) errors.push(error(operation, "missing_rollback_state"));
        state = rollbackState === undefined ? stateBefore : rollbackState;
        throw aggregateErrors(errors, `Lifecycle transaction "${operation}" failed`);
      }
      if (commitState === undefined) {
        const cleanupErrors = await runActions(deferred);
        state = rollbackState === undefined ? stateBefore : rollbackState;
        const errors = [error(operation, "missing_commit_state"), ...cleanupErrors];
        throw aggregateErrors(errors, `Lifecycle transaction "${operation}" did not commit`);
      }
      const cleanupErrors = await runActions(deferred);
      state = commitState;
      const afterCommitErrors = await runActions(afterCommit);
      const errors = [...cleanupErrors, ...afterCommitErrors];
      if (errors.length > 0) throw aggregateErrors(errors, `Lifecycle transaction "${operation}" committed with action failures`);
      return result;
    } finally {
      activeOperation = undefined;
    }
  }

  return {
    get state() { return state; },
    get snapshot() {
      return activeOperation === undefined
        ? { state, transitioning: false }
        : { state, transitioning: true, operation: activeOperation };
    },
    is: (...states) => states.includes(state),
    switch: switchState,
    transaction,
  };
}
