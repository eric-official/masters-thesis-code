const {ethers} = require('hardhat')
const {getContributionCreatedEvents, getContributionAssignedEvents, getCoordinateUpdatedEvents} = require('./events')
const {formatCoordinatesToBytes, formatCoordinatesFromBytes} = require('./utils')
const {displayWallets, displayCreatedContributions, displayAssignedContributions} = require('./display')
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


async function createContributions(numContributions, CSPlatform, participantWallets, imageUrl) {
    for (let i = 0; i < numContributions; i++) {
        const participantIndex = (i + participantWallets.length) % participantWallets.length
        const createContributionResponse1 = await CSPlatform.connect(participantWallets[participantIndex]).createContribution(imageUrl);
        await createContributionResponse1.wait();
    }

    return CSPlatform;
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


async function updateCoordinates(CSPlatform, participantWallets, reviewerWallets) {
    const events = await getContributionAssignedEvents(CSPlatform)

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, image, reviewer] = event.args;

        const participantIndex = participantWallets.findIndex(wallet => wallet.address === participant);
        const reviewerIndex = reviewerWallets.findIndex(wallet => wallet.address === reviewer);
        let reviewerPublicKey = Buffer.from(reviewerWallets[reviewerIndex].publicKey.slice(2), 'hex');
        let coordinatesBuffer = Buffer.from("Hello, this is a secret message!");
        let encryptedCoordinates = await eccrypto.encrypt(reviewerPublicKey, coordinatesBuffer);
        let formattedCoordinates = await formatCoordinatesToBytes(encryptedCoordinates);

        const updateCoordinatesResponse = await CSPlatform.connect(participantWallets[participantIndex]).updateCoordinates(id, formattedCoordinates);
        await updateCoordinatesResponse.wait();
    }

    return CSPlatform;
}

async function displayUpdatedCoordinates(CSPlatform) {
    const events = await getCoordinateUpdatedEvents(CSPlatform);

    const columns = [
        colors.blue('Contribution Index'),
        colors.blue('Participant Address'),
        colors.blue('Image'),
        colors.blue('Reviewer Address'),
        colors.blue('Coordinates'),
    ];
    const table = new Table({
        head: columns
    });

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, reviewer, image, coordinates] = event.args;
        table.push([id, participant, reviewer, image, coordinates]);
    }

    console.log(table.toString());
}

async function displayDecryptedCoordinates(CSPlatform, participantWallets, reviewerWallets) {
    const events = await getCoordinateUpdatedEvents(CSPlatform)

    const columns = [
        colors.blue('Contribution Index'),
        colors.blue('Participant Address'),
        colors.blue('Image'),
        colors.blue('Reviewer Address'),
        colors.blue('Coordinates'),
    ];
    const table = new Table({
        head: columns
    });

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, reviewer, image, coordinates] = event.args;

        let reviewerIndex = reviewerWallets.findIndex(wallet => wallet.address === reviewer);
        let receiverPrivateKey = Buffer.from(reviewerWallets[reviewerIndex].privateKey.slice(2), 'hex');

        let encryptedCoordinates = await formatCoordinatesFromBytes(coordinates);
        let decryptedCoordinates = await eccrypto.decrypt(receiverPrivateKey, encryptedCoordinates);
        decryptedCoordinates = decryptedCoordinates.toString();

        table.push([id, participant, reviewer, image, decryptedCoordinates]);
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

    console.log("Update coordinates...");
    CSPlatform = await updateCoordinates(CSPlatform, participantWallets, reviewerWallets);
    await displayUpdatedCoordinates(CSPlatform);
    console.log("Coordinates updated!");

    console.log("Decrypt coordinates...");
    await displayDecryptedCoordinates(CSPlatform, participantWallets, reviewerWallets);
    console.log("Coordinates decrypted!");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });