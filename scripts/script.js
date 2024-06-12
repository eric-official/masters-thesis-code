const {hre, ethers} = require('hardhat')
var Table = require('cli-table3')
var colors = require('@colors/colors');


/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {

    // Deploy CSPlatform contract
    console.log("Deploying CSPlatform...");
    const CSPlatformFactory = await ethers.getContractFactory("CSPlatform");
    const CSPlatform = await CSPlatformFactory.deploy();
    await CSPlatform.waitForDeployment();
    console.log("CSPlatform deployed to:", await CSPlatform.getAddress());
    console.log(" ");

    // Set variables
    const imageUrl = "http://example.com"; // Replace with actual image URL
    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;
    let connectedWallets = [];

    // Create 5 wallets and send 10 ETH to each wallet
    console.log("Create wallets...");
    var table = new Table({
        head: [colors.blue('Wallet'), colors.blue('Public Key'), colors.blue('Private Key'), colors.blue('Balance in ETH')]
    });

    for (let i = 0; i < 5; i++) {

        // Create wallets
        let wallet = ethers.Wallet.createRandom();
        let connectedWallet = wallet.connect(provider);
        let tx = await signer.sendTransaction({to: connectedWallet.address, value: ethers.parseEther("10")});
        await tx.wait();
        connectedWallets.push(connectedWallet);

        // Display wallets
        let walletName = "Wallet " + (i + 1);
        let walletAddress = connectedWallet.address;
        let wallletPrivateKey = connectedWallet.privateKey;
        let walletBalance = await provider.getBalance(connectedWallet.address);
        table.push([walletName, walletAddress, wallletPrivateKey, ethers.formatEther(walletBalance)]);

    }

    console.log(table.toString());
    console.log("Wallets created!");
    console.log(" ");

    const createContributionResponse1 = await CSPlatform.connect(connectedWallets[0]).createContribution(imageUrl);
    const createContributionReceipt1 = await createContributionResponse1.wait();
    const [createContributionEvent1] = createContributionReceipt1.logs;
    const [contributionParticipant1, contributionImage1, contributionId1] = createContributionEvent1.args;
    console.log("Contribution created: ", contributionParticipant1, contributionImage1, contributionId1.toString());

    const createContributionResponse2 = await CSPlatform.connect(connectedWallets[0]).createContribution(imageUrl);
    const createContributionReceipt2 = await createContributionResponse2.wait();
    const [createContributionEvent2] = createContributionReceipt2.logs;
    const [contributionParticipant2, contributionImage2, contributionId2] = createContributionEvent2.args;
    console.log("Contribution created: ", contributionParticipant2, contributionImage2, contributionId2.toString());

    const createContributionResponse3 = await CSPlatform.connect(connectedWallets[0]).createContribution(imageUrl);
    const createContributionReceipt3 = await createContributionResponse3.wait();
    const [createContributionEvent3] = createContributionReceipt3.logs;
    const [contributionParticipant3, contributionImage3, contributionId3] = createContributionEvent3.args;
    console.log("Contribution created: ", contributionParticipant3, contributionImage3, contributionId3.toString());

    // Call assignContribution function with account2
    const assignContributionResponse = await CSPlatform.connect(connectedWallets[1]).assignContribution();
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