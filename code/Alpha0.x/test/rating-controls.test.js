import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('the feedback editor uses five whole-star radio choices instead of a dropdown', async () => {
  const source = await readFile(path.resolve(here, '../ui/js/views/library-view.js'), 'utf8');
  const start = source.indexOf('function ratingOptions(');
  const end = source.indexOf('\nfunction feedbackStatusText', start);
  const ratingControl = source.slice(start, end);
  assert.match(ratingControl, /for \(let value = 1; value <= 5; value \+= 1\)/);
  assert.match(ratingControl, /type: 'radio'/);
  assert.match(ratingControl, /onchange: \(\) => \{[\s\S]*onChange\(value\)/);
  assert.match(ratingControl, /fieldset\.dataset\.rating = String\(value\)/);
  assert.match(ratingControl, /'data-value': String\(value\)/);
  assert.doesNotMatch(ratingControl, /'aria-hidden': 'true', text: String\(value\)/);
  assert.doesNotMatch(ratingControl, /labeledSelect|0\.5|toFixed/);
});

test('circle styling progressively fills every choice through the selected rating', async () => {
  const css = await readFile(path.resolve(here, '../ui/css/components.css'), 'utf8');
  assert.match(css, /\.atnr-rating-fieldset\[data-rating="3"\] \.atnr-rating-choice:is\(\[data-value="1"\], \[data-value="2"\], \[data-value="3"\]\)/);
  assert.match(css, /\.atnr-rating-fieldset\[data-rating="5"\] \.atnr-rating-choice\s*{/);
  assert.match(css, /\.atnr-rating-choice\s*{[^}]*border-radius:\s*50%/s);
  assert.match(css, /\.atnr-rating-input\s*{[^}]*clip:\s*rect\(0, 0, 0, 0\)/s);
});

test('whole-star summaries omit a trailing decimal while legacy halves remain truthful', async () => {
  const source = await readFile(path.resolve(here, '../ui/js/private-store.js'), 'utf8');
  assert.match(source, /Number\.isInteger\(record\.overallRating\) \? record\.overallRating : record\.overallRating\.toFixed\(1\)/);
});
