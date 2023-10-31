// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

interface ISelfkeyPoiLock {

    event MintableTokenChanged(address _address);

    event StatusChanged(bool _active);

    event AuthorizedSignerChanged(address indexed _address);

    event MinimumLockAmountChanged(uint _amount);

    event MinimumUnlockAmountChanged(uint _amount);

    event MintableTokenRateChanged(uint _rate);

    event LockedAmountAdded(address indexed _account, uint _amount);

    event UnlockAmount(address indexed _account, uint _amount);

    event MintableTokenWithdraw(address indexed _account, uint _amount);

    function setMintableTokenRate(uint _rate) external;

    function updateStatus(bool _active) external;

    function lastTimeRateApplicable() external view returns (uint);

    function MintableTokenPerLockedToken() external view returns (uint);

    function mintableTokenAddress() external view returns (address);

    function minLockAmount() external view returns (uint);

    function setMinLockAmount(uint _amount) external;

    function minUnlockAmount() external view returns (uint);

    function setMinUnlockAmount(uint _amount) external;

    function active() external view returns (bool);

    function mintableRate() external view returns (uint);

    function authorizedSigner() external view returns (address);

    function changeAuthorizedSigner(address _signer) external;

    function totalSupply() external view returns (uint);

    function lock(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer,bytes memory signature) external;

    function unlock(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer,bytes memory signature) external;

    function earned(address _account) external view returns (uint);

    function withdrawMintableToken(address _account, uint _amount) external;

    function balanceOf(address account) external view returns (uint);
}
