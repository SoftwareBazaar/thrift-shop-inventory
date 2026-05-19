# Security Audit Report - npm Dependencies

**Date:** May 18, 2026
**Status:** 🔴 CRITICAL - 56 Vulnerabilities Found
**Severity Breakdown:** 0 Critical | 29 High | 12 Moderate | 15 Low

---

## Executive Summary

The Thrift Shop inventory system has **56 npm security vulnerabilities** that need to be addressed:
- **29 HIGH severity** - Require immediate attention
- **12 MODERATE severity** - Should be fixed soon
- **15 LOW severity** - Can be addressed later

**Root Cause:** Outdated dependencies, particularly in React ecosystem (react-scripts, webpack, etc.)

**Recommendation:** Upgrade to newer versions of core dependencies

---

## Critical High-Severity Vulnerabilities

### 1. Axios (Multiple CVEs)
**Severity:** 🔴 HIGH
**Affected Versions:** 1.0.0 - 1.15.1
**Issues:**
- NO_PROXY Hostname Normalization Bypass (SSRF)
- Unrestricted Cloud Metadata Exfiltration
- Authentication Bypass via Prototype Pollution
- Null Byte Injection
- CRLF Injection in multipart/form-data
- Prototype Pollution Gadgets
- Header Injection via Prototype Pollution
- XSRF Token Cross-Origin Leakage
- Denial of Service via __proto__ Key

**Impact:** Server-Side Request Forgery, credential injection, request hijacking
**Fix:** Upgrade to latest axios version
**Command:** `npm install axios@latest`

### 2. React Router (@remix-run/router)
**Severity:** 🔴 HIGH
**Affected Versions:** <=1.23.1
**Issue:** XSS via Open Redirects
**Impact:** Cross-site scripting attacks
**Fix:** Upgrade react-router-dom to latest
**Command:** `npm install react-router-dom@latest`

### 3. Lodash
**Severity:** 🔴 HIGH
**Affected Versions:** <=4.17.23
**Issues:**
- Prototype Pollution in `_.unset` and `_.omit`
- Code Injection via `_.template`
- Array path bypass in `_.unset` and `_.omit`

**Impact:** Prototype pollution attacks, code injection
**Fix:** Upgrade to lodash@4.17.24 or later
**Command:** `npm install lodash@latest`

### 4. Minimatch (Multiple ReDoS)
**Severity:** 🔴 HIGH
**Affected Versions:** <=3.1.3, 5.0.0-5.1.7, 9.0.0-9.0.6
**Issues:**
- ReDoS via repeated wildcards
- Combinatorial backtracking via GLOBSTAR
- Nested extglobs cause catastrophic backtracking

**Impact:** Denial of Service via regex attacks
**Fix:** Upgrade minimatch
**Command:** `npm install minimatch@latest`

### 5. Node-Forge (Multiple CVEs)
**Severity:** 🔴 HIGH
**Affected Versions:** <=1.3.3
**Issues:**
- ASN.1 Unbounded Recursion
- Interpretation Conflict vulnerability
- OID Integer Truncation
- basicConstraints bypass
- Signature forgery in Ed25519
- Denial of Service via Infinite Loop
- Signature forgery in RSA-PKCS

**Impact:** Certificate validation bypass, signature forgery, DoS
**Fix:** Upgrade node-forge
**Command:** `npm install node-forge@latest`

### 6. Webpack (SSRF)
**Severity:** 🔴 HIGH
**Affected Versions:** 5.49.0 - 5.104.0
**Issues:**
- buildHttp allowedUris bypass via URL userinfo
- HttpUriPlugin bypass via HTTP redirects

**Impact:** Server-Side Request Forgery during build
**Fix:** Upgrade webpack
**Command:** `npm install webpack@latest`

### 7. Rollup (Path Traversal)
**Severity:** 🔴 HIGH
**Affected Versions:** <2.80.0
**Issue:** Arbitrary File Write via Path Traversal
**Impact:** Arbitrary file write during build
**Fix:** Upgrade rollup
**Command:** `npm install rollup@latest`

