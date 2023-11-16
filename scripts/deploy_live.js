const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Polygon addresses
    const authContractAddress = "0x9928D9e849317983760a61FC486696001f387C6E";
    const keyContractAddress = "0x32dC2dD3C2bE453a369625e6Fe0E438aeD814919";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPoiLock");
    const contract = await upgrades.deployProxy(contractFactory, [keyContractAddress, authContractAddress], { timeout: 500000 });
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);

    const signer = "0xb9A775aeef418ed43B6529Fa9695daF28899156e";
    console.log("Controller wallet address:", signer);
    await contract.changeAuthorizedSigner(signer);


    // INFO: verify contract after deployment
    // npx hardhat verify --network polygon 0x076c1B1758A77F5f51Ef2616e97d00fC6350A8Bc
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
