# LockDao Staking contract

## Overview


## Development

All smart contracts are implemented in Solidity `^0.8.9`, using [Hardhat](https://hardhat.org/) as the Solidity development framework.

### Prerequisites

* [NodeJS](htps://nodejs.org), v16.1.0+
* [Hardhat](https://hardhat.org/), which is a comprehensive framework for Ethereum development.

### Initialization

    npm install

### Testing

    npx hardhat test


### Mumbai Contract addresses

    - MOCK KEY: 0x79F08CC52D4458ffd75F9f9b842ef3538bb2B55E
    - LOCK: 0x97b95620A123E3565fe83feafD195E7a62c6314b
    - AUTHORIZATION: 0x1e4BBcF6c10182C03c66bDA5BE6E04509bE1160F
    - LOCKDAO STAKING: 0xb122e6dDF6e7b477bb7E5B53f5c32818fd5B172F

### Mumbai Authorized Signer

   - 0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9

### Deploy Sequence

   - Deploy authorization contract (with authorized signer)
        - `npx hardhat run scripts/deploy_authorization.js --network polygon`
        - `npx hardhat verify --network polygon 0x3f79eCB11Ed9d45140D4C05CC6A7e2F91D032026 0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9`
   - Deploy LOCK (with authorization contract address)
        - `npx hardhat run scripts/deploy_lock.js --network polygon`
        - `npx hardhat verify --network polygon 0x44E3aa5b391D79F24B9da3419d4EA8Df6526d1f0 0x3f79eCB11Ed9d45140D4C05CC6A7e2F91D032026`
   - Deploy Staking (with key address, lock address and authorization address)
        - `npx hardhat run scripts/deploy_staking.js --network polygon`
        - `npx hardhat verify --network polygon 0xC4375F8169DA1008243c080514f06C7c07097fFb 0xc629d02732ee932db1fa83e1fcf93ae34abfc96b 0x44E3aa5b391D79F24B9da3419d4EA8Df6526d1f0 0x3f79eCB11Ed9d45140D4C05CC6A7e2F91D032026`
   - Set staking contract on Lock
        - `npx hardhat run scripts/set_lock_staking_callback.js --network polygon`
   - Set Minimum KEY staking
        - `npx hardhat run scripts/change_min_stake_amount.js --network polygon`
   - Boot Staking
        - `npx hardhat run scripts/boot_staking_period.js --network polygon`
        - `npx hardhat run scripts/boot_staking_supply.js --network polygon`