### 8. Serialize-JavaScript (RCE)
**Severity:** 🔴 HIGH
**Affected Versions:** <=7.0.4
**Issues:**
- RCE via RegExp.flags and Date.prototype.toISOString()
- CPU Exhaustion DoS

**Impact:** Remote code execution, denial of service
**Fix:** Upgrade serialize-javascript
**Command:** `npm install serialize-javascript@latest`

### 9. Underscore (DoS)
**Severity:** 🔴 HIGH
**Affected Versions:** <=1.13.7
**Issue:** Unlimited recursion in _.flatten and _.isEqual
**Impact:** Denial of Service
**Fix:** Upgrade underscore
**Command:** `npm install underscore@latest`

### 10. JSONPath (Prototype Pollution & Code Injection)
**Severity:** 🔴 HIGH
**Affected Versions:** *
**Issues:**
- Prototype Pollution via insufficient input validation
- Arbitrary Code Injection via unsafe evaluation

**Impact:** Prototype pollution, code injection
**Fix:** Upgrade jsonpath
**Command:** `npm install jsonpath@latest`

### 11. Path-to-Regexp (ReDoS)
**Severity:** 🔴 HIGH
**Affected Versions:** <0.1.13
**Issue:** ReDoS via multiple route parameters
**Impact:** Denial of Service
**Fix:** Upgrade path-to-regexp
**Command:** `npm install path-to-regexp@latest`

### 12. Picomatch (ReDoS & Method Injection)
**Severity:** 🔴 HIGH
**Affected Versions:** <=2.3.1
**Issues:**
- Method Injection in POSIX Character Classes
- ReDoS via extglob quantifiers

**Impact:** Incorrect glob matching, denial of service
**Fix:** Upgrade picomatch
**Command:** `npm install picomatch@latest`

### 13. Fast-URI (Path Traversal & Host Confusion)
**Severity:** 🔴 HIGH
**Affected Versions:** <=3.1.1
**Issues:**
- Path traversal via percent-encoded dot segments
- Host confusion via percent-encoded authority delimiters

**Impact:** Path traversal, host confusion attacks
**Fix:** Upgrade fast-uri
**Command:** `npm install fast-uri@latest`

### 14. Flatted (DoS & Prototype Pollution)
**Severity:** 🔴 HIGH
**Affected Versions:** <=3.4.1
**Issues:**
- Unbounded recursion DoS in parse()
- Prototype Pollution via parse()

**Impact:** Denial of service, prototype pollution
**Fix:** Upgrade flatted
**Command:** `npm install flatted@latest`

### 15. Glob (Command Injection)
**Severity:** 🔴 HIGH
**Affected Versions:** 10.2.0 - 10.4.5
**Issue:** Command injection via -c/--cmd with shell:true
**Impact:** Arbitrary command execution
**Fix:** Upgrade glob
**Command:** `npm install glob@latest`

---

## Moderate Severity Vulnerabilities

### 1. AJV (ReDoS)
**Severity:** 🟠 MODERATE
**Issue:** ReDoS when using `$data` option
**Fix:** Upgrade ajv

### 2. BN.js (Infinite Loop)
**Severity:** 🟠 MODERATE
**Issue:** Infinite loop vulnerability
**Fix:** Upgrade bn.js

### 3. Brace-Expansion (DoS)
**Severity:** 🟠 MODERATE
**Issue:** Zero-step sequence causes process hang
**Fix:** Upgrade brace-expansion

### 4. Follow-Redirects (Header Leakage)
**Severity:** 🟠 MODERATE
**Issue:** Custom auth headers leaked to cross-domain redirects
**Fix:** Upgrade follow-redirects

### 5. JS-YAML (Prototype Pollution)
**Severity:** 🟠 MODERATE
**Issue:** Prototype pollution in merge (<<)
**Fix:** Upgrade js-yaml

### 6. PostCSS (XSS & Parsing Error)
**Severity:** 🟠 MODERATE
**Issues:**
- Line return parsing error
- XSS via unescaped </style> in CSS output

**Fix:** Upgrade postcss

### 7. QS (DoS)
**Severity:** 🟠 MODERATE
**Issues:**
- arrayLimit bypass in comma parsing
- arrayLimit bypass in bracket notation

