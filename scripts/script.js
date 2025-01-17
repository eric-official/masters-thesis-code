const {ethers} = require('hardhat')
const {getContributionAssignedEvents, getContributionReviewedEvents} = require('./events')
const {formatCoordinatesToBytes, getImageURLs, deleteVerifierContracts} = require('./utils')
const {displayWallets} = require('./display')
const {createZKPContracts} = require('./proofs')
const eccrypto = require('eccrypto');
const cliProgress = require('cli-progress');
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


/**
 * Split wallets into participant and reviewer wallets
 * @param connectedWallets - list of connected wallets
 * @param participantReviewerRatio - ratio of participants to reviewers
 * @returns {Promise<*[]>}
 * @type {(connectedWallets: Array.<ethers.Wallet>, participantReviewerRatio: number) => Promise<*[]>}
 */
async function splitWallets(connectedWallets, participantReviewerRatio) {
    const participantWallets = connectedWallets.slice(1, connectedWallets.length);
    const reviewerWallets = connectedWallets.slice(0, 1);

    return [participantWallets, reviewerWallets];
}


/**
 * Create contribution with participant wallet
 * @param CSPlatform - CSPlatform contract
 * @param participantWallet - participant wallet
 * @param imageUrl - URL of the image to be uploaded
 * @param contributionData - data of the contribution
 * @returns {Promise<{CSPlatform, time: number}>}
 * @type {(CSPlatform: any, participantWallet: any, imageUrl: string, contributionData: any) => Promise<{CSPlatform: any, time: number}>}
 */
async function createContributions(CSPlatform, participantWallet, imageUrl, contributionData) {
    const animalSpecies = contributionData[imageUrl].animalSpecies;

    const imageUrlBytes = ethers.toUtf8Bytes(imageUrl);
    const animalSpeciesBytes32 = animalSpecies.map(animal => ethers.encodeBytes32String(animal));

    const startTime = Date.now();
    const createContributionResponse1 = await CSPlatform.connect(participantWallet).createContribution(imageUrlBytes, Date.now(), animalSpeciesBytes32);
    await createContributionResponse1.wait();
    const totalTime = Date.now() - startTime;

    return {CSPlatform: CSPlatform, time: totalTime};
}


async function assignContributions(CSPlatform, reviewerWallet) {
    const startTime = Date.now();
    const assignContributionResponse = await CSPlatform.connect(reviewerWallet).assignContribution();
    await assignContributionResponse.wait();
    const totalTime = Date.now() - startTime;

    return {CSPlatform: CSPlatform, time: totalTime};
}


/**
 * Update coordinates of the contribution
 * @param CSPlatform - CSPlatform contract
 * @param participantWallet - participant wallet
 * @param reviewerWallet - reviewer wallet
 * @param contributionData - data of the contribution
 * @returns {Promise<{CSPlatform, time: number}>}
 * @type {(CSPlatform: any, participantWallet: any, reviewerWallet: any, contributionData: any) => Promise<{CSPlatform: any, time: number}>}
 */
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

    const startTime = Date.now();
    const updateCoordinatesResponse = await CSPlatform.connect(participantWallet).updateCoordinates(id, formattedCoordinates);
    await updateCoordinatesResponse.wait();
    const totalTime = Date.now() - startTime;

    return {CSPlatform: CSPlatform, time: totalTime};
}


/**
 * Review contributions
 * @param CSPlatform - CSPlatform contract
 * @param reviewerWallet - reviewer wallet
 * @returns {Promise<{CSPlatform, reputation_x: *, reputation: *, time: number}>}
 * @type {(CSPlatform: any, reviewerWallet: any) => Promise<{CSPlatform: any, reputation_x: *, reputation: *, time: number}>}
 */
