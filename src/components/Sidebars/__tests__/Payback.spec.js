import React, { useEffect, useState } from 'react';
import {
  cleanup,
  waitForElement,
  fireEvent,
  act
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { BAT, USD, MTAO } from '@takertao/tao-plugin-mct';
import { createCurrencyRatio } from '@makerdao/currency';
import { TestAccountProvider, mineBlocks } from '@makerdao/test-helpers';
import * as math from '@takertao/tao-plugin-mct/dist/math';
import waitForExpect from 'wait-for-expect';

import Payback from '../Payback';
import { renderWithMaker } from '../../../../test/helpers/render';
import useTaker from '../../../hooks/useTaker';
import lang from '../../../languages';

jest.mock('react-navi', () => ({
  useCurrentRoute: () => ({ url: { pathname: '/test' } })
}));

afterEach(cleanup);

const ILK = 'ETH-A';
const LIQUIDATION_RATIO = '200';
const COL_AMT = 300.123456789012345678;

const collateralAmount = BAT(0); //only used to retrieve gem symbol
const liquidationRatio = createCurrencyRatio(USD, MTAO)(LIQUIDATION_RATIO);
const collateralValue = USD(12004.938271560493);

const mockVault = {
  id: 1,
  collateralType: ILK,
  debtValue: MTAO(0),
  daiAvailable: MTAO(36.014814),
  vaultType: ILK,
  collateralAmount,
  liquidationRatio,
  collateralValue,
  collateralAvailableAmount: BAT(COL_AMT),
  collateralTypePrice: createCurrencyRatio(USD, BAT)(40.0),
  calculateLiquidationPrice: ({ debtValue: _debtValue }) =>
    math.liquidationPrice(collateralAmount, _debtValue, liquidationRatio),
  calculateCollateralizationRatio: ({ debtValue: _debtValue }) =>
    math
      .collateralizationRatio(collateralValue, _debtValue)
      .times(100)
      .toNumber()
};

let web3;

const SetupProxyAndAllowance = () => {
  const [changedAccount, setAccountChanged] = useState(false);
  const { taker } = useTaker();
  web3 = taker.service('web3');

  const changeAccount = async () => {
    const accountService = maker.service('accounts');
    TestAccountProvider.setIndex(345);
    const { key } = TestAccountProvider.nextAccount();
    await accountService.addAccount('noproxy', { type: 'privateKey', key });
    accountService.useAccount('noproxy');
    setAccountChanged(true);
  };

  useEffect(() => {
    changeAccount();
  }, []);

  return changedAccount ? <Payback vault={mockVault} /> : <div />;
};

test('proxy toggle', async () => {
  const { getByTestId } = renderWithMaker(<SetupProxyAndAllowance />);
  const [proxyToggle, allowanceToggle] = await Promise.all([
    waitForElement(() => getByTestId('proxy-toggle')),
    waitForElement(() => getByTestId('allowance-toggle'))
  ]);

  expect(proxyToggle).toHaveTextContent(lang.action_sidebar.create_proxy);
  expect(allowanceToggle).toHaveTextContent(
    lang.formatString(lang.action_sidebar.unlock_token, 'DAI')
  );

  const proxyButton = proxyToggle.children[1];
  const allowanceButton = allowanceToggle.children[1];
  expect(proxyButton).toBeEnabled();
  expect(allowanceButton).toBeDisabled();

  act(() => {
    fireEvent.click(proxyButton);
  });

  expect(proxyToggle).toHaveTextContent(lang.action_sidebar.creating_proxy);
  await waitForExpect(async () => {
    await mineBlocks(web3, 3);
    expect(proxyToggle).toHaveTextContent(lang.action_sidebar.proxy_created);
  }, 20000);

  expect(allowanceToggle).toBeEnabled();
}, 25000);

// commented out for now because this doesn't seem to work well with allowances
// from multicall
xtest('allowance toggle', async () => {
  const { getByTestId, queryByTestId } = renderWithMaker(
    <SetupProxyAndAllowance />
  );

  await waitForElement(() => getByTestId('toggle-container'));
  expect(queryByTestId('proxy-toggle')).toBeNull();
  expect(queryByTestId('allowance-toggle')).not.toBeNull();

  const allowanceToggle = getByTestId('allowance-toggle');
  const allowanceButton = allowanceToggle.children[1];

  act(() => {
    fireEvent.click(allowanceButton);
  });

  expect(allowanceToggle).toHaveTextContent(
    lang.formatString(lang.action_sidebar.unlocking_token, 'DAI')
  );
  await mineBlocks(web3);
  expect(allowanceToggle).toHaveTextContent(
    lang.formatString(lang.action_sidebar.token_unlocked, 'TAO')
  );
});

test('basic rendering', async () => {
  const { getByText } = renderWithMaker(<Payback vault={mockVault} />);

  // this waits for the initial proxy & allowance check to finish
  await waitForElement(() => getByText(/Unlock TAO/));

  // these throw errors if they don't match anything
  getByText('Pay Back TAO');
  // getByText('7.5 TAO'); // art * rate from mock state
});
