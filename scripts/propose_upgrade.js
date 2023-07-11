// scripts/propose_upgrade.js
const { defender } = require('hardhat');

async function main() {
  const proxyAddress = '';

  const contract = await ethers.getContractFactory("SelfkeyUnclaimedRegistry");
  console.log("Preparing proposal...");
  const proposal = await defender.proposeUpgrade(proxyAddress, contract);
  console.log("Upgrade proposal created at:", proposal.url);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
