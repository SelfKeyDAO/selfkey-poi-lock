const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyUnclaimedRegistry");
    const contract = await upgrades.deployProxy(contractFactory, []);
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);

    const signer = "0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9";
    console.log("Signer address:", signer);
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
