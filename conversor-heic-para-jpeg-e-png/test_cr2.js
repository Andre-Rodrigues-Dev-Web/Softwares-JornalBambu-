const dcraw = require('dcraw');
console.log('Type of dcraw:', typeof dcraw);
try {
    // Create a dummy buffer to see if it crashes immediately or throws a specific error
    const input = Buffer.from('test');
    const result = dcraw(input, { verbose: true });
    console.log('Result:', result);
} catch (e) {
    console.error('Error:', e.message);
}
