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
        string coordinates;
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

    mapping(address => User) public users;

    uint public minReviewReputation = 5;

    event ContributionCreated(address indexed participant, string imageUrl);
    event ContributionAssigned(uint indexed contributionId, address indexed participant, string imageUrl, address indexed reviewer);
    event CoordinatesExchanged(uint indexed contributionId, string coordinates);

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
        assignedContributions.push(contribution);

        users[msg.sender].openReview = true;
        uint assignedContributionsIndex = assignedContributions.length - 1;
        emit ContributionAssigned(assignedContributionsIndex, contribution.participant, contribution.imageUrl, msg.sender);
    }

    function updateCoordinates(uint _contributionId, string memory _coordinates) public {
        Contribution storage contribution = assignedContributions[_contributionId];
        require(contribution.reviewer == msg.sender, "Only the reviewer can exchange coordinates");
        contribution.coordinates = _coordinates;
        assignedContributions[_contributionId] = contribution;
        emit CoordinatesExchanged(_contributionId, _coordinates);
    }

    modifier unassignedContributionExists() {
        require(unassignedContributions.length > 0, "No unassigned contributions available");
        _;
    }
}