const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const proxyAddress = "0xda9783A24fa2D9aC452246b96029A9d1d40ECFE1";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyStaking");
    const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory);
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);


    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0xda9783A24fa2D9aC452246b96029A9d1d40ECFE1
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
