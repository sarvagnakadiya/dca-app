// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./Interface/IDCA.sol";
import "./Interface/IWETH9.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DCAForwarder is IDCAForwarder, Ownable {
    IERC20 public tokenIn;
    address public swapRouter;
    address public immutable WETH;
    address public underlyingToken;

    uint256 public feeBps; // in bps (e.g. 100 = 1%)
    address public feeRecipient;

    constructor(
        address _router,
        address _owner,
        address _underlyingToken,
        uint256 _feeBps,
        address _feeRecipient,
        address _weth
    ) Ownable(_owner) {
        swapRouter = _router;
        tokenIn = IERC20(_underlyingToken);
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        WETH = _weth;
        admins[_owner] = true;
    }

    receive() external payable {
        if (msg.sender != WETH) {
            revert OnlyWETHCanSendETH();
        }
    }

    // user => tokenOut => planHash
    mapping(address => mapping(address => bytes32)) public planHash;
    mapping(address => bool) public admins;

    modifier onlyAdmin() {
        if (!admins[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    function createPlan(address tokenOut, address recipient) external {
        if (tokenOut == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();

        bytes32 hash = keccak256(abi.encodePacked(tokenOut, recipient));
        planHash[msg.sender][tokenOut] = hash;

        emit PlanCreated(msg.sender, tokenOut, recipient, hash);
    }

    function cancelPlan(address tokenOut) external {
        bytes32 oldHash = planHash[msg.sender][tokenOut];
        delete planHash[msg.sender][tokenOut];
        emit PlanCancelled(msg.sender, tokenOut, oldHash);
    }

    function updatePlanRecipient(
        address tokenOut,
        address newRecipient
    ) external {
        if (newRecipient == address(0)) revert ZeroAddress();

        bytes32 oldHash = planHash[msg.sender][tokenOut];
        if (oldHash == bytes32(0)) revert PlanMismatch(); // Plan doesn't exist

        bytes32 newHash = keccak256(abi.encodePacked(tokenOut, newRecipient));
        planHash[msg.sender][tokenOut] = newHash;

        emit PlanRecipientUpdated(
            msg.sender,
            tokenOut,
            newRecipient,
            oldHash,
            newHash
        );
    }

    // NOTE: This function is intentionally duplicated (not using internal/shared logic)
    // to maximize gas efficiency during execution. Avoids internal jumps, memory copies,
    // and branching for cheaper runtime cost — since owner pays gas for DCA execution.

    function executeSwap(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external onlyAdmin {
        if (
            planHash[user][tokenOut] !=
            keccak256(abi.encodePacked(tokenOut, recipient))
        ) {
            revert PlanMismatch();
        }

        if (!tokenIn.transferFrom(user, address(this), amountIn)) {
            revert TransferFromFailed();
        }

        if (tokenIn.allowance(address(this), swapRouter) < amountIn) {
            if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                revert ApproveFailed();
            }
        }

        IERC20 outToken = IERC20(tokenOut);
        uint256 before = outToken.balanceOf(address(this));

        (bool success, ) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();

        uint256 afterSwap = outToken.balanceOf(address(this));
        uint256 amountOut = afterSwap - before;
        if (amountOut == 0) revert NoTokenOutReceived();

        if (!outToken.transfer(recipient, amountOut)) {
            revert TransferFailed();
        }

        emit SwapExecuted(user, recipient, tokenOut, amountIn, amountOut, 0);
    }

    function executeNativeSwap(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external onlyAdmin {
        if (
            planHash[user][tokenOut] !=
            keccak256(abi.encodePacked(tokenOut, recipient))
        ) {
            revert PlanMismatch();
        }

        if (!tokenIn.transferFrom(user, address(this), amountIn)) {
            revert TransferFromFailed();
        }

        if (tokenIn.allowance(address(this), swapRouter) < amountIn) {
            if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                revert ApproveFailed();
            }
        }

        IERC20 outToken = IERC20(tokenOut);
        uint256 before = outToken.balanceOf(address(this));

        (bool success, ) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();

        uint256 afterSwap = outToken.balanceOf(address(this));
        uint256 amountOut = afterSwap - before;
        if (amountOut == 0) revert NoTokenOutReceived();

        if (tokenOut == WETH) {
            // If output is WETH, unwrap and send ETH
            IWETH9(WETH).withdraw(amountOut);
            _safeTransferETH(recipient, amountOut);
        } else {
            if (!outToken.transfer(recipient, amountOut)) {
                revert TransferFailed();
            }
        }

        emit SwapExecuted(user, recipient, tokenOut, amountIn, amountOut, 0);
    }

    function executeSwapWithFee(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external onlyAdmin {
        if (
            planHash[user][tokenOut] !=
            keccak256(abi.encodePacked(tokenOut, recipient))
        ) {
            revert PlanMismatch();
        }

        if (!tokenIn.transferFrom(user, address(this), amountIn)) {
            revert TransferFromFailed();
        }

        if (tokenIn.allowance(address(this), swapRouter) < amountIn) {
            if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                revert ApproveFailed();
            }
        }

        IERC20 outToken = IERC20(tokenOut);
        uint256 before = outToken.balanceOf(address(this));

        (bool success, ) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();

        uint256 afterSwap = outToken.balanceOf(address(this));
        uint256 amountOut = afterSwap - before;
        if (amountOut == 0) revert NoTokenOutReceived();

        uint256 sendAmount = amountOut;
        uint256 feeAmount;

        feeAmount = (amountOut * feeBps) / 10_000;
        sendAmount = amountOut - feeAmount;

        if (!outToken.transfer(feeRecipient, feeAmount)) {
            revert FeeTransferFailed();
        }

        if (!outToken.transfer(recipient, sendAmount)) {
            revert TransferFailed();
        }

        emit SwapExecuted(
            user,
            recipient,
            tokenOut,
            amountIn,
            sendAmount,
            feeAmount
        );
    }

    function executeNativeSwapWithFee(
        address user,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        bytes calldata swapData
    ) external onlyAdmin {
        if (
            planHash[user][tokenOut] !=
            keccak256(abi.encodePacked(tokenOut, recipient))
        ) {
            revert PlanMismatch();
        }

        if (!tokenIn.transferFrom(user, address(this), amountIn)) {
            revert TransferFromFailed();
        }

        if (tokenIn.allowance(address(this), swapRouter) < amountIn) {
            if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                revert ApproveFailed();
            }
        }

        IERC20 outToken = IERC20(tokenOut);
        uint256 before = outToken.balanceOf(address(this));

        (bool success, ) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();

        uint256 afterSwap = outToken.balanceOf(address(this));
        uint256 amountOut = afterSwap - before;
        if (amountOut == 0) revert NoTokenOutReceived();

        uint256 sendAmount = amountOut;
        uint256 feeAmount;

        feeAmount = (amountOut * feeBps) / 10_000;
        sendAmount = amountOut - feeAmount;
        if (!outToken.transfer(feeRecipient, feeAmount)) {
            revert FeeTransferFailed();
        }

        if (tokenOut == WETH) {
            // If output is WETH, unwrap and send ETH
            IWETH9(WETH).withdraw(sendAmount);
            _safeTransferETH(recipient, sendAmount);
        } else {
            if (!outToken.transfer(recipient, sendAmount)) {
                revert TransferFailed();
            }
        }

        emit SwapExecuted(user, recipient, tokenOut, amountIn, amountOut, 0);
    }

    function batchExecuteSwaps(SwapPlan[] calldata plans) external onlyAdmin {
        for (uint256 i = 0; i < plans.length; i++) {
            SwapPlan calldata p = plans[i];

            // Verify plan
            if (
                planHash[p.user][p.tokenOut] !=
                keccak256(abi.encodePacked(p.tokenOut, p.recipient))
            ) {
                revert PlanMismatch();
            }

            // Pull tokens
            if (!tokenIn.transferFrom(p.user, address(this), p.amountIn)) {
                revert TransferFromFailed();
            }

            // Approve router if not already
            if (tokenIn.allowance(address(this), swapRouter) < p.amountIn) {
                if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                    revert ApproveFailed();
                }
            }

            // Snapshot balance
            IERC20 outToken = IERC20(p.tokenOut);
            uint256 before = outToken.balanceOf(address(this));

            // Perform swap
            (bool success, ) = swapRouter.call(p.swapData);
            if (!success) revert SwapFailed();

            // Get output
            uint256 afterSwap = outToken.balanceOf(address(this));
            uint256 amountOut = afterSwap - before;
            if (amountOut == 0) revert NoTokenOutReceived();

            if (!outToken.transfer(p.recipient, amountOut)) {
                revert TransferFailed();
            }

            emit SwapExecuted(
                p.user,
                p.recipient,
                p.tokenOut,
                p.amountIn,
                amountOut,
                0
            );
        }
    }

    function batchExecuteNativeSwaps(
        SwapPlan[] calldata plans
    ) external onlyAdmin {
        for (uint256 i = 0; i < plans.length; i++) {
            SwapPlan calldata p = plans[i];

            // Verify plan
            if (
                planHash[p.user][p.tokenOut] !=
                keccak256(abi.encodePacked(p.tokenOut, p.recipient))
            ) {
                revert PlanMismatch();
            }

            // Pull tokens
            if (!tokenIn.transferFrom(p.user, address(this), p.amountIn)) {
                revert TransferFromFailed();
            }

            // Approve router if not already
            if (tokenIn.allowance(address(this), swapRouter) < p.amountIn) {
                if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                    revert ApproveFailed();
                }
            }

            // Snapshot balance
            IERC20 outToken = IERC20(p.tokenOut);
            uint256 before = outToken.balanceOf(address(this));

            // Perform swap
            (bool success, ) = swapRouter.call(p.swapData);
            if (!success) revert SwapFailed();

            // Get output
            uint256 afterSwap = outToken.balanceOf(address(this));
            uint256 amountOut = afterSwap - before;
            if (amountOut == 0) revert NoTokenOutReceived();

            if (p.tokenOut == WETH) {
                // If output is WETH, unwrap and send ETH
                IWETH9(WETH).withdraw(amountOut);
                _safeTransferETH(p.recipient, amountOut);
            } else {
                if (!outToken.transfer(p.recipient, amountOut)) {
                    revert TransferFailed();
                }
            }

            emit SwapExecuted(
                p.user,
                p.recipient,
                p.tokenOut,
                p.amountIn,
                amountOut,
                0
            );
        }
    }

    function batchExecuteSwapsWithFee(
        SwapPlan[] calldata plans
    ) external onlyAdmin {
        for (uint256 i = 0; i < plans.length; i++) {
            SwapPlan calldata p = plans[i];

            // Verify plan
            if (
                planHash[p.user][p.tokenOut] !=
                keccak256(abi.encodePacked(p.tokenOut, p.recipient))
            ) {
                revert PlanMismatch();
            }

            // Pull tokens
            if (!tokenIn.transferFrom(p.user, address(this), p.amountIn)) {
                revert TransferFromFailed();
            }

            // Approve router if not already
            if (tokenIn.allowance(address(this), swapRouter) < p.amountIn) {
                if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                    revert ApproveFailed();
                }
            }

            // Snapshot balance
            IERC20 outToken = IERC20(p.tokenOut);
            uint256 before = outToken.balanceOf(address(this));

            // Perform swap
            (bool success, ) = swapRouter.call(p.swapData);
            if (!success) revert SwapFailed();

            // Get output
            uint256 afterSwap = outToken.balanceOf(address(this));
            uint256 amountOut = afterSwap - before;
            if (amountOut == 0) revert NoTokenOutReceived();

            uint256 sendAmount = amountOut;
            uint256 feeAmount;

            feeAmount = (amountOut * feeBps) / 10_000;
            sendAmount = amountOut - feeAmount;
            if (!outToken.transfer(feeRecipient, feeAmount)) {
                revert FeeTransferFailed();
            }

            if (!outToken.transfer(p.recipient, sendAmount)) {
                revert TransferFailed();
            }

            emit SwapExecuted(
                p.user,
                p.recipient,
                p.tokenOut,
                p.amountIn,
                sendAmount,
                feeAmount
            );
        }
    }

    function batchExecuteNativeSwapsWithFee(
        SwapPlan[] calldata plans
    ) external onlyAdmin {
        for (uint256 i = 0; i < plans.length; i++) {
            SwapPlan calldata p = plans[i];

            // Verify plan
            if (
                planHash[p.user][p.tokenOut] !=
                keccak256(abi.encodePacked(p.tokenOut, p.recipient))
            ) {
                revert PlanMismatch();
            }

            // Pull tokens
            if (!tokenIn.transferFrom(p.user, address(this), p.amountIn)) {
                revert TransferFromFailed();
            }

            // Approve router if not already
            if (tokenIn.allowance(address(this), swapRouter) < p.amountIn) {
                if (!tokenIn.approve(swapRouter, type(uint256).max)) {
                    revert ApproveFailed();
                }
            }

            // Snapshot balance
            IERC20 outToken = IERC20(p.tokenOut);
            uint256 before = outToken.balanceOf(address(this));

            // Perform swap
            (bool success, ) = swapRouter.call(p.swapData);
            if (!success) revert SwapFailed();

            uint256 afterSwap = outToken.balanceOf(address(this));
            uint256 amountOut = afterSwap - before;
            if (amountOut == 0) revert NoTokenOutReceived();

            uint256 sendAmount = amountOut;
            uint256 feeAmount;

            feeAmount = (amountOut * feeBps) / 10_000;
            sendAmount = amountOut - feeAmount;
            if (!outToken.transfer(feeRecipient, feeAmount)) {
                revert FeeTransferFailed();
            }

            if (p.tokenOut == WETH) {
                // If output is WETH, unwrap and send ETH
                IWETH9(WETH).withdraw(sendAmount);
                _safeTransferETH(p.recipient, sendAmount);
            } else {
                if (!outToken.transfer(p.recipient, sendAmount)) {
                    revert TransferFailed();
                }
            }

            emit SwapExecuted(
                p.user,
                p.recipient,
                p.tokenOut,
                p.amountIn,
                sendAmount,
                feeAmount
            );
        }
    }

    // only owner

    function setAdmin(address _newAdmin, bool _isAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert ZeroAddress();
        admins[_newAdmin] = _isAdmin;
    }

    function updateSwapRouter(address newRouter) external onlyOwner {
        swapRouter = newRouter;
    }

    function updateFeeBps(uint256 newFeeBps) external onlyOwner {
        feeBps = newFeeBps;
    }

    function updateUnderlyingToken(
        address newUnderlyingToken
    ) external onlyOwner {
        tokenIn = IERC20(newUnderlyingToken);
        underlyingToken = newUnderlyingToken;
    }

    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        feeRecipient = newFeeRecipient;
    }

    /**
     * @dev Allows owner to withdraw any stuck ETH (emergency function)
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoETHToWithdraw();

        (bool success, ) = owner().call{value: balance}("");
        if (!success) revert ETHWithdrawalFailed();
    }

    // internal function
    /**
     * @dev Safely transfers ETH to a recipient. If the recipient is a contract
     * that doesn't properly handle ETH transfers, it will revert and we'll
     * keep the ETH in this contract.
     */
    function _safeTransferETH(address recipient, uint256 amount) internal {
        if (amount == 0) return;

        // Try to send ETH to the recipient
        (bool success, ) = recipient.call{value: amount}("");

        // If the transfer fails, we don't revert the entire transaction
        // Instead, we emit an event and keep the ETH in this contract
        if (!success) {
            emit ETHTransferFailed(recipient, amount);
        }
    }
}
