const {ethers} = require('hardhat')
const {getContributionCreatedEvents, getContributionAssignedEvents, getCoordinateUpdatedEvents} = require('./events')
const {formatCoordinatesToBytes, getImageURLs} = require('./utils')
const {displayWallets, displayCreatedContributions, displayAssignedContributions, displayUpdatedCoordinates, displayDecryptedCoordinates,
    displayReviewedContributions,
    displayUpdatedVerifiers, displayVerifications
} = require('./display')
const {createProofs, createZKPContracts} = require('./proofs')
const Table = require('cli-table3')
const colors = require('@colors/colors');
const eccrypto = require('eccrypto');
const cliProgress = require('cli-progress');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;


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


async function createContributions(CSPlatform, participantWallet, imageUrl, contributionData) {
    const animalSpecies = contributionData[imageUrl].animalSpecies;

    const imageUrlBytes = ethers.toUtf8Bytes(imageUrl);
    const animalSpeciesBytes32 = animalSpecies.map(animal => ethers.encodeBytes32String(animal));


    const createContributionResponse1 = await CSPlatform.connect(participantWallet).createContribution(imageUrlBytes, Date.now(), animalSpeciesBytes32);
    await createContributionResponse1.wait();

    return CSPlatform;
}


async function assignContributions(CSPlatform, reviewerWallet) {
    let i = 0;
    while (true) {
        try {
            const assignContributionResponse = await CSPlatform.connect(reviewerWallet).assignContribution();
            await assignContributionResponse.wait();
        } catch (error) {
            break;
        }
        i++;
    }

    return CSPlatform;
}


async function updateCoordinates(CSPlatform, participantWallet, reviewerWallet, contributionData) {
    const events = await getContributionAssignedEvents(CSPlatform)

    // select the latest event that matches the paricipant and reviewer
    const event = events[events.length - 1];
    const [id, participant, reviewer, image] = event.args;

    const reviewerPublicKey = Buffer.from(reviewerWallet.publicKey.slice(2), 'hex');

    const coordinates = contributionData[ethers.toUtf8String(image)].coordinates;
    const coordinatesBuffer = Buffer.from(coordinates);
    const encryptedCoordinates = await eccrypto.encrypt(reviewerPublicKey, coordinatesBuffer);
    const formattedCoordinates = await formatCoordinatesToBytes(encryptedCoordinates);

    const updateCoordinatesResponse = await CSPlatform.connect(participantWallet).updateCoordinates(id, formattedCoordinates);
    await updateCoordinatesResponse.wait();


    return CSPlatform;
}


async function reviewContributions(CSPlatform, reviewerWallet, provider) {
    const events = await getContributionAssignedEvents(CSPlatform);

    const event = events[events.length - 1];
    const [id, participant, reviewer, image] = event.args;

    const reviewResponse = await CSPlatform.connect(reviewerWallet).reviewContribution(id, 1, 1, 1, 1, 5);
    await reviewResponse.wait();

    return CSPlatform;
}


async function runCrowdsourcingProcess(CSPlatform, participantWallet, reviewerWallet, contributionData, imageUrl, provider, i) {
    const participantInitialBalance = await provider.getBalance(participantWallet.address);
    const reviewerInitialBalance = await provider.getBalance(reviewerWallet.address);

    CSPlatform = await createContributions(CSPlatform, participantWallet, imageUrl, contributionData);
    const participantCreateBalance = await provider.getBalance(participantWallet.address);
    const reviewerCreateBalance = await provider.getBalance(reviewerWallet.address);

    CSPlatform = await assignContributions(CSPlatform, reviewerWallet);
    const participantAssignBalance = await provider.getBalance(participantWallet.address);
    const reviewerAssignBalance = await provider.getBalance(reviewerWallet.address);

    CSPlatform = await updateCoordinates(CSPlatform, participantWallet, reviewerWallet, contributionData);
    const participantUpdateBalance = await provider.getBalance(participantWallet.address);
    const reviewerUpdateBalance = await provider.getBalance(reviewerWallet.address);

    CSPlatform = await reviewContributions(CSPlatform, reviewerWallet, provider);
    const participantReviewBalance = await provider.getBalance(participantWallet.address);
    const reviewerReviewBalance = await provider.getBalance(reviewerWallet.address);

    const createZKPContractsRes = await createZKPContracts(CSPlatform, participantWallet, reviewerWallet, contributionData);
    CSPlatform = createZKPContractsRes.CSPlatform;
    const verifications = createZKPContractsRes.verifications;
    const participantFinalBalance = await provider.getBalance(participantWallet.address);
    const reviewerFinalBalance = await provider.getBalance(reviewerWallet.address);

    const participantBalances = {
        step: i + 1,
        address: participantWallet.address,
        user: "Participant",
        initial: participantInitialBalance,
        create: participantCreateBalance,
        assign: participantAssignBalance,
        update: participantUpdateBalance,
        review: participantReviewBalance,
        final: participantFinalBalance
    }

    const reviewerBalances = {
        step: i + 1,
        address: reviewerWallet.address,
        user: "Reviewer",
        initial: reviewerInitialBalance,
        create: reviewerCreateBalance,
        assign: reviewerAssignBalance,
        update: reviewerUpdateBalance,
        review: reviewerReviewBalance,
        final: reviewerFinalBalance
    }

    return {CSPlatform: CSPlatform, participantBalances: participantBalances, reviewerBalances: reviewerBalances};
}


