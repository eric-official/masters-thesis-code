const { execSync } = require('child_process');
const fs = require('fs');
const snarkjs = require('snarkjs')
const {ethers} = require('hardhat')



const { getContributionReviewedEvents, getVerifierUpdatedEvents } = require('./events');
const { updateUrlCoordinateMapping, getArweaveIdFromUrl} = require('./utils');


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


async function createCircuitFiles(url, circuitContent, circuitFolder) {
    const arweaveId = await getArweaveIdFromUrl(url);
    await fs.writeFileSync(`coordinate-circuit-${arweaveId}.circom`, circuitContent);
    await execSync(`circom coordinate-circuit-${arweaveId}.circom --r1cs --wasm --sym -o ./circuits`);
    await execSync(`snarkjs groth16 setup ${circuitFolder}coordinate-circuit-${arweaveId}.r1cs data/pot14_final.ptau ${circuitFolder}coordinate-circuit-${arweaveId}.zkey -o`);
    await execSync(`snarkjs zkey export solidityverifier ${circuitFolder}coordinate-circuit-${arweaveId}.zkey ${circuitFolder}coordinate-verifier-${arweaveId}.sol`);
}

async function moveVerifierContracts(circuitFolder) {
    const circuitFolderFiles = fs.readdirSync(circuitFolder);
    const solidityFiles = circuitFolderFiles.filter(file => file.endsWith('.sol'));
    for (const file of solidityFiles) {
        await fs.renameSync(`${circuitFolder}${file}`, `contracts/${file}`);
    }
}

async function moveCircomFiles(circuitFolder) {
    const projectFolderFiles = fs.readdirSync('./');
    const circomFiles = projectFolderFiles.filter(file => file.endsWith('.circom'));
    for (const file of circomFiles) {
        await fs.renameSync(`${file}`, `${circuitFolder}${file}`);
    }
}

async function deployVerifierContract(verifierPath) {
    const verifierFactory = await ethers.getContractFactory(verifierPath);
    const verifierContract = await verifierFactory.deploy();
     return await verifierContract.waitForDeployment();
}

async function addVerifierToCSPlatform(CSPlatform, verifierPath, verifierAddress, events, participantWallets) {
    const cleanedVerifierPath = verifierPath.replace("contracts/coordinate-verifier-", "").replace(".sol:Groth16Verifier", "");
    const imageUrl = `https://arweave.net/${cleanedVerifierPath}`;
    const contribution = events.find(event => event.args.imageUrl === imageUrl);

    const participantIndex = participantWallets.findIndex(wallet => wallet.address === contribution.args.participant);
    const updateVerifierResponse1 = await CSPlatform.connect(participantWallets[participantIndex]).updateVerifier(verifierAddress, contribution.args.contributionId);
    await updateVerifierResponse1.wait();

    return CSPlatform;
}

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

    createZKPContracts: async function(CSPlatform, participantWallets, reviewerWallets, urlCoordinateMapping) {
        const reviewEvents = await getContributionReviewedEvents(CSPlatform, 1);
        const urlDegreeMapping = await updateUrlCoordinateMapping(urlCoordinateMapping);

        await createProofs(urlDegreeMapping);
        const deployProofsResult = await deployProofs(CSPlatform, participantWallets, reviewEvents);
        CSPlatform = deployProofsResult.CSPlatform;
        const verifierContracts = deployProofsResult.verifierContracts;

        const verifierEvents = await getVerifierUpdatedEvents(CSPlatform);
        const verifications = await verifyProof(CSPlatform, verifierContracts, reviewerWallets, verifierEvents);


        return {CSPlatform: CSPlatform, verifications: verifications};
    }
}