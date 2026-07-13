import assert from "node:assert/strict";

import { signupAllowed } from "./index";

// Unset preserves the original internal-pilot gate.
assert.equal(signupAllowed("bolaji@ritzyinteriors.com", {}), true);
assert.equal(signupAllowed("someone@gmail.com", {}), false);

// Mixed emails + domains, @-prefix and casing tolerated.
const env = { RITZY_SIGNUP_ALLOWLIST: "ritzyinteriors.com, Friend@Gmail.com, @trusted.ae" };
assert.equal(signupAllowed("Bolaji@RitzyInteriors.com", env), true);
assert.equal(signupAllowed("friend@gmail.com", env), true);
assert.equal(signupAllowed("other@gmail.com", env), false);
assert.equal(signupAllowed("anyone@trusted.ae", env), true);

// Wildcard opens signup entirely.
assert.equal(signupAllowed("stranger@anywhere.io", { RITZY_SIGNUP_ALLOWLIST: "*" }), true);

// Junk never passes.
assert.equal(signupAllowed("not-an-email", env), false);
assert.equal(signupAllowed("", { RITZY_SIGNUP_ALLOWLIST: "*" }), false);

console.log("signup allowlist tests passed");
