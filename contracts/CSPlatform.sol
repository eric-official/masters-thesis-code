// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract CSPlatform {

    enum ContributionStatus {Created, Assigned, Reviewed}
    enum ContributionResult {None, Approved, Rejected}

    struct Contribution {
        address participant;
        address reviewer;
        string imageUrl;
        bytes coordinates;
        ContributionStatus status;
        ContributionResult result;
    }

    struct User {
        uint reputation;
        uint openContributions;
        bool openReview;
        bool exists;
    }

    Contribution[] public unassignedContributions;
    Contribution[] public assignedContributions;
    Contribution[] public reviewedContributions;
    uint[] public freeContributionsIdx;

    mapping(address => User) public users;

    uint public minReviewReputation = 5;

    event ContributionCreated(address indexed participant, string imageUrl);
    event ContributionAssigned(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl);
    event CoordinateUpdated(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl, bytes coordinates);
    event ContributionReviewed(uint indexed contributionId, address indexed participant, address indexed reviewer, string imageUrl, ContributionResult result);

    constructor() {
        users[msg.sender] = User(
            minReviewReputation,
            0,
            false,
            true
        );
    }

    function createContribution(string memory _imageUrl) public {
        Contribution memory contribution = Contribution(
            msg.sender,
            address(0),
            _imageUrl,
            "",
            ContributionStatus.Created,
            ContributionResult.None
        );
        unassignedContributions.push(contribution);

        if (users[msg.sender].exists == false) {
            users[msg.sender] = User(
                0,
                0,
                false,
                true
            );
        }
        users[msg.sender].openContributions++;
        emit ContributionCreated(msg.sender, _imageUrl);
    }

    // TODO: Implement random number with Chainlink VRF
    function assignContribution() public unassignedContributionExists {
        uint random = uint256(keccak256(abi.encodePacked(
                tx.origin,
                blockhash(block.number - 1),
                block.timestamp
            ))) % unassignedContributions.length;

        Contribution memory contribution = unassignedContributions[random];

        // Replace assigned contribution and delete last element
        unassignedContributions[random] = unassignedContributions[unassignedContributions.length - 1];
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
        require(contribution.participant == msg.sender, "Only the reviewer can exchange coordinates");
        contribution.coordinates = _coordinates;
        assignedContributions[_contributionId] = contribution;
        emit CoordinateUpdated(_contributionId, msg.sender, contribution.reviewer, contribution.imageUrl, _coordinates);
    }

    function reviewContribution(uint _contributionId, bool _realImage, bool _correctCoordinates) public {
        Contribution storage contribution = assignedContributions[_contributionId];

        if (_realImage && _correctCoordinates) {
            contribution.result = ContributionResult.Approved;
            users[contribution.participant].reputation++;
        } else {
            contribution.result = ContributionResult.Rejected;
            users[contribution.participant].reputation--;
            freeContributionsIdx.push(_contributionId);
        }

        contribution.status = ContributionStatus.Reviewed;
        assignedContributions[_contributionId] = contribution;

        users[contribution.reviewer].openReview = false;
        users[contribution.participant].openContributions--;

        emit ContributionReviewed(_contributionId, contribution.participant, contribution.reviewer, contribution.imageUrl, contribution.result);
    }

    modifier unassignedContributionExists() {
        require(unassignedContributions.length > 0, "No unassigned contributions available");
        _;
    }
}