async function reviewContributions(CSPlatform, reviewerWallet) {
    const events = await getContributionAssignedEvents(CSPlatform);

    const event = events[events.length - 1];
    const [id, participant, reviewer, image] = event.args;

    const startTime = Date.now();
    const reviewResponse = await CSPlatform.connect(reviewerWallet).reviewContribution(id, 1, 1, 1, 1, 5);
    await reviewResponse.wait();
    const totalTime = Date.now() - startTime;

    const reviews = await getContributionReviewedEvents(CSPlatform);
    const review = reviews[reviews.length - 1];
    const [, , , , , participantReputation, , reputation_x] = review.args;

    return {CSPlatform: CSPlatform, time: totalTime, reputation: participantReputation, reputation_x: reputation_x};
}


/**
 * Run crowdsourcing process
 * @param CSPlatform - CSPlatform contract
 * @param participantWallet - participant wallet
 * @param reviewerWallet - reviewer wallet
 * @param contributionData - data of the contribution
 * @param imageUrl - URL of the image to be uploaded
 * @param provider - Ethers provider
 * @param i - index of the contribution
 * @param FUZZY_TEST - fuzzy test flag
 * @returns {Promise<{CSPlatform, participantBalances: {address, initial: *, review: *, final: *, create: *, update: *, step: *, user: string, assign: *}, reviewerBalances: {address, initial: *, review: *, final: *, create: *, update: *, step: *, user: string, assign: *}, timeRepRecord: {reputation_x: number, reputation: number, assignOff: number, total: number, reviewOff: number, updateOff: number, zkpOn, zkpOff: number, createOff: number, reviewOn: *, step: *, createOn: *, assignOn: number, updateOn: *}}>}
 */
async function runCrowdsourcingProcess(CSPlatform, participantWallet, reviewerWallet, contributionData, imageUrl, provider, i, FUZZY_TEST) {
    const participantInitialBalance = await provider.getBalance(participantWallet.address);
    const reviewerInitialBalance = await provider.getBalance(reviewerWallet.address);
    const startTime = Date.now();

    let initialTime = Date.now();
    const createContributionResult = await createContributions(CSPlatform, participantWallet, imageUrl, contributionData);
    CSPlatform = createContributionResult.CSPlatform;
    const createTimeOn = createContributionResult.time;
    const createTimeOff = Date.now() - initialTime - createTimeOn;
    const participantCreateBalance = await provider.getBalance(participantWallet.address);
    const reviewerCreateBalance = await provider.getBalance(reviewerWallet.address);

    initialTime = Date.now();
    const assignContributionResult = await assignContributions(CSPlatform, reviewerWallet);
    CSPlatform = assignContributionResult.CSPlatform;
    const assignTimeOn = assignContributionResult.time;
    const assignTimeOff = Date.now() - initialTime - assignTimeOn;
    const participantAssignBalance = await provider.getBalance(participantWallet.address);
    const reviewerAssignBalance = await provider.getBalance(reviewerWallet.address);

    initialTime = Date.now();
    const updateCoordinatesResult = await updateCoordinates(CSPlatform, participantWallet, reviewerWallet, contributionData);
    CSPlatform = updateCoordinatesResult.CSPlatform;
    const updateTimeOn = updateCoordinatesResult.time;
    const updateTimeOff = Date.now() - initialTime - updateTimeOn;
    const participantUpdateBalance = await provider.getBalance(participantWallet.address);
    const reviewerUpdateBalance = await provider.getBalance(reviewerWallet.address);

    initialTime = Date.now();
    const reviewContributionResult = await reviewContributions(CSPlatform, reviewerWallet);
    CSPlatform = reviewContributionResult.CSPlatform;
    const reviewTimeOn = reviewContributionResult.time;
    const reviewTimeOff = Date.now() - initialTime - reviewTimeOn;
    const participantReputation = Number(reviewContributionResult.reputation) / 1e18;
    const reputation_x = Number(reviewContributionResult.reputation_x) / 1e18;
    const participantReviewBalance = await provider.getBalance(participantWallet.address);
    const reviewerReviewBalance = await provider.getBalance(reviewerWallet.address);

    initialTime = Date.now();
    const createZKPContractsRes = await createZKPContracts(CSPlatform, participantWallet, reviewerWallet, contributionData, imageUrl, FUZZY_TEST, provider);
    CSPlatform = createZKPContractsRes.CSPlatform;
    const zkpTimeOn = createZKPContractsRes.time;
    const zkpTimeOff = Date.now() - initialTime - zkpTimeOn;
    const participantFinalBalance = await provider.getBalance(participantWallet.address);
    const reviewerFinalBalance = await provider.getBalance(reviewerWallet.address);

    const totalTime = Date.now() - startTime;

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

    const timeRepRecord = {
        step: i + 1,
        createOn: createTimeOn,
        createOff: createTimeOff,
        assignOn: assignTimeOn,
        assignOff: assignTimeOff,
        updateOn: updateTimeOn,
        updateOff: updateTimeOff,
        reviewOn: reviewTimeOn,
        reviewOff: reviewTimeOff,
        zkpOn: zkpTimeOn,
        zkpOff: zkpTimeOff,
        total: totalTime,
        reputation: participantReputation,
        reputation_x: reputation_x
    }

    return {
        CSPlatform: CSPlatform,
        participantBalances: participantBalances,
        reviewerBalances: reviewerBalances,
        timeRepRecord: timeRepRecord
    };
}


