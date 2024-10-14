const { execSync } = require('child_process');
const fs = require('fs');
const snarkjs = require('snarkjs')
const {ethers} = require('hardhat')
const { getContributionReviewedEvents, getVerifierUpdatedEvents } = require('./events');
const { updateContributionData, getArweaveIdFromUrl, generateRandomCoordinates} = require('./utils');
const {createObjectCsvWriter: createCsvWriter} = require("csv-writer");


/**
 * Create a circuit to verify if a given latitude and longitude are equal to contribution
 * @param lat - latitude of coordinate in the contribution
 * @param lon - longitude of coordinate in the contribution
 * @returns {Promise<string>}
 * @type {(lat: number, lon: number) => Promise<string>}
 */
async function createCircuitCode(imageLatDeg, imageLatMin, imageLongDeg, imageLongMin) {
    return `
        pragma circom 2.0.0;

    include "node_modules/circomlib/circuits/comparators.circom";
    
    
    template IsMinuteInGrid() {
        signal input verifyMinute;
        signal output out;
    
        signal gridPointArray[10] <== [0, 6, 12, 18, 24, 30, 36, 42, 48, 54];
    
        component isEqual0 = IsEqual();
        isEqual0.in[0] <== verifyMinute;
        isEqual0.in[1] <== gridPointArray[0];
        signal isEqual0Out <== isEqual0.out;
        signal result0 <== isEqual0Out;
    
        component isEqual1 = IsEqual();
        isEqual1.in[0] <== verifyMinute;
        isEqual1.in[1] <== gridPointArray[1];
        signal isEqual1Out <== isEqual1.out;
        signal result1 <== isEqual1Out + result0;
    
        component isEqual2 = IsEqual();
        isEqual2.in[0] <== verifyMinute;
        isEqual2.in[1] <== gridPointArray[2];
        signal isEqual2Out <== isEqual2.out;
        signal result2 <== isEqual2Out + result1;
    
        component isEqual3 = IsEqual();
        isEqual3.in[0] <== verifyMinute;
        isEqual3.in[1] <== gridPointArray[3];
        signal isEqual3Out <== isEqual3.out;
        signal result3 <== isEqual3Out + result2;
    
        component isEqual4 = IsEqual();
        isEqual4.in[0] <== verifyMinute;
        isEqual4.in[1] <== gridPointArray[4];
        signal isEqual4Out <== isEqual4.out;
        signal result4 <== isEqual4Out + result3;
    
        component isEqual5 = IsEqual();
        isEqual5.in[0] <== verifyMinute;
        isEqual5.in[1] <== gridPointArray[5];
        signal isEqual5Out <== isEqual5.out;
        signal result5 <== isEqual5Out + result4;
    
        component isEqual6 = IsEqual();
        isEqual6.in[0] <== verifyMinute;
        isEqual6.in[1] <== gridPointArray[6];
        signal isEqual6Out <== isEqual6.out;
        signal result6 <== isEqual6Out + result5;
    
        component isEqual7 = IsEqual();
        isEqual7.in[0] <== verifyMinute;
        isEqual7.in[1] <== gridPointArray[7];
        signal isEqual7Out <== isEqual7.out;
        signal result7 <== isEqual7Out + result6;
    
        component isEqual8 = IsEqual();
        isEqual8.in[0] <== verifyMinute;
        isEqual8.in[1] <== gridPointArray[8];
        signal isEqual8Out <== isEqual8.out;
        signal result8 <== isEqual8Out + result7;
    
        component isEqual9 = IsEqual();
        isEqual9.in[0] <== verifyMinute;
        isEqual9.in[1] <== gridPointArray[9];
        signal isEqual9Out <== isEqual9.out;
        signal result9 <== isEqual9Out + result8;
    
        out <== result9;
    }
    
    
    template IsInputCorrect() {
        // Inputs
        signal input verifyLatDegree;
        signal input verifyLatMinute;
        signal input verifyLongDegree;
        signal input verifyLongMinute;
    
        // Input Requirements
        signal latDegreeMinReq;
        signal latDegreeMaxReq;
        signal longDegreeMinReq;
        signal longDegreeMaxReq;
        signal latMinuteGridReq;
        signal longMinuteGridReq;
    
        // Requirement Aggregates
        signal latDegreeBoundsReq;
        signal longDegreeBoundsReq;
        signal degreeBoundsReq;
        signal minuteGridReq;
    
        // Outputs
        signal output out;
    
        // Degree bounds check for latitude (-90 to 90)
        component latDegreeMinCheck = GreaterEqThan(10);
        latDegreeMinCheck.in[0] <== verifyLatDegree;
        latDegreeMinCheck.in[1] <== -90;
        latDegreeMinReq <== latDegreeMinCheck.out;
    
        component latDegreeMaxCheck = LessEqThan(10);
        latDegreeMaxCheck.in[0] <== verifyLatDegree;
        latDegreeMaxCheck.in[1] <== 90;
        latDegreeMaxReq <== latDegreeMaxCheck.out;
    
        // Degree bounds check for longitude (-180 to 180)
        component longDegreeMinCheck = GreaterEqThan(10);
        longDegreeMinCheck.in[0] <== verifyLongDegree;
        longDegreeMinCheck.in[1] <== -180;
        longDegreeMinReq <== longDegreeMinCheck.out;
    
        component longDegreeMaxCheck = LessEqThan(10);
        longDegreeMaxCheck.in[0] <== verifyLongDegree;
        longDegreeMaxCheck.in[1] <== 180;
        longDegreeMaxReq <== longDegreeMaxCheck.out;
    
        // Check that minutes are verify for 0.1-degree grid
        component verifyLatMinuteInGrid = IsMinuteInGrid();
        verifyLatMinuteInGrid.verifyMinute <== verifyLatMinute;
        latMinuteGridReq <== verifyLatMinuteInGrid.out;
    
        component verifyLongMinuteInGrid = IsMinuteInGrid();
        verifyLongMinuteInGrid.verifyMinute <== verifyLongMinute;
        longMinuteGridReq <== verifyLongMinuteInGrid.out;
    
        // Aggregate requirements for output
        latDegreeBoundsReq <== latDegreeMinReq * latDegreeMaxReq;
        longDegreeBoundsReq <== longDegreeMinReq * longDegreeMaxReq;
        degreeBoundsReq <== latDegreeBoundsReq * longDegreeBoundsReq;
        minuteGridReq <== latMinuteGridReq * longMinuteGridReq;
        out <== degreeBoundsReq * minuteGridReq;
    }
    
    
    template IsCoordinateInGrid() {
        // Inputs
        signal input imageLatDegree;
        signal input imageLatMinute;
        signal input imageLongDegree;
        signal input imageLongMinute;
        signal input verifyLatDegree;
        signal input verifyLatMinute;
        signal input verifyLongDegree;
        signal input verifyLongMinute;
    
        // Coordinate Checks
        signal latDegreeEqResult;
        signal longDegreeEqResult;
        signal latMinuteNorthResult;
        signal latMinuteSouthResult;
        signal longMinuteWestResult;
        signal longMinuteEastResult;
    
        // Coordinate in Grid Requirements
        signal degreeEqReq;
        signal latMinuteReq;
        signal longMinuteReq;
        signal minuteInGridReq;
    
        // Outputs
        signal output inGrid;
    
        // Degree equality check
        component latDegreeEqCheck = IsEqual();
        latDegreeEqCheck.in[0] <== verifyLatDegree;
        latDegreeEqCheck.in[1] <== imageLatDegree;
        latDegreeEqResult <== latDegreeEqCheck.out;
    
        component longDegreeEqCheck = IsEqual();
        longDegreeEqCheck.in[0] <== verifyLongDegree;
        longDegreeEqCheck.in[1] <== imageLongDegree;
        longDegreeEqResult <== longDegreeEqCheck.out;
    
        // Minute checks for latitude
        component latMinuteNorthCheck = LessEqThan(10);
        latMinuteNorthCheck.in[0] <== verifyLatMinute;
        latMinuteNorthCheck.in[1] <== imageLatMinute;
        latMinuteNorthResult <== latMinuteNorthCheck.out;
    
        component latMinuteSouthCheck = LessThan(10);
        latMinuteSouthCheck.in[0] <== imageLatMinute;
        latMinuteSouthCheck.in[1] <== verifyLatMinute + 6;
        latMinuteSouthResult <== latMinuteSouthCheck.out;
    
        // Minute checks for longitude
        component longMinuteWestCheck = LessEqThan(10);
        longMinuteWestCheck.in[0] <== verifyLongMinute;
        longMinuteWestCheck.in[1] <== imageLongMinute;
        longMinuteWestResult <== longMinuteWestCheck.out;
    
        component longMinuteEastCheck = LessThan(10);
        longMinuteEastCheck.in[0] <== imageLongMinute;
        longMinuteEastCheck.in[1] <== verifyLongMinute + 6;
        longMinuteEastResult <== longMinuteEastCheck.out;
    
        degreeEqReq <== latDegreeEqResult * longDegreeEqResult;
        latMinuteReq <== latMinuteNorthResult * latMinuteSouthResult;
        longMinuteReq <== longMinuteWestResult * longMinuteEastResult;
        minuteInGridReq <== latMinuteReq * longMinuteReq;
    
        inGrid <== degreeEqReq * minuteInGridReq;
    }
    
    
    template Main(imageLatDegree, imageLatMinute, imageLongDegree, imageLongMinute) {
    
        // Inputs
        signal input verifyLatDegree;
        signal input verifyLatMinute;
        signal input verifyLongDegree;
        signal input verifyLongMinute;
    
        // Outputs
        signal output inGrid;
    
        // Check input requirements
        component checkInputRequirements = IsInputCorrect();
        checkInputRequirements.verifyLatDegree <== verifyLatDegree;
        checkInputRequirements.verifyLatMinute <== verifyLatMinute;
        checkInputRequirements.verifyLongDegree <== verifyLongDegree;
        checkInputRequirements.verifyLongMinute <== verifyLongMinute;
        signal inputRequirementsMet <== checkInputRequirements.out;
        1 === inputRequirementsMet;
    
        // Check if the verify coordinates are in the grid
        component coordinateInGrid = IsCoordinateInGrid();
        coordinateInGrid.imageLatDegree <== imageLatDegree;
        coordinateInGrid.imageLatMinute <== imageLatMinute;
        coordinateInGrid.imageLongDegree <== imageLongDegree;
        coordinateInGrid.imageLongMinute <== imageLongMinute;
        coordinateInGrid.verifyLatDegree <== verifyLatDegree;
        coordinateInGrid.verifyLatMinute <== verifyLatMinute;
        coordinateInGrid.verifyLongDegree <== verifyLongDegree;
        coordinateInGrid.verifyLongMinute <== verifyLongMinute;
        inGrid <== coordinateInGrid.inGrid;
    }
    
    component main = Main(${imageLatDeg}, ${imageLatMin}, ${imageLongDeg}, ${imageLongMin});`
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
    await execSync(`snarkjs groth16 setup ${circuitFolder}coordinate-circuit-${arweaveId}.r1cs data/pot8_final.ptau ${circuitFolder}coordinate-circuit-${arweaveId}.zkey -o`);
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
 * @param participantWallet - wallet of participant
 * @returns {Promise<CSPlatform>}
 * @type {(CSPlatform: CSPlatform, verifierPath: string, verifierAddress: string, events: Array, participantWallets: Array) => Promise<CSPlatform>}
 */
async function addVerifierToCSPlatform(CSPlatform, verifierPath, verifierAddress, events, participantWallet) {
    const contribution = events[events.length - 1];
    try {
        const updateVerifierResponse1 = await CSPlatform.connect(participantWallet).updateVerifier(verifierAddress, contribution.args.contributionId);
        await updateVerifierResponse1.wait();
    } catch (error) {

    }

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
 * @param urlCoordinatesMapping - mapping of image URLs to degrees
 * @returns {Promise<void>}
 * @type {(urlCoordinatesMapping: Object) => Promise<void>}
 */
async function createProofs(urlCoordinatesMapping) {

    const circuitFolder = './circuits/';

    if (!fs.existsSync(`${circuitFolder}`)) {
        fs.mkdirSync(`${circuitFolder}`);
    }

    try {
        for (const [url, coordinates] of Object.entries(urlCoordinatesMapping)) {
            const circuitContent = await createCircuitCode(coordinates.latDeg, coordinates.latMin, coordinates.longDeg, coordinates.longMin);
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
 * @param participantWallet - wallet of participant
 * @param events - list of ContributionReviewed events
 * @param imageUrl - URL of the contribution
 * @param ipfs - ipfs instance
 * @returns {Promise<{CSPlatform, verifierContracts: *[]}>}
 * @type {(CSPlatform: CSPlatform, participantWallets: Array, events: Array) => Promise<{CSPlatform: CSPlatform, verifierContracts: Array}>}
 */
async function deployProofs(CSPlatform, participantWallet, events, imageUrl, ipfs) {
    const contractFolder = 'contracts/';
    const files = fs.readdirSync(contractFolder);
    const verifierFiles = files.filter(file => file.startsWith('coordinate-verifier'));

    const imageId = imageUrl.replace("https://arweave.net/", "");
    const verifierFile = verifierFiles.filter(file => file.includes(imageId));

    const verifierPaths = verifierFile.map(file => `${contractFolder}${file}:Groth16Verifier`);
    const verifierContracts = [];

    const startTime = Date.now();
    for (const verifierPath of verifierPaths) {
        const verifierContract = await deployVerifierContract(verifierPath);
        const verifierAddress = await verifierContract.getAddress()
        verifierContracts.push(verifierContract);
        CSPlatform = await addVerifierToCSPlatform(CSPlatform, verifierPath, verifierAddress, events, participantWallet);
    }

    const ipfsCid = await ipfs.addFile({path: `./circuits/coordinate-circuit-${imageId}_js/coordinate-circuit-${imageId}.wasm`})

    const totalTime = Date.now() - startTime;

    return {CSPlatform: CSPlatform, verifierContracts: verifierContracts, time: totalTime, ipfsInstance:ipfs, ipfsCid: ipfsCid};
}


/**
 * verify previously created proofs
 * @param CSPlatform - CSPlatform contract
 * @param verifierContracts - list of verifier contracts
 * @param reviewerWallet - wallet of reviewer
 * @param event - VerifierUpdated event
 * @param urlDegreeMapping - mapping of image URLs to degrees
 * @param degreesToVerify - degrees to verify
 * @param ipfs - ipfs instance
 * @param ipfsCid - ipfs cid
 * @returns {Promise<Array.<string, string, string, number, bool>>}
 * @type {(CSPlatform: CSPlatform, verifierContracts: Array, reviewerWallets: Array, events: Array, urlDegreeMapping: Object) => Promise<Array.<string, string, string, number, bool>>}
 */
async function verifyProof(CSPlatform, verifierContracts, reviewerWallet, event, urlDegreeMapping, degreesToVerify, ipfs, ipfsCid) {
    const circuitsFolder = './circuits/';

    try {
        const [contributionId, participant, reviewer, imageUrlUtf8, verifier] = event.args;
        const imageUrl = ethers.toUtf8String(imageUrlUtf8);
        const arweaveId = await getArweaveIdFromUrl(imageUrl);
        await ipfs.cat(ipfsCid)
        const verifierContract = await verifierContracts.find(async (contract) => (await contract.getAddress()).toString() === verifier);
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            degreesToVerify,
            `${circuitsFolder}coordinate-circuit-${arweaveId}_js/coordinate-circuit-${arweaveId}.wasm`,
            `${circuitsFolder}coordinate-circuit-${arweaveId}.zkey`);
        const solidityCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const convertedCallData = await convertCallData(solidityCallData);
        const verifyResponse = await verifierContract.connect(reviewerWallet).verifyProof(convertedCallData.a, convertedCallData.b, convertedCallData.c, convertedCallData.input);
        return Number(publicSignals[0]);
    }
    catch (error) {
        return -1;
    }
}


module.exports = {

    createZKPContracts: async function(CSPlatform, participantWallet, reviewerWallet, contributionData, imageUrl, FUZZY_TEST) {
        const reviewEvents = await getContributionReviewedEvents(CSPlatform, 1);
        const urlCoordinatesMapping = await updateContributionData(contributionData);

        await createProofs(urlCoordinatesMapping);

        const { createHelia } = await import('helia')
        const { unixfs } = await import('@helia/unixfs')
        const helia = await createHelia()
        const fs = unixfs(helia)

        const deployProofsResult = await deployProofs(CSPlatform, participantWallet, reviewEvents, imageUrl, fs);
        CSPlatform = deployProofsResult.CSPlatform;
        const time = deployProofsResult.time;
        const verifierContracts = deployProofsResult.verifierContracts;
        const ipfs = deployProofsResult.ipfsInstance;
        const ipfsCid = deployProofsResult.ipfsCid;

        const verifierEvents = await getVerifierUpdatedEvents(CSPlatform);
        const currentVerifierEvent = verifierEvents[verifierEvents.length - 1];

        if (FUZZY_TEST === 'False') {
            const degreesToVerify = { verifyLatDegree: -23, verifyLatMinute: 6, verifyLongDegree: 18, verifyLongMinute: 18}
            await verifyProof(CSPlatform, verifierContracts, reviewerWallet, currentVerifierEvent, urlCoordinatesMapping, degreesToVerify, ipfs, ipfsCid);
        } else {
            const verificationLog = [];
            for (let i = 0; i < 1000; i++) {
                const degreesToVerify = await generateRandomCoordinates(contributionData[imageUrl]);
                degreesToVerify.verificationResult = await verifyProof(CSPlatform, verifierContracts, reviewerWallet, currentVerifierEvent, urlCoordinatesMapping, degreesToVerify, ipfs, ipfsCid);
                verificationLog.push(degreesToVerify);
            }

            const verificationWriter = createCsvWriter({
                path: 'data/verifications' + Date.now() + '.csv',
                header: [
                    {id: 'verifyLatDegree', title: 'verifyLatDegree'},
                    {id: 'verifyLatMinute', title: 'verifyLatMinute'},
                    {id: 'verifyLongDegree', title: 'verifyLongDegree'},
                    {id: 'verifyLongMinute', title: 'verifyLongMinute'},
                    {id: 'verificationResult', title: 'verificationResult'}
                ]
            });
            await verificationWriter.writeRecords(verificationLog);
        }


        return {CSPlatform: CSPlatform, time: time};
    }
}