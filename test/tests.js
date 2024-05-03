const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function bootUpStaking(contract) {
    await contract.setMintableTokenRate(ethers.utils.parseUnits('10', 18));
    expect(await contract.mintableRate()).to.equal(ethers.utils.parseUnits('10', 18));
    await contract.updateStatus(true);
}

async function stakeParams({ contract, to, amount, timestamp }) {
    const _from = contract.address;
    const _to = to;
    const _amount = ethers.utils.parseUnits(amount, 18);
    const _scope = 'selfkey:staking:stake';
    const _timestamp = timestamp;
    const _param = ethers.utils.hexZeroPad(0, 32);

    let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
    let signature = await signer.signMessage(ethers.utils.arrayify(hash));
    expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);
    return { _from, _to, _amount, _scope, _timestamp, _param, signature };
}


describe("Staking tests", function () {

    let keyContract;
	let selfContract;
    let authContract;
    let contract;

    let owner;
    let addr1;
    let addr2;
    let receiver;
    let signer;
    let addrs;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {
        [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

        let authorizationContractFactory = await ethers.getContractFactory("SelfkeyIdAuthorization");
        authContract = await authorizationContractFactory.deploy(signer.address);

        const totalSupply = ethers.utils.parseUnits('60000000000', 18);
        let keyTokenContractFactory = await ethers.getContractFactory("KeyToken");
        keyContract = await keyTokenContractFactory.deploy(totalSupply);

        let selfTokenContractFactory = await ethers.getContractFactory("SelfToken");
        selfContract = await upgrades.deployProxy(selfTokenContractFactory, []);
        // await selfContract.setStakingContract(contract.address);
        await selfContract.setAuthorizationContract(authContract.address);

        let stakingContractFactory = await ethers.getContractFactory("SelfkeyPoiLock");
        contract = await upgrades.deployProxy(stakingContractFactory, [keyContract.address, authContract.address]);
        await contract.deployed();
        await contract.setMinLockAmount(ethers.utils.parseUnits('1', 18));

        await keyContract.connect(owner).transfer(addr1.address, ethers.utils.parseUnits('1000', 18));
        await keyContract.connect(owner).transfer(addr2.address, ethers.utils.parseUnits('1000', 18));

    });

    describe("Deployment", function() {
        it("Deployed correctly and Selfkey.ID authorization contract was set", async function() {
            expect(await selfContract.symbol()).to.equal('SELF');
            expect(await selfContract.authorizationContractAddress()).to.equal(authContract.address);
            // expect(await selfContract.stakingContract()).to.equal(contract.address);

            expect(await keyContract.symbol()).to.equal('KEY');

            expect(await contract.lockToken()).to.equal(keyContract.address);
            // expect(await contract.mintableToken()).to.equal(selfContract.address);
            expect(await contract.authorizationContract()).to.equal(authContract.address);

            expect(await keyContract.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits('1000', 18));
        });
    });

    describe("Locking", function() {
        it("Can Lock", async function() {
            let expiration = await time.latest();

            await bootUpStaking(contract);

            const _from = contract.address;
            const _to = addr1.address;
            const _amount = ethers.utils.parseUnits('10', 18);
            const _scope = 'selfkey:staking:stake';
            const _timestamp = expiration;
            const _param = ethers.utils.hexZeroPad(0, 32);

            const hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            const signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // 1h in seconds * earn rate of 10 tokens per second
            const expectedEarning = 60 * 60 * 10;
            const earned = await contract.earned(addr1.address);
            expect(earned).to.equal(ethers.utils.parseUnits(`${expectedEarning}`, 18));

            const balance = await contract.balanceOf(addr1.address);
            expect(balance).to.equal(ethers.utils.parseUnits('10', 18));
        });

        it("Mintable tokens are calculated as a share of the pool", async function() {
            let expiration = await time.latest();

            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            // Lock 10 KEY for addr1
            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            _from = contract.address;
            _to = addr2.address;
            _amount = ethers.utils.parseUnits('10', 18);
            _scope = 'selfkey:staking:stake';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);


            // Advance time by 10 seconds and mine a new block
            await time.increase(10);


            // Lock 10 KEY for addr2
            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr2).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr2.address });
            await expect(contract.connect(addr2).lock(addr2.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr2.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr2.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // 1h in seconds * earn rate of 10 tokens per second
            // However in testing each block minting advances time by 2 seconds, so we need to adjust the expected earning for 12 seconds
            const expectedSingleEarning = 10 * 12;

            // During the period (1h) that two stakes were active, the earnings are divided equally between the two addresses
            const expectedSplitEarning = ((60 * 60) * 10) / 2;

            // For addr1 the earnings are the sum of the earnings during the initial period (12s) where addr1 was the unique staker
            // plus the time where both addr1 and addr2 were staking
            const expectedEarningForAddr1 = expectedSingleEarning + expectedSplitEarning;
            const expectedEarningForAddr2 = expectedSplitEarning;

            const earned = await contract.earned(addr1.address);
            const earned2 = await contract.earned(addr2.address);

            expect(earned).to.equal(ethers.utils.parseUnits(`${expectedEarningForAddr1}`, 18));
            expect(earned2).to.equal(ethers.utils.parseUnits(`${expectedEarningForAddr2}`, 18));
        });

        it("Cannot Lock if below minLockAmount", async function() {
            let expiration = await time.latest();

            await contract.setMinLockAmount(ethers.utils.parseUnits('20', 18));
            await bootUpStaking(contract);

            const _from = contract.address;
            const _to = addr1.address;
            const _amount = ethers.utils.parseUnits('10', 18);
            const _scope = 'selfkey:staking:stake';
            const _timestamp = expiration;
            const _param = ethers.utils.hexZeroPad(0, 32);

            const hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            const signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.be.revertedWith("Amount is below minimum");
        });

        it("Can Lock if amount + balance is larger than minLockAmount", async function() {
            let expiration = await time.latest();

            await contract.setMinLockAmount(ethers.utils.parseUnits('10', 18));
            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // 1h in seconds * earn rate of 10 tokens per second
            const expectedEarning = 60 * 60 * 10;
            const earned = await contract.earned(addr1.address);
            expect(earned).to.equal(ethers.utils.parseUnits(`${expectedEarning}`, 18));

            const balance = await contract.balanceOf(addr1.address);
            expect(balance).to.equal(ethers.utils.parseUnits('10', 18));

            await contract.setMinLockAmount(ethers.utils.parseUnits('15', 18));
            expiration = await time.latest();

            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('5', 18);
            _scope = 'selfkey:staking:stake';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);
            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('5', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);
        });

        it("Cannot Lock if amount + balance is below minLockAmount", async function() {
            let expiration = await time.latest();

            await contract.setMinLockAmount(ethers.utils.parseUnits('10', 18));
            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // 1h in seconds * earn rate of 10 tokens per second
            const expectedEarning = 60 * 60 * 10;
            const earned = await contract.earned(addr1.address);
            expect(earned).to.equal(ethers.utils.parseUnits(`${expectedEarning}`, 18));

            const balance = await contract.balanceOf(addr1.address);
            expect(balance).to.equal(ethers.utils.parseUnits('10', 18));

            await contract.setMinLockAmount(ethers.utils.parseUnits('16', 18));
            expiration = await time.latest();

            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('5', 18);
            _scope = 'selfkey:staking:stake';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);
            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('5', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.be.revertedWith("Amount is below minimum");
        });


    });

    describe("Unlock", function() {
        it("Can Unlock", async function() {
            let expiration = await time.latest();

            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('10', 18);
            _scope = 'selfkey:staking:withdraw';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr1).unlock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'UnlockAmount')
                .withArgs(addr1.address, _amount);
        });

        it("Cannot Unlock if less that min unlock setting", async function() {
            let expiration = await time.latest();

            await contract.setMinUnlockAmount(ethers.utils.parseUnits('5', 18));
            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('4', 18);
            _scope = 'selfkey:staking:withdraw';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr1).unlock(addr1.address, ethers.utils.parseUnits('4', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.be.revertedWith("Amount is below minimum");
        });



        it("Cannot partial widthdraw if below min lock amount", async function() {
            let expiration = await time.latest();
            await contract.setMinLockAmount(ethers.utils.parseUnits('10', 18));
            await bootUpStaking(contract);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'selfkey:staking:stake';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).lock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'LockedAmountAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            _timestamp = await time.latest();
            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('5', 18);
            _scope = 'selfkey:staking:withdraw';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr1).unlock(addr1.address, ethers.utils.parseUnits('5', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.be.revertedWith("Amount is below minimum");

            _from = contract.address;
            _to = addr1.address;
            _amount = ethers.utils.parseUnits('10', 18);
            _scope = 'selfkey:staking:withdraw';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(contract.connect(addr1).unlock(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'UnlockAmount')
                .withArgs(addr1.address, ethers.utils.parseUnits('10', 18));

        });

    });
});
