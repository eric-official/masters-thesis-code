const { ethers } = require('hardhat')


/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {
    const CSPlatformFactory = await ethers.getContractFactory("CSPlatform");
    const CSPlatform = await CSPlatformFactory.deploy();
    await CSPlatform.waitForDeployment();

    const [account1, account2] = await ethers.getSigners();
    const imageUrl = "http://example.com"; // Replace with actual image URL
    console.log("Account 1 address: ", account1.address);
    console.log("Account 2 address: ", account2.address);

    const createContributionResponse1 = await CSPlatform.connect(account1).createContribution(imageUrl);
    const createContributionReceipt1 = await createContributionResponse1.wait();
    const [createContributionEvent1] = createContributionReceipt1.logs;
    const [contributionParticipant1, contributionImage1, contributionId1] = createContributionEvent1.args;
    console.log("Contribution created: ", contributionParticipant1, contributionImage1, contributionId1.toString());

    const createContributionResponse2 = await CSPlatform.connect(account1).createContribution(imageUrl);
    const createContributionReceipt2 = await createContributionResponse2.wait();
    const [createContributionEvent2] = createContributionReceipt2.logs;
    const [contributionParticipant2, contributionImage2, contributionId2] = createContributionEvent2.args;
    console.log("Contribution created: ", contributionParticipant2, contributionImage2, contributionId2.toString());

    const createContributionResponse3 = await CSPlatform.connect(account1).createContribution(imageUrl);
    const createContributionReceipt3 = await createContributionResponse3.wait();
    const [createContributionEvent3] = createContributionReceipt3.logs;
    const [contributionParticipant3, contributionImage3, contributionId3] = createContributionEvent3.args;
    console.log("Contribution created: ", contributionParticipant3, contributionImage3, contributionId3.toString());

    // Call assignContribution function with account2
    const assignContributionResponse = await CSPlatform.connect(account2).assignContribution();
    const assignContributionReceipt = await assignContributionResponse.wait();
    const [assignContributionEvent] = assignContributionReceipt.logs;
    const [contributionParticipant, contributionImage, contributionId, contributionReviewer] = assignContributionEvent.args;
    console.log("Contribution assigned: ", contributionParticipant, contributionImage, contributionId.toString(), contributionReviewer);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });