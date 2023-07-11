const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

function getTimestamp() {
    let oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const mseconds = oneYearFromNow.getTime();
    const seconds = Math.floor(mseconds / 1000);
    const dateInSecs = Math.floor(oneYearFromNow / 1000);
    return dateInSecs;
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
        selfContract = await selfTokenContractFactory.deploy(authContract.address);

        let stakingContractFactory = await ethers.getContractFactory("SelfkeyStaking");
        contract = await stakingContractFactory.deploy(keyContract.address, selfContract.address, authContract.address);

        await selfContract.setStakingContract(contract.address);

        await keyContract.connect(owner).transfer(addr1.address, ethers.utils.parseUnits('1000', 18));
        await keyContract.connect(owner).transfer(addr2.address, ethers.utils.parseUnits('1000', 18));

    });

    describe("Deployment", function() {
        it("Deployed correctly and Selfkey.ID authorization contract was set", async function() {
            expect(await selfContract.symbol()).to.equal('SELF');
            expect(await selfContract.authorizationContract()).to.equal(authContract.address);
            expect(await selfContract.stakingContract()).to.equal(contract.address);

            expect(await keyContract.symbol()).to.equal('KEY');

            expect(await contract.stakingToken()).to.equal(keyContract.address);
            expect(await contract.rewardsToken()).to.equal(selfContract.address);
            expect(await contract.authorizationContract()).to.equal(authContract.address);

            expect(await keyContract.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits('1000', 18));
        });
    });

    describe("Staking", function() {
        it("Can stake", async function() {
            let expiration = await time.latest();

            let ts = 604800;

            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);

            const rewardAmount = ethers.utils.parseUnits('51141552.5', 18);
            await contract.notifyRewardAmount(rewardAmount);

            const _from = contract.address;
            const _to = addr1.address;
            const _amount = ethers.utils.parseUnits('10', 18);
            const _scope = 'mint:lock:staking';
            const _timestamp = expiration;
            const _param = ethers.utils.hexZeroPad(0, 32);

            const hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            const signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // mine a new block with timestamp `newTimestamp`
            //await helpers.time.increaseTo(newTimestamp);

            // set the timestamp of the next block but don't mine a new block
            //await helpers.time.setNextBlockTimestamp(newTimestamp);

            // 304414002976190476190400
            // 30441400297619040000

            const earned = await contract.earned(addr1.address);
            expect(earned).to.equal('304414002976190476190400');
            const balance = await contract.balanceOf(addr1.address);
            expect(balance).to.equal(ethers.utils.parseUnits('10', 18));
        })

        it("Earned rewards is divided by the stake pool", async function() {
            const provider = ethers.getDefaultProvider()
            //const lastBlockNumber = await provider.getBlockNumber()
            //const lastBlock = await provider.getBlock(lastBlockNumber)
            let expiration = await time.latest();

            let ts = 31536000;

            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);

            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'mint:lock:staking';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            _from = contract.address;
            _to = addr2.address;
            _amount = ethers.utils.parseUnits('10', 18);
            _scope = 'mint:lock:staking';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr2).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr2.address });
            await expect(contract.connect(addr2).stake(addr2.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr2.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr2.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // mine a new block with timestamp `newTimestamp`
            //await helpers.time.increaseTo(newTimestamp);

            // set the timestamp of the next block but don't mine a new block
            //await helpers.time.setNextBlockTimestamp(newTimestamp);

            const earned = await contract.earned(addr1.address);
            const earned2 = await contract.earned(addr2.address);

            expect(earned).to.equal(ethers.utils.parseUnits('0.114282090309487250', 18));
            expect(earned2).to.equal(ethers.utils.parseUnits('0.114155251141552200', 18));
        })
    });

    describe("Widthdrawal", function() {
        it("Can widthdraw if timelock has passed", async function() {
            let expiration = await time.latest();

            let ts = 31536000;
            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);
            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);
            await contract.setTimeLockDuration(3500);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'mint:lock:staking';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            // mine a new block with timestamp `newTimestamp`
            //await helpers.time.increaseTo(newTimestamp);

            // set the timestamp of the next block but don't mine a new block
            //await helpers.time.setNextBlockTimestamp(newTimestamp);

            const earned = await contract.earned(addr1.address);

            expect(earned).to.equal(ethers.utils.parseUnits('0.228310502283104400', 18));

            await expect(contract.connect(addr1).withdraw(_amount, { from: addr1.address }))
                .to.emit(contract, 'StakeWithdraw')
                .withArgs(addr1.address, _amount);
        });

        it("Cannot widthdraw if timelock has not passed", async function() {
            let expiration = await time.latest();

            let ts = 31536000;
            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);
            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);
            await contract.setTimeLockDuration(3500);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'mint:lock:staking';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(2100);

            // mine a new block with timestamp `newTimestamp`
            //await helpers.time.increaseTo(newTimestamp);

            // set the timestamp of the next block but don't mine a new block
            //await helpers.time.setNextBlockTimestamp(newTimestamp);

            const earned = await contract.earned(addr1.address);

            expect(earned).to.equal(ethers.utils.parseUnits('0.133181126331810900', 18));

            await expect(contract.connect(addr1).withdraw(_amount, { from: addr1.address }))
                .to.be.revertedWith("Not enough funds available");
        });

        it("Can partial widthdraw if timelock has passed", async function() {
            let expiration = await time.latest();

            let ts = 31536000;
            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);
            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);
            await contract.setTimeLockDuration(3500);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'mint:lock:staking';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            _timestamp = await time.latest();
            _amount = ethers.utils.parseUnits('20', 18);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('20', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('20', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            await time.increase(100);
            const balance = (await contract.availableOf(addr1.address));
            expect(balance).to.equal(ethers.utils.parseUnits('10', 18));

            // mine a new block with timestamp `newTimestamp`
            //await helpers.time.increaseTo(newTimestamp);

            // set the timestamp of the next block but don't mine a new block
            //await helpers.time.setNextBlockTimestamp(newTimestamp);

            await expect(contract.connect(addr1).withdraw(ethers.utils.parseUnits('10', 18), { from: addr1.address }))
                .to.emit(contract, 'StakeWithdraw')
                .withArgs(addr1.address, ethers.utils.parseUnits('10', 18));
        });

    });
    /*
    describe("Minting", function() {
        it("Can mint on-chain staking rewards", async function() {
            const provider = ethers.getDefaultProvider()
            const lastBlockNumber = await provider.getBlockNumber()
            const lastBlock = await provider.getBlock(lastBlockNumber)
            let expiration = lastBlock.timestamp;

            let ts = 3153600;

            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);

            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await contract.connect(addr1).stake(ethers.utils.parseUnits('10', 18), { from: addr1.address });

            await keyContract.connect(addr2).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr2.address });
            await contract.connect(addr2).stake(ethers.utils.parseUnits('10', 18), { from: addr2.address });

            // advance time by one hour and mine a new block
            await time.increase(3600);

            const earned = await contract.earned(addr1.address);
            console.log(earned);
            const earned2 = 94874380;

            const _from = selfContract.address;
            const _to = addr1.address;
            const _amount = earned;
            const _scope = 'mint:lock:staking';
            const _timestamp = expiration;
            const _param = ethers.utils.hexZeroPad(earned.toHexString(), 32);
            //const _param = ethers.utils.hexZeroPad(earned2, 32);

            const hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            const signature = await signer.signMessage(ethers.utils.arrayify(hash));

            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(selfContract.connect(addr1).mint(_to, _amount, _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(selfContract, 'Transfer')
                .withArgs(ZERO_ADDRESS, addr1.address, _amount);

            expect(await selfContract.balanceOf(addr1.address)).to.equal(earned);

            expect(await contract.earned(addr1.address)).to.equal(317097919837640);
        });
    });
    */

    describe("Off-chain rewards Minting", function() {
        it("Can mint staking and off-chain rewards", async function() {
            const provider = ethers.getDefaultProvider()
            let expiration = await time.latest();

            let ts = 3153600;

            await contract.setRewardsDuration(ts);
            expect(await contract.duration()).to.equal(ts);

            const rewardAmount = ethers.utils.parseUnits('2000', 18);
            await contract.notifyRewardAmount(rewardAmount);

            let _from = contract.address;
            let _to = addr1.address;
            let _amount = ethers.utils.parseUnits('10', 18);
            let _scope = 'mint:lock:staking';
            let _timestamp = expiration;
            let _param = ethers.utils.hexZeroPad(0, 32);

            let hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            let signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr1).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr1.address });
            await expect(contract.connect(addr1).stake(addr1.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr1.address, _amount);

            _from = contract.address;
            _to = addr2.address;
            _amount = ethers.utils.parseUnits('10', 18);
            _scope = 'mint:lock:staking';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(0, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));
            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await keyContract.connect(addr2).approve(contract.address, ethers.utils.parseUnits('10', 18), { from: addr2.address });
            await expect(contract.connect(addr2).stake(addr2.address, ethers.utils.parseUnits('10', 18), _param, _timestamp, signer.address, signature, { from: addr2.address }))
                .to.emit(contract, 'StakeAdded')
                .withArgs(addr2.address, _amount);

            // advance time by one hour and mine a new block
            await time.increase(3600);

            const earned = await contract.earned(addr1.address);
            const offchain_earned = ethers.utils.parseEther("1142820903094874380");

            _from = selfContract.address;
            _to = addr1.address;
            _amount = earned + offchain_earned;
            _scope = 'mint:lock:staking';
            _timestamp = expiration;
            _param = ethers.utils.hexZeroPad(earned.toHexString(), 32);
            //const _param = ethers.utils.hexZeroPad(earned2, 32);

            hash = await authContract.getMessageHash(_from, _to, _amount, _scope, _param, _timestamp);
            signature = await signer.signMessage(ethers.utils.arrayify(hash));

            expect(await authContract.verify(_from, _to, _amount, _scope, _param, _timestamp, signer.address, signature)).to.equal(true);

            await expect(selfContract.connect(addr1).mint(_to, _amount, _param, _timestamp, signer.address, signature, { from: addr1.address }))
                .to.emit(selfContract, 'Transfer')
                .withArgs(ZERO_ADDRESS, addr1.address, _amount);

            expect(await selfContract.balanceOf(addr1.address)).to.equal(earned + offchain_earned);

            expect(await contract.earned(addr1.address)).to.equal(317097919837640);
        })

    });
});
