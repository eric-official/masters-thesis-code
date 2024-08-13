const { execSync } = require('child_process');
const fs = require('fs');
const snarkjs = require('snarkjs')
const {ethers} = require('hardhat')
const { getContributionReviewedEvents, getVerifierUpdatedEvents } = require('./events');
const { updateContributionData, getArweaveIdFromUrl} = require('./utils');


/**
 * Create a circuit to verify if a given latitude and longitude are equal to contribution
 * @param lat - latitude of coordinate in the contribution
 * @param lon - longitude of coordinate in the contribution
 * @returns {Promise<string>}
 * @type {(lat: number, lon: number) => Promise<string>}
 */
async function createCircuitCode(lat, lon) {
    return `
        pragma circom 2.0.0;
    
        include "node_modules/circomlib/circuits/pedersen.circom";
        include "node_modules/circomlib/circuits/comparators.circom";
    
    
        template CoordinateInGrid(latTrue, lonTrue) {
    
            // Receive input signals for verification
            signal input latVerify;
            signal input lonVerify;
    
            signal latEqualResult;
            signal lonEqualResult;
    
            // Check if latitude is equal
            component isLatEqual = IsEqual();
            isLatEqual.in[0] <== latTrue;
            isLatEqual.in[1] <== latVerify;
            latEqualResult <== isLatEqual.out;
    
            // Check if longitude is equal
            component isLonEqual = IsEqual();
            isLonEqual.in[0] <== lonTrue;
            isLonEqual.in[1] <== lonVerify;
            lonEqualResult <== isLonEqual.out;
    
            // Output 1 if both conditions are true, else 0
            signal output isInGrid;
            isInGrid <== latEqualResult * lonEqualResult;
        }
    
        component main = CoordinateInGrid(${lat}, ${lon});`
}


/**
 * Create circuit files for a given URL
 * @param url - URL of the contribution
 * @param circuitContent - content of the circuit
 * @param circuitFolder - folder to store the circuit files
 * @returns {Promise<void>}
 * @type {(url: string, circuitContent: string, circuitFolder: string) => Promise<void>}
 */
async function createCircuitFiles(url, circuitContent, circuitFolder) {
    const arweaveId = await getArweaveIdFromUrl(url);
    await fs.writeFileSync(`coordinate-circuit-${arweaveId}.circom`, circuitContent);
    await execSync(`circom coordinate-circuit-${arweaveId}.circom --r1cs --wasm --sym -o ./circuits`);
    await execSync(`snarkjs groth16 setup ${circuitFolder}coordinate-circuit-${arweaveId}.r1cs data/pot14_final.ptau ${circuitFolder}coordinate-circuit-${arweaveId}.zkey -o`);
    await execSync(`snarkjs zkey export solidityverifier ${circuitFolder}coordinate-circuit-${arweaveId}.zkey ${circuitFolder}coordinate-verifier-${arweaveId}.sol`);
}


/**
 * Move verifier contracts to the contracts folder
 * @param circuitFolder - folder containing the verifier contracts
 * @returns {Promise<void>}
 * @type {(circuitFolder: string) => Promise<void>}
 */
async function moveVerifierContracts(circuitFolder) {
    const circuitFolderFiles = fs.readdirSync(circuitFolder);
    const solidityFiles = circuitFolderFiles.filter(file => file.endsWith('.sol'));
    for (const file of solidityFiles) {
        await fs.renameSync(`${circuitFolder}${file}`, `contracts/${file}`);
    }
}


/**
 * Move circom files to the circuits folder
 * @param circuitFolder - destination folder containing the circom files
 * @returns {Promise<void>}
 * @type {(circuitFolder: string) => Promise<void>}
 */
async function moveCircomFiles(circuitFolder) {
    const projectFolderFiles = fs.readdirSync('./');
    const circomFiles = projectFolderFiles.filter(file => file.endsWith('.circom'));
    for (const file of circomFiles) {
        await fs.renameSync(`${file}`, `${circuitFolder}${file}`);
    }
}


/**
 * Deploy verifier contract
 * @param verifierPath - directory path of the verifier contract
 * @returns {Promise<ethers.BaseContract>}
 * @type {(verifierPath: string) => Promise<ethers.BaseContract>}
 */
async function deployVerifierContract(verifierPath) {
    const verifierFactory = await ethers.getContractFactory(verifierPath);
    const verifierContract = await verifierFactory.deploy();
    return await verifierContract.waitForDeployment();
}


/**
 * Add verifier to the contribution in CSPlatform contract
 * @param CSPlatform - CSPlatform contract
 * @param verifierPath - directory path of the verifier contract
 * @param verifierAddress - address of the verifier contract
 * @param events - list of ContributionReviewed events
 * @param participantWallets - wallets of participants
 * @returns {Promise<CSPlatform>}
 * @type {(CSPlatform: CSPlatform, verifierPath: string, verifierAddress: string, events: Array, participantWallets: Array) => Promise<CSPlatform>}
 */
async function addVerifierToCSPlatform(CSPlatform, verifierPath, verifierAddress, events, participantWallets) {
    const cleanedVerifierPath = verifierPath.replace("contracts/coordinate-verifier-", "").replace(".sol:Groth16Verifier", "");
    const imageUrl = `https://arweave.net/${cleanedVerifierPath}`;
    const contribution = events.find(event => event.args.imageUrl === imageUrl);

    const participantIndex = participantWallets.findIndex(wallet => wallet.address === contribution.args.participant);
    const updateVerifierResponse1 = await CSPlatform.connect(participantWallets[participantIndex]).updateVerifier(verifierAddress, contribution.args.contributionId);
    await updateVerifierResponse1.wait();

    return CSPlatform;
}


