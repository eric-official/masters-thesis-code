// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import { SD59x18, sd, unwrap } from "@prb/math/src/SD59x18.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract CSPlatform {

    enum ContributionStatus {Created, Assigned, Reviewed}
    enum ContributionResult {Punished, Rejected, Accepted, None}

    struct Contribution {
        address participant;
        address reviewer;
        string imageUrl;
        uint timestamp;
        bytes coordinates;
        string[] animalSpecies;
        ContributionStatus status;
        ContributionResult result;
        SD59x18 dataQuality;
        address verifier;
    }

    struct User {
        SD59x18 reputation;
        uint nContributions;
        uint nReviews;
        uint openContributions;
        bool openReview;
        bool exists;
    }

    Contribution[] public unassignedContributions;
    Contribution[] public assignedContributions;
    uint[] public freeContributionsIdx;

    mapping(address => User) public users;

    SD59x18 public reviewReputation = sd(0.70e18);
    SD59x18 public banReputation = sd(-0.70e18);

    event ContributionCreated(address indexed participant, string imageUrl);
    event ContributionAssigned(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl);
    event CoordinateUpdated(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl, bytes coordinates);
    event ContributionReviewed(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl, int result);
    event VerifierUpdated(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl, address verifier);

    constructor() {
        users[msg.sender] = User(
            reviewReputation,
            0,
            0,
            0,
            false,
            true
        );
    }

    function createContribution(string memory _imageUrl, uint _timestamp, string[] memory _animalSpecies) public {
        Contribution memory contribution = Contribution(
            msg.sender,
            address(0),
            _imageUrl,
            _timestamp,
            "",
            _animalSpecies,
            ContributionStatus.Created,
            ContributionResult.None,
            sd(0.00e18),
            address(0)
        );
        unassignedContributions.push(contribution);

        if (users[msg.sender].exists == false) {
            users[msg.sender] = User(
                sd(0.00e18),
                0,
                0,
                0,
                false,
                true
            );
        }
        users[msg.sender].openContributions++;
        emit ContributionCreated(msg.sender, _imageUrl);
    }

    // TODO: Implement random number with Chainlink VRF and increase quality
    function assignContribution() public unassignedContributionExists {
        uint randomIndex = uint256(keccak256(abi.encodePacked(
                tx.origin,
                blockhash(block.number - 1),
                block.timestamp
            ))) % unassignedContributions.length;

        Contribution memory contribution = unassignedContributions[randomIndex];

        // Replace assigned contribution and delete last element
        unassignedContributions[randomIndex] = unassignedContributions[unassignedContributions.length - 1];
        unassignedContributions.pop();

        contribution.reviewer = msg.sender;
        contribution.status = ContributionStatus.Assigned;

        if (freeContributionsIdx.length == 0) {
            assignedContributions.push(contribution);
        } else {
            assignedContributions[freeContributionsIdx[freeContributionsIdx.length - 1]] = contribution;
            freeContributionsIdx.pop();
        }

        users[msg.sender].openReview = true;
        uint assignedContributionsIndex = assignedContributions.length - 1;
        emit ContributionAssigned(assignedContributionsIndex, contribution.participant, msg.sender, contribution.imageUrl);
    }

    function updateCoordinates(uint _contributionId, bytes memory _coordinates) public {
        Contribution storage contribution = assignedContributions[_contributionId];
        contribution.coordinates = _coordinates;
        assignedContributions[_contributionId] = contribution;
        emit CoordinateUpdated(_contributionId, msg.sender, contribution.reviewer, contribution.imageUrl, _coordinates);
    }

    /*function reviewContribution(uint _contributionId, int _urlAssessment, int _timestampAssessment, int _coordinatesAssessment, int _animalSpeciesAssessment, int _imageAssessment) public {
        Contribution storage contribution = assignedContributions[_contributionId];
        int resultInt;

        if (_urlAssessment == -1 || _timestampAssessment == -1 || _coordinatesAssessment == -1 || _animalSpeciesAssessment == -1) {
            contribution.result = ContributionResult.Punished;
            freeContributionsIdx.push(_contributionId);
            resultInt = -1;
        } else if (_urlAssessment == 0 || _timestampAssessment == 0 || _coordinatesAssessment == 0 || _animalSpeciesAssessment == 0) {
            contribution.result = ContributionResult.Rejected;
            freeContributionsIdx.push(_contributionId);
            resultInt = 0;
        } else {
            contribution.result = ContributionResult.Accepted;
            resultInt = 1;
            users[contribution.participant].nContributions++;
        }

        contribution.dataQuality = calculateDataQuality(resultInt, _imageAssessment);
        SD59x18 participantMultiplier = calculateMultiplier(users[contribution.participant].nContributions, users[contribution.participant].nReviews);
        SD59x18 reviewerMultiplier = calculateMultiplier(users[contribution.reviewer].nContributions, users[contribution.reviewer].nReviews);
        SD59x18 participantReputation = calculateReputation(contribution.dataQuality, participantMultiplier, users[contribution.participant].reputation);
        SD59x18 reviewerReputation = calculateReputation(sd(0.005e18), reviewerMultiplier, users[msg.sender].reputation);

        contribution.status = ContributionStatus.Reviewed;
        assignedContributions[_contributionId] = contribution;

        users[contribution.participant].openContributions--;
        users[contribution.participant].reputation = participantReputation;
        users[contribution.reviewer].openReview = false;
        users[contribution.reviewer].nReviews++;
        users[contribution.reviewer].reputation = reviewerReputation;

        console.log(contribution.participant);
        console.logInt(int256(SD59x18.unwrap(participantMultiplier) / 1e17));
        console.logInt(int256(SD59x18.unwrap(participantReputation)));


    emit ContributionReviewed(_contributionId, contribution.participant, contribution.reviewer, contribution.imageUrl, 1);
    }*/

    function reviewContribution(uint _contributionId, int _urlAssessment, int _timestampAssessment, int _coordinatesAssessment, int _animalSpeciesAssessment, int _imageAssessment) public {
        Contribution storage contribution = assignedContributions[_contributionId];
        int resultInt = calculateReviewResult(_urlAssessment, _timestampAssessment, _coordinatesAssessment, _animalSpeciesAssessment);
        contribution.dataQuality = calculateDataQuality(resultInt, _imageAssessment);
        updateReviewedContribution(contribution, resultInt, _contributionId);
        updateReviewUsers(contribution);

        //console.log(contribution.participant);
        //console.logInt(int256(SD59x18.unwrap(users[contribution.participant].reputation)));
        emit ContributionReviewed(_contributionId, contribution.participant, contribution.reviewer, contribution.imageUrl, 1);
    }

    function updateVerifier(address _verifier, uint _contributionId) public {
        Contribution storage contribution = assignedContributions[_contributionId];
        contribution.verifier = _verifier;
        assignedContributions[_contributionId] = contribution;
        emit VerifierUpdated(_contributionId, contribution.participant, contribution.reviewer, contribution.imageUrl, _verifier);
    }

    function calculateReviewResult(int _urlAssessment, int _timestampAssessment, int _coordinatesAssessment, int _animalSpeciesAssessment) private pure returns (int) {
        if (_urlAssessment == -1 || _timestampAssessment == -1 || _coordinatesAssessment == -1 || _animalSpeciesAssessment == -1) {
            return -1;
        } else if (_urlAssessment == 0 || _timestampAssessment == 0 || _coordinatesAssessment == 0 || _animalSpeciesAssessment == 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function updateReviewedContribution(Contribution storage contribution, int resultInt, uint _contributionId) private {
        if (resultInt == -1) {
            contribution.result = ContributionResult.Punished;
            freeContributionsIdx.push(_contributionId);
        } else if (resultInt == 0) {
            contribution.result = ContributionResult.Rejected;
            freeContributionsIdx.push(_contributionId);
        } else {
            contribution.result = ContributionResult.Accepted;
        }
        contribution.status = ContributionStatus.Reviewed;
    }

    function updateReviewUsers(Contribution storage contribution) private {
        SD59x18 participantMultiplier = calculateMultiplier(users[contribution.participant].nContributions, users[contribution.participant].nReviews);
        SD59x18 reviewerMultiplier = calculateMultiplier(users[contribution.reviewer].nContributions, users[msg.sender].nReviews);
        SD59x18 participantReputation = calculateReputation(contribution.dataQuality, participantMultiplier, users[contribution.participant].reputation);
        SD59x18 reviewerReputation = calculateReputation(sd(0.005e18), reviewerMultiplier, users[msg.sender].reputation);

        if (contribution.result == ContributionResult.Accepted) {
            users[contribution.participant].nContributions++;
        }
        users[contribution.participant].openContributions--;
        users[contribution.participant].reputation = participantReputation;
        users[msg.sender].openReview = false;
        users[msg.sender].nReviews++;
        users[msg.sender].reputation = reviewerReputation;
    }

    function calculateDataQuality(int _result, int _imageAssessment) private pure returns (SD59x18) {
        SD59x18 dataQuality;
        if (_result == -1) {
            dataQuality = SD59x18.wrap(-1.00e18);
        } else if (_result == 0) {
            dataQuality = sd(0.00e18);
        } else if (_result == 1) {
            SD59x18 imageAssessment = sd(_imageAssessment * 1e18);
            dataQuality = sd(1e18).mul(imageAssessment).div(sd(5e18));
        }
    return dataQuality;
    }

    function calculateMultiplier(uint _nContributions, uint _nReviews) private pure returns (SD59x18) {
        SD59x18 multiplier = sd(1e18).add(sd(int(_nContributions) * 1e17).add(sd(int(_nReviews) * 1e16)));
        return multiplier;
    }

    function calculateReputation(SD59x18 _dataQuality, SD59x18 _multiplier, SD59x18 _reputation) private pure returns (SD59x18) {
        // Step 1: Compute the linear combination: DQ_k * m_i + r_i
        SD59x18 linearCombination = _dataQuality.mul(_multiplier).add(_reputation);

        // Step 2: Compute the exponent: exp(-linearCombination)
        SD59x18 exponent = linearCombination.mul(sd(-1e18)).exp();

        // Step 3: Compute the denominator: 1 + exp(-linearCombination)
        SD59x18 denominator = sd(1e18).add(exponent); // 1e18 represents 1 in SD59x18

        // Step 4: Compute the fraction: 2 / denominator
        SD59x18 fraction = sd(2e18).div(denominator); // 2e18 represents 2 in SD59x18

        // Step 5: Subtract 1 from the result: fraction - 1
        SD59x18 result = fraction.sub(sd(1e18)); // 1e18 represents 1 in SD59x18

        return result;
    }


    modifier unassignedContributionExists() {
        require(unassignedContributions.length > 0, "No unassigned contributions available");
        _;
    }
}