// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICasinoGameV2, SessionContext, SessionPhase, StepResult} from './ICasinoGameV2.sol';
import {ProbeLib} from './lib/ProbeLib.sol';

/// Phase 0 smoke test only — NOT a game. It exists to prove four things before any real
/// contract work starts:
///   1. the drop-in watcher compiles a hand-written file that implements ICasinoGameV2,
///   2. a sibling *subdirectory* import (`./lib/...`) resolves (the plan's layout depends on it),
///   3. the built contract deploys and registers without constructor arguments,
///   4. the documented phase-transition rules hold (WAITING_RANDOMNESS requires
///      requestRandomnessNow = true; the settling step must not release the reserve).
contract PhaseZeroProbe is ICasinoGameV2 {
    error PhaseZeroProbe__NoPlayerAction();

    function quoteCaps(
        uint256 wager,
        bytes calldata
    ) external pure returns (uint256 maxEscrowStake, uint256 maxReservedProfit) {
        return (wager, ProbeLib.reservedProfit(wager));
    }

    function quoteRiskParams(
        uint256 wager,
        bytes calldata
    )
        external
        pure
        returns (
            uint256 maxPayout,
            uint256 probabilityWad,
            uint256 expectedPayout,
            uint256 subJackpotVarianceScaled
        )
    {
        // 2x worst case, 50% win probability, 98% RTP — same shape as the coinflip.
        return (wager * 2, 5e17, (wager * 9800) / 10_000, 0);
    }

    function onSessionStart(
        SessionContext calldata ctx
    ) external pure returns (StepResult memory result) {
        result.newGameState = abi.encode(ctx.wagerBase, uint8(0));
        result.reservedProfitDelta = int256(ProbeLib.reservedProfit(ctx.wagerBase));
        result.nextPhase = SessionPhase.WAITING_RANDOMNESS;
        result.requestRandomnessNow = true;
    }

    function onPlayerAction(
        SessionContext calldata,
        bytes calldata
    ) external pure returns (StepResult memory) {
        revert PhaseZeroProbe__NoPlayerAction();
    }

    function onRandomness(
        SessionContext calldata ctx,
        bytes32 randomness
    ) external pure returns (StepResult memory result) {
        bool won = ProbeLib.winFromRandomness(randomness);
        result.newGameState = abi.encode(ctx.wagerBase, won);
        // Settling step: deltas stay 0 so the cap is not lowered before the payout check.
        result.nextPhase = SessionPhase.SETTLED;
        result.requestRandomnessNow = false;
        result.payout = won ? ctx.wagerBase * 2 : 0;
    }

    function quoteForfeitPayout(SessionContext calldata) external pure returns (uint256) {
        return 0;
    }
}
