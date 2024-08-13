const Table = require('cli-table3')
const colors = require('@colors/colors');
const {Akord, Auth} = require('@akord/akord-js');
require('dotenv').config();


module.exports = {

    /**
     * Get all image URLs from Akord vault
     * @returns {Promise<Array<String>>}
     * @type {() => Promise<Array<String>>}
     */
    getImageURLs: async function () {
        try {
            const EMAIL = process.env.AKORD_EMAIL;
            const PASSWORD = process.env.AKORD_PASSWORD;
            const VAULT_ID = 'L8YrrUseO1dVmmoMN1uAKbTeqwsH37zM-2bKGD3J474';
            const arweaveGatewayUrl = "https://arweave.net/";

            const { wallet } = await Auth.signIn(EMAIL.toString(), PASSWORD.toString())
            const akord = await Akord.init(wallet)

            const stacks = await akord.stack.listAll(VAULT_ID);
            return stacks.map(stack => arweaveGatewayUrl + stack.uri);

        } catch (error) {
            console.error('Error retrieving image URLs:', error);
        }
    },


    /**
     * Format the encrypted coordinates into a hex string
     * @param encryptedCoordinates - Encrypted coordinates object
     * @returns {Promise<string>}
     * @type {(encryptedCoordinates: Object) => Promise<string>}
     */
    formatCoordinatesToBytes: async function (encryptedCoordinates) {
        // Concatenate parts into a single Buffer
        const encryptedData = Buffer.concat([
            encryptedCoordinates.iv,
            encryptedCoordinates.ephemPublicKey,
            encryptedCoordinates.ciphertext,
            encryptedCoordinates.mac
        ]);

        // Convert the Buffer to a hex string with "0x" prefix
        return "0x" + encryptedData.toString("hex");
    },


    /**
     * Format the encrypted coordinates from a hex string into a decryptable object
     * @param encryptedCoordinatesBytes - Encrypted coordinates hex string
     * @returns {Promise<{ciphertext: Buffer, iv: Buffer, mac: Buffer, ephemPublicKey: Buffer}>}
     * @type {(encryptedCoordinatesBytes: string) => Promise<{ciphertext: Buffer, iv: Buffer, mac: Buffer, ephemPublicKey: Buffer}>}
     */
    formatCoordinatesFromBytes: async function (encryptedCoordinatesBytes) {
        // Convert the hex string to a Buffer
        const encryptedCoordinatesBuffer = Buffer.from(encryptedCoordinatesBytes.slice(2), "hex");

        // Lengths of each component
        const ivLength = 16; // 16 bytes for AES-128 IV
        const ephemPublicKeyLength = 65; // 65 bytes for uncompressed public key
        const macLength = 32; // 32 bytes for HMAC

        // Extract the components from the buffer
        const iv = encryptedCoordinatesBuffer.slice(0, ivLength);
        const ephemPublicKey = encryptedCoordinatesBuffer.slice(ivLength, ivLength + ephemPublicKeyLength);
        const ciphertext = encryptedCoordinatesBuffer.slice(ivLength + ephemPublicKeyLength, encryptedCoordinatesBuffer.length - macLength);
        const mac = encryptedCoordinatesBuffer.slice(encryptedCoordinatesBuffer.length - macLength);

        // Create the object to pass to the decrypt function
        const encryptedCoordinates = {
            iv: iv,
            ephemPublicKey: ephemPublicKey,
            ciphertext: ciphertext,
            mac: mac
        };

        return encryptedCoordinates;
    },


    /**
     * Create a CLI table with the specified columns
     * @param columns - Array of column names
     * @returns {Promise<Table.GenericTable>}
     * @type {(columns: Array<String>) => Promise<Table.GenericTable>}
     */
    createCliTable: async function (columns) {
        const columnWidths = {
            'Wallet': 15,
            'User Group': 15,
            'Address': 50,
            'Private Key': 70,
            'Balance (ETH)': 15,
            'Index': 10,
            'Participant Address': 20,
            'Reviewer Address': 20,
            'Image': 70,
            'Coordinates': 40,
            'Verifier': 45,
            'Verify Result': 15,
            'Verify Response': 15,
            'Degrees': 10,
        }
        return new Table({
            head: columns.map(column => colors.blue(column)),
            colWidths: columns.map(column => columnWidths[column])
        });
    },


    /**
     * Extract latitude and longitude degrees from a coordinate string
     * @param coordinate - Coordinate string in the format "XX° XX' XX.XX N/S, XX° XX' XX.XX E/W"
     * @returns {Promise<{lon: (number|number), lat: (number|number)}>}
     */
    extractDegreesFromCoordinate: async function(coordinate) {
        // Regex to match the coordinate format
        const regex = /(\d+)° (\d+)' (\d+\.\d+)" ([NS]), (\d+)° (\d+)' (\d+\.\d+)" ([EW])/;
        const match = coordinate.match(regex);

        if (!match) {
            throw new Error('Invalid coordinate format');
        }

        // Extract latitude degrees and direction
        const latDegrees = parseInt(match[1]);
        const latDirection = match[4];

        // Extract longitude degrees and direction
        const longDegrees = parseInt(match[5]);
        const longDirection = match[8];

        // Adjust for direction
        const latitude = latDirection === 'S' ? -latDegrees : latDegrees;
        const longitude = longDirection === 'W' ? -longDegrees : longDegrees;

        return {
            lat: latitude,
            lon: longitude
        };
    },


    /**
     * Update the URL to coordinate mapping with the extracted degrees
     * @param contributionData - Mapping of URLs to coordinates
     * @returns {Promise<{}>}
     */
    updateContributionData: async function(contributionData) {
        const urlDegreeMapping = {};
        for (const [url, data] of Object.entries(contributionData)) {
            urlDegreeMapping[url] = await module.exports.extractDegreesFromCoordinate(data.coordinates);
        }

        return urlDegreeMapping;
    },


    getArweaveIdFromUrl: async function(url) {
        const parts = url.split('/');
        return parts[parts.length - 1];
    }
}