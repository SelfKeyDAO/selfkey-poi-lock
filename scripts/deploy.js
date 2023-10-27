const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Mumbai addresses
    const authContractAddress = "0x1e4BBcF6c10182C03c66bDA5BE6E04509bE1160F";
    const selfContractAddress = "0x4bf6902f681E679E436b9bb2addbF330B04050e4";
    const keyContractAddress = "0xe74bc8805df4a6a2ccedd934a818088ccb7a5de6";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPoiLock");
    const contract = await upgrades.deployProxy(contractFactory, [keyContractAddress, selfContractAddress, authContractAddress]);
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);

    const signer = "0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9";
    console.log("Controller wallet address:", signer);
    await contract.changeAuthorizedSigner(signer);


    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0x076c1B1758A77F5f51Ef2616e97d00fC6350A8Bc
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