**Fix:** Upgrade qs

### 8. Webpack-Dev-Server (Source Code Exposure)
**Severity:** 🟠 MODERATE
**Issues:**
- Source code theft on non-Chromium browsers
- Cross-origin source code exposure on non-HTTPS

**Fix:** Upgrade webpack-dev-server

### 9. WS (Uninitialized Memory Disclosure)
**Severity:** 🟠 MODERATE
**Issue:** Uninitialized memory disclosure
**Fix:** Upgrade ws

### 10. YAML (Stack Overflow)
**Severity:** 🟠 MODERATE
**Issue:** Stack overflow via deeply nested YAML
**Fix:** Upgrade yaml

### 11. @Babel/Plugin-Transform-Modules-SystemJS (Code Generation)
**Severity:** 🟠 MODERATE
**Issue:** Arbitrary code generation from malicious input
**Fix:** Upgrade @babel/plugin-transform-modules-systemjs

### 12. @Tootallnate/Once (Control Flow Scoping)
**Severity:** 🟠 MODERATE
**Issue:** Incorrect control flow scoping
**Fix:** Upgrade @tootallnate/once

---

## Low Severity Vulnerabilities

15 low-severity vulnerabilities in various dependencies. These can be addressed after high and moderate issues are fixed.

---

## Recommended Fix Strategy

### Phase 1: Immediate (This Week)
1. **Upgrade Core Dependencies:**
   ```bash
   npm install axios@latest
   npm install react-router-dom@latest
   npm install lodash@latest
   npm install webpack@latest
   npm install node-forge@latest
   ```

2. **Test After Each Upgrade:**
   - Run `npm run build`
   - Run `npm test`
   - Test in browser

### Phase 2: Secondary (Next Week)
1. **Upgrade Build Tools:**
   ```bash
   npm install rollup@latest
   npm install serialize-javascript@latest
   npm install webpack-dev-server@latest
   ```

2. **Upgrade Utilities:**
   ```bash
   npm install minimatch@latest
   npm install picomatch@latest
   npm install underscore@latest
   ```

### Phase 3: Remaining (Next Month)
1. **Upgrade Remaining Dependencies:**
   ```bash
   npm install jsonpath@latest
   npm install fast-uri@latest
   npm install flatted@latest
   npm install glob@latest
   npm install postcss@latest
   npm install qs@latest
   npm install yaml@latest
   npm install ws@latest
   ```

2. **Full Testing:**
   - Run full test suite
   - Test all features
   - Deploy to staging
   - Deploy to production

---

## Breaking Changes to Watch For

Some upgrades may introduce breaking changes:

1. **React-Scripts** - May require configuration changes
2. **Webpack** - May require webpack config updates
3. **PostCSS** - May require postcss config updates
4. **Rollup** - May require rollup config updates

**Recommendation:** Test thoroughly after each major upgrade

---

## Testing Checklist

After applying security fixes:

- [ ] `npm run build` completes successfully
- [ ] `npm test` passes all tests
- [ ] Application loads in browser
- [ ] All features work correctly
- [ ] No console errors
- [ ] No console warnings (except expected ones)
- [ ] Performance is acceptable
- [ ] No new bugs introduced

---

## Monitoring

After fixes are applied:

1. **Weekly:** Run `npm audit` to check for new vulnerabilities
2. **Monthly:** Review npm security advisories
3. **Quarterly:** Update all dependencies to latest versions

---

## References

- [npm Security Advisories](https://www.npmjs.com/advisories)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk Vulnerability Database](https://snyk.io/vuln)

---

## Summary

**Current Status:** 🔴 56 vulnerabilities (29 high, 12 moderate, 15 low)
**Action Required:** Upgrade dependencies in phases
**Timeline:** 2-3 weeks for complete remediation
**Risk Level:** HIGH - Multiple critical vulnerabilities present

**Next Step:** Start Phase 1 upgrades this week

---

**Prepared:** May 18, 2026
**Status:** READY FOR REMEDIATION
**Priority:** 🔴 CRITICAL - Address security vulnerabilities immediately

