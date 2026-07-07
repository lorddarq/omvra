const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCodesignDetails,
  validateMacReleaseSignature,
} = require('./build-electron-with-tag-version.cjs');

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
