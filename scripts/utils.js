module.exports = {
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


    formatCoordinatesFromBytes: async function(encryptedCoordinatesBytes) {
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
    }
}