/*Script to interact with all functions of CSPlatform.sol contract*/
async function main() {

    console.assert(process.argv.length === 7, "Usage: npx hardhat run scripts/script.js <SIMULATION_MODE> <PARTICIPANT_SELECTION> <NUM_WALLETS> <NUM_CONTRIBUTIONS> <FUZZY_TEST>")
    console.assert(["Standard", "Rounds"].includes(process.argv[2]), "SIMULATION_MODE must be either 'Standard' or 'Rounds'")
    console.assert(["Subsequent", "Alternating"].includes(process.argv[3]), "PARTICIPANT_SELECTION must be either 'Subsequent' or 'Alternating'")
    console.assert(Number.isInteger(Number(process.argv[4])), "NUM_WALLETS must be an integer")
    console.assert(Number.isInteger(Number(process.argv[5])), "NUM_CONTRIBUTIONS must be an integer")
    console.assert(["True", "False"].includes(process.argv[6]), "FUZZY_TEST must be either 'True' or 'False'")

    // Constants for simulating test cases
    const SIMULATION_MODE = (process.argv[2] || "Standard")
    const PARTICIPANT_SELECTION = (process.argv[3] || "Alternating");
    const NUM_WALLETS = (process.argv[4] || 2);
    const NUM_CONTRIBUTIONS = (process.argv[5] || 1);
    const FUZZY_TEST = (process.argv[6] || 'False');

    if (FUZZY_TEST === 'True') {
        console.assert(NUM_CONTRIBUTIONS === 1 && NUM_WALLETS === 2, "FUZZY_TEST can only be used with 1 contribution and 2 wallets")
    }

    // Assumed user inputs
    let contributionData = {
        "https://arweave.net/id5oYIqwOfW_NAEquZJSMRxKov7IRfYREJ03eJCtWZQ": {
            coordinates: "23° 11' 6.786\" S, 18° 22' 36.054\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/Rk9Y8H1ovtcVDit5IsG2SJEZhBqL5Iy_DM9-ZQRx5nk": {
            coordinates: "23° 12' 48.954\" S, 18° 21' 18.996\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/7kHJd52Gc-eGKwrNtQ5SU7JULtUEMN6Rrr_Fh5ZzKBI": {
            coordinates: "23° 11' 19.194\" S, 18° 22' 35.91\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/mbmDz84Bwg-QJUPti1R_NDppp7GlaKU8B-lIaIl-WeI": {
            coordinates: "23° 12' 46.794\" S, 18° 21' 29.484\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/9xxe9BJVc8GuLiwcQ1b-tJ13AZjk8M2Htro-Ho_Tty4": {
            coordinates: "23° 12' 44.838\" S, 18° 21' 29.256\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/1x0AMo5rNQ49CSSRcRPfvNRcSnZHNyZiP-qkEE0yfuc": {
            coordinates: "23° 11' 19.182\" S, 18° 22' 38.19\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/HQjn6bjPJ7ZVFqD5OT9ZZi5f6G6aQ1EsAY71ArKs718": {
            coordinates: "23° 11' 4.698\" S, 18° 22' 54.78\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/I30T_ukE7QGYMPEJv3BMvTfftqyl0UbgMoovNUXCNTw": {
            coordinates: "23° 11' 4.65\" S, 18° 22' 34.926\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/NqQee7j8ES8wauzqBOCLg-xB9jNaMCNYB68x3ZpuUgk": {
            coordinates: "23° 12' 46.878\" S, 18° 21' 14.844\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
        "https://arweave.net/Gzpb6toLQtpzWr2dItEmtbutSOWmFH1LOQh2uxd8nck": {
            coordinates: "23° 11' 4.638\" S, 18° 22' 39.138\" E",
            animalSpecies: ["Elephant", "Lion"]
        },
    }

    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;

    console.log("Create wallets...");
    const connectedWallets = await createWallets(NUM_WALLETS, signer, provider);
    const [participantWallets, reviewerWallets] = await splitWallets(connectedWallets);
    await displayWallets(participantWallets, reviewerWallets, provider);
    console.log("Wallets created!");
    console.log(" ");

    const tx2 = await signer.sendTransaction({to: reviewerWallets[0].address, value: ethers.parseEther("10")});
    await tx2.wait();

    console.log("Deploying CSPlatform...");
    const CSPlatformFactory = await ethers.getContractFactory("CSPlatform", reviewerWallets[0]);
    let CSPlatform = await CSPlatformFactory.deploy({
        value: ethers.parseEther("10") // 1 Ether, adjust the amount as needed
    });
    await CSPlatform.waitForDeployment();
    console.log("CSPlatform deployed to:", await CSPlatform.getAddress());
    console.log(" ");

    // fill ether difference of reviewerWallets[0] up to 10 ether
    const reviewerWallet0Balance = await provider.getBalance(reviewerWallets[0].address);
    const tx = await signer.sendTransaction({
        to: reviewerWallets[0].address,
        value: ethers.parseEther("10") - reviewerWallet0Balance
    });
    await tx.wait();

    console.log("Get image URLs...");
    const imageUrls = (await getImageURLs()).slice(0, 10);
    await deleteVerifierContracts();
    console.log("Image URLs retrieved!");

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(NUM_CONTRIBUTIONS, 0);
    const balanceRecords = [];
    const timeRepRecords = [];
    const roundRecords = [];
    roundRecords.push({round: 0, numReviews: 1});
    let round = 1;
    let numReviewsInRound = 0;

    for (let i = 0; i < NUM_CONTRIBUTIONS; i++) {
        let participantIndex
        if (PARTICIPANT_SELECTION === "Subsequent") {
            participantIndex = 0;
        } else {
            participantIndex = (i + participantWallets.length) % participantWallets.length
        }
        let participantWallet = participantWallets[participantIndex];

        let reviewerIndex;
        if (SIMULATION_MODE === "Rounds" && numReviewsInRound === reviewerWallets.length) {
            const roundRecord = {round: round, numReviews: numReviewsInRound}
            roundRecords.push(roundRecord);
            numReviewsInRound = 0;
            reviewerIndex = numReviewsInRound
            round += 1;
        } else if (SIMULATION_MODE === "Rounds" && numReviewsInRound < reviewerWallets.length) {
            reviewerIndex = numReviewsInRound;
            numReviewsInRound += 1;
        } else {
            reviewerIndex = (i + reviewerWallets.length) % reviewerWallets.length;
        }
        let reviewerWallet = reviewerWallets[reviewerIndex];

        const imageIndex = (i + imageUrls.length) % imageUrls.length;
        const imageUrl = imageUrls[imageIndex];

        const contributionDataElement = {}
        contributionDataElement[imageUrl] = contributionData[imageUrl]

        const contractInitialBalance = await provider.getBalance(await CSPlatform.getAddress());
        const processResults = await runCrowdsourcingProcess(CSPlatform, participantWallet, reviewerWallet, contributionDataElement, imageUrl, provider, i, FUZZY_TEST);
        CSPlatform = processResults.CSPlatform;
        const participantBalances = processResults.participantBalances;
        const reviewerBalances = processResults.reviewerBalances;
        const contractFinalBalance = await provider.getBalance(await CSPlatform.getAddress());

        participantBalances.contractInitial = contractInitialBalance;
        participantBalances.contractFinal = contractFinalBalance;
        reviewerBalances.contractInitial = contractInitialBalance;
        reviewerBalances.contractFinal = contractFinalBalance;

        balanceRecords.push(processResults.participantBalances);
        balanceRecords.push(processResults.reviewerBalances);
        timeRepRecords.push(processResults.timeRepRecord);

        const contributionReviewedEvents = await getContributionReviewedEvents(CSPlatform);
        const recentEvent = contributionReviewedEvents[contributionReviewedEvents.length - 1];
        if (Number(recentEvent.args.participantReputation) / 1e18 >= 0.7 && participantWallets.length > 1) {
            reviewerWallets.push(participantWallet);
            participantWallets.splice(participantIndex, 1);
        }
        progressBar.update(i + 1);
    }

    const balanceWriter = createCsvWriter({
        path: 'data/balances' + Date.now() + '.csv',
        header: [
            {id: 'step', title: 'Step'},
            {id: 'address', title: 'Address'},
            {id: 'user', title: 'User'},
            {id: 'initial', title: 'Initial Balance'},
            {id: 'create', title: 'Create Contribution'},
            {id: 'assign', title: 'Assign Contribution'},
            {id: 'update', title: 'Update Coordinates'},
            {id: 'review', title: 'Review Contribution'},
            {id: 'final', title: 'Final Balance'},
            {id: 'contractInitial', title: 'Contract Initial Balance'},
            {id: 'contractFinal', title: 'Contract Final Balance'}
        ]
    });
    await balanceWriter.writeRecords(balanceRecords)

    const timeWriter = createCsvWriter({
        path: 'data/timesRep' + Date.now() + '.csv',
        header: [
            {id: 'step', title: 'Step'},
            {id: 'createOn', title: 'Create Contribution On-Chain'},
            {id: 'createOff', title: 'Create Contribution Off-Chain'},
            {id: 'assignOn', title: 'Assign Contribution On-Chain'},
            {id: 'assignOff', title: 'Assign Contribution Off-Chain'},
            {id: 'updateOn', title: 'Update Coordinates On-Chain'},
            {id: 'updateOff', title: 'Update Coordinates Off-Chain'},
            {id: 'reviewOn', title: 'Review Contribution On-Chain'},
            {id: 'reviewOff', title: 'Review Contribution Off-Chain'},
            {id: 'zkpOn', title: 'ZKP Contracts On-Chain'},
            {id: 'zkpOff', title: 'ZKP Contracts Off-Chain'},
            {id: 'total', title: 'Total Time'},
            {id: 'reputation', title: 'Participant Reputation'},
            {id: 'reputation_x', title: 'Reputation x'}
        ]
    });
    await timeWriter.writeRecords(timeRepRecords)

    const roundWriter = createCsvWriter({
        path: 'data/rounds' + Date.now() + '.csv',
        header: [
            {id: 'round', title: 'Round'},
            {id: 'numReviews', title: 'Number of Reviews'}
        ]
    });
    await roundWriter.writeRecords(roundRecords)

    progressBar.stop();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });