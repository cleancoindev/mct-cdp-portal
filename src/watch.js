import ilks from './references/ilkList';
import { createCDPSystemModel } from './reducers/multicall/system';
import cdpTypeModel from './reducers/multicall/feeds';
import accountModel, {
  accountBalanceForToken,
  accountAllowanceForToken
} from './reducers/multicall/accounts';
import { tokensWithBalances } from 'reducers/accounts';
import savingsModel from './reducers/multicall/savings';
import { isMissingContractAddress } from './utils/ethereum';
import flatten from 'lodash/flatten';

let watcher;

export async function updateWatcherWithProxy(
  maker,
  currentAddress,
  proxyAddress
) {
  const addresses = maker.service('smartContract').getContractAddresses();
  addresses.MDAI = addresses.MCD_DAI;
  addresses.MWETH = addresses.ETH;

  await watcher.tap(calls =>
    [
      ...calls,
      ...(currentAddress
        ? flatten(
            tokensWithBalances
              .filter(token => token && token.symbol !== 'ETH')
              .map(token =>
                accountAllowanceForToken(
                  addresses,
                  token,
                  currentAddress,
                  proxyAddress
                )
              )
          )
        : [])
    ].filter(callData => !isMissingContractAddress(callData))
  );
}

export function createWatcher(maker) {
  const service = maker.service('multicall');
  service.createWatcher();
  watcher = service.watcher;
  window.watcher = watcher;
  return watcher;
}

export async function startWatcher(maker) {
  let currentAddress;
  let proxyAddress;
  try {
    currentAddress = maker.currentAddress();
    proxyAddress = await maker.currentProxy();
  } catch (err) {}

  const addresses = maker.service('smartContract').getContractAddresses();

  // add additional lookups for easier mapping when finding address
  // by token symbol
  addresses.MDAI = addresses.MCD_DAI;
  addresses.MWETH = addresses.ETH;

  // do our best to attach state listeners to this new network
  watcher.tap(() => {
    return [
      ...createCDPSystemModel(addresses),
      ...flatten(ilks.map(ilk => cdpTypeModel(addresses, ilk))),
      ...savingsModel(addresses),
      ...(currentAddress && proxyAddress
        ? accountModel(addresses, currentAddress, proxyAddress)
        : []),
      ...(currentAddress
        ? flatten(
            tokensWithBalances
              .filter(token => token !== 'ETH') // we poll for this manually as we cannot use multicall. This ETH actually refers to MWETH.
              .map(token =>
                accountBalanceForToken(
                  addresses,
                  token,
                  currentAddress,
                  proxyAddress
                )
              )
          )
        : [])
    ].filter(calldata => !isMissingContractAddress(calldata)); // (limited by the addresses we have)
  });
  watcher.start();

  return watcher;
}

export function getWatcher() {
  return watcher;
}

// watcher
//   .onNetworkTrouble(() => {
//     store.dispatch({ type: 'PROBLEM_FETCHING_STATE' });
//   })
//   .onResolution(() => {
//     store.dispatch({ type: 'NETWORK_PROBLEMS_RESOLVED' });
//   });
