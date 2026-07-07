const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasExplicitMacNotarizationConfiguration,
  parseCodesignDetails,
  validateMacReleaseSignature,
} = require('./build-electron-with-tag-version.cjs');

test('hasExplicitMacNotarizationConfiguration recognizes complete Apple notarization credentials only', () => {
  assert.equal(
    hasExplicitMacNotarizationConfiguration({
      APPLE_ID: 'user@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh-ijkl-mnop',
      APPLE_TEAM_ID: 'ABCDE12345',
    }),
    true
  );

  assert.equal(
    hasExplicitMacNotarizationConfiguration({
      APPLE_ID: 'user@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh-ijkl-mnop',
    }),
    false
  );

  assert.equal(
    hasExplicitMacNotarizationConfiguration({
      APPLE_API_KEY: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
      APPLE_API_KEY_ID: 'ABC123DEF4',
      APPLE_API_ISSUER: '12345678-1234-1234-1234-123456789abc',
    }),
    true
  );
});

test('parseCodesignDetails extracts signature, team, and authorities', () => {
  const details = parseCodesignDetails(`
Executable=/tmp/Omvra.app/Contents/MacOS/Omvra
Signature=Developer ID Application: Example Dev (ABCDE12345)
Authority=Developer ID Application: Example Dev (ABCDE12345)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=ABCDE12345
  `);

  assert.deepEqual(details, {
    signature: 'Developer ID Application: Example Dev (ABCDE12345)',
    teamIdentifier: 'ABCDE12345',
    authorities: [
      'Developer ID Application: Example Dev (ABCDE12345)',
      'Developer ID Certification Authority',
      'Apple Root CA',
    ],
  });
});

test('validateMacReleaseSignature rejects ad-hoc and accepts Developer ID signing', () => {
  assert.deepEqual(
    validateMacReleaseSignature({
      signature: 'adhoc',
      teamIdentifier: 'not set',
      authorities: [],
    }),
    {
      ok: false,
      reason: 'App bundle is ad-hoc signed.',
    }
  );

  assert.deepEqual(
    validateMacReleaseSignature({
      signature: 'Developer ID Application: Example Dev (ABCDE12345)',
      teamIdentifier: 'ABCDE12345',
      authorities: ['Developer ID Application: Example Dev (ABCDE12345)'],
    }),
    {
      ok: true,
      reason: null,
    }
  );
});

test('validateMacReleaseSignature accepts signed apps when codesign omits Signature= but includes authority and team id', () => {
  const details = parseCodesignDetails(`
Executable=/Applications/Omvra.app/Contents/MacOS/Omvra
Authority=Developer ID Application: Example Dev (ABCDE12345)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=ABCDE12345
Signature size=9044
  `);

  assert.deepEqual(details, {
    signature: null,
    teamIdentifier: 'ABCDE12345',
    authorities: [
      'Developer ID Application: Example Dev (ABCDE12345)',
      'Developer ID Certification Authority',
      'Apple Root CA',
    ],
  });

  assert.deepEqual(validateMacReleaseSignature(details), {
    ok: true,
    reason: null,
  });
});
