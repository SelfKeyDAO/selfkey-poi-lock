# Selfkey POI lock

The SelfkeyPoiLock contract implements a staking-like mechanism where users lock KEY tokens (referred to as lockToken) and earn rewards in a yet unmintend token (referred to as mintableToken)

## Overview:
- Token Locking: Users can lock KEY ERC20 token (lockToken) into the contract and earn rewards in the form of a mintable token (mintableToken).

- Authorization Mechanism: The contract requires the use of an external authorization contract that validates a signature passed to the lock and unlocking functions. This signature is obtained via the Selfkey Authorization Flow.

- Governance-Controlled Parameters: Several key settings like the minimum lock/unlock amount, reward rate, and staking status can be updated by the contract owner.

- Upgradeable Design: The contract uses OpenZeppelin's upgradeable proxy pattern, ensuring that it can be upgraded in the future without redeploying.

## Key State Variables:
- authorizedSigner: An address that is allowed to initiate mintable token withdrawals on behalf of stakers. This is used to deduct the amount of mintable tokens in the registry when the user mints them.

- lockToken: The ERC20 token that users lock in the contract.

- mintableToken: The ERC20 token that users earn as rewards for staking (KEY)

- minLockAmount / minUnlockAmount: The minimum amount of tokens that users must lock or unlock, respectively, controlled by the owner for governance.

- mintableRate: The rate at which the mintable token is distributed to stakers, measured in tokens per second.

- active: A boolean that controls whether staking is active or paused.


## Core Functionalities:
- Staking (lock): Users can lock tokens by calling the lock function.
The amount staked must meet or exceed the minLockAmount. Upon locking, the user's balance and the total supply of locked tokens increase, and they start accruing rewards.

- Unstaking (unlock): Users can unlock their staked tokens, provided they meet the minUnlockAmount and other conditions, such as having sufficient available balance. Similar to staking, unlocking requires authorization via the ISelfkeyIdAuthorization contract.
The staked balance and total supply are decreased accordingly.

- Rewards Calculation (earned): Rewards are calculated based on the amount of time tokens have been staked and the rate at which rewards are distributed (mintableRate).
A checkpoint system is used to track reward accrual for each user, ensuring that rewards are updated periodically without recalculating for every transaction.

- Mintable Token Withdrawal (withdrawMintableToken): An authorized signer can withdraw the mintable token rewards for a user, reducing the user's accrued mintable tokens.
This function is restricted to the authorized signer only, preventing unauthorized withdrawals.

## Governance Functions (Owner-Only):
The contract owner can update several key parameters, including:
- Changing the mintable token address (changeMintableToken).
- Updating the authorized signer (changeAuthorizedSigner).
- Adjusting the minimum lock/unlock amounts (setMinLockAmount, setMinUnlockAmount).
- Setting the reward rate (setMintableTokenRate).
- Activating or deactivating the staking functionality (updateStatus).


## Reward Distribution Model:
The contract uses a reward distribution model based on the time staked. The reward for each user is proportional to the time their tokens are locked in the contract.
The core formula for reward distribution involves the MintableTokenPerLockedTokenStored variable, which tracks the cumulative reward rate over time.
Users' rewards are calculated based on the difference between the current reward rate and the reward rate when they last interacted with the contract (tracked via userMintableTokenPerLockedTokenPaid).


## Checkpointing System:
The checkpoint mechanism ensures that the reward calculation is efficient. Each time a user stakes or unstakes tokens, or when rewards are claimed, their earned rewards are calculated and stored. This prevents the need for recalculating rewards from scratch every time the contract is accessed.


## Security Features:
Authorization Contract: Ensures that only valid users can lock/unlock tokens using a signature-based verification. This is part of the Selfkey Identity and Authorization Flow.

Upgradeable Contract: Uses OpenZeppelin’s Initializable and Ownable patterns to enable safe upgrades.

Governance Controls: The contract includes several owner-only functions that allow for flexible control of reward distribution and staking parameters.

## Events:
- MintableTokenChanged: Emitted when the mintable token is changed.
- AuthorizedSignerChanged: Emitted when the authorized signer is updated.
- MinimumLockAmountChanged / MinimumUnlockAmountChanged: Emitted when lock/unlock limits are adjusted.
- StatusChanged: Emitted when staking status is toggled on/off.
- MintableTokenRateChanged: Emitted when the mintable token reward rate is changed.
- LockedAmountAdded / UnlockAmount: Emitted when users lock or unlock their tokens.
- MintableTokenWithdraw: Emitted when mintable tokens are withdrawn by an authorized signer.

