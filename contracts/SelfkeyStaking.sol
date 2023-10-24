// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./external/IERC20.sol";
import "./external/ISelfkeyIdAuthorization.sol";
import "./ISelfkeyStaking.sol";

struct StakingTimeLock {
    uint256 timestamp;
    uint amount;
}

contract SelfkeyStaking is Initializable, OwnableUpgradeable, ISelfkeyStaking {

    address public authorizedSigner;

    IERC20 public stakingToken;
    IERC20 public rewardsToken;
    ISelfkeyIdAuthorization public authorizationContract;
    address public rewardsTokenAddress;

    uint public minStakeAmount;
    uint public minWithdrawAmount;
    uint public timeLockDuration;

    bool public active;
    // Minimum of last updated time and reward finish time
    uint public updatedAt;
    // Reward to be paid out per second
    uint public rewardRate;
    // Sum of (reward rate * dt * 1e18 / total supply)
    uint public rewardPerTokenStored;
    // User address => rewardPerTokenStored
    mapping(address => uint) public userRewardPerTokenPaid;
    // User address => rewards to be claimed
    mapping(address => uint) public rewards;

    mapping(address => StakingTimeLock[]) private _timeLockEntries;

    // Total staked
    uint public totalSupply;
    // User address => staked amount
    mapping(address => uint) public balanceOf;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakingToken, address _rewardToken, address _authorizationContract) public initializer {
        __Ownable_init();

        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardToken);
        authorizationContract = ISelfkeyIdAuthorization(_authorizationContract);
        rewardsTokenAddress = _rewardToken;

        minStakeAmount = 0;
        minWithdrawAmount = 0;
        timeLockDuration = 0;
        active = false;
    }

    function changeAuthorizedSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "Invalid authorized signer");
        authorizedSigner = _signer;
        emit AuthorizedSignerChanged(_signer);
    }

    function setMinStakeAmount(uint _amount) external onlyOwner updateReward(address(0)) {
        require(_amount > 0, "Invalid amount");
        minStakeAmount = _amount;
        updatedAt = block.timestamp;
        emit MinimumStakeAmountChanged(_amount);
    }

    function setMinWithdrawAmount(uint _amount) external onlyOwner {
        require(_amount > 0, "Invalid amount");
        minWithdrawAmount = _amount;
        emit MinimumWithdrawAmountChanged(_amount);
    }

    function setTimeLockDuration(uint _duration) external onlyOwner {
        require(_duration > 0, "Invalid duration");
        timeLockDuration = _duration;
        emit TimeLockDurationChanged(_duration);
    }

    function updateStakingRewardsStatus(bool _active) external onlyOwner updateReward(address(0)) {
        active = _active;
        updatedAt = block.timestamp;
        if (active) {
            emit StakingResumed();
        }
        else {
            emit StakingPaused();
        }
    }

        function setRewardRate(uint _rate) external onlyOwner updateReward(address(0)) {
        require(_rate > 0, "reward rate = 0");
        rewardRate = _rate;
        updatedAt = block.timestamp;
        emit RewardRateChanged(_rate);
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint) {
        return block.timestamp;
    }

    function rewardPerToken() public view returns (uint) {
        if (totalSupply == 0 || !active) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) / totalSupply;
    }

    // Stake KEY
    function stake(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory signature) external updateReward(_account) {
        require(_amount > 0, "Amount is invalid");
        require(_amount >= minStakeAmount, "Amount is below minimum");
        require(stakingToken.balanceOf(_account) >= _amount, "Not enough funds");

        authorizationContract.authorize(address(this), _account, _amount, 'selfkey:staking:stake', _param, _timestamp, _signer, signature);

        stakingToken.transferFrom(_account, address(this), _amount);
        balanceOf[_account] += _amount;
        totalSupply += _amount;

        _timeLockEntries[_account].push(StakingTimeLock(block.timestamp + timeLockDuration, _amount));

        emit StakeAdded(_account, _amount);
    }

    // Withdraw Staked KEY
    function withdraw(address _account, uint _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory signature) external updateReward(msg.sender) {
        require(_amount > 0, "Amount = 0");
        require(_amount >= minWithdrawAmount, "Amount is below minimum");
        require(_amount <= balanceOf[_account], "Not enough funds");
        require(_amount <= availableOf(_account), "Not enough funds available");
        if (_amount != balanceOf[_account]) {
            require((balanceOf[_account] - _amount >= minStakeAmount), "Amount is below minimum");
        }

        authorizationContract.authorize(address(this), _account, _amount, 'selfkey:staking:withdraw', _param, _timestamp, _signer, signature);

        balanceOf[_account] -= _amount;
        totalSupply -= _amount;
        stakingToken.transfer(_account, _amount);

        emit StakeWithdraw(_account, _amount);
    }

    function earned(address _account) public view returns (uint) {
        return ((balanceOf[_account] * (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) + rewards[_account];
    }

    function availableOf(address _account) public view returns(uint) {
        uint _available = 0;
        uint _balance = balanceOf[_account];
        StakingTimeLock[] memory _accountRecords = _timeLockEntries[_account];
        for(uint i=0; i<_accountRecords.length; i++) {
            StakingTimeLock memory _record = _accountRecords[i];
            if (_record.timestamp < block.timestamp) {
                _available = _available + _record.amount;
            }
        }
        return _available < _balance ? _available : _balance;
    }

    function notifyRewardWithdraw(address _account, uint _amount) external updateReward(_account) {
        require(msg.sender == rewardsTokenAddress, "Invalid");
        uint reward = rewards[_account];
        if (reward > 0 && _amount > 0) {
            rewards[_account] = reward - _amount;
            emit RewardWithdraw(_account, _amount);
        }
    }

    function withdrawReward(address _account, uint _amount) external updateReward(_account) {
        require(authorizedSigner == msg.sender, "Not authorized");
        uint reward = rewards[_account];
        if (reward > 0 && _amount > 0) {
            rewards[_account] = reward - _amount;
            emit RewardWithdraw(_account, _amount);
        }
    }

    /*
    function setRewardRate(uint _rate) external onlyOwner updateReward(address(0)) {
        // require(finishAt < block.timestamp, "reward duration not finished");
        require(_rate > 0, "reward rate = 0");
        rewardRate = _rate;
        // finishAt = block.timestamp + duration;
        updatedAt = block.timestamp;
    }

    function _min(uint x, uint y) private pure returns (uint) {
        return x <= y ? x : y;
    }
    */
}
