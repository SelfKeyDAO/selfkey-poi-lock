const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const proxyAddress = "0xa376189030da57b32AaF85629169889cE669C543";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPoiLock");
    const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory);
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);


    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0xa376189030da57b32AaF85629169889cE669C543
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
