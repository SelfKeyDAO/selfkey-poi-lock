// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./external/IERC20.sol";
import "./external/ISelfkeyIdAuthorization.sol";
import "./ISelfkeyPoiLock.sol";

struct PoiTimeLock {
    uint256 timestamp;
    uint amount;
}

contract SelfkeyPoiLock is Initializable, OwnableUpgradeable, ISelfkeyPoiLock {

    address public authorizedSigner;

    IERC20 public lockToken;
    IERC20 public mintableToken;
    address public mintableTokenAddress;

    ISelfkeyIdAuthorization public authorizationContract;

    // Minimum POI lock amount (governance setting)
    uint public minLockAmount;
    // Minimum POI unlock amount (governance setting)
    uint public minUnlockAmount;
    // Distribution status (governance setting)
    bool public active;
    // Mintable rate per second (governance setting)
    uint public mintableRate;
    // Last checkpoint
    uint public updatedAt;
    // Sum of (mintable rate * dt * 1e18 / total supply)
    uint public MintableTokenPerLockedTokenStored;
    // User address => MintableTokenPerLockedTokenStored
    mapping(address => uint) public userMintableTokenPerLockedTokenPaid;
    // User address => mintable tokens to be claimed
    mapping(address => uint) public mintableTokens;
    // Total staked
    uint public totalSupply;
    // User address => staked amount
    mapping(address => uint) public balanceOf;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _lockToken, address _mintableToken, address _authorizationContract) public initializer {
        __Ownable_init();

        lockToken = IERC20(_lockToken);
        mintableToken = IERC20(_mintableToken);
        authorizationContract = ISelfkeyIdAuthorization(_authorizationContract);
        mintableTokenAddress = _mintableToken;

        // Default governance values
        minLockAmount = 0;
        minUnlockAmount = 0;
        active = false;
    }

    function changeAuthorizedSigner(address _signer) public onlyOwner {
        require(_signer != address(0), "Invalid authorized signer");
        authorizedSigner = _signer;
        emit AuthorizedSignerChanged(_signer);
    }

    function setMinLockAmount(uint _amount) external onlyOwner checkpoint(address(0)) {
        require(_amount > 0, "Invalid amount");
        minLockAmount = _amount;
        updatedAt = block.timestamp;
        emit MinimumLockAmountChanged(_amount);
    }

    function setMinUnlockAmount(uint _amount) external onlyOwner {
        require(_amount > 0, "Invalid amount");
        minUnlockAmount = _amount;
        emit MinimumUnlockAmountChanged(_amount);
    }

    function updateStatus(bool _active) external onlyOwner checkpoint(address(0)) {
        active = _active;
        emit StatusChanged(_active);
    }

    function setMintableTokenRate(uint _rate) external onlyOwner checkpoint(address(0)) {
        require(_rate > 0, "reward rate = 0");
        mintableRate = _rate;
        emit MintableTokenRateChanged(_rate);
    }

    modifier checkpoint(address _account) {
        MintableTokenPerLockedTokenStored = MintableTokenPerLockedToken();
        updatedAt = lastTimeRateApplicable();

        if (_account != address(0)) {
            mintableTokens[_account] = earned(_account);
            userMintableTokenPerLockedTokenPaid[_account] = MintableTokenPerLockedTokenStored;
        }

        _;
    }

    function lastTimeRateApplicable() public view returns (uint) {
        return block.timestamp;
    }

    function MintableTokenPerLockedToken() public view returns (uint) {
        if (totalSupply == 0 || !active) {
            return MintableTokenPerLockedTokenStored;
        }
        return MintableTokenPerLockedTokenStored + (mintableRate * (lastTimeRateApplicable() - updatedAt) * 1e18) / totalSupply;
    }

    function lock(address _account, uint256 _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory _signature) external checkpoint(_account) {
        require(_amount > 0, "Amount is invalid");
        require(_amount >= minLockAmount, "Amount is below minimum");
        require(lockToken.balanceOf(_account) >= _amount, "Not enough funds");

        authorizationContract.authorize(address(this), _account, _amount, 'selfkey:staking:stake', _param, _timestamp, _signer, _signature);

        lockToken.transferFrom(_account, address(this), _amount);
        balanceOf[_account] += _amount;
        totalSupply += _amount;

        emit LockedAmountAdded(_account, _amount);
    }

    function unlock(address _account, uint _amount, bytes32 _param, uint _timestamp, address _signer, bytes memory _signature) external checkpoint(msg.sender) {
        require(_amount > 0, "Amount = 0");
        require(_amount >= minUnlockAmount, "Amount is below minimum");
        require(_amount <= balanceOf[_account], "Not enough funds");
        require(_amount <= availableOf(_account), "Not enough funds available");
        if (_amount != balanceOf[_account]) {
            require((balanceOf[_account] - _amount >= minLockAmount), "Amount is below minimum");
        }

        authorizationContract.authorize(address(this), _account, _amount, 'selfkey:staking:withdraw', _param, _timestamp, _signer, _signature);

        balanceOf[_account] -= _amount;
        totalSupply -= _amount;
        lockToken.transfer(_account, _amount);

        emit UnlockAmount(_account, _amount);
    }

    function earned(address _account) public view returns (uint) {
        uint balance = balanceOf[_account];
        return ((balance * (MintableTokenPerLockedToken() - userMintableTokenPerLockedTokenPaid[_account])) / 1e18) + mintableTokens[_account];
    }

    function availableOf(address _account) public view returns(uint) {
        if (balanceOf[_account] < minLockAmount) {
            return 0;
        }
        return balanceOf[_account];
    }

    // Reward withdrawal for SELF mintable registry
    function withdrawMintableToken(address _account, uint _amount) external checkpoint(_account) {
        require(authorizedSigner == msg.sender, "Not authorized");
        uint current = mintableTokens[_account];
        if (current > 0 && _amount > 0) {
            mintableTokens[_account] = current - _amount;
            emit MintableTokenWithdraw(_account, _amount);
        }
    }

}

