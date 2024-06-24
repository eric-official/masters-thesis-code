const { execSync } = require('child_process');
const fs = require('fs');
const {ethers} = require('hardhat')


const { getContributionReviewedEvents } = require('./events');
const { updateUrlCoordinateMapping, getArweaveIdFromUrl} = require('./utils');


async function createCircuit(lat, lon) {
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

//TODO: Move contracts and circom files
async function createProofs(urlDegreeMapping) {
    const circuitFolder = './circuits/';
    try {
        for (const [url, degrees] of Object.entries(urlDegreeMapping)) {
            const circuitContent = await createCircuit(degrees.lat, degrees.lon);
            const arweaveId = await getArweaveIdFromUrl(url);
            await fs.writeFileSync(`coordinate-circuit-${arweaveId}.circom`, circuitContent);
            await execSync(`circom coordinate-circuit-${arweaveId}.circom --r1cs --wasm --sym -o ./circuits`);
            await execSync(`snarkjs groth16 setup ${circuitFolder}coordinate-circuit-${arweaveId}.r1cs data/pot14_final.ptau ${circuitFolder}coordinate-circuit-${arweaveId}.zkey -o`);
            await execSync(`snarkjs zkey export solidityverifier ${circuitFolder}coordinate-circuit-${arweaveId}.zkey ${circuitFolder}coordinate-verifier-${arweaveId}.sol`);
        }
    } catch (error) {
        console.log("Error while generating proof!", error);
    }
}


async function deployProofs(CSPlatform, participantWallets, events) {
    const circuitFolder = 'contracts/';
    const files = fs.readdirSync(circuitFolder);
    const verifierFiles = files.filter(file => file.startsWith('coordinate-verifier'));

    const verifierPaths = verifierFiles.map(file => `${circuitFolder}${file}:Groth16Verifier`);
    const verifierContracts = [];

    for (const verifierPath of verifierPaths) {
        const verifierFactory = await ethers.getContractFactory(verifierPath);
        const verifierContract = await verifierFactory.deploy();
        await verifierContract.waitForDeployment();
        const verifierAddress = await verifierContract.getAddress()
        verifierContracts.push(verifierContract);

        const cleanedVerifierPath = verifierPath.replace("contracts/coordinate-verifier-", "").replace(".sol:Groth16Verifier", "");
        const imageUrl = `https://arweave.net/${cleanedVerifierPath}`;
        const contribution = events.find(event => event.args.imageUrl === imageUrl);

        const participantIndex = participantWallets.findIndex(wallet => wallet.address === contribution.args.participant);
        const updateVerifierResponse1 = await CSPlatform.connect(participantWallets[participantIndex]).updateVerifier(verifierAddress, contribution.args.contributionId);
        await updateVerifierResponse1.wait();
    }

    return CSPlatform;
}


module.exports = {

    createZKPContracts: async function(CSPlatform, participantWallets, urlCoordinateMapping) {
        const events = await getContributionReviewedEvents(CSPlatform, 1);
        const urlDegreeMapping = await updateUrlCoordinateMapping(urlCoordinateMapping);
        await createProofs(urlDegreeMapping);
        await deployProofs(CSPlatform, participantWallets, events);

        return CSPlatform;
    }
}