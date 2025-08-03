// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Interface for WETH9
interface IWETH9 is IERC20 {
    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;
}
