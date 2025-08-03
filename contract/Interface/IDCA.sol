// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDCAForwarder {
    // used for batch transaction only
    struct SwapPlan {
        address user;
        address tokenOut;
        address recipient;
        uint256 amountIn;
        bytes swapData;
    }

    // Events
    event PlanCreated(
        address indexed user,
        address tokenOut,
        address recipient,
        bytes32 planHash
    );

    event PlanCancelled(
        address indexed user,
        address tokenOut,
        bytes32 planHash
    );

    event PlanRecipientUpdated(
        address indexed user,
        address tokenOut,
        address newRecipient,
        bytes32 oldHash,
        bytes32 newHash
    );

    event SwapExecuted(
        address indexed user,
        address recipient,
        address toToken,
        uint256 amountIn,
        uint256 indexed amountOut,
        uint256 feeAmount
    );

    event ETHTransferFailed(address indexed recipient, uint256 amount);

    // Custom Errors
    error Unauthorized();
    error ZeroAddress();
    error PlanMismatch();
    error TransferFromFailed();
    error ApproveFailed();
    error SwapFailed();
    error NoTokenOutReceived();
    error TransferFailed();
    error FeeTransferFailed();
    error NoETHToWithdraw();
    error ETHWithdrawalFailed();
    error OnlyWETHCanSendETH();

    // State changing functions
    function createPlan(address tokenOut, address recipient) external;
    function cancelPlan(address tokenOut) external;
    function updatePlanRecipient(
        address tokenOut,
        address newRecipient
    ) external;

    function updateFeeRecipient(address newFeeRecipient) external;
    function updateFeeBps(uint256 newFeeBps) external;
    function updateUnderlyingToken(address newUnderlyingToken) external;
    function updateSwapRouter(address newRouter) external;

    // single swap functions
    function executeSwap(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external;
    function executeNativeSwap(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external;
    function executeSwapWithFee(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external;
    function executeNativeSwapWithFee(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external;

    // batch functions
    function batchExecuteSwaps(SwapPlan[] calldata plans) external;
    function batchExecuteNativeSwaps(SwapPlan[] calldata plans) external;
    function batchExecuteSwapsWithFee(SwapPlan[] calldata plans) external;
    function batchExecuteNativeSwapsWithFee(SwapPlan[] calldata plans) external;

    // View functions
    function swapRouter() external view returns (address);
    function underlyingToken() external view returns (address);
    function feeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);
    function planHash(
        address user,
        address tokenOut
    ) external view returns (bytes32);
}
