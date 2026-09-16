// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// Helper for the Phase 0 smoke test. Lives in a subdirectory on purpose: the plan's
/// contract layout depends on `contracts/lib/*.sol` resolving as a sibling import in the
/// local node's drop-in compiler, and this proves that before any real game code exists.
library ProbeLib {
    function reservedProfit(uint256 wager) internal pure returns (uint256) {
        return wager;
    }

    /// Demo mapping only — a real game uses rejection sampling (RANDOMNESS_DICE.md).
    function winFromRandomness(bytes32 randomness) internal pure returns (bool) {
        return uint8(randomness[0]) < 128;
    }
}
