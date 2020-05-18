import React from 'react';
import { cleanup } from '@testing-library/react';
import waitForExpect from 'wait-for-expect';
import { renderWithProviders } from '../../../test/helpers/render';
import TestMakerProvider from '../../../test/helpers/TestMakerProvider';
import useTaker from '../useTaker';

// This helper component allows us to call the hook in a component context.
function TestHook({ callback }) {
  callback();
  return null;
}

function testHookWithMakerProvider(callback) {
  renderWithProviders(
    <TestMakerProvider>
      <TestHook callback={callback} />
    </TestMakerProvider>
  );
}

let useMakerHookValue;
beforeAll(() => {
  testHookWithMakerProvider(() => (useMakerHookValue = useTaker()));
});

afterEach(cleanup);

// we allow up to 10 seconds for this
// test will throw a warning, see here for explanation:
// https://github.com/testing-library/react-testing-library/issues/281#issuecomment-480349256
test('MakerProvider sets up taker instance', async () => {
  await waitForExpect(() => {
    expect(useMakerHookValue.taker).toBeTruthy();
  }, 10000);
}, 10500);