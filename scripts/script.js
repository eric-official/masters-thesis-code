const {hre, ethers} = require('hardhat')
const Table = require('cli-table3')
const colors = require('@colors/colors');
const eccrypto = require('eccrypto');


/**
 * Create wallets and send 10 ETH to each wallet
 * @param numWallets - Number of wallets to create
 * @param signer - Signer
 * @param provider - Ethers provider
 * @returns {Promise<Array.<ethers.Wallet>>}
 * @type {(numWallets: number, signer: ethers.Signer, provider: ethers.HardhatEthersProvider) => Promise<Array.<ethers.Wallet>>}
 */
async function createWallets(numWallets, signer, provider) {
    let connectedWallets = [];

    for (let i = 0; i < numWallets; i++) {
        let wallet = ethers.Wallet.createRandom();
        let connectedWallet = wallet.connect(provider);
        let tx = await signer.sendTransaction({to: connectedWallet.address, value: ethers.parseEther("10")});
        await tx.wait();
        connectedWallets.push(connectedWallet);
    }

    return connectedWallets;
}


async function splitWallets(connectedWallets, participantReviewerRatio) {
    const cutoffIndex = connectedWallets.length * participantReviewerRatio;
    const participantWallets = connectedWallets.slice(0, cutoffIndex);
    const reviewerWallets = connectedWallets.slice(cutoffIndex, connectedWallets.length + 1);

    return [participantWallets, reviewerWallets];
}


/**
 * Display created wallets
 * @param participantWallets - Array of wallets for participants to execute transactions
 * @param reviewerWallets - Array of wallets for reviewer to execute transactions
 * @param provider - Ethers provider
 * @returns {Promise<void>}
 * @type {(connectedWallets: Array.<ethers.Wallet>, provider: ethers.HardhatEthersProvider) => Promise<void>}
 */
async function displayWallets(participantWallets, reviewerWallets, provider) {
    const columns = [
        colors.blue('Wallet'),
        colors.blue('User Group'),
        colors.blue('Public Key'),
        colors.blue('Private Key'),
        colors.blue('Balance in ETH'),
    ];
    const table = new Table({
        head: columns
    });

    for (let i = 0; i < participantWallets.length; i++) {
        let walletName = "Wallet " + (i + 1);
        let walletAddress = participantWallets[i].address;
        let walletPrivateKey = participantWallets[i].privateKey;
        let walletBalance = await provider.getBalance(participantWallets[i].address);
        table.push([walletName, "Participant", walletAddress, walletPrivateKey, ethers.formatEther(walletBalance)]);
    }

    for (let i = 0; i < reviewerWallets.length; i++) {
        let walletName = "Wallet " + (i + participantWallets.length + 1);
        let walletAddress = reviewerWallets[i].address;
        let walletPrivateKey = reviewerWallets[i].privateKey;
        let walletBalance = await provider.getBalance(reviewerWallets[i].address);
        table.push([walletName, "Reviewer", walletAddress, walletPrivateKey, ethers.formatEther(walletBalance)]);
    }

    console.log(table.toString());
}


async function createContributions(numContributions, CSPlatform, participantWallets, imageUrl) {
    for (let i = 0; i < numContributions; i++) {
        const participantIndex = (i + participantWallets.length) % participantWallets.length
        const createContributionResponse1 = await CSPlatform.connect(participantWallets[participantIndex]).createContribution(imageUrl);
        await createContributionResponse1.wait();
    }

    return CSPlatform;
}


async function displayCreatedContributions(CSPlatform) {
    const filter = CSPlatform.filters.ContributionCreated;
    const events = await CSPlatform.queryFilter(filter);

    const columns = [
        colors.blue('Contribution Index'),
        colors.blue('Participant Address'),
        colors.blue('Image'),
    ];
    const table = new Table({
        head: columns
    });

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [participant, image] = event.args;
        table.push([i, participant, image]);
    }

    console.log(table.toString());
}

async function assignContributions(CSPlatform, reviewerWallets) {
    let i = 0;
    while (true) {
        try {
            let reviewerIndex = (i + reviewerWallets.length) % reviewerWallets.length;
            const assignContributionResponse = await CSPlatform.connect(reviewerWallets[reviewerIndex]).assignContribution();
            await assignContributionResponse.wait();
        } catch (error) {
            break;
        }
        i++;
    }

    return CSPlatform;
}

async function displayAssignedContributions(CSPlatform) {
    const filter = CSPlatform.filters.ContributionAssigned;
    const events = await CSPlatform.queryFilter(filter);

    const columns = [
        colors.blue('Contribution Index'),
        colors.blue('Participant Address'),
        colors.blue('Image'),
        colors.blue('Reviewer Address'),
    ];
    const table = new Table({
        head: columns
    });

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, image, reviewer] = event.args;
        table.push([id, participant, image, reviewer]);
    }

    console.log(table.toString());
}



/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {

    const NUM_WALLETS = 10;
    const PARTICIPANT_REVIEWER_RATIO = 0.5;
    const NUM_CONTRIBUTIONS = 10;

    const imageUrl = "http://example.com"; // Replace with actual image URL
    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;

    console.log("Deploying CSPlatform...");
    const CSPlatformFactory = await ethers.getContractFactory("CSPlatform");
    let CSPlatform = await CSPlatformFactory.deploy();
    await CSPlatform.waitForDeployment();
    console.log("CSPlatform deployed to:", await CSPlatform.getAddress());
    console.log(" ");

    console.log("Create wallets...");
    const connectedWallets = await createWallets(NUM_WALLETS, signer, provider);
    const [participantWallets, reviewerWallets] = await splitWallets(connectedWallets, PARTICIPANT_REVIEWER_RATIO);
    await displayWallets(participantWallets, reviewerWallets, provider);
    console.log("Wallets created!");
    console.log(" ");

    console.log("Create contributions...");
    CSPlatform = await createContributions(NUM_CONTRIBUTIONS, CSPlatform, participantWallets, imageUrl);
    await displayCreatedContributions(CSPlatform);
    console.log("Contributions created!");
    console.log(" ");

    console.log("Assign contributions...")
    CSPlatform = await assignContributions(CSPlatform, reviewerWallets);
    await displayAssignedContributions(CSPlatform);
    console.log("Contribution assigned!");

    //let receiverPublicKey = eccrypto.getPublic(receiverPrivateKey);
    let receiverPublicKey = Buffer.from(connectedWallets[1].publicKey.slice(2), 'hex');
    let message = Buffer.from("Hello, this is a secret message!");
    let encryptedMessage = await eccrypto.encrypt(receiverPublicKey, message);
    console.log("Encrypted message:", encryptedMessage);

    let receiverPrivateKey = Buffer.from(connectedWallets[1].privateKey.slice(2), 'hex');
    let decryptedMessage = await eccrypto.decrypt(receiverPrivateKey, encryptedMessage);
    console.log("Decrypted message:", decryptedMessage.toString());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });