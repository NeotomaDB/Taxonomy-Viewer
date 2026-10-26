import assert from 'node:assert/strict';
import test from 'node:test';

import { formatNameMatchHeading } from '../src/searchPresentation.js';

test('labels search counts as name matches', () => {
  assert.equal(formatNameMatchHeading(8), '8 name matches');
  assert.equal(formatNameMatchHeading(1), '1 name match');
  assert.equal(formatNameMatchHeading(0), '0 name matches');
});
