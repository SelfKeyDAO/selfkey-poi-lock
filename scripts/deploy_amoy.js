const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Amoy addresses
    const authContractAddress = "0xD52F36ba65381Ef24240515E0452c178e556DfD4";
    const keyContractAddress = "0x579Eb512A935A47105D7006FF69F67e9b8e8eB9f";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPoiLock");
    const contract = await upgrades.deployProxy(contractFactory, [keyContractAddress, authContractAddress], { timeout: 500000 });
    await contract.deployed();

    const signer = "0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9";
    console.log("Controller wallet address:", signer);
    await contract.changeAuthorizedSigner(signer);

    console.log("Deployed contract address:", contract.address);

    // INFO: verify contract after deployment
    // npx hardhat verify --network amoy 0x076c1B1758A77F5f51Ef2616e97d00fC6350A8Bc
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