/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {

    // Constants for simulating test cases
    const SIMULATION_MODE = (process.argv[2] || "Staged")
    const NUM_WALLETS = (process.argv[3] || 2);
    const PARTICIPANT_REVIEWER_RATIO = (process.argv[4] || 0.5);
    const NUM_CONTRIBUTIONS = (process.argv[5] || 1);
    const LOG_CONTRIBUTIONS = (process.argv[6] || false);

    // Assumed user inputs
    let contributionData = {
        "https://arweave.net/id5oYIqwOfW_NAEquZJSMRxKov7IRfYREJ03eJCtWZQ": {coordinates: "23° 11' 6.786\" S, 18° 22' 36.054\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/Rk9Y8H1ovtcVDit5IsG2SJEZhBqL5Iy_DM9-ZQRx5nk": {coordinates: "23° 12' 48.954\" S, 18° 21' 18.996\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/7kHJd52Gc-eGKwrNtQ5SU7JULtUEMN6Rrr_Fh5ZzKBI": {coordinates: "23° 11' 19.194\" S, 18° 22' 35.91\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/mbmDz84Bwg-QJUPti1R_NDppp7GlaKU8B-lIaIl-WeI": {coordinates: "23° 12' 46.794\" S, 18° 21' 29.484\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/9xxe9BJVc8GuLiwcQ1b-tJ13AZjk8M2Htro-Ho_Tty4": {coordinates: "23° 12' 44.838\" S, 18° 21' 29.256\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/1x0AMo5rNQ49CSSRcRPfvNRcSnZHNyZiP-qkEE0yfuc": {coordinates: "23° 11' 19.182\" S, 18° 22' 38.19\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/HQjn6bjPJ7ZVFqD5OT9ZZi5f6G6aQ1EsAY71ArKs718": {coordinates: "23° 11' 4.698\" S, 18° 22' 54.78\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/I30T_ukE7QGYMPEJv3BMvTfftqyl0UbgMoovNUXCNTw": {coordinates: "23° 11' 4.65\" S, 18° 22' 34.926\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/NqQee7j8ES8wauzqBOCLg-xB9jNaMCNYB68x3ZpuUgk": {coordinates: "23° 12' 46.878\" S, 18° 21' 14.844\" E", animalSpecies: ["Elephant", "Lion"]},
        "https://arweave.net/Gzpb6toLQtpzWr2dItEmtbutSOWmFH1LOQh2uxd8nck": {coordinates: "23° 11' 4.638\" S, 18° 22' 39.138\" E", animalSpecies: ["Elephant", "Lion"]},
    }

    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;

    console.log("Create wallets...");
    const connectedWallets = await createWallets(NUM_WALLETS, signer, provider);
    const [participantWallets, reviewerWallets] = await splitWallets(connectedWallets, PARTICIPANT_REVIEWER_RATIO);
    await displayWallets(participantWallets, reviewerWallets, provider);
    console.log("Wallets created!");
    console.log(" ");

    console.log("Deploying CSPlatform...");
    const CSPlatformFactory = await ethers.getContractFactory("CSPlatform", reviewerWallets[0]);
    let CSPlatform = await CSPlatformFactory.deploy({
        value: ethers.parseEther("5") // 1 Ether, adjust the amount as needed
    });
    await CSPlatform.waitForDeployment();
    console.log("CSPlatform deployed to:", await CSPlatform.getAddress());
    console.log(" ");

    // fill ether difference of reviewerWallets[0] up to 10 ether
    const reviewerWallet0Balance = await provider.getBalance(reviewerWallets[0].address);
    const tx = await signer.sendTransaction({to: reviewerWallets[0].address, value: ethers.parseEther("10") - reviewerWallet0Balance});
    await tx.wait();

    console.log("Get image URLs...");
    const imageUrls = await getImageURLs();
    console.log("Image URLs retrieved!");

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(NUM_CONTRIBUTIONS, 0);
    const balanceRecords = [];

    for (let i = 0; i < NUM_CONTRIBUTIONS; i++) {
        const participantIndex = (i + participantWallets.length) % participantWallets.length
        const participantWallet = participantWallets[participantIndex];

        const reviewerIndex = (i + reviewerWallets.length) % reviewerWallets.length;
        const reviewerWallet = reviewerWallets[reviewerIndex];

        const imageIndex = (i + imageUrls.length) % imageUrls.length;
        const imageUrl = imageUrls[imageIndex];

        const contributionDataElement = {}
        contributionDataElement[imageUrl] = contributionData[imageUrl]

        const processResults = await runCrowdsourcingProcess(CSPlatform, participantWallet, reviewerWallet, contributionDataElement, imageUrl, provider, i);
        CSPlatform = processResults.CSPlatform;
        balanceRecords.push(processResults.participantBalances);
        balanceRecords.push(processResults.reviewerBalances);

        progressBar.update(i + 1);
    }

    const csvWriter = createCsvWriter({
        path: 'data/balances.csv' + Date.now(),
        header: [
            {id: 'step', title: 'Step'},
            {id: 'address', title: 'Address'},
            {id: 'user', title: 'User'},
            {id: 'initial', title: 'Initial Balance'},
            {id: 'create', title: 'Create Contribution'},
            {id: 'assign', title: 'Assign Contribution'},
            {id: 'update', title: 'Update Coordinates'},
            {id: 'review', title: 'Review Contribution'},
            {id: 'final', title: 'Final Balance'}
        ]
    });

    await csvWriter.writeRecords(balanceRecords)

    progressBar.stop();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });