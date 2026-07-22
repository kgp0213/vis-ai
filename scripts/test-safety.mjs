// Test processes must never send real DWS messages by default.  This preload
// runs before test modules, including untracked files picked up by node --test.
// A real integration run must be launched separately with explicit approval.
if (process.env.VISIONOX_ALLOW_REAL_DWS_TEST !== "1") {
  process.env.DWS_SKIP_REAL_SEND = "1";
  process.env.VISIONOX_TEST_MODE = "1";
}