/**
 * Convert solidity call data to separate arrays
 * @param calldata - solidity call data
 * @returns {Promise<{a: *[], input: *[], b: *[][], c: *[]}>}
 * @type {(calldata: string) => Promise<{a: Array<string>, b: Array<String>, c: Array<Array<String>, Array<String>>, input: Array<String>}>}
 */
async function convertCallData(calldata) {
    const argv = calldata
        .replace(/["[\]\s]/g, "")
        .split(",")
        .map((x) => BigInt(x));

    const a = [argv[0], argv[1]];
    const b = [
        [argv[2], argv[3]],
        [argv[4], argv[5]],
    ];
    const c = [argv[6], argv[7]];
    const input = [argv[8]];

    return { a, b, c, input };
}


/**
 * Create proofs for all contributions
 * @param urlDegreeMapping - mapping of image URLs to degrees
 * @returns {Promise<void>}
 * @type {(urlDegreeMapping: Object) => Promise<void>}
 */
async function createProofs(urlDegreeMapping) {

    const circuitFolder = './circuits/';

    if (!fs.existsSync(`${circuitFolder}`)) {
        fs.mkdirSync(`${circuitFolder}`);
    }

    try {
        for (const [url, degrees] of Object.entries(urlDegreeMapping)) {
            const circuitContent = await createCircuitCode(degrees.lat, degrees.lon);
            await createCircuitFiles(url, circuitContent, circuitFolder);
        }

        await moveVerifierContracts(circuitFolder);
        await execSync('npx hardhat compile');
        await moveCircomFiles(circuitFolder);

    } catch (error) {
        console.log("Error while generating proof!", error);
    }
}


/**
 * Deploy verifier contracts and add them to CSPlatform contract
 * @param CSPlatform - CSPlatform contract
 * @param participantWallets - wallets of participants
 * @param events - list of ContributionReviewed events
 * @returns {Promise<{CSPlatform, verifierContracts: *[]}>}
 * @type {(CSPlatform: CSPlatform, participantWallets: Array, events: Array) => Promise<{CSPlatform: CSPlatform, verifierContracts: Array}>}
 */
async function deployProofs(CSPlatform, participantWallets, events) {
    const contractFolder = 'contracts/';
    const files = fs.readdirSync(contractFolder);
    const verifierFiles = files.filter(file => file.startsWith('coordinate-verifier'));

    const verifierPaths = verifierFiles.map(file => `${contractFolder}${file}:Groth16Verifier`);
    const verifierContracts = [];

    for (const verifierPath of verifierPaths) {
        const verifierContract = await deployVerifierContract(verifierPath);
        const verifierAddress = await verifierContract.getAddress()
        verifierContracts.push(verifierContract);
        CSPlatform = await addVerifierToCSPlatform(CSPlatform, verifierPath, verifierAddress, events, participantWallets);
    }

    return {CSPlatform: CSPlatform, verifierContracts: verifierContracts};
}


/**
 * verify previously created proofs
 * @param CSPlatform - CSPlatform contract
 * @param verifierContracts - list of verifier contracts
 * @param reviewerWallets - wallets of reviewers
 * @param events - list of VerifierUpdated events
 * @param urlDegreeMapping - mapping of image URLs to degrees
 * @returns {Promise<Array.<string, string, string, number, bool>>}
 * @type {(CSPlatform: CSPlatform, verifierContracts: Array, reviewerWallets: Array, events: Array, urlDegreeMapping: Object) => Promise<Array.<string, string, string, number, bool>>}
 */
async function verifyProof(CSPlatform, verifierContracts, reviewerWallets, events, urlDegreeMapping) {
    const circuitsFolder = './circuits/';
    const verifications = [];

    for (const event of events) {
        const [contributionId, participant, reviewer, imageUrl, verifier] = event.args;
        const degreesToVerify = { latVerify: -23, lonVerify: 18 }
        const arweaveId = await getArweaveIdFromUrl(imageUrl);
        const verifierContract = await verifierContracts.find(async (contract) => (await contract.getAddress()).toString() === verifier);
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            degreesToVerify,
            `${circuitsFolder}coordinate-circuit-${arweaveId}_js/coordinate-circuit-${arweaveId}.wasm`,
            `${circuitsFolder}coordinate-circuit-${arweaveId}.zkey`);
        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const convertedCallData = await convertCallData(solidityCallData);
        const verifyResponse = await verifierContract.connect(reviewerWallets[0]).verifyProof(convertedCallData.a, convertedCallData.b, convertedCallData.c, convertedCallData.input);

        const degreeString = `${degreesToVerify.latVerify}, ${degreesToVerify.lonVerify}`;
        verifications.push([imageUrl, verifier, degreeString, publicSignals[0], verifyResponse]);
    }

    return verifications;
}


module.exports = {

    createZKPContracts: async function(CSPlatform, participantWallets, reviewerWallets, contributionData) {
        const reviewEvents = await getContributionReviewedEvents(CSPlatform, 1);
        const urlDegreeMapping = await updateContributionData(contributionData);

        await createProofs(urlDegreeMapping);
        const deployProofsResult = await deployProofs(CSPlatform, participantWallets, reviewEvents);
        CSPlatform = deployProofsResult.CSPlatform;
        const verifierContracts = deployProofsResult.verifierContracts;

        const verifierEvents = await getVerifierUpdatedEvents(CSPlatform);
        const verifications = await verifyProof(CSPlatform, verifierContracts, reviewerWallets, verifierEvents);


        return {CSPlatform: CSPlatform, verifications: verifications};
    }
}