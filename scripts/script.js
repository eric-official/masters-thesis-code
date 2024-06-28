const {ethers} = require('hardhat')
const {getContributionCreatedEvents, getContributionAssignedEvents, getCoordinateUpdatedEvents} = require('./events')
const {formatCoordinatesToBytes, formatCoordinatesFromBytes, getImageURLs} = require('./utils')
const {displayWallets, displayCreatedContributions, displayAssignedContributions, displayUpdatedCoordinates, displayDecryptedCoordinates,
    displayReviewedContributions,
    displayUpdatedVerifiers, displayVerifications
} = require('./display')
const {createProofs, createZKPContracts} = require('./proofs')
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
    const connectedWallets = [];

    for (let i = 0; i < numWallets; i++) {
        const wallet = ethers.Wallet.createRandom();
        const connectedWallet = wallet.connect(provider);
        const tx = await signer.sendTransaction({to: connectedWallet.address, value: ethers.parseEther("10")});
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


async function createContributions(numContributions, CSPlatform, participantWallets, imageUrls) {
    for (let i = 0; i < numContributions; i++) {
        const participantIndex = (i + participantWallets.length) % participantWallets.length
        const participantWallet = participantWallets[participantIndex];

        const imageIndex = (i + imageUrls.length) % imageUrls.length;
        const imageUrl = imageUrls[imageIndex];

        const createContributionResponse1 = await CSPlatform.connect(participantWallet).createContribution(imageUrl);
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


async function updateCoordinates(CSPlatform, participantWallets, reviewerWallets, urlCoordinateMapping) {
    const events = await getContributionAssignedEvents(CSPlatform)

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, reviewer, image] = event.args;

        const participantIndex = participantWallets.findIndex(wallet => wallet.address === participant);
        const reviewerIndex = reviewerWallets.findIndex(wallet => wallet.address === reviewer);
        const reviewerPublicKey = Buffer.from(reviewerWallets[reviewerIndex].publicKey.slice(2), 'hex');

        const coordinates = urlCoordinateMapping[image];
        const coordinatesBuffer = Buffer.from(coordinates);
        const encryptedCoordinates = await eccrypto.encrypt(reviewerPublicKey, coordinatesBuffer);
        const formattedCoordinates = await formatCoordinatesToBytes(encryptedCoordinates);

        const updateCoordinatesResponse = await CSPlatform.connect(participantWallets[participantIndex]).updateCoordinates(id, formattedCoordinates);
        await updateCoordinatesResponse.wait();
    }

    return CSPlatform;
}


async function reviewContributions(CSPlatform, reviewerWallets) {
    const events = await getContributionAssignedEvents(CSPlatform);

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const [id, participant, reviewer, image] = event.args;

        const reviewerIndex = reviewerWallets.findIndex(wallet => wallet.address === reviewer);
        const reviewResponse = await CSPlatform.connect(reviewerWallets[reviewerIndex]).reviewContribution(id, true, true);
        await reviewResponse.wait();
    }

    return CSPlatform;
}


/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {

    // Constants for simulating test cases
    const NUM_WALLETS = 10;
    const PARTICIPANT_REVIEWER_RATIO = 0.5;
    const NUM_CONTRIBUTIONS = 10;

    // Assumed user inputs
    const urlCoordinateMapping = {
        "https://arweave.net/id5oYIqwOfW_NAEquZJSMRxKov7IRfYREJ03eJCtWZQ": "23° 11' 6.786\" S, 18° 22' 36.054\" E",
        "https://arweave.net/Rk9Y8H1ovtcVDit5IsG2SJEZhBqL5Iy_DM9-ZQRx5nk": "23° 12' 48.954\" S, 18° 21' 18.996\" E",
        "https://arweave.net/7kHJd52Gc-eGKwrNtQ5SU7JULtUEMN6Rrr_Fh5ZzKBI": "23° 11' 19.194\" S, 18° 22' 35.91\" E",
        "https://arweave.net/mbmDz84Bwg-QJUPti1R_NDppp7GlaKU8B-lIaIl-WeI": "23° 12' 46.794\" S, 18° 21' 29.484\" E",
        "https://arweave.net/9xxe9BJVc8GuLiwcQ1b-tJ13AZjk8M2Htro-Ho_Tty4": "23° 12' 44.838\" S, 18° 21' 29.256\" E",
        "https://arweave.net/1x0AMo5rNQ49CSSRcRPfvNRcSnZHNyZiP-qkEE0yfuc": "23° 11' 19.182\" S, 18° 22' 38.19\" E",
        "https://arweave.net/HQjn6bjPJ7ZVFqD5OT9ZZi5f6G6aQ1EsAY71ArKs718": "23° 11' 4.698\" S, 18° 22' 54.78\" E",
        "https://arweave.net/I30T_ukE7QGYMPEJv3BMvTfftqyl0UbgMoovNUXCNTw": "23° 11' 4.65\" S, 18° 22' 34.926\" E",
        "https://arweave.net/NqQee7j8ES8wauzqBOCLg-xB9jNaMCNYB68x3ZpuUgk": "23° 12' 46.878\" S, 18° 21' 14.844\" E",
        "https://arweave.net/Gzpb6toLQtpzWr2dItEmtbutSOWmFH1LOQh2uxd8nck": "23° 11' 4.638\" S, 18° 22' 39.138\" E",
    }

    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;

    console.log("Get image URLs...");
    const imageUrls = await getImageURLs();
    console.log("Image URLs retrieved!");

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
    CSPlatform = await createContributions(NUM_CONTRIBUTIONS, CSPlatform, participantWallets, imageUrls);
    await displayCreatedContributions(CSPlatform);
    console.log("Contributions created!");
    console.log(" ");

    console.log("Assign contributions...")
    CSPlatform = await assignContributions(CSPlatform, reviewerWallets);
    await displayAssignedContributions(CSPlatform);
    console.log("Contribution assigned!");

    console.log("Update coordinates...");
    CSPlatform = await updateCoordinates(CSPlatform, participantWallets, reviewerWallets, urlCoordinateMapping);
    await displayUpdatedCoordinates(CSPlatform);
    console.log("Coordinates updated!");

    console.log("Decrypt coordinates...");
    await displayDecryptedCoordinates(CSPlatform, participantWallets, reviewerWallets);
    console.log("Coordinates decrypted!");

    console.log("Review contributions...");
    CSPlatform = await reviewContributions(CSPlatform, reviewerWallets);
    await displayReviewedContributions(CSPlatform);
    console.log("Contributions reviewed!");

    console.log("Create ZKP Contracts...");
    const createZKPContractsRes = await createZKPContracts(CSPlatform, participantWallets, reviewerWallets, urlCoordinateMapping);
    CSPlatform = createZKPContractsRes.CSPlatform;
    const verifications = createZKPContractsRes.verifications;

    await displayUpdatedVerifiers(CSPlatform);
    await displayVerifications(verifications);
    console.log("ZKP Contracts verified!");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });