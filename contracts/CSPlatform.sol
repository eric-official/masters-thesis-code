// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract CSPlatform {

    enum ContributionStatus {Created, Assigned, Reviewed}
    enum ContributionResult {Approved, Rejected}

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

    Contribution[] public contributions;

    mapping(address => User) public users;

    uint public minReviewReputation = 5;

    event ContributionCreated(address indexed participant, string imageUrl, uint indexed contributionId);
    event ContributionAssigned(address indexed participant, string imageUrl, uint indexed contributionId, address indexed reviewer);
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
            ContributionResult.Rejected
        );
        contributions.push(contribution);

        if (users[msg.sender].exists == false) {
            users[msg.sender] = User(
                0,
                0,
                false,
                true
            );
        }
        users[msg.sender].openContributions++;
        emit ContributionCreated(msg.sender, _imageUrl, contributions.length - 1);
    }

    // TODO: Implement random number with Chainlink VRF
    function assignContribution() public {
        uint random = uint256(keccak256(abi.encodePacked(
                tx.origin,
                blockhash(block.number - 1),
                block.timestamp
            ))) % contributions.length;

        Contribution storage contribution = contributions[random];
        contribution.reviewer = msg.sender;
        contribution.status = ContributionStatus.Assigned;
        contributions[random] = contribution;

        users[msg.sender].openReview = true;
        emit ContributionAssigned(contribution.participant, contribution.imageUrl, random, msg.sender);
    }

    function exchangeCoordinates(uint _contributionId, string memory _coordinates) public {
        Contribution storage contribution = contributions[_contributionId];
        require(contribution.reviewer == msg.sender, "Only the reviewer can exchange coordinates");
        contribution.coordinates = _coordinates;
        contributions[_contributionId] = contribution;
        emit CoordinatesExchanged(_contributionId, _coordinates);
    }
}