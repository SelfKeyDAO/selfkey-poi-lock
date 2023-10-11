// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

interface ISelfkeyStaking {

    event StakeAdded(address indexed _account, uint _amount);
    event StakeWithdraw(address indexed _account, uint _amount);
    event RewardWithdrawal(address indexed _account, uint _amount);
    event StakingPaused();
    event StakingResumed();
    event AuthorizedSignerChanged(address indexed _address);

    function updateStakingRewardsStatus(bool _active) external;

    function lastTimeRewardApplicable() external view returns (uint);

    function rewardPerToken() external view returns (uint);

    function totalSupply() external view returns (uint);

    function stake(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer,bytes memory signature) external;

    function withdraw(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer,bytes memory signature) external;

    function earned(address _account) external view returns (uint);

    function notifyRewardWithdraw(address _account, uint _amount) external;

    function withdrawReward(address _account, uint _amount) external;

    function balanceOf(address account) external view returns (uint);

    function setRewardRate(uint _rewardRate) external;
}
