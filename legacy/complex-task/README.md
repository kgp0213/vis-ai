# Retired complex-task runtime

These modules are retained only for historical reference. They are outside
`src-tauri/resources/server`, are not copied into release resources, and are
excluded from the active test glob. They are not an executable compatibility
runtime.

The application has one model execution kernel: `CacheFirstLoop` in the active
launcher. Do not import these modules into the runtime or add a second worker,
orchestrator, or supervisor path.
